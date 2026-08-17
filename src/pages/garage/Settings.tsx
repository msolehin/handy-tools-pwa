// Garaj's Settings tab. The feature the owner actually asked for by name — "add default service
// based on type car and can be managed in settings" — lives here: pick a body/energy pair, see
// its resolved checklist (the same `presetsFor` every ServiceSheet checklist reads from), and
// edit it. A default and a custom item are edited differently on purpose (see removeDefault vs
// removeCustom below) — the UI marks which one each row is rather than hiding the distinction.
import { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { EMPTY_GARAGE, type GarageData } from '../../lib/garage';
import {
  BODIES, ENERGIES, COST_CATEGORY_KEY, DEFAULT_COST_CATEGORIES, costCategories,
  defaultPresets, presetsFor, typeKey,
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

  const key = typeKey(body, energy);
  const preset = data.presets[key];
  const customs = preset?.customs ?? [];
  const hidden = preset?.hidden ?? [];
  const resolved = presetsFor(body, energy, customs, hidden);

  // Cost categories are garage-wide (COST_CATEGORY_KEY), not keyed to a body/energy pair — a
  // parking fee has nothing to do with what the car is, so there is no second picker above it.
  const costPreset = data.presets[COST_CATEGORY_KEY];

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

      <div className="mt-5">
        <span className={fieldLabel}>{t('Senarai semak servis', 'Service checklist')}</span>
      </div>
      <PresetEditor
        storeKey={key}
        defaults={defaultPresets(body, energy)}
        resolved={resolved}
        hidden={hidden}
        addPlaceholder={t('Tambah item...', 'Add an item...')}
        setData={setData}
      />

      <div className="mt-8">
        <span className={fieldLabel}>{t('Kategori kos', 'Cost categories')}</span>
        <p className="text-xs text-muted mt-0.5">{t('Dikongsi oleh semua kenderaan.', 'Shared by every vehicle.')}</p>
      </div>
      <PresetEditor
        storeKey={COST_CATEGORY_KEY}
        defaults={DEFAULT_COST_CATEGORIES}
        resolved={costCategories(costPreset?.customs, costPreset?.hidden)}
        hidden={costPreset?.hidden ?? []}
        addPlaceholder={t('Tambah kategori...', 'Add a category...')}
        setData={setData}
      />

      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-2 mt-8">
        <p className="flex items-center gap-2 text-sm font-bold text-rose-400 light:text-rose-600">
          <AlertTriangle size={16} className="shrink-0" />{t('Padam semua data', 'Delete all data')}
        </p>
        <p className="text-xs text-muted">{t(
          'Membuang semua kenderaan, rekod servis, log tenaga, odometer, peringatan, dokumen, kos dan penyesuaian senarai semak dalam Garaj sahaja. Alat lain tidak disentuh.',
          'Removes every vehicle, service record, energy log, odometer reading, reminder, document, cost and checklist customisation in Garaj only. Other tools are left alone.',
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

/**
 * One `data.presets[storeKey]` row — the same shape whether `storeKey` is a `typeKey(body,
 * energy)` service checklist or the one garage-wide `COST_CATEGORY_KEY` cost-category list.
 * Lifted out of the component above so both editors above share one implementation rather than
 * two copies that could quietly drift apart on the hidden-vs-customs distinction.
 *
 * `defaults` and `resolved` are the caller's, not recomputed here: `resolved` already went
 * through `presetsFor`/`costCategories`, and this component has no way to know which one applies
 * to `storeKey` — it only needs the two lists and the raw `hidden` array to decide what each row
 * is and whether "Restore defaults" should show.
 */
function PresetEditor({ storeKey, defaults, resolved, hidden, addPlaceholder, setData }: {
  storeKey: string;
  defaults: string[];
  resolved: string[];
  hidden: string[];
  addPlaceholder: string;
  setData: React.Dispatch<React.SetStateAction<GarageData>>;
}) {
  const t = useT();
  const [input, setInput] = useState('');

  // Every write goes through data.presets[storeKey] — reading the CURRENT row out of `d` inside
  // the updater, not a value this render closed over, the same reason tickReminder in garage.ts
  // reads live rather than trusting a stale closure.
  const patchPreset = (fn: (cur: { customs: string[]; hidden: string[] }) => { customs: string[]; hidden: string[] }) => {
    setData((d) => {
      const cur = d.presets[storeKey] ?? { customs: [], hidden: [] };
      return { ...d, presets: { ...d.presets, [storeKey]: fn(cur) } };
    });
  };

  // A default item is never deleted — it's HIDDEN. The list it comes from (`defaults`) is code,
  // not data; "removing" it can only ever mean "don't show me this one".
  const removeDefault = (label: string) =>
    patchPreset((cur) => cur.hidden.includes(label) ? cur : { ...cur, hidden: [...cur.hidden, label] });

  // A custom item is the owner's own row — removing it deletes it outright, there is nothing to
  // restore it FROM.
  const removeCustom = (label: string) =>
    patchPreset((cur) => ({ ...cur, customs: cur.customs.filter((c) => c !== label) }));

  const restoreDefaults = () => patchPreset((cur) => (cur.hidden.length ? { ...cur, hidden: [] } : cur));

  const addCustom = () => {
    const label = input.trim();
    if (!label) return;
    patchPreset((cur) => {
      // Checked against the UNFILTERED default list, not `resolved` — `resolved` already has
      // hidden defaults filtered out, so guarding against it let a hidden default's own name slip
      // through into `customs`. That row is then permanently unreachable: `isDefault` is computed
      // from `defaults` alone, so it renders tagged Default forever and removeCustom can never
      // see it (Task 13 review finding 1) — dead data that re-syncs on every future edit.
      if (defaults.includes(label)) {
        // Typing a hidden default's exact name back in reads as "bring it back", not "make me a
        // second copy" — unhide rather than leave the keystroke a silent no-op.
        return cur.hidden.includes(label) ? { ...cur, hidden: cur.hidden.filter((h) => h !== label) } : cur;
      }
      // Same dedupe ServiceSheet's own addCustom uses for a typed-in item that already matches a chip.
      return cur.customs.includes(label) ? cur : { ...cur, customs: [...cur.customs, label] };
    });
    setInput('');
  };

  return (
    <>
      <div className="flex items-center justify-end mb-1.5 mt-1">
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
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          placeholder={addPlaceholder}
          className="input-field flex-1" />
        <button type="button" onClick={addCustom}
          className="px-4 rounded-xl border border-text/15 text-sm font-bold text-text hover:bg-text/5 min-w-[44px] min-h-[44px]">
          {t('Tambah', 'Add')}
        </button>
      </div>
    </>
  );
}
