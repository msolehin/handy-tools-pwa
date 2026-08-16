# Garaj — vehicle tracker rebuild

**Date:** 2026-08-17
**Status:** approved, not yet implemented
**Replaces:** Servis Kenderaan (`/vehicle-services`), `src/pages/VehicleServices.tsx`

## Problem

The current tool logs service visits against a vehicle and nothing else. Three things are
structurally wrong with it, and none of them can be patched:

1. **A vehicle has no type.** Every vehicle is asked the same questions, so an EV owner is
   offered an engine-oil change and a motorcycle owner is not offered a chain. The service
   checklist is one global list of free-text titles.
2. **The odometer is hand-maintained state.** `VehicleAsset.mileage` is whatever the owner last
   typed, with `mileageAt` recording how stale it is. Every kilometre-based reminder is only as
   good as that number, and the app has no way to improve it.
3. **There is no running cost.** Fuel and electricity are the largest recurring expense of
   owning a vehicle and the tool cannot see them, so it cannot answer the one question an owner
   actually has: what does this thing cost me per kilometre?

The reference mockup (`vehicle-tracker-mockup.html`) answers 1 and 2 well and answers 3 for
petrol and EV only. This spec takes its mechanics, corrects its type model, and extends its
energy model to cover diesel and hybrids.

## Decisions taken

| Question | Decision |
|---|---|
| Existing user data | **Wiped.** Owner's call. Softened by a one-time export offer (§7). |
| Visual direction | Mockup's identity, expressed through the app's existing theme tokens |
| Feature scope | All of it — vehicles, service, energy, reminders, documents, costs, settings |
| Dual-energy vehicles | One log with two kinds; `RM/km` is the honest headline (§4) |
| Service checklist | Per **type**, shared across vehicles of that type, edited in Settings |
| Navigation | In-page segmented tabs, like Expense Manager — not the mockup's bottom nav |

---

## 1. Vehicle identity — two orthogonal fields

The mockup uses one flat `type` field in which `ev` sits alongside `sedan` and `motorcycle`.
That is wrong the moment someone owns an electric van, a diesel lorry, or a hybrid sedan — all
of which are ordinary in Malaysia. Identity splits in two:

```ts
type Body   = 'hatchback' | 'sedan' | 'suv' | 'mpv' | 'pickup' | 'van' | 'lorry' | 'motorcycle'
type Energy = 'petrol' | 'diesel' | 'ev' | 'hybrid' | 'phev'
```

`hybrid` means a self-charging HEV (no plug). `phev` plugs in. The distinction is not cosmetic:
it decides whether the vehicle can hold charge records at all (§4).

Everything type-specific is a lookup off one or both fields. There are no `if (isEV)` branches
in components.

| Derived from | Governs |
|---|---|
| `energy` | unit (L / kWh), verb ("fill" / "charge"), which log kinds are allowed, grade options, economy formula |
| `body` | icon, engine-capacity unit and placeholder, body-specific service items |
| both | the service checklist (§3) |

**Engine capacity** is one nullable number whose meaning follows the type:

| Condition | Label | Unit | Placeholder |
|---|---|---|---|
| `energy === 'ev'` | Battery | kWh | 60.5 |
| `body === 'motorcycle'` | Engine capacity | cc | 150 |
| otherwise | Engine capacity | litres | 1.5 |

---

## 2. Data model

Six record types, all keyed to a vehicle. `id` is a client-generated short string, matching the
existing convention in every other tool.

