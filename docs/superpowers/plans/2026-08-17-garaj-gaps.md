# Garaj Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four gaps the Garaj rebuild left open — running costs that are neither service, energy nor document; archiving a sold vehicle instead of deleting it; a warranty on a fitted part; and getting the whole tool's data out and back in as a file.

**Architecture:** Everything derived stays in the two pure modules (`garage.ts` arithmetic, `garage-presets.ts` domain tables), so all four features are testable with hand-built fixtures before a single component changes. `Cost` becomes a seventh record type on `GarageData`, riding the existing `garage_records` sync key; `archived` becomes two optional fields on `Vehicle` whose whole effect is a filter in `dueItems()`, three SQL joins in `server/reminders.ts`, and which lists a vehicle appears in; a part warranty is two optional fields on a service line item that a deterministic-id reminder is rebuilt from on every save; export/import is a pure serialise/validate pair over the three sync blobs verbatim.

**Tech Stack:** React 19 + TypeScript, Tailwind with the project's `--color-*` tokens and the `light:` variant, Hono + node-postgres on the server, `node --test` for both suites. No new dependencies.

**Spec:** docs/superpowers/specs/2026-08-17-garaj-gaps-design.md

## Global Constraints

- No new npm dependencies.
- Client tests are `npm test`; server tests are `npm run test:server`. **`npm test -- <path>` does NOT scope the run** — the script's own glob unions with any extra argument, so the whole suite runs regardless. Every step below says plain `npm test`.
- `npx tsc -b --noEmit`, `npm run lint` and `npm run build` must all be clean before any commit.
- `setData` must always produce a **new top-level object**. The shell skips its mount write via `data === mountedWith.current` (`src/pages/garage/index.tsx:104-110`), so an in-place mutation silently loses the save.
- Bilingual via `useT()` in components and `t()` from `src/lib/lang.ts` outside them — every user-visible string, both languages at the call site.
- **`text-white` and `bg-black` are theme tokens here that invert under `html.light`.** Against a fixed-colour background use a literal (`text-[#ffffff]`, `bg-[#000000]/50`). This has caused three separate defects in this codebase.
- `light:text-blue-700`, not `-600`, for small bold accent text — the contrast was measured in `DebtTracker.tsx:24-26`.
- The tool's accent is **blue** (`--color-primary` is blue-500). Status colours stay a traffic light: green ok, amber soon, rose overdue. A chart segment must never borrow a status colour.
- Numbers render monospace with `style={{ fontVariantNumeric: 'tabular-nums' }}`. Tap targets ≥44px.
- Relative imports in `src/lib/` carry explicit `.ts` extensions.
- Comments explain *why*, not *what*.
- Migrations are **additive only** — no `drop table`, no `delete from`. `server/tools.ts:74-77` documents that convention.
- `pg` returns `int8` and `numeric` as JS **strings**. Every numeric/bigint column a descriptor reads needs a `::float8` cast — `garage_costs.amount` is one. `server/tools.test.ts` compares with `assert.deepStrictEqual` for exactly this reason.
- A `not null` boolean column must be read as `case when col then true end`, never bare — `dropNulls` keeps `false`, so a bare read invents a field the blob never sent and breaks the round trip. `home_service_events.next_done` is the existing precedent.
- Build order is fixed by the spec: **other costs → archive → part warranty → export/import.** Export is last because it serialises the final shape.

### Which tasks are code-complete, and which are prose-specified

| Task | Kind |
|---|---|
| 1, 2, 3, 6, 7, 9, 11 | **Code-complete** — real implementation, real tests, copy them as written |
| 4, 5, 8, 10, 12 | **Prose-specified** — UI. Exact fields, validation rules, labels, component names and prop shapes are given; the JSX itself is the implementer's |

A prose-specified task has no test step. It ends at `npx tsc -b --noEmit` + `npm run lint` + `npm run build` + a manual check, because the repo has no component test harness and this plan does not introduce one.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/lib/garage.ts` | modify | `Cost`, `ServiceItem`, `Vehicle.archived`, `GarageData.costs`, `spend().other`, `activeVehicles`/`archivedVehicles`, `dueItems` archive filter, `warrantyReminders`/`upsertService`/`withoutService`, `buildBackup`/`parseBackup` |
| `src/lib/garage.test.ts` | modify | Appended describes for each of the above |
| `src/lib/garage-presets.ts` | modify | `COST_CATEGORY_KEY`, `DEFAULT_COST_CATEGORIES`, `costCategories()` |
| `src/lib/garage-presets.test.ts` | modify | Cost-category resolution and the reserved-key collision guard |
| `server/migrations/019_garage_costs.sql` | create | `garage_costs` table + its index |
| `server/migrations/020_garage_archive.sql` | create | `garage_vehicles.archived`, `.archived_at` |
| `server/tools.ts` | modify | `garage_records` gains a costs read/write pair; `garage_fleet` gains the two archive columns |
| `server/tools.test.ts` | modify | Costs in the hand-seeded `garage_records` test; archive fields in the `garage_fleet` fixture |
| `server/reminders.ts` | modify | All three garage arms join `garage_vehicles` and filter `not archived` |
| `server/reminders.test.ts` | modify | A sold vehicle whose reminders, mileage target and document all stay silent |
| `src/pages/garage/index.tsx` | modify | `costs` in `RecordsBlob`, `readGarage` and the save effect |
| `src/pages/garage/logSheets.tsx` | modify | `CostSheet` |
| `src/pages/garage/sheets.tsx` | modify | `VehicleSheet` archive/restore + field preservation; `ServiceSheet` per-item warranty disclosure |
| `src/pages/garage/VehicleDetail.tsx` | modify | Fifth segment + `CostsPane`; sold banner; service saves route through `upsertService`/`withoutService` |
| `src/pages/garage/Overview.tsx` | modify | Sixth quick-add row, costs in Recent, active-only picker and selection fallback |
| `src/pages/garage/Vehicles.tsx` | modify | Active grid + collapsed **Dijual / Sold** section |
| `src/pages/garage/Costs.tsx` | modify | Fourth stacked segment and legend row; Sold tag on the per-vehicle rows |
| `src/pages/garage/Settings.tsx` | modify | Cost-category editor (shared `PresetEditor`), export and import controls |
| `src/pages/garage/parts.tsx` | modify | `SoldTag` |

Not touched, deliberately: `src/lib/store.ts` (no new sync key — costs join `garage_records`), `src/pages/Home.tsx` (its dashboard block already goes through `dueItems`, which Task 6 teaches to skip archived vehicles), `src/lib/tools.ts`.

---

### Task 1: A cost is a record, and `spend()` grows a fourth bucket

**Code-complete.**

**Files:**
- Modify: `src/lib/garage.ts` (append `Cost` after `OdoLog`; edit `GarageData`, `EMPTY_GARAGE`, `Spend`, `spend`, `withoutVehicle`)
- Modify: `src/pages/garage/index.tsx:53-73, 107-109` (so the tree still typechecks)
- Test: `src/lib/garage.test.ts` (append)

**Interfaces:**
- Consumes: `GarageData`, `Spend`, `spend`, `withoutVehicle` as they exist today.
- Produces: `interface Cost { id: string; vehicleId: string; date: string; category: string; amount: number; note?: string; receipt?: string }`; `GarageData.costs: Cost[]`; `Spend = { service: number; energy: number; docs: number; other: number; total: number }`.

**Every caller of `spend()`, all four, checked:**

| Caller | Change needed |
|---|---|
| `src/lib/garage.ts:387` (`costPerKm`) | **None.** It divides `spend(...).total`, which now includes `other` — which is the correct new behaviour. |
| `src/pages/garage/VehicleDetail.tsx:98` | **None.** Reads `.total`. The 12-month stat now includes other costs, as intended. |
| `src/pages/garage/Costs.tsx:146` | **None.** Reads `.total`. |
| `src/lib/garage.test.ts:292` | Existing assertions still hold (`other` is 0 there); Task 1 appends new ones. |

Nothing destructures `Spend` field-by-field outside `Costs.tsx`'s own chart totals, which are built from `MonthBucket`, not from `spend()` — Task 5 handles those.

- [ ] **Step 1: Write the failing test**

Append to the end of `src/lib/garage.test.ts` (`spend`, `withoutVehicle`, `currentOdo`, `car`, `withLogs` and `fill` are all already in scope from earlier in the file — do not re-import them, a second `const` binding of the same name is a redeclaration error):

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — TypeScript rejects `costs` as an unknown property of `Partial<GarageData>`, and `spend(...).other` does not exist on `Spend`.

- [ ] **Step 3: Write the implementation**

In `src/lib/garage.ts`, add after the `OdoLog` interface (line 76):

```ts
/**
 * A running cost that is neither a service, an energy fill, nor a document — a saman, a Touch 'n
 * Go reload, a dashcam. Without it the Costs tab claims to answer "what does this vehicle cost
 * me" and structurally cannot.
 *
 * Deliberately no odometer field. Every other record carrying one feeds currentOdo(), which is a
 * maximum over all readings; a parking receipt's mileage is incidental and would move the
 * odometer for no reason, and excluding it from that maximum would mean an `odo` that means
 * something different from every other `odo` in the tool.
 */
export interface Cost {
  id: string; vehicleId: string;
  date: string;
  /** Free text over an editable list (see COST_CATEGORY_KEY in garage-presets.ts), not a union:
   *  a fixed enum would mean a code change every time someone wants to track something new. */
  category: string;
  amount: number;
  note?: string;
  receipt?: string;
}
```

Add `costs` to `GarageData` (after `docs`) and to `EMPTY_GARAGE`:

```ts
export interface GarageData {
  vehicles: Vehicle[];
  presets: Presets;
  services: Service[];
  docs: VDoc[];
  costs: Cost[];
  energy: EnergyLog[];
  odo: OdoLog[];
  reminders: Reminder[];
}

export const EMPTY_GARAGE: GarageData = {
  vehicles: [], presets: {}, services: [], docs: [], costs: [], energy: [], odo: [], reminders: [],
};
```

Replace `Spend` and the tail of `spend()`:

```ts
export interface Spend { service: number; energy: number; docs: number; other: number; total: number }
```

and inside `spend()`, after the `docs` block, before the `return`:

```ts
  // Dated by its own date. Unlike a document there is no issued/expiry subtlety here — a saman
  // is paid on the day it is paid.
  const other = d.costs
    .filter((c) => mine(c.vehicleId) && inRange(c.date))
    .reduce((total, c) => total + (Number(c.amount) || 0), 0);

  return { service, energy, docs, other, total: service + energy + docs + other };
```

In `withoutVehicle`, add one line beside the existing five filters:

```ts
    costs: d.costs.filter((c) => c.vehicleId !== vehicleId),
```

In `src/pages/garage/index.tsx`, `RecordsBlob` gains the field (line 54):

```ts
interface RecordsBlob { services?: GarageData['services']; docs?: GarageData['docs']; costs?: GarageData['costs'] }
```

`readGarage` gains one line beside `docs` (line 68):

```ts
    costs: records.costs ?? EMPTY_GARAGE.costs,
