// Garaj's add/edit forms. `VehicleSheet` is Task 10's; ServiceSheet/EnergySheet/OdoSheet
// (Task 11) and ReminderSheet/DocumentSheet (Task 12) join it in this same file per the SDD's
// own file list — one module, one import, for every sheet in the tool.
import { useRef, useState } from 'react';
import { Trash2, ChevronDown, Image as ImageIcon, X } from 'lucide-react';
import { Sheet, EDGE_COLORS, fmtKm, fmtRM, niceDate } from './parts';
import {
  BODIES, ENERGIES, engineSpec, presetsFor, SUGGEST, kindsFor, gradesFor, unitFor, typeKey,
  type Body, type Energy, type LogKind,
} from '../../lib/garage-presets';
import { addMonths, currentOdo, todayISO, type EnergyLog, type GarageData, type OdoLog, type Reminder, type Service, type Vehicle } from '../../lib/garage';
import { downscaleFile } from '../../lib/downscale';
import { useT } from '../../lib/lang';

// Same scheme every other tool in the app uses for a local id (VehicleServices.tsx,
// DebtTracker.tsx, ExpenseManager.tsx, ...) — short and unique enough for one device's own
// records; a uuid dependency buys nothing here.
const generateId = () => Math.random().toString(36).substring(2, 9);

const num = { fontVariantNumeric: 'tabular-nums' } as const;

const chip = (active: boolean) =>
  `px-3 py-2 rounded-xl text-sm font-medium border min-h-[44px] transition-colors ${
    active ? 'bg-primary border-primary text-[#ffffff]' : 'bg-surface border-text/15 text-text hover:bg-text/5'
  }`;

const fieldLabel = 'text-xs font-bold text-muted uppercase tracking-wider';

/**
 * Create/edit a vehicle. `body` and `energy` are the tool's central idea — two independent
 * chip rows rather than one flat type list — and the engine field below them re-labels itself
 * from `engineSpec(body, energy)` on every render, which is the whole visible point of the
 * split: an EV asks for a battery in kWh, a motorcycle for cc, everything else for litres.
 *
 * `data` is only read for `data.vehicles.length` (the new vehicle's `colorIdx`) — this sheet
 * never writes storage itself; `onSave`/`onDelete` hand a finished `Vehicle` (or its id) back to
 * the caller, which owns the actual `setData` update. That keeps the cascading-delete logic
 * (services/docs/energy/odo/reminders all reference a vehicle) in one place — the tab, not here.
 */