```ts
interface Vehicle {
  id: string
  body: Body
  energy: Energy
  model: string                 // required
  mileage: number               // required; the odometer FLOOR, not current state (§5)
  brand?: string
  nickname?: string
  plate?: string
  year?: number
  engine?: number               // meaning per the table above
  capacity?: number             // tank litres or usable kWh; optional
  photo?: string                // downscaled data URL, same treatment as today
  colorIdx: number              // index into a fixed edge-colour palette, for the initials avatar
  createdAt: number
}

interface EnergyLog {
  id: string; vehicleId: string
  date: string                  // YYYY-MM-DD
  odo: number
  kind: 'fuel' | 'charge'
  qty: number                   // litres when kind==='fuel', kWh when kind==='charge'
  cost: number
  grade?: string                // RON95 / Diesel B7 / DC fast … defaulted from energy+kind
  full: boolean                 // full tank or full charge; only a full→full pair closes a window
  station?: string
}

interface Service {
  id: string; vehicleId: string
  date: string; odo: number
  items: { label: string; cost: number }[]
  workshop?: string
  notes?: string
  receipt?: string              // downscaled data URL
}

interface Reminder {
  id: string; vehicleId: string
  label: string
  dueDate?: string              // at least one of dueDate / dueOdo is required
  dueOdo?: number
  repeat?: { months: number; km: number }
  done: boolean
  doneDate?: string
}

interface VDoc {
  id: string; vehicleId: string
  type: 'roadtax' | 'insurance' | 'puspakom' | 'warranty' | 'other'
  expiry: string                // required
  issued?: string
  cost?: number
  note?: string
  receipt?: string
}

interface OdoLog {
  id: string; vehicleId: string
  date: string
  odo: number
}
```

`OdoLog` exists so "I just want to correct the mileage" is a first-class action that does not
require inventing a fake fill-up.

---

## 3. Service checklists

Resolution order, in `presetsFor(body, energy, customs, hidden)`:

1. A motorcycle takes its own base list — it shares almost nothing with a car.
2. Otherwise the base list comes from `energy`.
3. Body extras are appended for bodies that genuinely need them.
4. The user's custom items for that `body:energy` pair are appended.
5. Items the user has removed are filtered out.

Duplicates are removed, order preserved. Steps 4 and 5 are exactly the Expense Manager custom
category pattern: defaults are not stored, customs are, and a custom that matches a default is
never added twice.

**Base lists by energy:**

- **petrol** — Engine oil, Oil filter, Air filter, Cabin filter, Spark plug, Brake pads,
  Brake fluid, Tyres, Tyre rotation, Alignment, Battery, Coolant, ATF / gearbox oil, Wipers
- **diesel** — as petrol, minus Spark plug, plus Fuel filter, Fuel water separator, DPF service
- **hybrid** — as petrol, plus Hybrid battery inspection, Inverter coolant
- **phev** — as hybrid, plus Charging cable check
- **ev** — Cabin filter, Brake pads, Brake fluid, Tyres, Tyre rotation, Alignment,
  Battery coolant, 12V battery, Software update, Wipers

**Motorcycle base lists:**

- combustion — Engine oil, Oil filter, Air filter, Chain & sprocket, Chain lube, Brake pads,
  Tyres, Battery, Spark plug
- ev — Brake pads, Tyres, Chain & sprocket, Battery coolant, 12V battery, Software update

**Body extras** (appended to a non-motorcycle base):

- `lorry`, `van` — Brake drums, Leaf spring / suspension, Differential oil, Puspakom inspection
- `pickup` — Differential oil, 4WD transfer case
- everything else — none

**Suggested intervals.** After an item is logged, the app offers a reminder pre-filled from a
`{ months, km }` map keyed by item label — Engine oil `{6, 5000}`, Brake pads `{0, 30000}`,
Chain lube `{0, 800}`, Software update `{12, 0}`, and so on. `0` means that dimension does not
apply. An item with no entry offers no pre-fill; the user sets it manually.

Custom items and removals are stored per `body:energy` pair, not per vehicle. Adding
"Timing belt" to Sedan · Petrol offers it on every petrol sedan the owner has.

---

## 4. Energy, fuel types, and economy

**Which log kinds a vehicle allows** is the whole of the multi-fuel design:

| Energy | Allowed kinds | Headline efficiency |
|---|---|---|
| petrol, diesel, hybrid | `fuel` | km/L |
| ev | `charge` | km/kWh |
| phev | `fuel` **and** `charge` | RM/km |

