// Garaj's home screen — the first thing a returning owner sees, so it leads with whichever
// vehicle they last looked at rather than making them pick one every time. Self-contained the
// same way every other tab is: it owns its own vehicle-picker sheet state, and reaches into
// `data`/`setData` only for the one mutation it actually performs (ticking a reminder done).
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  activeVehicles, dueItems, tickReminder, serviceTotal, upsert, upsertService,
  type GarageData, type Vehicle, type DueItem,
  type Service, type EnergyLog, type OdoLog, type Reminder, type VDoc, type Cost,
} from '../../lib/garage';
import { BODIES, ENERGIES, kindsFor, unitFor } from '../../lib/garage-presets';
import { AddButton, Cluster, DocPair, DueRow, Eyebrow, Empty, Row, Sheet, SoldTag, avatarOf, fmtKm, fmtRM, fmtRM0, niceDate } from './parts';
import { ServiceSheet } from './sheets';
import { EnergySheet, OdoSheet, ReminderSheet, DocumentSheet, CostSheet } from './logSheets';
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

  // The quick-add sheet just names what to log; the actual work happens in whichever form sheet
  // it hands off to below. Each of those six owns its own open flag — always opened fresh for a
  // NEW record, never an edit, so unlike VehicleDetail's panes there is no `editing` state to
  // thread through: upsert() below still does the right thing either way.
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [energyOpen, setEnergyOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [odoOpen, setOdoOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);

  // The remembered vehicle may be gone (deleted), sold (archived), or never set (first run) —
  // fall back to the first ACTIVE vehicle in the fleet for THIS render, and persist that choice
  // so next time it's the remembered one again rather than re-guessing on every load. Falling
  // through to `fleet[0]` is the entire mechanism by which "selecting an archived vehicle" is
  // impossible here: an archived id simply isn't in `fleet` to be found.
  const fleet = activeVehicles(data);
  const selected = fleet.find((v) => v.id === vehicleId) ?? fleet[0];
  useEffect(() => {
    if (selected && selected.id !== vehicleId) setVehicleId(selected.id);
  }, [selected, vehicleId, setVehicleId]);

  if (!selected) {
    return (
      <div className="px-1 pb-2">
        <Empty title={t('Belum ada kenderaan', 'No vehicles yet')}
          hint={data.vehicles.length > 0
            ? t('Semua kenderaan anda ditandakan dijual. Pulihkan satu dari tab Kenderaan.', 'Every vehicle is marked sold. Restore one from the Vehicles tab.')
            : t('Tambah kenderaan pertama anda dari tab Kenderaan.', 'Add your first vehicle from the Vehicles tab.')} />
      </div>
    );
  }

  const due = dueItems(data).slice(0, DUE_CAP);
  const handleTick = (item: DueItem) => setData((d) => tickReminder(d, item.id));

  // Same shape as VehicleDetail's own five save handlers (services/energy/odo/reminders/docs),
  // deliberately not copied from there: upsert() is the one place that "replace if this id
  // already exists, else append" is spelled out, so this and VehicleDetail can't drift apart on
  // what an edit vs. a new record looks like.
  const handleSaveService = (service: Service, reminder?: Reminder) => {
    setData((d) => {
      // upsertService rebuilds this service's warranty reminders; `reminder` is the separate,
      // prompted service-interval suggestion, which is appended rather than rebuilt because the
      // owner explicitly agreed to that one.
      const next = upsertService(d, service);
      return reminder ? { ...next, reminders: [...next.reminders, reminder] } : next;
    });
    setServiceOpen(false);
  };
  const handleSaveEnergy = (entry: EnergyLog) => {
    setData((d) => ({ ...d, energy: upsert(d.energy, entry) }));
    setEnergyOpen(false);
  };
  const handleSaveOdo = (reading: OdoLog) => {
    setData((d) => ({ ...d, odo: upsert(d.odo, reading) }));
    setOdoOpen(false);
  };
  const handleSaveReminder = (reminder: Reminder) => {
    setData((d) => ({ ...d, reminders: upsert(d.reminders, reminder) }));
    setReminderOpen(false);
  };
  const handleSaveDoc = (doc: VDoc) => {
    setData((d) => ({ ...d, docs: upsert(d.docs, doc) }));
    setDocOpen(false);
  };
  const handleSaveCost = (cost: Cost) => {
    setData((d) => ({ ...d, costs: upsert(d.costs, cost) }));
    setCostOpen(false);
  };

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

        <AddButton label={t('Log rekod', 'Log something')} onClick={() => setQuickAddOpen(true)} />

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
                  {/* mergeRecent deliberately includes archived vehicles (see its own comment) —
                      Costs and VehicleDetail both tag a sold vehicle wherever it still appears,
                      so a bare name here would be the one place Recent forgets it was sold. */}
                  {r.vehicle.archived && <> <SoldTag /></>}
                </>
              }
              amount={r.amount}
              onClick={() => onOpenVehicle(r.vehicle.id)} />
          ))}
        </div>
      )}

      <VehiclePicker open={pickerOpen} data={data} onClose={() => setPickerOpen(false)} onSelect={setVehicleId} />

      <QuickAddSheet
        open={quickAddOpen}
        vehicle={selected}
        onClose={() => setQuickAddOpen(false)}
        onPick={(action) => {
          setQuickAddOpen(false);
          if (action === 'energy') setEnergyOpen(true);
          if (action === 'service') setServiceOpen(true);
          if (action === 'reminder') setReminderOpen(true);
          if (action === 'doc') setDocOpen(true);
          if (action === 'odo') setOdoOpen(true);
          if (action === 'cost') setCostOpen(true);
        }}
      />

      {/* The real forms the quick-add sheet hands off to — same six sheets VehicleDetail's own
          panes use, each opened fresh for a new record (no `editing` state here, see above) and
          each keyed on `selected.id` so switching the picked vehicle mid-flow can't leave a form
          holding stale defaults (odometer, presets) from the vehicle it opened against. */}
      <ServiceSheet key={serviceOpen ? selected.id : 'closed'} open={serviceOpen} vehicle={selected} data={data}
        onClose={() => setServiceOpen(false)} onSave={handleSaveService} />
      <EnergySheet key={energyOpen ? selected.id : 'closed'} open={energyOpen} vehicle={selected} data={data}
        onClose={() => setEnergyOpen(false)} onSave={handleSaveEnergy} />
      <OdoSheet key={odoOpen ? selected.id : 'closed'} open={odoOpen} vehicle={selected} data={data}
        onClose={() => setOdoOpen(false)} onSave={handleSaveOdo} />
      <ReminderSheet key={reminderOpen ? selected.id : 'closed'} open={reminderOpen} vehicle={selected} data={data}
        onClose={() => setReminderOpen(false)} onSave={handleSaveReminder} />
      <DocumentSheet key={docOpen ? selected.id : 'closed'} open={docOpen} vehicle={selected}
        onClose={() => setDocOpen(false)} onSave={handleSaveDoc} />
      <CostSheet key={costOpen ? selected.id : 'closed'} open={costOpen} vehicle={selected} data={data}
        onClose={() => setCostOpen(false)} onSave={handleSaveCost} />
    </div>
  );
}