export function VehicleSheet({ open, vehicle, data, onClose, onSave, onDelete }: {
  open: boolean;
  /** Absent (or null) means "creating a new vehicle". */
  vehicle?: Vehicle | null;
  data: GarageData;
  onClose: () => void;
  onSave: (vehicle: Vehicle) => void;
  onDelete?: (id: string) => void;
}) {
  const t = useT();
  const [body, setBody] = useState<Body>(vehicle?.body ?? 'sedan');
  const [energy, setEnergy] = useState<Energy>(vehicle?.energy ?? 'petrol');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [mileage, setMileage] = useState(vehicle?.mileage != null ? String(vehicle.mileage) : '');
  const [nickname, setNickname] = useState(vehicle?.nickname ?? '');
  const [brand, setBrand] = useState(vehicle?.brand ?? '');
  const [plate, setPlate] = useState(vehicle?.plate ?? '');
  const [year, setYear] = useState(vehicle?.year != null ? String(vehicle.year) : '');
  const [engine, setEngine] = useState(vehicle?.engine != null ? String(vehicle.engine) : '');
  const [photo, setPhoto] = useState(vehicle?.photo ?? '');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Deliberately recomputed every render, not memoised: it's a plain object lookup, and this IS
  // the live relabel the task exists to demonstrate — caching it would just be indirection.
  const spec = engineSpec(body, energy);
  const engineLabel = energy === 'ev' ? t('Bateri', 'Battery') : t('Kapasiti enjin', 'Engine capacity');

  const submit = () => {
    const trimmedModel = model.trim();
    if (!trimmedModel) {
      setError(t('Sila masukkan model kenderaan', 'Enter a vehicle model'));
      return;
    }
    const mileageNum = Number(mileage);
    if (mileage.trim() === '' || !Number.isFinite(mileageNum) || mileageNum < 0) {
      setError(t('Masukkan bacaan odometer yang sah (0 atau lebih)', 'Enter a valid mileage (0 or more)'));
      return;
    }
    setError('');
    onSave({
      id: vehicle?.id ?? generateId(),
      body, energy, model: trimmedModel, mileage: mileageNum,
      // Assigned once on create and carried forward on every later edit — re-deriving it from
      // the fleet's current length would let two vehicles collide the moment one is deleted.
      colorIdx: vehicle?.colorIdx ?? (data.vehicles.length % EDGE_COLORS.length),
      createdAt: vehicle?.createdAt ?? Date.now(),
      brand: brand.trim() || undefined,
      nickname: nickname.trim() || undefined,
      plate: plate.trim() || undefined,
      year: year.trim() ? Number(year) : undefined,
      engine: engine.trim() ? Number(engine) : undefined,
      photo: photo || undefined,
    });
  };

  const askDelete = () => {
    if (!vehicle || !onDelete) return;
    const name = vehicle.nickname || vehicle.model;
    // Naming what goes with it — the local copy has to agree with the server's cascade, or the
    // next sync just re-uploads the orphaned rows right back.
    if (!window.confirm(t(
      `Padam ${name}? Semua rekod servis, log tenaga, peringatan dan dokumen kenderaan ini turut dipadam.`,
      `Delete ${name}? Its services, energy logs, reminders and documents all go with it.`
    ))) return;
    onDelete(vehicle.id);
  };

  return (
    <Sheet
      open={open}
      title={vehicle ? (vehicle.nickname || vehicle.model) : t('Tambah kenderaan', 'Add vehicle')}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={vehicle ? t('Simpan', 'Save') : t('Tambah kenderaan', 'Add vehicle')}
      extra={vehicle && onDelete ? (
        <button type="button" onClick={askDelete} aria-label={t('Padam kenderaan', 'Delete vehicle')}
          className="p-1.5 text-muted hover:text-rose-500 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <Trash2 size={18} />
        </button>
      ) : undefined}
    >
      <div className="space-y-1.5">
        <span className={fieldLabel}>{t('Jenis badan', 'Body')}</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BODIES) as Body[]).map((b) => (
            <button key={b} type="button" aria-pressed={body === b} onClick={() => setBody(b)} className={chip(body === b)}>
              {t(BODIES[b].ms, BODIES[b].en)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className={fieldLabel}>{t('Tenaga', 'Energy')}</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ENERGIES) as Energy[]).map((e) => (
            <button key={e} type="button" aria-pressed={energy === e} onClick={() => setEnergy(e)} className={chip(energy === e)}>
              {t(ENERGIES[e].ms, ENERGIES[e].en)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Model', 'Model')} *</label>
        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={t('cth. Myvi 1.5 AV', 'e.g. Myvi 1.5 AV')}
          className="input-field w-full" />
      </div>

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Bacaan odometer semasa (km)', 'Current odometer (km)')} *</label>
        <input type="number" inputMode="numeric" min="0" value={mileage} onChange={(e) => setMileage(e.target.value)}
          placeholder="65000" className="input-field w-full font-mono" style={num} />
      </div>

      {error && <p className="text-sm text-rose-500 light:text-rose-700 font-medium">{error}</p>}

      <details className="group rounded-xl border border-text/10">
        <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden px-3.5 py-3 text-sm font-medium flex items-center justify-between min-h-[44px]">
          {t('Butiran tambahan', 'More details')}
          <ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-3.5 pb-4 pt-1 space-y-3.5 border-t border-text/10">
          <div className="space-y-1.5">
            <label className={fieldLabel}>{t('Nama panggilan', 'Nickname')}</label>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t('cth. Kereta Ayah', "e.g. Dad's car")}
              className="input-field w-full" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={fieldLabel}>{t('Jenama', 'Brand')}</label>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t('cth. Perodua', 'e.g. Toyota')}
                className="input-field w-full" />
            </div>
            <div className="space-y-1.5">
              <label className={fieldLabel}>{t('Tahun', 'Year')}</label>
              <input type="number" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2020"
                className="input-field w-full font-mono" style={num} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={fieldLabel}>{t('No. plat', 'Plate')}</label>
              <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ABC 1234" className="input-field w-full uppercase" />
            </div>
            <div className="space-y-1.5">
              {/* The live relabel: this text and the input's step/placeholder all come from
                  engineSpec(body, energy) above, so flipping either chip row changes what's
                  asked here without any explicit wiring beyond re-reading `spec`. */}
              <label className={fieldLabel}>{engineLabel} ({spec.unit})</label>
              <input type="number" inputMode="decimal" min="0" step={spec.step} value={engine}
                onChange={(e) => setEngine(e.target.value)} placeholder={spec.placeholder}
                className="input-field w-full font-mono" style={num} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={fieldLabel}>{t('Gambar (pilihan)', 'Photo (optional)')}</label>
            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                // 600px — the same budget VehicleServices.tsx used for a card-background photo;
                // plenty to fill a card and keeps the base64 well clear of quota trouble.
                if (file) downscaleFile(file, 600).then(setPhoto).catch(() => {});
              }}
              className="hidden"
              id="vehicle-photo"
            />
            {photo ? (
              <div className="relative h-28 rounded-xl overflow-hidden border border-text/10">
                <img src={photo} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setPhoto(''); if (fileRef.current) fileRef.current.value = ''; }}
                  aria-label={t('Buang gambar', 'Remove photo')}
                  // Literal hex, not `bg-black`/`text-white`: those tokens invert under
                  // html.light (index.css), which would turn this control invisible against a
                  // photo that never changes.
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#000000]/50 text-[#ffffff]/80 hover:text-[#ffffff] backdrop-blur-md"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label htmlFor="vehicle-photo"
                className="flex items-center justify-center gap-2 h-16 rounded-xl border border-dashed border-text/20 text-muted text-sm cursor-pointer hover:bg-text/5 min-h-[44px]">
                <ImageIcon size={16} /> {t('Muat naik gambar', 'Upload a photo')}
              </label>
            )}
          </div>
        </div>
      </details>
    </Sheet>
  );
}

