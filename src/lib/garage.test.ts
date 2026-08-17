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

const { upsert, removeById } = await import('./garage.ts');

describe('upsert', () => {
  const list = [
    { id: 'a', label: 'first' },
    { id: 'b', label: 'second' },
  ];

  test('replaces the matching id in place instead of growing the list', () => {
    const out = upsert(list, { id: 'a', label: 'edited' });
    assert.equal(out.length, 2);
    assert.deepEqual(out, [{ id: 'a', label: 'edited' }, { id: 'b', label: 'second' }]);
  });

  test('appends when the id is new', () => {
    const out = upsert(list, { id: 'c', label: 'third' });
    assert.equal(out.length, 3);
    assert.deepEqual(out[2], { id: 'c', label: 'third' });
  });

  test('never mutates the input array', () => {
    const out = upsert(list, { id: 'a', label: 'edited' });
    assert.notEqual(out, list);
    assert.equal(list[0].label, 'first'); // original object unchanged
  });
});

describe('removeById', () => {
  test('drops the matching row and leaves siblings alone', () => {
    const list = [
      { id: 'a', label: 'first' },
      { id: 'b', label: 'second' },
    ];
    const out = removeById(list, 'a');
    assert.deepEqual(out, [{ id: 'b', label: 'second' }]);
  });
});

describe('spend — other costs', () => {
  test('a cost lands in its own bucket and in the total', () => {
    const d = withLogs({
      energy: [fill('e1', '2026-01-01', 80000, 30, 60)],
      costs: [
        { id: 'c1', vehicleId: 'v1', date: '2026-01-05', category: 'Tol & parkir', amount: 12.5 },
        { id: 'c2', vehicleId: 'v1', date: '2026-01-06', category: 'Saman', amount: 150 },
      ],
    });
    const s = spend(d, 'v1');
    assert.equal(s.other, 162.5);
    assert.equal(s.total, 222.5);
  });

  test('another vehicle\'s costs are not counted', () => {
    const d = withLogs({
      costs: [{ id: 'c1', vehicleId: 'v2', date: '2026-01-05', category: 'Saman', amount: 150 }],
    });
    assert.equal(spend(d, 'v1').other, 0);
  });

  test('a cost honours the start date, dated by its own date', () => {
    const d = withLogs({
      costs: [
        { id: 'c1', vehicleId: 'v1', date: '2026-01-05', category: 'Saman', amount: 150 },
        { id: 'c2', vehicleId: 'v1', date: '2026-06-05', category: 'Tol & parkir', amount: 40 },
      ],
    });
    assert.equal(spend(d, 'v1', '2026-03-01').other, 40);
  });

  test('a junk amount degrades to zero rather than making the whole total NaN', () => {
    const d = withLogs({
      costs: [{ id: 'c1', vehicleId: 'v1', date: '2026-01-05', category: 'Saman',
        amount: 'oops' as unknown as number }],
    });
    assert.equal(spend(d, 'v1').other, 0);
    assert.equal(spend(d, 'v1').total, 0);
  });

  // The spec's deliberate omission: a cost has no odometer at all, so a parking receipt can
  // never move a reading that every km-based reminder depends on.
  test('a cost cannot move the odometer', () => {
    const d = withLogs({
      costs: [{ id: 'c1', vehicleId: 'v1', date: '2026-01-05', category: 'Saman', amount: 150 }],
    });
    assert.equal(currentOdo(d, car), 80000);
  });
});

describe('withoutVehicle — costs', () => {
  test('deleting a vehicle takes its costs with it', () => {
    const d = withLogs({
      vehicles: [car, { ...car, id: 'v2' }],
      costs: [
        { id: 'c1', vehicleId: 'v1', date: '2026-01-05', category: 'Saman', amount: 150 },
        { id: 'c2', vehicleId: 'v2', date: '2026-01-05', category: 'Saman', amount: 90 },
      ],
    });
    assert.deepEqual(withoutVehicle(d, 'v1').costs.map((c) => c.id), ['c2']);
  });
});

const { activeVehicles, archivedVehicles } = await import('./garage.ts');

