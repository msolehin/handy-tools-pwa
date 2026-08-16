import { test } from 'node:test';
import assert from 'node:assert/strict';

// horizon.ts pulls in store.ts, which registers listeners at module scope — so a browser surface
// has to exist before the import below. Same minimal stub store.test.ts uses.
(globalThis as any).window = { addEventListener: () => {}, dispatchEvent: () => true };
(globalThis as any).document = { visibilityState: 'visible' };
(globalThis as any).Event = class { type: string; constructor(type: string) { this.type = type; } };

const { daysUntil, horizonTone, byMonth, renewedDate, addMonths, openServices, latestServiceIds, nextDueDate, kmNum, kmLeft, currentKmOf, KM_SOON } = await import('./horizon.ts');
type HorizonItem = Awaited<ReturnType<typeof import('./horizon.ts').readHorizon>>[number];

const NOW = new Date('2026-08-07T09:00:00');

test('daysUntil ignores the time of day on both sides', () => {
  assert.equal(daysUntil('2026-08-07', NOW), 0);
  assert.equal(daysUntil('2026-08-08', NOW), 1);
  assert.equal(daysUntil('2026-08-06', NOW), -1);
});

test('tone thresholds match the rest of the app', () => {
  assert.equal(horizonTone(7), 'red');
  assert.equal(horizonTone(8), 'amber');
  assert.equal(horizonTone(60), 'amber');
  assert.equal(horizonTone(61), 'emerald');
});

test('addMonths keeps the day of month, and never shifts a day on parse', () => {
  assert.equal(addMonths('2026-08-09', 12), '2027-08-09');
  assert.equal(addMonths('2026-08-09', 0), '2026-08-09');
  // A warranty bought on the 1st must not land on the last day of the previous month, which is
  // what UTC parsing does everywhere west of Greenwich.
  assert.equal(addMonths('2026-03-01', 3), '2026-06-01');
});

test('renewing early extends from the old expiry, not from today', () => {
  assert.equal(renewedDate('2026-10-01', 12, NOW), '2027-10-01');
});

test('renewing an already-lapsed document runs from today', () => {
  assert.equal(renewedDate('2025-01-01', 12, NOW), '2027-08-07');
});

test('renewing from a month end lands on a month end, never overflowing', () => {
  assert.equal(renewedDate('2026-08-31', 1, NOW), '2026-09-30');
  assert.equal(renewedDate('2027-01-31', 1, NOW), '2027-02-28');
});

test('the next due date is this month while the day is still ahead', () => {
  assert.equal(nextDueDate(20, NOW), '2026-08-20');
});

test('a payment due today is due today, not next month', () => {
  // The old page-local version built today from its own ISO string, which parses as UTC midnight —
  // 08:00 local in Malaysia, ahead of the candidate — and rolled the payment forward a month.
  assert.equal(nextDueDate(7, NOW), '2026-08-07');
});

test('the next due date rolls forward once the day has passed', () => {
  assert.equal(nextDueDate(3, NOW), '2026-09-03');
});

test('day 31 lands on the last day of a short month', () => {
  assert.equal(nextDueDate(31, new Date('2026-09-15T09:00:00')), '2026-09-30');
  assert.equal(nextDueDate(31, new Date('2027-02-01T09:00:00')), '2027-02-28');
});

test('a newer visit closes the previous reminder for the same service', () => {
  const open = openServices([
    { id: '1', assetId: 'car', title: 'Engine Oil', date: '2026-01-05', nextServiceDate: '2026-07-05' },
    { id: '2', assetId: 'car', title: 'Engine Oil', date: '2026-07-08', nextServiceDate: '2027-01-08' },
  ]);
  assert.deepEqual(open.map((e) => e.id), ['2']);
});

test('marking the next service done closes the reminder without a new record', () => {
  const events = [
    { id: '1', assetId: 'car', title: 'Aircond', date: '2026-01-05', nextServiceDate: '2026-07-05' },
  ];
  assert.deepEqual(openServices(events).map((e) => e.id), ['1']);
  assert.deepEqual(openServices(events.map((e) => ({ ...e, nextDone: true }))), []);
});

test('a service never re-done keeps its reminder, however overdue', () => {
  const open = openServices([
    { id: '1', assetId: 'car', title: 'Brake Pad', date: '2025-01-05', nextServiceDate: '2025-07-05' },
  ]);
  assert.deepEqual(open.map((e) => e.id), ['1']);
});

test('a newer visit with no next date closes the reminder outright', () => {
  const open = openServices([
    { id: '1', assetId: 'car', title: 'Engine Oil', date: '2026-01-05', nextServiceDate: '2026-07-05' },
    { id: '2', assetId: 'car', title: 'Engine Oil', date: '2026-07-08' },
  ]);
  assert.deepEqual(open, []);
});

