// The vehicle detail page: Task 9's Cluster and DocPair up top, then this task's own segmented
// row over two panes it actually builds (Service, Fuel) and two it only stubs (Remind, Docs —
// Task 12's). Self-contained the same way Vehicles.tsx is: each pane owns its own sheet's
// open/editing state, since neither is part of the shell's `detailId` navigation contract.
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Wrench, Fuel, Bell, FileText, Plus, Pencil } from 'lucide-react';
import {
  economy, spend, costPerKm, serviceTotal, addMonths, todayISO,
  type GarageData, type Vehicle, type Service, type EnergyLog, type Reminder, type OdoLog,
} from '../../lib/garage';
import { BODIES, ENERGIES, engineSpec, kindsFor, unitFor, type LogKind } from '../../lib/garage-presets';
import { Cluster, DocPair, Row, Empty, fmtKm, fmtRM0, niceDate } from './parts';
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

  const SEGMENTS: [Segment, string, typeof Wrench][] = [
    ['service', t('Servis', 'Service'), Wrench],
    ['fuel', fuelLabel, Fuel],
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

  // Mirrors Vehicles.tsx's own handleDelete — the same cascade has to run wherever a vehicle can
  // be deleted from, or the next sync just re-uploads whatever this copy left orphaned.
  const handleDeleteVehicle = (id: string) => {
    setData((d) => ({
      ...d,
      vehicles: d.vehicles.filter((v) => v.id !== id),
      services: d.services.filter((s) => s.vehicleId !== id),
      docs: d.docs.filter((x) => x.vehicleId !== id),
      energy: d.energy.filter((e) => e.vehicleId !== id),
      odo: d.odo.filter((o) => o.vehicleId !== id),
      reminders: d.reminders.filter((r) => r.vehicleId !== id),
    }));
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

  return (
    <div>
      {hasSummary && (
        <div className="mb-3 space-y-1">
          {summaries.map(({ kind, eco }) => eco && (
            <p key={kind} className="text-sm px-1">
              <span className="text-muted">{kindLabel(kind)}: </span>
              <b style={num}>{eco.rate.toFixed(1)} {eco.unit}</b>
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
        <Plus size={16} /> {t('Log isi/cas', 'Log fill/charge')}
      </button>

      {list.length === 0 ? (
        <Empty title={t('Belum ada rekod tenaga', 'No fuel/charge records yet')}
          hint={t('Ketik "Log isi/cas" untuk mula.', 'Tap "Log fill/charge" to get started.')} />
      ) : (
        <div className="space-y-2">
          {list.map((e) => {
            const leg = legMap.get(e.id);
            return (
              <Row key={e.id}
                title={`${Number(e.qty).toFixed(1)} ${unitFor(e.kind)}${e.grade ? ' · ' + e.grade : ''}`}
                sub={[
                  niceDate(e.date),
                  `${fmtKm(e.odo)} km`,
                  !e.full ? t('separuh', 'partial') : null,
                  leg ? `${leg.rate.toFixed(1)} ${leg.unit}` : null,
                ].filter(Boolean).join(' · ')}
                amount={fmtRM0(e.cost)}
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
