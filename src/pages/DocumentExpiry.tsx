import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldAlert, Plus, Trash2, Pencil, X, RotateCw, Check,
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

/** `months` is the usual renewal term, used to pre-fill the renew sheet. */
const DOC_TYPES = [
  { name: 'Passport', Icon: BookUser, months: 60 },
  { name: 'Roadtax', Icon: CarFront, months: 12 },
  { name: 'Driving License', Icon: IdCard, months: 12 },
  { name: 'Identity Card', Icon: Fingerprint, months: 120 },
  { name: 'Medical Card', Icon: HeartPulse, months: 12 },
  { name: 'Visa', Icon: Plane, months: 12 },
  { name: 'Custom', Icon: FileText, months: 12 },
];

const typeOf = (name: string) => DOC_TYPES.find(t => t.name === name) ?? DOC_TYPES[DOC_TYPES.length - 1];

const RENEW_PRESETS = [
  { label: '6 mo', months: 6 },
  { label: '1 yr', months: 12 },
  { label: '2 yr', months: 24 },
  { label: '3 yr', months: 36 },
  { label: '5 yr', months: 60 },
];

type Tone = 'expired' | 'due' | 'valid';

// No single shade of amber or emerald clears 4.5:1 on both the dark surface and the light one,
// so each tone names its light-mode partner. `light:` is the variant registered in tailwind.config.
// `glow` overrides glass-panel's own border and shadow. Both of those live in @layer components
// and these are utilities, which Tailwind emits later — so the utility wins without !important.
const TONE: Record<Tone, { glow: string; text: string; icon: string; btn: string }> = {
  expired: {
    glow: 'border-rose-500/60 shadow-[0_0_20px_-4px_rgb(244_63_94_/_0.55)]',
    text: 'text-rose-500 light:text-rose-700',
    icon: 'bg-rose-500/10 text-rose-500 light:text-rose-700',
    btn: 'bg-rose-500/15 text-rose-500 light:text-rose-700 hover:bg-rose-500/25',
  },
  due: {
    glow: 'border-amber-500/60 shadow-[0_0_20px_-4px_rgb(245_158_11_/_0.50)]',
    text: 'text-amber-500 light:text-amber-700',
    icon: 'bg-amber-500/10 text-amber-500 light:text-amber-700',
    btn: 'bg-amber-500/15 text-amber-500 light:text-amber-700 hover:bg-amber-500/25',
  },
  valid: {
    glow: 'border-emerald-500/40 shadow-[0_0_20px_-6px_rgb(16_185_129_/_0.35)]',
    text: 'text-emerald-500 light:text-emerald-700',
    icon: 'bg-emerald-500/10 text-emerald-500 light:text-emerald-700',
    btn: 'bg-text/5 text-muted hover:text-text hover:bg-text/10',
  },
};

// Expired is a state the shared horizon tones don't carry; everything still ahead uses them.
const toneOf = (days: number): Tone =>
  days < 0 ? 'expired' : horizonTone(days) === 'emerald' ? 'valid' : 'due';

const statusText = (days: number) =>
  days < 0 ? `Expired ${Math.abs(days)}d ago`
    : days === 0 ? 'Expires today'
      : `${days} days left`;