```

and the save effect's RECORDS write (line 108) becomes:

```ts
    store.setItem(RECORDS, JSON.stringify({ services: data.services, docs: data.docs, costs: data.costs }));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — the whole client suite.

Then: `npx tsc -b --noEmit` — clean. `npm run lint` — clean. `npm run build` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/garage.ts src/lib/garage.test.ts src/pages/garage/index.tsx
git commit -m "Let a saman be a cost, so the Costs tab stops lying about the total"
```

---

### Task 2: Cost categories, on the pattern the checklists already proved

**Code-complete.**

**Files:**
- Modify: `src/lib/garage-presets.ts` (append after `typeKey`)
- Test: `src/lib/garage-presets.test.ts` (append)

**Interfaces:**
- Consumes: the module-private `dedupe`, and `typeKey(body, energy)` for the collision test.
- Produces: `COST_CATEGORY_KEY: '_cost_categories'`, `DEFAULT_COST_CATEGORIES: string[]`, `costCategories(customs?: string[], hidden?: string[]): string[]`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/garage-presets.test.ts`, and add the three new names to the existing import at the top of that file (`COST_CATEGORY_KEY`, `DEFAULT_COST_CATEGORIES`, `costCategories`, plus `BODIES` and `ENERGIES` if they are not already imported there):

```ts
describe('cost categories', () => {
  test('one default ships, and it is the toll/parking one', () => {
    assert.deepEqual(costCategories(), ['Tol & parkir']);
  });

  test('customs are appended and never duplicate the default', () => {
    const list = costCategories(['Saman', 'Tol & parkir', 'Cuci kereta'], []);
    assert.equal(list.filter((c) => c === 'Tol & parkir').length, 1);
    assert.deepEqual(list, ['Tol & parkir', 'Saman', 'Cuci kereta']);
  });

  test('a hidden default is removed', () => {
    assert.deepEqual(costCategories(['Saman'], ['Tol & parkir']), ['Saman']);
  });

  test('hiding everything is allowed — an empty list, not a silent fallback to the default', () => {
    assert.deepEqual(costCategories([], ['Tol & parkir']), []);
  });

  // The reserved key shares a table with the service checklists, whose keys are body:energy
  // pairs. The leading underscore is the whole guarantee that the two can never collide, so it
  // is asserted rather than assumed.
  test('the reserved key can never collide with a real vehicle type key', () => {
    for (const body of Object.keys(BODIES) as Body[]) {
      for (const energy of Object.keys(ENERGIES) as Energy[]) {
        assert.notEqual(typeKey(body, energy), COST_CATEGORY_KEY);
      }
    }
    assert.ok(COST_CATEGORY_KEY.startsWith('_'));
  });

  test('the default list is not mutable through a returned array', () => {
    costCategories().push('Oops');
    assert.deepEqual(DEFAULT_COST_CATEGORIES, ['Tol & parkir']);
  });
});
```

The `Body` and `Energy` types are needed for the loop — extend the existing `import type` line in that file, or add:

```ts
import type { Body, Energy } from './garage-presets.ts';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `costCategories is not a function` / no exported member `COST_CATEGORY_KEY`.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/garage-presets.ts`, directly after the `typeKey` export:

```ts
/**
 * Cost categories live in the same `garage_presets` table as the service checklists, under this
 * one reserved key. That table's columns are already `(user_id, type_key, customs, hidden)` —
 * exactly the shape needed — and it already has a tested read/write path in the descriptor; a
 * second one-row-per-user table would buy nothing but a truer column name.
 *
 * `type_key` otherwise means a VEHICLE TYPE (`sedan:petrol`), and a reader would reasonably
 * assume it always does. The leading underscore is what guarantees it never can be one: no Body
 * starts with an underscore, so `typeKey()` can never produce this string. The server end of
 * the same pairing carries the same note.
 *
 * Unlike a service checklist these are garage-wide, not per vehicle type — a parking fee is not
 * specific to a motorcycle.
 */
export const COST_CATEGORY_KEY = '_cost_categories';

/**
 * The only one that ships. A starting point, not a prediction: anything else — saman, aksesori,
 * cuci kereta, tunda — is one line in Settings, which is the whole reason `category` is a free
 * string rather than a union.
 */
export const DEFAULT_COST_CATEGORIES = ['Tol & parkir'];

/** Defaults, plus what the owner added, minus what they removed. Same resolution as presetsFor,
 *  minus the type lookup, because there is no type to look up. */
export function costCategories(customs: string[] = [], hidden: string[] = []): string[] {
  const gone = new Set(hidden);
  return dedupe([...DEFAULT_COST_CATEGORIES, ...customs]).filter((c) => !gone.has(c));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/garage-presets.ts src/lib/garage-presets.test.ts
git commit -m "Let the owner name their own cost categories, the way the checklists already do"
```

---

### Task 3: `garage_costs`, and the third read/write pair on `garage_records`

**Code-complete.**

**Files:**
- Create: `server/migrations/019_garage_costs.sql`
- Modify: `server/tools.ts:552-582` (the `garage_records` descriptor)
- Test: `server/tools.test.ts:299-326` (the hand-seeded `garage_records` round trip)

**Interfaces:**
- Consumes: `Cost` from Task 1; `insertMany`, `arr`, `num`, `dropNulls` from `server/tools.ts`.
- Produces: the `garage_records` blob becomes `{ services: Service[]; docs: VDoc[]; costs: Cost[] }`.

**Round-trip audit — `Cost` → read alias → write column → migration:**

| `Cost` field | read alias | write column | column type |
|---|---|---|---|
| `id` | `id` | `id` | `text` |
| `vehicleId` | `vehicle_id as "vehicleId"` | `vehicle_id` | `text` |
| `date` | `date::text as date` | `date` | `date` |
| `category` | `category` | `category` | `text not null default ''` |
| `amount` | `amount::float8 as amount` | `amount` | `numeric(12,2)` — **the cast is mandatory**, pg returns numeric as a string |
| `note?` | `note` | `note` | `text` (nullable, dropped by `dropNulls`) |
| `receipt?` | `receipt` | `receipt` | `text` (nullable) |

- [ ] **Step 1: Write the migration**

Create `server/migrations/019_garage_costs.sql`:

```sql
-- Garaj: a running cost that is neither a service, an energy fill, nor a document — a saman, a
-- Touch 'n Go reload, a dashcam. The Costs tab claimed to answer "what does this vehicle cost
-- me" and structurally could not include any of them.
--
-- Deliberately NO odo column. Every other record carrying one feeds the derived odometer, which
-- is a maximum across readings; a parking receipt's mileage is incidental and would move it for
-- no reason. See the Cost interface in src/lib/garage.ts for the same note from the other side.
--
-- `category` is free text over an editable list — the list itself lives in garage_presets under
-- the reserved type_key '_cost_categories'. An enum here would mean a migration every time
-- someone wants to track something new.
--
-- Same composite foreign key onto garage_vehicles every other child table carries: a vehicle
-- delete cascades its costs, matching withoutVehicle() on the client.
create table garage_costs (
  user_id    uuid not null,
  id         text not null,
  vehicle_id text not null,
  date       date not null,
  category   text not null default '',
  amount     numeric(12,2) not null default 0,
  note       text,
  receipt    text,                              -- downscaled data URL, same as a service receipt
  pos        integer not null default 0,
  primary key (user_id, id),
  foreign key (user_id, vehicle_id) references garage_vehicles(user_id, id) on delete cascade
);

create index garage_costs_vehicle_idx on garage_costs (user_id, vehicle_id);
```

- [ ] **Step 2: Write the failing test**

Replace the `garage_records: read(write(blob)) === blob, against a real parent vehicle` test in `server/tools.test.ts` (lines 299-326) with this — it is the same test plus the costs collection:

```ts
  test('garage_records: read(write(blob)) === blob, against a real parent vehicle', async () => {
    const blob = {
      services: [
        {
          id: 'svc0001', vehicleId: 'gvh0001', date: '2026-05-14', odo: 84210,
          items: [{ label: 'Minyak hitam', cost: 180 }, { label: 'Filter', cost: 88.5 }],
          workshop: 'Bengkel Pak Din', notes: 'servis biasa', receipt: 'data:image/jpeg;base64,UkNQVA==',
        },
        // items empty, every optional field absent.
        { id: 'svc0002', vehicleId: 'gvh0001', date: '2026-01-08', odo: 12000, items: [] },
      ],
      docs: [
        // Recognised type, every optional field present, cost a real decimal.
        {
          id: 'doc0001', vehicleId: 'gvh0001', type: 'insurance', expiry: '2027-03-01',
          issued: '2026-03-01', cost: 12.34, note: 'comprehensive', receipt: 'data:image/jpeg;base64,AAAA',
        },
        { id: 'doc0002', vehicleId: 'gvh0001', type: 'other', expiry: '2026-12-31' },
      ],
      costs: [
        // A decimal amount is what catches a missing ::float8 cast: pg hands numeric back as the
        // STRING '45.60', and deepStrictEqual will not call that 45.6.
        {
          id: 'cst0001', vehicleId: 'gvh0001', date: '2026-06-02', category: 'Tol & parkir',
          amount: 45.6, note: 'PLUS ke Ipoh', receipt: 'data:image/jpeg;base64,QkJCQg==',
        },
        // Every optional field absent, and an amount of exactly 0 — must come back as 0, not be
        // dropped alongside the fields that really are missing.
        { id: 'cst0002', vehicleId: 'gvh0001', date: '2026-06-09', category: 'Saman', amount: 0 },
      ],
    };
    const readBack = await tx(async (q) => {
      await q(`insert into garage_vehicles (user_id, id) values ($1, 'gvh0001')
                on conflict (user_id, id) do nothing`, [userId]);
      await TOOLS.garage_records.write(q, userId, blob);
      return TOOLS.garage_records.read(q, userId);
    });
    assert.deepStrictEqual(readBack, blob);
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:server`
Expected: FAIL — the read comes back without a `costs` key, so `deepStrictEqual` reports a missing property. (If `DATABASE_URL` is unset the suite skips; attach a database before running this task, or the server tasks verify nothing.)

- [ ] **Step 4: Write the implementation**

In `server/tools.ts`, replace the `garage_records` descriptor (lines 552-582) with:

