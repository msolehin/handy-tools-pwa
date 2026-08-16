// The log-shaped sheets: one record at a time, dated, against an odometer reading (or a due
// point, for a reminder). Split out of sheets.tsx in Task 12 — that file was VehicleSheet and
// ServiceSheet (fleet and maintenance, both keyed off a preset checklist) plus two log forms
// that had nothing to do with either; adding ReminderSheet and DocumentSheet here instead of
// growing sheets.tsx past 900 lines keeps each file on one side of that seam. Shared helpers
// (chip, fieldLabel, generateId, the Sheet shell itself) live in parts.tsx so neither file
// defines its own copy.
import { useRef, useState } from 'react';
import { Trash2, Image as ImageIcon, X } from 'lucide-react';
import { Sheet, chip, fieldLabel, generateId } from './parts';
import { presetsFor, gradesFor, kindsFor, unitFor, typeKey, type LogKind } from '../../lib/garage-presets';
import {
  currentOdo, todayISO, DOC_LABELS,
  type EnergyLog, type GarageData, type OdoLog, type Reminder, type VDoc, type Vehicle,
} from '../../lib/garage';
import { downscaleFile } from '../../lib/downscale';
import { useT } from '../../lib/lang';

const num = { fontVariantNumeric: 'tabular-nums' } as const;

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
  // Same wording the pane's own "Log ..." button already derives from kindsFor — an EV owner
  // should never see "Log fill/charge" over a form that only ever asks for a charge.
  const createTitle = kinds.length === 1 && kinds[0] === 'charge' ? t('Log cas', 'Log charge')
    : kinds.length === 2 ? t('Log isi/cas', 'Log fill/charge')
    : t('Log isi minyak', 'Log fill');

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
      title={entry ? t('Sunting rekod tenaga', 'Edit energy entry') : createTitle}
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

type Mode = 'date' | 'mileage' | 'both';

/** Which trigger fields a mode shows. 'both' shows both; the other two show only their own. */
const showsDate = (m: Mode) => m === 'date' || m === 'both';
const showsOdo = (m: Mode) => m === 'mileage' || m === 'both';

/**
 * Log or edit a reminder. The label chips are the vehicle's own preset checklist — the same list
 * ServiceSheet's items come from — so setting "Brake pads due" doesn't require re-typing a name
 * the app already knows for this vehicle. The mode choice below it decides which trigger fields
 * even show up: a mileage-only reminder has no reason to ask for a date it will never use.
 *
 * `statusOf` returns "no trigger set" forever for a reminder with neither `dueDate` nor `dueOdo`
 * — so submitting without at least one of them is refused outright, not silently accepted as a
 * reminder nobody will ever see fire.
 */
