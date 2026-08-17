// Garaj's Costs tab: twelve months of what the whole fleet has spent, then a per-vehicle
// breakdown below it. Fleet-wide by design — a single vehicle's own 12-month figure already
// lives on its detail page (Task 11's stat row); this tab is the one place a multi-car owner
// sees the shape of it across every vehicle at once.
import {
  addMonths, costPerKm, economy, serviceTotal, spend, todayISO,
  type GarageData, type Vehicle,
} from '../../lib/garage';
import { kindsFor, unitFor } from '../../lib/garage-presets';
import { Empty, Eyebrow, fmtRM0, SoldTag } from './parts';
import { useT } from '../../lib/lang';

const num = { fontVariantNumeric: 'tabular-nums' } as const;

type Cat = 'service' | 'energy' | 'docs' | 'other';
const CATS: { key: Cat; ms: string; en: string; bar: string }[] = [
  { key: 'service', ms: 'Servis', en: 'Service', bar: 'bg-sky-500' },
  { key: 'energy', ms: 'Tenaga', en: 'Energy', bar: 'bg-amber-500' },
  { key: 'docs', ms: 'Dokumen', en: 'Documents', bar: 'bg-violet-500' },
  // Deliberately slate, not a fifth hue off the wheel: sky/amber/violet are taken, and
  // rose/emerald/amber are reserved as the status traffic light elsewhere in the tool — a rose
  // "Other" segment here would read as an alert rather than a neutral leftover bucket.
  { key: 'other', ms: 'Lain-lain', en: 'Other', bar: 'bg-slate-400' },
];

type MonthBucket = { key: string; service: number; energy: number; docs: number; other: number };

/** The trailing 12 calendar months, oldest first — the same `addMonths` off `todayISO()`
 *  VehicleDetail's own "12-month spend" stat already uses, so the two never disagree about
 *  which months count. */
function monthKeys(): string[] {
  return Array.from({ length: 12 }, (_, i) => addMonths(todayISO(), -(11 - i)).slice(0, 7));
}

/** Every service/energy/document cost, bucketed by month. Documents key off `issued || expiry` —
 *  the same date `spend()` in garage.ts charges a document to (note `||`, not `??`: an empty
 *  string from older or imported data must fall through to `expiry` too, not be kept as a
 *  bucket key) — so this chart and a vehicle's own spend figure can never tell two different
 *  stories about which month a renewal cost. */
function buildMonths(data: GarageData): MonthBucket[] {
  const keys = monthKeys();
  const byKey = new Map(keys.map((k) => [k, { key: k, service: 0, energy: 0, docs: 0, other: 0 }]));

  for (const s of data.services) {
    const b = byKey.get(s.date.slice(0, 7));
    if (b) b.service += serviceTotal(s);
  }
  for (const e of data.energy) {
    const b = byKey.get(e.date.slice(0, 7));
    if (b) b.energy += Number(e.cost) || 0;
  }
  for (const doc of data.docs) {
    const date = doc.issued || doc.expiry;
    const b = date ? byKey.get(date.slice(0, 7)) : undefined;
    if (b) b.docs += Number(doc.cost) || 0;
  }
  // A saman or a parking fee is dated by its own date — no issued/expiry subtlety like a
  // document, it is simply paid on the day it is paid (same note as spend()'s own `other` bucket).
  for (const c of data.costs) {
    const b = byKey.get(c.date.slice(0, 7));
    if (b) b.other += Number(c.amount) || 0;
  }

  return keys.map((k) => byKey.get(k)!);
}

// Numbers/dates aren't part of the ms/en toggle anywhere else in Garaj (niceDate in parts.tsx
// hard-codes 'en-MY' too) — a month abbreviation follows the same convention rather than
// inventing its own Malay month table for this one label.
const monthLabel = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-MY', { month: 'short' });

/** Pixel height the tallest month's stack fills — every other month is drawn as a fraction of it,
 *  per the task's own spec, so the chart's scale always matches whatever the busiest month was. */
const BAR_HEIGHT = 140;