```ts
  garage_records: {
    async read(q, uid) {
      const { rows: services } = await q(
        `select id, vehicle_id as "vehicleId", date::text as date, odo, items,
                workshop, notes, receipt
           from garage_services where user_id = $1 order by pos`, [uid]);
      const { rows: docs } = await q(
        `select id, vehicle_id as "vehicleId", type, expiry::text as expiry,
                issued::text as issued, cost::float8 as cost, note, receipt
           from garage_documents where user_id = $1 order by pos`, [uid]);
      // Costs ride this key rather than garage_logs because they can carry a receipt photo, and
      // this is the key already split out for photo weight.
      const { rows: costs } = await q(
        // amount::float8 for the same reason documents.cost is cast: numeric comes back as a
        // STRING from pg, and Cost.amount is a number on the client.
        `select id, vehicle_id as "vehicleId", date::text as date, category,
                amount::float8 as amount, note, receipt
           from garage_costs where user_id = $1 order by pos`, [uid]);
      return { services: dropNulls(services), docs: dropNulls(docs), costs: dropNulls(costs) };
    },
    async write(q, uid, blob) {
      await q('delete from garage_services where user_id = $1', [uid]);
      await insertMany(q, 'garage_services',
        ['user_id', 'id', 'vehicle_id', 'date', 'odo', 'items', 'workshop', 'notes', 'receipt', 'pos'],
        arr(blob?.services).map((s, i) => [
          uid, String(s.id), String(s.vehicleId), s.date, num(s.odo),
          JSON.stringify(arr(s.items)), s.workshop ?? null, s.notes ?? null, s.receipt ?? null, i,
        ]));

      await q('delete from garage_documents where user_id = $1', [uid]);
      await insertMany(q, 'garage_documents',
        ['user_id', 'id', 'vehicle_id', 'type', 'expiry', 'issued', 'cost', 'note', 'receipt', 'pos'],
        arr(blob?.docs).map((d, i) => [
          uid, String(d.id), String(d.vehicleId),
          ['roadtax', 'insurance', 'puspakom', 'warranty', 'other'].includes(d.type) ? d.type : 'other',
          d.expiry, d.issued ?? null, d.cost ?? null, d.note ?? null, d.receipt ?? null, i,
        ]));

      await q('delete from garage_costs where user_id = $1', [uid]);
      await insertMany(q, 'garage_costs',
        ['user_id', 'id', 'vehicle_id', 'date', 'category', 'amount', 'note', 'receipt', 'pos'],
        arr(blob?.costs).map((c, i) => [
          uid, String(c.id), String(c.vehicleId), c.date, String(c.category ?? ''),
          num(c.amount), c.note ?? null, c.receipt ?? null, i,
        ]));
    },
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:server`
Expected: PASS. The migration applies on the first `migrate()` call inside the suite's `before` hook; watch for `migrated 019_garage_costs.sql` in the output.

Then confirm the boot path too — Run: `npm run dev:server`, expect the migration logged with no SQL error, then Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/019_garage_costs.sql server/tools.ts server/tools.test.ts
git commit -m "Give a cost a table and a place in the records blob"
```

---

### Task 4: Logging a cost — the sheet, the fifth segment, quick-add and Recent

**Prose-specified.** Precise field lists, validation and prop shapes below; the JSX is yours, matching the file it lands in.

**Files:**
- Modify: `src/pages/garage/logSheets.tsx` (append `CostSheet`)
- Modify: `src/pages/garage/VehicleDetail.tsx:20, 84-89, 173-186` and append `CostsPane`
- Modify: `src/pages/garage/Overview.tsx:37-42, 84-92, 156-183, 188, 211-221, 235-267`

**Interfaces:**
- Consumes: `Cost`, `GarageData`, `upsert`, `removeById`, `todayISO` from `src/lib/garage`; `COST_CATEGORY_KEY`, `costCategories` from `src/lib/garage-presets`; `Sheet`, `chip`, `fieldLabel`, `generateId`, `Row`, `AddButton`, `Empty`, `fmtRM`, `niceDate` from `./parts`; `downscaleFile` from `src/lib/downscale`.
- Produces:
  ```ts
  export function CostSheet(props: {
    open: boolean;
    vehicle: Vehicle;
    data: GarageData;
    /** Absent (or null) means logging a new cost. */
    cost?: Cost | null;
    onClose: () => void;
    onSave: (cost: Cost) => void;
    onDelete?: (id: string) => void;
  }): JSX.Element
  ```
  and `Segment` in `VehicleDetail.tsx` becomes `'service' | 'fuel' | 'remind' | 'docs' | 'other'`.

- [ ] **Step 1: Build `CostSheet` in `src/pages/garage/logSheets.tsx`**

Same skeleton as `DocumentSheet` in the same file. Header: `vehicle` and `sub={vehicle.nickname || vehicle.model}` on `Sheet`, so a cost can never be filed against the wrong car. Title `cost ? t('Sunting kos', 'Edit cost') : t('Log kos', 'Log a cost')`. `submitLabel={t('Simpan', 'Save')}`. `extra` is the same `Trash2` button pattern when `cost && onDelete`, confirming with `t('Padam kos ini?', 'Delete this cost?')`.

Fields, in this order:

1. **Category** — `fieldLabel` reading `t('Kategori', 'Category')`. A `chip(category === c)` row over `costCategories(preset?.customs, preset?.hidden)` where `const preset = data.presets[COST_CATEGORY_KEY]`, followed by a free-text `input.input-field` bound to the same state with placeholder `t('atau taip sendiri', 'or type your own')` — exactly the grade field's shape in `EnergySheet` (`logSheets.tsx:144-155`).
2. **Date** — `<input type="date">`, default `cost?.date ?? todayISO()`, label `t('Tarikh', 'Date') + ' *'`.
3. **Amount** — `<input type="number" inputMode="decimal" min="0" step="0.01" className="input-field w-full font-mono" style={num}>`, label `t('Jumlah (RM)', 'Amount (RM)') + ' *'`.
4. **Note** — plain input, label `t('Nota', 'Note')`, placeholder `t('cth. saman JPJ', 'e.g. JPJ summons')`.
5. **Receipt** — copy `DocumentSheet`'s receipt block verbatim but with `id="cost-receipt"`: hidden file input, `downscaleFile(file, 900)`, preview at `h-28` with `object-contain bg-text/5`, remove button `className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#000000]/50 text-[#ffffff]/80 hover:text-[#ffffff] backdrop-blur-md"` (literal hex, never the tokens).

Add a comment above the fields saying there is deliberately **no odometer field**, and why (see the `Cost` interface).

Validation in `submit()`, in this order, each setting `error` and returning:
- `!date` → `t('Sila pilih tarikh', 'Pick a date')`
- `!category.trim()` → `t('Pilih atau taip kategori', 'Pick or type a category')`
- `amount.trim() === '' || !Number.isFinite(n) || n <= 0` → `t('Masukkan jumlah yang sah', 'Enter a valid amount')` (a zero-value cost is a record with nothing in it; `> 0`, not `>= 0`)

The error paragraph is the file's existing `className="text-sm text-rose-500 light:text-rose-700 font-medium"`, placed after the amount field.

On success:

```ts
onSave({
  id: cost?.id ?? generateId(),
  vehicleId: vehicle.id,
  date,
  category: category.trim(),
  amount: amountNum,
  note: note.trim() || undefined,
  receipt: receipt || undefined,
});
```

- [ ] **Step 2: Add the fifth segment to `VehicleDetail.tsx`**

- Widen `Segment` to include `'other'`.
- Import `Receipt` from `lucide-react` and append `['other', t('Lain-lain', 'Other'), Receipt]` to `SEGMENTS`.
- The segmented row's `grid-cols-4` becomes `grid-cols-5` (line 173). Five fits — Expense Manager already runs five top-level tabs at this width. Keep `py-2 text-[10px]` and the icon at `size={16}`.
- Render `{seg === 'other' && <CostsPane vehicle={vehicle} data={data} setData={setData} />}`.
- New `CostsPane`, modelled on `ServicePane` in the same file: its own `sheetOpen`/`editing` state, `AddButton` labelled `t('Log kos', 'Log a cost')`, and the list
  ```ts
  const list = data.costs.filter((c) => c.vehicleId === vehicle.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  ```
  each rendered as `<Row title={c.category} sub={[niceDate(c.date), c.note].filter(Boolean).join(' · ')} amount={fmtRM(c.amount)} onClick={() => openEdit(c)} />`. `fmtRM`, not `fmtRM0` — this is the exact figure the owner typed, the same call `EnergyPane` makes for a fill's cost.
  Empty state: `<Empty title={t('Belum ada kos lain', 'No other costs yet')} hint={t('Saman, tol, aksesori, cuci kereta — ketik "Log kos" untuk mula.', 'Summonses, tolls, accessories, car wash — tap "Log a cost" to get started.')} />`.
  Handlers: `setData((d) => ({ ...d, costs: upsert(d.costs, cost) }))` and `setData((d) => ({ ...d, costs: removeById(d.costs, id) }))`, both closing the sheet — new objects, per the shell's mount-write contract.
  `<CostSheet key={sheetOpen ? (editing?.id ?? 'new') : 'closed'} ... />`, the same remount-on-open idiom every other sheet in the file uses.
- The stat strip at the top needs **no change**: `spend12` reads `.total`, which now includes `other`. That is the intended behaviour — add a one-line comment saying so, because a reader will otherwise wonder whether it was missed.

- [ ] **Step 3: Add the sixth quick-add row and costs in Recent, in `Overview.tsx`**

- `QuickAddAction` gains `'cost'`; add a sixth entry after `doc`:
  ```ts
  { key: 'cost', title: t('Log kos', 'Log a cost'),
    hint: t('Saman, tol, aksesori, cuci kereta', 'Summonses, tolls, accessories, car wash') },
  ```
  and route it in `onPick` to `setCostOpen(true)`.
- New `const [costOpen, setCostOpen] = useState(false)` and
  ```ts
  const handleSaveCost = (cost: Cost) => {
    setData((d) => ({ ...d, costs: upsert(d.costs, cost) }));
    setCostOpen(false);
  };
  ```
  with `<CostSheet key={costOpen ? selected.id : 'closed'} open={costOpen} vehicle={selected} data={data} onClose={() => setCostOpen(false)} onSave={handleSaveCost} />` beside the other five.
- `RecentRow.kind` gains `'cost'`, and `mergeRecent` gains a fourth branch in the same `flatMap` shape as the others:
  ```ts
  const costs: RecentRow[] = data.costs.flatMap((c: Cost) => {
    const vehicle = byId.get(c.vehicleId);
    if (!vehicle) return [];
    return [{ id: c.id, date: c.date, kind: 'cost' as const, vehicle,
      title: c.category, amount: fmtRM(c.amount) }];
  });
  ```
  and the final `return [...services, ...energy, ...odo, ...costs].sort(...)`.

- [ ] **Step 4: Verify**

Run: `npx tsc -b --noEmit` — clean.
Run: `npm run lint` — clean.
Run: `npm run build` — clean.
Run: `npm test` — PASS (unchanged; this task adds no logic to test).

Manual check in `npm run dev`: log a cost from the quick-add sheet, see it appear in Recent and on the vehicle's **Lain-lain** pane, edit its amount, delete it. Confirm the vehicle's 12-month stat moves by the amount logged.

- [ ] **Step 5: Commit**

```bash
git add src/pages/garage/logSheets.tsx src/pages/garage/VehicleDetail.tsx src/pages/garage/Overview.tsx
git commit -m "Log the costs the tool could not see: saman, tol, aksesori"
```

---

### Task 5: The fourth chart segment, and an editor for the category list

**Prose-specified.**

**Files:**
- Modify: `src/pages/garage/Costs.tsx:15-22, 36-55, 66-124, 144-174`
- Modify: `src/pages/garage/Settings.tsx:34-74, 111-155`

