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

  test('a km projection landing today reads plainly, not "~today"', () => {
    // 10 km at the assumed 35 km/day rate rounds to 0 days out.
    const s = statusOf({ dueOdo: 80010 }, withLogs({}), car);
    assert.ok(!/~today|~hari ini/.test(s.text), `unexpected doubled/odd tilde in: ${s.text}`);
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

const { economy, costPerKm, spend, serviceTotal } = await import('./garage.ts');
type V = Awaited<typeof import('./garage.ts')>['Vehicle'];

const phev: V = { id: 'p1', body: 'suv', energy: 'phev', model: 'Outlander',
  mileage: 10000, colorIdx: 0, createdAt: 0 };

const fill = (id: string, date: string, odo: number, qty: number, cost: number, full = true) =>
  ({ id, vehicleId: 'v1', date, odo, kind: 'fuel' as const, qty, cost, full });

describe('economy', () => {
  test('needs two full fills before it will claim anything', () => {
    const d = withLogs({ energy: [fill('e1', '2026-01-01', 80000, 30, 60)] });
    assert.equal(economy(d, car, 'fuel'), null);
  });

  test('measures km per litre across a full-to-full window', () => {
    const d = withLogs({ energy: [
      fill('e1', '2026-01-01', 80000, 30, 60),
      fill('e2', '2026-01-15', 80600, 40, 80),   // 600 km on the 40 L that refilled it
    ]});
    const e = economy(d, car, 'fuel')!;
    assert.equal(e.rate, 15);
    assert.equal(e.unit, 'km/L');
    assert.equal(e.dist, 600);
  });

  test('a partial fill is counted inside the window it sits in, not discarded', () => {
    const d = withLogs({ energy: [
      fill('e1', '2026-01-01', 80000, 30, 60),
      fill('e2', '2026-01-10', 80300, 10, 20, false),  // topped up mid-window
      fill('e3', '2026-01-15', 80600, 40, 80),
    ]});
    const e = economy(d, car, 'fuel')!;
    // The tank was full at 80000 and full again at 80600, so everything poured in between —
    // partial included — is exactly what those 600 km consumed.
    assert.equal(e.dist, 600);
    assert.equal(e.qty, 50);
    assert.equal(e.rate, 12);
  });

  test('a window that never closes on a full tank is not measured', () => {
    const d = withLogs({ energy: [
      fill('e1', '2026-01-01', 80000, 30, 60),
      fill('e2', '2026-01-10', 80300, 10, 20, false),  // still topped up, never filled again
    ]});
    assert.equal(economy(d, car, 'fuel'), null);
  });

  test('a PHEV reports petrol and electricity separately', () => {
    const d: GarageData = { ...EMPTY_GARAGE, vehicles: [phev], energy: [
      { id: 'f1', vehicleId: 'p1', date: '2026-01-01', odo: 10000, kind: 'fuel', qty: 20, cost: 40, full: true },
      { id: 'f2', vehicleId: 'p1', date: '2026-02-01', odo: 10400, kind: 'fuel', qty: 20, cost: 40, full: true },
      { id: 'c1', vehicleId: 'p1', date: '2026-01-01', odo: 10000, kind: 'charge', qty: 10, cost: 6, full: true },
      { id: 'c2', vehicleId: 'p1', date: '2026-02-01', odo: 10400, kind: 'charge', qty: 20, cost: 12, full: true },
    ]};
    assert.equal(economy(d, phev, 'fuel')!.unit, 'km/L');
    assert.equal(economy(d, phev, 'fuel')!.rate, 20);
    assert.equal(economy(d, phev, 'charge')!.unit, 'km/kWh');
    assert.equal(economy(d, phev, 'charge')!.rate, 20);
  });

  test('a partial before the first full tank is not counted', () => {
    const d = withLogs({ energy: [
      fill('e1', '2026-01-01', 80000, 10, 20, false),  // window opened before we were watching
      fill('e2', '2026-01-05', 80200, 20, 40),
      fill('e3', '2026-01-20', 80800, 40, 80),
    ]});
    const e = economy(d, car, 'fuel')!;
    // Only e2 -> e3 is a closed window. The 10 L and the 20 L before it refilled fuel burned
    // over distance nobody logged, and crediting them would inflate consumption.
    assert.equal(e.dist, 600);
    assert.equal(e.qty, 40);
  });

  test('consecutive windows accumulate rather than replacing each other', () => {
    const d = withLogs({ energy: [
      fill('e1', '2026-01-01', 80000, 30, 60),
      fill('e2', '2026-01-15', 80600, 40, 80),
      fill('e3', '2026-02-01', 81200, 50, 100),
    ]});
    const e = economy(d, car, 'fuel')!;
    assert.equal(e.dist, 1200);
    assert.equal(e.qty, 90);
    assert.equal(e.spend, 180);   // window-scoped: the opening e1 fill is excluded
  });
});

describe('costPerKm', () => {
  test('is null until the vehicle has actually moved', () => {
    assert.equal(costPerKm(withLogs({}), car), null);
  });

  test('divides everything spent by the distance observed, less the opening fill', () => {
    const d = withLogs({
      energy: [fill('e1', '2026-01-01', 80000, 30, 60), fill('e2', '2026-01-15', 80600, 40, 140)],
      services: [{ id: 's1', vehicleId: 'v1', date: '2026-01-10', odo: 80300,
        items: [{ label: 'Engine oil', cost: 200 }] }],
    });
    // 400 spent in total, less the RM60 opening fill that paid for earlier distance,
    // over the 600 km between the lowest and highest reading.
    assert.equal(Number(costPerKm(d, car)!.toFixed(4)), Number((340 / 600).toFixed(4)));
  });

  // Item 4: a single fill plus a later odo log with no cost of its own is exactly the case where
  // the opening fill's own cost cancels itself out of the window (spend === opening), so the
  // numerator collapses to 0. That must read as "not enough data" (null) everywhere, the same as
  // the no-movement case above — never a literal RM 0.00/km, which three different call sites
  // used to render three different ways (parts.tsx, Costs.tsx, VehicleDetail.tsx).
  test('a numerator that collapses to exactly 0 is null, not a real zero rate', () => {
    const d = withLogs({
      energy: [fill('e1', '2026-01-01', 80000, 30, 60)],
      odo: [{ id: 'o1', vehicleId: 'v1', date: '2026-01-15', odo: 80600 }],
    });
    assert.equal(costPerKm(d, car), null);
  });
});

describe('spend', () => {
  test('separates service, energy and documents', () => {
    const d = withLogs({
      energy: [fill('e1', '2026-01-01', 80000, 30, 60)],
      services: [{ id: 's1', vehicleId: 'v1', date: '2026-01-10', odo: 80300,
        items: [{ label: 'Engine oil', cost: 150 }, { label: 'Oil filter', cost: 30 }] }],
      docs: [{ id: 'd1', vehicleId: 'v1', type: 'roadtax', expiry: '2027-01-01',
        issued: '2026-01-01', cost: 90 }],
    });
    const s = spend(d, 'v1');
    assert.equal(s.energy, 60);
    assert.equal(s.service, 180);
    assert.equal(s.docs, 90);
    assert.equal(s.total, 330);
  });

  test('honours a start date', () => {
    const d = withLogs({ energy: [
      fill('e1', '2026-01-01', 80000, 30, 60),
      fill('e2', '2026-06-01', 82000, 30, 70),
    ]});
    assert.equal(spend(d, 'v1', '2026-03-01').energy, 70);
  });
});

describe('serviceTotal', () => {
  test('sums the line items', () => {
    assert.equal(serviceTotal({ id: 's', vehicleId: 'v1', date: '2026-01-01', odo: 1,
      items: [{ label: 'a', cost: 10 }, { label: 'b', cost: 5.5 }] }), 15.5);
  });
});

const { tickReminder, addMonths } = await import('./garage.ts');

describe('tickReminder', () => {
  test('a repeating date reminder rolls its due date forward instead of closing', () => {
    // A near-future date, not a hardcoded past literal — with the overdue-safe roll below, a
    // due date already behind "today" by more than one interval would keep advancing past a
    // single +6-months hop, which is exactly what the dedicated overdue test further down checks.
    const due = shift(5);
    const d = withLogs({
      reminders: [{ id: 'r1', vehicleId: 'v1', label: 'Engine oil', done: false,
        dueDate: due, repeat: { months: 6, km: 0 } }],
    });
    const r = tickReminder(d, 'r1').reminders[0];
    assert.equal(r.done, false);
    assert.equal(r.dueDate, addMonths(due, 6));
  });

  test('a repeating mileage reminder rolls its odometer target forward', () => {
    const d = withLogs({
      reminders: [{ id: 'r1', vehicleId: 'v1', label: 'Tyres', done: false,
        dueOdo: 85000, repeat: { months: 0, km: 40000 } }],
    });
    const r = tickReminder(d, 'r1').reminders[0];
    assert.equal(r.done, false);
    assert.equal(r.dueOdo, 125000);
  });

  test('a non-repeating reminder closes instead of rolling', () => {
    const d = withLogs({
      reminders: [{ id: 'r1', vehicleId: 'v1', label: 'Puspakom', done: false, dueDate: '2026-01-01' }],
    });
    const r = tickReminder(d, 'r1').reminders[0];
    assert.equal(r.done, true);
    assert.ok(r.doneDate);
  });

  test('other reminders are left untouched', () => {
    const d = withLogs({
      reminders: [
        { id: 'r1', vehicleId: 'v1', label: 'a', done: false, dueDate: '2026-01-01' },
        { id: 'r2', vehicleId: 'v1', label: 'b', done: false, dueDate: '2026-01-01' },
      ],
    });
    const out = tickReminder(d, 'r1');
    assert.equal(out.reminders[1].done, false);
  });

  // Finding 1: a repeat naming a dimension the reminder has no matching trigger for (mode
  // "by mileage" with a months-only repeat) used to hand back an identical clone — neither roll
  // guard fired, and there was no fallthrough. The tick button did visibly nothing.
  test('a repeat with no matching trigger closes the reminder instead of cloning it unchanged', () => {
    const d = withLogs({
      reminders: [{ id: 'r1', vehicleId: 'v1', label: 'Tyres', done: false,
        dueOdo: 90000, repeat: { months: 6, km: 0 } }],
    });
    const r = tickReminder(d, 'r1').reminders[0];
    assert.equal(r.done, true);
    assert.ok(r.doneDate);
  });

  test('the same mismatch on the date side (km-only repeat, date-only trigger) also closes', () => {
    const d = withLogs({
      reminders: [{ id: 'r1', vehicleId: 'v1', label: 'Road tax', done: false,
        dueDate: shift(5), repeat: { months: 0, km: 5000 } }],
    });
    const r = tickReminder(d, 'r1').reminders[0];
    assert.equal(r.done, true);
  });

  // Finding 2: anchoring a roll to the OLD due date/odometer with a single +1-interval hop is
  // only correct when the reminder wasn't already overdue by more than one interval. A reminder
  // skipped for a while must roll past the present, not to another still-past value.
  test('a date reminder overdue by more than one interval rolls past today, not just one hop', () => {
    const d = withLogs({
      reminders: [{ id: 'r1', vehicleId: 'v1', label: 'Engine oil', done: false,
        dueDate: shift(-200), repeat: { months: 6, km: 0 } }],
    });
    const r = tickReminder(d, 'r1').reminders[0];
    assert.equal(r.done, false);
    // A single +6-months hop from 200 days ago still lands about three weeks in the past.
    assert.ok(r.dueDate! > shift(0), `expected a date after today, got ${r.dueDate}`);
  });

  test('a mileage reminder overdue by more than one interval rolls past the current odometer', () => {
    const d = withLogs({
      // currentOdo is 80000 (car.mileage, no logs). A single +10000 hop from 70000 lands
      // exactly ON 80000 — still due right now, not ahead of it.
      reminders: [{ id: 'r1', vehicleId: 'v1', label: 'Tyres', done: false,
        dueOdo: 70000, repeat: { months: 0, km: 10000 } }],
    });
    const r = tickReminder(d, 'r1').reminders[0];
    assert.equal(r.done, false);
    assert.ok(r.dueOdo! > 80000, `expected an odometer target past 80000, got ${r.dueOdo}`);
  });
});

const { withoutVehicle } = await import('./garage.ts');

describe('withoutVehicle', () => {
  const twoVehicles: GarageData = {
    ...EMPTY_GARAGE,
    vehicles: [car, { ...car, id: 'v2' }],
    services: [
      { id: 's1', vehicleId: 'v1', date: '2026-01-01', odo: 1, items: [] },
      { id: 's2', vehicleId: 'v2', date: '2026-01-01', odo: 1, items: [] },
    ],
    docs: [
      { id: 'd1', vehicleId: 'v1', type: 'roadtax', expiry: '2026-01-01' },
      { id: 'd2', vehicleId: 'v2', type: 'roadtax', expiry: '2026-01-01' },
    ],
    energy: [
      fill('e1', '2026-01-01', 100, 10, 20),
      { ...fill('e2', '2026-01-01', 100, 10, 20), vehicleId: 'v2' },
    ],
    odo: [
      { id: 'o1', vehicleId: 'v1', date: '2026-01-01', odo: 1 },
      { id: 'o2', vehicleId: 'v2', date: '2026-01-01', odo: 1 },
    ],
    reminders: [
      { id: 'r1', vehicleId: 'v1', label: 'x', done: false },
      { id: 'r2', vehicleId: 'v2', label: 'x', done: false },
    ],
  };

  test('removes the vehicle and every row that references it, across all five tables', () => {
    const out = withoutVehicle(twoVehicles, 'v1');
    assert.deepEqual(out.vehicles.map((v) => v.id), ['v2']);
    assert.deepEqual(out.services.map((s) => s.id), ['s2']);
    assert.deepEqual(out.docs.map((x) => x.id), ['d2']);
    assert.deepEqual(out.energy.map((e) => e.id), ['e2']);
    assert.deepEqual(out.odo.map((o) => o.id), ['o2']);
    assert.deepEqual(out.reminders.map((r) => r.id), ['r2']);
  });

  test('leaves the other vehicle\'s rows untouched, and never mutates the input', () => {
    const out = withoutVehicle(twoVehicles, 'v1');
    assert.notEqual(out, twoVehicles);
    assert.equal(twoVehicles.services.length, 2); // original object unchanged
  });
});
