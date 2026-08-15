import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldAlert, Plus, Trash2, Pencil, X, RotateCw, Check, Search,
  BookUser, CarFront, IdCard, Fingerprint, HeartPulse, Plane, FileText,
} from 'lucide-react';
import { store } from '../lib/store';
import { daysUntil, horizonTone, renewedDate } from '../lib/horizon';

interface ExpiryDocument {
  id: string;
  type: string;
  customTitle?: string;
  expiryDate: string;
}

/**
 * `months` is the usual renewal term, used to pre-fill the renew sheet.
 *
 * `name` is what gets stored on the record, so it stays in English forever — renaming it would
 * orphan every document already saved. `label` is the only thing shown.
 */
const DOC_TYPES = [
  { name: 'Passport', label: 'Pasport', Icon: BookUser, months: 60 },
  { name: 'Roadtax', label: 'Roadtax', Icon: CarFront, months: 12 },
  { name: 'Driving License', label: 'Lesen Memandu', Icon: IdCard, months: 12 },
  { name: 'Identity Card', label: 'Kad Pengenalan', Icon: Fingerprint, months: 120 },
  { name: 'Medical Card', label: 'Kad Perubatan', Icon: HeartPulse, months: 12 },
  { name: 'Visa', label: 'Visa', Icon: Plane, months: 12 },
  { name: 'Custom', label: 'Lain-lain', Icon: FileText, months: 12 },
];

const typeOf = (name: string) => DOC_TYPES.find(t => t.name === name) ?? DOC_TYPES[DOC_TYPES.length - 1];

const RENEW_PRESETS = [
  { label: '6 bln', months: 6 },
  { label: '1 thn', months: 12 },
  { label: '2 thn', months: 24 },
  { label: '3 thn', months: 36 },
  { label: '5 thn', months: 60 },
];

type Tone = 'expired' | 'due' | 'valid';

// No single shade of amber or emerald clears 4.5:1 on both the dark surface and the light one,
// so each tone names its light-mode partner. `light:` is the variant registered in tailwind.config.
// `glow` overrides glass-panel's own border and shadow. Both of those live in @layer components
// and these are utilities, which Tailwind emits later — so the utility wins without !important.
const TONE: Record<Tone, { glow: string; text: string; icon: string; btn: string; ink: string }> = {
  expired: {
    glow: 'border-rose-500/60 shadow-[0_0_20px_-4px_rgb(244_63_94_/_0.55)]',
    ink: 'rgb(244 63 94)',
    text: 'text-rose-500 light:text-rose-700',
    icon: 'bg-rose-500/10 text-rose-500 light:text-rose-700',
    btn: 'bg-rose-500/15 text-rose-500 light:text-rose-700 hover:bg-rose-500/25',
  },
  due: {
    glow: 'border-amber-500/60 shadow-[0_0_20px_-4px_rgb(245_158_11_/_0.50)]',
    ink: 'rgb(245 158 11)',
    text: 'text-amber-500 light:text-amber-700',
    icon: 'bg-amber-500/10 text-amber-500 light:text-amber-700',
    btn: 'bg-amber-500/15 text-amber-500 light:text-amber-700 hover:bg-amber-500/25',
  },
  valid: {
    glow: 'border-emerald-500/40 shadow-[0_0_20px_-6px_rgb(16_185_129_/_0.35)]',
    ink: 'rgb(16 185 129)',
    text: 'text-emerald-500 light:text-emerald-700',
    icon: 'bg-emerald-500/10 text-emerald-500 light:text-emerald-700',
    btn: 'bg-text/5 text-muted hover:text-text hover:bg-text/10',
  },
};

// Expired is a state the shared horizon tones don't carry; everything still ahead uses them.
const toneOf = (days: number): Tone =>
  days < 0 ? 'expired' : horizonTone(days) === 'emerald' ? 'valid' : 'due';

const statusText = (days: number) =>
  days < 0 ? `Dah tamat ${Math.abs(days)} hari lepas`
    : days === 0 ? 'Tamat hari ni'
      : `Tinggal ${days} hari`;