**Interfaces:**
- Consumes: `COST_CATEGORY_KEY`, `DEFAULT_COST_CATEGORIES`, `costCategories`, `defaultPresets`, `presetsFor`, `typeKey`.
- Produces: a local `PresetEditor` component inside `Settings.tsx` (not exported):
  ```tsx
  function PresetEditor(props: {
    storeKey: string;              // typeKey(body, energy) or COST_CATEGORY_KEY
    defaults: string[];            // the code-owned list this editor hides from
    resolved: string[];            // defaults + customs − hidden, already computed by the caller
    hidden: string[];              // only to decide whether "Restore defaults" shows
    addPlaceholder: string;
    setData: React.Dispatch<React.SetStateAction<GarageData>>;
  }): JSX.Element
  ```

- [ ] **Step 1: Fourth segment in `Costs.tsx`**

- `type Cat = 'service' | 'energy' | 'docs' | 'other'` and a fourth `CATS` entry:
  ```ts
  { key: 'other', ms: 'Lain-lain', en: 'Other', bar: 'bg-slate-400' },
  ```
  **`bg-slate-400` deliberately**: sky/amber/violet are taken, and rose, emerald and amber are the status traffic light — a rose "Other" segment would read as an alert. Slate reads as the neutral leftover, which is what this bucket is.
- `MonthBucket` gains `other: number`; the `byKey` seed gains `other: 0`; `buildMonths` gains a fourth loop bucketing `data.costs` on `c.date.slice(0, 7)` (its own date — no `issued || expiry` subtlety, unlike documents).
- `totals`, `maxTotal`, `grandTotal` and the per-month `monthTotal` all include `m.other`. The legend row already maps `CATS`, so it picks the fourth up for free.
- **Archived vehicles stay in this tab**, both in the chart (the loops are fleet-wide over `data.costs` etc., so this is already true) and in the by-vehicle list — the spec's rule table says the Costs chart, its 12-month totals and the per-vehicle list all keep counting a sold car. `VehicleCostRow` gains a `<SoldTag />` (Task 8 adds it to `parts.tsx`; if Task 8 has not landed yet, land the tag in this task instead and delete the duplicate later) beside the name when `vehicle.archived`.

- [ ] **Step 2: One editor, two lists, in `Settings.tsx`**

Today `patchPreset`, `removeDefault`, `removeCustom`, `restoreDefaults`, `addCustom` and the list markup are all hard-wired to `typeKey(body, energy)`. Lift them into the local `PresetEditor` above, parameterised by `storeKey` and `defaults`, and render it twice:

1. Under the existing body/energy chips, with `storeKey={key}`, `defaults={defaultPresets(body, energy)}`, `resolved={presetsFor(body, energy, customs, hidden)}`, `hidden={hidden}`, `addPlaceholder={t('Tambah item...', 'Add an item...')}`. Heading unchanged: `t('Senarai semak servis', 'Service checklist')`.
2. A new section above the danger zone, heading `t('Kategori kos', 'Cost categories')` with a one-line hint `t('Dikongsi oleh semua kenderaan.', 'Shared by every vehicle.')`, with `storeKey={COST_CATEGORY_KEY}`, `defaults={DEFAULT_COST_CATEGORIES}`, `resolved={costCategories(costPreset?.customs, costPreset?.hidden)}` where `const costPreset = data.presets[COST_CATEGORY_KEY]`, `hidden={costPreset?.hidden ?? []}`, `addPlaceholder={t('Tambah kategori...', 'Add a category...')}`.

`PresetEditor` keeps every behaviour the checklist editor has today, verbatim, just reading `storeKey` and `defaults` instead of closing over them:
- `patchPreset` reads the **current** row out of `d` inside the updater (`d.presets[storeKey] ?? { customs: [], hidden: [] }`), never the render's closure — the reason is already commented at `Settings.tsx:34-36`.
- A **default** row's X hides it (`hidden`); a **custom** row's X deletes it. `isDefault` is `defaults.includes(label)`. The Default/Custom tag stays.
- `addCustom` keeps the guard at `Settings.tsx:65-69` unchanged in meaning: check against the **unfiltered** `defaults` list, and typing a hidden default's exact name back in un-hides it rather than creating an unreachable custom. That guard is what a review already caught once; do not simplify it away.
- "Restore defaults" shows only when `hidden.length > 0`.
- Its own `input` state, `Enter` submits, `Add` button `min-w-[44px] min-h-[44px]`.

The danger-zone copy at `Settings.tsx:161-164` must gain "kos" / "costs" to the list of what a wipe removes.

- [ ] **Step 3: Verify**

Run: `npx tsc -b --noEmit`, `npm run lint`, `npm run build`, `npm test` — all clean/PASS.

Manual: add "Saman" as a category in Settings, confirm it appears as a chip in `CostSheet`; hide "Tol & parkir", confirm it disappears there and "Restore defaults" brings it back. Log costs in two different months and confirm the fourth (slate) segment and its legend total appear on the Costs tab.

- [ ] **Step 4: Commit**

```bash
git add src/pages/garage/Costs.tsx src/pages/garage/Settings.tsx
git commit -m "Show other costs in the chart, and let the category list be edited"
```

---

### Task 6: A sold vehicle stops being asked about

**Code-complete.**

**Files:**
- Modify: `src/lib/garage.ts` (the `Vehicle` interface; append two helpers; one line in `dueItems`)
- Test: `src/lib/garage.test.ts` (append)

**Interfaces:**
- Consumes: `Vehicle`, `GarageData`, `dueItems` as they exist.
- Produces: `Vehicle.archived?: boolean`, `Vehicle.archivedAt?: string`; `activeVehicles(d: GarageData): Vehicle[]`; `archivedVehicles(d: GarageData): Vehicle[]`.

