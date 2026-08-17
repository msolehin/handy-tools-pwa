# Garaj: Overview quick-add + tab-row spacing

## Branch note

Task said branch `garaj` at HEAD `930ad8f`. Locally, `garaj` is at `26ed77d`; the checked-out
branch `accounts-and-sync` is exactly at `930ad8f` (two commits ahead of `garaj`, same lineage,
clean tree). Worked there since it matches the requested HEAD hash and contains the same
`src/pages/garage/` files. Flagging in case the branch name matters for where this lands.

## What was built

**Quick-add on Overview.** A `+` control (`AddButton`, matching the rest of Garaj's add
affordances) sits directly under `DocPair` (road tax/insurance) on the Overview tab. Tapping it
opens a `Sheet` titled "What are you logging?" / "Apa yang anda log?" with the vehicle's avatar
and name up top (`Sheet`'s own `vehicle`/`sub` props — the sheet cannot silently apply to the
wrong car), listing five actions as `Row`s (title + one-line hint as `sub` + chevron for free from
`onClick` — `Row`'s existing shape fit exactly, no new row component needed):

1. Log a fill-up / charge — `kindsFor(vehicle.energy)`-driven wording
2. Log a service visit
3. Add a reminder
4. Add a document
5. Update mileage

Picking a row closes the picker and opens the real sheet (`EnergySheet`, `ServiceSheet`,
`ReminderSheet`, `DocumentSheet`, `OdoSheet` — the same five VehicleDetail already uses), each
opened fresh for a new record and keyed on the selected vehicle's id.

**Fill-up wording for an EV.** `QuickAddSheet` derives its first row's title via the same
`kindsFor(vehicle.energy)` three-way precedence VehicleDetail's `fuelLabel`/`logVerb` already use
(`kinds.length===1 && kinds[0]==='charge'` → charge; `length===2` → fill/charge; else → fill-up).
Not copied verbatim — the exact strings differ slightly ("Log a fill-up" vs. VehicleDetail's "Log
fill") because this is a new surface with its own copy — but the branching logic and the data it
reads are identical, per the brief's "reuse it, don't invent a second one."

**Tab-row spacing.** `src/pages/garage/index.tsx`: the tab grid's `mb-1` → `mb-4`. Measured gap
between the tab row and the next element went from 4px to 16px (`tabSpacing` check below).

## Avoiding duplicated save handlers

Added two generics to `src/lib/garage.ts`, next to `withoutVehicle`:

```ts
export const upsert = <T extends { id: string }>(list: T[], item: T): T[] =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

export const removeById = <T extends { id: string }>(list: T[], id: string): T[] =>
  list.filter((x) => x.id !== id);
```

`VehicleDetail.tsx`'s five existing handlers (services, energy, odo, reminders, docs — both the
top-level `handleSaveOdo`/`handleSaveDoc` and the three panes' `handleSave`) had their
`editing ? list.map(...) : [...list, item]` branches replaced with `upsert(list, item)`, and their
`list.filter((x) => x.id !== id)` deletes replaced with `removeById(list, id)`. `Overview.tsx`'s
five new handlers use the same two helpers — no second copy of the upsert/delete logic exists
anywhere. Overview's quick-add flows never edit (only create), so `upsert` there always takes the
append branch, but it's the same call as VehicleDetail's, not a parallel implementation.

## Tests

Added to `src/lib/garage.test.ts` (same "fresh `await import` right before its own `describe`"
convention the file already uses for `withoutVehicle`):

- `upsert`: replaces the matching id in place (list length unchanged, correct object replaced),
  appends when the id is new, and never mutates the input array.
- `removeById`: drops the matching row, leaves siblings untouched.

## Verification

- `npm test` — 190/190 pass (all suites, including the new `upsert`/`removeById` describes).
- `npx tsc -b --noEmit` — clean, no output.
- `npm run lint` — 147 pre-existing problems in unrelated files (Randomizer.tsx, WaterTracker.tsx,
  etc.); zero in any file touched by this task (confirmed by grepping the lint output for
  `garage`/`Overview.tsx`/`VehicleDetail.tsx` — no matches).
- `npm run build` — succeeds, `garage-Bwswziax.js` chunk built at 71.51 kB (17.34 kB gzip).

## Live verification (headless Chrome over raw CDP)

Launched Chrome with `--headless=new --remote-debugging-port=9333`, drove it from Node with native
`fetch` (HTTP `/json/new` with `PUT` — this Chrome version rejects `GET` there) and `WebSocket`
against `Page`/`Runtime`/`Emulation` domains, no npm deps. Seeded two vehicles into guest-mode
`localStorage` (`garage_fleet`/`garage_records`/`garage_logs`), against `vite preview` on
`localhost:4173/vehicle-services`.

- **`+` position**: confirmed via DOM order — the `AddButton`'s row is the immediate next sibling
  of `DocPair`'s container. Screenshot shows it directly under the road tax/insurance cards.
- **Sheet names the vehicle**: `title: "Apa yang anda log?"`, `sub: "Kancil Baru"` (petrol) /
  `"Sparky"` (EV) — read from the DOM.
- **All five rows open the right form** (petrol vehicle, read from each form's `h2`):
  - energy → `"Log isi minyak"`, service → `"Log servis"`, reminder → `"Peringatan baharu"`,
    doc → `"Tambah dokumen"`, odo → `"Kemas kini odometer"` — all with `sub: "Kancil Baru"`.
- **Save lands, odometer cluster updates**: submitted a fill-up (odo 43800, qty 35.5, cost 105.20)
  against the petrol vehicle (previous max reading 42000). Cluster digits went
  `042000` → `043800`, and the derived stats recomputed (`— / — ` → `78.9 km/L`, `0.04 RM/km`) —
  `currentOdo` genuinely re-derives from the new reading, not a stale cache. (Confirmed this
  reflects real state, not a display glitch, by re-reading `garage_logs` from `localStorage` —
  it's guest-mode, so writes there stay in an in-memory `cache` tier by design [`store.ts`'s own
  comment: "Guest: this tab's edits live in `cache` above and nowhere else"], so the DOM/React
  state read, not the localStorage read, is the correct check here — matches the task's own
  framing: "the odometer cluster above should update.")
- **EV wording**: selecting the EV vehicle, the quick-add sheet's first row reads
  `"Log cas" / "Tenaga, kos, bacaan odometer"`, and opening it shows a form titled `"Log cas"`
  with `"Kuantiti (kWh)"` and `"Dicas penuh"` (charged to full) — never "fuel"/"isi minyak".
- **Tab-row spacing**: gap between the tab grid's bottom and the next element measured 16px
  (`mb-4`), up from the pre-change 4px (`mb-1`).
- **Light and dark mode**: screenshots taken in both (`document.documentElement.classList` +
  `theme` in `localStorage`, same mechanism `theme.ts` uses). Light mode: white surfaces, dark
  text, correct emerald/rose/amber contrast; `Cluster` stayed on its fixed dark gradient in both
  themes, as designed. No `text-white`/`bg-black` washout observed in either theme in the new
  code — `QuickAddSheet` and its five downstream sheets are all built from existing shared
  components (`Sheet`, `Row`, `AddButton`) that already carry the theme-safe treatment.

One seeding pitfall hit and fixed along the way: `garage_selected` is stored as a **raw** id
string by the app (`store.setItem(SELECTED, vehicleId)`), not JSON-encoded — an initial
`JSON.stringify('v-ev')` seed silently failed to select the EV (fell back to the fleet's first
vehicle instead) until corrected. Not a bug in the shipped code, a mistake in the test harness.

## Files changed

- `src/lib/garage.ts` — added `upsert`, `removeById`.
- `src/lib/garage.test.ts` — added `describe('upsert', ...)` and `describe('removeById', ...)`.
- `src/pages/garage/Overview.tsx` — `+` button, `QuickAddSheet`, five save handlers using `upsert`,
  five form sheets wired in.
- `src/pages/garage/VehicleDetail.tsx` — five existing save/delete handlers now call
  `upsert`/`removeById` instead of hand-rolled `editing ? map : push` / `filter`.
- `src/pages/garage/index.tsx` — tab grid `mb-1` → `mb-4`.

## Concerns

- The branch-name/HEAD mismatch above — worth a second look before this gets merged anywhere, in
  case `garaj` and `accounts-and-sync` were meant to diverge rather than share this work.
- The `+` button's own label ("Log something" / "Log rekod") is new copy not specified verbatim in
  the brief — only the sheet title and the five rows were. Reasonable inference, easy to rename if
  a different label was intended.
- Pre-existing lint debt (147 problems, unrelated files) was left untouched — out of this task's
  scope.