describe('archived vehicles', () => {
  const sold: Vehicle = { ...car, id: 'v2', model: 'Saga', archived: true, archivedAt: '2026-06-30' };

  const fleet = (over: Partial<GarageData>): GarageData =>
    ({ ...EMPTY_GARAGE, vehicles: [car, sold], ...over });

  test('activeVehicles hides it and archivedVehicles is the other half', () => {
    const d = fleet({});
    assert.deepEqual(activeVehicles(d).map((v) => v.id), ['v1']);
    assert.deepEqual(archivedVehicles(d).map((v) => v.id), ['v2']);
  });

  // The one that matters in-app AND on the Home dashboard, which reads dueItems too.
  test('its reminders and documents drop out of the due list entirely', () => {
    const d = fleet({
      reminders: [
        { id: 'r1', vehicleId: 'v1', label: 'Engine oil', done: false, dueDate: shift(3) },
        { id: 'r2', vehicleId: 'v2', label: 'Engine oil', done: false, dueDate: shift(3) },
      ],
      docs: [
        { id: 'd1', vehicleId: 'v1', type: 'roadtax', expiry: shift(5) },
        { id: 'd2', vehicleId: 'v2', type: 'roadtax', expiry: shift(5) },
      ],
    });
    assert.deepEqual(dueItems(d).map((i) => i.id).sort(), ['d1', 'r1']);
  });

  // Unlike the fleet-wide list above, a caller that already named the archived vehicle still
  // gets its records back — that's VehicleDetail's own Documents/Reminders panes, reachable on a
  // sold car's page (its Costs row still opens it), and "Archive keeps everything" has to hold
  // there too: an empty pane over records that still exist would be a lie the UI tells.
  test('asking for the archived vehicle by id still returns its own items', () => {
    const d = fleet({
      reminders: [{ id: 'r2', vehicleId: 'v2', label: 'Engine oil', done: false, dueDate: shift(3) }],
    });
    assert.deepEqual(dueItems(d, 'v2').map((i) => i.id), ['r2']);
  });

  // Archiving hides it from lists and reminders. It must not corrupt its own history — the
  // Costs tab still shows a sold car's figures, and they have to be the right ones.
  test('its own odometer and cost per km are untouched', () => {
    const d = fleet({
      energy: [
        { ...fill('e1', '2026-01-01', 80000, 30, 60), vehicleId: 'v2' },
        { ...fill('e2', '2026-01-15', 80600, 40, 140), vehicleId: 'v2' },
      ],
    });
    assert.equal(currentOdo(d, sold), 80600);
    assert.equal(Number(costPerKm(d, sold)!.toFixed(4)), Number((140 / 600).toFixed(4)));
  });

  test('a vehicle with no archived field at all is active', () => {
    assert.deepEqual(activeVehicles({ ...EMPTY_GARAGE, vehicles: [car] }).map((v) => v.id), ['v1']);
  });
});

const { warrantyReminders, upsertService, withoutService } = await import('./garage.ts');

describe('part warranties', () => {
  const svc = (items: { label: string; cost: number; warrantyUntil?: string; warrantyKm?: number }[]) => ({
    id: 's1', vehicleId: 'v1', date: '2026-02-01', odo: 84000, items,
  });

  test('an item with no warranty produces no reminder', () => {
    assert.deepEqual(warrantyReminders(svc([{ label: 'Engine oil', cost: 180 }])), []);
  });

  test('a dated warranty becomes a dated, non-repeating reminder with a deterministic id', () => {
    const [r] = warrantyReminders(svc([{ label: 'Battery', cost: 320, warrantyUntil: '2027-08-01' }]));
    assert.equal(r.id, 's1:w:Battery');
    assert.equal(r.vehicleId, 'v1');
    assert.equal(r.dueDate, '2027-08-01');
    assert.equal(r.dueOdo, undefined);
    assert.equal(r.repeat, undefined, 'a warranty expires once');
    assert.equal(r.done, false);
    assert.ok(r.label.includes('Battery'));
  });

  test('a distance warranty counts from the service\'s own odometer, not from zero', () => {
    const [r] = warrantyReminders(svc([{ label: 'Tyres', cost: 900, warrantyKm: 40000 }]));
    assert.equal(r.dueOdo, 124000);   // 84000 + 40000
    assert.equal(r.dueDate, undefined);
  });

  test('an item can carry both, and gets both triggers', () => {
    const [r] = warrantyReminders(svc([
      { label: 'Tyres', cost: 900, warrantyUntil: '2028-01-01', warrantyKm: 40000 },
    ]));
    assert.equal(r.dueDate, '2028-01-01');
    assert.equal(r.dueOdo, 124000);
  });

  test('a zero km warranty is not a warranty', () => {
    assert.deepEqual(warrantyReminders(svc([{ label: 'Tyres', cost: 900, warrantyKm: 0 }])), []);
  });
});

