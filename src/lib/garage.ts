// Every derived value in Garaj. Pure: no React, no module-level store, no `Date.now()` captured
// at import. Each function takes the data it reads, so a test is a hand-built object literal.
//
// Date arithmetic is imported, not rewritten — horizon.ts already gets month-end clamping and
// midnight boundaries right, and both are tested.
import { addMonths, daysUntil } from './horizon.ts';
import { unitFor } from './garage-presets.ts';
import type { Body, Energy, LogKind } from './garage-presets.ts';
// horizon.ts already imports this module, so lang.ts is already in the graph — this just names
// the dependency garage.ts itself calls. Every status string here is user-facing, and the app
// has no i18n layer (spec §10): `t(ms, en)` at the call site, same as store.ts and horizon.ts.
import { t } from './lang.ts';

export interface Vehicle {
  id: string;
  body: Body;
  energy: Energy;
  model: string;
  /** The odometer FLOOR — what the owner typed when adding it. Never the current reading. */
  mileage: number;
  colorIdx: number;
  createdAt: number;
  brand?: string;
  nickname?: string;
  plate?: string;
  year?: number;
  /** Displacement, or battery size when energy is 'ev'. Unit per engineSpec(). */
  engine?: number;
  /** Tank litres or usable kWh. Optional. */
  capacity?: number;
  photo?: string;
}

export interface EnergyLog {
  id: string; vehicleId: string;
  date: string; odo: number;
  kind: LogKind;
  /** Litres when kind is 'fuel', kWh when 'charge'. */
  qty: number;
  cost: number;
  /** Only a full -> full pair closes an economy window. */
  full: boolean;
  grade?: string;
  station?: string;
}

export interface Service {
  id: string; vehicleId: string;
  date: string; odo: number;
  items: { label: string; cost: number }[];
  workshop?: string;
  notes?: string;
  receipt?: string;
}

export interface Reminder {
  id: string; vehicleId: string;
  label: string;
  done: boolean;
  dueDate?: string;
  dueOdo?: number;
  repeat?: { months: number; km: number };
  doneDate?: string;
}

export interface VDoc {
  id: string; vehicleId: string;
  type: 'roadtax' | 'insurance' | 'puspakom' | 'warranty' | 'other';
  expiry: string;
  issued?: string;
  cost?: number;
  note?: string;
  receipt?: string;
}

export interface OdoLog { id: string; vehicleId: string; date: string; odo: number }

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

/** Per `typeKey(body, energy)`. What the owner added to, and removed from, that type's list. */
export type Presets = Record<string, { customs: string[]; hidden: string[] }>;

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

const pad = (n: number) => String(n).padStart(2, '0');

/** Local YYYY-MM-DD. toISOString() would shift by the UTC offset and make "today" yesterday. */
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => isoOf(new Date());

export interface Reading { date: string; odo: number }

/** Every odometer reading the app has ever seen for this vehicle, newest first. */
export function readingsOf(d: GarageData, vehicleId: string): Reading[] {
  const mine = <T extends { vehicleId: string; date: string; odo: number }>(rows: T[]) =>
    rows.filter((r) => r.vehicleId === vehicleId).map((r) => ({ date: r.date, odo: r.odo }));
  return [...mine(d.services), ...mine(d.energy), ...mine(d.odo)]
    .sort((a, b) => b.date.localeCompare(a.date) || b.odo - a.odo);
}

/**
 * The odometer maintains itself. Logging a fill-up IS updating it, which is the whole reason the
 * old hand-typed `mileage` field could never be trusted by a km-based reminder.
 *
 * Deliberately the maximum, not the newest: a receipt entered a week late is older by date but
 * must not wind the odometer backwards.
 */
export function currentOdo(d: GarageData, v: Vehicle): number {
  return readingsOf(d, v.id).reduce((max, r) => Math.max(max, r.odo), v.mileage || 0);
}

/** Below this, a measured rate is noise rather than a habit. */
const MIN_WINDOW_DAYS = 14;
/** ~13,000 km/year, the rate a Malaysian car does. Used until there is real history. */
const ASSUMED_KM_PER_DAY = 35;