const pad = (n: number) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

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
    const name = doc.customTitle || doc.type;
    if (window.confirm(`Stop tracking ${name}?`)) {
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    }
  };

  const sorted = [...documents]
    .map(doc => ({ doc, days: daysUntil(doc.expiryDate) }))
    .sort((a, b) => a.days - b.days);

  const expiredCount = sorted.filter(d => d.days < 0).length;
  const dueCount = sorted.filter(d => d.days >= 0 && toneOf(d.days) === 'due').length;

  const subtitle = documents.length === 0
    ? 'Passport, roadtax, licence — before they lapse'
    : [
      expiredCount && `${expiredCount} expired`,
      dueCount && `${dueCount} due soon`,
    ].filter(Boolean).join(' · ') || `All ${documents.length} valid`;

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
          <button onClick={closeSheets} aria-label="Close" className="p-1 text-muted hover:text-text"><X size={20} /></button>
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
        <Plus size={20} className="mr-2" /> Add Document
      </button>

      <div className="space-y-3">
        {sorted.map(({ doc, days }) => {
          const tone = TONE[toneOf(days)];
          const { Icon } = typeOf(doc.type);
          const title = doc.customTitle || doc.type;

          return (
            <div key={doc.id} className={`glass-panel overflow-hidden p-4 transition-shadow ${tone.glow}`}>
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone.icon}`}>
                  <Icon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted truncate">
                      {doc.type === 'Custom' ? 'Document' : doc.type}
                    </span>
                    <span className={`text-[11px] font-bold shrink-0 ${tone.text}`}>{statusText(days)}</span>
                  </div>
                  <h3 className="font-bold text-text truncate">{title}</h3>
                  <p className="font-mono text-xs text-muted">{formatDate(doc.expiryDate)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => openRenew(doc)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${tone.btn}`}
                >
                  <RotateCw size={14} /> Renew
                </button>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => openForm(doc)}
                    aria-label={`Edit ${title}`}
                    className="p-2 text-muted hover:text-text bg-text/5 hover:bg-text/10 rounded-lg transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => removeDocument(doc)}
                    aria-label={`Delete ${title}`}
                    className="p-2 text-muted hover:text-rose-500 bg-text/5 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div
                className="-mx-4 -mb-4 mt-4 px-4 py-1.5 bg-text/[0.04] border-t border-text/5 overflow-hidden whitespace-nowrap font-mono text-[10px] tracking-[0.15em] text-text/40 select-none"
                aria-hidden="true"
              >
                {mrz(title, doc.expiryDate)}
              </div>
            </div>
          );
        })}

        {documents.length === 0 && (
          <div className="text-center p-8 text-muted text-sm border border-dashed border-text/10 rounded-2xl">
            Nothing tracked yet. Add your passport, roadtax or licence to get a warning before it lapses.
          </div>
        )}
      </div>

      {showForm && sheet(fId ? 'Edit document' : 'Add document', (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {DOC_TYPES.map(({ name, Icon }) => (
                <button
                  key={name}
                  onClick={() => setFType(name)}
                  aria-pressed={fType === name}
                  className={`${name === 'Custom' ? 'col-span-3 flex-row gap-2' : 'flex-col gap-1'} flex items-center justify-center py-2.5 px-1 rounded-xl text-[11px] font-bold transition-colors ${
                    fType === name ? 'bg-rose-600 text-[#fff]' : 'bg-text/5 text-muted hover:text-text'
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="truncate">{name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="de-label">
              Label {fType === 'Custom' ? '' : '(optional)'}
            </label>
            <input
              id="de-label"
              value={fTitle}
              onChange={e => setFTitle(e.target.value)}
              placeholder={fType === 'Custom' ? 'e.g. Sijil MyKKP' : `e.g. Myvi WWW 1234`}
              className="input-field w-full"
            />
            <p className="text-[10px] text-muted">Name it to tell two of the same type apart.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="de-date">Expires on</label>
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
            {fId ? 'Save changes' : 'Track document'}
          </button>
        </>
      ))}

      {renewing && sheet(`Renew ${renewing.customTitle || renewing.type}`, (
        <>
          <p className="text-sm text-muted">
            Expires {formatDate(renewing.expiryDate)} — {statusText(daysUntil(renewing.expiryDate)).toLowerCase()}.
            {daysUntil(renewing.expiryDate) >= 0 && ' A new term starts the day it lapses.'}
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
            <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="de-renew">New expiry</label>
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
            <Check size={18} /> Save new expiry
          </button>
        </>
      ))}
    </div>
  );
};

export default DocumentExpiry;
