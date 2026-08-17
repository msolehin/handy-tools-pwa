// Garaj's fleet/maintenance forms: `VehicleSheet` (Task 10) and `ServiceSheet` (Task 11). The
// log-shaped sheets — EnergySheet, OdoSheet, ReminderSheet, DocumentSheet — live in logSheets.tsx
// instead (see that file's own header for why this file was split for Task 12). Both files share
// their chip/fieldLabel/generateId helpers from parts.tsx rather than each defining their own.
import { useRef, useState } from 'react';
import { Trash2, ChevronDown, Image as ImageIcon, X } from 'lucide-react';
import { Sheet, EDGE_COLORS, fmtKm, fmtRM, niceDate, chip, fieldLabel, generateId } from './parts';
import {
  BODIES, ENERGIES, engineSpec, presetsFor, SUGGEST, typeKey,
  type Body, type Energy,
} from '../../lib/garage-presets';
import { addMonths, currentOdo, todayISO, type GarageData, type Reminder, type Service, type ServiceItem, type Vehicle } from '../../lib/garage';
import { downscaleFile } from '../../lib/downscale';
import { useT } from '../../lib/lang';

const num = { fontVariantNumeric: 'tabular-nums' } as const;

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

  // Builds a fresh Vehicle literal rather than spreading `vehicle` — which means every field
  // `vehicle` can carry has to be listed by hand below, or it is silently dropped on the next
  // edit. `archived`/`archivedAt` are carried through for exactly that reason (same trap as the
  // pre-existing `capacity` gap this sheet still has); the archive controls below build from
  // this function too, so a pending nickname edit isn't lost when the owner taps Archive.
  const build = (): Vehicle | null => {
    const trimmedModel = model.trim();
    if (!trimmedModel) {
      setError(t('Sila masukkan model kenderaan', 'Enter a vehicle model'));
      return null;
    }
    const mileageNum = Number(mileage);
    if (mileage.trim() === '' || !Number.isFinite(mileageNum) || mileageNum < 0) {
      setError(t('Masukkan bacaan odometer yang sah (0 atau lebih)', 'Enter a valid mileage (0 or more)'));
      return null;
    }
    setError('');
    return {
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
      archived: vehicle?.archived,
      archivedAt: vehicle?.archivedAt,
    };
  };

  const submit = () => {
    const v = build();
    if (v) onSave(v);
  };

  const name = vehicle?.nickname || vehicle?.model || '';

  const toggleArchive = () => {
    if (vehicle?.archived) {
      // Restoring destroys nothing, so no confirm.
      const v = build();
      // undefined, never false: the server reads this column as `case when archived then true
      // end`, so a stored `false` would round-trip to absent and read as a phantom edit.
      if (v) onSave({ ...v, archived: undefined, archivedAt: undefined });
      return;
    }
    if (!window.confirm(t(
      `Tandakan ${name} sebagai dijual? Semua rekodnya kekal, tetapi ia berhenti muncul dalam pemilih dan berhenti menghantar peringatan.`,
      `Mark ${name} as sold? All its records are kept, but it stops appearing in the picker and stops sending reminders.`
    ))) return;
    const v = build();
    if (v) onSave({ ...v, archived: true, archivedAt: todayISO() });
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

      {vehicle && (
        <div>
          <button
            type="button"
            onClick={toggleArchive}
            className="w-full py-3 rounded-xl border border-text/15 text-muted font-bold hover:bg-text/5 min-h-[44px]"
          >
            {vehicle.archived ? t('Pulihkan kenderaan', 'Restore vehicle') : t('Tandakan dijual', 'Mark as sold')}
          </button>
          <p className="text-xs text-muted mt-1.5">
            {t('Padam membuang semua rekodnya. Dijual menyimpan semuanya.', 'Delete removes all its records. Sold keeps everything.')}
          </p>
        </div>
      )}
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
  const [items, setItems] = useState<ServiceItem[]>(service?.items ?? []);
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
  // Normalises on every keystroke, not on submit, so clearing a field really clears it:
  // `warrantyReminders` treats a falsy value as "no warranty", and a stored 0/'' would sync as a
  // field the server round-trips away rather than one that was genuinely cleared.
  const setWarranty = (label: string, patch: Partial<ServiceItem>) =>
    setItems((prev) => prev.map((i) => (i.label === label ? { ...i, ...patch } : i)));
  const warrantySummary = (item: ServiceItem) => {
    const bits = [
      item.warrantyUntil ? niceDate(item.warrantyUntil) : null,
      item.warrantyKm ? `${fmtKm(item.warrantyKm)} km` : null,
    ].filter(Boolean);
    const label = t('Waranti', 'Warranty');
    return bits.length ? `${label} · ${bits.join(' · ')}` : label;
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
            <div key={item.label} className="border-b border-text/10 last:border-b-0">
              <div className="flex items-center gap-1 px-3.5 py-2">
                <span className="text-sm truncate flex-1 min-w-0">{item.label}</span>
                <input type="number" inputMode="decimal" min="0" step="0.01" value={item.cost || ''}
                  onChange={(e) => setCost(item.label, Number(e.target.value))}
                  placeholder="0.00" className="input-field w-24 font-mono text-right shrink-0" style={num} />
                <button type="button" onClick={() => remove(item.label)} aria-label={t('Buang item', 'Remove item')}
                  className="shrink-0 w-11 h-11 flex items-center justify-center text-muted hover:text-rose-500">
                  <X size={16} />
                </button>
              </div>
              {/* Closed by default — a collapsed row still names whichever trigger is set, right
                  in the summary, so this costs nothing extra to check on the common warranty-less
                  item and doesn't move anything else in the sheet. */}
              <details className="group">
                <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden min-h-[44px] px-3.5 pb-2 text-xs text-muted flex items-center">
                  {warrantySummary(item)}
                </summary>
                <div className="px-3.5 pb-3 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className={fieldLabel}>{t('Waranti sehingga', 'Warranty until')}</label>
                      <input type="date" value={item.warrantyUntil ?? ''}
                        onChange={(e) => setWarranty(item.label, { warrantyUntil: e.target.value || undefined })}
                        className="input-field w-full" />
                    </div>
                    <div className="space-y-1.5">
                      <label className={fieldLabel}>{t('Waranti (km)', 'Warranty (km)')}</label>
                      <input type="number" inputMode="numeric" min="0" step="1" value={item.warrantyKm ?? ''}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setWarranty(item.label, { warrantyKm: n > 0 ? n : undefined });
                        }}
                        placeholder="40000" className="input-field w-full font-mono" style={num} />
                    </div>
                  </div>
                  <p className="text-xs text-muted">
                    {t('Simpan akan membuat peringatannya sendiri.', 'Saving creates its reminder automatically.')}
                  </p>
                </div>
              </details>
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

// EnergySheet, OdoSheet, ReminderSheet, DocumentSheet — the four log-shaped sheets — are in
// logSheets.tsx.