/**
 * How fast this vehicle actually accumulates distance, so a km target can be spoken as time
 * ("in 1,400 km · ~5 weeks") instead of a number the owner has to convert in their head.
 */
export function kmPerDay(d: GarageData, vehicleId: string): number {
  const r = readingsOf(d, vehicleId);
  if (r.length < 2) return ASSUMED_KM_PER_DAY;
  const newest = r[0], oldest = r[r.length - 1];
  const days = daysUntil(newest.date, new Date(`${oldest.date}T00:00:00`));
  const dist = newest.odo - oldest.odo;
  if (days < MIN_WINDOW_DAYS || dist <= 0) return ASSUMED_KM_PER_DAY;
  return dist / days;
}

export { addMonths };

export type Level = 'over' | 'soon' | 'ok';
export interface Status { level: Level; days: number; text: string }

/** Inside this many days, a deadline is worth colouring. */
export const SOON_DAYS = 30;

/** A day count as something a person says out loud. */
export function relDays(n: number): string {
  const a = Math.abs(n);
  if (a === 0) return t('hari ini', 'today');
  if (a < 14) return t(`${a} hari`, `${a} ${a === 1 ? 'day' : 'days'}`);
  if (a < 60) return t(`~${Math.round(a / 7)} minggu`, `~${Math.round(a / 7)} weeks`);
  if (a < 730) return t(`~${Math.round(a / 30)} bulan`, `~${Math.round(a / 30)} months`);
  return t(`~${(a / 365).toFixed(1)} tahun`, `~${(a / 365).toFixed(1)} years`);
}

const fmtKm = (n: number) => Math.round(n).toLocaleString('en-MY');

/**
 * The one status function in the tool. Reminders and document expiries both come through here,
 * so a document and a reminder can never disagree about what "due soon" means.
 *
 * A trigger may be a date, an odometer target, or both. A km gap is converted to days through
 * the vehicle's own measured rate, which is what lets the two be compared at all — and the one
 * that lands first is the one that matters.
 */
export function statusOf(
  trigger: { dueDate?: string; dueOdo?: number }, d: GarageData, v: Vehicle,
): Status {
  const candidates: { days: number; text: string }[] = [];

  if (trigger.dueDate) {
    const days = daysUntil(trigger.dueDate);
    candidates.push({
      days,
      // days === 0 gets its own line: relDays(0) is "hari ini"/"today", and wrapping that in
      // the same template every other day count uses reads as "hari ini lagi" ("today again")
      // and "Due in today" — neither is a sentence a person would say.
      text: days < 0
        ? t(`Lewat ${relDays(days)}`, `Overdue by ${relDays(days)}`)
        : days === 0
        ? t('Hari ini', 'Due today')
        : t(`${relDays(days)} lagi`, `Due in ${relDays(days)}`),
    });
  }

  if (typeof trigger.dueOdo === 'number') {
    const left = trigger.dueOdo - currentOdo(d, v);
    const days = left / kmPerDay(d, v.id);
    // A km target is always a projection, never a literal calendar date, so the duration is
    // marked "~" either way. relDays() itself already prefixes its own "~" once the bucket
    // reaches weeks/months/years — prepending a second one there read as a literal "~~2 weeks".
    const roundedDays = Math.round(days);
    const projected = relDays(roundedDays);
    // Zero gets no "~" either — same reasoning as the date branch's own days===0 case just
    // above: "~today" reads as doubt about whether it's literally today, which a rounded-to-zero
    // projection doesn't actually carry any more than a literal date does.
    const approx = roundedDays === 0 ? projected : projected.startsWith('~') ? projected : `~${projected}`;
    candidates.push({
      days,
      text: left < 0
        ? t(`Lewat ${fmtKm(-left)} km`, `Overdue by ${fmtKm(-left)} km`)
        : t(`Lagi ${fmtKm(left)} km · ${approx}`, `In ${fmtKm(left)} km · ${approx}`),
    });
  }

  // A finite sentinel, not Infinity: dueItems sorts on (a.days - b.days), and two triggerless
  // items would give Infinity - Infinity = NaN, which is undefined behaviour in a comparator.
  if (!candidates.length) {
    // "Pencetus" is a calque of "trigger" nobody actually says about a due date or an odometer
    // reading — spell out the two things it could have been instead.
    return { level: 'ok', days: Number.MAX_SAFE_INTEGER, text: t('Tiada tarikh atau odometer ditetapkan', 'No trigger set') };
  }

  const worst = candidates.reduce((a, b) => (b.days < a.days ? b : a));
  const level: Level = worst.days <= 0 ? 'over' : worst.days <= SOON_DAYS ? 'soon' : 'ok';
  return { level, days: worst.days, text: worst.text };
}