/**
 * Log or edit a service visit. The checklist sits immediately under the sheet's own title,
 * ahead of date/odometer/everything else — that ordering was explicitly requested, not an
 * incidental layout choice. Tapping a chip adds its line item; a per-row X removes it — which
 * matters for a chip-added item too, not just a custom one: a vehicle's `body`/`energy` can be
 * corrected later, or a preset hidden in Task 13's settings, and either can leave an old item on
 * an old service with no chip left to untick it by. The free-text field above the list covers
 * the other gap a fixed checklist can't: a one-off part that was never going to recur.
 *
 * `data` is read for two things only: the vehicle's own preset list (`presetsFor`, keyed off
 * `data.presets`) and a default odometer reading (`currentOdo`) — this sheet never writes
 * storage itself, same division of labour as `VehicleSheet`.
 */
export function ServiceSheet({ open, vehicle, service, data, onClose, onSave, onDelete }: {
  open: boolean;
  vehicle: Vehicle;
  /** Absent (or null) means logging a new visit. */
  service?: Service | null;
  data: GarageData;
  onClose: () => void;
  /** `reminder` is only present when the owner confirmed the post-save prompt below. */
  onSave: (service: Service, reminder?: Reminder) => void;
  onDelete?: (id: string) => void;
}) {
  const t = useT();
  const [items, setItems] = useState<{ label: string; cost: number }[]>(service?.items ?? []);
  const [customLabel, setCustomLabel] = useState('');
  const [date, setDate] = useState(service?.date ?? todayISO());
  const [odo, setOdo] = useState(service?.odo != null ? String(service.odo) : String(currentOdo(data, vehicle)));
  const [workshop, setWorkshop] = useState(service?.workshop ?? '');
  const [notes, setNotes] = useState(service?.notes ?? '');
  const [receipt, setReceipt] = useState(service?.receipt ?? '');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const preset = data.presets[typeKey(vehicle.body, vehicle.energy)];
  const checklist = presetsFor(vehicle.body, vehicle.energy, preset?.customs, preset?.hidden);

  const toggle = (label: string) => {
    setItems((prev) => prev.some((i) => i.label === label)
      ? prev.filter((i) => i.label !== label)
      : [...prev, { label, cost: 0 }]);
  };
  const remove = (label: string) => setItems((prev) => prev.filter((i) => i.label !== label));
  const setCost = (label: string, cost: number) => {
    setItems((prev) => prev.map((i) => (i.label === label ? { ...i, cost } : i)));
  };
  const addCustom = () => {
    const label = customLabel.trim();
    // Silently folds into the existing row rather than erroring — typing a preset's own name
    // (or the same one-off twice) is a duplicate to prevent, not a mistake worth a message.
    if (!label || items.some((i) => i.label === label)) { setCustomLabel(''); return; }
    setItems((prev) => [...prev, { label, cost: 0 }]);
    setCustomLabel('');
  };
  const total = items.reduce((sum, i) => sum + (Number(i.cost) || 0), 0);

  const submit = () => {
    if (!date) { setError(t('Sila pilih tarikh', 'Pick a date')); return; }
    const odoNum = Number(odo);
    if (odo.trim() === '' || !Number.isFinite(odoNum) || odoNum < 0) {
      setError(t('Masukkan bacaan odometer yang sah', 'Enter a valid odometer reading'));
      return;
    }
    setError('');

    const result: Service = {
      id: service?.id ?? generateId(),
      vehicleId: vehicle.id,
      date, odo: odoNum, items,
      workshop: workshop.trim() || undefined,
      notes: notes.trim() || undefined,
      receipt: receipt || undefined,
    };

    // One confirm, not a second form — and only on a genuinely NEW visit. Gated on `!service`:
    // without it, re-saving an existing service just to fix a workshop typo re-fires the same
    // prompt, and accepting would append a second, identical reminder on top of whichever one
    // the first save already created.
    let reminder: Reminder | undefined;
    if (!service) {
      // The first selected item that actually has a trigger (some SUGGEST entries are
      // months:0 km:0 — a software update lands by neither, and is skipped). Multiple matching
      // items still only get one prompt — an oil change nearly always arrives with its filter,
      // and nagging once per item would be worse than nagging once.
      const suggestItem = items.find((i) => {
        const s = SUGGEST[i.label];
        return s && (s.months > 0 || s.km > 0);
      });
      if (suggestItem) {
        const s = SUGGEST[suggestItem.label];
        const dueDate = s.months > 0 ? addMonths(date, s.months) : undefined;
        const dueOdo = s.km > 0 ? odoNum + s.km : undefined;
        const bits = [dueDate ? niceDate(dueDate) : null, dueOdo ? `${fmtKm(dueOdo)} km` : null].filter(Boolean);
        if (window.confirm(t(
          `Tetapkan peringatan untuk "${suggestItem.label}" (${bits.join(' · ')})?`,
          `Set a reminder for "${suggestItem.label}" (${bits.join(' · ')})?`
        ))) {
          reminder = { id: generateId(), vehicleId: vehicle.id, label: suggestItem.label, done: false, dueDate, dueOdo };
        }
      }
    }

    onSave(result, reminder);
  };

  const askDelete = () => {
    if (!service || !onDelete) return;
    if (!window.confirm(t('Padam rekod servis ini?', 'Delete this service record?'))) return;
    onDelete(service.id);
  };

  return (
    <Sheet
      open={open}
      vehicle={vehicle}
      sub={vehicle.nickname || vehicle.model}
      title={service ? t('Sunting servis', 'Edit service') : t('Log servis', 'Log service')}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t('Simpan', 'Save')}
      extra={service && onDelete ? (
        <button type="button" onClick={askDelete} aria-label={t('Padam servis', 'Delete service')}
          className="p-1.5 text-muted hover:text-rose-500 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <Trash2 size={18} />
        </button>
      ) : undefined}
    >
      <div className="space-y-1.5">
        <span className={fieldLabel}>{t('Senarai semak', 'Checklist')}</span>
        <div className="flex flex-wrap gap-2">
          {checklist.map((label) => (
            <button key={label} type="button" aria-pressed={items.some((i) => i.label === label)}
              onClick={() => toggle(label)} className={chip(items.some((i) => i.label === label))}>
              {label}
            </button>
          ))}
        </div>
        {/* The escape hatch a fixed checklist can't cover on its own: a part fitted once, never
            expected to recur, with nowhere else to go (Task 13's custom presets are for the
            RECURRING case). Safe to add now that every row — chip-added or typed here — has its
            own remove X below, so nothing added here can become a dead end. */}
        <div className="flex gap-2">
          <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            placeholder={t('Tambah item lain...', 'Add another item...')}
            className="input-field flex-1" />
          <button type="button" onClick={addCustom}
            className="px-4 rounded-xl border border-text/15 text-sm font-bold text-text hover:bg-text/5 min-w-[44px] min-h-[44px]">
            {t('Tambah', 'Add')}
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border border-text/10 overflow-hidden">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-1 px-3.5 py-2 border-b border-text/10 last:border-b-0">
              <span className="text-sm truncate flex-1 min-w-0">{item.label}</span>
              <input type="number" inputMode="decimal" min="0" step="0.01" value={item.cost || ''}
                onChange={(e) => setCost(item.label, Number(e.target.value))}
                placeholder="0.00" className="input-field w-24 font-mono text-right shrink-0" style={num} />
              <button type="button" onClick={() => remove(item.label)} aria-label={t('Buang item', 'Remove item')}
                className="shrink-0 w-11 h-11 flex items-center justify-center text-muted hover:text-rose-500">
                <X size={16} />
              </button>
            </div>
          ))}
          {/* Literal colours, not text-white/bg-black: this bar sits on `bg-surface`, which
              DOES flip with the theme, so without the fixed-dark treatment (same as Cluster)
              it would wash out under html.light instead of reading as a total. */}
          <div className="flex items-center justify-between px-3.5 py-2.5" style={{ background: '#131B19' }}>
            <span className="font-display text-[11px] uppercase tracking-wider text-[rgba(255,255,255,.5)]">
              {t('Jumlah', 'Total')}
            </span>
            <span className="font-mono font-bold text-[#ffffff]" style={num}>{fmtRM(total)}</span>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Tarikh', 'Date')} *</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field w-full" />
      </div>

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Bacaan odometer (km)', 'Odometer (km)')} *</label>
        <input type="number" inputMode="numeric" min="0" value={odo} onChange={(e) => setOdo(e.target.value)}
          className="input-field w-full font-mono" style={num} />
      </div>

      {error && <p className="text-sm text-rose-500 light:text-rose-700 font-medium">{error}</p>}

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Bengkel', 'Workshop')}</label>
        <input value={workshop} onChange={(e) => setWorkshop(e.target.value)} placeholder={t('cth. Kedai Encik Ali', 'e.g. Toyota Service Centre')}
          className="input-field w-full" />
      </div>

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Nota', 'Notes')}</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field w-full h-16 resize-none py-2" />
      </div>

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Resit (pilihan)', 'Receipt (optional)')}</label>
        <input
          type="file"
          accept="image/*"
          ref={fileRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // 900px — the same budget AssetWarrantyTracker.tsx uses for a receipt photo: a
            // receipt needs its printed total legible, unlike the 600px card-thumbnail budget.
            if (file) downscaleFile(file, 900).then(setReceipt).catch(() => {});
          }}
          className="hidden"
          id="service-receipt"
        />
        {receipt ? (
          <div className="relative h-28 rounded-xl overflow-hidden border border-text/10">
            <img src={receipt} alt="" className="w-full h-full object-contain bg-text/5" />
            <button
              type="button"
              onClick={() => { setReceipt(''); if (fileRef.current) fileRef.current.value = ''; }}
              aria-label={t('Buang resit', 'Remove receipt')}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#000000]/50 text-[#ffffff]/80 hover:text-[#ffffff] backdrop-blur-md"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <label htmlFor="service-receipt"
            className="flex items-center justify-center gap-2 h-16 rounded-xl border border-dashed border-text/20 text-muted text-sm cursor-pointer hover:bg-text/5 min-h-[44px]">
            <ImageIcon size={16} /> {t('Muat naik resit', 'Upload a receipt')}
          </label>
        )}
      </div>
    </Sheet>
  );
}

