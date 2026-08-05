import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Cake, Plus, Trash2, Pencil, X, Heart, Gift } from 'lucide-react';
import CategoryChips from '../components/CategoryChips';

interface Occasion {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD — the original birth / wedding date
  type: 'birthday' | 'anniversary';
  category: string;
  note: string; // gift ideas, sizes, what they like
}

const STORAGE_KEY = 'birthdays_data';
const DEFAULT_CATS = ['Family', 'Friend', 'Work', 'Other'];
const CAT_COLORS = ['#ec4899', '#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#14b8a6', '#eab308', '#ef4444'];
const catColor = (cat: string, all: string[]) => CAT_COLORS[Math.max(0, all.indexOf(cat)) % CAT_COLORS.length];
const generateId = () => Math.random().toString(36).substring(2, 9);
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => fmt(new Date());

// The next time this date comes around — this year if it hasn't passed, else next year.
// ponytail: 29 Feb rolls to 1 Mar in common years; fine for a reminder, fix if anyone complains.
const nextOccurrence = (dateStr: string): string => {
  const src = new Date(dateStr);
  const today = new Date(todayStr());
  let next = new Date(today.getFullYear(), src.getMonth(), src.getDate());
  if (next.getTime() < today.getTime()) next = new Date(today.getFullYear() + 1, src.getMonth(), src.getDate());
  return fmt(next);
};