export interface DueItem {
  kind: 'reminder' | 'document';
  id: string;
  label: string;
  vehicle: Vehicle;
  status: Status;
  reminder?: Reminder;
  doc?: VDoc;
}

// {ms, en} pairs, same shape as garage-presets.ts's BODIES/ENERGIES — this feeds the Home
// dashboard alert title (`Kenderaan: ${item.label}`) as well as DocPair and DocumentSheet, so a
// Malay reader must never land on an English label here while the rest of the sentence is Malay.
export const DOC_LABELS: Record<VDoc['type'], { ms: string; en: string }> = {
  roadtax:   { ms: 'Cukai jalan', en: 'Road tax' },
  insurance: { ms: 'Insurans',    en: 'Insurance' },
  puspakom:  { ms: 'Puspakom',    en: 'Puspakom' },
  warranty:  { ms: 'Waranti',     en: 'Warranty' },
  other:     { ms: 'Lain-lain',   en: 'Other' },
};

/**
 * Everything owed, soonest first. Documents present themselves as date-mode reminders so the
 * home screen has one list rather than two that have to be merged at the point of display.
 */
export function dueItems(d: GarageData, vehicleId?: string): DueItem[] {
  const byId = new Map(d.vehicles.map((v) => [v.id, v]));
  const mine = (id: string) => !vehicleId || id === vehicleId;
  const out: DueItem[] = [];

  for (const r of d.reminders) {
    if (r.done || !mine(r.vehicleId)) continue;
    const v = byId.get(r.vehicleId);
    if (!v) continue;
    out.push({ kind: 'reminder', id: r.id, label: r.label, vehicle: v, reminder: r,
      status: statusOf(r, d, v) });
  }

  for (const doc of d.docs) {
    if (!mine(doc.vehicleId)) continue;
    const v = byId.get(doc.vehicleId);
    if (!v) continue;
    out.push({
      kind: 'document', id: doc.id, vehicle: v, doc,
      label: t(DOC_LABELS[doc.type].ms, DOC_LABELS[doc.type].en) + (doc.note ? ` · ${doc.note}` : ''),
      status: statusOf({ dueDate: doc.expiry }, d, v),
    });
  }

  return out.sort((a, b) => a.status.days - b.status.days);
}

export const serviceTotal = (s: Service) =>
  s.items.reduce((total, i) => total + (Number(i.cost) || 0), 0);

export interface Economy {
  rate: number;   // km per litre, or km per kWh
  unit: string;   // 'km/L' | 'km/kWh'
  dist: number;   // km measured
  qty: number;    // litres or kWh consumed across those km
  spend: number;  // what that energy cost, across the measured windows only
}

/**
 * Efficiency measured between full tanks.
 *
 * A window opens at a full tank and closes at the next one. Everything poured in between —
 * partial top-ups included — is exactly what the distance across that window consumed, because
 * the tank was full at both ends. This is why a partial fill is folded in rather than thrown
 * away: the mockup discarded any window containing one, which quietly understates how much data
 * the owner has, and someone who tops up often would never get a reading at all.
 *
 * What is genuinely unmeasurable is a window that never closes — fuel bought since the last full
 * tank is still sitting in it. That is excluded, and it is the only exclusion.
 *
 * Computed per kind, which is what makes a plug-in hybrid expressible: it has petrol windows and
 * charge windows, measured independently. NEITHER figure is the vehicle's efficiency — the
 * electricity did some of the work the petrol is credited for, and vice versa. For that, see
 * costPerKm below.
 */