describe('upsertService', () => {
  const base = (items: { label: string; cost: number; warrantyUntil?: string; warrantyKm?: number }[]) =>
    ({ id: 's1', vehicleId: 'v1', date: '2026-02-01', odo: 84000, items });

  test('saving a service with a warranty adds its reminder', () => {
    const out = upsertService(withLogs({}), base([{ label: 'Battery', cost: 320, warrantyUntil: '2027-08-01' }]));
    assert.deepEqual(out.services.map((s) => s.id), ['s1']);
    assert.deepEqual(out.reminders.map((r) => r.id), ['s1:w:Battery']);
  });

  test('re-saving the same service replaces rather than duplicates', () => {
    let d = upsertService(withLogs({}), base([{ label: 'Battery', cost: 320, warrantyUntil: '2027-08-01' }]));
    d = upsertService(d, base([{ label: 'Battery', cost: 320, warrantyUntil: '2028-01-15' }]));
    assert.equal(d.services.length, 1);
    assert.equal(d.reminders.length, 1);
    assert.equal(d.reminders[0].dueDate, '2028-01-15');
  });

  test('clearing the warranty removes its reminder', () => {
    let d = upsertService(withLogs({}), base([{ label: 'Battery', cost: 320, warrantyUntil: '2027-08-01' }]));
    d = upsertService(d, base([{ label: 'Battery', cost: 320 }]));
    assert.deepEqual(d.reminders, []);
  });

  test('renaming the item converges instead of leaving the old one behind', () => {
    let d = upsertService(withLogs({}), base([{ label: 'Battery', cost: 320, warrantyUntil: '2027-08-01' }]));
    d = upsertService(d, base([{ label: 'Bateri', cost: 320, warrantyUntil: '2027-08-01' }]));
    assert.deepEqual(d.reminders.map((r) => r.id), ['s1:w:Bateri']);
  });

  test('two items sharing one label collapse to one reminder, not two rows with one id', () => {
    const d = upsertService(withLogs({}), base([
      { label: 'Tyres', cost: 450, warrantyKm: 40000 },
      { label: 'Tyres', cost: 450, warrantyKm: 20000 },
    ]));
    assert.equal(d.reminders.length, 1);
    assert.equal(d.reminders[0].dueOdo, 104000, 'the last one typed wins');
  });

  test('a reminder the owner made themselves is never touched', () => {
    const d = upsertService(
      withLogs({ reminders: [{ id: 'r1', vehicleId: 'v1', label: 'Road tax', done: false, dueDate: '2027-01-01' }] }),
      base([{ label: 'Battery', cost: 320, warrantyUntil: '2027-08-01' }]));
    assert.deepEqual(d.reminders.map((r) => r.id).sort(), ['r1', 's1:w:Battery']);
  });

  test('never mutates the input', () => {
    const before = withLogs({});
    const out = upsertService(before, base([{ label: 'Battery', cost: 320, warrantyUntil: '2027-08-01' }]));
    assert.notEqual(out, before);
    assert.equal(before.services.length, 0);
    assert.equal(before.reminders.length, 0);
  });
});

describe('withoutService', () => {
  test('deleting the service takes its warranty reminders and nothing else', () => {
    let d = upsertService(
      withLogs({ reminders: [{ id: 'r1', vehicleId: 'v1', label: 'Road tax', done: false, dueDate: '2027-01-01' }] }),
      { id: 's1', vehicleId: 'v1', date: '2026-02-01', odo: 84000,
        items: [{ label: 'Battery', cost: 320, warrantyUntil: '2027-08-01' }] });
    d = withoutService(d, 's1');
    assert.deepEqual(d.services, []);
    assert.deepEqual(d.reminders.map((r) => r.id), ['r1']);
  });
});