const pad = (n: number) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * The chevron strip printed along the bottom of a passport data page. Not a real machine-readable
 * zone — no checksums, no ICAO field widths — it is the card's signature, built from what the
 * document actually holds so it reads as this document rather than as decoration.
 */
const mrz = (title: string, expiry: string) => {
  const name = title.toUpperCase().replace(/[^A-Z0-9]+/g, '<');
  return `${name}<<MYS<<${expiry.replace(/-/g, '')}${'<'.repeat(44)}`.slice(0, 44);
};

const DocumentExpiry: React.FC = () => {
  const [documents, setDocuments] = useState<ExpiryDocument[]>(() => {
    const saved = store.getItem('de_documents');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    store.setItem('de_documents', JSON.stringify(documents));
  }, [documents]);

  // Add / edit sheet
  const [showForm, setShowForm] = useState(false);
  const [fId, setFId] = useState<string | null>(null);
  const [fType, setFType] = useState(DOC_TYPES[0].name);
  const [fTitle, setFTitle] = useState('');
  const [fDate, setFDate] = useState('');

  // Search / filter
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  // Renew sheet
  const [renewing, setRenewing] = useState<ExpiryDocument | null>(null);
  const [renewDate, setRenewDate] = useState('');

  const closeSheets = () => { setShowForm(false); setRenewing(null); };

  useEffect(() => {
    if (!showForm && !renewing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSheets(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm, renewing]);

  const openForm = (doc?: ExpiryDocument) => {
    setFId(doc?.id ?? null);
    setFType(doc?.type ?? DOC_TYPES[0].name);
    setFTitle(doc?.customTitle ?? '');
    setFDate(doc?.expiryDate ?? '');
    setShowForm(true);
  };

  const canSaveForm = Boolean(fDate) && (fType !== 'Custom' || Boolean(fTitle.trim()));

  const saveForm = () => {
    if (!canSaveForm) return;
    const fields = {
      type: fType,
      customTitle: fTitle.trim() || undefined,
      expiryDate: fDate,
    };
    setDocuments(prev => fId
      ? prev.map(d => d.id === fId ? { ...d, ...fields } : d)
      : [...prev, { id: Math.random().toString(36).slice(2, 9), ...fields }]);
    setShowForm(false);
  };

  const openRenew = (doc: ExpiryDocument) => {
    setRenewing(doc);
    setRenewDate(renewedDate(doc.expiryDate, typeOf(doc.type).months));
  };

  const saveRenew = () => {
    if (!renewing || !renewDate) return;
    setDocuments(prev => prev.map(d => d.id === renewing.id ? { ...d, expiryDate: renewDate } : d));
    setRenewing(null);
  };

  const removeDocument = (doc: ExpiryDocument) => {
    const name = doc.customTitle || typeOf(doc.type).label;
    if (window.confirm(`Padam ${name}?`)) {
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    }
  };

  const sorted = [...documents]
    .map(doc => ({ doc, days: daysUntil(doc.expiryDate) }))
    .sort((a, b) => a.days - b.days);

  // Only the types actually saved get a chip — chips for documents you don't own are dead weight.
  // Deleting the last document of the filtered type drops its chip, so the filter falls back to Semua.
  const usedTypes = DOC_TYPES.filter(t => documents.some(d => d.type === t.name));
  const active = usedTypes.some(t => t.name === filter) ? filter : 'all';

  // Search and filter narrow the list only — the counts in the subtitle stay the truth about everything saved
  const q = query.trim().toLowerCase();
  const shown = sorted.filter(({ doc }) =>
    (active === 'all' || doc.type === active)
    && (!q || (doc.customTitle || '').toLowerCase().includes(q) || typeOf(doc.type).label.toLowerCase().includes(q)));

  const expiredCount = sorted.filter(d => d.days < 0).length;
  const dueCount = sorted.filter(d => d.days >= 0 && toneOf(d.days) === 'due').length;

  const subtitle = documents.length === 0
    ? 'Pasport, roadtax, lesen — sebelum tamat tempoh'
    : [
      expiredCount && `${expiredCount} dah tamat`,
      dueCount && `${dueCount} hampir tamat`,
    ].filter(Boolean).join(' · ') || `Semua ${documents.length} masih sah`;

  const sheet = (title: string, body: React.ReactNode) => createPortal((
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={closeSheets}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up motion-reduce:animate-none"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={closeSheets} aria-label="Tutup" className="p-1 text-muted hover:text-text"><X size={20} /></button>
        </div>
        {body}
      </div>
    </div>
  ), document.body);

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      <div className="flex items-center gap-3 px-1">
        <div className="p-2.5 bg-rose-500/15 text-rose-500 light:text-rose-700 rounded-xl shrink-0">
          <ShieldAlert size={24} />
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold leading-tight">Document Expiry</h2>
          <p className={`text-sm ${expiredCount ? 'text-rose-500 light:text-rose-700 font-semibold' : 'text-muted'}`}>{subtitle}</p>
        </div>
      </div>

      <button
        onClick={() => openForm()}
        className="w-full py-4 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-rose-500/50 hover:text-rose-500 light:hover:text-rose-700 transition-all flex items-center justify-center"
      >
        <Plus size={20} className="mr-2" /> Tambah Dokumen
      </button>

      {documents.length > 1 && (
        <div className="space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cari nama atau jenis"
              aria-label="Cari dokumen"
              className="input-field w-full text-sm py-2 pl-9 pr-9"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Kosongkan carian" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-text">
                <X size={14} />
              </button>
            )}
          </div>

          {usedTypes.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
              {[{ name: 'all', label: 'Semua', Icon: null }, ...usedTypes].map(({ name, label, Icon }) => (
                <button
                  key={name}
                  onClick={() => setFilter(name)}
                  aria-pressed={active === name}
                  className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                    active === name ? 'bg-rose-600 text-[#fff]' : 'bg-text/5 text-muted hover:text-text'
                  }`}
                >
                  {Icon && <Icon size={13} />}{label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {shown.map(({ doc, days }) => {
          const tone = TONE[toneOf(days)];
          const { Icon } = typeOf(doc.type);
          const title = doc.customTitle || typeOf(doc.type).label;

          return (
            <div key={doc.id} className={`glass-panel relative overflow-hidden p-4 transition-shadow ${tone.glow}`}>
              {/* Guilloche. The rosette of fine concentric rings is what makes a passport page, a
                  share certificate or a banknote read as official — two ring sets at slightly
                  different pitches give the moire that evenly spaced circles never do. Kept faint:
                  this is the paper the card is printed on, not something to read. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 opacity-[0.13]"
                style={{
                  backgroundImage:
                    `repeating-radial-gradient(circle at 50% 50%, ${tone.ink} 0 1px, transparent 1px 7px),`
                    + `repeating-radial-gradient(circle at 42% 58%, ${tone.ink} 0 1px, transparent 1px 9px)`,
                  maskImage: 'radial-gradient(circle at 50% 50%, #000 38%, transparent 72%)',
                  WebkitMaskImage: 'radial-gradient(circle at 50% 50%, #000 38%, transparent 72%)',
                }}
              />

              <div className="relative flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone.icon}`}>
                  <Icon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-muted truncate">
                    {doc.type === 'Custom' ? 'Dokumen' : typeOf(doc.type).label}
                  </span>
                  <h3 className="font-bold text-text truncate leading-tight">{title}</h3>
                  <p className="font-mono text-xs text-muted">Tamat {formatDate(doc.expiryDate)}</p>
                </div>
              </div>

              {/* The countdown is the whole reason the tool exists, so it gets the display face and
                  the size, rather than an 11px label in the corner. */}
              <div className="relative flex items-end justify-between gap-3 mt-3">
                <div className="min-w-0">
                  <p
                    className={`text-4xl font-extrabold leading-none ${tone.text}`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {Math.abs(days)}
                  </p>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.16em] mt-1.5 ${tone.text}`}>
                    {days < 0 ? 'hari lewat' : days === 0 ? 'tamat hari ni' : 'hari lagi'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => openRenew(doc)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${tone.btn}`}
                  >
                    <RotateCw size={14} /> Perbaharui
                  </button>
                  <button
                    onClick={() => openForm(doc)}
                    aria-label={`Sunting ${title}`}
                    className="p-2 text-muted hover:text-text bg-text/5 hover:bg-text/10 rounded-lg transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => removeDocument(doc)}
                    aria-label={`Padam ${title}`}
                    className="p-2 text-muted hover:text-rose-500 bg-text/5 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div
                className="relative -mx-4 -mb-4 mt-4 px-4 py-1.5 bg-text/[0.04] border-t border-text/5 overflow-hidden whitespace-nowrap font-mono text-[10px] tracking-[0.15em] text-text/40 select-none"
                aria-hidden="true"
              >
                {mrz(title, doc.expiryDate)}
              </div>
            </div>
          );
        })}

        {shown.length === 0 && (
          <div className="text-center p-8 text-muted text-sm border border-dashed border-text/10 rounded-2xl">
            {documents.length === 0
              ? 'Takde dokumen lagi. Tambah pasport, roadtax atau lesen untuk dapat amaran sebelum tamat tempoh.'
              : 'Takde dokumen yang padan dengan carian ni.'}
          </div>
        )}
      </div>

      {showForm && sheet(fId ? 'Ubah dokumen' : 'Tambah dokumen', (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Jenis</label>
            <div className="grid grid-cols-3 gap-2">
              {DOC_TYPES.map(({ name, label, Icon }) => (
                <button
                  key={name}
                  onClick={() => setFType(name)}
                  aria-pressed={fType === name}
                  className={`${name === 'Custom' ? 'col-span-3 flex-row gap-2' : 'flex-col gap-1'} flex items-center justify-center py-2.5 px-1 rounded-xl text-[11px] font-bold transition-colors ${
                    fType === name ? 'bg-rose-600 text-[#fff]' : 'bg-text/5 text-muted hover:text-text'
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="de-label">
              Nama {fType === 'Custom' ? '' : '(pilihan)'}
            </label>
            <input
              id="de-label"
              value={fTitle}
              onChange={e => setFTitle(e.target.value)}
              placeholder={fType === 'Custom' ? 'cth. Sijil MyKKP' : `cth. Myvi WWW 1234`}
              className="input-field w-full"
            />
            <p className="text-[10px] text-muted">Bagi nama supaya dua dokumen sama jenis tak keliru.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="de-date">Tamat pada</label>
            <input
              id="de-date"
              type="date"
              value={fDate}
              onChange={e => setFDate(e.target.value)}
              className="input-field w-full"
            />
          </div>

          <button
            onClick={saveForm}
            disabled={!canSaveForm}
            className="w-full py-3 rounded-xl bg-rose-600 text-[#fff] font-bold hover:bg-rose-700 disabled:opacity-50 disabled:pointer-events-none"
          >
            {fId ? 'Simpan perubahan' : 'Simpan dokumen'}
          </button>
        </>
      ))}

      {renewing && sheet(`Perbaharui ${renewing.customTitle || typeOf(renewing.type).label}`, (
        <>
          <p className="text-sm text-muted">
            Tamat {formatDate(renewing.expiryDate)} — {statusText(daysUntil(renewing.expiryDate)).toLowerCase()}.
            {daysUntil(renewing.expiryDate) >= 0 && ' Tempoh baru bermula pada hari ia tamat.'}
          </p>

          <div className="grid grid-cols-5 gap-1.5">
            {RENEW_PRESETS.map(({ label, months }) => {
              const date = renewedDate(renewing.expiryDate, months);
              return (
                <button
                  key={label}
                  onClick={() => setRenewDate(date)}
                  aria-pressed={renewDate === date}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                    renewDate === date ? 'bg-rose-600 text-[#fff]' : 'bg-text/5 text-muted hover:text-text'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="de-renew">Tarikh tamat baru</label>
            <input
              id="de-renew"
              type="date"
              value={renewDate}
              min={todayStr()}
              onChange={e => setRenewDate(e.target.value)}
              className="input-field w-full"
            />
          </div>

          <button
            onClick={saveRenew}
            disabled={!renewDate}
            className="w-full py-3 rounded-xl bg-rose-600 text-[#fff] font-bold hover:bg-rose-700 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            <Check size={18} /> Simpan tarikh baru
          </button>
        </>
      ))}
    </div>
  );
};

export default DocumentExpiry;
