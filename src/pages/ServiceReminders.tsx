import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  BellRing, Plus, Trash2, Pencil, RotateCw, X, Wrench, CalendarClock
} from 'lucide-react';
import CategoryChips from '../components/CategoryChips';

interface ServiceReminder {
  id: string;
  category: string;
  name: string;
  intervalMonths: number;
  lastServiceDate: string; // YYYY-MM-DD
  nextServiceDate: string; // YYYY-MM-DD
  notes: string;
  history?: string[];
}

const STORAGE_KEY = 'service_reminders_data';
const DEFAULT_CATS = ['Vehicle', 'Home', 'Health', 'Pets', 'Other'];
const CAT_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ec4899', '#8b5cf6', '#14b8a6', '#eab308', '#ef4444', '#06b6d4', '#a855f7'];
const catColor = (cat: string, all: string[]) => CAT_COLORS[Math.max(0, all.indexOf(cat)) % CAT_COLORS.length];
const generateId = () => Math.random().toString(36).substring(2, 9);
const pad = (n: number) => String(n).padStart(2, '0');

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const addMonthsToDate = (dateStr: string, months: number): string => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getDaysDiff = (targetDateStr: string): number => {
  const today = new Date(todayStr());
  const target = new Date(targetDateStr);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const ServiceReminders: React.FC = () => {
  const [items, setItems] = useState<ServiceReminder[]>([]);
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
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, categories }));
    }
  }, [items, categories, isLoaded]);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [fId, setFId] = useState<string | null>(null);
  const [fCat, setFCat] = useState(DEFAULT_CATS[0]);
  const [fName, setFName] = useState('');
  const [fInterval, setFInterval] = useState('6');
  const [fLastDate, setFLastDate] = useState(todayStr());
  const [fNextDate, setFNextDate] = useState(addMonthsToDate(todayStr(), 6));
  const [fNotes, setFNotes] = useState('');

  // Auto-update next date when last date or interval changes (only if adding new)
  useEffect(() => {
    if (!fId && fLastDate && fInterval) {
      const months = parseInt(fInterval) || 6;
      setFNextDate(addMonthsToDate(fLastDate, months));
    }
  }, [fLastDate, fInterval, fId]);

  const openForm = (item?: ServiceReminder) => {
    if (item) {
      setFId(item.id);
      setFCat(item.category);
      setFName(item.name);
      setFInterval(item.intervalMonths.toString());
      setFLastDate(item.lastServiceDate);
      setFNextDate(item.nextServiceDate);
      setFNotes(item.notes || '');
    } else {
      setFId(null);
      setFCat(categories[0] || 'Other');
      setFName('');
      setFInterval('6');
      setFLastDate(todayStr());
      setFNextDate(addMonthsToDate(todayStr(), 6));
      setFNotes('');
    }
    setShowForm(true);
  };

  const saveForm = () => {
    if (!fName.trim() || !fLastDate || !fNextDate) return;
    const interval = parseInt(fInterval) || 6;
    if (fId) {
      setItems(prev => prev.map(i => i.id === fId ? { ...i, category: fCat, name: fName.trim(), intervalMonths: interval, lastServiceDate: fLastDate, nextServiceDate: fNextDate, notes: fNotes.trim() } : i));
    } else {
      setItems(prev => [...prev, { id: generateId(), category: fCat, name: fName.trim(), intervalMonths: interval, lastServiceDate: fLastDate, nextServiceDate: fNextDate, notes: fNotes.trim() }]);
    }
    setShowForm(false);
  };

  const deleteItem = (id: string) => {
    if (window.confirm("Delete this reminder?")) {
      setItems(prev => prev.filter(i => i.id !== id));
    }
  };

  const markServiced = (item: ServiceReminder) => {
    if (window.confirm(`Mark '${item.name}' as serviced today?`)) {
      const newLast = todayStr();
      const newNext = addMonthsToDate(newLast, item.intervalMonths);
      setItems(prev => prev.map(i => i.id === item.id ? { 
        ...i, 
        lastServiceDate: newLast, 
        nextServiceDate: newNext,
        history: [...(i.history || []), i.lastServiceDate].sort((a, b) => b.localeCompare(a))
      } : i));
    }
  };

  const addCat = (c: string) => {
    const v = c.trim();
    if (v && !categories.includes(v)) setCategories(prev => [...prev, v]);
    setFCat(v);
  };

  const removeCat = (c: string) => {
    if (DEFAULT_CATS.includes(c)) {
      alert("Cannot delete default categories.");
      return;
    }
    if (window.confirm(`Delete the category '${c}'?`)) {
      setCategories(prev => prev.filter(cat => cat !== c));
      if (fCat === c) setFCat(categories.find(cat => cat !== c) || 'Other');
    }
  };

  const sortedItems = [...items].sort((a, b) => new Date(a.nextServiceDate).getTime() - new Date(b.nextServiceDate).getTime());

  const getStatus = (daysLeft: number) => {
    if (daysLeft < 0) return { text: 'Overdue', color: 'text-red-400 bg-red-500/10 border-red-500/30', dot: 'bg-red-400' };
    if (daysLeft <= 10) return { text: 'Due Soon', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', dot: 'bg-amber-400' };
    return { text: 'Good', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400' };
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center space-x-3 mb-2 px-1">
        <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
          <BellRing size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Service Reminders</h2>
          <p className="text-sm text-muted">Keep track of maintenance</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="glass-panel p-8 text-center flex flex-col items-center">
            <Wrench size={32} className="text-muted mb-3" />
            <p className="text-muted text-sm">No service reminders set.</p>
            <button onClick={() => openForm()} className="mt-4 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg font-bold hover:bg-amber-500/30 transition-colors text-sm">
              Add your first reminder
            </button>
          </div>
        ) : (
          sortedItems.map(item => {
            const daysLeft = getDaysDiff(item.nextServiceDate);
            const status = getStatus(daysLeft);
            
            return (
              <div key={item.id} className="glass-panel p-4 flex flex-col gap-3 relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${status.dot}`} />
                <div className="flex justify-between items-start pl-2">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: catColor(item.category, categories) }}>{item.category}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${status.color}`}>
                        {status.text} {daysLeft > 0 ? `in ${daysLeft}d` : daysLeft < 0 ? `by ${Math.abs(daysLeft)}d` : 'Today'}
                      </span>
                    </div>
                    <p className="font-bold text-text/90 truncate text-lg">{item.name}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openForm(item)} className="p-1.5 text-muted hover:text-emerald-400 rounded-lg bg-text/5"><Pencil size={14} /></button>
                    <button onClick={() => deleteItem(item.id)} className="p-1.5 text-muted hover:text-rose-400 rounded-lg bg-text/5"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="pl-2">
                  <div className="flex bg-black/20 rounded-xl overflow-hidden border border-white/5 divide-x divide-white/5">
                    <div className="flex-1 p-2 text-center">
                      <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">Last Service</p>
                      <p className="text-sm font-mono text-text/80">{formatDate(item.lastServiceDate)}</p>
                    </div>
                    <div className="flex-1 p-2 text-center bg-white/5">
                      <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-1">Next Service</p>
                      <p className={`text-sm font-mono font-bold ${daysLeft <= 10 ? 'text-amber-400' : 'text-emerald-400'}`}>{formatDate(item.nextServiceDate)}</p>
                    </div>
                  </div>
                  {item.notes && <p className="text-xs text-muted mt-2 pl-1"><span className="font-bold">Notes:</span> {item.notes}</p>}
                  
                  {item.history && item.history.length > 0 && (
                    <div className="mt-3 pl-1">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5 flex items-center gap-1">
                        <CalendarClock size={12} /> Service History
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.history.map((d, idx) => (
                          <span key={idx} className="text-[10px] font-mono bg-text/5 text-text/80 px-2 py-0.5 rounded border border-white/5">
                            {formatDate(d)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="pl-2 pt-1">
                  <button 
                    onClick={() => markServiced(item)}
                    disabled={item.lastServiceDate === todayStr()}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      item.lastServiceDate === todayStr()
                        ? 'bg-text/5 text-muted opacity-50 cursor-not-allowed'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98]'
                    }`}
                  >
                    <RotateCw size={14} className={item.lastServiceDate === todayStr() ? '' : 'animate-spin-slow'} /> 
                    {item.lastServiceDate === todayStr() ? 'Serviced Today' : 'Mark Serviced Today'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {frameEl && createPortal((
        <button onClick={() => openForm()} className="fixed bottom-24 right-4 sm:absolute z-30 w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/30 flex items-center justify-center active:scale-90 transition-transform" title="Add Reminder">
          <Plus size={26} />
        </button>
      ), frameEl)}

      {showForm && createPortal((
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{fId ? 'Edit' : 'Add'} Reminder</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Service Name</label>
              <input autoFocus value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Aircond Service, Car Oil Change" className="input-field w-full" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Interval (Months)</label>
              <div className="relative">
                <input type="number" min="1" value={fInterval} onChange={e => setFInterval(e.target.value)} className="input-field w-full pr-16" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">Months</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Last Service</label>
                <input type="date" value={fLastDate} onChange={e => setFLastDate(e.target.value)} className="input-field w-full" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Next Service</label>
                <input type="date" value={fNextDate} onChange={e => setFNextDate(e.target.value)} className="input-field w-full" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Category</label>
              <CategoryChips cats={categories} value={fCat} onSelect={setFCat} onAdd={addCat} onRemove={removeCat} accent="rgb(245 158 11)" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Notes (Optional)</label>
              <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="e.g. Recommended to change filter next time" className="input-field w-full h-20 resize-none py-2" />
            </div>

            <button onClick={saveForm} disabled={!fName.trim() || !fLastDate || !fNextDate} className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 disabled:opacity-50 disabled:pointer-events-none">
              Save
            </button>
          </div>
        </div>
      ), document.body)}

    </div>
  );
};

export default ServiceReminders;
