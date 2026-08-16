import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// garage.ts pulls in horizon.ts, which pulls in store.ts, which registers listeners at module scope
// — so a browser surface has to exist before the import below. Same minimal stub as horizon.test.ts.
(globalThis as any).window = { addEventListener: () => {}, dispatchEvent: () => true };
(globalThis as any).document = { visibilityState: 'visible' };
(globalThis as any).Event = class { type: string; constructor(type: string) { this.type = type; } };

const { currentOdo, kmPerDay, readingsOf, EMPTY_GARAGE } = await import('./garage.ts');
type GarageData = Awaited<typeof import('./garage.ts')>['GarageData'];
type Vehicle = Awaited<typeof import('./garage.ts')>['Vehicle'];

const car: Vehicle = {
  id: 'v1', body: 'sedan', energy: 'petrol', model: 'Myvi',
  mileage: 80000, colorIdx: 0, createdAt: 0,
};

const withLogs = (over: Partial<GarageData>): GarageData =>
  ({ ...EMPTY_GARAGE, vehicles: [car], ...over });

describe('currentOdo', () => {
  test('falls back to the number the owner typed when nothing is logged', () => {
    assert.equal(currentOdo(withLogs({}), car), 80000);
  });

  test('rises to the highest reading across every kind of record', () => {
    const d = withLogs({
      energy:   [{ id: 'e1', vehicleId: 'v1', date: '2026-01-01', odo: 82000, kind: 'fuel', qty: 30, cost: 60, full: true }],
      services: [{ id: 's1', vehicleId: 'v1', date: '2026-02-01', odo: 84000, items: [] }],
      odo:      [{ id: 'o1', vehicleId: 'v1', date: '2026-03-01', odo: 85500 }],
    });
    assert.equal(currentOdo(d, car), 85500);
  });

  test('a backdated entry cannot pull the odometer down', () => {
    const d = withLogs({
      odo: [
        { id: 'o1', vehicleId: 'v1', date: '2026-03-01', odo: 90000 },
        { id: 'o2', vehicleId: 'v1', date: '2026-01-01', odo: 81000 }, // entered late, older trip
      ],
    });
    assert.equal(currentOdo(d, car), 90000);
  });

  test('another vehicle\'s readings are ignored', () => {
    const d = withLogs({
      odo: [{ id: 'o1', vehicleId: 'v2', date: '2026-03-01', odo: 500000 }],
    });
    assert.equal(currentOdo(d, car), 80000);
  });
});

describe('kmPerDay', () => {
  test('falls back to a fixed rate with too little history', () => {
    assert.equal(kmPerDay(withLogs({}), 'v1'), 35);
  });

  test('falls back when the readings span under a fortnight', () => {
    const d = withLogs({
      odo: [
        { id: 'o1', vehicleId: 'v1', date: '2026-03-01', odo: 80000 },
        { id: 'o2', vehicleId: 'v1', date: '2026-03-05', odo: 81000 },
      ],
    });
    assert.equal(kmPerDay(d, 'v1'), 35);
  });

  test('measures the real rate over a long enough window', () => {
    const d = withLogs({
      odo: [
        { id: 'o1', vehicleId: 'v1', date: '2026-01-01', odo: 80000 },
        { id: 'o2', vehicleId: 'v1', date: '2026-03-02', odo: 86000 }, // 60 days, 6000 km
      ],
    });
    assert.equal(Math.round(kmPerDay(d, 'v1')), 100);
  });
});

describe('readingsOf', () => {
  test('returns every reading newest first', () => {
    const d = withLogs({
      energy:   [{ id: 'e1', vehicleId: 'v1', date: '2026-01-01', odo: 82000, kind: 'fuel', qty: 30, cost: 60, full: true }],
      services: [{ id: 's1', vehicleId: 'v1', date: '2026-02-01', odo: 84000, items: [] }],
    });
    assert.deepEqual(readingsOf(d, 'v1').map((r) => r.odo), [84000, 82000]);
  });
});

const { statusOf, dueItems } = await import('./garage.ts');

// daysUntil() measures from real today, so tests build their dates relative to it.
const shift = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('statusOf', () => {
  test('a date in the past is overdue', () => {
    const s = statusOf({ dueDate: shift(-3) }, withLogs({}), car);
    assert.equal(s.level, 'over');
  });

  test('a date inside 30 days is due soon', () => {
    assert.equal(statusOf({ dueDate: shift(10) }, withLogs({}), car).level, 'soon');
  });

  test('a date beyond 30 days is ok', () => {
    assert.equal(statusOf({ dueDate: shift(90) }, withLogs({}), car).level, 'ok');
  });

  test('an odometer target already passed is overdue', () => {
    // currentOdo is 80000 with no logs.
    assert.equal(statusOf({ dueOdo: 79000 }, withLogs({}), car).level, 'over');
  });

  test('a km gap is projected into days with the vehicle\'s own rate', () => {
    // 100 km/day measured below, so a 500 km gap is 5 days away — inside the soon window.
    const d = withLogs({
      odo: [
        { id: 'o1', vehicleId: 'v1', date: shift(-60), odo: 80000 },
        { id: 'o2', vehicleId: 'v1', date: shift(0),   odo: 86000 },
      ],
    });
    const s = statusOf({ dueOdo: 86500 }, d, car);
    assert.equal(s.level, 'soon');
    assert.ok(s.text.includes('km'));
  });

  test('when both triggers are set, whichever hits first wins', () => {
    const s = statusOf({ dueDate: shift(200), dueOdo: 79000 }, withLogs({}), car);
    assert.equal(s.level, 'over');   // the odometer target, not the far-off date
  });

  test('no trigger at all is ok and says so', () => {
    const s = statusOf({}, withLogs({}), car);
    assert.equal(s.level, 'ok');
  });
});

describe('dueItems', () => {
  test('reminders and documents share one sorted list, soonest first', () => {
    const d = withLogs({
      reminders: [{ id: 'r1', vehicleId: 'v1', label: 'Engine oil', dueDate: shift(20), done: false }],
      docs: [{ id: 'd1', vehicleId: 'v1', type: 'roadtax', expiry: shift(2) }],
    });
    const items = dueItems(d);
    assert.deepEqual(items.map((i) => i.kind), ['document', 'reminder']);
  });

  test('a completed reminder drops off the list', () => {
    const d = withLogs({
      reminders: [{ id: 'r1', vehicleId: 'v1', label: 'Engine oil', dueDate: shift(2), done: true }],
    });
    assert.equal(dueItems(d).length, 0);
  });
});
