import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, Plus, Trash2, Pencil, X, Phone, MessageCircle, MapPin, RotateCw, StickyNote } from 'lucide-react';
import { store } from '../lib/store';
import { waNumber } from '../lib/phone';
import { addMonths, daysUntil, nextDueDate } from '../lib/horizon';
import CategoryChips from '../components/CategoryChips';

interface Contract {
  id: string;
  title: string;
  category: string;
  party: string; // landlord / provider
  phone: string;
  address: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  amount: number;    // monthly payment
  dueDay: number;    // 1-31
  deposit: number;
  notes: string;
}

const STORAGE_KEY = 'tenancy_data';
const DEFAULT_CATS = ['Sewa', 'Internet', 'Telefon', 'Perkhidmatan', 'Lain-lain'];
const CAT_COLORS = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f97316', '#22c55e', '#eab308', '#ef4444', '#ec4899'];
const catColor = (cat: string, all: string[]) => CAT_COLORS[Math.max(0, all.indexOf(cat)) % CAT_COLORS.length];
const generateId = () => Math.random().toString(36).substring(2, 9);
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => fmt(new Date());

const addYearToDate = (dateStr: string): string => addMonths(dateStr, 12);

/** How far through the term we are, 0–100. Drives the bar that makes "nearly up" visible. */
const termProgress = (start: string, end: string): number => {
  const total = daysUntil(end, new Date(`${start}T00:00:00`));
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, ((total - daysUntil(end)) / total) * 100));
};

const money = (n: number) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Hero figures drop the sen — RM 1,200 scans in one glance where RM 1,200.00 does not. */
const moneyShort = (n: number) => n.toLocaleString('en-MY', { maximumFractionDigits: 0 });

/**
 * One tone per card, decided by how much of the term is left, and worn by everything on it —
 * countdown pill, progress bar, end date, renew button. A card is read as a single coloured
 * object, not as four independently coloured details.
 */
type Tone = 'expired' | 'due' | 'valid';
const TONE: Record<Tone, { ink: string; pill: string; bar: string; btn: string }> = {
  expired: {
    ink: 'text-rose-500 light:text-rose-700',
    pill: 'bg-rose-500/15 text-rose-500 light:text-rose-700',
    bar: 'bg-rose-500',
    btn: 'bg-rose-500 text-[#fff] hover:bg-rose-600',
  },
  due: {
    ink: 'text-amber-500 light:text-amber-700',
    pill: 'bg-amber-500/15 text-amber-500 light:text-amber-700',
    bar: 'bg-amber-500',
    btn: 'bg-amber-500 text-[#fff] hover:bg-amber-600',
  },
  valid: {
    ink: 'text-teal-500 light:text-teal-700',
    pill: 'bg-teal-500/15 text-teal-500 light:text-teal-700',
    bar: 'bg-teal-500',
    btn: 'bg-text/5 text-muted hover:text-text hover:bg-text/10',
  },
};

// 60 days is the notice period most Malaysian tenancies ask for — the point where it stops being
// a date and starts being a decision.
const toneOf = (days: number): Tone => (days < 0 ? 'expired' : days <= 60 ? 'due' : 'valid');

