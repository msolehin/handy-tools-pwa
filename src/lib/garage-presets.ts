// Domain reference tables for Garaj. Data and trivial lookups only — every function here is a
// pure map from a vehicle's type to what the app should offer it. The arithmetic lives in
// garage.ts.
//
// Identity is two orthogonal fields, not one. A flat type list forces `ev` to sit beside
// `sedan`, which breaks the day someone owns an electric van or a diesel lorry — both ordinary
// here. Splitting them means every type-specific behaviour is a lookup rather than a branch.

export type Body = 'hatchback' | 'sedan' | 'suv' | 'mpv' | 'pickup' | 'van' | 'lorry' | 'motorcycle';
export type Energy = 'petrol' | 'diesel' | 'ev' | 'hybrid' | 'phev';
export type LogKind = 'fuel' | 'charge';

export const BODIES: Record<Body, { ms: string; en: string }> = {
  hatchback:  { ms: 'Hatchback',  en: 'Hatchback' },
  sedan:      { ms: 'Sedan',      en: 'Sedan' },
  suv:        { ms: 'SUV',        en: 'SUV' },
  mpv:        { ms: 'MPV',        en: 'MPV' },
  pickup:     { ms: 'Pikap',      en: 'Pickup' },
  van:        { ms: 'Van',        en: 'Van' },
  lorry:      { ms: 'Lori',       en: 'Lorry' },
  motorcycle: { ms: 'Motosikal',  en: 'Motorcycle' },
};

export const ENERGIES: Record<Energy, { ms: string; en: string }> = {
  petrol: { ms: 'Petrol',  en: 'Petrol' },
  diesel: { ms: 'Diesel',  en: 'Diesel' },
  ev:     { ms: 'Elektrik', en: 'Electric' },
  hybrid: { ms: 'Hibrid',  en: 'Hybrid' },
  phev:   { ms: 'Hibrid Plug-in', en: 'Plug-in hybrid' },
};

// A petrol car is the base every other combustion list is a delta from.
const PETROL = [
  'Engine oil', 'Oil filter', 'Air filter', 'Cabin filter', 'Spark plug', 'Brake pads',
  'Brake fluid', 'Tyres', 'Tyre rotation', 'Alignment', 'Battery', 'Coolant',
  'ATF / gearbox oil', 'Wipers',
];

const CAR: Record<Energy, string[]> = {
  petrol: PETROL,
  // No spark plug in a compression-ignition engine; fuel filtration and the DPF are its own.
  diesel: [...PETROL.filter((i) => i !== 'Spark plug'),
    'Fuel filter', 'Fuel water separator', 'DPF service'],
  hybrid: [...PETROL, 'Hybrid battery inspection', 'Inverter coolant'],
  phev:   [...PETROL, 'Hybrid battery inspection', 'Inverter coolant', 'Charging cable check'],
  ev: [
    'Cabin filter', 'Brake pads', 'Brake fluid', 'Tyres', 'Tyre rotation', 'Alignment',
    'Battery coolant', '12V battery', 'Software update', 'Wipers',
  ],
};

// A bike shares almost nothing with a car, so it takes its own base rather than a filtered one.
const BIKE = {
  combustion: [
    'Engine oil', 'Oil filter', 'Air filter', 'Chain & sprocket', 'Chain lube',
    'Brake pads', 'Tyres', 'Battery', 'Spark plug',
  ],
  ev: [
    'Brake pads', 'Tyres', 'Chain & sprocket', 'Battery coolant', '12V battery',
    'Software update',
  ],
};

const BODY_EXTRA: Partial<Record<Body, string[]>> = {
  lorry:  ['Brake drums', 'Leaf spring / suspension', 'Differential oil', 'Puspakom inspection'],
  van:    ['Brake drums', 'Leaf spring / suspension', 'Differential oil', 'Puspakom inspection'],
  pickup: ['Differential oil', '4WD transfer case'],
};

const dedupe = (list: string[]) => [...new Set(list)];

/** The list this vehicle type is born with, before the owner edits it. */
export function defaultPresets(body: Body, energy: Energy): string[] {
  if (body === 'motorcycle') {
    if (energy === 'ev') return dedupe(BIKE.ev);
    // The same energy deltas the car path applies, so "diesel" and "hybrid" mean the same
    // thing on two wheels as on four. Rare combinations, but the two fields are orthogonal
    // by design and every pairing has to produce a sane list.
    const base = energy === 'diesel'
      ? [...BIKE.combustion.filter((i) => i !== 'Spark plug'), 'Fuel filter']
      : BIKE.combustion;
    return dedupe(energy === 'hybrid' || energy === 'phev'
      ? [...base, 'Hybrid battery inspection']
      : base);
  }
  return dedupe([...CAR[energy], ...(BODY_EXTRA[body] ?? [])]);
}

