// The vehicle detail page: Task 9's Cluster and DocPair up top, then this task's own segmented
// row over two panes it actually builds (Service, Fuel) and two it only stubs (Remind, Docs —
// Task 12's). Self-contained the same way Vehicles.tsx is: each pane owns its own sheet's
// open/editing state, since neither is part of the shell's `detailId` navigation contract.
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Wrench, Fuel, Zap, Bell, FileText, Plus, Pencil } from 'lucide-react';
import {
  economy, spend, costPerKm, serviceTotal, addMonths, todayISO, withoutVehicle,
  type GarageData, type Vehicle, type Service, type EnergyLog, type Reminder, type OdoLog,
} from '../../lib/garage';
import { BODIES, ENERGIES, engineSpec, kindsFor, unitFor, type LogKind } from '../../lib/garage-presets';
import { Cluster, DocPair, Row, Empty, fmtKm, fmtRM, fmtRM0, niceDate } from './parts';
import { VehicleSheet, ServiceSheet, EnergySheet, OdoSheet } from './sheets';
import { useT } from '../../lib/lang';

const num = { fontVariantNumeric: 'tabular-nums' } as const;

type Segment = 'service' | 'fuel' | 'remind' | 'docs';

/**
 * Same full-to-full windowing `economy()` in garage.ts uses, but keeping each window's own rate
 * instead of summing them into one figure — the fuel pane shows what THIS fill measured, not
 * just the running total. Not hoisted into garage.ts: nothing outside this list needs a
 * per-window result, so a shared helper would only be indirection for one call site.
 */
function legEconomy(logs: EnergyLog[]): Map<string, { rate: number; unit: string }> {
  const sorted = [...logs].sort((a, b) => a.odo - b.odo);
  const out = new Map<string, { rate: number; unit: string }>();
  let openedAt = -1;
  let pending = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (openedAt >= 0) pending += Number(sorted[i].qty) || 0;
    if (!sorted[i].full) continue;
    if (openedAt >= 0) {
      const dist = sorted[i].odo - sorted[openedAt].odo;
      if (pending > 0 && dist > 0) {
        out.set(sorted[i].id, { rate: dist / pending, unit: `km/${unitFor(sorted[i].kind)}` });
      }
    }
    openedAt = i;
    pending = 0;
  }
  return out;
}

