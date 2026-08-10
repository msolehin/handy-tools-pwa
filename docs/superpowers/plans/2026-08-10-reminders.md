# Reminders (Email + Web Push) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send SenangKit users a reminder 30, 7 and 1 days before each of their records expires, over email and web push, while the app is closed.

**Architecture:** A daily Railway cron hits an authed endpoint. That endpoint runs one `union all` query over the six existing typed date columns, groups the results into one digest per user, delivers over both enabled channels, and records each delivery in a dedup ledger so a retry never double-sends. No shared reminders store, no per-tool write path.

**Tech Stack:** Node ≥22.18 with native TS stripping (no build step), Hono, Postgres via `pg` with raw SQL, `node --test`, React 19, `vite-plugin-pwa` (generateSW), `web-push`.

**Spec:** `docs/superpowers/specs/2026-08-10-reminders-design.md`

## Global Constraints

- **No build step on the server.** Node strips types natively. Import with explicit `.ts` extensions, exactly as `server/app.ts` imports `./db.ts`.
- **Every new env var is optional and fails closed.** Four gate behaviour (`RESEND_API_KEY`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`); two are configuration with working defaults (`REMINDER_FROM`, `APP_ORIGIN`). With all six unset the app boots and behaves exactly as today. Follow the `ADMIN_EMAIL` precedent: `/admin` answers 404 for everyone when unset rather than opening up.
- **Raw SQL only.** No ORM. Forward-only numbered migrations in `server/migrations/`, run at boot by `migrate()` in `server/db.ts`.
- **One new dependency total: `web-push`.** Resend is a `fetch()` call. The cron is Railway's. Do not add a scheduler, a mailer, or a validation library.
- **Timezone is `Asia/Kuala_Lumpur`, hardcoded.** Never use bare `current_date` for the offset maths — Railway runs UTC.
- **Cadence is exactly 30, 7, 1 days before.** No day-of reminder. No overdue reminder.
- **One digest per user per channel**, never one message per record.
- **Copy is Malay**, matching the rest of the product, with English fallbacks only where a stored enum is English.
- **Tailwind semantic classes only** (`bg-surface`, `text-muted`, `text-text`, `border-text/5`). Never hardcoded slate/zinc — colours resolve from `--color-*` triples.
- **Tests are `node --test`**, run via `npm run test:server`. No framework, no fixtures beyond a seeded user. They skip when `DATABASE_URL` is unset, using the existing `{ skip: skip && 'DATABASE_URL not set' }` pattern.

## File Structure

| File | Responsibility |
|---|---|
| `server/migrations/008_reminders.sql` | Create: three tables — `notification_prefs`, `push_subscriptions`, `reminder_sends` |
| `server/reminders.ts` | Create: the due query, the dedup ledger, the two senders, the orchestrator, and the `/api` routes |
| `server/reminders.test.ts` | Create: query correctness, `next_done` exclusion, dedup on a second run |
| `server/app.ts` | Modify: mount the reminders routes on the existing `api` sub-app |
| `public/push-sw.js` | Create: `push` and `notificationclick` service worker handlers |
| `vite.config.ts` | Modify: `workbox.importScripts` to pull in `push-sw.js` |
| `src/components/NotificationSettings.tsx` | Create: the two toggles, self-contained including its own fetches |
| `src/components/Layout.tsx` | Modify: render `<NotificationSettings />` in the Settings sheet |
| `.env.example` | Modify: document the six new vars |

`server/reminders.ts` holds both the query and the senders deliberately. Splitting a ~250-line module into `reminders-query.ts` / `reminders-send.ts` would create two files that only ever change together, which is the opposite of the rule.

---

### Task 1: The due-reminders query

**Files:**
- Create: `server/migrations/008_reminders.sql`
- Create: `server/reminders.ts`
- Test: `server/reminders.test.ts`

**Interfaces:**
- Consumes: `hasDb`, `q`, `migrate`, `pool` from `./db.ts`
- Produces:
  - `type ReminderSource = 'document' | 'contract' | 'asset' | 'countdown' | 'vehicle_service' | 'home_service'`
  - `type DueReminder = { userId: string; source: ReminderSource; recordId: string; title: string; dueDate: string; offsetDays: number; href: string }`
  - `dueReminders(): Promise<DueReminder[]>`

- [ ] **Step 1: Write the migration**

Create `server/migrations/008_reminders.sql`:

```sql
-- Reminders that fire while the app is closed. Additive only: nothing existing changes, and
-- with the env vars unset none of this is ever read.

create table notification_prefs (
  user_id           uuid primary key references users(id) on delete cascade,
  email_enabled     boolean not null default true,
  push_enabled      boolean not null default false,
  unsubscribe_token text not null default gen_random_uuid()::text,
  updated_at        timestamptz not null default now()
);

-- One row per browser, not per user: the same account on a phone and a laptop is two rows.
create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);

create index push_subscriptions_user_id_idx on push_subscriptions (user_id);