type QuickAddAction = 'energy' | 'service' | 'reminder' | 'doc' | 'odo' | 'cost';

/**
 * "What are you logging?" — the one thing every record type has in common is a vehicle, so this
 * sheet exists purely to ask which KIND before handing off to the real form. `vehicle` goes to
 * `Sheet`'s own vehicle prop (not just the title) so the sheet itself shows who this is for — the
 * whole point of naming it here is that a form opened from this picker can never end up filed
 * against the wrong car.
 *
 * Row titles/hints are plain `Row`s: title, a one-line hint as `sub`, and a chevron for free from
 * `onClick` — the shape already matches what this list needs, so no new row component.
 */
function QuickAddSheet({ open, vehicle, onClose, onPick }: {
  open: boolean; vehicle: Vehicle; onClose: () => void; onPick: (action: QuickAddAction) => void;
}) {
  const t = useT();
  // Same kindsFor() precedence VehicleDetail's own fuelLabel/logVerb use — an EV owner reads
  // "Log a charge" here for exactly the same reason they never see "fuel" anywhere else in Garaj.
  const kinds = kindsFor(vehicle.energy);
  const fillTitle = kinds.length === 1 && kinds[0] === 'charge' ? t('Log cas', 'Log a charge')
    : kinds.length === 2 ? t('Log isi/cas', 'Log a fill/charge')
    : t('Log isi minyak', 'Log a fill-up');

  const actions: { key: QuickAddAction; title: string; hint: string }[] = [
    { key: 'energy', title: fillTitle, hint: t('Tenaga, kos, bacaan odometer', 'Energy, cost, odometer') },
    { key: 'service', title: t('Log lawatan servis', 'Log a service visit'),
      hint: t('Beberapa item, satu bengkel, satu jumlah', 'Several items, one workshop, one total') },
    { key: 'reminder', title: t('Tambah peringatan', 'Add a reminder'),
      hint: t('Ikut tarikh, ikut jarak, atau mana dahulu', 'By date, by mileage, or whichever comes first') },
    { key: 'doc', title: t('Tambah dokumen', 'Add a document'),
      hint: t('Cukai jalan, insurans, Puspakom', 'Road tax, insurance, Puspakom') },
    { key: 'cost', title: t('Log kos', 'Log a cost'),
      hint: t('Saman, tol, aksesori, cuci kereta', 'Summonses, tolls, accessories, car wash') },
    { key: 'odo', title: t('Kemas kini bacaan odometer', 'Update mileage'),
      hint: t('Hanya jika anda mahu — rekod lain buat secara automatik', "Only if you want to — entries do this for you") },
  ];

  return (
    <Sheet open={open} title={t('Apa yang anda log?', 'What are you logging?')}
      sub={vehicle.nickname || vehicle.model} vehicle={vehicle} onClose={onClose}>
      <div className="space-y-2">
        {actions.map((a) => (
          <Row key={a.key} title={a.title} sub={a.hint} onClick={() => onPick(a.key)} />
        ))}
      </div>
    </Sheet>
  );
}

interface RecentRow {
  id: string; date: string; kind: 'service' | 'energy' | 'odo' | 'cost'; title: string; amount?: string; vehicle: Vehicle;
}

/** Services, energy logs, odo updates and other costs across the whole garage, on one timeline —
 *  the "what's happened lately" feed a single vehicle's detail page can't show. `vehicle` rides
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

  const costs: RecentRow[] = data.costs.flatMap((c: Cost) => {
    const vehicle = byId.get(c.vehicleId);
    if (!vehicle) return [];
    return [{ id: c.id, date: c.date, kind: 'cost' as const, vehicle,
      title: c.category, amount: fmtRM(c.amount) }];
  });

  return [...services, ...energy, ...odo, ...costs].sort((a, b) => b.date.localeCompare(a.date));
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
  // A sold vehicle isn't a candidate to switch to — it left the picker the moment it was
  // archived; restoring it (from its own edit sheet) is the only way back in.
  const list = activeVehicles(data).filter(matches);

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
