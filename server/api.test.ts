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

  // The admin area is the one place where a mistake exposes every account's data at once, so
  // the gate gets tested from both sides — including the misconfiguration case.
  describe('admin', () => {
    const withAdminEmail = async (email: string | undefined, fn: () => Promise<void>) => {
      const previous = process.env.ADMIN_EMAIL;
      if (email === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = email;
      try {
        await fn();
      } finally {
        if (previous === undefined) delete process.env.ADMIN_EMAIL;
        else process.env.ADMIN_EMAIL = previous;
      }
    };

    test('an unset ADMIN_EMAIL locks everyone out, signed in or not', async () => {
      await withAdminEmail(undefined, async () => {
        assert.equal((await call('/admin')).status, 404,
          'a missing env var must fail closed, not hand the page to every account');
        assert.equal((await call('/admin/backup')).status, 404);
      });
    });

    test('another account gets 404, not 403', async () => {
      await withAdminEmail('someone.else@test.local', async () => {
        const res = await call('/admin');
        assert.equal(res.status, 404, 'a wrong guess must not learn that /admin exists');
        assert.equal((await call('/admin/backup')).status, 404);
      });
    });

    test('no session is unauthorized', async () => {
      await withAdminEmail('api@test.local', async () => {
        assert.equal((await call('/admin', {}, false)).status, 401);
      });
    });

    test('the owner gets the page, and the match ignores case', async () => {
      await withAdminEmail('API@Test.Local', async () => {
        const res = await call('/admin');
        assert.equal(res.status, 200);
        assert.match(res.headers.get('content-type') ?? '', /text\/html/);

        const body = await res.text();
        assert.match(body, /SenangKit/);
        for (const section of ['Mesej terkini', 'Salinan data', 'Muat turun salinan']) {
          assert.ok(body.includes(section), `the ${section} section is missing`);
        }
        // Every view is reachable from the menu on every page.
        for (const v of ['ringkasan', 'mesej', 'alat', 'akaun']) {
          assert.ok(body.includes(`/admin?view=${v}`), `the ${v} menu link is missing`);
        }

        // data-stat is the page's stable hook for this; the visible label is Malay copy and
        // free to change without breaking the test.
        const akaun = body.match(/data-stat="akaun"><div class="n">([^<]*)</);
        assert.ok(akaun && Number(akaun[1]) >= 1, 'the account reading renders a real count');
      });
    });

    test('each view renders its own section', async () => {
      await withAdminEmail('api@test.local', async () => {
        for (const [view, marker] of [
          ['mesej', 'Mesej'], ['alat', 'Penggunaan alat'], ['akaun', 'Akaun'],
        ]) {
          const res = await call(`/admin?view=${view}`);
          assert.equal(res.status, 200, `${view} did not render`);
          const body = await res.text();
          assert.ok(body.includes(marker), `${view} is missing its heading`);
          assert.ok(body.includes(`class="on"`), `${view} does not mark the active menu item`);
        }
      });
    });

    test('a junk view or page never errors, and page numbers clamp', async () => {
      await withAdminEmail('api@test.local', async () => {
        // An unknown view falls back to the overview rather than 404ing or throwing.
        const junk = await call('/admin?view=../../etc/passwd');
        assert.equal(junk.status, 200);
        assert.ok((await junk.text()).includes('Mesej terkini'), 'falls back to the overview');

        // A negative offset would be a SQL error; a huge page would be an empty table.
        for (const page of ['abc', '-5', '0', '99999', '1e9', '']) {
          const res = await call(`/admin?view=mesej&page=${encodeURIComponent(page)}`);
          assert.equal(res.status, 200, `page=${page} broke the listing`);
        }
      });
    });

    test('listings paginate once they outgrow a page', async () => {
      // 30 rows against a 25-row page: page 1 is full, page 2 holds the remainder.
      const marker = 'pagination-fixture';
      for (let i = 0; i < 30; i++) {
        await pool!.query(
          `insert into feedback (user_id, kind, target, message, created_at)
           values ($1,'idea','/app',$2, now() - ($3 || ' minutes')::interval)`,
          [userId, `${marker} ${i}`, i]);
      }
      try {
        await withAdminEmail('api@test.local', async () => {
          const one = await (await call('/admin?view=mesej')).text();
          assert.equal((one.match(/class="msg"/g) ?? []).length, 25, 'page 1 holds one full page');
          assert.ok(one.includes('Seterusnya'), 'a next link appears');
          assert.ok(one.includes('/admin?view=mesej&amp;page=2'), 'and points at page 2');

          const two = await (await call('/admin?view=mesej&page=2')).text();
          const onPageTwo = (two.match(/class="msg"/g) ?? []).length;
          assert.ok(onPageTwo > 0 && onPageTwo <= 25, 'page 2 holds the remainder');
          assert.ok(two.includes('Sebelum'), 'a previous link appears');

          // No row may appear on both pages, or paging silently loses messages.
          const idsOn = (html: string) =>
            (html.match(new RegExp(`${marker} \\d+`, 'g')) ?? []);
          const overlap = idsOn(one).filter((m) => idsOn(two).includes(m));
          assert.deepEqual(overlap, [], 'pages must not repeat rows');
        });
      } finally {
        await pool!.query('delete from feedback where message like $1', [`${marker}%`]);
      }
    });

    test('feedback is escaped, never rendered as markup', async () => {
      const payload = '<script>alert(1)</script>';
      await pool!.query(
        `insert into feedback (user_id, kind, target, message) values ($1,'bug','/app',$2)`,
        [userId, payload]);

      try {
        await withAdminEmail('api@test.local', async () => {
          const body = await (await call('/admin?view=mesej')).text();
          assert.ok(!body.includes(payload), 'a feedback message must never land as live markup');
          assert.ok(body.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),
            'and it must still be readable, escaped');
        });
      } finally {
        await pool!.query('delete from feedback where user_id = $1 and message = $2',
          [userId, payload]);
      }
    });

    test('the backup dumps every table and records that it happened', async () => {
      await withAdminEmail('api@test.local', async () => {
        const before = await pool!.query('select count(*)::int as n from admin_backups');

        const res = await call('/admin/backup');
        assert.equal(res.status, 200);
        assert.match(res.headers.get('content-disposition') ?? '', /attachment; filename="senangkit-/);
        assert.equal(res.headers.get('cache-control'), 'no-store');

        const dump = await res.json();
        // Every table, not just the ones someone remembered to list.
        for (const table of ['users', 'sessions', 'tool_revisions', 'feedback', 'contracts']) {
          assert.ok(Array.isArray(dump.data[table]), `${table} is missing from the dump`);
        }
        assert.ok(dump.data.users.some((r: { email: string }) => r.email === 'api@test.local'),
          'the dump carries real rows, not empty arrays');
        assert.ok(dump.rowsTotal > 0);

        const after = await pool!.query('select count(*)::int as n from admin_backups');
        assert.equal(after.rows[0].n, before.rows[0].n + 1,
          'the download is logged, or the page can never report backup staleness');
      });
    });
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
