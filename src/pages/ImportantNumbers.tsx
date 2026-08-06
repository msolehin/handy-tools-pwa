import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { store } from '../lib/store';
import { 
  Hash, Plus, Trash2, Pencil, Search, Copy, Check, Eye, EyeOff, X, BookOpen
} from 'lucide-react';
import CategoryChips from '../components/CategoryChips';

interface ImportantNumber {
  id: string;
  category: string;
  name: string;
  value: string;
  notes: string;
  isHidden: boolean;
}

const STORAGE_KEY = 'important_numbers_data';
const DEFAULT_CATS = ['Utilities', 'Internet', 'Insurance', 'Memberships', 'Bank', 'Other'];
const CAT_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ec4899', '#8b5cf6', '#14b8a6', '#eab308', '#ef4444', '#06b6d4', '#a855f7'];
const catColor = (cat: string, all: string[]) => CAT_COLORS[Math.max(0, all.indexOf(cat)) % CAT_COLORS.length];
const generateId = () => Math.random().toString(36).substring(2, 9);

const ImportantNumbers: React.FC = () => {
  const [items, setItems] = useState<ImportantNumber[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATS);
  const [search, setSearch] = useState('');
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
    if (isLoaded) {
      store.setItem(STORAGE_KEY, JSON.stringify({ items, categories }));
    }
  }, [items, categories, isLoaded]);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [fId, setFId] = useState<string | null>(null);
  const [fCat, setFCat] = useState(DEFAULT_CATS[0]);
  const [fName, setFName] = useState('');
  const [fValue, setFValue] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [fHidden, setFHidden] = useState(false);

  const openForm = (item?: ImportantNumber) => {
    if (item) {
      setFId(item.id);
      setFCat(item.category);
      setFName(item.name);
      setFValue(item.value);
      setFNotes(item.notes || '');
      setFHidden(item.isHidden || false);
    } else {
      setFId(null);
      setFCat(categories[0] || 'Other');
      setFName('');
      setFValue('');
      setFNotes('');
      setFHidden(false);
    }
    setShowForm(true);
  };

  const saveForm = () => {
    if (!fName.trim() || !fValue.trim()) return;
    if (fId) {
      setItems(prev => prev.map(i => i.id === fId ? { ...i, category: fCat, name: fName.trim(), value: fValue.trim(), notes: fNotes.trim(), isHidden: fHidden } : i));
    } else {
      setItems(prev => [...prev, { id: generateId(), category: fCat, name: fName.trim(), value: fValue.trim(), notes: fNotes.trim(), isHidden: fHidden }]);
    }
    setShowForm(false);
  };

  const deleteItem = (id: string) => {
    if (window.confirm("Delete this number?")) {
      setItems(prev => prev.filter(i => i.id !== id));
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

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleVisibility = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, isHidden: !i.isHidden } : i));
  };

  const filtered = items.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.value.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase()) ||
    (i.notes || '').toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const grouped: Record<string, ImportantNumber[]> = {};
  filtered.forEach(i => {
    if (!grouped[i.category]) grouped[i.category] = [];
    grouped[i.category].push(i);
  });
  const sortedCategories = Object.keys(grouped).sort();

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center space-x-3 mb-2 px-1">
        <div className="p-3 bg-fuchsia-500/20 text-fuchsia-400 rounded-xl shrink-0">
          <Hash size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Important Numbers</h2>
          <p className="text-sm text-muted">Accounts, Policies & IDs</p>
        </div>
      </div>

      <div className="relative px-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input 
          type="text" 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Search by name, number, or category..." 
          className="input-field pl-10 w-full"
        />
      </div>

      <div className="space-y-6">
        {items.length === 0 ? (
          <div className="glass-panel p-8 text-center flex flex-col items-center">
            <BookOpen size={32} className="text-muted mb-3" />
            <p className="text-muted text-sm">You haven't saved any important numbers yet.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted text-center py-4 text-sm">No numbers match your search.</p>
        ) : (
          sortedCategories.map(cat => (
            <div key={cat} className="space-y-2">
              <h3 className="font-bold text-sm flex items-center gap-2 px-1 text-muted uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor(cat, categories) }} />
                {cat}
              </h3>
              <div className="space-y-2">
                {grouped[cat].map(item => (
                  <div key={item.id} className="glass-panel p-4 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-text/90 truncate">{item.name}</p>
                        {item.notes && <p className="text-[11px] text-muted line-clamp-2 mt-0.5">{item.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openForm(item)} className="p-1.5 text-muted hover:text-emerald-400 rounded-lg bg-text/5"><Pencil size={14} /></button>
                        <button onClick={() => deleteItem(item.id)} className="p-1.5 text-muted hover:text-rose-400 rounded-lg bg-text/5"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between bg-black/20 rounded-xl p-2 mt-1 border border-white/5">
                      <div className="font-mono font-bold text-fuchsia-400 text-lg tracking-wider pl-2 truncate select-all">
                        {item.isHidden ? '••••••••••••' : item.value}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 pl-2 border-l border-white/10 ml-2">
                        <button onClick={() => toggleVisibility(item.id)} className="p-2 text-muted hover:text-text rounded-lg" title={item.isHidden ? "Show" : "Hide"}>
                          {item.isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button onClick={() => copyToClipboard(item.id, item.value)} className="p-2 text-fuchsia-400 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 rounded-lg transition-colors flex items-center justify-center w-9 h-9">
                          {copiedId === item.id ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {frameEl && createPortal((
        <button onClick={() => openForm()} className="fixed bottom-24 right-4 sm:absolute z-30 w-14 h-14 rounded-full bg-fuchsia-500 hover:bg-fuchsia-600 text-white shadow-xl shadow-fuchsia-500/30 flex items-center justify-center active:scale-90 transition-transform" title="Add Number">
          <Plus size={26} />
        </button>
      ), frameEl)}

      {showForm && createPortal((
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{fId ? 'Edit' : 'Add'} Number</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Account / Provider Name</label>
              <input autoFocus value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. TNB, Unifi, AIA Insurance" className="input-field w-full" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Number / ID</label>
              <input value={fValue} onChange={e => setFValue(e.target.value)} placeholder="e.g. 1234567890" className="input-field w-full font-mono" />
            </div>

            <div className="flex items-center gap-2 pt-1 pb-1">
              <input type="checkbox" id="hideNumber" checked={fHidden} onChange={e => setFHidden(e.target.checked)} className="rounded bg-black/20 border-white/10 text-fuchsia-500 focus:ring-fuchsia-500 focus:ring-offset-surface" />
              <label htmlFor="hideNumber" className="text-sm text-text/80 select-none">Hide number by default (like a password)</label>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Category</label>
              <CategoryChips cats={categories} value={fCat} onSelect={setFCat} onAdd={addCat} onRemove={removeCat} accent="rgb(217 70 239)" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Notes (Optional)</label>
              <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="e.g. Registered under wife's name" className="input-field w-full h-20 resize-none py-2" />
            </div>

            <button onClick={saveForm} disabled={!fName.trim() || !fValue.trim()} className="w-full py-3 rounded-xl bg-fuchsia-500 text-white font-bold hover:bg-fuchsia-600 disabled:opacity-50 disabled:pointer-events-none">
              Save
            </button>
          </div>
        </div>
      ), document.body)}

    </div>
  );
};

export default ImportantNumbers;
