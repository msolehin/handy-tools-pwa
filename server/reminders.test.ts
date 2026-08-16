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

    // Garaj: one vehicle, its odometer at 89,800 km (garage_vehicles.mileage is the floor, and
    // there are no energy/service/odo-log rows here, so it is also the derived current reading).
    await pool!.query(
      `insert into garage_vehicles (user_id, id, model, mileage) values
         ($1, 'car1', 'Myvi', 89800)`, [userId]);

    // A reminder due by date in 7 days, and one already ticked done (must not fire). Proves
    // garage_reminders fires per row and that `done` closes one, same shape as the old
    // next_done flag but without any dedup — this is not a log, it is an explicit row the
    // owner closes themself.
    await pool!.query(
      `insert into garage_reminders (user_id, id, vehicle_id, label, due_date, done) values
         ($1, 'remOil',     'car1', 'Tukar minyak hitam', $2, false),
         ($1, 'remAircond', 'car1', 'Servis aircond',     $2, true)`,
      [userId, plus(7)]);

    // A reminder due by odometer, 200 km short of a 90,000 km target — inside the 500 km
    // KM_SOON window — and one already ticked done (must not fire).
    await pool!.query(
      `insert into garage_reminders (user_id, id, vehicle_id, label, due_odo, done) values
         ($1, 'remKm',     'car1', 'Servis ikut km',     90000, false),
         ($1, 'remKmDone', 'car1', 'Servis km dah buat', 90000, true)`,
      [userId]);

    // A vehicle document (road tax) expiring in 30 days.
    await pool!.query(
      `insert into garage_documents (user_id, id, vehicle_id, type, expiry) values
         ($1, 'gdoc30', 'car1', 'roadtax', $2)`,
      [userId, plus(30)]);
  });

  after(async () => {
    if (userId) await pool!.query('delete from users where id = $1', [userId]);
    await pool!.end();
  });

  test('returns only records at 30, 7 and 1 days out', async () => {
    const due = (await dueReminders()).filter((r) => r.userId === userId);
    assert.deepEqual(
      due.map((r) => r.recordId).sort(),
      ['doc01', 'doc07', 'doc30', 'gdoc30', 'remKm', 'remOil'],
      '45 and 0 days out must not fire, and neither may a done reminder');
  });

  test('a garage reminder marked done does not fire', async () => {
    const due = (await dueReminders()).filter((r) => r.userId === userId);
    assert.ok(due.some((r) => r.recordId === 'remOil'), 'the open reminder must still fire');
    assert.ok(!due.some((r) => r.recordId === 'remAircond'),
      'done closes the reminder, the same as it does in the app');
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
    assert.deepEqual(seen[0], ['doc01', 'doc07', 'doc30', 'gdoc30', 'remKm', 'remOil'],
      'one digest carrying all six, not six separate deliveries');
  });

  test('the digest is ordered most urgent first', async () => {
    await pool!.query('delete from reminder_sends where user_id = $1', [userId]);

    let seen = [];
    await runReminders(async (d) => {
      if (d.userId === userId) seen = d.items.map((i) => i.offsetDays);
      return true;
    });

    assert.deepEqual(seen, [1, 7, 7, 7, 30, 30],
      'esok must never sit below a 30-day row — push only shows the first three');
  });

  test('a mileage reminder reads as distance, not as a day count', async () => {
    await pool!.query('delete from reminder_sends where user_id = $1', [userId]);
    const km = (await dueReminders()).find((r) => r.recordId === 'remKm');

    assert.equal(km?.source, 'garage_mileage');
    assert.equal(km?.pill, 'lagi 200 km', 'the pill must never claim "N hari lagi" for a distance');
    assert.equal(km?.subtitle, 'Myvi · 89,800 km');
    assert.equal(km?.dueDate, '', 'there is no date to invent');
  });

  test('a mileage reminder fires once per band, then again once it is overdue', async () => {
    await pool!.query('delete from reminder_sends where user_id = $1', [userId]);

    const sent = async () => {
      let ids: string[] = [];
      await runReminders(async (d) => {
        if (d.userId === userId) ids = d.items.map((i) => i.recordId);
        return true;
      });
      return ids;
    };

    assert.ok((await sent()).includes('remKm'), 'first run: inside the 500 km window');
    assert.ok(!(await sent()).includes('remKm'), 'second run: same band, already delivered');

    // Drive past the target. That is a new band, so it is a new reminder rather than a repeat.
    await pool!.query(
      `update garage_vehicles set mileage = 90300 where user_id = $1 and id = 'car1'`, [userId]);
    const overdue = (await dueReminders()).find((r) => r.recordId === 'remKm');
    assert.equal(overdue?.pill, 'lepas 300 km');
    assert.ok((await sent()).includes('remKm'), 'crossing the target fires once more');
    assert.ok(!(await sent()).includes('remKm'), 'but only once');

    await pool!.query(
      `update garage_vehicles set mileage = 89800 where user_id = $1 and id = 'car1'`, [userId]);
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
