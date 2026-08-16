// Every derived value in Garaj. Pure: no React, no module-level store, no `Date.now()` captured
// at import. Each function takes the data it reads, so a test is a hand-built object literal.
//
// Date arithmetic is imported, not rewritten — horizon.ts already gets month-end clamping and
// midnight boundaries right, and both are tested.
import { addMonths, daysUntil } from './horizon.ts';
import { unitFor } from './garage-presets.ts';
import type { Body, Energy, LogKind } from './garage-presets.ts';

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

/** Per `typeKey(body, energy)`. What the owner added to, and removed from, that type's list. */
export type Presets = Record<string, { customs: string[]; hidden: string[] }>;

export interface GarageData {
  vehicles: Vehicle[];
  presets: Presets;
  services: Service[];
  docs: VDoc[];
  energy: EnergyLog[];
  odo: OdoLog[];
  reminders: Reminder[];
}

export const EMPTY_GARAGE: GarageData = {
  vehicles: [], presets: {}, services: [], docs: [], energy: [], odo: [], reminders: [],
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
  if (a === 0) return 'today';
  if (a < 14) return `${a} ${a === 1 ? 'day' : 'days'}`;
  if (a < 60) return `~${Math.round(a / 7)} weeks`;
  if (a < 730) return `~${Math.round(a / 30)} months`;
  return `~${(a / 365).toFixed(1)} years`;
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
      text: days < 0 ? `Overdue by ${relDays(days)}` : `Due in ${relDays(days)}`,
    });
  }

  if (typeof trigger.dueOdo === 'number') {
    const left = trigger.dueOdo - currentOdo(d, v);
    candidates.push({
      days: left / kmPerDay(d, v.id),
      text: left < 0
        ? `Overdue by ${fmtKm(-left)} km`
        : `In ${fmtKm(left)} km · ~${relDays(Math.round(left / kmPerDay(d, v.id)))}`,
    });
  }

  // A finite sentinel, not Infinity: dueItems sorts on (a.days - b.days), and two triggerless
  // items would give Infinity - Infinity = NaN, which is undefined behaviour in a comparator.
  if (!candidates.length) {
    return { level: 'ok', days: Number.MAX_SAFE_INTEGER, text: 'No trigger set' };
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

export const DOC_LABELS: Record<VDoc['type'], string> = {
  roadtax: 'Road tax', insurance: 'Insurance', puspakom: 'Puspakom',
  warranty: 'Warranty', other: 'Other',
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
      label: DOC_LABELS[doc.type] + (doc.note ? ` · ${doc.note}` : ''),
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

export interface Spend { service: number; energy: number; docs: number; total: number }

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

  return { service, energy, docs, total: service + energy + docs };
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

  return (spend(d, v.id, from).total - opening) / dist;
}
