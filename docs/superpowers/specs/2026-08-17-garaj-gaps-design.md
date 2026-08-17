# Garaj — closing four gaps

**Date:** 2026-08-17
**Status:** approved, not yet implemented
**Builds on:** `2026-08-17-garaj-design.md` (the rebuild) and
`2026-08-17-garaj-follow-ups.md` (the deferred list)

Four gaps found after the rebuild shipped. Route logging was considered and rejected: manual
trip entry has poor retention, it only pays off when automatic, and it would become a fourth
odometer source competing with fills and services. It stays out until someone needs
business-mileage claims.

## Why these four

1. **Other running costs.** The Costs tab claims to answer "what does this vehicle cost me" but
   structurally cannot include a RM 150 saman, a Touch 'n Go reload or a dashcam. It knows only
   service, energy and documents. This is the tool's biggest honesty gap.
2. **Archive a sold vehicle.** Selling a car is ordinary. Today the only option is Delete, which
   cascades every service, document and log. The history is worth keeping — it is also what you
   hand the buyer.
3. **Warranty on a fitted part.** A battery is eighteen months, tyres carry a tread warranty. A
   service line item is a label and a cost, so that date has nowhere to live.
4. **Export and import.** The tool holds years of history with no way to get it out. Sync covers
   device loss only for signed-in users.

---

## 1. Other costs

```ts
interface Cost {
  id: string
  vehicleId: string
  date: string          // YYYY-MM-DD
  category: string      // from an editable list; not a union — see below
  amount: number
  note?: string
  receipt?: string      // downscaled data URL, same treatment as a service receipt
}
```

**Deliberately no odometer field.** Every other record that carries one feeds `currentOdo`,
which is a maximum over all readings. A parking receipt's mileage is incidental and would move
the odometer for no reason; excluding it from that maximum would mean a record with an `odo`
that means something different from every other `odo` in the tool. Neither is worth it, so a
cost has no odometer at all.

### Where the costs live

New table `garage_costs (user_id, id, vehicle_id, date, category, amount, note, receipt, pos)`,
with the same composite foreign key onto `garage_vehicles(user_id, id) on delete cascade` every
other child table uses.

It joins the **`garage_records`** sync key, alongside services and documents, because it can
carry a receipt photo and that key is the one already split out for photo weight. The blob
becomes `{ services, docs, costs }`, and `garage_records`'s descriptor gains a third
read/write pair.

**`category` is a free string over an editable list, not a TypeScript union.** The tool already
proved this shape with service checklists: built-in defaults, plus the owner's own additions,
minus the ones they removed. A fixed enum would mean a code change every time someone wants to
track something new.

Unlike service checklists, categories are **garage-wide, not per vehicle type** — a parking fee
is not specific to a motorcycle.

**Defaults:** `Tol & parkir`. That is the only one that ships. It is a starting point, not a
prediction — anything else (saman, aksesori, cuci kereta, tunda) is one line in Settings.

### Where the categories live

Reusing the existing `garage_presets` table with the reserved `type_key` of `'_cost_categories'`.
Its columns are already `(user_id, type_key, customs jsonb, hidden jsonb)` — exactly the shape
needed — and it already has a tested read/write path in the descriptor. A leading underscore can
never collide with a real `body:energy` key. Both ends carry a comment saying so, because
`type_key` otherwise means a vehicle type and a reader would reasonably assume it always does.

The alternative, a second one-row-per-user table, buys nothing but a truer column name.

### What it changes

- **`spend()` gains a fourth bucket:** `{ service, energy, docs, other, total }`. Every caller
  updates — `Costs.tsx`, `VehicleDetail`'s stat strip, and `costPerKm`, which needs no change
  itself because it divides `spend().total`.
- **The Costs chart gains a fourth stacked segment** and a fourth legend row.
- **The vehicle detail page gains a fifth segment**, `Lain-lain / Other`. Five fits: Expense
  Manager already runs five top-level tabs at this width.
- **The quick-add sheet gains a sixth row**, "Log a cost".
- **Overview's Recent** includes cost entries.

Costs are dated by their own `date`. There is no `issued`/`expiry` subtlety as there is for
documents.

---

## 2. Archive a sold vehicle

`Vehicle` gains two optional fields:

```ts
archived?: boolean
archivedAt?: string   // YYYY-MM-DD
```

Server: `garage_vehicles` gains `archived boolean not null default false` and
`archived_at date`.

### The rule

| Hidden from | Still counted in |
|---|---|
| the vehicle picker | the Costs chart and its 12-month totals |
| the Vehicles list (moved to a collapsed section) | the per-vehicle Costs list, tagged **Sold** |
| the quick-add sheet | Recent activity |
| `dueItems()` — no reminders, no dashboard alerts | |
| **`server/reminders.ts`** — no push, no email | |

