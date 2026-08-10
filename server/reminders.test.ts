// node --env-file=.env.local --test server/reminders.test.ts
//
// The dedup ledger is the only thing between a Railway cron retry and a user getting the
// same email three times, so it gets a test before anything is ever sent for real.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hasDb, migrate, pool } from './db.ts';
import { dueReminders, runReminders, type Digest } from './reminders.ts';

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

  test('a second run the same day delivers nothing', async () => {
    const seen: string[][] = [];
    const record = async (d: Digest) => {
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
    const fail = async (d: Digest) => { if (d.userId === userId) attempts++; return false; };
    await runReminders(fail);
    await runReminders(fail);

    assert.equal(attempts, 2, 'nothing may be recorded as sent when delivery failed');
  });
});