export function economy(d: GarageData, v: Vehicle, kind: LogKind): Economy | null {
  const logs = d.energy
    .filter((e) => e.vehicleId === v.id && e.kind === kind)
    .sort((a, b) => a.odo - b.odo);

  let dist = 0, qty = 0, cost = 0;
  let openedAt = -1;   // index of the full tank this window started from
  let pending = 0;     // everything added since then, partials included
  let pendingCost = 0;

  for (let i = 0; i < logs.length; i++) {
    if (openedAt >= 0) {
      // Number(): this data round-trips through localStorage and the sync API. A garbage qty
      // would make the total NaN, and `!qty` below would then silently drop the ENTIRE
      // reading rather than the one bad log.
      pending += Number(logs[i].qty) || 0;
      pendingCost += Number(logs[i].cost) || 0;
    }
    if (!logs[i].full) continue;
    if (openedAt >= 0) {
      dist += logs[i].odo - logs[openedAt].odo;
      qty += pending;
      cost += pendingCost;
    }
    openedAt = i;
    pending = 0;
    pendingCost = 0;
  }
  if (!qty || !dist) return null;

  return {
    rate: dist / qty,
    unit: `km/${unitFor(kind)}`,
    dist,
    qty,
    spend: cost,
  };
}

export interface Spend { service: number; energy: number; docs: number; other: number; total: number }

export function spend(d: GarageData, vehicleId: string, fromISO?: string): Spend {
  const inRange = (date?: string) => !fromISO || (!!date && date >= fromISO);
  const mine = (id: string) => id === vehicleId;

  const service = d.services
    .filter((s) => mine(s.vehicleId) && inRange(s.date))
    .reduce((total, s) => total + serviceTotal(s), 0);

  const energy = d.energy
    .filter((e) => mine(e.vehicleId) && inRange(e.date))
    .reduce((total, e) => total + (Number(e.cost) || 0), 0);

  // Dated by when it was paid for, not when it lapses — a road tax bought in January is a
  // January cost even though it expires the following year.
  const docs = d.docs
    .filter((x) => mine(x.vehicleId) && inRange(x.issued || x.expiry))
    .reduce((total, x) => total + (Number(x.cost) || 0), 0);

  // Dated by its own date. Unlike a document there is no issued/expiry subtlety here — a saman
  // is paid on the day it is paid.
  const other = d.costs
    .filter((c) => mine(c.vehicleId) && inRange(c.date))
    .reduce((total, c) => total + (Number(c.amount) || 0), 0);

  return { service, energy, docs, other, total: service + energy + docs + other };
}

/**
 * The headline figure, and the only honest one for a vehicle burning two things at once. It is
 * currency-denominated, so it needs no assumption about how the work was split between petrol
 * and electricity — and it happens to be the number the owner actually wanted.
 */
export function costPerKm(d: GarageData, v: Vehicle): number | null {
  const r = readingsOf(d, v.id);
  if (r.length < 2) return null;

  // Span by reading VALUE, not by date. readingsOf sorts by date, so r[0] is merely the newest
  // entry — a receipt typed in late, or one odometer mistyped high, would otherwise shrink the
  // span or invert it, and the figure would vanish with nothing the owner could act on.
  const from = r[r.length - 1].date;
  const dist = currentOdo(d, v) - Math.min(...r.map((x) => x.odo));
  if (dist <= 0) return null;

  // The fill that OPENED the observation window paid for distance driven before it — the same
  // fencepost economy() gets right by crediting only the closing fill. Counting it here would
  // inflate the figure by roughly 1/n, which is worst exactly when the number first appears.
  const opening = d.energy
    .filter((e) => e.vehicleId === v.id && e.date === from)
    .reduce((total, e) => total + (Number(e.cost) || 0), 0);

  const numerator = spend(d, v.id, from).total - opening;
  // A single fill plus a later odo log with no cost in between collapses this to exactly 0 —
  // reachable, not just theoretical. 0 is "not enough data", the same as null everywhere else
  // costPerKm returns it, not a real free-to-drive reading: callers that test `!= null` (Costs,
  // VehicleDetail) must not render "RM 0.00/km" for what is really an absent figure, and this is
  // the one place that decides it, so every caller agrees instead of each rendering it differently.
  return numerator === 0 ? null : numerator / dist;
}

