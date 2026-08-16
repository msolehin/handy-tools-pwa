// Garaj's home screen — the first thing a returning owner sees, so it leads with whichever
// vehicle they last looked at rather than making them pick one every time. Self-contained the
// same way every other tab is: it owns its own vehicle-picker sheet state, and reaches into
// `data`/`setData` only for the one mutation it actually performs (ticking a reminder done).
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  dueItems, tickReminder, serviceTotal, type GarageData, type Vehicle, type DueItem,
  type Service, type EnergyLog, type OdoLog,
} from '../../lib/garage';
import { BODIES, ENERGIES, unitFor } from '../../lib/garage-presets';
import { Cluster, DocPair, DueRow, Eyebrow, Empty, Row, Sheet, avatarOf, fmtKm, fmtRM, fmtRM0, niceDate } from './parts';
import { useT, t as tr } from '../../lib/lang';

/** How many rows each capped list on this screen shows — a home screen previews, it does not
 *  replace the vehicle detail page or a future Costs tab, which is where the rest lives. */
const DUE_CAP = 6;
const RECENT_CAP = 5;

export default function Overview({ data, setData, vehicleId, setVehicleId, onOpenVehicle }: {
  data: GarageData;
  setData: React.Dispatch<React.SetStateAction<GarageData>>;
  vehicleId: string | null;
  setVehicleId: (id: string) => void;
  /** Opens the vehicle's detail page — the shell's `setDetailId`. */
  onOpenVehicle: (id: string) => void;
}) {
  const t = useT();
  const [pickerOpen, setPickerOpen] = useState(false);

  // The remembered vehicle may be gone (deleted) or never set (first run) — fall back to the
  // first vehicle in the fleet for THIS render, and persist that choice so next time it's the
  // remembered one again rather than re-guessing on every load.
  const selected = data.vehicles.find((v) => v.id === vehicleId) ?? data.vehicles[0];
  useEffect(() => {
    if (selected && selected.id !== vehicleId) setVehicleId(selected.id);
  }, [selected, vehicleId, setVehicleId]);

  if (data.vehicles.length === 0) {
    return (
      <div className="px-1 pb-2">
        <Empty title={t('Belum ada kenderaan', 'No vehicles yet')}
          hint={t('Tambah kenderaan pertama anda dari tab Kenderaan.', 'Add your first vehicle from the Vehicles tab.')} />
      </div>
    );
  }

  const due = dueItems(data).slice(0, DUE_CAP);
  const handleTick = (item: DueItem) => setData((d) => tickReminder(d, item.id));

  // Garage-wide, not just `selected` — the Overview is the whole-garage screen (see "What's due"
  // above, already cross-vehicle), and the per-vehicle feed already exists on the detail page's
  // own panes. Each row is tagged with its vehicle below so a multi-car list stays readable.
  const recent = mergeRecent(data).slice(0, RECENT_CAP);

  return (
    <div className="px-1 pb-2">
      <button onClick={() => setPickerOpen(true)}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-text/10 bg-surface px-3.5 py-3 min-h-[44px] mb-3 hover:bg-text/5">
        <div className="min-w-0 flex items-center gap-2.5">
          {avatarOf(selected, 32)}
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium truncate">{selected.nickname || selected.model}</p>
            <p className="text-xs text-muted truncate">{[selected.brand, selected.model].filter(Boolean).join(' ')}</p>
          </div>
        </div>
        <ChevronDown size={16} className="text-muted shrink-0" />
      </button>

      <button onClick={() => onOpenVehicle(selected.id)} className="w-full text-left">
        <Cluster vehicle={selected} data={data} />
      </button>

      <div className="mt-3">
        <DocPair vehicle={selected} data={data} onOpen={() => onOpenVehicle(selected.id)} />
      </div>

      <Eyebrow count={due.length ? String(due.length) : undefined}>
        {t('Perlu perhatian — semua kenderaan', "What's due — every vehicle")}
      </Eyebrow>
      {due.length === 0 ? (
        <p className="text-sm text-muted text-center py-4">{t('Semua elok buat masa ini.', 'All clear for now.')}</p>
      ) : (
        <div className="space-y-2">
          {due.map((item) => (
            <DueRow key={`${item.kind}-${item.id}`} item={item}
              onOpen={(it) => onOpenVehicle(it.vehicle.id)} onTick={handleTick} />
          ))}
        </div>
      )}

      <Eyebrow>{t('Terkini', 'Recent')}</Eyebrow>
      {recent.length === 0 ? (
        <Empty title={t('Belum ada rekod', 'No records yet')}
          hint={t('Log servis atau isi minyak untuk mana-mana kenderaan akan muncul di sini.', 'A service or fill-up for any vehicle will show up here.')} />
      ) : (
        <div className="space-y-2">
          {recent.map((r) => (
            <Row key={`${r.kind}-${r.id}`} title={r.title}
              sub={
                <>
                  {niceDate(r.date)} ·{' '}
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-text/5 text-muted truncate max-w-[9rem] inline-block align-bottom">
                    {r.vehicle.nickname || r.vehicle.model}
                  </span>
                </>
              }
              amount={r.amount}
              onClick={() => onOpenVehicle(r.vehicle.id)} />
          ))}
        </div>
      )}

      <VehiclePicker open={pickerOpen} data={data} onClose={() => setPickerOpen(false)} onSelect={setVehicleId} />
    </div>
  );
}