export default function VehicleDetail({ vehicle, data, setData, onBack }: {
  vehicle: Vehicle;
  data: GarageData;
  setData: Dispatch<SetStateAction<GarageData>>;
  /** Called after this vehicle is deleted from its own edit sheet — the shell's persistent Back
   *  button still works either way, but the page can't go on showing a vehicle that no longer
   *  exists in `data` once the delete lands. */
  onBack: () => void;
}) {
  const t = useT();
  const [seg, setSeg] = useState<Segment>('service');
  const [editOpen, setEditOpen] = useState(false);
  const [odoSheetOpen, setOdoSheetOpen] = useState(false);

  const kinds = kindsFor(vehicle.energy);
  // Charge / Energy / Fuel, in that precedence — see the task brief. kindsFor only ever returns
  // ['charge'] (ev), ['fuel','charge'] (phev) or ['fuel'] (everything else), so these three
  // branches are exhaustive.
  const fuelLabel = kinds.length === 1 && kinds[0] === 'charge' ? t('Cas', 'Charge')
    : kinds.length === 2 ? t('Tenaga', 'Energy')
    : t('Bahan api', 'Fuel');
  // An EV owner should never see a petrol pump — the segment's own icon follows the same
  // charge-only check as its label, a mixed PHEV keeps the pump since it genuinely burns fuel too.
  const fuelIcon = kinds.length === 1 && kinds[0] === 'charge' ? Zap : Fuel;

  const SEGMENTS: [Segment, string, typeof Wrench][] = [
    ['service', t('Servis', 'Service'), Wrench],
    ['fuel', fuelLabel, fuelIcon],
    ['remind', t('Peringatan', 'Remind'), Bell],
    ['docs', t('Dokumen', 'Docs'), FileText],
  ];

  const spec = engineSpec(vehicle.body, vehicle.energy);
  const typeLine = [
    t(BODIES[vehicle.body].ms, BODIES[vehicle.body].en),
    t(ENERGIES[vehicle.energy].ms, ENERGIES[vehicle.energy].en),
    vehicle.engine ? `${vehicle.engine} ${spec.unit}` : null,
  ].filter(Boolean).join(' · ');

  const spend12 = spend(data, vehicle.id, addMonths(todayISO(), -12)).total;
  const eff = economy(data, vehicle, kinds[0]);
  const cpk = costPerKm(data, vehicle);
  const stats: { v: string; l: string }[] = [
    { v: fmtRM0(spend12), l: t('12 bulan lepas', '12-month spend') },
    { v: eff ? eff.rate.toFixed(1) : '—', l: eff ? eff.unit : `km/${unitFor(kinds[0])}` },
    { v: cpk != null ? cpk.toFixed(2) : '—', l: t('RM/km', 'RM/km') },
  ];

  const handleSaveVehicle = (v: Vehicle) => {
    setData((d) => ({ ...d, vehicles: d.vehicles.map((x) => (x.id === v.id ? v : x)) }));
    setEditOpen(false);
  };

  const handleDeleteVehicle = (id: string) => {
    setData((d) => withoutVehicle(d, id));
    setEditOpen(false);
    onBack();
  };

  const handleSaveOdo = (reading: OdoLog) => {
    setData((d) => ({ ...d, odo: [...d.odo, reading] }));
    setOdoSheetOpen(false);
  };

  return (
    <div className="px-1 pb-2">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-display text-[11px] uppercase tracking-[0.14em] text-muted truncate">{typeLine}</p>
          <h1 className="font-bold text-xl leading-tight truncate">{vehicle.nickname || vehicle.model}</h1>
          {vehicle.nickname && <p className="text-sm text-muted truncate">{[vehicle.brand, vehicle.model].filter(Boolean).join(' ')}</p>}
        </div>
        <button onClick={() => setEditOpen(true)} aria-label={t('Sunting kenderaan', 'Edit vehicle')}
          className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-muted hover:text-text bg-text/5 hover:bg-text/10">
          <Pencil size={18} />
        </button>
      </div>

      <Cluster vehicle={vehicle} data={data} />
      <button onClick={() => setOdoSheetOpen(true)}
        className="text-xs text-muted hover:text-text underline underline-offset-2 mt-2 mb-4 px-1 min-h-[44px]">
        {t('Kemas kini odometer sahaja', 'Just update the odometer')}
      </button>

      <DocPair vehicle={vehicle} data={data} onOpen={() => setSeg('docs')} />

      <div className="grid grid-cols-3 gap-2 mt-3">
        {stats.map((s) => (
          <div key={s.l} className="rounded-xl border border-text/10 bg-surface px-2.5 py-3 text-center">
            <b className="block font-mono text-base font-bold" style={num}>{s.v}</b>
            <span className="block text-[10.5px] text-muted mt-0.5 uppercase tracking-wide">{s.l}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-1 bg-text/5 p-1 rounded-xl mt-4 mb-1">
        {SEGMENTS.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setSeg(key)}
            className={`py-2 text-[10px] font-bold rounded-lg transition-all flex flex-col items-center gap-1 ${
              seg === key ? 'bg-surface text-emerald-400 light:text-emerald-700 shadow-sm' : 'text-muted hover:text-text'}`}>
            <Icon size={16} />{label}
          </button>
        ))}
      </div>

      {seg === 'service' && <ServicePane vehicle={vehicle} data={data} setData={setData} />}
      {seg === 'fuel' && <EnergyPane vehicle={vehicle} data={data} setData={setData} />}
      {seg === 'remind' && (
        <Empty title={t('Peringatan', 'Reminders')} hint={t('Akan dibina dalam kemas kini seterusnya.', 'Coming in a later update.')} />
      )}
      {seg === 'docs' && (
        <Empty title={t('Dokumen', 'Documents')} hint={t('Akan dibina dalam kemas kini seterusnya. Roadtax dan insurans ditunjukkan di atas.', 'Coming in a later update. Road tax and insurance are shown above.')} />
      )}

      <VehicleSheet
        key={editOpen ? vehicle.id : 'closed'}
        open={editOpen}
        vehicle={vehicle}
        data={data}
        onClose={() => setEditOpen(false)}
        onSave={handleSaveVehicle}
        onDelete={handleDeleteVehicle}
      />
      <OdoSheet
        key={odoSheetOpen ? 'open' : 'closed'}
        open={odoSheetOpen}
        vehicle={vehicle}
        data={data}
        onClose={() => setOdoSheetOpen(false)}
        onSave={handleSaveOdo}
      />
    </div>
  );
}