/**
 * Advances a repeating reminder's own trigger(s) past the present, or reports there was nothing
 * to advance. Two things a single "+1 interval" cannot get right on its own:
 *
 * - A reminder overdue by more than one interval (skipped a service, or just ticked late) must
 *   not roll to a date/odometer that is STILL in the past — the owner ticks it and watches
 *   nothing change. Keep adding the interval until the result is genuinely ahead, so a 6-month
 *   service stays anchored to its original month-of-year rather than snapping to "today + 6
 *   months" on the first overdue tick.
 * - `repeat` can name a dimension the reminder doesn't actually use — `{months:6, km:0}` on a
 *   mileage-only reminder, say. `null` here (neither guard fires) is what lets the caller tell
 *   "genuinely nothing to roll" apart from "rolled to an unchanged value", so it can fall through
 *   to closing the reminder instead of handing back a silent no-op tick.
 */
function rollForward(r: Reminder, d: GarageData): Reminder | null {
  if (!r.repeat) return null;
  const { months, km } = r.repeat;
  const next: Reminder = { ...r };
  let rolled = false;

  if (months > 0 && r.dueDate) {
    let due = addMonths(r.dueDate, months);
    while (daysUntil(due) <= 0) due = addMonths(due, months);
    next.dueDate = due;
    rolled = true;
  }

  if (km > 0 && r.dueOdo != null) {
    const vehicle = d.vehicles.find((v) => v.id === r.vehicleId);
    if (vehicle) {
      const current = currentOdo(d, vehicle);
      let odo = r.dueOdo + km;
      while (odo <= current) odo += km;
      next.dueOdo = odo;
      rolled = true;
    }
  }

  return rolled ? next : null;
}

/**
 * Ticking a reminder done. A repeating one is never actually closed — it rolls its own trigger
 * forward and stays live, which is the whole point of `repeat`: an oil change ticked off should
 * reappear in ~6 months, not vanish. A one-off reminder has no forward direction to roll to, so
 * it closes normally instead — and so does a repeating one whose `repeat` names a dimension it
 * has no trigger for (`rollForward` returning null either way): a tick must always do something,
 * never hand back an identical clone that looks unchanged and stays stuck in the due list.
 *
 * Takes the id and looks the row up in `d` itself, not a `Reminder` object handed in by the
 * caller — `dueItems()` builds `DueItem.reminder` from whatever `data` the caller last rendered
 * with, and inside a `setData(d => ...)` updater `d` may already be newer than that by the time
 * this runs. Reading the live row out of `d` is what keeps this correct either way.
 */
export function tickReminder(d: GarageData, reminderId: string): GarageData {
  return {
    ...d,
    reminders: d.reminders.map((r) => {
      if (r.id !== reminderId) return r;
      return rollForward(r, d) ?? { ...r, done: true, doneDate: todayISO() };
    }),
  };
}

/** Replace the record with this id, or append it. Upserting by id means a form cannot
 *  accidentally push a second copy of a record it was editing — unlike `editing ? map : push`,
 *  it can't drift out of sync with a separate `editing` state variable, because there isn't one. */
export const upsert = <T extends { id: string }>(list: T[], item: T): T[] =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

export const removeById = <T extends { id: string }>(list: T[], id: string): T[] =>
  list.filter((x) => x.id !== id);

/**
 * Everything a vehicle owns, gone in one step: the vehicle itself and every row in the other
 * five tables that points at it. The server cascades a vehicle delete the same way, so the local
 * copy has to agree immediately — a straggling row here is exactly what the next sync re-uploads
 * as an orphan. One function so there is only one cascade to get right; `Vehicles.tsx` and
 * `VehicleDetail.tsx` both delete a vehicle and both call this rather than each spelling out the
 * same six filters.
 */
export function withoutVehicle(d: GarageData, vehicleId: string): GarageData {
  return {
    ...d,
    vehicles: d.vehicles.filter((v) => v.id !== vehicleId),
    services: d.services.filter((s) => s.vehicleId !== vehicleId),
    docs: d.docs.filter((x) => x.vehicleId !== vehicleId),
    costs: d.costs.filter((c) => c.vehicleId !== vehicleId),
    energy: d.energy.filter((e) => e.vehicleId !== vehicleId),
    odo: d.odo.filter((o) => o.vehicleId !== vehicleId),
    reminders: d.reminders.filter((r) => r.vehicleId !== vehicleId),
  };
}