interface RecentRow {
  id: string; date: string; kind: 'service' | 'energy' | 'odo'; title: string; amount?: string; vehicle: Vehicle;
}

/** Services, energy logs and odo updates across the whole garage, on one timeline — the
 *  "what's happened lately" feed a single vehicle's detail page can't show. `vehicle` rides
 *  along on each row (rather than a bare `vehicleId`) purely so the render side doesn't have to
 *  re-look it up; a row whose vehicle was deleted out from under it is dropped, not shown blank. */
function mergeRecent(data: GarageData): RecentRow[] {
  const byId = new Map(data.vehicles.map((v) => [v.id, v]));

  const services: RecentRow[] = data.services.flatMap((s: Service) => {
    const vehicle = byId.get(s.vehicleId);
    if (!vehicle) return [];
    return [{ id: s.id, date: s.date, kind: 'service' as const, vehicle,
      title: s.items.map((i) => i.label).join(', ') || tr('Servis', 'Service'), amount: fmtRM0(serviceTotal(s)) }];
  });

  const energy: RecentRow[] = data.energy.flatMap((e: EnergyLog) => {
    const vehicle = byId.get(e.vehicleId);
    if (!vehicle) return [];
    return [{ id: e.id, date: e.date, kind: 'energy' as const, vehicle,
      title: `${(Number(e.qty) || 0).toFixed(1)} ${unitFor(e.kind)}`, amount: fmtRM(e.cost) }];
  });

  const odo: RecentRow[] = data.odo.flatMap((o: OdoLog) => {
    const vehicle = byId.get(o.vehicleId);
    if (!vehicle) return [];
    return [{ id: o.id, date: o.date, kind: 'odo' as const, vehicle,
      title: tr('Kemas kini odometer', 'Odometer update'), amount: `${fmtKm(o.odo)} km` }];
  });

  return [...services, ...energy, ...odo].sort((a, b) => b.date.localeCompare(a.date));
}

/** A search sheet over the fleet — matches nickname, brand, model, plate or type, so a garage of
 *  ten cars is still a one-line search rather than a scroll. */
function VehiclePicker({ open, data, onClose, onSelect }: {
  open: boolean; data: GarageData; onClose: () => void; onSelect: (id: string) => void;
}) {
  const t = useT();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const matches = (v: Vehicle) => {
    if (!query) return true;
    const typeLine = `${t(BODIES[v.body].ms, BODIES[v.body].en)} ${t(ENERGIES[v.energy].ms, ENERGIES[v.energy].en)}`;
    return [v.nickname, v.brand, v.model, v.plate, typeLine]
      .filter((s): s is string => !!s)
      .some((s) => s.toLowerCase().includes(query));
  };
  const list = data.vehicles.filter(matches);

  return (
    <Sheet open={open} title={t('Pilih kenderaan', 'Choose a vehicle')} onClose={onClose}>
      <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
        placeholder={t('Cari nama, jenama, model atau plat...', 'Search name, brand, model or plate...')}
        className="input-field w-full" />
      {list.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">{t('Tiada kenderaan sepadan', 'No matching vehicles')}</p>
      ) : (
        <div className="space-y-2">
          {list.map((v) => (
            <button key={v.id} onClick={() => { onSelect(v.id); onClose(); }}
              className="w-full flex items-center gap-3 py-3 px-3.5 rounded-xl bg-surface border border-text/10 text-left min-h-[44px] hover:bg-text/5">
              {avatarOf(v, 32)}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{v.nickname || v.model}</p>
                <p className="text-xs text-muted truncate">{[v.brand, v.model].filter(Boolean).join(' ')}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
