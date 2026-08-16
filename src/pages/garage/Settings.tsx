// Garaj's Settings tab. The feature the owner actually asked for by name — "add default service
// based on type car and can be managed in settings" — lives here: pick a body/energy pair, see
// its resolved checklist (the same `presetsFor` every ServiceSheet checklist reads from), and
// edit it. A default and a custom item are edited differently on purpose (see removeDefault vs
// removeCustom below) — the UI marks which one each row is rather than hiding the distinction.
import { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { EMPTY_GARAGE, type GarageData } from '../../lib/garage';
import {
  BODIES, ENERGIES, defaultPresets, presetsFor, typeKey,
  type Body, type Energy,
} from '../../lib/garage-presets';
import { chip, fieldLabel } from './parts';
import { useT } from '../../lib/lang';

export default function Settings({ data, setData }: {
  data: GarageData;
  setData: React.Dispatch<React.SetStateAction<GarageData>>;
}) {
  const t = useT();
  // Starts on the fleet's own first vehicle's type rather than an arbitrary pair, so an owner
  // with one car lands straight on the list they actually came here to edit.
  const [body, setBody] = useState<Body>(data.vehicles[0]?.body ?? 'sedan');
  const [energy, setEnergy] = useState<Energy>(data.vehicles[0]?.energy ?? 'petrol');
  const [customInput, setCustomInput] = useState('');

  const key = typeKey(body, energy);
  const preset = data.presets[key];
  const customs = preset?.customs ?? [];
  const hidden = preset?.hidden ?? [];
  const defaults = defaultPresets(body, energy);
  const resolved = presetsFor(body, energy, customs, hidden);

  // Every write goes through data.presets[typeKey(body, energy)] — reading the CURRENT row out
  // of `d` inside the updater, not the `preset` this render closed over, the same reason
  // tickReminder in garage.ts reads live rather than trusting a stale closure.
  const patchPreset = (fn: (cur: { customs: string[]; hidden: string[] }) => { customs: string[]; hidden: string[] }) => {
    setData((d) => {
      const cur = d.presets[key] ?? { customs: [], hidden: [] };
      return { ...d, presets: { ...d.presets, [key]: fn(cur) } };
    });
  };

  // A default item is never deleted — it's HIDDEN. The list it comes from (defaultPresets) is
  // code, not data; "removing" it can only ever mean "don't show me this one".
  const removeDefault = (label: string) =>
    patchPreset((cur) => cur.hidden.includes(label) ? cur : { ...cur, hidden: [...cur.hidden, label] });

  // A custom item is the owner's own row — removing it deletes it outright, there is nothing to
  // restore it FROM.
  const removeCustom = (label: string) =>
    patchPreset((cur) => ({ ...cur, customs: cur.customs.filter((c) => c !== label) }));

  const restoreDefaults = () => patchPreset((cur) => (cur.hidden.length ? { ...cur, hidden: [] } : cur));

  const addCustom = () => {
    const label = customInput.trim();
    if (!label) return;
    // Silently folds into the existing row rather than erroring — same dedupe ServiceSheet's own
    // addCustom uses for a typed-in item that already matches a chip.
    patchPreset((cur) => resolved.includes(label) ? cur : { ...cur, customs: [...cur.customs, label] });
    setCustomInput('');
  };

  const wipeAll = () => {
    if (!window.confirm(t(
      'Padam SEMUA data Garaj? Data yang dipadam TIDAK BOLEH dipulihkan.',
      'Delete ALL Garaj data? Deleted data CANNOT be recovered.',
    ))) return;
    // A fresh copy of the empty shape, not the EMPTY_GARAGE singleton mutated in place — every
    // other write in Garaj is immutable the same way, and the shell's mount-guard only skips a
    // save when `data` is the exact object it mounted with, which this new object never is.
    setData(() => ({ ...EMPTY_GARAGE }));
  };

  return (
    <div className="px-1 pb-2">
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

      <div className="space-y-1.5 mt-4">
        <span className={fieldLabel}>{t('Tenaga', 'Energy')}</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ENERGIES) as Energy[]).map((e) => (
            <button key={e} type="button" aria-pressed={energy === e} onClick={() => setEnergy(e)} className={chip(energy === e)}>
              {t(ENERGIES[e].ms, ENERGIES[e].en)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-5 mb-1.5">
        <span className={fieldLabel}>{t('Senarai semak servis', 'Service checklist')}</span>
        {hidden.length > 0 && (
          <button type="button" onClick={restoreDefaults}
            className="text-xs text-muted hover:text-text underline underline-offset-2 min-h-[44px] px-1">
            {t('Pulihkan lalai', 'Restore defaults')}
          </button>
        )}
      </div>

      <div className="rounded-xl border border-text/10 overflow-hidden">
        {resolved.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">{t('Tiada item', 'No items')}</p>
        ) : resolved.map((label) => {
          const isDefault = defaults.includes(label);
          return (
            <div key={label} className="flex items-center gap-2 px-3.5 py-2.5 border-b border-text/10 last:border-b-0">
              <span className="text-sm flex-1 min-w-0 truncate">{label}</span>
              {/* Marks which operation the X below actually performs — a default's X hides it
                  (restorable), a custom's X deletes it (not) — so the row itself, not just this
                  file's logic, tells the two apart. */}
              <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${
                isDefault ? 'bg-text/5 text-muted' : 'bg-primary/15 text-primary'}`}>
                {isDefault ? t('Lalai', 'Default') : t('Sendiri', 'Custom')}
              </span>
              <button type="button" onClick={() => (isDefault ? removeDefault(label) : removeCustom(label))}
                aria-label={t('Buang item', 'Remove item')}
                className="shrink-0 w-11 h-11 flex items-center justify-center text-muted hover:text-rose-500">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-3">
        <input value={customInput} onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          placeholder={t('Tambah item...', 'Add an item...')}
          className="input-field flex-1" />
        <button type="button" onClick={addCustom}
          className="px-4 rounded-xl border border-text/15 text-sm font-bold text-text hover:bg-text/5 min-w-[44px] min-h-[44px]">
          {t('Tambah', 'Add')}
        </button>
      </div>

      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-2 mt-8">
        <p className="flex items-center gap-2 text-sm font-bold text-rose-400 light:text-rose-600">
          <AlertTriangle size={16} className="shrink-0" />{t('Padam semua data', 'Delete all data')}
        </p>
        <p className="text-xs text-muted">{t(
          'Membuang semua kenderaan, rekod servis, log tenaga, odometer, peringatan dan dokumen dalam Garaj sahaja. Alat lain tidak disentuh.',
          'Removes every vehicle, service record, energy log, odometer reading, reminder and document in Garaj only. Other tools are left alone.',
        )}</p>
        <p className="text-xs font-bold text-rose-400 light:text-rose-600">{t(
          'Amaran: data yang dipadam tidak boleh dipulihkan.',
          'Warning: deleted data cannot be recovered.',
        )}</p>
        <button type="button" onClick={wipeAll}
          className="w-full py-3 rounded-xl bg-rose-500 text-[#ffffff] font-bold hover:bg-rose-600 flex items-center justify-center gap-2 min-h-[44px]">
          <Trash2 size={16} />{t('Padam semua data', 'Delete all data')}
        </button>
      </div>
    </div>
  );
}