/** Defaults, plus what the owner added, minus what they removed. */
export function presetsFor(
  body: Body, energy: Energy, customs: string[] = [], hidden: string[] = [],
): string[] {
  const gone = new Set(hidden);
  return dedupe([...defaultPresets(body, energy), ...customs]).filter((i) => !gone.has(i));
}

/** Presets and removals are stored against this pair, so every petrol sedan shares one list. */
export const typeKey = (body: Body, energy: Energy) => `${body}:${energy}`;

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

/**
 * Pre-fill for the reminder offered after an item is logged. `0` means that dimension does not
 * apply to the item — brake pads wear by distance, a software update lands by calendar.
 */
export const SUGGEST: Record<string, { months: number; km: number }> = {
  'Engine oil':                { months: 6,  km: 5000 },
  'Oil filter':                { months: 6,  km: 5000 },
  'Air filter':                { months: 12, km: 10000 },
  'Cabin filter':              { months: 12, km: 10000 },
  'Fuel filter':               { months: 12, km: 20000 },
  'Fuel water separator':      { months: 12, km: 20000 },
  'DPF service':               { months: 24, km: 60000 },
  'Spark plug':                { months: 0,  km: 20000 },
  'Brake pads':                { months: 0,  km: 30000 },
  'Brake fluid':               { months: 24, km: 40000 },
  'Brake drums':               { months: 0,  km: 40000 },
  'Tyres':                     { months: 0,  km: 40000 },
  'Tyre rotation':             { months: 0,  km: 10000 },
  'Alignment':                 { months: 12, km: 10000 },
  'Battery':                   { months: 24, km: 0 },
  '12V battery':               { months: 36, km: 0 },
  'Coolant':                   { months: 24, km: 40000 },
  'Battery coolant':           { months: 36, km: 60000 },
  'Inverter coolant':          { months: 36, km: 60000 },
  'Hybrid battery inspection': { months: 12, km: 20000 },
  'Charging cable check':      { months: 12, km: 0 },
  'ATF / gearbox oil':         { months: 24, km: 40000 },
  'Differential oil':          { months: 24, km: 40000 },
  '4WD transfer case':         { months: 24, km: 40000 },
  'Leaf spring / suspension':  { months: 0,  km: 50000 },
  'Chain & sprocket':          { months: 0,  km: 15000 },
  'Chain lube':                { months: 0,  km: 800 },
  'Software update':           { months: 12, km: 0 },
  'Puspakom inspection':       { months: 12, km: 0 },
  'Wipers':                    { months: 12, km: 0 },
};

/**
 * Which log kinds this vehicle can hold — the whole of the multi-fuel design.
 *
 * `hybrid` is a self-charging HEV: it never draws from the grid, so it is a fuel-only vehicle
 * whose km/L happens to be good. Only a PHEV holds both.
 */
export function kindsFor(energy: Energy): LogKind[] {
  if (energy === 'ev') return ['charge'];
  if (energy === 'phev') return ['fuel', 'charge'];
  return ['fuel'];
}

/** Suggestions, not a closed set — the field takes free text so no station is ever blocked. */
export function gradesFor(energy: Energy, kind: LogKind): string[] {
  if (kind === 'charge') return ['AC home', 'AC public', 'DC fast'];
  if (energy === 'diesel') return ['Diesel B7', 'Diesel B10', 'Euro 5'];
  return ['RON95', 'RON97', 'RON100'];
}

export const unitFor = (kind: LogKind): 'L' | 'kWh' => (kind === 'fuel' ? 'L' : 'kWh');

/** One nullable number on the vehicle, whose meaning follows the type. */
export function engineSpec(body: Body, energy: Energy) {
  if (energy === 'ev') return { label: 'Battery', unit: 'kWh', placeholder: '60.5', step: '0.1' };
  if (body === 'motorcycle') return { label: 'Engine capacity', unit: 'cc', placeholder: '150', step: '1' };
  return { label: 'Engine capacity', unit: 'L', placeholder: '1.5', step: '0.1' };
}