export function ReminderSheet({ open, vehicle, reminder, data, onClose, onSave, onDelete }: {
  open: boolean;
  vehicle: Vehicle;
  /** Absent (or null) means creating a new reminder. */
  reminder?: Reminder | null;
  data: GarageData;
  onClose: () => void;
  onSave: (reminder: Reminder) => void;
  onDelete?: (id: string) => void;
}) {
  const t = useT();
  const [label, setLabel] = useState(reminder?.label ?? '');
  const [mode, setMode] = useState<Mode>(() => {
    const hasDate = !!reminder?.dueDate;
    const hasOdo = reminder?.dueOdo != null;
    if (hasDate && hasOdo) return 'both';
    if (hasOdo) return 'mileage';
    return 'date';
  });
  const [date, setDate] = useState(reminder?.dueDate ?? '');
  const [odo, setOdo] = useState(reminder?.dueOdo != null ? String(reminder.dueOdo) : '');
  const [repeatMonths, setRepeatMonths] = useState(reminder?.repeat?.months ? String(reminder.repeat.months) : '0');
  const [repeatKm, setRepeatKm] = useState(reminder?.repeat?.km ? String(reminder.repeat.km) : '0');
  const [error, setError] = useState('');

  const preset = data.presets[typeKey(vehicle.body, vehicle.energy)];
  const checklist = presetsFor(vehicle.body, vehicle.energy, preset?.customs, preset?.hidden);

  const MODES: [Mode, string][] = [
    ['date', t('Ikut tarikh', 'By date')],
    ['mileage', t('Ikut jarak', 'By mileage')],
    ['both', t('Kedua-duanya', 'Both')],
  ];

  const submit = () => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) { setError(t('Sila masukkan label', 'Enter a label')); return; }

    let dueDateVal: string | undefined;
    let dueOdoVal: number | undefined;

    if (showsDate(mode) && date) dueDateVal = date;

    if (showsOdo(mode) && odo.trim() !== '') {
      const n = Number(odo);
      if (!Number.isFinite(n) || n < 0) {
        setError(t('Masukkan sasaran odometer yang sah', 'Enter a valid odometer target'));
        return;
      }
      dueOdoVal = n;
    }

    // The one rule statusOf needs upheld: without this a reminder with neither field set would
    // sit in the list forever reading "no trigger set", since nothing would ever make it due.
    if (dueDateVal === undefined && dueOdoVal === undefined) {
      setError(t('Tetapkan sekurang-kurangnya tarikh atau sasaran odometer', 'Set at least a date or an odometer target'));
      return;
    }
    setError('');

    const monthsNum = Number(repeatMonths) || 0;
    const kmNum = Number(repeatKm) || 0;
    // Never store {months:0, km:0} — the server round-trips that shape to "absent", so a
    // reminder saved with a stored-but-empty repeat would show a phantom edit after its first
    // sync (a field the client wrote that the server never actually persisted).
    const repeat = (monthsNum > 0 || kmNum > 0) ? { months: monthsNum, km: kmNum } : undefined;

    onSave({
      id: reminder?.id ?? generateId(),
      vehicleId: vehicle.id,
      label: trimmedLabel,
      done: reminder?.done ?? false,
      doneDate: reminder?.doneDate,
      dueDate: dueDateVal,
      dueOdo: dueOdoVal,
      repeat,
    });
  };

  const askDelete = () => {
    if (!reminder || !onDelete) return;
    if (!window.confirm(t('Padam peringatan ini?', 'Delete this reminder?'))) return;
    onDelete(reminder.id);
  };

  return (
    <Sheet
      open={open}
      vehicle={vehicle}
      sub={vehicle.nickname || vehicle.model}
      title={reminder ? t('Sunting peringatan', 'Edit reminder') : t('Peringatan baharu', 'New reminder')}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t('Simpan', 'Save')}
      extra={reminder && onDelete ? (
        <button type="button" onClick={askDelete} aria-label={t('Padam peringatan', 'Delete reminder')}
          className="p-1.5 text-muted hover:text-rose-500 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <Trash2 size={18} />
        </button>
      ) : undefined}
    >
      <div className="space-y-1.5">
        <span className={fieldLabel}>{t('Label', 'Label')}</span>
        <div className="flex flex-wrap gap-2">
          {checklist.map((item) => (
            <button key={item} type="button" aria-pressed={label === item} onClick={() => setLabel(item)} className={chip(label === item)}>
              {item}
            </button>
          ))}
        </div>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('cth. Cukai jalan', 'e.g. Road tax')}
          className="input-field w-full" />
      </div>

      <div className="space-y-1.5">
        <span className={fieldLabel}>{t('Mod', 'Mode')}</span>
        <div className="flex flex-wrap gap-2">
          {MODES.map(([m, mLabel]) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={chip(mode === m)}>
              {mLabel}
            </button>
          ))}
        </div>
      </div>

      {showsDate(mode) && (
        <div className="space-y-1.5">
          <label className={fieldLabel}>{t('Tarikh cukup tempoh', 'Due date')}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field w-full" />
        </div>
      )}

      {showsOdo(mode) && (
        <div className="space-y-1.5">
          <label className={fieldLabel}>{t('Sasaran odometer (km)', 'Odometer target (km)')}</label>
          <input type="number" inputMode="numeric" min="0" value={odo} onChange={(e) => setOdo(e.target.value)}
            placeholder={String(currentOdo(data, vehicle))} className="input-field w-full font-mono" style={num} />
        </div>
      )}

      {error && <p className="text-sm text-rose-500 light:text-rose-700 font-medium">{error}</p>}

      <div className="space-y-1.5">
        <span className={fieldLabel}>{t('Ulang (pilihan)', 'Repeat (optional)')}</span>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted">{t('Bulan', 'Months')}</label>
            <input type="number" inputMode="numeric" min="0" step="1" value={repeatMonths}
              onChange={(e) => setRepeatMonths(e.target.value)} className="input-field w-full font-mono" style={num} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">{t('Km', 'Km')}</label>
            <input type="number" inputMode="numeric" min="0" step="1" value={repeatKm}
              onChange={(e) => setRepeatKm(e.target.value)} className="input-field w-full font-mono" style={num} />
          </div>
        </div>
        <p className="text-xs text-muted">
          {t('Tandakan selesai akan menolak peringatan ini ke hadapan mengikut nilai di atas, bukan menutupnya.',
             'Ticking this done rolls it forward by the values above instead of closing it.')}
        </p>
      </div>
    </Sheet>
  );
}