A self-charging hybrid never draws from the grid, so it is a fuel-only vehicle whose km/L
happens to be good. Only a PHEV holds both kinds.

**Grade options** are a function of `(energy, kind)` and are suggestions, not a closed set —
the field accepts free text so a station-specific grade is never blocked:

| energy · kind | Offered |
|---|---|
| petrol · fuel | RON95, RON97, RON100 |
| diesel · fuel | Diesel B7, Diesel B10, Euro 5 |
| hybrid / phev · fuel | RON95, RON97 |
| ev / phev · charge | AC home, AC public, DC fast |

**Economy is computed per kind, between full tanks.** A window opens at a full tank and closes
at the next one; everything poured in between — partial top-ups included — is exactly what the
distance across that window consumed, because the tank was full at both ends.

```
economy(kind) = Σ(odo[close] − odo[open]) / Σ(qty added within the window)
```

The only thing excluded is a window that never closed: fuel bought since the last full tank is
still sitting in it and has not been burned yet. Discarding whole windows merely because a
partial sits inside one — as the mockup does — understates how much data the owner has, and
someone who tops up regularly would never get a reading at all.

For a PHEV this yields two independent figures — km/L over its petrol windows and km/kWh over
its charge windows — and **neither is the vehicle's efficiency**, because the electricity did
some of the work the petrol is being credited for and vice versa. The honest headline for a
dual-energy vehicle is cost per kilometre:

```
costPerKm = spend(since first reading) / (newest odo − oldest odo)
```

which is currency-denominated, needs no assumption about the energy split, and is the number
the owner actually wanted. It is shown for every vehicle; km/L and km/kWh are shown alongside
where they are meaningful.

---

## 5. Derived logic — `src/lib/garage.ts`

Pure functions, no React, one test file. This is the only non-trivial logic in the tool and it
lives in one place so the pages stay presentational.

Every function takes the data it reads as an explicit argument — there is no module-level store,
unlike the mockup. The signatures below are written as `(vehicleId, …)` for brevity; each one
also receives the relevant record arrays, so they are trivially testable with hand-built
fixtures and hold no state between calls.

- **`currentOdo(vehicle, logs)`** — `max` of every odometer reading the app has ever seen across
  services, energy logs, odo logs, and the vehicle's own floor. The odometer maintains itself;
  logging a fill-up *is* updating it. This is the fix for problem 2 in the preamble.
- **`kmPerDay(vehicleId)`** — distance ÷ days between the oldest and newest reading. Falls back
  to a fixed 35 km/day when there are fewer than two readings or under 14 days of history, so
  a brand-new vehicle still produces a sane estimate rather than a divide-by-zero.
- **`statusOf(item, vehicle)`** — **one** function serving reminders and document expiry both.
  Takes whichever of `dueDate` / `dueOdo` is set, converts a kilometre gap into days via
  `kmPerDay`, and returns the trigger that hits first as
  `{ level: 'over' | 'soon' | 'ok', days, text }`. `soon` is ≤ 30 days. One set of thresholds in
  the whole tool, so a document and a reminder can never disagree about what "due soon" means.
- **`economy(vehicleId, kind)`** — §4.
- **`costPerKm(vehicleId)`** — §4.
- **`spend(vehicleId, fromISO?)`** — `{ service, energy, docs, total }`.
- **`presetsFor(body, energy, customs, hidden)`** — §3.

Tested in `src/lib/garage.test.ts` under `node --test`, matching `store.test.ts`. The cases that
must be covered: a partial fill being folded into the window it sits in, an unclosed window
producing no reading at all, a PHEV producing two separate economy figures, `statusOf` picking
the earlier of two triggers, a kilometre trigger being expressed in days, and `currentOdo` being
unaffected by a backdated entry.

---

## 6. Storage and sync

Three synced keys, split by **photo weight × write frequency**. A single blob would mean every
fill-up re-uploads every vehicle photo and every receipt.