**That last row is the one that matters.** Without it, a car sold last year keeps emailing about
its road tax. All three Garaj arms in `reminders.ts` must join `garage_vehicles` and filter
`not archived` — including the `garage_document` arm, which currently does not join the vehicle
table at all.

### Archive is not Delete

Both stay, and they mean different things:

- **Delete** — "I typed this by mistake." Cascades every child record, as it does today.
- **Archive** — "I sold it." Keeps everything, stops the nagging.

Both live in the vehicle's edit sheet. Archived vehicles sit in a collapsed **Dijual / Sold**
section at the bottom of the Vehicles tab, showing their name, final odometer and lifetime
spend, and can be restored from there.

Selecting an archived vehicle is possible only by restoring it. If the currently-selected vehicle
is archived, selection falls through to the first non-archived vehicle, the same fallback that
already handles a deleted one.

---

## 3. Warranty on a fitted part

`ServiceItem` gains two optional fields:

```ts
warrantyUntil?: string   // YYYY-MM-DD
warrantyKm?: number      // from the service's own odometer reading
```

A battery is dated; tyres are distance; some parts are both. The service form exposes them per
line item behind a disclosure, so the common case stays exactly as many taps as it is today.

### Setting a warranty creates its reminder, with no extra prompt

Entering a warranty end date has no other purpose in this tool. Asking "would you like a
reminder for that?" asks someone to confirm what they just said. So on save, each item carrying a
warranty produces a reminder:

- **label:** `Waranti: <item label>`
- **dueDate:** `warrantyUntil` when set
- **dueOdo:** `service.odo + warrantyKm` when set
- **repeat:** none — a warranty expires once
- **id:** `` `${service.id}:w:${item.label}` `` — deterministic, so re-saving the service
  replaces the reminder through the existing `upsert` rather than adding a second copy

It then flows through `statusOf`, the due list, the dashboard and push/email, all of which exist.

**Clearing a warranty removes its reminder**, and the deterministic id is what makes that
cheap: on every save, the service first drops every reminder whose id starts with
`` `${service.id}:w:` ``, then re-adds one per item that still carries a warranty. Removing an
item, renaming it, or clearing its dates all converge on the right result without the save path
having to work out what changed. Deleting the service removes them with it, and deleting or
archiving the vehicle takes them through the paths that already exist.

This is separate from, and additive to, the existing service-interval suggestion — that one still
prompts, because a service interval is an inference and a warranty is a fact the owner typed.

---

## 4. Export and import

### Export

One control in Settings, producing `garaj-backup-YYYY-MM-DD.json`:

```json
{
  "app": "garaj",
  "version": 1,
  "exportedAt": "2026-08-17T09:30:00.000Z",
  "fleet":   { "vehicles": [], "presets": {} },
  "records": { "services": [], "docs": [], "costs": [] },
  "logs":    { "energy": [], "odo": [], "reminders": [] }
}
```

The three sync blobs verbatim, so the format needs no separate mapping layer and cannot drift
from what is actually stored. **Photos are included** — that is what makes it a backup rather
than a summary, and the size cost is stated in the UI before the download starts.

It reuses the download path already hardened for the legacy gate: anchor appended to the body,
clicked, removed, with `URL.revokeObjectURL` deferred to a timeout, so it works outside Chromium.

### Import

Import is the risky half and is deliberately loud rather than clever.

1. Pick a file.
2. **Validate before touching anything.** `app === 'garaj'`, `version === 1`, all three sections
   present and objects, every collection an array. A file that fails is rejected naming what was
   wrong, and nothing is written.
3. **Show what is in it** before asking: "3 vehicles · 47 services · 112 fuel logs · 9 documents
   · 23 costs".
4. **Confirm, stating plainly that it replaces everything currently in Garaj.**

**Replace, not merge.** Merge semantics for records with client-generated ids is a genuine
rabbit hole — same id with different content, same content with different ids, and no way to
tell an edit from a collision. A backup that silently half-merges is worse than one that refuses.
The confirm says "replace" in both languages.

Import writes through the same `setData` the rest of the tool uses, so the shell's save effect
persists all three keys and sync carries it up normally.

**Version 1 is the only version the importer accepts.** When the shape next changes, the
importer gains a migration step for version 1 rather than silently accepting a file it will
misread.

---

## Build order

Export goes last because it serialises the final shape; building it first would mean writing the
format twice.

1. **Other costs** — new record type, table, descriptor, `spend()`, chart, pane, quick-add.
2. **Archive** — vehicle fields, the hide/count split, `reminders.ts` joins.
3. **Part warranty** — service item fields, deterministic reminder ids.
4. **Export and import** — serialise, validate, replace.

## Out of scope

- **Route and trip logging** — see the preamble.
- **Merge-on-import.** Replace only.
- **Recurring costs.** A cost is a one-off record. Something that recurs is a reminder, and the
  tool already has those.
- **Cross-device restore of an archived vehicle's photos** beyond what sync already does.
- **Multi-currency.** The app is RM throughout.
