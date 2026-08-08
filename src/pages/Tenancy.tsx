import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, Plus, Trash2, Pencil, X, FileText, Phone, MessageCircle, MapPin } from 'lucide-react';
import { store } from '../lib/store';
import { waNumber } from '../lib/phone';
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

const addYearToDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + 1);
  return fmt(d);
};

const getDaysDiff = (targetDateStr: string): number => {
  const today = new Date(todayStr());
  const target = new Date(targetDateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

// Next time the monthly payment falls due. Day 31 in a short month lands on the last day.
export const nextDueDate = (dueDay: number): string => {
  const today = new Date(todayStr());
  const build = (y: number, m: number) => new Date(y, m, Math.min(dueDay, new Date(y, m + 1, 0).getDate()));
  let next = build(today.getFullYear(), today.getMonth());
  if (next.getTime() < today.getTime()) next = build(today.getFullYear(), today.getMonth() + 1);
  return fmt(next);
};

const money = (n: number) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Tenancy: React.FC = () => {
  const [items, setItems] = useState<Contract[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [frameEl, setFrameEl] = useState<HTMLElement | null>(null);

  useEffect(() => { setFrameEl(document.getElementById('app-frame')); }, []);

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

  const sorted = [...items].sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
  const monthlyTotal = items.reduce((sum, i) => sum + (i.amount || 0), 0);

  const getStatus = (daysLeft: number) => {
    if (daysLeft < 0) return { text: 'Tamat', color: 'text-red-400 bg-red-500/10 border-red-500/30', dot: 'bg-red-400' };
    if (daysLeft <= 60) return { text: 'Hampir Tamat', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', dot: 'bg-amber-400' };
    return { text: 'Aktif', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400' };
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center space-x-3 mb-2 px-1">
        <div className="p-3 bg-teal-500/20 text-teal-400 rounded-xl shrink-0">
          <KeyRound size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Sewa & Kontrak</h2>
          <p className="text-sm text-muted">
            {monthlyTotal > 0 ? `${money(monthlyTotal)} / bulan dikomit` : 'Sewaan, kontrak & pembaharuan'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="glass-panel p-8 text-center flex flex-col items-center">
            <FileText size={32} className="text-muted mb-3" />
            <p className="text-muted text-sm">Belum ada kontrak disimpan.</p>
            <button onClick={() => openForm()} className="mt-4 px-4 py-2 bg-teal-500/20 text-teal-400 rounded-lg font-bold hover:bg-teal-500/30 transition-colors text-sm">
              Tambah kontrak pertama anda
            </button>
          </div>
        ) : (
          sorted.map(item => {
            const daysLeft = getDaysDiff(item.endDate);
            const status = getStatus(daysLeft);
            const due = nextDueDate(item.dueDay);
            const dueIn = getDaysDiff(due);

            return (
              <div key={item.id} className="glass-panel p-4 flex flex-col gap-3 relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${status.dot}`} />
                <div className="flex justify-between items-start pl-2">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: catColor(item.category, categories) }}>
                        {item.category}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${status.color}`}>
                        {status.text} {daysLeft > 0 ? `${daysLeft}h lagi` : daysLeft < 0 ? `${Math.abs(daysLeft)}h lepas` : 'Hari ini'}
                      </span>
                    </div>
                    <p className="font-bold text-text/90 truncate text-lg">{item.title}</p>
                    {item.party && (
                      <p className="text-xs text-muted flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{item.party}</span>
                        {item.phone && (
                          <a href={`tel:${item.phone}`} className="inline-flex items-center gap-1 text-teal-500 light:text-teal-700 hover:underline">
                            <Phone size={11} /> {item.phone}
                          </a>
                        )}
                        {waNumber(item.phone || '') && (
                          <a
                            href={`https://wa.me/${waNumber(item.phone)}`}
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
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openForm(item)} className="p-1.5 text-muted hover:text-emerald-400 rounded-lg bg-text/5"><Pencil size={14} /></button>
                    <button onClick={() => deleteItem(item.id)} className="p-1.5 text-muted hover:text-rose-400 rounded-lg bg-text/5"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="pl-2">
                  <div className="flex bg-black/20 rounded-xl overflow-hidden border border-white/5 divide-x divide-white/5">
                    <div className="flex-1 p-2 text-center">
                      <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">Mula</p>
                      <p className="text-sm font-mono text-text/80">{formatDate(item.startDate)}</p>
                    </div>
                    <div className="flex-1 p-2 text-center bg-white/5">
                      <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">Tamat</p>
                      <p className={`text-sm font-mono font-bold ${daysLeft <= 60 ? 'text-amber-400' : 'text-emerald-400'}`}>{formatDate(item.endDate)}</p>
                    </div>
                  </div>

                  {item.amount > 0 && (
                    <div className="flex items-center justify-between mt-2 px-1 text-xs">
                      <span className="text-muted">
                        <span className="font-bold text-text/80">{money(item.amount)}</span> pada hari {item.dueDay}
                      </span>
                      <span className={dueIn <= 3 ? 'text-amber-400 font-bold' : 'text-muted'}>
                        {dueIn === 0 ? 'Perlu bayar hari ini' : `Bayar dalam ${dueIn}h`}
                      </span>
                    </div>
                  )}
                  {item.deposit > 0 && (
                    <p className="text-xs text-muted mt-1 px-1">Deposit dipegang: <span className="font-bold text-text/80">{money(item.deposit)}</span></p>
                  )}
                  {item.address && (
                    <p className="text-xs text-muted mt-2 pl-1 flex items-start gap-1.5">
                      <MapPin size={12} className="text-teal-500 light:text-teal-700 shrink-0 mt-0.5" />
                      <span className="whitespace-pre-wrap">{item.address}</span>
                    </p>
                  )}
                  {item.notes && <p className="text-xs text-muted mt-2 pl-1"><span className="font-bold">Nota:</span> {item.notes}</p>}
                </div>

                <div className="pl-2 pt-1">
                  <button
                    onClick={() => renewYear(item)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-600 text-white shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all"
                  >
                    Dah renew — lanjut 1 tahun
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {frameEl && createPortal((
        <button onClick={() => openForm()} className="fixed bottom-24 right-4 sm:absolute z-30 w-14 h-14 rounded-full bg-teal-500 hover:bg-teal-600 text-white shadow-xl shadow-teal-500/30 flex items-center justify-center active:scale-90 transition-transform" title="Tambah Kontrak">
          <Plus size={26} />
        </button>
      ), frameEl)}

      {showForm && createPortal((
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{fId ? 'Sunting' : 'Tambah'} Kontrak</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button>
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