| Key | Holds | Write profile |
|---|---|---|
| `garage_fleet` | vehicles, type presets | rare, heavy (photos) |
| `garage_records` | services, documents | occasional, heavy (receipts) |
| `garage_logs` | energy logs, odo logs, reminders | frequent, light |

Which vehicle is currently selected stays a device preference in plain `localStorage`
(`garage_selected`), never synced — the same treatment `vehicle_selected_asset` gets today.

**Postgres** — `server/migrations/018_garage.sql`:

```
garage_vehicles     (user_id, id, body, energy, model, mileage, brand, nickname, plate,
                     year, engine, capacity, photo, color_idx, created_at, pos)
garage_energy_logs  (user_id, id, vehicle_id, date, odo, kind, qty, cost, grade, full_tank, station, pos)
garage_services     (user_id, id, vehicle_id, date, odo, items jsonb, workshop, notes, receipt, pos)
garage_reminders    (user_id, id, vehicle_id, label, due_date, due_odo,
                     repeat_months, repeat_km, done, done_date, pos)
garage_documents    (user_id, id, vehicle_id, type, expiry, issued, cost, note, receipt, pos)
garage_odo_logs     (user_id, id, vehicle_id, date, odo, pos)
garage_presets      (user_id, type_key, customs jsonb, hidden jsonb)   -- pk (user_id, type_key)
```

All child tables carry `foreign key (user_id, vehicle_id) references garage_vehicles(user_id, id)
on delete cascade`, matching the existing `vehicle_service_events` pattern. `items` stays `jsonb`
for the same reason it does today: a bounded list, only meaningful inside its parent, never
queried server-side.

Two column names deviate from their TypeScript field: `EnergyLog.full` becomes **`full_tank`**
because `FULL` is a reserved word in Postgres and an unquoted `full boolean` will not parse; and
`Vehicle.colorIdx` becomes `color_idx` per the existing snake_case convention. The descriptor in
`tools.ts` owns both mappings, as it already does for every other tool.

The migration **creates only**. `vehicle_assets` and `vehicle_service_events` are left in the
schema, following the convention `tools.ts` already documents for the removed Birthdays tool:
those rows are user data, and a migration that deletes them cannot be undone. Deleting the
descriptor is what stops a key syncing, and that is enough — from the user's side the data no
longer loads, syncs, or appears anywhere, which is the wipe that was asked for.

`server/tools.ts` gains three descriptors (one per synced key) and loses the
`vehicle_services_data` and `vehicle_custom_titles` ones. `src/lib/store.ts` updates
`SYNCED_KEYS`, `SYNCED_ROUTES`, and `TOOL_LABELS` to match — there is an existing test asserting
those three stay consistent.

**`server/reminders.ts` must be updated in the same change.** Its `DUE_SQL` union currently
reads `vehicle_service_events.next_service_date` under the source `vehicle_service`, plus a
mileage arm under `vehicle_mileage`. Both tables are being dropped. The replacements:

| New arm | Source | Column | Filter |
|---|---|---|---|
| `garage_reminders` | `garage_reminder` | `due_date` | `due_date is not null and not done` |
| `garage_documents` | `garage_document` | `expiry` | — |
| `garage_reminders` | `garage_mileage` | — | `due_odo is not null and not done` |

`href` is `/vehicle-services` for all three. Omitting this step silently kills push and email
reminders that users receive today, with no error anywhere.

---

## 7. Migration off the old tool

The owner chose to wipe rather than migrate. To keep that from being irreversible by accident,
the first open of the new tool detects a surviving `vehicle_services_data` value and shows one
screen before anything else:

- **Download my old records** — writes the raw JSON to a file via a blob URL. No parsing, no
  interpretation; whatever was there is what comes out.
- **Start fresh** — removes the old keys and never asks again.

The screen cannot be dismissed by any other route, and declining the download is a deliberate
second tap. Once past it, `vehicle_services_data` and `vehicle_custom_titles` are removed from
the device and both are already gone from `SYNCED_KEYS`, so nothing re-pushes them.

---

