import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { store } from '../lib/store';
import { 
  Hash, Plus, Trash2, Pencil, Search, Copy, Check, Eye, EyeOff, X, BookOpen, CalendarDays
} from 'lucide-react';
import CategoryChips from '../components/CategoryChips';
import { daysUntil, horizonTone } from '../lib/horizon';
import { groupDigits, maskDigits, relativeDay } from '../lib/readable';

interface ImportantNumber {
  id: string;
  category: string;
  name: string;
  value: string;
  /** Optional. A policy's renewal day, an account's opening date — or the whole point of the
      entry, when there is no number to keep at all. */
  date?: string;
  notes: string;
  isHidden: boolean;
}

const STORAGE_KEY = 'important_numbers_data';
const DEFAULT_CATS = ['Utiliti', 'Internet', 'Insurans', 'Keahlian', 'Bank', 'Lain-lain'];
const CAT_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ec4899', '#8b5cf6', '#14b8a6', '#eab308', '#ef4444', '#06b6d4', '#a855f7'];
const catColor = (cat: string, all: string[]) => CAT_COLORS[Math.max(0, all.indexOf(cat)) % CAT_COLORS.length];
const generateId = () => Math.random().toString(36).substring(2, 9);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * A date here can be historic — the day an account was opened — so a passed date is simply neutral,
 * not a failure. Only what is still ahead gets the shared horizon colours.
 */
const dateTone = (iso: string) => {
  const days = daysUntil(iso);
  if (days < 0) return 'text-muted';
  return {
    red: 'text-rose-500 light:text-rose-700',
    amber: 'text-amber-500 light:text-amber-700',
    emerald: 'text-emerald-500 light:text-emerald-700',
  }[horizonTone(days)];
};

