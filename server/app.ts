// Route definitions. Kept separate from index.ts so tests can drive `app.fetch` directly
// without binding a port or running migrations.
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { hasDb, q, tx } from './db.ts';
import { TOOLS, isKnownTool } from './tools.ts';
import {
  GOOGLE_CLIENT_ID, verifyGoogleIdToken, upsertUser,
  createSession, destroySession, requireUser, sameOriginOnly,
} from './auth.ts';

type Vars = { Variables: { userId: string } };

export const app = new Hono();
const api = new Hono<Vars>();

api.use('*', sameOriginOnly);

// Anything needing the database answers 503 rather than throwing when it isn't attached yet.
const needsDb = async (c: { json: (b: unknown, s?: 400 | 503) => Response }, next: () => Promise<void>) => {
  if (!hasDb) return c.json({ error: 'database not configured' }, 503);
  await next();
};

api.get('/health', (c) => c.json({ ok: true, db: hasDb, auth: Boolean(GOOGLE_CLIENT_ID) }));

api.post('/auth/google', needsDb, async (c) => {
  const { credential } = await c.req.json().catch(() => ({ credential: null }));
  if (typeof credential !== 'string') return c.json({ error: 'missing credential' }, 400);

  const profile = await verifyGoogleIdToken(credential);
  if (!profile) return c.json({ error: 'invalid credential' }, 401);

  const userId = await upsertUser(profile);
  await createSession(c, userId);
  return c.json({ user: { email: profile.email, name: profile.name, picture: profile.picture } });
});

api.post('/auth/logout', needsDb, async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

api.get('/me', needsDb, requireUser, async (c) => {
  const { rows } = await q(
    'select email, name, picture from users where id = $1', [c.get('userId')]);
  return c.json({ user: rows[0] ?? null });
});

api.delete('/account', needsDb, requireUser, async (c) => {
  // Cascades through sessions and every tool table.
  await q('delete from users where id = $1', [c.get('userId')]);
  await destroySession(c);
  return c.json({ ok: true });
});

/**
 * One round trip on app start: who am I, and everything I own. The client needs this before
 * React renders because every page reads storage synchronously at mount.
 */
api.get('/bootstrap', needsDb, requireUser, async (c) => {
  const uid = c.get('userId');
  const { rows } = await q(
    'select email, name, picture from users where id = $1', [uid]);

  const revisions: Record<string, number> = {};
  for (const r of (await q(
    'select tool, rev from tool_revisions where user_id = $1', [uid])).rows) {
    revisions[r.tool] = Number(r.rev);
  }

  const data: Record<string, unknown> = {};
  for (const [tool, desc] of Object.entries(TOOLS)) {
    if (revisions[tool] === undefined) continue; // never written — leave local data alone
    data[tool] = await desc.read(q, uid);
  }

  return c.json({ user: rows[0] ?? null, revisions, data });
});

api.get('/sync/:tool', needsDb, requireUser, async (c) => {
  const tool = c.req.param('tool');
  if (!isKnownTool(tool)) return c.json({ error: 'unknown tool' }, 404);
  const uid = c.get('userId');
  const { rows } = await q(
    'select rev from tool_revisions where user_id = $1 and tool = $2', [uid, tool]);
  if (!rows[0]) return c.json({ rev: 0, data: null });
  return c.json({ rev: Number(rows[0].rev), data: await TOOLS[tool].read(q, uid) });
});

api.put('/sync/:tool', needsDb, requireUser, async (c) => {
  const tool = c.req.param('tool');
  if (!isKnownTool(tool)) return c.json({ error: 'unknown tool' }, 404);
  const uid = c.get('userId');
  const body = await c.req.json().catch(() => null) as { rev?: number; data?: unknown } | null;
  if (!body || body.data === undefined) return c.json({ error: 'missing data' }, 400);

  try {
    const result = await tx(async (query) => {
      const current = (await query(
        'select rev from tool_revisions where user_id = $1 and tool = $2 for update',
        [uid, tool])).rows[0];

      // Stale write: hand back what the server has and let the user choose. Silent
      // last-write-wins across devices is unrecoverable data loss.
      if (current && body.rev !== undefined && Number(current.rev) !== body.rev) {
        return { conflict: true, rev: Number(current.rev), data: await TOOLS[tool].read(query, uid) };
      }

      await TOOLS[tool].write(query, uid, body.data);
      const { rows } = await query(
        `insert into tool_revisions (user_id, tool) values ($1, $2)
         on conflict (user_id, tool) do update
           set rev = tool_revisions.rev + 1, updated_at = now()
         returning rev`, [uid, tool]);
      return { conflict: false, rev: Number(rows[0].rev) };
    });

    if (result.conflict) return c.json(result, 409);
    return c.json({ rev: result.rev });
  } catch (err) {
    console.error('sync write failed', tool, err);
    return c.json({ error: 'write failed' }, 500);
  }
});

/** First-login import: push several tools at once, each in the same transaction. */
api.post('/sync/import', needsDb, requireUser, async (c) => {
  const uid = c.get('userId');
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return c.json({ error: 'missing body' }, 400);

  const imported: string[] = [];
  try {
    await tx(async (query) => {
      for (const [tool, data] of Object.entries(body)) {
        if (!isKnownTool(tool) || data === undefined || data === null) continue;
        await TOOLS[tool].write(query, uid, data);
        await query(
          `insert into tool_revisions (user_id, tool) values ($1, $2)
           on conflict (user_id, tool) do update
             set rev = tool_revisions.rev + 1, updated_at = now()`, [uid, tool]);
        imported.push(tool);
      }
    });
  } catch (err) {
    console.error('import failed', err);
    return c.json({ error: 'import failed' }, 500);
  }
  return c.json({ imported });
});

const FEEDBACK_KINDS = ['feedback', 'bug', 'complaint', 'idea'];
const FLOOD_LIMIT = 10; // per account per hour

/** Feedback about any tool, the home page, or the app itself. Signed-in accounts only. */
api.post('/feedback', needsDb, requireUser, async (c) => {
  const uid = c.get('userId');
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const message = String(body?.message ?? '').trim();
  if (!message) return c.json({ error: 'missing message' }, 400);
  if (message.length > 2000) return c.json({ error: 'message too long' }, 400);

  const kind = FEEDBACK_KINDS.includes(String(body?.kind)) ? String(body?.kind) : 'feedback';
  const target = String(body?.target ?? 'other').slice(0, 80);

  const { rows } = await q(
    `select count(*)::int as n from feedback
     where user_id = $1 and created_at > now() - interval '1 hour'`, [uid]);
  if (rows[0].n >= FLOOD_LIMIT) return c.json({ error: 'too many messages' }, 429);

  await q('insert into feedback (user_id, kind, target, message) values ($1,$2,$3,$4)',
    [uid, kind, target, message]);
  return c.json({ ok: true });
});

// Anything under /api that we don't recognise must answer as JSON. If it fell through to the
// SPA fallback below, the client would JSON.parse('<!doctype html>...') and the real error
// would be invisible.
api.all('*', (c) => c.json({ error: 'not found' }, 404));

// Order below is load-bearing.
app.route('/api', api);

// The service worker must never be cached, or registerType:'autoUpdate' keeps handing out a
// stale SW and users stop receiving deploys.
app.use('/sw.js', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-cache');
});

// Vite emits content-hashed filenames under /assets, so they're safe to cache forever.
app.use('/assets/*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
});

app.use('/*', serveStatic({ root: './dist' }));

// SPA fallback, last: all 24 client routes must survive a hard refresh.
app.get('*', serveStatic({ path: './dist/index.html' }));