/** Service visits, newest first. */
function ServicePane({ vehicle, data, setData }: {
  vehicle: Vehicle; data: GarageData; setData: Dispatch<SetStateAction<GarageData>>;
}) {
  const t = useT();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);

  const openCreate = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (s: Service) => { setEditing(s); setSheetOpen(true); };

  const handleSave = (service: Service, reminder?: Reminder) => {
    setData((d) => ({
      ...d,
      services: editing ? d.services.map((s) => (s.id === service.id ? service : s)) : [...d.services, service],
      reminders: reminder ? [...d.reminders, reminder] : d.reminders,
    }));
    setSheetOpen(false);
  };

  const handleDelete = (id: string) => {
    setData((d) => ({ ...d, services: d.services.filter((s) => s.id !== id) }));
    setSheetOpen(false);
  };

  const list = data.services.filter((s) => s.vehicleId === vehicle.id).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <button onClick={openCreate}
        className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-primary text-[#ffffff] text-sm font-bold min-h-[44px] hover:opacity-90 mb-3">
        <Plus size={16} /> {t('Log servis', 'Log service')}
      </button>

      {list.length === 0 ? (
        <Empty title={t('Belum ada rekod servis', 'No service records yet')}
          hint={t('Ketik "Log servis" untuk mula.', 'Tap "Log service" to get started.')} />
      ) : (
        <div className="space-y-2">
          {list.map((s) => (
            <Row key={s.id}
              title={s.items.map((i) => i.label).join(', ') || t('Servis', 'Service')}
              sub={[niceDate(s.date), `${fmtKm(s.odo)} km`, s.workshop].filter(Boolean).join(' · ')}
              amount={fmtRM0(serviceTotal(s))}
              onClick={() => openEdit(s)}
            />
          ))}
        </div>
      )}

      <ServiceSheet
        key={sheetOpen ? (editing?.id ?? 'new') : 'closed'}
        open={sheetOpen}
        vehicle={vehicle}
        service={editing}
        data={data}
        onClose={() => setSheetOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}

/** Fuel/charge entries by odometer descending, with an economy summary above — two lines for a
 *  vehicle that holds both kinds, since neither one alone is the vehicle's true efficiency. */
function EnergyPane({ vehicle, data, setData }: {
  vehicle: Vehicle; data: GarageData; setData: Dispatch<SetStateAction<GarageData>>;
}) {
  const t = useT();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<EnergyLog | null>(null);

  const openCreate = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (e: EnergyLog) => { setEditing(e); setSheetOpen(true); };

  const handleSave = (entry: EnergyLog) => {
    setData((d) => ({ ...d, energy: editing ? d.energy.map((e) => (e.id === entry.id ? entry : e)) : [...d.energy, entry] }));
    setSheetOpen(false);
  };

  const handleDelete = (id: string) => {
    setData((d) => ({ ...d, energy: d.energy.filter((e) => e.id !== id) }));
    setSheetOpen(false);
  };

  const kinds = kindsFor(vehicle.energy);
  const summaries = kinds.map((k) => ({ kind: k, eco: economy(data, vehicle, k) }));
  const hasSummary = summaries.some((s) => s.eco);

  const list = data.energy.filter((e) => e.vehicleId === vehicle.id).sort((a, b) => b.odo - a.odo);

  // Per-entry rate for whichever fill/charge CLOSED a full-to-full window — built once per kind
  // present, since legEconomy only ever compares entries of the same kind against each other.
  const legMap = new Map<string, { rate: number; unit: string }>();
  for (const k of kinds) {
    const subset = data.energy.filter((e) => e.vehicleId === vehicle.id && e.kind === k);
    for (const [id, v] of legEconomy(subset)) legMap.set(id, v);
  }

  const kindLabel = (k: LogKind) => (k === 'charge' ? t('Cas', 'Charge') : t('Bahan api', 'Fuel'));

  // Wording follows the vehicle, the same precedence as the segment's own label: an EV owner
  // never reads "fuel", a petrol/diesel/hybrid owner never reads "charge".
  const logVerb = kinds.length === 1 && kinds[0] === 'charge' ? t('Log cas', 'Log charge')
    : kinds.length === 2 ? t('Log isi/cas', 'Log fill/charge')
    : t('Log isi minyak', 'Log fill');
  const emptyTitle = kinds.length === 1 && kinds[0] === 'charge' ? t('Belum ada rekod cas', 'No charge records yet')
    : kinds.length === 2 ? t('Belum ada rekod tenaga', 'No fuel/charge records yet')
    : t('Belum ada rekod minyak', 'No fuel records yet');

  return (
    <div>
      {hasSummary && (
        <div className="mb-3 space-y-1">
          {summaries.map(({ kind, eco }) => eco && (
            <p key={kind} className="text-sm px-1">
              <span className="text-muted">{kindLabel(kind)}: </span>
              <b className="font-mono" style={num}>{eco.rate.toFixed(1)} {eco.unit}</b>
              <span className="text-muted"> · {fmtKm(eco.dist)} km · {fmtRM0(eco.spend)}</span>
            </p>
          ))}
          {kinds.length === 2 && (
            <p className="text-xs text-muted px-1">
              {t('Kedua-duanya bukan angka kecekapan sebenar berasingan — RM/km (di bahagian atas halaman) ialah angka yang boleh dibandingkan.',
                 "Neither figure alone is the real efficiency — RM/km, at the top of this page, is the one that's comparable.")}
            </p>
          )}
        </div>
      )}

      <button onClick={openCreate}
        className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-primary text-[#ffffff] text-sm font-bold min-h-[44px] hover:opacity-90 mb-3">
        <Plus size={16} /> {logVerb}
      </button>

      {list.length === 0 ? (
        <Empty title={emptyTitle} hint={t(`Ketik "${logVerb}" untuk mula.`, `Tap "${logVerb}" to get started.`)} />
      ) : (
        <div className="space-y-2">
          {list.map((e) => {
            const leg = legMap.get(e.id);
            return (
              <Row key={e.id}
                title={`${(Number(e.qty) || 0).toFixed(1)} ${unitFor(e.kind)}${e.grade ? ' · ' + e.grade : ''}`}
                sub={
                  <>
                    {niceDate(e.date)} · <span style={num}>{fmtKm(e.odo)} km</span>
                    {!e.full && <> · {t('separuh', 'partial')}</>}
                    {leg && <> · <span style={num}>{leg.rate.toFixed(1)} {leg.unit}</span></>}
                  </>
                }
                // fmtRM, not fmtRM0: this is the exact cost the owner typed in, worth comparing
                // against a receipt to the cent — the RM0 rounding is fine for the aggregate
                // spend figures above, but wrong here.
                amount={fmtRM(e.cost)}
                onClick={() => openEdit(e)}
              />
            );
          })}
        </div>
      )}

      <EnergySheet
        key={sheetOpen ? (editing?.id ?? 'new') : 'closed'}
        open={sheetOpen}
        vehicle={vehicle}
        data={data}
        entry={editing}
        onClose={() => setSheetOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