export default function Costs({ data, onOpenVehicle }: {
  data: GarageData;
  onOpenVehicle: (id: string) => void;
}) {
  const t = useT();
  const months = buildMonths(data);
  const totals: Record<Cat, number> = { service: 0, energy: 0, docs: 0, other: 0 };
  let maxTotal = 0;
  for (const m of months) {
    totals.service += m.service;
    totals.energy += m.energy;
    totals.docs += m.docs;
    totals.other += m.other;
    maxTotal = Math.max(maxTotal, m.service + m.energy + m.docs + m.other);
  }
  const grandTotal = totals.service + totals.energy + totals.docs + totals.other;

  return (
    <div className="px-1 pb-2">
      <Eyebrow>{t('12 bulan lepas — seluruh garaj', 'Last 12 months — whole garage')}</Eyebrow>

      {grandTotal === 0 ? (
        <Empty title={t('Belum ada perbelanjaan', 'No spending yet')}
          hint={t('Log servis, minyak, dokumen atau kos akan muncul di sini.', 'A service, fuel, document or other cost will show up here.')} />
      ) : (
        <>
          <div className="flex items-end gap-1.5 rounded-xl border border-text/10 bg-surface px-3 pt-4 pb-2"
               style={{ height: BAR_HEIGHT + 40 }}>
            {months.map((m) => {
              const monthTotal = m.service + m.energy + m.docs + m.other;
              return (
                <div key={m.key} className="flex-1 min-w-0 flex flex-col items-center gap-1"
                     title={`${monthLabel(m.key)} · ${fmtRM0(monthTotal)}`}>
                  <div className="w-full flex flex-col justify-end overflow-hidden rounded-t-sm" style={{ height: BAR_HEIGHT }}>
                    {CATS.map(({ key, bar }) => {
                      const value = m[key];
                      if (!value) return null;
                      // Each segment's own share of the CHART'S scale, not of this month's own
                      // total — that's what makes the busiest month's stack reach the top and
                      // every quieter month read as visibly shorter, per the task's own spec.
                      return <div key={key} className={`w-full ${bar}`} style={{ height: (value / maxTotal) * BAR_HEIGHT }} />;
                    })}
                  </div>
                  <span className="text-[9px] text-muted">{monthLabel(m.key)}</span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 px-1">
            {CATS.map(({ key, ms, en, bar }) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${bar}`} />
                <span className="text-muted">{t(ms, en)}</span>
                <b className="font-mono" style={num}>{fmtRM0(totals[key])}</b>
              </div>
            ))}
          </div>
        </>
      )}

      <Eyebrow>{t('Mengikut kenderaan', 'By vehicle')}</Eyebrow>
      {data.vehicles.length === 0 ? (
        <Empty title={t('Belum ada kenderaan', 'No vehicles yet')}
          hint={t('Tambah kenderaan dari tab Kenderaan.', 'Add a vehicle from the Vehicles tab.')} />
      ) : (
        <div className="space-y-2">
          {data.vehicles.map((v) => (
            <VehicleCostRow key={v.id} vehicle={v} data={data} onOpen={() => onOpenVehicle(v.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One vehicle's running figures — 12-month spend, RM/km, and efficiency where a full-to-full
 *  window exists for it yet. Mirrors the three stats VehicleDetail's own header row shows, so a
 *  number here and the same vehicle's detail page never disagree. */
function VehicleCostRow({ vehicle, data, onOpen }: { vehicle: Vehicle; data: GarageData; onOpen: () => void }) {
  const t = useT();
  const spend12 = spend(data, vehicle.id, addMonths(todayISO(), -12)).total;
  const cpk = costPerKm(data, vehicle);
  const kind = kindsFor(vehicle.energy)[0];
  const eff = economy(data, vehicle, kind);

  return (
    <button onClick={onOpen}
      className="w-full flex items-center justify-between gap-3 py-3 px-3.5 rounded-xl bg-surface border border-text/10 text-left min-h-[44px] hover:bg-text/5">
      <div className="min-w-0">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <span className="truncate min-w-0">{vehicle.nickname || vehicle.model}</span>
          {vehicle.archived && <SoldTag />}
        </p>
        <p className="text-xs text-muted truncate">{[vehicle.brand, vehicle.model].filter(Boolean).join(' ')}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-right">
        <div>
          <b className="block font-mono text-sm" style={num}>{fmtRM0(spend12)}</b>
          <span className="block text-[10px] text-muted uppercase tracking-wide">{t('12 bln', '12mo')}</span>
        </div>
        <div>
          <b className="block font-mono text-sm" style={num}>{cpk != null ? cpk.toFixed(2) : '—'}</b>
          <span className="block text-[10px] text-muted uppercase tracking-wide">{t('RM/km', 'RM/km')}</span>
        </div>
        <div>
          <b className="block font-mono text-sm" style={num}>{eff ? eff.rate.toFixed(1) : '—'}</b>
          <span className="block text-[10px] text-muted uppercase tracking-wide">{eff ? eff.unit : `km/${unitFor(kind)}`}</span>
        </div>
      </div>
    </button>
  );
}
