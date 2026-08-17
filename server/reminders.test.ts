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

    // A vehicle document (road tax, with a note) expiring in 30 days.
    await pool!.query(
      `insert into garage_documents (user_id, id, vehicle_id, type, expiry, note) values
         ($1, 'gdoc30', 'car1', 'roadtax', $2, 'JPJ Online')`,
      [userId, plus(30)]);

    // A sold vehicle carrying one of every kind of Garaj reminder. None of them may ever fire:
    // without the archive filters a car sold last year keeps emailing about its road tax, and
    // the garage_document arm in particular never joined garage_vehicles at all.
    await pool!.query(
      `insert into garage_vehicles (user_id, id, model, mileage, archived, archived_at) values
         ($1, 'sold1', 'Saga', 120000, true, $2)`, [userId, plus(-30)]);
    await pool!.query(
      `insert into garage_reminders (user_id, id, vehicle_id, label, due_date, done) values
         ($1, 'soldDate', 'sold1', 'Cukai jalan', $2, false)`, [userId, plus(7)]);
    await pool!.query(
      // 100 km short of its target, well inside the 500 km KM_SOON window.
      `insert into garage_reminders (user_id, id, vehicle_id, label, due_odo, done) values
         ($1, 'soldKm', 'sold1', 'Servis ikut km', 120100, false)`, [userId]);
    await pool!.query(
      `insert into garage_documents (user_id, id, vehicle_id, type, expiry) values
         ($1, 'soldDoc', 'sold1', 'roadtax', $2)`, [userId, plus(30)]);
  });

  after(async () => {
    if (userId) await pool!.query('delete from users where id = $1', [userId]);
    await pool!.end();
  });

  test('returns only records at 30, 7 and 1 days out', async () => {
    const due = (await dueReminders()).filter((r) => r.userId === userId);
    assert.deepEqual(
      due.map((r) => r.recordId).sort(),
      // remOil and remKm carry their due value in record_id (Item 1 fix) — see reminders.ts.
      ['doc01', 'doc07', 'doc30', 'gdoc30', 'remKm:90000', `remOil:${plus(7)}`].sort(),
      '45 and 0 days out must not fire, and neither may a done reminder');
  });

  test('an archived vehicle stops emailing entirely, on all three arms', async () => {
    const ids = (await dueReminders()).filter((r) => r.userId === userId).map((r) => r.recordId);
    assert.ok(!ids.some((id) => id.startsWith('soldDate')), 'no dated reminder for a sold car');
    assert.ok(!ids.some((id) => id.startsWith('soldKm')), 'no mileage reminder either');
    assert.ok(!ids.includes('soldDoc'),
      'and no document — the arm that did not join garage_vehicles at all before this');
  });

  test('a garage reminder marked done does not fire', async () => {
    const due = (await dueReminders()).filter((r) => r.userId === userId);
    assert.ok(due.some((r) => r.recordId === `remOil:${plus(7)}`), 'the open reminder must still fire');
    assert.ok(!due.some((r) => r.recordId.startsWith('remAircond')),
      'done closes the reminder, the same as it does in the app');
  });

  test('a reminder that rolled forward to a new due date fires again (Item 1)', async () => {
    // rollForward (src/lib/garage.ts) advances a repeating reminder's dueDate in place on the
    // SAME row rather than creating a new one. Before the fix, record_id was bare `id`, so a
    // send recorded for the row's PREVIOUS due date would suppress it forever after — the row
    // never gets a new id to escape that history. Simulate exactly that: a send already on file
    // for an earlier due date than the one the fixture is actually due at.
    await pool!.query('delete from reminder_sends where user_id = $1', [userId]);
    const previousDue = plus(7 - 183); // roughly one 6-month interval before today's due_date
    await pool!.query(
      `insert into reminder_sends (user_id, source, record_id, offset_days) values
         ($1, 'garage_reminder', $2, 7)`,
      [userId, `remOil:${previousDue}`]);

    const due = (await dueReminders()).filter((r) => r.userId === userId);
    assert.ok(due.some((r) => r.recordId === `remOil:${plus(7)}`),
      'a send recorded against the OLD due date must not suppress the row at its NEW due date');
  });

  test('uses custom_title when the document has one', async () => {
    const due = (await dueReminders()).filter((r) => r.userId === userId);
    assert.equal(due.find((r) => r.recordId === 'doc01')?.title, 'Sijil Kahwin');
    assert.equal(due.find((r) => r.recordId === 'doc30')?.title, 'Roadtax');
  });

  test("a garage document label matches the client's own formatting", async () => {
    const due = (await dueReminders()).filter((r) => r.userId === userId);
    // DOC_LABELS in src/lib/garage.ts renders "Road tax", not "Road Tax" — initcap(type) would
    // get the case wrong, and the note is what would disambiguate a bare "Other".
    assert.equal(due.find((r) => r.recordId === 'gdoc30')?.title, 'Road tax · JPJ Online');
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
    assert.deepEqual(seen[0], ['doc01', 'doc07', 'doc30', 'gdoc30', 'remKm:90000', `remOil:${plus(7)}`].sort(),
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
    const km = (await dueReminders()).find((r) => r.recordId === 'remKm:90000');

    assert.equal(km?.source, 'garage_mileage');
    assert.equal(km?.pill, 'lagi 200 km', 'the pill must never claim "N hari lagi" for a distance');
    assert.equal(km?.subtitle, 'Myvi · 89,800 km');
    assert.equal(km?.dueDate, '', 'there is no date to invent');
  });

  test('the odometer reading comes from the log tables, not just the mileage floor', async () => {
    await pool!.query('delete from reminder_sends where user_id = $1', [userId]);

    // garage_vehicles.mileage stays at its 89,800 floor here; a newer garage_odo_logs entry is
    // the real current reading. This is the only fixture that sets a reading anywhere but the
    // floor, so it is what would catch any of the three log subqueries getting dropped from the
    // greatest(...) in MILEAGE_SQL.
    await pool!.query(
      `insert into garage_odo_logs (user_id, id, vehicle_id, date, odo) values
         ($1, 'odoNewer', 'car1', $2, 90100)`, [userId, plus(-1)]);

    const due = (await dueReminders()).find((r) => r.recordId === 'remKm:90000');
    assert.equal(due?.subtitle, 'Myvi · 90,100 km',
      'current_odo must be the greatest log reading, not the stale floor');

    await pool!.query(
      `delete from garage_odo_logs where user_id = $1 and id = 'odoNewer'`, [userId]);
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

    assert.ok((await sent()).includes('remKm:90000'), 'first run: inside the 500 km window');
    assert.ok(!(await sent()).includes('remKm:90000'), 'second run: same band, already delivered');

    // Drive past the target. That is a new band, so it is a new reminder rather than a repeat.
    await pool!.query(
      `update garage_vehicles set mileage = 90300 where user_id = $1 and id = 'car1'`, [userId]);
    const overdue = (await dueReminders()).find((r) => r.recordId === 'remKm:90000');
    assert.equal(overdue?.pill, 'lepas 300 km');
    assert.ok((await sent()).includes('remKm:90000'), 'crossing the target fires once more');
    assert.ok(!(await sent()).includes('remKm:90000'), 'but only once');

    await pool!.query(
      `update garage_vehicles set mileage = 89800 where user_id = $1 and id = 'car1'`, [userId]);
  });

  test('a mileage reminder is deduped per user, not by source/record/band alone', async () => {
    await pool!.query('delete from reminder_sends where user_id = $1', [userId]);

    // A second user with a send row carrying the exact source/record_id/offset_days as this
    // user's own 'remKm' reminder. reminder_sends has no FK to garage_reminders, so nothing
    // stops two unrelated users' rows from sharing a record_id. If the dedup join in
    // MILEAGE_SQL ever drops user_id from its predicate — the exact typo caught by hand while
    // writing this file, `s.user_id = s.user_id` instead of `s.user_id = r.user_id` — this
    // other user's row would wrongly suppress the one below, and every other assertion in this
    // file would still pass, because they all run as the one seeded user.
    const { rows } = await pool!.query(
      `insert into users (google_sub, email, name)
       values ('test-sub-reminders-2', 'reminders2@test.local', 'Reminder Test 2')
       on conflict (google_sub) do update set email = excluded.email
       returning id`);
    const otherUserId = rows[0].id;
    // The upsert above reuses the same row across runs, so clear any send left behind by a
    // previous run that failed before its own cleanup ran.
    await pool!.query('delete from reminder_sends where user_id = $1', [otherUserId]);
    await pool!.query(
      `insert into reminder_sends (user_id, source, record_id, offset_days) values
         ($1, 'garage_mileage', 'remKm:90000', 7)`, [otherUserId]);

    const due = (await dueReminders()).filter((r) => r.userId === userId);
    assert.ok(due.some((r) => r.recordId === 'remKm:90000'),
      "a different user's send row must never suppress this user's reminder");

    await pool!.query('delete from users where id = $1', [otherUserId]);
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
