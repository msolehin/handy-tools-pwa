import { test } from 'node:test';
import assert from 'node:assert/strict';

// horizon.ts pulls in store.ts, which registers listeners at module scope — so a browser surface
// has to exist before the import below. Same minimal stub store.test.ts uses.
(globalThis as any).window = { addEventListener: () => {}, dispatchEvent: () => true };
(globalThis as any).document = { visibilityState: 'visible' };
(globalThis as any).Event = class { type: string; constructor(type: string) { this.type = type; } };

const { daysUntil, horizonTone, byMonth, renewedDate, addMonths, openServices, nextDueDate } = await import('./horizon.ts');
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

test('services are tracked per asset and per title, not lumped together', () => {
  const open = openServices([
    { id: '1', assetId: 'car', title: 'Engine Oil', date: '2026-07-01', nextServiceDate: '2027-01-01' },
    { id: '2', assetId: 'van', title: 'Engine Oil', date: '2026-07-02', nextServiceDate: '2027-01-02' },
    { id: '3', assetId: 'car', title: 'Tyre Change', date: '2026-07-03', nextServiceDate: '2027-01-03' },
  ]);
  assert.deepEqual(open.map((e) => e.id).sort(), ['1', '2', '3']);
});

test('byMonth keeps date order and starts a group per calendar month', () => {
  const mk = (date: string): HorizonItem =>
    ({ key: date, date, label: date, tool: 't', to: '/t' });
  const groups = byMonth([mk('2026-08-12'), mk('2026-08-19'), mk('2026-09-24')]);
  assert.deepEqual(groups.map((g) => g.month), ['2026-08', '2026-09']);
  assert.deepEqual(groups.map((g) => g.items.length), [2, 1]);
});
