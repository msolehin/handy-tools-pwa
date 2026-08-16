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