const ImportantNumbers: React.FC = () => {
  const [items, setItems] = useState<ImportantNumber[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATS);
  const [search, setSearch] = useState('');
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
  const [fDate, setFDate] = useState('');
  // An entry is one kind or the other. The tab picks it; only the active field is saved.
  const [fKind, setFKind] = useState<'number' | 'date'>('number');
  const [fNotes, setFNotes] = useState('');
  const [fHidden, setFHidden] = useState(false);

  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForm(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm]);

  const openForm = (item?: ImportantNumber) => {
    if (item) {
      setFId(item.id);
      setFCat(item.category);
      setFName(item.name);
      setFValue(item.value);
      setFDate(item.date || '');
      setFKind(item.value ? 'number' : 'date');
      setFNotes(item.notes || '');
      setFHidden(item.isHidden || false);
    } else {
      setFId(null);
      setFCat(categories[0] || 'Lain-lain');
      setFName('');
      setFValue('');
      setFDate('');
      setFKind('number');
      setFNotes('');
      setFHidden(false);
    }
    setShowForm(true);
  };

  const canSave = Boolean(fName.trim()) && Boolean(fKind === 'number' ? fValue.trim() : fDate);

  const saveForm = () => {
    if (!canSave) return;
    // Only the chosen kind is written, so switching the tab genuinely changes what the entry is
    // rather than leaving the other field lying around invisibly.
    const isNumber = fKind === 'number';
    const fields = {
      category: fCat,
      name: fName.trim(),
      value: isNumber ? fValue.trim() : '',
      date: isNumber ? undefined : fDate,
      notes: fNotes.trim(),
      isHidden: isNumber && fHidden,
    };
    if (fId) {
      setItems(prev => prev.map(i => i.id === fId ? { ...i, ...fields } : i));
    } else {
      setItems(prev => [...prev, { id: generateId(), ...fields }]);
    }
    setShowForm(false);
  };

  const deleteItem = (id: string) => {
    if (window.confirm("Padam rekod ini?")) {
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
      alert("Kategori asal tidak boleh dipadam.");
      return;
    }
    if (window.confirm(`Padam kategori '${c}'?`)) {
      setCategories(prev => prev.filter(cat => cat !== c));
      if (fCat === c) setFCat(categories.find(cat => cat !== c) || 'Lain-lain');
    }
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Only confirm once the write actually resolved — clipboard access fails outside a secure context,
  // and a "Disalin" that lied would send someone off to paste nothing.
  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const toggleVisibility = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, isHidden: !i.isHidden } : i));
  };

  // Numbers are displayed grouped in fours, so a search is matched with the spaces taken out of
  // both sides — typing what is on the screen has to find the card that shows it.
  const bare = (s: string) => s.replace(/\s+/g, '').toLowerCase();

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (Boolean(search.trim()) && bare(i.value).includes(bare(search))) ||
    (i.date || '').includes(search) ||
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

  const numberCount = items.filter(i => i.value).length;
  const dateCount = items.filter(i => i.date).length;
  const subtitle = items.length === 0
    ? 'Akaun, polisi, ID & tarikh'
    : [numberCount && `${numberCount} nombor`, dateCount && `${dateCount} tarikh`]
      .filter(Boolean).join(' · ');

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      <div className="flex items-center gap-3 px-1">
        <div className="p-2.5 bg-fuchsia-500/15 text-fuchsia-500 light:text-fuchsia-700 rounded-xl shrink-0">
          <Hash size={24} />
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold leading-tight">Important Number / Date</h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
      </div>

      <div className="relative px-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama, nombor, tarikh atau kategori"
          className="input-field pl-10 pr-10 w-full"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Kosongkan carian"
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-text"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <button
        onClick={() => openForm()}
        className="w-full py-4 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-fuchsia-500/50 hover:text-fuchsia-500 light:hover:text-fuchsia-700 transition-all flex items-center justify-center"
      >
        <Plus size={20} className="mr-2" /> Tambah Rekod
      </button>

      <div className="space-y-6">
        {items.length === 0 ? (
          <div className="glass-panel p-8 text-center flex flex-col items-center">
            <BookOpen size={32} className="text-muted mb-3" />
            <p className="text-sm font-bold text-text">Fail nombor anda masih kosong.</p>
            <p className="text-muted text-sm mt-1 max-w-xs">
              Simpan nombor akaun TNB, polisi insurans atau tarikh renew — sekali taip, senang cari.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted text-center py-4 text-sm">Tiada padanan untuk “{search}”.</p>
        ) : (
          sortedCategories.map(cat => {
            const color = catColor(cat, categories);
            return (
              <div key={cat} className="space-y-2.5">
                {/* The tab divider of a card index: the colour that files the group, its name, then a
                    rule running out to the count. The rule is what makes the groups read as drawers. */}
                <div className="flex items-center gap-2.5 px-1">
                  <span className="h-3.5 w-1 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-text/70">{cat}</h3>
                  <span className="h-px flex-1 bg-text/10" />
                  <span className="font-mono text-[11px] text-muted tabular-nums">{grouped[cat].length}</span>
                </div>

                <div className="space-y-2.5">
                  {grouped[cat].map(item => {
                    const copied = copiedId === item.id;
                    return (
                      <div key={item.id} className="glass-panel relative overflow-hidden p-4 pl-5 flex flex-col gap-2.5 transition-colors hover:border-fuchsia-500/25">
                        {/* Spine. Carries the category colour onto the card itself, so a card stays
                            filed even once you have scrolled its heading off the screen. */}
                        <span aria-hidden="true" className="absolute left-0 inset-y-0 w-1" style={{ backgroundColor: color }} />

                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-text truncate leading-tight">{item.name}</p>
                            {item.notes && <p className="text-[11px] text-muted line-clamp-2 mt-0.5">{item.notes}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => openForm(item)} aria-label={`Sunting ${item.name}`} className="p-1.5 text-muted hover:text-text bg-text/5 hover:bg-text/10 rounded-lg transition-colors"><Pencil size={14} /></button>
                            <button onClick={() => deleteItem(item.id)} aria-label={`Padam ${item.name}`} className="p-1.5 text-muted hover:text-rose-500 bg-text/5 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </div>

                        {/* The plate. Only drawn when there is a number — an entry can be a date alone. */}
                        {item.value && (
                          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                            copied ? 'border-fuchsia-500/60 bg-fuchsia-500/10' : 'border-text/5 bg-text/5'
                          }`}>
                            <span
                              className="font-mono text-lg font-semibold tracking-[0.06em] text-fuchsia-500 light:text-fuchsia-700 truncate select-all"
                              style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              {item.isHidden ? maskDigits(item.value) : groupDigits(item.value)}
                            </span>
                            <div className="ml-auto flex items-center gap-1 shrink-0 pl-2 border-l border-text/10">
                              <button onClick={() => toggleVisibility(item.id)} aria-label={item.isHidden ? `Papar ${item.name}` : `Sembunyi ${item.name}`} className="p-2 text-muted hover:text-text rounded-lg transition-colors">
                                {item.isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                              </button>
                              <button
                                onClick={() => copyToClipboard(item.id, item.value)}
                                aria-label={`Salin ${item.name}`}
                                className="h-9 flex items-center gap-1.5 px-2.5 text-xs font-bold text-fuchsia-500 light:text-fuchsia-700 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 rounded-lg transition-colors"
                              >
                                {copied ? <><Check size={16} /> Disalin</> : <Copy size={16} />}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* A dashed plate, so a date entry is told apart from a number entry mid-scan. */}
                        {item.date && (
                          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-text/15 bg-text/[0.03] px-3 py-2.5">
                            <CalendarDays size={16} className={`shrink-0 ${dateTone(item.date)}`} />
                            <span className="font-mono text-sm text-text" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDate(item.date)}</span>
                            <span className={`ml-auto shrink-0 text-[11px] font-bold uppercase tracking-wider ${dateTone(item.date)}`}>
                              {relativeDay(item.date)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showForm && createPortal((
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowForm(false)}
          role="dialog"
          aria-modal="true"
          aria-label={fId ? 'Sunting rekod' : 'Tambah rekod'}
        >
          {/* The sheet is a column with a fixed head and foot: the fields scroll between them, so
              Save stays reachable no matter how many categories have been added. */}
          <div
            className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md flex flex-col max-h-[88dvh] animate-slide-up motion-reduce:animate-none"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between shrink-0 px-5 pt-5 pb-3">
              <h3 className="font-extrabold text-lg">{fId ? 'Sunting' : 'Tambah'} {fKind === 'number' ? 'nombor' : 'tarikh'}</h3>
              <button onClick={() => setShowForm(false)} aria-label="Tutup" className="p-1 text-muted hover:text-text"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
              {/* Kind leads: it decides what the record is, and every field under it changes shape. */}
              <div className="flex p-1 bg-text/5 rounded-xl gap-1">
                {([['number', 'Nombor', Hash], ['date', 'Tarikh', CalendarDays]] as const).map(([kind, label, Icon]) => (
                  <button
                    key={kind}
                    onClick={() => setFKind(kind)}
                    aria-pressed={fKind === kind}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                      fKind === kind ? 'bg-fuchsia-600 text-[#fff] shadow-lg shadow-fuchsia-600/20' : 'text-muted hover:text-text'
                    }`}
                  >
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="in-name">Nama akaun / penyedia</label>
                <input
                  id="in-name"
                  autoFocus
                  value={fName}
                  onChange={e => setFName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveForm(); }}
                  placeholder={fKind === 'number' ? 'cth. TNB, Unifi, Insurans AIA' : 'cth. Renew polisi AIA'}
                  className="input-field w-full"
                />
              </div>

              {fKind === 'number' ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="in-value">Nombor / ID</label>
                    <input
                      id="in-value"
                      value={fValue}
                      onChange={e => setFValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveForm(); }}
                      placeholder="cth. 1234567890"
                      className="input-field w-full font-mono"
                    />
                    {/* The list groups digits and can mask them. Showing the result here is what makes
                        the toggle below self-explanatory — you see what hiding does before saving. */}
                    {fValue.trim() && (
                      <p className="pt-0.5 text-[11px] text-muted">
                        Papar sebagai{' '}
                        <span className="font-mono text-sm font-semibold tracking-[0.06em] text-fuchsia-500 light:text-fuchsia-700">
                          {fHidden ? maskDigits(fValue.trim()) : groupDigits(fValue.trim())}
                        </span>
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => setFHidden(v => !v)}
                    aria-pressed={fHidden}
                    className={`w-full flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      fHidden ? 'border-fuchsia-500/50 bg-fuchsia-500/10 text-text' : 'border-text/10 bg-text/5 text-muted hover:text-text'
                    }`}
                  >
                    {fHidden ? <EyeOff size={16} className="shrink-0" /> : <Eye size={16} className="shrink-0" />}
                    <span className="text-sm font-medium">Sembunyikan dalam senarai</span>
                    <span className={`ml-auto shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors ${fHidden ? 'bg-fuchsia-600' : 'bg-text/15'}`}>
                      <span className={`block w-4 h-4 rounded-full bg-[#fff] transition-transform ${fHidden ? 'translate-x-4' : ''}`} />
                    </span>
                  </button>
                </>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="in-date">Tarikh</label>
                  <input id="in-date" type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="input-field w-full font-mono" />
                  {fDate && <p className="pt-0.5 text-[11px] text-muted">{formatDate(fDate)} · {relativeDay(fDate)}</p>}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Kategori</label>
                <CategoryChips cats={categories} value={fCat} onSelect={setFCat} onAdd={addCat} onRemove={removeCat} accent="rgb(217 70 239)" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="in-notes">Nota (pilihan)</label>
                <textarea id="in-notes" value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="cth. Didaftarkan atas nama isteri" className="input-field w-full h-20 resize-none py-2" />
              </div>
            </div>

            <div className="shrink-0 border-t border-text/5 px-5 pt-3 pb-5 space-y-2">
              {/* A greyed-out button that never says why is a dead end. Name the one thing outstanding. */}
              {!canSave && (
                <p className="text-center text-[11px] text-muted">
                  {!fName.trim() ? 'Isi nama akaun dulu.' : fKind === 'number' ? 'Isi nombor atau ID.' : 'Pilih tarikh.'}
                </p>
              )}
              <button onClick={saveForm} disabled={!canSave} className="w-full py-3 rounded-xl bg-fuchsia-600 text-[#fff] font-bold hover:bg-fuchsia-700 disabled:opacity-40 disabled:pointer-events-none">
                Simpan {fKind === 'number' ? 'nombor' : 'tarikh'}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

    </div>
  );
};

export default ImportantNumbers;
