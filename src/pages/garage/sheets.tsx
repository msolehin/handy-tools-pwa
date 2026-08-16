// Garaj's add/edit forms. `VehicleSheet` is Task 10's; ServiceSheet/EnergySheet/OdoSheet
// (Task 11) and ReminderSheet/DocumentSheet (Task 12) join it in this same file per the SDD's
// own file list — one module, one import, for every sheet in the tool.
import { useRef, useState } from 'react';
import { Trash2, ChevronDown, Image as ImageIcon, X } from 'lucide-react';
import { Sheet, EDGE_COLORS } from './parts';
import { BODIES, ENERGIES, engineSpec, type Body, type Energy } from '../../lib/garage-presets';
import type { GarageData, Vehicle } from '../../lib/garage';
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