-- Dedup ledger. Written only after a successful send, so a failed run retries tomorrow
-- instead of going permanently silent. No due_date in the key: every source is a one-off
-- date, so a record never fires the same offset twice.
create table reminder_sends (
  user_id     uuid not null references users(id) on delete cascade,
  source      text not null,
  record_id   text not null,
  offset_days int  not null,
  sent_at     timestamptz not null default now(),
  primary key (user_id, source, record_id, offset_days)
);
```

- [ ] **Step 2: Write the failing test**

Create `server/reminders.test.ts`:

```ts
// node --env-file=.env.local --test server/reminders.test.ts
//
// The dedup ledger is the only thing between a Railway cron retry and a user getting the
// same email three times, so it gets a test before anything is ever sent for real.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hasDb, migrate, pool } from './db.ts';
import { dueReminders } from './reminders.ts';

const skip = !hasDb;
let userId: string;

/** Today in MYT, as the server computes it. Fixtures are dated relative to this. */
const today = () => {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const plus = (days: number) => {
  const d = today();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

describe('reminders', { skip: skip && 'DATABASE_URL not set' }, () => {
  before(async () => {
    await migrate();
    const { rows } = await pool!.query(
      `insert into users (google_sub, email, name)
       values ('test-sub-reminders', 'reminders@test.local', 'Reminder Test')
       on conflict (google_sub) do update set email = excluded.email
       returning id`);
    userId = rows[0].id;

    // 30/7/1 must fire. 45 and 0 must not — 0 proves there is no day-of reminder.
    await pool!.query(
      `insert into documents (user_id, id, type, custom_title, expiry_date) values
         ($1, 'doc30', 'Roadtax',  '',            $2),
         ($1, 'doc07', 'Passport', '',            $3),
         ($1, 'doc01', 'Other',    'Sijil Kahwin', $4),
         ($1, 'doc45', 'Insurans', '',            $5),
         ($1, 'doc00', 'Lesen',    '',            $6)`,
      [userId, plus(30), plus(7), plus(1), plus(45), plus(0)]);

    // Two services on one car, both due in 7 days, one already ticked "dah buat". Proves
    // both that services fire per row rather than per asset, and that next_done closes one.
    await pool!.query(
      `insert into vehicle_assets (user_id, id, name, plate)
       values ($1, 'car1', 'Myvi', 'WXY 1234')`, [userId]);
    await pool!.query(
      `insert into vehicle_service_events
         (user_id, id, asset_id, date, title, next_service_date, next_done) values
         ($1, 'svcOil',  'car1', $2, 'Tukar minyak hitam', $3, false),
         ($1, 'svcAircond', 'car1', $2, 'Servis aircond',  $3, true)`,
      [userId, plus(-60), plus(7)]);
  });

  after(async () => {
    if (userId) await pool!.query('delete from users where id = $1', [userId]);
    await pool!.end();
  });

  test('returns only records at 30, 7 and 1 days out', async () => {
    const due = (await dueReminders()).filter((r) => r.userId === userId);
    assert.deepEqual(
      due.map((r) => r.recordId).sort(),
      ['doc01', 'doc07', 'doc30', 'svcOil'],
      '45 and 0 days out must not fire, and neither may a ticked service');
  });

  test('a service ticked "dah buat" does not fire', async () => {
    const due = (await dueReminders()).filter((r) => r.userId === userId);
    assert.ok(due.some((r) => r.recordId === 'svcOil'), 'the open service must still fire');
    assert.ok(!due.some((r) => r.recordId === 'svcAircond'),
      'next_done closes the reminder without inventing a service record');
  });

  test('uses custom_title when the document has one', async () => {
    const due = (await dueReminders()).filter((r) => r.userId === userId);
    assert.equal(due.find((r) => r.recordId === 'doc01')?.title, 'Sijil Kahwin');
    assert.equal(due.find((r) => r.recordId === 'doc30')?.title, 'Roadtax');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:server -- server/reminders.test.ts`
Expected: FAIL — `Cannot find module './reminders.ts'`.

If it reports `DATABASE_URL not set` and skips instead, stop and attach a local Postgres first. A skipped test proves nothing.

- [ ] **Step 4: Write the query**

Create `server/reminders.ts`:

```ts
// Reminders that fire while the app is closed — the gap spec.md §8 names.
//
// Every deadline in the app is already a real `date` column, so this is one union over six
// tables rather than a shared reminders store plus a write path in every tool page.
//
// `occasions` is deliberately absent: the Birthdays tool was removed, its table has no
// descriptor in tools.ts and no longer syncs. It was also the only recurring source, which
// is why nothing here does anniversary arithmetic.
import { q } from './db.ts';

export type ReminderSource =
  | 'document' | 'contract' | 'asset' | 'countdown' | 'vehicle_service' | 'home_service';

export type DueReminder = {
  userId: string;
  source: ReminderSource;
  recordId: string;
  title: string;
  dueDate: string;      // YYYY-MM-DD
  offsetDays: number;   // 30 | 7 | 1
  href: string;         // the tool route this record lives in
};

/** The only offsets that fire. No day-of, no overdue. */
export const OFFSETS = [30, 7, 1] as const;

// Railway runs UTC. Bare current_date would drift the boundary by 8 hours and fire a "1 day
// left" reminder on the wrong calendar day for the user.
const TODAY_MYT = `(now() at time zone 'Asia/Kuala_Lumpur')::date`;

const DUE_SQL = `
with t as (select ${TODAY_MYT} as today),
due as (
  select user_id, 'document' as source, id as record_id,
         coalesce(nullif(custom_title, ''), type) as title,
         expiry_date as due_date, '/document-expiry' as href
    from documents
  union all
  select user_id, 'contract', id, title, end_date, '/tenancy'
    from contracts
  union all
  select user_id, 'asset', id, name, expiry_date, '/asset-warranty'
    from assets
  union all
  select user_id, 'countdown', id, title, target_date, '/countdown'
    from countdown_events
  union all
  -- Every row, not the latest per asset: one car legitimately has an oil change, a tyre
  -- rotation and an aircond service open at once. next_done is the user's "dah buat" tick,
  -- which closes the reminder without inventing a service record (migration 006).
  select user_id, 'vehicle_service', id, coalesce(nullif(title, ''), 'Servis'),
         next_service_date, '/vehicle-services'
    from vehicle_service_events
   where next_service_date is not null and not next_done
  union all
  select user_id, 'home_service', id, coalesce(nullif(title, ''), 'Servis'),
         next_service_date, '/home-services'
    from home_service_events
   where next_service_date is not null and not next_done
)
select d.user_id, d.source, d.record_id, d.title,
       d.due_date::text as due_date, d.href,
       (d.due_date - t.today) as offset_days
  from due d
  cross join t
  left join reminder_sends s
    on  s.user_id     = d.user_id
    and s.source      = d.source
    and s.record_id   = d.record_id
    and s.offset_days = (d.due_date - t.today)
 where (d.due_date - t.today) = any($1::int[])
   and s.user_id is null
 order by d.user_id, d.due_date`;

/** Every reminder due today that has not already been delivered. */
export async function dueReminders(): Promise<DueReminder[]> {
  const { rows } = await q(DUE_SQL, [[...OFFSETS]]);
  return rows.map((r) => ({
    userId: r.user_id,
    source: r.source as ReminderSource,
    recordId: r.record_id,
    title: r.title,
    dueDate: r.due_date,
    offsetDays: r.offset_days,
    href: r.href,
  }));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:server -- server/reminders.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/008_reminders.sql server/reminders.ts server/reminders.test.ts
git commit -m "Find every reminder due today in one query over the existing date columns"
```

---

### Task 2: Dedup ledger and the orchestrator

**Files:**
- Modify: `server/reminders.ts`
- Modify: `server/reminders.test.ts`

**Interfaces:**
- Consumes: `dueReminders`, `DueReminder` from Task 1
- Produces:
  - `type Digest = { userId: string; email: string; unsubscribeToken: string; emailEnabled: boolean; pushEnabled: boolean; items: DueReminder[] }`
  - `type Deliver = (d: Digest) => Promise<boolean>`
  - `runReminders(deliver?: Deliver): Promise<{ users: number; reminders: number }>`

The `deliver` parameter is the test seam. It defaults to the real sender, added in Tasks 3 and 4.

- [ ] **Step 1: Write the failing test**

Append to `server/reminders.test.ts`, inside the `describe` block:

```ts
  test('a second run the same day delivers nothing', async () => {
    const seen: string[][] = [];
    const record = async (d: import('./reminders.ts').Digest) => {
      if (d.userId === userId) seen.push(d.items.map((i) => i.recordId).sort());
      return true;
    };

    await runReminders(record);
    await runReminders(record);

    assert.equal(seen.length, 1, 'the second run must find nothing left to send');
    assert.deepEqual(seen[0], ['doc01', 'doc07', 'doc30', 'svcOil'],
      'one digest carrying all four, not four separate deliveries');
  });

  test('a failed delivery is retried rather than swallowed', async () => {
    await pool!.query('delete from reminder_sends where user_id = $1', [userId]);

    let attempts = 0;
    const fail = async () => { attempts++; return false; };
    await runReminders(fail);
    await runReminders(fail);

    assert.equal(attempts, 2, 'nothing may be recorded as sent when delivery failed');
  });
```

Add `runReminders` to the import at the top of the file:

```ts
import { dueReminders, runReminders } from './reminders.ts';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:server -- server/reminders.test.ts`
Expected: FAIL — `runReminders is not a function`.

- [ ] **Step 3: Implement the ledger and orchestrator**

Append to `server/reminders.ts`:

```ts
export type Digest = {
  userId: string;
  email: string;
  unsubscribeToken: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  items: DueReminder[];
};

export type Deliver = (d: Digest) => Promise<boolean>;

/**
 * Read a user's preferences, creating the row if it does not exist yet.
 *
 * The upsert has to happen here rather than lazily on first toggle: a user who never opens
 * Settings would otherwise have no row, therefore no unsubscribe_token, and their email would
 * carry a dead unsubscribe link.
 */
async function ensurePrefs(userId: string) {
  const { rows } = await q(
    `insert into notification_prefs (user_id) values ($1)
     on conflict (user_id) do update set user_id = excluded.user_id
     returning email_enabled, push_enabled, unsubscribe_token`, [userId]);
  const { rows: [user] } = await q('select email from users where id = $1', [userId]);
  return { ...rows[0], email: user?.email as string | undefined };
}

/** Only ever called after a delivery actually succeeded. */
async function recordSends(userId: string, items: DueReminder[]) {
  await q(
    `insert into reminder_sends (user_id, source, record_id, offset_days)
     select $1, * from unnest($2::text[], $3::text[], $4::int[])
     on conflict do nothing`,
    [userId, items.map((i) => i.source), items.map((i) => i.recordId),
      items.map((i) => i.offsetDays)]);
}

/**
 * One pass: find what is due, group it into one digest per user, deliver, record.
 * Returns counts for the cron response so a silent zero is visible in the logs.
 */
export async function runReminders(deliver: Deliver = deliverDigest) {
  const due = await dueReminders();

  const byUser = new Map<string, DueReminder[]>();
  for (const r of due) {
    const list = byUser.get(r.userId);
    if (list) list.push(r);
    else byUser.set(r.userId, [r]);
  }

  let users = 0;
  for (const [userId, items] of byUser) {
    const prefs = await ensurePrefs(userId);
    if (!prefs.email) continue;
    if (!prefs.email_enabled && !prefs.push_enabled) continue;

    // One user's dead push endpoint or bounced address must not stop everyone behind them.
    let ok = false;
    try {
      ok = await deliver({
        userId,
        email: prefs.email,
        unsubscribeToken: prefs.unsubscribe_token,
        emailEnabled: prefs.email_enabled,
        pushEnabled: prefs.push_enabled,
        items,
      });
    } catch (err) {
      console.error('reminder delivery failed for', userId, err);
    }

    if (!ok) continue;
    await recordSends(userId, items);
    users++;
  }

  return { users, reminders: due.length };
}
```

- [ ] **Step 4: Add a temporary default so the module loads**

`runReminders` references `deliverDigest`, which Tasks 3 and 4 build. Add this placeholder to `server/reminders.ts` now, directly above `runReminders`, and replace it in Task 4:

```ts
// Replaced in Task 4 once both channels exist.
const deliverDigest: Deliver = async () => false;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:server -- server/reminders.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add server/reminders.ts server/reminders.test.ts
git commit -m "Group reminders into one digest per user, recorded only once delivered"
```

---

### Task 3: Email delivery and unsubscribe

**Files:**
- Modify: `server/reminders.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `Digest`, `DueReminder` from Task 2
- Produces:
  - `sendEmail(d: Digest): Promise<boolean>`
  - `reminders` — a `Hono` sub-app exporting `GET /unsubscribe`

- [ ] **Step 1: Add the env vars**

In `.env.example`, append below the `ADMIN_EMAIL` block:

```
# Reminder delivery. All optional and independent — unset means that channel is silently off,
# the same way ADMIN_EMAIL unset closes /admin. With all of these unset the app is unchanged.

# Resend API key. Unset and no reminder email is ever attempted.
RESEND_API_KEY=
# From address, must be on a domain verified in Resend.
REMINDER_FROM=SenangKit <reminder@senangkit.app>
# Absolute base for links inside emails and push payloads. A relative link is useless in a
# mail client, so this cannot be inferred from the request — the cron has no request.
APP_ORIGIN=https://senangkit.app
# Shared secret for the Railway cron. Unset and /api/cron/reminders answers 404 for everyone.
CRON_SECRET=
# Web Push VAPID pair — generate with: npx web-push generate-vapid-keys
# Not VITE_-prefixed on purpose: the client fetches the public key from /api/push/key, so
# rotating it does not need a rebuild.
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

- [ ] **Step 2: Implement the email sender**

Append to `server/reminders.ts`:

```ts
import { Hono } from 'hono';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const REMINDER_FROM = process.env.REMINDER_FROM ?? 'SenangKit <reminder@senangkit.app>';
const APP_ORIGIN = process.env.APP_ORIGIN ?? 'https://senangkit.app';

/** User-controlled titles land in an HTML document. This is a security boundary. */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const line = (r: DueReminder) =>
  r.offsetDays === 1 ? 'Esok' : `${r.offsetDays} hari lagi`;

/** One digest, never one email per record — eight warranties is one mail, not eight. */
function emailHtml(d: Digest) {
  const rows = d.items.map((r) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e2e8f0">
        <a href="${APP_ORIGIN}${r.href}" style="color:#0f172a;font-weight:600;text-decoration:none">${esc(r.title)}</a>
        <div style="color:#64748b;font-size:13px;margin-top:2px">${esc(r.dueDate)}</div>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;color:#b45309;font-weight:600">
        ${line(r)}
      </td>
    </tr>`).join('');

  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px">
      <h1 style="font-size:20px;color:#0f172a;margin:0 0 4px">Ada yang nak tamat tempoh</h1>
      <p style="color:#64748b;font-size:14px;margin:0 0 24px">Ini rekod dalam SenangKit yang perlu perhatian anda.</p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <p style="margin:32px 0 0;font-size:12px;color:#94a3b8">
        <a href="${APP_ORIGIN}/app" style="color:#64748b">Buka SenangKit</a> &middot;
        <a href="${APP_ORIGIN}/api/unsubscribe?t=${encodeURIComponent(d.unsubscribeToken)}" style="color:#94a3b8">Berhenti terima emel ini</a>
      </p>
    </div>
  </body></html>`;
}

export async function sendEmail(d: Digest): Promise<boolean> {
  if (!RESEND_API_KEY) return false;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: REMINDER_FROM,
      to: d.email,
      subject: d.items.length === 1
        ? `${d.items[0].title} — ${line(d.items[0]).toLowerCase()}`
        : `${d.items.length} rekod nak tamat tempoh`,
      html: emailHtml(d),
    }),
  });

  if (!res.ok) {
    console.error('resend failed', res.status, await res.text().catch(() => ''));
    return false;
  }
  return true;
}

export const reminders = new Hono();

// No session required: the token IS the authorisation. That is what makes the link work from
// a mail client that has never seen the app's cookie.
reminders.get('/unsubscribe', async (c) => {
  const token = c.req.query('t');
  if (!token) return c.text('pautan tidak sah', 400);

  const { rowCount } = await q(
    'update notification_prefs set email_enabled = false, updated_at = now() where unsubscribe_token = $1',
    [token]);

  if (!rowCount) return c.text('pautan tidak sah', 400);
  return c.html(`<!doctype html><meta charset="utf-8"><title>Berhenti langgan</title>
    <div style="font-family:system-ui;max-width:420px;margin:80px auto;padding:0 24px;text-align:center">
      <h1 style="font-size:20px">Sudah berhenti</h1>
      <p style="color:#64748b">Anda tidak akan terima emel peringatan lagi. Boleh hidupkan semula bila-bila dalam Settings.</p>
      <a href="${APP_ORIGIN}/app" style="color:#0f172a">Buka SenangKit</a>
    </div>`);
});
```

- [ ] **Step 3: Verify the module still loads and tests pass**

Run: `npm run test:server -- server/reminders.test.ts`
Expected: PASS, 5 tests. No email is sent — the tests inject their own `deliver`.

- [ ] **Step 4: Verify the escaping**

Run this one-off check that a document title containing HTML cannot break out:

```bash
node --input-type=module -e "
const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');
const out = esc('<img src=x onerror=alert(1)>');
if (out.includes('<')) { console.error('FAIL', out); process.exit(1); }
console.log('ok', out);
"
```

Expected: `ok &lt;img src=x onerror=alert(1)&gt;`

- [ ] **Step 5: Commit**

```bash
git add server/reminders.ts .env.example
git commit -m "Send the reminder digest by email, with a working unsubscribe link"
```

---

### Task 4: Push delivery and the subscription routes

**Files:**
- Modify: `server/reminders.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `Digest`, `sendEmail`, `reminders` from Task 3
- Produces:
  - `sendPush(d: Digest): Promise<boolean>`
  - `deliverDigest: Deliver` — replaces the Task 2 placeholder
  - Routes on `reminders`: `GET /push/key`, `POST /push/subscribe`, `DELETE /push/subscribe`, `GET /notification-prefs`, `PUT /notification-prefs`

- [ ] **Step 1: Install the dependency**

```bash
npm install web-push
```

This is the plan's only new dependency. Web Push requires ECDH key agreement and per-subscription AES-GCM payload encryption; hand-rolling that ships a bug that fails silently on one browser. Security boundary, so the library wins over the smaller diff.

- [ ] **Step 2: Implement push and replace the placeholder**

In `server/reminders.ts`, **delete** the Task 2 placeholder line:

```ts
// Replaced in Task 4 once both channels exist.
const deliverDigest: Deliver = async () => false;
```

Add the import at the top of the file, beside the others:

```ts
import webpush from 'web-push';
import { requireUser } from './auth.ts';
```

Then append:

```ts
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const pushConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (pushConfigured) {
  webpush.setVapidDetails(`mailto:reminder@senangkit.app`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function sendPush(d: Digest): Promise<boolean> {
  if (!pushConfigured) return false;

  const { rows } = await q(
    'select id, endpoint, p256dh, auth from push_subscriptions where user_id = $1', [d.userId]);
  if (!rows.length) return false;

  const first = d.items[0];
  const payload = JSON.stringify({
    title: d.items.length === 1 ? first.title : `${d.items.length} rekod nak tamat tempoh`,
    body: d.items.length === 1
      ? `${line(first)} — ${first.dueDate}`
      : d.items.slice(0, 3).map((r) => `${r.title} (${line(r)})`).join('\n'),
    href: d.items.length === 1 ? first.href : '/app',
  });

  let delivered = 0;
  for (const sub of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      await q('update push_subscriptions set last_ok_at = now() where id = $1', [sub.id]);
      delivered++;
    } catch (err) {
      // 404/410 means the browser threw the subscription away. Anything else is transient,
      // so the row stays and tomorrow's run tries again.
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await q('delete from push_subscriptions where id = $1', [sub.id]);
      } else {
        console.error('push failed', status, err);
      }
    }
  }
  return delivered > 0;
}

/**
 * Both channels fire when both are on — two independent switches, no precedence.
 * Succeeds if either channel landed, so a dead push endpoint does not suppress the email.
 */
const deliverDigest: Deliver = async (d) => {
  const results = await Promise.all([
    d.emailEnabled ? sendEmail(d) : Promise.resolve(false),
    d.pushEnabled ? sendPush(d) : Promise.resolve(false),
  ]);
  return results.some(Boolean);
};

reminders.get('/push/key', (c) => c.json({ key: VAPID_PUBLIC_KEY || null }));

reminders.post('/push/subscribe', requireUser, async (c) => {
  const body = await c.req.json().catch(() => null) as
    { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return c.json({ error: 'invalid subscription' }, 400);

  // Endpoint is unique: re-subscribing on the same browser updates rather than duplicating.
  await q(
    `insert into push_subscriptions (user_id, endpoint, p256dh, auth)
     values ($1, $2, $3, $4)
     on conflict (endpoint) do update
       set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [c.get('userId'), endpoint, p256dh, auth]);

  await q(
    `insert into notification_prefs (user_id, push_enabled) values ($1, true)
     on conflict (user_id) do update set push_enabled = true, updated_at = now()`,
    [c.get('userId')]);

  return c.json({ ok: true });
});

reminders.delete('/push/subscribe', requireUser, async (c) => {
  await q('delete from push_subscriptions where user_id = $1', [c.get('userId')]);
  await q(
    `insert into notification_prefs (user_id, push_enabled) values ($1, false)
     on conflict (user_id) do update set push_enabled = false, updated_at = now()`,
    [c.get('userId')]);
  return c.json({ ok: true });
});

reminders.get('/notification-prefs', requireUser, async (c) => {
  const { rows } = await q(
    `insert into notification_prefs (user_id) values ($1)
     on conflict (user_id) do update set user_id = excluded.user_id
     returning email_enabled, push_enabled`, [c.get('userId')]);
  return c.json({
    emailEnabled: rows[0].email_enabled,
    pushEnabled: rows[0].push_enabled,
    pushConfigured,
  });
});

reminders.put('/notification-prefs', requireUser, async (c) => {
  const body = await c.req.json().catch(() => null) as { emailEnabled?: boolean } | null;
  if (typeof body?.emailEnabled !== 'boolean') return c.json({ error: 'invalid' }, 400);

  await q(
    `insert into notification_prefs (user_id, email_enabled) values ($1, $2)
     on conflict (user_id) do update set email_enabled = excluded.email_enabled, updated_at = now()`,
    [c.get('userId'), body.emailEnabled]);
  return c.json({ ok: true });
});
```

Note the `Vars` type: `reminders` must be declared as `new Hono<{ Variables: { userId: string } }>()` for `c.get('userId')` to typecheck. Update the Task 3 declaration:

```ts
export const reminders = new Hono<{ Variables: { userId: string } }>();
```

- [ ] **Step 3: Run the tests**

Run: `npm run test:server -- server/reminders.test.ts`
Expected: PASS, 5 tests. `deliverDigest` is never reached — the tests inject their own.

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server/reminders.ts package.json package-lock.json
git commit -m "Deliver the digest over web push too, dropping subscriptions the browser discarded"
```

---

### Task 5: Mount the routes and the cron endpoint

**Files:**
- Modify: `server/reminders.ts`
- Modify: `server/app.ts:184`

**Interfaces:**
- Consumes: `reminders`, `runReminders` from Tasks 2–4
- Produces: `POST /api/cron/reminders`, and every Task 3–4 route live under `/api`

- [ ] **Step 1: Add the cron route**

Append to `server/reminders.ts`:

```ts
const CRON_SECRET = process.env.CRON_SECRET ?? '';

/**
 * Driven by Railway cron, not an in-process timer: a setInterval dies on every redeploy and
 * fires twice if the service ever runs two instances.
 *
 * Fails closed — with CRON_SECRET unset this answers 404 for everyone, the way /admin does.
 */
reminders.post('/cron/reminders', async (c) => {
  if (!CRON_SECRET) return c.notFound();
  if (c.req.header('authorization') !== `Bearer ${CRON_SECRET}`) return c.notFound();

  const result = await runReminders();
  console.log('reminders run', result);
  return c.json(result);
});
```

- [ ] **Step 2: Mount it**

In `server/app.ts`, add to the import block near the top:

```ts
import { reminders } from './reminders.ts';
```

Then mount it on the existing `api` sub-app, immediately before the existing `app.route('/api', api);` at line 184:

```ts
api.route('/', reminders);
```

Mounting on `api` rather than on `app` is deliberate: it inherits the `sameOriginOnly` middleware already applied at `api.use('*', sameOriginOnly)`.

- [ ] **Step 3: Verify the cron route fails closed**

Run the server with no `CRON_SECRET`:

```bash
CRON_SECRET= node --env-file-if-exists=.env.local server/index.ts &
sleep 2
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/cron/reminders
kill %1
```

Expected: `404`.

- [ ] **Step 4: Verify it accepts the secret**

```bash
CRON_SECRET=testsecret node --env-file-if-exists=.env.local server/index.ts &
sleep 2
curl -s -X POST http://localhost:3000/api/cron/reminders -H 'authorization: Bearer testsecret'
echo
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/cron/reminders -H 'authorization: Bearer wrong'
kill %1
```

Expected: a JSON body like `{"users":0,"reminders":0}`, then `404` for the wrong secret.

- [ ] **Step 5: Run the full server suite**

Run: `npm run test:server`
Expected: all existing tests still pass, plus the 4 new ones.

- [ ] **Step 6: Commit**

```bash
git add server/reminders.ts server/app.ts
git commit -m "Run the reminder pass from an authed cron route that fails closed"
```

---

### Task 6: Service worker push handler

**Files:**
- Create: `public/push-sw.js`
- Modify: `vite.config.ts:22-30`

**Interfaces:**
- Consumes: the push payload shape from Task 4 — `{ title: string; body: string; href: string }`
- Produces: nothing importable; this runs in the service worker scope

- [ ] **Step 1: Write the handler**

Create `public/push-sw.js`:

```js
// Pulled into the generated service worker via workbox.importScripts in vite.config.ts.
//
// A separate file rather than converting the setup to injectManifest: generateSW already
// handles precaching and the navigateFallbackDenylist for /api and /admin, and rebuilding
// that by hand to add twenty lines would risk both.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // A malformed payload must not kill the handler — show something rather than nothing.
  }

  const title = data.title || 'SenangKit';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'senangkit-reminder',
      data: { href: data.href || '/app' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || '/app';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Focus an open tab rather than stacking a second copy of the app.
      for (const client of list) {
        if (client.url.includes(href) && 'focus' in client) return client.focus();
      }
      if (list.length && 'focus' in list[0]) {
        return list[0].focus().then(() => list[0].navigate(href));
      }
      return self.clients.openWindow(href);
    })
  );
});
```

- [ ] **Step 2: Wire it into the generated service worker**

In `vite.config.ts`, inside the existing `workbox` block (currently lines 22–30), add `importScripts` alongside the existing keys:

```ts
      workbox: {
        // Without this the SW answers /api/* navigations out of the precache with index.html,
        // and the client parses HTML as JSON. Only bites once the API is same-origin.
        // /admin is server-rendered and has no client route, so the same fallback would hand it
        // index.html, React would match nothing, and the `*` catch-all would bounce you to `/` —
        // working in a fresh browser and silently failing in the installed PWA.
        navigateFallbackDenylist: [/^\/api\//, /^\/admin/],
        cleanupOutdatedCaches: true,
        // Push and notificationclick handlers. Kept out of this config so generateSW keeps
        // owning precaching and the denylist above.
        importScripts: ['/push-sw.js']
      },
```

- [ ] **Step 3: Build and verify the import landed**

```bash
npm run build
grep -n "push-sw" dist/sw.js
```

Expected: at least one match showing `importScripts` referencing `/push-sw.js`, and `dist/push-sw.js` exists.

```bash
ls -la dist/push-sw.js
```

Expected: the file is present.

- [ ] **Step 4: Commit**

```bash
git add public/push-sw.js vite.config.ts
git commit -m "Show reminder notifications from the service worker, focusing an open tab"
```

---

### Task 7: The Settings toggles

**Files:**
- Create: `src/components/NotificationSettings.tsx`
- Modify: `src/components/Layout.tsx:651` (inside the Settings sheet, after `<FeedbackForm />`)

**Interfaces:**
- Consumes: `GET/PUT /api/notification-prefs`, `GET /api/push/key`, `POST/DELETE /api/push/subscribe` from Tasks 3–4; `getUser`, `subscribe` from `src/lib/auth.ts`
- Produces: `<NotificationSettings />`, default export absent — named export, matching `AccountPanel`

- [ ] **Step 1: Write the component**

Create `src/components/NotificationSettings.tsx`:

```tsx
// Two switches, signed-in only. Self-contained including its own fetches — it is rendered in
// exactly one place and nothing else needs its state.
import { useEffect, useState } from 'react';
import { Bell, Mail } from 'lucide-react';
import { getUser, subscribe, type User } from '../lib/auth';

const urlBase64ToUint8Array = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4))
    .replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

/** iOS only allows Web Push once the PWA is installed to the home screen. */
const iosNeedsInstall = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !window.matchMedia('(display-mode: standalone)').matches;

export function NotificationSettings() {
  const [user, setUser] = useState<User | null>(getUser());
  const [email, setEmail] = useState(true);
  const [push, setPush] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => subscribe(setUser), []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/notification-prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!p) return;
        setEmail(p.emailEnabled);
        setPush(p.pushEnabled);
        setConfigured(p.pushConfigured);
      })
      .catch(() => { /* offline: the toggles just show their defaults */ });
  }, [user]);

  if (!user) return null;

  const toggleEmail = async (next: boolean) => {
    setEmail(next);
    await fetch('/api/notification-prefs', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ emailEnabled: next }),
    }).catch(() => setEmail(!next));
  };

  const togglePush = async (next: boolean) => {
    setNote('');
    if (!next) {
      setPush(false);
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
      await fetch('/api/push/subscribe', { method: 'DELETE' }).catch(() => {});
      return;
    }

    if (iosNeedsInstall()) {
      setNote('Pasang SenangKit ke skrin utama dulu, baru boleh terima notifikasi.');
      return;
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setNote('Pelayar ini tak sokong notifikasi.');
      return;
    }

    setBusy(true);
    try {
      if (await Notification.requestPermission() !== 'granted') {
        setNote('Notifikasi disekat. Benarkan dalam tetapan pelayar.');
        return;
      }

      const { key } = await fetch('/api/push/key').then((r) => r.json());
      if (!key) { setNote('Notifikasi belum disediakan di server.'); return; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) { setNote('Gagal daftar notifikasi. Cuba lagi.'); return; }
      setPush(true);
    } catch {
      setNote('Gagal daftar notifikasi. Cuba lagi.');
    } finally {
      setBusy(false);
    }
  };

  const Row = ({ icon: Icon, title, desc, on, onChange, disabled }: {
    icon: typeof Bell; title: string; desc: string;
    on: boolean; onChange: (v: boolean) => void; disabled?: boolean;
  }) => (
    <button
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className="w-full flex items-center justify-between p-3 rounded-2xl bg-surface border border-text/5 disabled:opacity-50"
    >
      <div className="flex items-center gap-3 text-left">
        <div className="p-2 rounded-xl shrink-0 bg-amber-500/20 text-amber-400">
          <Icon size={20} />
        </div>
        <div>
          <p className="font-medium text-text">{title}</p>
          <p className="text-xs text-muted mt-0.5">{desc}</p>
        </div>
      </div>
      <div className={`w-11 h-6 rounded-full shrink-0 flex items-center px-0.5 transition-colors ${on ? 'bg-primary' : 'bg-text/15'}`}>
        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
      </div>
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="pt-5 pb-1 px-1">
        <h4 className="text-sm font-bold text-text">Peringatan</h4>
        <p className="text-xs text-muted mt-0.5">30, 7 dan 1 hari sebelum sesuatu tamat tempoh.</p>
      </div>

      <Row icon={Mail} title="Emel" desc={user.email} on={email} onChange={toggleEmail} />
      <Row
        icon={Bell}
        title="Notifikasi"
        desc={configured ? 'Terus ke telefon anda' : 'Belum disediakan'}
        on={push}
        onChange={togglePush}
        disabled={busy || !configured}
      />

      {note && <p className="text-xs text-amber-400 px-1">{note}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Render it**

In `src/components/Layout.tsx`, add the import beside the existing component imports:

```tsx
import { NotificationSettings } from './NotificationSettings';
```

Then inside the Settings sheet's scroll container, directly after `<FeedbackForm />`:

```tsx
                  <AccountPanel />
                  <FeedbackForm />
                  <NotificationSettings />
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 4: Verify by hand**

```bash
npm run dev
```

Open the app, tap Settings. Expected:
- Signed out: no Peringatan section at all.
- Signed in with VAPID keys unset: the section shows, Emel is on, Notifikasi reads "Belum disediakan" and is disabled.
- Signed in with VAPID keys set: tapping Notifikasi raises the browser permission prompt.

- [ ] **Step 5: Commit**

```bash
git add src/components/NotificationSettings.tsx src/components/Layout.tsx
git commit -m "Put the two reminder switches in Settings, signed-in only"
```

---

## Deployment

Not a code task, but the feature is inert until this is done:

1. Generate the VAPID pair: `npx web-push generate-vapid-keys`
2. Set on Railway: `RESEND_API_KEY`, `REMINDER_FROM`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `APP_ORIGIN`
3. Verify the sending domain in Resend
4. Add the Railway cron job: `0 0 * * *` (UTC) → 08:00 MYT, calling
   `curl -fsS -X POST "$APP_ORIGIN/api/cron/reminders" -H "authorization: Bearer $CRON_SECRET"`

## Out of Scope

Per the spec, deliberately not built: monthly money reminders (`commitments`, `ious`), daily habit and water nudges, per-tool mute granularity, quiet hours, an overdue ping, per-user timezones, and the shared reminders store from `spec.md` §8.