// The tool pages grey out superseded rows off this set, so it must keep the latest row of a pair
// even when that row is ticked "dah buat" — otherwise the tick would hide its own untick button.
test('the latest row of a pair stays latest even once it is ticked done', () => {
  const events = [
    { id: '1', assetId: 'car', title: 'Engine Oil', date: '2026-01-05', nextServiceDate: '2026-07-05' },
    { id: '2', assetId: 'car', title: 'Engine Oil', date: '2026-07-08', nextServiceDate: '2027-01-08', nextDone: true },
  ];
  assert.deepEqual([...latestServiceIds(events)], ['2']);
  assert.deepEqual(openServices(events), []);
});

test('services are tracked per asset and per title, not lumped together', () => {
  const open = openServices([
    { id: '1', assetId: 'car', title: 'Engine Oil', date: '2026-07-01', nextServiceDate: '2027-01-01' },
    { id: '2', assetId: 'van', title: 'Engine Oil', date: '2026-07-02', nextServiceDate: '2027-01-02' },
    { id: '3', assetId: 'car', title: 'Tyre Change', date: '2026-07-03', nextServiceDate: '2027-01-03' },
  ]);
  assert.deepEqual(open.map((e) => e.id).sort(), ['1', '2', '3']);
});

test('mileage targets are owed too, and close on the same rules as dates', () => {
  // A service with only a km target must still count as open...
  const kmOnly = [{ id: '1', assetId: 'car', title: 'Engine Oil', date: '2026-01-05', nextServiceMileage: 90000 }];
  assert.deepEqual(openServices(kmOnly).map((e) => e.id), ['1']);

  // ...and must close the same two ways a dated one does: the tick, and a newer visit.
  assert.deepEqual(openServices(kmOnly.map((e) => ({ ...e, nextDone: true }))), []);
  assert.deepEqual(
    openServices([...kmOnly, { id: '2', assetId: 'car', title: 'Engine Oil', date: '2026-07-08' }]),
    []);
});

test('mileage is read out of whatever the user typed', () => {
  assert.equal(kmNum('84,210 km'), 84210);
  assert.equal(kmNum('84210'), 84210);
  assert.equal(kmNum(91400), 91400);
  // No reading at all must stay undefined, never 0 — 0 km would read as a brand new car and
  // make every km target look overdue.
  assert.equal(kmNum(''), undefined);
  assert.equal(kmNum(undefined), undefined);
});

test('a km reminder stays silent until both halves are known', () => {
  const event = { id: '1', assetId: 'car', title: 'Engine Oil', date: '2026-01-05', nextServiceMileage: 90000 };
  assert.equal(kmLeft(event, 89_700), 300);
  assert.ok(kmLeft(event, 89_700)! <= KM_SOON, 'inside the window, so it fires');
  assert.equal(kmLeft(event, 80_000), 10_000);
  assert.equal(kmLeft(event, 90_500), -500, 'negative once the odometer is past the target');
  assert.equal(kmLeft(event, undefined), undefined, 'no odometer, no guess');
  assert.equal(kmLeft({ id: '2' }, 89_700), undefined, 'no target, no guess');
});

test('the odometer falls back to the newest service reading until one is entered', () => {
  const data = {
    assets: [{ id: 'car', name: 'Myvi' }],
    events: [
      { id: '1', assetId: 'car', title: 'Engine Oil', date: '2026-01-05', mileage: '80,000 km' },
      { id: '2', assetId: 'car', title: 'Tyre', date: '2026-07-08', mileage: '88,400' },
    ],
  };
  assert.equal(currentKmOf(data, 'car'), 88_400, 'newest reading wins, whatever the service');

  const withOdo = { ...data, assets: [{ id: 'car', name: 'Myvi', mileage: 91_400 }] };
  assert.equal(currentKmOf(withOdo, 'car'), 91_400, 'a fresher odometer beats the service reading');

  // An odometer only counts up, so the highest reading is the current one. This is what stops a
  // vehicle added with the default 0 — or one whose odometer was typed months ago — from burying
  // a newer service reading and silencing every km reminder.
  const staleOdo = { ...data, assets: [{ id: 'car', name: 'Myvi', mileage: 0 }] };
  assert.equal(currentKmOf(staleOdo, 'car'), 88_400, 'a default 0 must not shadow real readings');

  assert.equal(currentKmOf({ assets: [], events: [] }, 'car'), undefined);
  assert.equal(currentKmOf({ assets: [{ id: 'car', mileage: 0 }], events: [] }, 'car'), 0,
    'a genuinely new vehicle with no history still reads 0, not undefined');
});

test('byMonth keeps date order and starts a group per calendar month', () => {
  const mk = (date: string): HorizonItem =>
    ({ key: date, date, label: date, tool: 't', to: '/t' });
  const groups = byMonth([mk('2026-08-12'), mk('2026-08-19'), mk('2026-09-24')]);
  assert.deepEqual(groups.map((g) => g.month), ['2026-08', '2026-09']);
  assert.deepEqual(groups.map((g) => g.items.length), [2, 1]);
});
