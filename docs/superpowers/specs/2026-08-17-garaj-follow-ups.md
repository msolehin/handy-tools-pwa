# Garaj — follow-ups

**Date:** 2026-08-17
**Status:** none of these block the merge; the whole-branch review triaged every one

Deferred findings from the Garaj rebuild, kept because a deferred list nobody re-reads is a
silent discard. Ordered by what the final review judged most worth doing first.

## Worth doing soon

**The store tests leave live retry timers.** Fixed for the three tests that had it, but the
underlying shape remains: `runFlush` arms a 2s `flushTimer` on a rejected key and there is no
exported handle to cancel it. `store.test.ts` shares one `fetch` mock and one `calls` array
across every module instance, so a stray timer firing during a later test contaminates it. The
current fix drains `dirty` so the guard short-circuits; a cancellable handle would be sturdier.

**`addCustom`'s hidden-default branch has no unit test.** One guard plus two divergent
mutations — exactly the shape that regresses silently, and it already produced dead synced data
once. It is a pure function and belongs beside `garage-presets.test.ts`.

**The modal scrim washes out in light mode, app-wide.** `bg-black/60` resolves through
`--color-black`, which `index.css` inverts under `html.light`. Every modal in the app is
affected, Garaj's `Sheet` included — it inherits the bug by correctly matching the existing
pattern. Confirmed empirically by screenshot. Deserves its own change, not a per-tool patch.

**Documents don't re-notify after renewal.** `reminder_sends` is keyed on `record_id` with no
date, and renewing a document edits the row in place. Garaj's two reminder arms were fixed by
folding the occurrence into the key; `source = 'document'` has always had this and still does,
in both `/document-expiry` and Garaj's own documents. Same one-line fix, wider blast radius.

## Product decisions, not bugs

**Road tax recorded in both Garaj and `/document-expiry` produces two dashboard alerts.**
Deduplicating across tools would violate "tools never import each other" (`spec.md` §1). Either
accept it, or decide which tool owns vehicle documents.

**A reminder with both a date and an odometer trigger appears twice in one notification
digest** — once per arm. Pre-existing behaviour; the old vehicle_service/vehicle_mileage pair
did the same. The in-app list shows it once.

## Small, mechanical

- `const num` is defined in six places across the garage files; lift it to `parts.tsx`.
- A vehicle with a model but no nickname and no brand shows its model twice, on the card, the
  picker and the Costs row — one shared helper fixes all three.
- `Vehicle.capacity` is dead end to end (column, descriptor, type, no reader). Delete it, or
  spread `...vehicle` in `VehicleSheet`'s submit so the next added field isn't dropped too.
- `engineSpec().label` is unused; `VehicleSheet` derives its own bilingual label with the same
  precedence. Two places to keep in step. Drop the field or make it a `{ms, en}` pair.
- `gradesFor` offers RON100 to hybrid and PHEV; the spec's table says RON95/RON97 only.
- `dist <= 0` is guarded in `VehicleDetail`'s `legEconomy` but not in `garage.ts`'s `economy`,
  so two full entries at one odometer make the per-leg row vanish while the summary shifts.
- A completed non-repeating reminder can be edited but not re-opened; a mis-tapped tick costs a
  delete and re-create.
- Preset label comparisons are case-sensitive throughout, so "engine oil" sits beside the
  default "Engine oil".
- `Sheet` sets initial focus but has no focus trap. It already does more than any other modal
  in the app; a real trap is an app-wide change.
- `horizon.ts` still exports `kmNum`, `kmLeft`, `currentKmOf` and `KM_SOON`; their last app
  caller went with `VehicleServices.tsx` and only their own test remains. `openServices` and
  `latestServiceIds` are still live (Home, Home Services).
- `spec.md:180` still names "Servis Kenderaan" in an architecture note.

## Known limit, documented rather than fixed

A kilometre-based reminder can only fire on the run after the owner enters a reading — the
server has no odometer feed between visits. A car driven 900 km without an entry is invisible
to the scheduler, which is why the tool page nags on screen as well. This is unchanged from the
tool Garaj replaces, and `reminders.ts` carries the note.