const Tenancy: React.FC = () => {
  const [items, setItems] = useState<Contract[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = store.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (Array.isArray(p.items)) setItems(p.items);
        if (Array.isArray(p.categories)) setCategories(p.categories);
      } catch (e) {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) store.setItem(STORAGE_KEY, JSON.stringify({ items, categories }));
  }, [items, categories, isLoaded]);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [fId, setFId] = useState<string | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fCat, setFCat] = useState(DEFAULT_CATS[0]);
  const [fParty, setFParty] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fAddress, setFAddress] = useState('');
  const [fStart, setFStart] = useState(todayStr());
  const [fEnd, setFEnd] = useState(addYearToDate(todayStr()));
  const [fAmount, setFAmount] = useState('');
  const [fDueDay, setFDueDay] = useState('1');
  const [fDeposit, setFDeposit] = useState('');
  const [fNotes, setFNotes] = useState('');

  // The country-coded number, or null when what's typed can't be dialled. Doubles as the
  // validation flag for the field below.
  const phoneOk = waNumber(fPhone);

  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForm(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm]);

  // Default the end date to a year after the start — most tenancies run 12 months
  useEffect(() => {
    if (!fId && fStart) setFEnd(addYearToDate(fStart));
  }, [fStart, fId]);

  const openForm = (item?: Contract) => {
    if (item) {
      setFId(item.id);
      setFTitle(item.title);
      setFCat(item.category);
      setFParty(item.party || '');
      setFPhone(item.phone || '');
      setFAddress(item.address || '');
      setFStart(item.startDate);
      setFEnd(item.endDate);
      setFAmount(item.amount ? String(item.amount) : '');
      setFDueDay(String(item.dueDay || 1));
      setFDeposit(item.deposit ? String(item.deposit) : '');
      setFNotes(item.notes || '');
    } else {
      setFId(null);
      setFTitle('');
      setFCat(categories[0] || 'Lain-lain');
      setFParty('');
      setFPhone('');
      setFAddress('');
      setFStart(todayStr());
      setFEnd(addYearToDate(todayStr()));
      setFAmount('');
      setFDueDay('1');
      setFDeposit('');
      setFNotes('');
    }
    setShowForm(true);
  };

  const saveForm = () => {
    if (!fTitle.trim() || !fEnd) return;
    const day = Math.min(31, Math.max(1, parseInt(fDueDay) || 1));
    const fields = {
      title: fTitle.trim(),
      category: fCat,
      party: fParty.trim(),
      phone: fPhone.trim(),
      address: fAddress.trim(),
      startDate: fStart,
      endDate: fEnd,
      amount: parseFloat(fAmount) || 0,
      dueDay: day,
      deposit: parseFloat(fDeposit) || 0,
      notes: fNotes.trim(),
    };
    if (fId) {
      setItems(prev => prev.map(i => i.id === fId ? { ...i, ...fields } : i));
    } else {
      setItems(prev => [...prev, { id: generateId(), ...fields }]);
    }
    setShowForm(false);
  };

  const deleteItem = (id: string) => {
    if (window.confirm('Padam kontrak ini?')) setItems(prev => prev.filter(i => i.id !== id));
  };

  const renewYear = (item: Contract) => {
    if (window.confirm(`Lanjutkan '${item.title}' selama setahun?`)) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, startDate: i.endDate, endDate: addYearToDate(i.endDate) } : i));
    }
  };

  const addCat = (c: string) => {
    const v = c.trim();
    if (v && !categories.includes(v)) setCategories(prev => [...prev, v]);
    setFCat(v);
  };

  const removeCat = (c: string) => {
    if (DEFAULT_CATS.includes(c)) {
      alert('Kategori asal tidak boleh dipadam.');
      return;
    }
    if (window.confirm(`Padam kategori '${c}'?`)) {
      setCategories(prev => prev.filter(cat => cat !== c));
      if (fCat === c) setFCat(categories.find(cat => cat !== c) || 'Lain-lain');
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });

  const sorted = [...items]
    .map(item => ({ item, days: daysUntil(item.endDate) }))
    .sort((a, b) => a.days - b.days);

  const monthlyTotal = items.reduce((sum, i) => sum + (i.amount || 0), 0);
  const depositTotal = items.reduce((sum, i) => sum + (i.deposit || 0), 0);
  const endingCount = sorted.filter(s => toneOf(s.days) !== 'valid').length;

  const subtitle = items.length === 0
    ? 'Sewaan, kontrak & pembaharuan'
    : endingCount
      ? `${endingCount} perlu diperbaharui`
      : `${items.length} kontrak, semua aktif`;

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      <div className="flex items-center gap-3 px-1">
        <div className="p-2.5 bg-teal-500/15 text-teal-500 light:text-teal-700 rounded-xl shrink-0">
          <KeyRound size={24} />
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold leading-tight">Sewa & Kontrak</h2>
          <p className={`text-sm ${endingCount ? 'text-amber-500 light:text-amber-700 font-semibold' : 'text-muted'}`}>{subtitle}</p>
        </div>
      </div>

      {/* What the whole list costs, before any single card. The commitment is the headline number
          of this tool, so it gets the display face rather than a line of caption text. */}
      {monthlyTotal > 0 && (
        <div className="glass-panel flex items-stretch divide-x divide-text/10 overflow-hidden">
          <div className="flex-1 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Komitmen bulanan</p>
            <p className="font-display text-3xl font-extrabold leading-none mt-1.5 text-teal-500 light:text-teal-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <span className="text-base align-top mr-0.5 opacity-70">RM</span>{moneyShort(monthlyTotal)}
            </p>
          </div>
          {depositTotal > 0 && (
            <div className="flex-1 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Deposit dipegang</p>
              <p className="font-display text-3xl font-extrabold leading-none mt-1.5 text-text/80" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <span className="text-base align-top mr-0.5 opacity-70">RM</span>{moneyShort(depositTotal)}
              </p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => openForm()}
        className="w-full py-4 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-teal-500/50 hover:text-teal-500 light:hover:text-teal-700 transition-all flex items-center justify-center"
      >
        <Plus size={20} className="mr-2" /> Tambah Kontrak
      </button>

      <div className="space-y-3">
        {sorted.map(({ item, days }) => {
          const tone = TONE[toneOf(days)];
          const dueIn = daysUntil(nextDueDate(item.dueDay));
          const wa = waNumber(item.phone || '');

          return (
            <div key={item.id} className="glass-panel overflow-hidden p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.18em] truncate" style={{ color: catColor(item.category, categories) }}>
                    {item.category}
                  </span>
                  <h3 className="font-bold text-lg leading-tight truncate">{item.title}</h3>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${tone.pill}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {days < 0 ? `Tamat ${Math.abs(days)}h lepas` : days === 0 ? 'Tamat hari ni' : `${days} hari lagi`}
                </span>
              </div>

              {item.party && (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span className="truncate">{item.party}</span>
                  {item.phone && (
                    <a href={`tel:${item.phone}`} className="inline-flex items-center gap-1 font-medium text-teal-500 light:text-teal-700 hover:underline">
                      <Phone size={11} /> {item.phone}
                    </a>
                  )}
                  {wa && (
                    <a
                      href={`https://wa.me/${wa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`WhatsApp ${item.party || item.title}`}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold bg-emerald-500/15 text-emerald-500 light:text-emerald-700 hover:bg-emerald-500/25 transition-colors"
                    >
                      <MessageCircle size={11} /> WhatsApp
                    </a>
                  )}
                </p>
              )}

              {item.amount > 0 && (
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="font-display text-3xl font-extrabold leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <span className="text-base align-top mr-0.5 text-muted">RM</span>{moneyShort(item.amount)}
                    <span className="ml-1 text-xs font-bold text-muted">/bulan</span>
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${dueIn <= 3 ? 'bg-amber-500/15 text-amber-500 light:text-amber-700' : 'bg-text/5 text-muted'}`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {dueIn === 0 ? `Bayar hari ni` : `${item.dueDay}hb · ${dueIn} hari`}
                  </span>
                </div>
              )}

              {/* The term as a bar, not two dates to subtract in your head. */}
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-text/10 overflow-hidden">
                  <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${termProgress(item.startDate, item.endDate)}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between font-mono text-[11px] text-muted">
                  <span>{formatDate(item.startDate)}</span>
                  <span className={`font-bold ${tone.ink}`}>{formatDate(item.endDate)}</span>
                </div>
              </div>

              {(item.deposit > 0 || item.address || item.notes) && (
                <div className="mt-3 space-y-1 border-t border-text/10 pt-3 text-xs text-muted">
                  {item.deposit > 0 && (
                    <p>Deposit dipegang <span className="font-bold text-text/80">{money(item.deposit)}</span></p>
                  )}
                  {item.address && (
                    <p className="flex items-start gap-1.5">
                      <MapPin size={12} className="text-teal-500 light:text-teal-700 shrink-0 mt-0.5" />
                      <span className="whitespace-pre-wrap">{item.address}</span>
                    </p>
                  )}
                  {item.notes && (
                    <p className="flex items-start gap-1.5">
                      <StickyNote size={12} className="shrink-0 mt-0.5" />
                      <span className="whitespace-pre-wrap">{item.notes}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-1.5">
                <button
                  onClick={() => renewYear(item)}
                  className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${tone.btn}`}
                >
                  <RotateCw size={14} /> Dah renew — lanjut 1 tahun
                </button>
                <button
                  onClick={() => openForm(item)}
                  aria-label={`Sunting ${item.title}`}
                  className="p-2 text-muted hover:text-text bg-text/5 hover:bg-text/10 rounded-lg transition-colors"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
                  aria-label={`Padam ${item.title}`}
                  className="p-2 text-muted hover:text-rose-500 bg-text/5 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="text-center p-8 text-muted text-sm border border-dashed border-text/10 rounded-2xl">
            Takde kontrak lagi. Simpan sewa rumah, plan internet atau kontrak perkhidmatan — dapat
            amaran sebelum ia tamat.
          </div>
        )}
      </div>

      {showForm && createPortal((
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowForm(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${fId ? 'Sunting' : 'Tambah'} kontrak`}
        >
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up motion-reduce:animate-none max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{fId ? 'Sunting' : 'Tambah'} Kontrak</h3>
              <button onClick={() => setShowForm(false)} aria-label="Tutup" className="p-1 text-muted hover:text-text"><X size={20} /></button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Tajuk</label>
              <input autoFocus value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="cth. Rumah Sewa Setapak" className="input-field w-full" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Mula</label>
                <input type="date" value={fStart} onChange={e => setFStart(e.target.value)} className="input-field w-full" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Tamat</label>
                <input type="date" value={fEnd} onChange={e => setFEnd(e.target.value)} className="input-field w-full" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Bulanan (RM)</label>
                <input type="number" inputMode="decimal" value={fAmount} onChange={e => setFAmount(e.target.value)} placeholder="0.00" className="input-field w-full" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Hari Bayaran</label>
                <input type="number" min="1" max="31" value={fDueDay} onChange={e => setFDueDay(e.target.value)} className="input-field w-full" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Deposit (RM)</label>
              <input type="number" inputMode="decimal" value={fDeposit} onChange={e => setFDeposit(e.target.value)} placeholder="0.00" className="input-field w-full" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Tuan Rumah / Penyedia</label>
                <input value={fParty} onChange={e => setFParty(e.target.value)} placeholder="Nama" className="input-field w-full" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="tn-phone">Telefon</label>
                <input
                  id="tn-phone"
                  type="tel"
                  inputMode="tel"
                  value={fPhone}
                  onChange={e => setFPhone(e.target.value)}
                  placeholder="01x-xxx xxxx"
                  aria-invalid={Boolean(fPhone.trim()) && !phoneOk}
                  className={`input-field w-full ${fPhone.trim() && !phoneOk ? 'border-rose-500/60' : ''}`}
                />
              </div>
            </div>

            {/* Say what the number will actually do before it is saved, rather than leaving a dead
                WhatsApp button to be discovered later. */}
            {fPhone.trim() && (
              <p className={`text-[11px] -mt-2 ${phoneOk ? 'text-muted' : 'text-rose-500 light:text-rose-700'}`}>
                {phoneOk
                  ? <>WhatsApp akan buka <span className="font-mono">+{phoneOk}</span></>
                  : 'Nombor tak lengkap — WhatsApp tak boleh dibuka. Contoh: 012-345 6789'}
              </p>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="tn-address">Alamat (Pilihan)</label>
              <textarea
                id="tn-address"
                value={fAddress}
                onChange={e => setFAddress(e.target.value)}
                placeholder="cth. No 12, Jalan Setapak 3, 53000 Kuala Lumpur"
                className="input-field w-full h-16 resize-none py-2"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Kategori</label>
              <CategoryChips cats={categories} value={fCat} onSelect={setFCat} onAdd={addCat} onRemove={removeCat} accent="rgb(20 184 166)" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Nota (Pilihan)</label>
              <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="cth. deposit 2 bulan, 1 bulan utiliti" className="input-field w-full h-20 resize-none py-2" />
            </div>

            <button onClick={saveForm} disabled={!fTitle.trim() || !fEnd} className="w-full py-3 rounded-xl bg-teal-500 text-white font-bold hover:bg-teal-600 disabled:opacity-50 disabled:pointer-events-none">
              Simpan
            </button>
          </div>
        </div>
      ), document.body)}
    </div>
  );
};

export default Tenancy;
