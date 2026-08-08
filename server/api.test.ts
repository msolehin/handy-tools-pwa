// node --env-file-if-exists=.env.local --test server/api.test.ts
//
// Drives the real routes through app.fetch. Covers the paths that move user data: auth
// rejection, push/pull, revision bumping, and the 409 that stops one device silently
// overwriting another.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { app } from './app.ts';
import { hasDb, migrate, pool } from './db.ts';

const BLOB = {
  items: [
    {
      id: 'aaa1111', title: 'Rumah Setapak', category: 'Tenancy', party: 'Encik Rahim',
      phone: '0123456789', address: 'No 12, Jalan Setapak 3',
      startDate: '2025-01-01', endDate: '2026-12-31',
      amount: 1450.5, dueDay: 5, deposit: 2900, notes: 'ada parking',
    },
  ],
  categories: ['Tenancy', 'Internet'],
};

let sid: string;
let userId: string;

const call = (path: string, init: RequestInit = {}, auth = true) =>
  app.fetch(new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(auth ? { cookie: `sk_session=${sid}` } : {}),
      ...(init.headers ?? {}),
    },
  }));

describe('api', { skip: !hasDb && 'DATABASE_URL not set' }, () => {
  before(async () => {
    await migrate();
    const { rows } = await pool!.query(
      `insert into users (google_sub, email, name)
       values ('test-sub-api', 'api@test.local', 'API Test')
       on conflict (google_sub) do update set email = excluded.email
       returning id`);
    userId = rows[0].id;
    sid = randomBytes(32).toString('base64url');
    await pool!.query(
      `insert into sessions (id, user_id, expires_at)
       values ($1, $2, now() + interval '1 hour')`, [sid, userId]);
  });

  after(async () => {
    if (userId) await pool!.query('delete from users where id = $1', [userId]);
    await pool!.end();
  });

  test('health reports database state', async () => {
    const body = await (await call('/api/health', {}, false)).json();
    assert.equal(body.db, true);
  });

  test('no cookie means 401 on every data route', async () => {
    for (const path of ['/api/me', '/api/bootstrap', '/api/sync/tenancy_data']) {
      assert.equal((await call(path, {}, false)).status, 401, path);
    }
  });

  test('an unknown tool is 404, not a silent write', async () => {
    const res = await call('/api/sync/not_a_tool', {
      method: 'PUT', body: JSON.stringify({ data: {} }),
    });
    assert.equal(res.status, 404);
  });

  test('cross-origin writes are rejected', async () => {
    const res = await call('/api/sync/tenancy_data', {
      method: 'PUT',
      headers: { origin: 'https://evil.example' },
      body: JSON.stringify({ data: BLOB }),
    });
    assert.equal(res.status, 403);
  });

  test('the dev proxy origin is allowed, and only outside production', async () => {
    const { isAllowedOrigin } = await import('./auth.ts');
    const api = 'http://localhost:3000/api/sync/tenancy_data';

    // Vite serves the app on 5173 and proxies /api to 3000, so the hosts differ legitimately.
    assert.equal(isAllowedOrigin('http://localhost:5173', api), true);
    assert.equal(isAllowedOrigin('http://127.0.0.1:5173', api), true);
    assert.equal(isAllowedOrigin('https://evil.example', api), false);
    assert.equal(isAllowedOrigin('not-a-url', api), false);

    // Same origin always passes, dev exemption or not.
    assert.equal(isAllowedOrigin('http://localhost:3000', api), true);

    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      assert.equal(isAllowedOrigin('http://localhost:5173', api), false,
        'the loopback exemption must not exist in production');
      assert.equal(isAllowedOrigin('https://senangkit.up.railway.app',
        'https://senangkit.up.railway.app/api/sync/tenancy_data'), true);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  test('push then pull returns the same blob and bumps the revision', async () => {
    const first = await call('/api/sync/tenancy_data', {
      method: 'PUT', body: JSON.stringify({ data: BLOB }),
    });
    assert.equal(first.status, 200);
    const { rev } = await first.json();
    assert.ok(rev >= 1);

    const pulled = await (await call('/api/sync/tenancy_data')).json();
    assert.deepEqual(pulled.data, BLOB);
    assert.equal(pulled.rev, rev);

    const second = await call('/api/sync/tenancy_data', {
      method: 'PUT', body: JSON.stringify({ rev, data: BLOB }),
    });
    assert.equal((await second.json()).rev, rev + 1, 'each write bumps rev');
  });

  test('a stale revision gets 409 with the server copy, not a silent overwrite', async () => {
    const { rev } = await (await call('/api/sync/tenancy_data')).json();

    const stale = await call('/api/sync/tenancy_data', {
      method: 'PUT',
      body: JSON.stringify({ rev: rev - 1, data: { items: [], categories: [] } }),
    });
    assert.equal(stale.status, 409);

    const body = await stale.json();
    assert.equal(body.rev, rev, 'the client is told the current revision');
    assert.deepEqual(body.data, BLOB, 'and handed the server copy to choose from');

    const after = await (await call('/api/sync/tenancy_data')).json();
    assert.deepEqual(after.data, BLOB, 'the rejected write must not have landed');
  });

  test('bootstrap returns the user and every written tool', async () => {
    const body = await (await call('/api/bootstrap')).json();
    assert.equal(body.user.email, 'api@test.local');
    assert.deepEqual(body.data.tenancy_data, BLOB);
    assert.ok(body.revisions.tenancy_data >= 1);
  });

  test('import writes several tools at once', async () => {
    const res = await call('/api/sync/import', {
      method: 'POST',
      body: JSON.stringify({ tenancy_data: BLOB, not_a_tool: { junk: true } }),
    });
    const { imported } = await res.json();
    assert.deepEqual(imported, ['tenancy_data'], 'unknown keys are ignored, not written');
  });

  test('feedback needs an account, a message, and lands with its target', async () => {
    assert.equal((await call('/api/feedback', {
      method: 'POST', body: JSON.stringify({ message: 'hi' }),
    }, false)).status, 401, 'guests cannot post');

    assert.equal((await call('/api/feedback', {
      method: 'POST', body: JSON.stringify({ message: '   ' }),
    })).status, 400);

    const res = await call('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ kind: 'bug', target: '/document-expiry', message: 'tarikh salah' }),
    });
    assert.equal(res.status, 200);

    const { rows } = await pool!.query(
      'select kind, target, message from feedback where user_id = $1', [userId]);
    assert.deepEqual(rows, [{ kind: 'bug', target: '/document-expiry', message: 'tarikh salah' }]);
  });

  test('logout revokes the session', async () => {
    const throwaway = randomBytes(32).toString('base64url');
    await pool!.query(
      `insert into sessions (id, user_id, expires_at)
       values ($1, $2, now() + interval '1 hour')`, [throwaway, userId]);

    const res = await app.fetch(new Request('http://localhost/api/auth/logout', {
      method: 'POST', headers: { cookie: `sk_session=${throwaway}` },
    }));
    assert.equal(res.status, 200);

    const { rows } = await pool!.query('select 1 from sessions where id = $1', [throwaway]);
    assert.equal(rows.length, 0, 'the session row is gone, not just the cookie');
  });
});