**Constraint held explicitly:** `currentOdo`, `economy` and `costPerKm` must stay correct for an archived vehicle — they take a `Vehicle` directly and never enumerate the fleet, so nothing about them changes. Only *lists* and *reminders* hide it. There is a test below asserting exactly that, because it is the easy thing to break later.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/garage.test.ts` (`dueItems`, `currentOdo`, `costPerKm`, `EMPTY_GARAGE`, `car`, `withLogs`, `fill` and `shift` are all already in scope; import only the two new names):

```ts
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

  test('asking for the archived vehicle by id still returns nothing', () => {
    const d = fleet({
      reminders: [{ id: 'r2', vehicleId: 'v2', label: 'Engine oil', done: false, dueDate: shift(3) }],
    });
    assert.deepEqual(dueItems(d, 'v2'), []);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `activeVehicles is not a function`, and once that is stubbed, the due-list test fails because `r2`/`d2` are still returned.

- [ ] **Step 3: Write the implementation**

In `src/lib/garage.ts`, add two fields to `Vehicle` (after `photo?`):

```ts
  /**
   * Sold. Absent, never `false` — the server reads this column as `case when archived then true
   * end` so a live vehicle carries no key at all, and a literal `false` here would come back
   * absent and read as a phantom edit on the next sync.
   */
  archived?: boolean;
  /** YYYY-MM-DD. Only meaningful when `archived`. */
  archivedAt?: string;
```

Append after `withoutVehicle` (or anywhere below `GarageData`):

```ts
/**
 * The fleet as the picker, the Vehicles grid and the quick-add sheet see it.
 *
 * Archive is not Delete: Delete means "I typed this by mistake" and cascades every child record;
 * Archive means "I sold it" and keeps all of it, stopping only the nagging. So this filters —
 * it never removes anything, and the Costs tab deliberately does not call it.
 */
export const activeVehicles = (d: GarageData): Vehicle[] => d.vehicles.filter((v) => !v.archived);

/** The other half, for the collapsed Dijual / Sold section. */
export const archivedVehicles = (d: GarageData): Vehicle[] => d.vehicles.filter((v) => v.archived);
```

In `dueItems`, change one line — the map both loops resolve their vehicle through, so a single filter closes both at once and any future third loop with it:

```ts
  // Archived vehicles are excluded here rather than in each loop: both the reminder and the
  // document pass below `continue` when byId misses, so dropping sold cars from the map is the
  // whole fix — and it covers the Home dashboard too, which reads this same function.
  const byId = new Map(activeVehicles(d).map((v) => [v.id, v]));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS. Then `npx tsc -b --noEmit`, `npm run lint`, `npm run build` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/garage.ts src/lib/garage.test.ts
git commit -m "Stop a sold car appearing in every list that asks what is due"
```

---

### Task 7: The archive columns, and three reminder arms that must not email a sold car

**Code-complete.**

**Files:**
- Create: `server/migrations/020_garage_archive.sql`
- Modify: `server/tools.ts:493-550` (the `garage_fleet` descriptor's read and write)
- Modify: `server/reminders.ts:56-96` (two `DUE_SQL` arms) and `server/reminders.ts:129-143` (the `MILEAGE_SQL` CTE)
- Test: `server/tools.test.ts:140-156` (fixture) and `server/reminders.test.ts:26-74` (fixtures) + one new test

**Interfaces:**
- Consumes: `Vehicle.archived` / `archivedAt` from Task 6.
- Produces: `garage_vehicles.archived boolean not null default false`, `garage_vehicles.archived_at date`; the `garage_fleet` blob's vehicles carry `archived?: true` and `archivedAt?: string`.

**`reminder_sends` warning:** the dedup keys are composites — `id || ':' || due_date::text` for `garage_reminder` and `r.id || ':' || r.due_odo::text` for `garage_mileage`. The edits below add joins and predicates only; **do not touch those expressions**, in the select list or in the `left join reminder_sends` predicate, or a rolled-forward reminder silently stops firing.

- [ ] **Step 1: Write the migration**

Create `server/migrations/020_garage_archive.sql`:

```sql
-- Selling a car is ordinary. Until now the only option was Delete, which cascades every service,
-- document and log — and that history is worth keeping; it is also what you hand the buyer.
--
-- Additive only, per the convention in server/tools.ts: two nullable-in-effect columns, no data
-- touched. Every existing vehicle defaults to not archived, which is what it already was.
alter table garage_vehicles add column archived    boolean not null default false;
alter table garage_vehicles add column archived_at date;
```

- [ ] **Step 2: Write the failing tests**

In `server/tools.test.ts`, replace the `garage_fleet` fixture (lines 140-156) so one vehicle is archived and the other carries neither key — the absent case is what proves the `case when ... then true end` read:

```ts
  garage_fleet: {
    vehicles: [
      {
        id: 'gvh0001', body: 'sedan', energy: 'petrol', model: 'Camry', mileage: 45210,
        brand: 'Toyota', nickname: 'Kereta Ayah', plate: 'ABC 1234', year: 2021,
        engine: 2.5, capacity: 50, photo: 'data:image/jpeg;base64,GGGG',
        colorIdx: 3, createdAt: 1767225600000,
      },
      // Every optional detail absent, and mileage/colorIdx a genuine 0 — must come back as 0,
      // not be dropped as a falsy value alongside the fields that really are missing. `archived`
      // is absent here on purpose: the column is NOT NULL, so a bare `select archived` would
      // return false, dropNulls would keep it, and this blob would come back with a key it never
      // sent. The read casts it through `case when archived then true end` for that reason.
      { id: 'gvh0002', body: 'motorcycle', energy: 'petrol', model: 'RS150R', mileage: 0, colorIdx: 0, createdAt: 1767312000000 },
      // Sold. Both archive fields present.
      {
        id: 'gvh0003', body: 'hatchback', energy: 'petrol', model: 'Saga', mileage: 120000,
        colorIdx: 1, createdAt: 1735689600000, archived: true, archivedAt: '2026-06-30',
      },
    ],
    presets: {
      'sedan:petrol': { customs: ['Timing belt'], hidden: ['Wipers'] },
      'motorcycle:petrol': { customs: [], hidden: [] },
    },
  },
```

In `server/reminders.test.ts`, append to the `before` hook (after the existing `garage_documents` insert at line 73):

```ts
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
```

and add this test:

```ts
  test('an archived vehicle stops emailing entirely, on all three arms', async () => {
    const ids = (await dueReminders()).filter((r) => r.userId === userId).map((r) => r.recordId);
    assert.ok(!ids.some((id) => id.startsWith('soldDate')), 'no dated reminder for a sold car');
    assert.ok(!ids.some((id) => id.startsWith('soldKm')), 'no mileage reminder either');
    assert.ok(!ids.includes('soldDoc'),
      'and no document — the arm that did not join garage_vehicles at all before this');
  });
```

The existing `returns only records at 30, 7 and 1 days out` test already asserts the complete sorted id list for this user, so it fails too until the filters land — which is the point: it is the regression guard.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:server`
Expected: FAIL — the archived vehicle's `soldDate`, `soldKm` and `soldDoc` all appear in the due set, and the `garage_fleet` round trip comes back without `archived`/`archivedAt`.

- [ ] **Step 4: Write the implementation**

**`server/tools.ts` — `garage_fleet.read`,** replacing the vehicles query (lines 495-502):

```ts
      const { rows: vehicles } = await q(
        // created_at is bigint (OID 20): pg returns those as strings unless cast, and
        // Vehicle.createdAt is a number on the client — vehicle_assets.created_at hit the same
        // thing and is cast the same way.
        //
        // archived is read as `case when ... then true end`, NOT as a bare column: it is NOT
        // NULL, dropNulls only drops nulls, and a bare read would therefore add `archived: false`
        // to every vehicle a client sent without one — a field the blob never had, which the
        // deepStrictEqual round-trip test is there to catch. Same idiom as
        // home_service_events.next_done.
        `select id, body, energy, model, mileage, brand, nickname, plate, year,
                engine::float8 as engine, capacity::float8 as capacity, photo,
                color_idx as "colorIdx", created_at::float8 as "createdAt",
                case when archived then true end as archived,
                archived_at::text as "archivedAt"
           from garage_vehicles where user_id = $1 order by pos`, [uid]);
```

**`garage_fleet.write`,** the column list and row mapper (lines 529-537):

```ts
      await insertMany(q, 'garage_vehicles',
        ['user_id', 'id', 'body', 'energy', 'model', 'mileage', 'brand', 'nickname', 'plate',
          'year', 'engine', 'capacity', 'photo', 'color_idx', 'created_at', 'archived',
          'archived_at', 'pos'],
        arr(blob?.vehicles).map((v, i) => [
          uid, String(v.id), String(v.body ?? 'sedan'), String(v.energy ?? 'petrol'),
          String(v.model ?? ''), num(v.mileage), v.brand ?? null, v.nickname ?? null,
          v.plate ?? null, v.year ?? null, v.engine ?? null, v.capacity ?? null,
          v.photo ?? null, num(v.colorIdx), num(v.createdAt),
          v.archived === true, v.archivedAt ?? null, i,
        ]));
```

The upsert-then-prune above it is unchanged and must stay that way — a wholesale delete here still cascades every child row.

**`server/reminders.ts` — the two `DUE_SQL` garage arms** (lines 56-89), replacing them with these (every column now qualified, because joining `garage_vehicles` makes bare `id` and `user_id` ambiguous):

```sql
  union all
  -- Garaj reminders owed by date. Unlike the service-event arm this replaces, there is no
  -- distinct-on: a reminder is an explicit row the owner created and closed, not the tail of a
  -- log that has to be de-duplicated by title.
  --
  -- record_id carries the due_date, not just id: rollForward (src/lib/garage.ts) advances a
  -- repeating reminder's dueDate in place on the SAME row rather than creating a new one, so id
  -- alone would let reminder_sends treat "fired for the Feb due date" as still true for the
  -- August due date it rolled to. Folding due_date into the key makes each occurrence, not each
  -- row, the thing that dedups. DO NOT reduce this to a bare id.
  --
  -- The join exists for `not v.archived` alone: a car sold last year must stop emailing about
  -- its road tax. The foreign key guarantees the vehicle row exists, so this can never drop a
  -- reminder that should have fired.
  select r.user_id, 'garage_reminder', r.id || ':' || r.due_date::text,
         coalesce(nullif(r.label, ''), 'Servis'),
         r.due_date, '/vehicle-services'
    from garage_reminders r
    join garage_vehicles v on v.user_id = r.user_id and v.id = r.vehicle_id
   where r.due_date is not null and not r.done and not v.archived
  union all
  -- Named exactly the way the client does (DOC_LABELS in src/lib/garage.ts), not rederived with
  -- initcap — that would give "Road Tax" where the client renders "Road tax", and the same
  -- record must not read differently in a notification than it does on screen. note is folded
  -- in the same way custom_title is above, for the same reason: it is what disambiguates "Other".
  --
  -- record_id is bare id here, unlike the two garage arms around it — a renewed document keeps
  -- its id AND its old dedup key, so it will not re-fire after renewal. That is a real,
  -- pre-existing gap (src/pages/DocumentExpiry.tsx renews every document type in place, not just
  -- garage's), not something introduced here, so it is left alone rather than fixed for garage
  -- only.
  --
  -- This arm did not join garage_vehicles at all before the archive change. It does now, and
  -- that join is the whole reason a sold car's road tax finally goes quiet.
  select doc.user_id, 'garage_document', doc.id,
         (case doc.type
            when 'roadtax'   then 'Road tax'
            when 'insurance' then 'Insurance'
            when 'puspakom'  then 'Puspakom'
            when 'warranty'  then 'Warranty'
            else 'Other'
          end) || coalesce(' · ' || nullif(doc.note, ''), ''),
         doc.expiry, '/vehicle-services'
    from garage_documents doc
    join garage_vehicles veh on veh.user_id = doc.user_id and veh.id = doc.vehicle_id
   where not veh.archived
```

**`MILEAGE_SQL`'s `odo` CTE** (line 142) gains one line — the CTE is the only path from `garage_reminders` to a vehicle in that query, so excluding archived vehicles here excludes their mileage reminders through the inner join below:

```sql
    from garage_vehicles v
   -- The third arm. Same rule as the two dated ones: a sold car's odometer target is nobody's
   -- business any more. Filtering in the CTE rather than at the join keeps it to one line and
   -- one place.
   where not v.archived
)
```

Leave the `record_id` expression (`r.id || ':' || r.due_odo::text`) and the `left join reminder_sends` predicate below it exactly as they are.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:server`
Expected: PASS, including `an archived vehicle stops emailing entirely, on all three arms`, the unchanged `returns only records at 30, 7 and 1 days out` list, and `a reminder that rolled forward to a new due date fires again (Item 1)` — that last one is the composite-key guard.

Run: `npm run dev:server` — expect `migrated 020_garage_archive.sql`, no SQL error, then Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add server/migrations/020_garage_archive.sql server/tools.ts server/tools.test.ts server/reminders.ts server/reminders.test.ts
git commit -m "Stop emailing a car that was sold last year"
```

---

### Task 8: Marking a vehicle sold, and finding it again

**Prose-specified.**

**Files:**
- Modify: `src/pages/garage/parts.tsx` (append `SoldTag`)
- Modify: `src/pages/garage/sheets.tsx:57-95, 97-110` (`VehicleSheet`)
- Modify: `src/pages/garage/Vehicles.tsx:108-137`
- Modify: `src/pages/garage/Overview.tsx:47-59, 272-311`
- Modify: `src/pages/garage/VehicleDetail.tsx:144-154`

**Interfaces:**
- Consumes: `activeVehicles`, `archivedVehicles`, `spend`, `currentOdo`, `todayISO`, `Vehicle.archived`/`archivedAt`.
- Produces: `export const SoldTag: () => JSX.Element` in `parts.tsx`.

- [ ] **Step 1: Stop `VehicleSheet` dropping the archive fields — do this first**

`VehicleSheet`'s `submit()` builds a **fresh** `Vehicle` literal (`sheets.tsx:69-82`) listing every field by hand. As written it would silently strip `archived` and `archivedAt` from any archived vehicle the owner merely edits — the exact "the next added field is dropped too" hazard the follow-ups list already flagged. Fix it in the same edit that introduces the fields:

- Extract the literal into `const build = (): Vehicle | null => { ...the existing validation..., return { ...same fields..., archived: vehicle?.archived, archivedAt: vehicle?.archivedAt }; }`, returning `null` when validation fails (after `setError`).
- `submit()` becomes `const v = build(); if (v) onSave(v);`.
- Add a comment naming the trap: this object is built field by field rather than spread from `vehicle`, so **every new optional field on `Vehicle` must be added here or it is lost on the next edit**.

- [ ] **Step 2: The archive control**

Inside `Sheet`'s children, as the last block before the form's own Save button, and only when `vehicle` is present (there is nothing to archive while creating one):

- Not archived → a full-width `type="button"` with `className="w-full py-3 rounded-xl border border-text/15 text-muted font-bold hover:bg-text/5 min-h-[44px]"` reading `t('Tandakan dijual', 'Mark as sold')`. On tap, confirm with
  `t(`Tandakan ${name} sebagai dijual? Semua rekodnya kekal, tetapi ia berhenti muncul dalam pemilih dan berhenti menghantar peringatan.`, `Mark ${name} as sold? All its records are kept, but it stops appearing in the picker and stops sending reminders.`)`
  where `name = vehicle.nickname || vehicle.model`. On confirm: `const v = build(); if (v) onSave({ ...v, archived: true, archivedAt: todayISO() })`.
  Building from the form, not from `vehicle`, means a pending nickname edit is not thrown away by tapping Archive — and it still validates.
- Archived → the same button reading `t('Pulihkan kenderaan', 'Restore vehicle')`, **no confirm** (restoring destroys nothing): `const v = build(); if (v) onSave({ ...v, archived: undefined, archivedAt: undefined })`.
  `undefined`, never `false` — the server reads the column as `case when archived then true end`, so a stored `false` would round-trip to absent and read as a phantom edit.
- Under the button, one line of `text-xs text-muted` explaining the difference from Delete, because both controls now live in this sheet:
  `t('Padam membuang semua rekodnya. Dijual menyimpan semuanya.', 'Delete removes all its records. Sold keeps everything.')`.

Delete stays exactly where it is, in `Sheet`'s `extra` slot.

- [ ] **Step 3: `SoldTag` in `parts.tsx`**

```tsx
/** Three call sites (the Vehicles list, the Costs rows, the detail header) and no reason for
 *  them to drift apart. Muted, never a status colour — sold is a fact, not an alert. */
export const SoldTag = () => {
  const t = useT();
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide bg-text/5 text-muted shrink-0">
      {t('Dijual', 'Sold')}
    </span>
  );
};
```

- [ ] **Step 4: The collapsed Sold section in `Vehicles.tsx`**

- `const active = activeVehicles(data)` and `const sold = archivedVehicles(data)`.
- The card grid maps `active`; the empty state triggers on `active.length === 0`.
- Below the grid, when `sold.length > 0`, a `<details className="group rounded-xl border border-text/10 mt-6">` using the same `summary` markup `VehicleSheet`'s "More details" disclosure uses (`list-none`, hidden webkit marker, `ChevronDown` rotating on `group-open`, `min-h-[44px]`). Summary text: `t('Dijual', 'Sold')` plus the count.
- Each row inside is a `<Row>`:
  - `title={v.nickname || v.model}`
  - `sub={[`${fmtKm(currentOdo(data, v))} km`, v.archivedAt ? `${t('dijual', 'sold')} ${niceDate(v.archivedAt)}` : null].filter(Boolean).join(' · ')}` — the final odometer and when it went
  - `amount={fmtRM0(spend(data, v.id).total)}` — lifetime spend, no `fromISO`
  - `onClick={() => openEdit(v)}` — the edit sheet is where Restore lives, which is what "can be restored from there" means
- New imports in this file: `activeVehicles`, `archivedVehicles`, `spend` from `../../lib/garage`; `Row`, `fmtRM0`, `niceDate` from `./parts`.

- [ ] **Step 5: Selection falls through, in `Overview.tsx`**

- `const fleet = activeVehicles(data);`
- `const selected = fleet.find((v) => v.id === vehicleId) ?? fleet[0];` — this is the whole of "selecting an archived vehicle is possible only by restoring it", reusing the fallback that already handled a deleted one. The existing effect at lines 48-50 then persists the fallen-through choice unchanged.
- The empty-state guard becomes `if (!selected)`, with a second hint when the garage is not actually empty:
  `data.vehicles.length > 0 ? t('Semua kenderaan anda ditandakan dijual. Pulihkan satu dari tab Kenderaan.', 'Every vehicle is marked sold. Restore one from the Vehicles tab.') : ` the existing hint.
- `VehiclePicker` filters `activeVehicles(data)` before its search filter.
- `mergeRecent` is **left alone**: the spec's rule table keeps a sold vehicle in Recent activity, and it already resolves vehicles through `data.vehicles`.

- [ ] **Step 6: The detail header, in `VehicleDetail.tsx`**

When `vehicle.archived`, render `<SoldTag />` beside the `typeLine` eyebrow and, under the name, `<p className="text-xs text-muted">{t(`Dijual ${niceDate(vehicle.archivedAt)}`, `Sold ${niceDate(vehicle.archivedAt)}`)}</p>` when `archivedAt` is set. Nothing else on the page changes — the cluster, economy and RM/km figures stay correct for a sold vehicle by design.

- [ ] **Step 7: Verify**

Run: `npx tsc -b --noEmit`, `npm run lint`, `npm run build`, `npm test` — all clean/PASS.

Manual: with two vehicles, mark one sold. Confirm it leaves the picker, the quick-add sheet and the Vehicles grid; that its overdue reminder disappears from **What's due** and from the Home dashboard; that it appears under **Dijual / Sold** with its final odometer and lifetime spend; that its row still shows on the Costs tab tagged Sold; and that restoring it from its edit sheet brings everything back. Then edit a sold vehicle's nickname and confirm it is still sold afterwards — that is the field-preservation fix.

- [ ] **Step 8: Commit**

```bash
git add src/pages/garage/parts.tsx src/pages/garage/sheets.tsx src/pages/garage/Vehicles.tsx src/pages/garage/Overview.tsx src/pages/garage/VehicleDetail.tsx
git commit -m "Sell a car without deleting its history"
```

---

### Task 9: A warranty on a fitted part creates its own reminder

**Code-complete.**

**Files:**
- Modify: `src/lib/garage.ts` (extract `ServiceItem`; append `warrantyReminders`, `upsertService`, `withoutService`)
- Modify: `src/pages/garage/sheets.tsx:256` (widen `items` state to `ServiceItem[]`)
- Test: `src/lib/garage.test.ts` (append)

**Interfaces:**
- Consumes: `Service`, `Reminder`, `GarageData`, `upsert`, `removeById`, `t`.
- Produces:
  ```ts
  export interface ServiceItem { label: string; cost: number; warrantyUntil?: string; warrantyKm?: number }
  export function warrantyReminders(service: Service): Reminder[]
  export function upsertService(d: GarageData, service: Service): GarageData
  export function withoutService(d: GarageData, serviceId: string): GarageData
  ```
  `Service.items` becomes `ServiceItem[]` — `{ label, cost }[]` stays assignable, so no existing call site breaks.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/garage.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `warrantyReminders is not a function`.

- [ ] **Step 3: Write the implementation**

In `src/lib/garage.ts`, extract the line-item type and point `Service` at it:

```ts
export interface ServiceItem {
  label: string;
  cost: number;
  /** A battery is eighteen months; tyres carry a tread warranty. YYYY-MM-DD. */
  warrantyUntil?: string;
  /** Counted from the service's OWN odometer reading, not from today — that is the reading the
   *  part was fitted at, and it is the only one that makes a distance warranty mean anything. */
  warrantyKm?: number;
}

export interface Service {
  id: string; vehicleId: string;
  date: string; odo: number;
  items: ServiceItem[];
  workshop?: string;
  notes?: string;
  receipt?: string;
}
```

Append below `upsert`/`removeById`:

```ts
/** Everything a service's own warranty reminders are keyed under. Prefix, not exact id, because
 *  the item label is part of the key and the save path drops them all before rebuilding. */
const warrantyPrefix = (serviceId: string) => `${serviceId}:w:`;

/**
 * The reminders a service's warranties own.
 *
 * Entering a warranty end date has no other purpose in this tool, so asking "would you like a
 * reminder for that?" would be asking someone to confirm what they just said. It is created
 * outright — unlike the service-interval suggestion, which still prompts, because an interval is
 * an inference and a warranty is a fact the owner typed.
 *
 * The id is deterministic (`<serviceId>:w:<label>`), which is what makes the drop-then-rebuild in
 * upsertService converge: removing an item, renaming it, or clearing its dates all reach the
 * right answer without the save path having to work out what changed.
 *
 * The label is frozen in whichever language it was saved in, like every other stored label in the
 * app — re-saving the service rebuilds it in the current one.
 */
export function warrantyReminders(service: Service): Reminder[] {
  return service.items
    .filter((i) => i.warrantyUntil || (Number(i.warrantyKm) || 0) > 0)
    .map((i) => ({
      id: `${warrantyPrefix(service.id)}${i.label}`,
      vehicleId: service.vehicleId,
      label: t(`Waranti: ${i.label}`, `Warranty: ${i.label}`),
      done: false,
      dueDate: i.warrantyUntil || undefined,
      dueOdo: (Number(i.warrantyKm) || 0) > 0 ? service.odo + Number(i.warrantyKm) : undefined,
      // No repeat: a warranty expires once.
    }));
}

/**
 * Save a service and rebuild the warranty reminders it owns, dropping every previous one first.
 * One function so `Overview` and `VehicleDetail`'s service pane cannot disagree about it — the
 * same reason `withoutVehicle` exists.
 */
export function upsertService(d: GarageData, service: Service): GarageData {
  const prefix = warrantyPrefix(service.id);
  const kept = d.reminders.filter((r) => !r.id.startsWith(prefix));
  return {
    ...d,
    services: upsert(d.services, service),
    // upsert rather than a plain concat: two line items sharing one label produce the SAME
    // deterministic id, and two rows with one id would fight over a single primary key on the
    // next sync. The drop above already guarantees no collision with what was there before.
    reminders: warrantyReminders(service).reduce((list, r) => upsert(list, r), kept),
  };
}

/** Deleting a service takes its warranty reminders with it. Deleting or archiving the vehicle
 *  takes them through the paths that already exist (`withoutVehicle`, and the archive filter in
 *  `dueItems`), so this is the only cascade the feature adds. */
export function withoutService(d: GarageData, serviceId: string): GarageData {
  const prefix = warrantyPrefix(serviceId);
  return {
    ...d,
    services: removeById(d.services, serviceId),
    reminders: d.reminders.filter((r) => !r.id.startsWith(prefix)),
  };
}
```

In `src/pages/garage/sheets.tsx`, widen the items state so nothing is dropped between this task and the next:

```ts
  const [items, setItems] = useState<ServiceItem[]>(service?.items ?? []);
```

adding `ServiceItem` to the existing `import { ... } from '../../lib/garage'` line.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS. Then `npx tsc -b --noEmit`, `npm run lint`, `npm run build` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/garage.ts src/lib/garage.test.ts src/pages/garage/sheets.tsx
git commit -m "Give a battery's eighteen months somewhere to live"
```

---

### Task 10: The warranty fields on a service line item

**Prose-specified.**

**Files:**
- Modify: `src/pages/garage/sheets.tsx:385-409` (`ServiceSheet`'s item list)
- Modify: `src/pages/garage/VehicleDetail.tsx:232-244` (`ServicePane`'s save/delete)
- Modify: `src/pages/garage/Overview.tsx:68-71` (`handleSaveService`)

**Interfaces:**
- Consumes: `ServiceItem`, `upsertService`, `withoutService` from Task 9.
- Produces: nothing new; `ServiceSheet`'s `onSave(service, reminder?)` signature is unchanged.

- [ ] **Step 1: Route every service save and delete through the new functions**

`VehicleDetail.tsx`'s `ServicePane`:

```ts
  const handleSave = (service: Service, reminder?: Reminder) => {
    setData((d) => {
      // upsertService rebuilds this service's warranty reminders; `reminder` is the separate,
      // prompted service-interval suggestion, which is appended rather than rebuilt because the
      // owner explicitly agreed to that one.
      const next = upsertService(d, service);
      return reminder ? { ...next, reminders: [...next.reminders, reminder] } : next;
    });
    setSheetOpen(false);
  };

  const handleDelete = (id: string) => {
    setData((d) => withoutService(d, id));
    setSheetOpen(false);
  };
```

`Overview.tsx`'s `handleSaveService` takes the identical body (it has no delete path). Swap the imports in both files from `upsert`/`removeById` usage on services to `upsertService`/`withoutService` — leave the other four record types' handlers alone.

- [ ] **Step 2: The per-item disclosure in `ServiceSheet`**

Today each selected item is one flex line: label · cost input · remove X (`sheets.tsx:387-398`). Keep that line exactly as it is and wrap each item in a container `<div>` carrying the existing `border-b border-text/10 last:border-b-0`, with a `<details>` beneath the line:

- `<summary>` styled like `VehicleSheet`'s "More details" summary but small (`text-xs text-muted`, `list-none`, hidden webkit marker, `min-h-[44px]`, `px-3.5 pb-2`): text `t('Waranti', 'Warranty')` when the item has none, and when it does, the same word plus what is set — e.g. `Waranti · 1 Aug 2027` / `Waranti · 40,000 km` / both joined with ` · ` — using `niceDate` and `fmtKm`. A collapsed row must still tell you it carries one; that is the point of putting it in the summary rather than behind an icon.
- Body: two fields side by side (`grid grid-cols-2 gap-3`):
  - `t('Waranti sehingga', 'Warranty until')` — `<input type="date">`
  - `t('Waranti (km)', 'Warranty (km)')` — `<input type="number" inputMode="numeric" min="0" step="1" className="input-field w-full font-mono" style={num}>`, `placeholder="40000"`
- One line of `text-xs text-muted` under them: `t('Simpan akan membuat peringatannya sendiri.', 'Saving creates its reminder automatically.')` — the reminder is created without a second prompt, and the form should say so before the fact rather than surprise afterwards.

The disclosure keeps the common case at exactly the number of taps it is today: closed by default, nothing else moves.

State updates go through one helper beside the existing `setCost`:

```ts
const setWarranty = (label: string, patch: Partial<ServiceItem>) =>
  setItems((prev) => prev.map((i) => (i.label === label ? { ...i, ...patch } : i)));
```

Normalise on change, not on submit, so clearing a field really clears it: an empty date field writes `warrantyUntil: undefined`, and a km field writes `warrantyKm: n > 0 ? n : undefined`. `undefined` rather than `0`/`''` matters — `warrantyReminders` treats a falsy value as "no warranty", and a stored `0` would sync as a field the server round-trips away.

Nothing else in `ServiceSheet` changes: `submit()` already passes `items` straight through, and the SUGGEST interval prompt at lines 310-332 stays exactly as it is — it prompts because an interval is an inference; the warranty does not because it is a fact.

- [ ] **Step 3: Verify**

Run: `npx tsc -b --noEmit`, `npm run lint`, `npm run build`, `npm test` — all clean/PASS.

Manual: log a service with a Battery item, open its warranty disclosure, set a date 40 days out. Save, then check the vehicle's **Peringatan** pane for `Waranti: Battery` due in ~6 weeks. Re-open the service, clear the date, save, and confirm the reminder is gone. Re-add it, rename the item, save, and confirm there is exactly one reminder carrying the new name. Delete the service and confirm the reminder goes with it while any hand-made reminder stays.

- [ ] **Step 4: Commit**

```bash
git add src/pages/garage/sheets.tsx src/pages/garage/VehicleDetail.tsx src/pages/garage/Overview.tsx
git commit -m "Set a part's warranty where you log the part"
```

---

### Task 11: The backup format — build it, and refuse a file that is not one

**Code-complete.** Last, because it serialises the final shape: `costs`, `archived` and the warranty fields are all in `GarageData` by now, so the format is written once.

**Files:**
- Modify: `src/lib/garage.ts` (append)
- Test: `src/lib/garage.test.ts` (append)

**Interfaces:**
- Consumes: every record interface plus `GarageData`, `EMPTY_GARAGE`, `t`.
- Produces:
  ```ts
  export const BACKUP_APP = 'garaj';
  export const BACKUP_VERSION = 1;
  export interface Backup {
    app: string; version: number; exportedAt: string;
    fleet: { vehicles: Vehicle[]; presets: Presets };
    records: { services: Service[]; docs: VDoc[]; costs: Cost[] };
    logs: { energy: EnergyLog[]; odo: OdoLog[]; reminders: Reminder[] };
  }
  export interface BackupCounts { vehicles: number; services: number; energy: number; docs: number; costs: number }
  export type BackupParse =
    | { ok: true; data: GarageData; counts: BackupCounts }
    | { ok: false; error: string };
  export function buildBackup(d: GarageData, now?: Date): Backup
  export function parseBackup(text: string): BackupParse
  ```

- [ ] **Step 1: Write the failing test**

Append to `src/lib/garage.test.ts`:

```ts
const { buildBackup, parseBackup, BACKUP_APP, BACKUP_VERSION } = await import('./garage.ts');

describe('buildBackup', () => {
  const full: GarageData = {
    ...EMPTY_GARAGE,
    vehicles: [car],
    presets: { 'sedan:petrol': { customs: ['Timing belt'], hidden: [] } },
    services: [{ id: 's1', vehicleId: 'v1', date: '2026-02-01', odo: 84000,
      items: [{ label: 'Battery', cost: 320, warrantyUntil: '2027-08-01' }] }],
    docs: [{ id: 'd1', vehicleId: 'v1', type: 'roadtax', expiry: '2027-01-01' }],
    costs: [{ id: 'c1', vehicleId: 'v1', date: '2026-01-05', category: 'Saman', amount: 150 }],
    energy: [fill('e1', '2026-01-01', 80000, 30, 60)],
    odo: [{ id: 'o1', vehicleId: 'v1', date: '2026-03-01', odo: 85000 }],
    reminders: [{ id: 'r1', vehicleId: 'v1', label: 'Road tax', done: false, dueDate: '2027-01-01' }],
  };

  test('carries the three sync blobs verbatim, under a stamped header', () => {
    const b = buildBackup(full, new Date('2026-08-17T09:30:00.000Z'));
    assert.equal(b.app, BACKUP_APP);
    assert.equal(b.version, BACKUP_VERSION);
    assert.equal(b.exportedAt, '2026-08-17T09:30:00.000Z');
    assert.deepEqual(b.fleet, { vehicles: full.vehicles, presets: full.presets });
    assert.deepEqual(b.records, { services: full.services, docs: full.docs, costs: full.costs });
    assert.deepEqual(b.logs, { energy: full.energy, odo: full.odo, reminders: full.reminders });
  });

  test('a file it wrote is a file it accepts, with nothing lost on the way', () => {
    const parsed = parseBackup(JSON.stringify(buildBackup(full)));
    assert.ok(parsed.ok);
    assert.deepStrictEqual(parsed.data, full);
    assert.deepEqual(parsed.counts,
      { vehicles: 1, services: 1, energy: 1, docs: 1, costs: 1 });
  });

  test('an empty garage round-trips too', () => {
    const parsed = parseBackup(JSON.stringify(buildBackup(EMPTY_GARAGE)));
    assert.ok(parsed.ok);
    assert.deepStrictEqual(parsed.data, EMPTY_GARAGE);
  });
});

describe('parseBackup rejects', () => {
  const good = JSON.parse(JSON.stringify(buildBackup(EMPTY_GARAGE)));
  const mangled = (fn: (b: Record<string, unknown>) => void) => {
    const b = JSON.parse(JSON.stringify(good));
    fn(b);
    return parseBackup(JSON.stringify(b));
  };

  test('something that is not JSON at all', () => {
    const r = parseBackup('not json {');
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.error.length > 0);
  });

  test('JSON that is not an object', () => {
    assert.equal(parseBackup('[1,2,3]').ok, false);
    assert.equal(parseBackup('null').ok, false);
  });

  test('another app\'s export', () => {
    assert.equal(mangled((b) => { b.app = 'expense-manager'; }).ok, false);
  });

  test('a version this build does not understand', () => {
    const r = mangled((b) => { b.version = 2; });
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.error.includes('2'), 'the message names the version it found');
  });

  test('a missing section', () => {
    assert.equal(mangled((b) => { delete b.records; }).ok, false);
    assert.equal(mangled((b) => { b.logs = 'nope'; }).ok, false);
  });

  test('a collection that is not a list', () => {
    const r = mangled((b) => { (b.records as Record<string, unknown>).costs = {}; });
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.error.includes('costs'), 'the message names which one');
  });

  test('presets that are not an object', () => {
    assert.equal(mangled((b) => { (b.fleet as Record<string, unknown>).presets = []; }).ok, false);
  });

  test('nothing partial is ever handed back — a rejection carries no data at all', () => {
    const r = mangled((b) => { delete b.logs; });
    assert.equal(r.ok, false);
    assert.equal('data' in r, false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `buildBackup is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/garage.ts`:

```ts
export const BACKUP_APP = 'garaj';
/** The only version the importer accepts. When this shape next changes, the importer gains a
 *  migration step for version 1 rather than silently accepting a file it will misread. */
export const BACKUP_VERSION = 1;

/**
 * The three sync blobs verbatim, under a header naming what wrote them.
 *
 * Verbatim on purpose: the format needs no separate mapping layer and cannot drift from what is
 * actually stored. Photos and receipts are included — that is what makes it a backup rather than
 * a summary, and the size cost is stated in the UI before the download starts.
 */
export interface Backup {
  app: string;
  version: number;
  exportedAt: string;
  fleet: { vehicles: Vehicle[]; presets: Presets };
  records: { services: Service[]; docs: VDoc[]; costs: Cost[] };
  logs: { energy: EnergyLog[]; odo: OdoLog[]; reminders: Reminder[] };
}

export function buildBackup(d: GarageData, now = new Date()): Backup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    fleet: { vehicles: d.vehicles, presets: d.presets },
    records: { services: d.services, docs: d.docs, costs: d.costs },
    logs: { energy: d.energy, odo: d.odo, reminders: d.reminders },
  };
}

/** What the confirm dialog counts out loud before replacing anything. */
export interface BackupCounts {
  vehicles: number; services: number; energy: number; docs: number; costs: number;
}

export type BackupParse =
  | { ok: true; data: GarageData; counts: BackupCounts }
  | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Validate a backup completely before anything is written, and hand back either the whole
 * garage or a reason and nothing else.
 *
 * Import REPLACES rather than merges — merge semantics for records with client-generated ids is
 * a genuine rabbit hole (same id with different content, same content with different ids, and no
 * way to tell an edit from a collision), and a backup that silently half-merges is worse than one
 * that refuses. Because it replaces, a half-accepted file would take the garage with it, which is
 * why every check below happens before a single field is read out.
 */
export function parseBackup(text: string): BackupParse {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: t('Fail ini bukan JSON yang sah.', 'This file is not valid JSON.') };
  }

  if (!isObj(raw) || raw.app !== BACKUP_APP) {
    return { ok: false, error: t('Ini bukan fail sandaran Garaj.', 'This is not a Garaj backup file.') };
  }
  if (raw.version !== BACKUP_VERSION) {
    return { ok: false, error: t(
      `Versi fail ${String(raw.version)} tidak disokong.`,
      `File version ${String(raw.version)} is not supported.`) };
  }

  const { fleet, records, logs } = raw;
  for (const [name, section] of [['fleet', fleet], ['records', records], ['logs', logs]] as const) {
    if (!isObj(section)) {
      return { ok: false, error: t(
        `Bahagian "${name}" hilang atau rosak.`,
        `Section "${name}" is missing or malformed.`) };
    }
  }
  // Narrowed by the loop above, which TypeScript cannot see through.
  const f = fleet as Record<string, unknown>;
  const r = records as Record<string, unknown>;
  const l = logs as Record<string, unknown>;

  const lists: [string, unknown][] = [
    ['vehicles', f.vehicles], ['services', r.services], ['docs', r.docs], ['costs', r.costs],
    ['energy', l.energy], ['odo', l.odo], ['reminders', l.reminders],
  ];
  for (const [name, value] of lists) {
    if (!Array.isArray(value)) {
      return { ok: false, error: t(`"${name}" bukan senarai.`, `"${name}" is not a list.`) };
    }
  }
  if (!isObj(f.presets)) {
    return { ok: false, error: t('"presets" hilang atau rosak.', '"presets" is missing or malformed.') };
  }

  // Shapes INSIDE each row are deliberately not validated. Every reader in the tool already
  // guards its own numbers (`Number(x) || 0`) because the same data round-trips through
  // localStorage and the sync API, so a malformed row degrades exactly as it would there —
  // whereas a per-field validator here would be a second copy of every interface to keep in step.
  const data: GarageData = {
    vehicles: f.vehicles as Vehicle[],
    presets: f.presets as Presets,
    services: r.services as Service[],
    docs: r.docs as VDoc[],
    costs: r.costs as Cost[],
    energy: l.energy as EnergyLog[],
    odo: l.odo as OdoLog[],
    reminders: l.reminders as Reminder[],
  };

  return {
    ok: true,
    data,
    counts: {
      vehicles: data.vehicles.length,
      services: data.services.length,
      energy: data.energy.length,
      docs: data.docs.length,
      costs: data.costs.length,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS. Then `npx tsc -b --noEmit`, `npm run lint`, `npm run build` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/garage.ts src/lib/garage.test.ts
git commit -m "Write the backup format down once, and refuse anything that is not it"
```

---

### Task 12: Download it, and put it back

**Prose-specified.**

**Files:**
- Modify: `src/pages/garage/Settings.tsx` (a new Backup section above the danger zone)

**Interfaces:**
- Consumes: `buildBackup`, `parseBackup`, `todayISO` from `src/lib/garage`.
- Produces: nothing exported.

- [ ] **Step 1: Export**

A section headed `t('Sandaran', 'Backup')` between the cost-category editor and the danger zone, in a `rounded-2xl border border-text/10 bg-surface p-4 space-y-3` card.

- Body copy, `text-xs text-muted`: `t('Memuat turun semua data Garaj sebagai satu fail JSON — termasuk setiap gambar dan resit, jadi fail ini boleh jadi besar.', 'Downloads all your Garaj data as one JSON file — including every photo and receipt, so this file can be large.')`. The size cost is stated **before** the download starts, per the spec.
- A full-width primary button `t('Muat turun sandaran', 'Download a backup')`, `className="w-full py-3 rounded-xl bg-primary text-[#ffffff] font-bold hover:opacity-90 min-h-[44px]"` (`text-[#ffffff]`, never `text-white` — `bg-primary` is fixed blue in both themes).
- Handler, reusing the download path already hardened for the legacy gate (`index.tsx:224-237`) exactly — anchor appended to the body, clicked, removed, `URL.revokeObjectURL` deferred to a `setTimeout`, because not every engine fires a click on a detached element:
  ```ts
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(buildBackup(data))], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `garaj-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  ```

- [ ] **Step 2: Import**

Below it in the same card, with a divider:

- A hidden `<input type="file" accept="application/json,.json" id="garaj-import" className="hidden">` plus a `<label htmlFor="garaj-import">` styled as the secondary control: `className="w-full py-3 rounded-xl border border-text/15 text-muted font-bold hover:bg-text/5 min-h-[44px] flex items-center justify-center cursor-pointer"`, reading `t('Pulihkan dari fail', 'Restore from a file')`.
- One line of `text-xs text-muted` beneath: `t('Memulihkan akan menggantikan semua data Garaj sedia ada.', 'Restoring replaces everything currently in Garaj.')`. The word "replace" appears in both languages, here and again in the confirm.
- `onChange` handler, in this exact order — validate, show, confirm, only then write:
  ```ts
  const file = e.target.files?.[0];
  e.target.value = '';                 // so picking the same file twice still fires
  if (!file) return;
  const result = parseBackup(await file.text());
  if (!result.ok) { setImportError(result.error); return; }
  setImportError('');
  const { vehicles, services, energy, docs, costs } = result.counts;
  const summary = t(
    `${vehicles} kenderaan · ${services} servis · ${energy} log minyak · ${docs} dokumen · ${costs} kos`,
    `${vehicles} vehicles · ${services} services · ${energy} fuel logs · ${docs} documents · ${costs} costs`);
  if (!window.confirm(t(
    `Fail ini mengandungi:\n${summary}\n\nMemulihkan akan MENGGANTIKAN semua data Garaj sedia ada. Teruskan?`,
    `This file contains:\n${summary}\n\nRestoring will REPLACE everything currently in Garaj. Continue?`))) return;
  // A new top-level object, so the shell's mount-write guard sees a real change and persists all
  // three keys; sync then carries it up normally.
  setData(() => result.data);
  ```
- `const [importError, setImportError] = useState('')`, rendered when set as `<p className="text-sm text-rose-500 light:text-rose-700 font-medium">{importError}</p>`. `parseBackup` already returns a bilingual reason naming what was wrong; render it as-is.

Nothing else in the file changes. The wipe control below stays exactly where it is.

- [ ] **Step 3: Verify**

Run: `npx tsc -b --noEmit`, `npm run lint`, `npm run build`, `npm test` — all clean/PASS.

Manual, in order: download a backup with at least one vehicle photo and one receipt; open the file and confirm the header (`app`, `version`, `exportedAt`) and all three sections are there with the photos inline. Wipe Garaj from the danger zone, then restore the file and confirm every vehicle, service, cost, log, reminder, document, photo and receipt is back and the sold/active split survived. Then try importing a text file, a `{}`, and a copy with `"version": 2` — each must be refused by name with nothing written.

- [ ] **Step 4: Commit**

```bash
git add src/pages/garage/Settings.tsx
git commit -m "Get years of Garaj history out of the app, and back into it"
```

---

## Self-review

### Spec coverage

| Spec section | Task |
|---|---|
| §1 `Cost` interface, no odometer field | 1 (interface + the "cannot move the odometer" test), 4 (the sheet's own comment) |
| §1 `garage_costs` table, composite FK, cascade | 3 |
| §1 joins the `garage_records` key, blob becomes `{ services, docs, costs }` | 3 (descriptor), 1 (shell wiring) |
| §1 `category` free string over an editable list, not a union | 1 (field type), 2 (`costCategories`) |
| §1 categories in `garage_presets` under `_cost_categories`, comment at both ends | 2 (client comment), 3 (migration comment) |
| §1 garage-wide, not per vehicle type | 2 (no body/energy arguments), 5 (one editor, no type chips above it) |
| §1 default `Tol & parkir` only | 2 |
| §1 `spend()` fourth bucket, every caller updated | 1 (with the caller audit table) |
| §1 chart's fourth stacked segment and legend row | 5 |
| §1 detail page's fifth segment `Lain-lain / Other` | 4 |
| §1 quick-add's sixth row | 4 |
| §1 Overview's Recent includes costs | 4 |
| §2 `archived` / `archivedAt` on `Vehicle`; `archived` + `archived_at` on the table | 6, 7 |
| §2 hidden from picker / Vehicles list / quick-add | 8 |
| §2 hidden from `dueItems()` — and therefore the dashboard | 6 |
| §2 hidden from `reminders.ts`, all three arms including `garage_document` | 7 |
| §2 still counted in the Costs chart, its 12-month totals, the per-vehicle list tagged Sold | 5 |
| §2 still counted in Recent activity | 8 (`mergeRecent` deliberately untouched) |
| §2 Archive and Delete both in the edit sheet, meaning different things | 8 |
| §2 collapsed Dijual / Sold section with name, final odometer, lifetime spend, restore | 8 |
| §2 selection falls through to the first non-archived vehicle | 8 |
| §3 `warrantyUntil` / `warrantyKm` on `ServiceItem` | 9 |
| §3 per line item behind a disclosure, common case unchanged | 10 |
| §3 reminder created on save with no extra prompt; label, dueDate, dueOdo, no repeat, deterministic id | 9 |
| §3 dropped-then-rebuilt so clearing/renaming/removing converge | 9 (four tests) |
| §3 deleting the service removes them; vehicle delete/archive covered by existing paths | 9 |
| §3 additive to, and separate from, the interval suggestion | 10 |
| §4 export shape, three blobs verbatim, photos included, size stated | 11, 12 |
| §4 hardened anchor download path | 12 |
| §4 import validates before touching anything, names what was wrong | 11 |
| §4 shows counts, then confirms stating "replace" in both languages | 12 |
| §4 replace not merge, written through `setData` | 12 |
| §4 version 1 only | 11 |

No section is unassigned. Two things the spec mentions that this plan deliberately does **not** do, both because the spec puts them out of scope: recurring costs, and merge-on-import.

### Placeholder scan

No `TBD`, no `TODO`, no "implement later", no bare "add error handling / validation / edge cases", no "similar to Task N", and no reference to a type or function that no task defines. The three cross-task references (`SoldTag` used by Task 5 before Task 8 creates it; `upsertService` used by Task 10 from Task 9; `costs` used by Task 3's descriptor before Task 4's UI writes any) are each called out where they occur, with the fallback stated for the one that could actually be executed out of order.

### Type consistency

- `Spend` gains `other` in Task 1; Tasks 4, 5 and 10 read `.total` and `.other` only, never a positional destructure.
- `GarageData.costs` is introduced in Task 1 together with the three lines in `index.tsx` that keep the tree typechecking — without them the shell's explicit `readGarage` literal is missing a property and `npx tsc -b --noEmit` fails, so it cannot be deferred to Task 4.
- `Vehicle.archived?: boolean` is optional and never `false` anywhere: Task 7's read emits it through `case when archived then true end`, and Task 8's restore writes `undefined`. Both sides are commented.
- `ServiceItem` is introduced in Task 9 as a widening of `{ label: string; cost: number }`, so every existing literal in `sheets.tsx`, `VehicleDetail.tsx`, `Overview.tsx` and both test files stays assignable; Task 9 also widens `ServiceSheet`'s state so no intermediate commit silently drops a warranty.
- `CostSheet`'s props (Task 4) match how `VehicleDetail`'s `CostsPane` and `Overview` both call it, including the optional `onDelete` that only the detail pane passes.
- `PresetEditor`'s props (Task 5) are consumed by exactly the two call sites in the same file.
- `BackupParse` is a discriminated union on `ok`, and Task 12's handler narrows on it before reading `.error` or `.data`/`.counts`.

### Two things noted while planning against the spec

1. **No migration is needed for the part warranty.** `ServiceItem` lives inside `garage_services.items jsonb`, so `warrantyUntil` and `warrantyKm` need no column, no descriptor change and no server test. The spec does not say this, and a reader working down its list would go looking for the migration. Task 9 therefore touches no server file at all.
2. **The spec says the deterministic id means "re-saving the service replaces the reminder through the existing `upsert`", and also that every save first drops every `${service.id}:w:` reminder and re-adds one per warranted item.** After the drop, `upsert` has nothing to collide with, so the two statements are not quite the same mechanism. Task 9 keeps both, and the reason `upsert` still earns its place is a case the spec does not mention: two line items sharing one label generate the same id, and a plain concat would put two rows with one primary key into the sync payload. There is a test for it.