/**
 * Log or edit a document — road tax, insurance, and the rest of `DOC_LABELS`. Opened from either
 * this vehicle's Docs pane (a blank type, defaulting to road tax) or from the DocPair boxes at
 * the top of the page (a fixed type via `defaultType`, editing whatever's already there) — the
 * type chips below stay editable either way, since a document typed under the wrong type is a
 * mistake worth being able to fix without deleting and re-adding it.
 */
export function DocumentSheet({ open, vehicle, doc, defaultType, onClose, onSave, onDelete }: {
  open: boolean;
  vehicle: Vehicle;
  /** Absent (or null) means creating a new document. */
  doc?: VDoc | null;
  /** Only consulted when `doc` is absent — which box on DocPair this was opened from. */
  defaultType?: VDoc['type'];
  onClose: () => void;
  onSave: (doc: VDoc) => void;
  onDelete?: (id: string) => void;
}) {
  const t = useT();
  const [type, setType] = useState<VDoc['type']>(doc?.type ?? defaultType ?? 'roadtax');
  const [expiry, setExpiry] = useState(doc?.expiry ?? '');
  const [issued, setIssued] = useState(doc?.issued ?? '');
  const [cost, setCost] = useState(doc?.cost != null ? String(doc.cost) : '');
  const [note, setNote] = useState(doc?.note ?? '');
  const [receipt, setReceipt] = useState(doc?.receipt ?? '');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!expiry) { setError(t('Sila pilih tarikh luput', 'Pick an expiry date')); return; }
    let costNum: number | undefined;
    if (cost.trim() !== '') {
      const n = Number(cost);
      if (!Number.isFinite(n) || n < 0) { setError(t('Masukkan kos yang sah', 'Enter a valid cost')); return; }
      costNum = n;
    }
    setError('');
    onSave({
      id: doc?.id ?? generateId(),
      vehicleId: vehicle.id,
      type, expiry,
      issued: issued.trim() || undefined,
      cost: costNum,
      note: note.trim() || undefined,
      receipt: receipt || undefined,
    });
  };

  const askDelete = () => {
    if (!doc || !onDelete) return;
    if (!window.confirm(t('Padam dokumen ini?', 'Delete this document?'))) return;
    onDelete(doc.id);
  };

  return (
    <Sheet
      open={open}
      vehicle={vehicle}
      sub={vehicle.nickname || vehicle.model}
      title={doc ? t('Sunting dokumen', 'Edit document') : t('Tambah dokumen', 'Add document')}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t('Simpan', 'Save')}
      extra={doc && onDelete ? (
        <button type="button" onClick={askDelete} aria-label={t('Padam dokumen', 'Delete document')}
          className="p-1.5 text-muted hover:text-rose-500 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <Trash2 size={18} />
        </button>
      ) : undefined}
    >
      <div className="space-y-1.5">
        <span className={fieldLabel}>{t('Jenis', 'Type')}</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DOC_LABELS) as VDoc['type'][]).map((ty) => (
            <button key={ty} type="button" aria-pressed={type === ty} onClick={() => setType(ty)} className={chip(type === ty)}>
              {t(DOC_LABELS[ty].ms, DOC_LABELS[ty].en)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Tarikh luput', 'Expiry')} *</label>
        <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="input-field w-full" />
      </div>

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Tarikh dikeluarkan', 'Issued')}</label>
        <input type="date" value={issued} onChange={(e) => setIssued(e.target.value)} className="input-field w-full" />
      </div>

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Kos (RM)', 'Cost (RM)')}</label>
        <input type="number" inputMode="decimal" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)}
          className="input-field w-full font-mono" style={num} />
      </div>

      {error && <p className="text-sm text-rose-500 light:text-rose-700 font-medium">{error}</p>}

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Nota', 'Note')}</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} className="input-field w-full h-16 resize-none py-2" />
      </div>

      <div className="space-y-1.5">
        <label className={fieldLabel}>{t('Resit (pilihan)', 'Receipt (optional)')}</label>
        <input
          type="file"
          accept="image/*"
          ref={fileRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // 900px — the same receipt budget ServiceSheet uses; a receipt needs its printed
            // total legible.
            if (file) downscaleFile(file, 900).then(setReceipt).catch(() => {});
          }}
          className="hidden"
          id="document-receipt"
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
          <label htmlFor="document-receipt"
            className="flex items-center justify-center gap-2 h-16 rounded-xl border border-dashed border-text/20 text-muted text-sm cursor-pointer hover:bg-text/5 min-h-[44px]">
            <ImageIcon size={16} /> {t('Muat naik resit', 'Upload a receipt')}
          </label>
        )}
      </div>
    </Sheet>
  );
}
