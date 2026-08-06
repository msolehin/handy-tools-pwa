import { randomBytes } from 'node:crypto';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context, Next } from 'hono';
import { q } from './db.ts';

const COOKIE = 'sk_session';
const YEAR_SECONDS = 31_536_000;

export const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID ?? '';

export type GoogleProfile = { sub: string; email: string; name: string; picture: string };

/**
 * Verify a Google ID token. The `aud` and `iss` checks ARE the security boundary — without
 * them any Google app's token would log people in here. Runs once per login, not per request.
 */
export async function verifyGoogleIdToken(credential: string): Promise<GoogleProfile | null> {
  if (!GOOGLE_CLIENT_ID) return null;
  const res = await fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
  if (!res.ok) return null;
  const p = await res.json() as Record<string, string>;

  if (p.aud !== GOOGLE_CLIENT_ID) return null;
  if (p.iss !== 'accounts.google.com' && p.iss !== 'https://accounts.google.com') return null;
  if (String(p.email_verified) !== 'true') return null;
  if (Number(p.exp) * 1000 < Date.now()) return null;

  return { sub: p.sub, email: p.email, name: p.name ?? '', picture: p.picture ?? '' };
}

/** Upsert the account and hand back its id. Matched on `sub`, so an email change is fine. */
export async function upsertUser(p: GoogleProfile): Promise<string> {
  const { rows } = await q(
    `insert into users (google_sub, email, name, picture)
     values ($1, $2, $3, $4)
     on conflict (google_sub) do update
       set email = excluded.email,
           name = excluded.name,
           picture = excluded.picture,
           last_seen_at = now()
     returning id`,
    [p.sub, p.email, p.name, p.picture]);
  return rows[0].id as string;
}

export async function createSession(c: Context, userId: string) {
  const id = randomBytes(32).toString('base64url');
  await q(
    `insert into sessions (id, user_id, expires_at, user_agent)
     values ($1, $2, now() + interval '1 year', $3)`,
    [id, userId, c.req.header('user-agent') ?? null]);

  setCookie(c, COOKIE, id, {
    httpOnly: true,
    // Railway is HTTPS-only; local dev over http would otherwise never receive the cookie.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: YEAR_SECONDS,
  });
}

export async function destroySession(c: Context) {
  const id = getCookie(c, COOKIE);
  if (id) await q('delete from sessions where id = $1', [id]);
  deleteCookie(c, COOKIE, { path: '/' });
}

/** Requires a valid session. Sets `userId` on the context. */
export async function requireUser(c: Context, next: Next) {
  const id = getCookie(c, COOKIE);
  if (!id) return c.json({ error: 'unauthorized' }, 401);

  const { rows } = await q(
    'select user_id from sessions where id = $1 and expires_at > now()', [id]);
  if (!rows[0]) {
    deleteCookie(c, COOKIE, { path: '/' });
    return c.json({ error: 'unauthorized' }, 401);
  }
  c.set('userId', rows[0].user_id as string);
  await next();
}

/**
 * Reject cross-origin writes. Everything is same-origin and JSON-only, so this plus the Lax
 * cookie covers CSRF without a token table.
 */
export async function sameOriginOnly(c: Context, next: Next) {
  if (c.req.method !== 'GET') {
    const origin = c.req.header('origin');
    if (origin && new URL(origin).host !== new URL(c.req.url).host) {
      return c.json({ error: 'bad origin' }, 403);
    }
  }
  await next();
}