## 8. UI

Route stays `/vehicle-services` so existing links, the Home dashboard, and the reminder `href`
all keep working. The tool is renamed **Garaj** in `src/lib/tools.ts`.

**Four top-level tabs**, rendered as the Expense Manager segmented row:

| Tab | Contents |
|---|---|
| **Utama** | vehicle picker → odometer cluster → road tax + insurance pair → What's due (all vehicles) → Recent activity |
| **Kenderaan** | vehicle cards, each with its photo, odometer, and an overdue / due-soon / all-clear pill |
| **Kos** | 12-month stacked bar (service / energy / documents) + a per-vehicle breakdown with RM/km |
| **Tetapan** | service checklist editor per type, and the data controls |

Tapping a vehicle drills into a **detail page** carrying its own segmented row — **Service ·
Fuel · Remind · Docs** — above the same cluster and document pair. "Fuel" is labelled "Charge"
for an EV and "Energy" for a PHEV.

**Carried over from the mockup**, because these are what give it an identity rather than
reading as a default template:

- The **odometer cluster**: a dark panel with glowing monospace digits, leading zeros dimmed,
  and a three-cell foot showing km-since-fill, efficiency, and RM/km. It is the one deliberately
  dark surface in the tool and it earns the contrast by being literally a dashboard.
- **Signage typography** — condensed uppercase with wide letter-spacing for eyebrows, labels,
  and buttons; monospace for every number.
- The **road tax / insurance pair** sitting directly under the cluster, coloured by the same
  status thresholds as everything else, tappable to add when unset.
- **Status colour system** — green ok, amber due-soon, orange overdue — applied identically to
  reminder bars, document cells, and vehicle pills.
- **Bottom sheets** for every form, each showing the vehicle it is being filled in for, so a
  form can never be submitted against the wrong car.

**Adapted, not copied:** the mockup is light-only and hardcodes hex values. Everything here is
expressed through the app's existing `--color-*` tokens plus the `light:` Tailwind variant, so
the tool works in dark mode like every other page. The cluster stays dark in both themes — that
is the point of it.

The mockup's bottom navigation is dropped; the app already has one, and two would compete.

---

## 9. Files

| Path | Change |
|---|---|
| `src/lib/garage.ts` | new — all derived logic (§5) |
| `src/lib/garage.test.ts` | new — its check |
| `src/pages/garage/index.tsx` | new — tab shell, data loading, first-run wipe screen |
| `src/pages/garage/Overview.tsx` | new |
| `src/pages/garage/Vehicles.tsx` | new |
| `src/pages/garage/VehicleDetail.tsx` | new |
| `src/pages/garage/Costs.tsx` | new |
| `src/pages/garage/Settings.tsx` | new |
| `src/pages/garage/sheets/` | new — vehicle, service, energy, reminder, document forms |
| `src/pages/VehicleServices.tsx` | **deleted** (1,206 lines) |
| `server/migrations/018_garage.sql` | new — seven tables, creates only |
| `server/tools.ts` | three descriptors in, two out |
| `server/reminders.ts` | `DUE_SQL` union rewired (§6) |
| `src/lib/store.ts` | `SYNCED_KEYS`, `SYNCED_ROUTES`, `TOOL_LABELS` |
| `src/lib/tools.ts` | tool renamed to Garaj |
| `src/App.tsx` | route points at the new page |

## 10. Out of scope

Deliberate, not deferred by accident:

- **Trip logging.** A different tool with a different shape.
- **Sharing a vehicle between accounts.** The whole sync model is single-user; this would be a
  cross-cutting change to `store.ts`, not a feature of this tool.
- **Multi-currency.** The app is RM throughout.
- **Automatic fuel price lookup.** A network dependency for a number the user is holding a
  receipt for.
- **Reminder push for a kilometre target crossing while the app is closed.** The server has no
  odometer feed between visits, so it can only fire on the reading it last saw. The
  `garage_mileage` arm in §6 preserves exactly the behaviour that exists today, no more.