const getDaysDiff = (targetDateStr: string): number => {
  const today = new Date(todayStr());
  const target = new Date(targetDateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

// How many years they're turning — only meaningful if the stored year is in the past
const yearsTurning = (dateStr: string, nextStr: string): number | null => {
  const birthYear = new Date(dateStr).getFullYear();
  const years = new Date(nextStr).getFullYear() - birthYear;
  return years > 0 && years < 150 ? years : null;
};

const Birthdays: React.FC = () => {
  const [items, setItems] = useState<Occasion[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [frameEl, setFrameEl] = useState<HTMLElement | null>(null);

  useEffect(() => { setFrameEl(document.getElementById('app-frame')); }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
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
    if (isLoaded) localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, categories }));
  }, [items, categories, isLoaded]);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [fId, setFId] = useState<string | null>(null);
  const [fName, setFName] = useState('');
  const [fDate, setFDate] = useState(todayStr());
  const [fType, setFType] = useState<'birthday' | 'anniversary'>('birthday');
  const [fCat, setFCat] = useState(DEFAULT_CATS[0]);
  const [fNote, setFNote] = useState('');

  const openForm = (item?: Occasion) => {
    if (item) {
      setFId(item.id);
      setFName(item.name);
      setFDate(item.date);
      setFType(item.type);
      setFCat(item.category);
      setFNote(item.note || '');
    } else {
      setFId(null);
      setFName('');
      setFDate(todayStr());
      setFType('birthday');
      setFCat(categories[0] || 'Other');
      setFNote('');
    }
    setShowForm(true);
  };

  const saveForm = () => {
    if (!fName.trim() || !fDate) return;
    const fields = { name: fName.trim(), date: fDate, type: fType, category: fCat, note: fNote.trim() };
    if (fId) {
      setItems(prev => prev.map(i => i.id === fId ? { ...i, ...fields } : i));
    } else {
      setItems(prev => [...prev, { id: generateId(), ...fields }]);
    }
    setShowForm(false);
  };

  const deleteItem = (id: string) => {
    if (window.confirm('Delete this date?')) setItems(prev => prev.filter(i => i.id !== id));
  };

  const addCat = (c: string) => {
    const v = c.trim();
    if (v && !categories.includes(v)) setCategories(prev => [...prev, v]);
    setFCat(v);
  };

  const removeCat = (c: string) => {
    if (DEFAULT_CATS.includes(c)) {
      alert('Cannot delete default categories.');
      return;
    }
    if (window.confirm(`Delete the category '${c}'?`)) {
      setCategories(prev => prev.filter(cat => cat !== c));
      if (fCat === c) setFCat(categories.find(cat => cat !== c) || 'Other');
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  const upcoming = items
    .map(item => {
      const next = nextOccurrence(item.date);
      return { item, next, daysLeft: getDaysDiff(next), years: yearsTurning(item.date, next) };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const soonCount = upcoming.filter(u => u.daysLeft <= 30).length;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center space-x-3 mb-2 px-1">
        <div className="p-3 bg-pink-500/20 text-pink-400 rounded-xl shrink-0">
          <Cake size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Birthdays</h2>
          <p className="text-sm text-muted">
            {soonCount > 0 ? `${soonCount} coming up in 30 days` : 'Birthdays & anniversaries'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="glass-panel p-8 text-center flex flex-col items-center">
            <Gift size={32} className="text-muted mb-3" />
            <p className="text-muted text-sm">No dates saved yet.</p>
            <button onClick={() => openForm()} className="mt-4 px-4 py-2 bg-pink-500/20 text-pink-400 rounded-lg font-bold hover:bg-pink-500/30 transition-colors text-sm">
              Add your first date
            </button>
          </div>
        ) : (
          upcoming.map(({ item, next, daysLeft, years }) => {
            const isToday = daysLeft === 0;
            const isSoon = daysLeft > 0 && daysLeft <= 14;
            const accent = item.type === 'anniversary' ? 'text-rose-400' : 'text-pink-400';

            return (
              <div key={item.id} className="glass-panel p-4 flex flex-col gap-3 relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${isToday ? 'bg-pink-400' : isSoon ? 'bg-amber-400' : 'bg-text/20'}`} />
                <div className="flex justify-between items-start pl-2">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: catColor(item.category, categories) }}>
                        {item.category}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
                        isToday ? 'text-pink-400 bg-pink-500/10 border-pink-500/30'
                        : isSoon ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                        : 'text-muted bg-text/5 border-white/10'
                      }`}>
                        {isToday ? 'Today!' : `in ${daysLeft}d`}
                      </span>
                    </div>
                    <p className="font-bold text-text/90 truncate text-lg flex items-center gap-1.5">
                      {item.type === 'anniversary' ? <Heart size={16} className={accent} /> : <Cake size={16} className={accent} />}
                      {item.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openForm(item)} className="p-1.5 text-muted hover:text-emerald-400 rounded-lg bg-text/5"><Pencil size={14} /></button>
                    <button onClick={() => deleteItem(item.id)} className="p-1.5 text-muted hover:text-rose-400 rounded-lg bg-text/5"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="pl-2">
                  <div className="flex bg-black/20 rounded-xl overflow-hidden border border-white/5 divide-x divide-white/5">
                    <div className="flex-1 p-2 text-center">
                      <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">Date</p>
                      <p className="text-sm font-mono text-text/80">{formatDate(item.date)}</p>
                    </div>
                    <div className="flex-1 p-2 text-center bg-white/5">
                      <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">Next</p>
                      <p className={`text-sm font-mono font-bold ${isToday || isSoon ? 'text-pink-400' : 'text-text/80'}`}>
                        {new Date(next).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    {years !== null && (
                      <div className="flex-1 p-2 text-center">
                        <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">
                          {item.type === 'anniversary' ? 'Years' : 'Turns'}
                        </p>
                        <p className={`text-sm font-mono font-bold ${accent}`}>{years}</p>
                      </div>
                    )}
                  </div>
                  {item.note && <p className="text-xs text-muted mt-2 pl-1"><span className="font-bold">Idea:</span> {item.note}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {frameEl && createPortal((
        <button onClick={() => openForm()} className="fixed bottom-24 right-4 sm:absolute z-30 w-14 h-14 rounded-full bg-pink-500 hover:bg-pink-600 text-white shadow-xl shadow-pink-500/30 flex items-center justify-center active:scale-90 transition-transform" title="Add Date">
          <Plus size={26} />
        </button>
      ), frameEl)}

      {showForm && createPortal((
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{fId ? 'Edit' : 'Add'} Date</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(['birthday', 'anniversary'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFType(t)}
                  className={`py-2.5 rounded-xl text-sm font-bold capitalize flex items-center justify-center gap-1.5 transition-colors ${
                    fType === t ? 'bg-pink-500 text-white' : 'bg-text/5 text-muted hover:text-text'
                  }`}
                >
                  {t === 'anniversary' ? <Heart size={15} /> : <Cake size={15} />} {t}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Name</label>
              <input autoFocus value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Mak, Along, Wedding" className="input-field w-full" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">
                {fType === 'anniversary' ? 'Anniversary Date' : 'Date of Birth'}
              </label>
              <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="input-field w-full" />
              <p className="text-[10px] text-muted">Year is optional info — used only to show the age / years count.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Category</label>
              <CategoryChips cats={categories} value={fCat} onSelect={setFCat} onAdd={addCat} onRemove={removeCat} accent="rgb(236 72 153)" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Gift Idea (Optional)</label>
              <textarea value={fNote} onChange={e => setFNote(e.target.value)} placeholder="e.g. Suka kopi, size baju M" className="input-field w-full h-20 resize-none py-2" />
            </div>

            <button onClick={saveForm} disabled={!fName.trim() || !fDate} className="w-full py-3 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-600 disabled:opacity-50 disabled:pointer-events-none">
              Save
            </button>
          </div>
        </div>
      ), document.body)}
    </div>
  );
};

export default Birthdays;