/**
 * Log or edit one fuel/charge entry. `kind` only appears when the vehicle can hold more than
 * one (`kindsFor(energy).length > 1`) — a petrol car is never asked to choose, because there is
 * nothing to choose between.
 */
export function EnergySheet({ open, vehicle, data, entry, onClose, onSave, onDelete }: {
  open: boolean;
  vehicle: Vehicle;
  data: GarageData;
  /** Absent (or null) means logging a new entry. */
  entry?: EnergyLog | null;
  onClose: () => void;
  onSave: (entry: EnergyLog) => void;
  onDelete?: (id: string) => void;
}) {
  const t = useT();
  const kinds = kindsFor(vehicle.energy);
  const [kind, setKind] = useState<LogKind>(entry?.kind ?? kinds[0]);
  const [date, setDate] = useState(entry?.date ?? todayISO());
  const [odo, setOdo] = useState(entry?.odo != null ? String(entry.odo) : String(currentOdo(data, vehicle)));
  const [qty, setQty] = useState(entry?.qty != null ? String(entry.qty) : '');
  const [cost, setCost] = useState(entry?.cost != null ? String(entry.cost) : '');
  const [grade, setGrade] = useState(entry?.grade ?? '');
  const [station, setStation] = useState(entry?.station ?? '');
  const [full, setFull] = useState(entry?.full ?? true);
  const [error, setError] = useState('');

  const grades = gradesFor(vehicle.energy, kind);
  const fullLabel = kind === 'charge' ? t('Dicas penuh', 'Charged to full') : t('Diisi penuh', 'Filled to full');

  const submit = () => {
    if (!date) { setError(t('Sila pilih tarikh', 'Pick a date')); return; }
    const odoNum = Number(odo);
    if (odo.trim() === '' || !Number.isFinite(odoNum) || odoNum < 0) {
      setError(t('Masukkan bacaan odometer yang sah', 'Enter a valid odometer reading'));
      return;
    }
    const qtyNum = Number(qty);
    if (qty.trim() === '' || !Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError(t(`Masukkan kuantiti (${unitFor(kind)}) yang sah`, `Enter a valid quantity (${unitFor(kind)})`));
      return;
    }
    const costNum = Number(cost);
    if (cost.trim() === '' || !Number.isFinite(costNum) || costNum < 0) {
      setError(t('Masukkan kos yang sah', 'Enter a valid cost'));
      return;
    }
    setError('');
    onSave({
      id: entry?.id ?? generateId(),
      vehicleId: vehicle.id,
      date, odo: odoNum, kind, qty: qtyNum, cost: costNum, full,
      grade: grade.trim() || undefined,
      station: station.trim() || undefined,
    });
  };

  const askDelete = () => {
    if (!entry || !onDelete) return;
    if (!window.confirm(t('Padam rekod ini?', 'Delete this entry?'))) return;
    onDelete(entry.id);
  };

  return (
    <Sheet
      open={open}
      vehicle={vehicle}
      sub={vehicle.nickname || vehicle.model}
      title={entry
        ? t('Sunting rekod tenaga', 'Edit energy entry')
        : t('Log isi/cas', 'Log fill/charge')}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t('Simpan', 'Save')}
      extra={entry && onDelete ? (
        <button type="button" onClick={askDelete} aria-label={t('Padam rekod', 'Delete entry')}
          className="p-1.5 text-muted hover:text-rose-500 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <Trash2 size={18} />
        </button>
      ) : undefined}
    >
      {kinds.length > 1 && (
        <div className="space-y-1.5">
          <span className={fieldLabel}>{t('Jenis', 'Kind')}</span>
          <div className="flex flex-wrap gap-2">
            {kinds.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
                {k === 'charge' ? t('Cas', 'Charge') : t('Bahan api', 'Fuel')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Tarikh', 'Date')} *</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field w-full" />
      </div>

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Bacaan odometer (km)', 'Odometer (km)')} *</label>
        <input type="number" inputMode="numeric" min="0" value={odo} onChange={(e) => setOdo(e.target.value)}
          className="input-field w-full font-mono" style={num} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={fieldLabel}>{t('Kuantiti', 'Quantity')} ({unitFor(kind)}) *</label>
          <input type="number" inputMode="decimal" min="0" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)}
            className="input-field w-full font-mono" style={num} />
        </div>
        <div className="space-y-1.5">
          <label className={fieldLabel}>{t('Kos (RM)', 'Cost (RM)')} *</label>
          <input type="number" inputMode="decimal" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)}
            className="input-field w-full font-mono" style={num} />
        </div>
      </div>

      {error && <p className="text-sm text-rose-500 light:text-rose-700 font-medium">{error}</p>}

      <div className="space-y-1.5">
        <span className={fieldLabel}>{kind === 'charge' ? t('Gred', 'Grade') : t('Gred / oktana', 'Grade')}</span>
        <div className="flex flex-wrap gap-2">
          {grades.map((g) => (
            <button key={g} type="button" aria-pressed={grade === g} onClick={() => setGrade(g)} className={chip(grade === g)}>
              {g}
            </button>
          ))}
        </div>
        <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder={t('atau taip sendiri', 'or type your own')}
          className="input-field w-full" />
      </div>

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Stesen', 'Station')}</label>
        <input value={station} onChange={(e) => setStation(e.target.value)} placeholder={t('cth. Petronas', 'e.g. Petronas')}
          className="input-field w-full" />
      </div>

      <div className="space-y-1.5">
        {/* The whole row is the button, not just the 44x24 pill — this is the one control that
            decides whether economy() ever measures anything, so a missed tap here is a silently
            lost fuel-economy figure. min-h-[44px] and the full row width both clear the tap
            target minimum in a way the bare pill alone could not. */}
        <button type="button" onClick={() => setFull((f) => !f)} aria-pressed={full}
          className="w-full flex items-center justify-between gap-3 min-h-[44px] -my-1 py-1">
          <span className={fieldLabel}>{fullLabel}</span>
          <span className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${full ? 'bg-emerald-500' : 'bg-text/15'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[#ffffff] transition-transform ${full ? 'translate-x-5' : ''}`} />
          </span>
        </button>
        {/* The consequence spelled out, not just the toggle: economy() only closes a window
            between two full entries, so an owner who always tops up partial never sees a rate
            unless this stays on for at least one fill in a while. */}
        <p className="text-xs text-muted">
          {t('Hanya pasangan penuh-ke-penuh mengukur kecekapan.', 'Only a full-to-full pair measures economy.')}
        </p>
      </div>
    </Sheet>
  );
}

/** Nothing but a date and an odometer reading — a plain "here's where the odometer is today"
 *  entry, for the weeks between a fill-up and a service. */
export function OdoSheet({ open, vehicle, data, reading, onClose, onSave, onDelete }: {
  open: boolean;
  vehicle: Vehicle;
  data: GarageData;
  reading?: OdoLog | null;
  onClose: () => void;
  onSave: (reading: OdoLog) => void;
  onDelete?: (id: string) => void;
}) {
  const t = useT();
  const [date, setDate] = useState(reading?.date ?? todayISO());
  const [odo, setOdo] = useState(reading?.odo != null ? String(reading.odo) : String(currentOdo(data, vehicle)));
  const [error, setError] = useState('');

  const submit = () => {
    if (!date) { setError(t('Sila pilih tarikh', 'Pick a date')); return; }
    const odoNum = Number(odo);
    if (odo.trim() === '' || !Number.isFinite(odoNum) || odoNum < 0) {
      setError(t('Masukkan bacaan odometer yang sah', 'Enter a valid odometer reading'));
      return;
    }
    setError('');
    onSave({ id: reading?.id ?? generateId(), vehicleId: vehicle.id, date, odo: odoNum });
  };

  const askDelete = () => {
    if (!reading || !onDelete) return;
    if (!window.confirm(t('Padam bacaan ini?', 'Delete this reading?'))) return;
    onDelete(reading.id);
  };

  return (
    <Sheet
      open={open}
      vehicle={vehicle}
      sub={vehicle.nickname || vehicle.model}
      title={t('Kemas kini odometer', 'Update odometer')}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t('Simpan', 'Save')}
      extra={reading && onDelete ? (
        <button type="button" onClick={askDelete} aria-label={t('Padam bacaan', 'Delete reading')}
          className="p-1.5 text-muted hover:text-rose-500 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <Trash2 size={18} />
        </button>
      ) : undefined}
    >
      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Tarikh', 'Date')} *</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field w-full" />
      </div>

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Bacaan odometer (km)', 'Odometer (km)')} *</label>
        <input type="number" inputMode="numeric" min="0" value={odo} onChange={(e) => setOdo(e.target.value)}
          className="input-field w-full font-mono" style={num} />
      </div>

      {error && <p className="text-sm text-rose-500 light:text-rose-700 font-medium">{error}</p>}
    </Sheet>
  );
}
