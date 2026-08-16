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
