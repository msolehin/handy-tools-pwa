// Every derived value in Garaj. Pure: no React, no module-level store, no `Date.now()` captured
// at import. Each function takes the data it reads, so a test is a hand-built object literal.
//
// Date arithmetic is imported, not rewritten — horizon.ts already gets month-end clamping and
// midnight boundaries right, and both are tested.
import { addMonths, daysUntil } from './horizon.ts';
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
