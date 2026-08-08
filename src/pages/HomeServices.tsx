import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { store } from '../lib/store';
import { downscaleFile } from '../lib/downscale';
import { 
  Home as HomeIcon, Plus, Trash2, Pencil, X, CalendarClock, ChevronDown, ChevronUp, Search, Check, Trash, Image as ImageIcon
} from 'lucide-react';

interface HomeAsset {
  id: string;
  name: string;
  location: string;
  createdAt: number;
  /** Optional. Downscaled on upload and used as the card background. */
  photo?: string;
}

interface ServiceEvent {
  id: string;
  assetId: string;
  date: string; // YYYY-MM-DD
  title: string;
  totalCost: number;
  notes: string;
  nextServiceDate?: string;
  /** The next service was done, but no record logged yet. Stops the reminder without inventing one. */
  nextDone?: boolean;
}

interface HomeData {
  assets: HomeAsset[];
  events: ServiceEvent[];
}

const STORAGE_KEY = 'home_services_data';
const TITLES_KEY = 'home_custom_titles';
const DEFAULT_TITLES = ['Cuci Aircond', 'Tukar Penapis Air', 'Baiki Paip', 'Kawalan Serangga', 'Cuci Am', 'Baiki Bumbung'];

const MON = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];
const generateId = () => Math.random().toString(36).substring(2, 9);
const pad = (n: number) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Hook to handle clicking outside to close dropdowns
function useOutsideClick(ref: React.RefObject<HTMLElement | null>, callback: () => void) {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [ref, callback]);
}

const HomeServices: React.FC = () => {
  const [data, setData] = useState<HomeData>({ assets: [], events: [] });
  const [isLoaded, setIsLoaded] = useState(false);

  const [customTitles, setCustomTitles] = useState<string[]>(() => {
    const saved = store.getItem(TITLES_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const saved = store.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        setData({
          assets: Array.isArray(p.assets) ? p.assets : [],
          events: Array.isArray(p.events) ? p.events : []
        });
      } catch (e) {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      store.setItem(STORAGE_KEY, JSON.stringify(data));
      store.setItem(TITLES_KEY, JSON.stringify(customTitles));
    }
  }, [data, customTitles, isLoaded]);

  // Current selected asset tab
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);
  useOutsideClick(filterRef, () => setShowFilterDropdown(false));

  useEffect(() => {
    if (data.assets.length > 0 && !selectedAssetId) {
      setSelectedAssetId(data.assets[0].id);
    } else if (data.assets.length === 0) {
      setSelectedAssetId(null);
    }
  }, [data.assets, selectedAssetId]);

  // Forms
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editAssetId, setEditAssetId] = useState<string | null>(null);
  const [assetName, setAssetName] = useState('');
  const [assetPhoto, setAssetPhoto] = useState('');
  const assetFileRef = useRef<HTMLInputElement>(null);
  const [assetLocation, setAssetLocation] = useState('');

  const saveAsset = () => {
    if (!assetName.trim()) return;
    
    setData(prev => {
      if (editAssetId) {
        return {
          ...prev,
          assets: prev.assets.map(a => a.id === editAssetId ? { ...a, name: assetName.trim(), location: assetLocation.trim(), photo: assetPhoto || undefined } : a)
        };
      } else {
        const newAsset = { id: generateId(), name: assetName.trim(), location: assetLocation.trim(), photo: assetPhoto || undefined, createdAt: Date.now() };
        return { ...prev, assets: [...prev.assets, newAsset] };
      }
    });
    
    setAssetPhoto('');
    setShowAssetForm(false);
    setShowAssetSelector(false);
    setEditAssetId(null);
  };

  const openEditAsset = (asset: HomeAsset) => {
    setEditAssetId(asset.id);
    setAssetName(asset.name);
    setAssetLocation(asset.location);
    setAssetPhoto(asset.photo || '');
    setShowAssetForm(true);
  };

  const deleteAsset = (id: string) => {
    if (window.confirm('Padam rumah ni dan semua sejarah servisnya?')) {
      setData(prev => ({
        assets: prev.assets.filter(a => a.id !== id),
        events: prev.events.filter(e => e.assetId !== id)
      }));
      if (selectedAssetId === id) {
        const remaining = data.assets.filter(a => a.id !== id);
        setSelectedAssetId(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  };

  // Event Form
  const [showEventForm, setShowEventForm] = useState(false);
  const [fId, setFId] = useState<string | null>(null);
  const [fDate, setFDate] = useState(todayStr());
  const [fTitle, setFTitle] = useState('');
  const [fTotalCost, setFTotalCost] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [fNextDate, setFNextDate] = useState('');

  const [showTitleDropdown, setShowTitleDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useOutsideClick(dropdownRef, () => setShowTitleDropdown(false));

  const openEventForm = (event?: ServiceEvent) => {
    if (event) {
      setFId(event.id);
      setFDate(event.date);
      setFTitle(event.title);
      setFTotalCost(event.totalCost ? event.totalCost.toString() : '');
      setFNotes(event.notes || '');
      setFNextDate(event.nextServiceDate || '');
    } else {
      setFId(null);
      setFDate(todayStr());
      setFTitle('');
      setFTotalCost('');
      setFNotes('');
      setFNextDate('');
    }
    setShowEventForm(true);
  };
  
  const saveEvent = () => {
    if (!fTitle.trim() || !fDate || !selectedAssetId) return;
    
    // Auto-save custom title if it doesn't exist
    const trimmedTitle = fTitle.trim();
    if (!DEFAULT_TITLES.includes(trimmedTitle) && !customTitles.includes(trimmedTitle)) {
      setCustomTitles(prev => [...prev, trimmedTitle]);
    }
    
    const newEvent: ServiceEvent = {
      id: fId || generateId(),
      assetId: selectedAssetId,
      date: fDate,
      title: trimmedTitle,
      totalCost: parseFloat(fTotalCost) || 0,
      notes: fNotes.trim(),
      nextServiceDate: fNextDate || undefined,
      // Editing keeps the "dah buat" tick; setting a different next date is a new job to do.
      nextDone: fId && data.events.find(e => e.id === fId)?.nextServiceDate === (fNextDate || undefined)
        ? data.events.find(e => e.id === fId)?.nextDone
        : undefined
    };

    setData(prev => {
      if (fId) {
        return { ...prev, events: prev.events.map(e => e.id === fId ? newEvent : e) };
      } else {
        return { ...prev, events: [...prev.events, newEvent] };
      }
    });
    setShowEventForm(false);
  };

  const deleteEvent = (id: string) => {
    if (window.confirm("Padam rekod servis ni?")) {
      setData(prev => ({ ...prev, events: prev.events.filter(e => e.id !== id) }));
    }
  };

  const toggleNextDone = (id: string) => {
    setData(prev => ({
      ...prev,
      events: prev.events.map(e => e.id === id ? { ...e, nextDone: !e.nextDone } : e)
    }));
  };

  const currentAsset = data.assets.find(a => a.id === selectedAssetId);
  const assetEvents = data.events
    .filter(e => e.assetId === selectedAssetId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Only the services this home actually has. Derived rather than stored, so switching to a home
  // that has never had an aircond service falls back to "all" instead of an empty list.
  const serviceTitles = [...new Set(assetEvents.map(e => e.title))].sort();
  const activeFilter = serviceTitles.includes(serviceFilter) ? serviceFilter : 'all';
  const currentEvents = activeFilter === 'all'
    ? assetEvents
    : assetEvents.filter(e => e.title === activeFilter);

  const filteredAssets = data.assets.filter(a => a.name.toLowerCase().includes(assetSearchQuery.toLowerCase()) || a.location.toLowerCase().includes(assetSearchQuery.toLowerCase()));

  const [expandedEvents, setExpandedEvents] = useState<string[]>([]);
  const toggleExpand = (id: string) => {
    setExpandedEvents(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const allTitles = [...DEFAULT_TITLES, ...customTitles];
  const filteredTitles = allTitles.filter(t => t.toLowerCase().includes(fTitle.toLowerCase()));

  const removeCustomTitle = (e: React.MouseEvent, title: string) => {
    e.stopPropagation();
    if (window.confirm(`Padam nama servis "${title}"?`)) {
      setCustomTitles(prev => prev.filter(t => t !== title));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center space-x-3 mb-2 px-1">
        <div className="p-3 bg-teal-500/20 text-teal-500 rounded-xl shrink-0">
          <HomeIcon size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Servis Rumah</h2>
          <p className="text-sm text-muted">Rekod baiki & kos rumah</p>
        </div>
      </div>

      {/* Searchable Asset Selector (Button that opens Modal) */}
      <div className="px-1">
        {data.assets.length > 0 ? (
          <button
            onClick={() => setShowAssetSelector(true)}
            className={`w-full relative overflow-hidden rounded-2xl border border-text/10 text-left transition-colors ${
              currentAsset?.photo ? 'shadow-lg' : 'glass-panel hover:border-teal-500/50'
            }`}
          >
            {currentAsset?.photo && (
              <>
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${currentAsset.photo})` }} />
                {/* The photo is whatever the user picked, so the text never leans on it: this scrim
                    alone carries the contrast. #000 literal because `black` is a theme token here
                    that inverts to white in light mode. */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#000]/85 via-[#000]/60 to-[#000]/30" />
              </>
            )}
            <div className={`relative flex items-center justify-between p-4 ${currentAsset?.photo ? 'min-h-[92px] [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]' : ''}`}>
            {currentAsset ? (
              <div className="text-left min-w-0">
                <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${currentAsset.photo ? 'text-[#fff]/75' : 'text-muted'}`}>Rumah sekarang</p>
                <p className={`font-bold text-lg truncate ${currentAsset.photo ? 'text-[#fff]' : 'text-teal-500 light:text-teal-700'}`}>{currentAsset.name}</p>
                {currentAsset.location && <p className={`text-xs truncate ${currentAsset.photo ? 'text-[#fff]/85' : 'text-text/80'}`}>{currentAsset.location}</p>}
              </div>
            ) : (
              <p className="font-bold text-muted">Pilih rumah...</p>
            )}
            <ChevronDown className={`shrink-0 ${currentAsset?.photo ? 'text-[#fff]/80' : 'text-muted'}`} />
            </div>
          </button>
        ) : (
          <button
            onClick={() => {
              setAssetName('');
              setAssetLocation('');
              setAssetPhoto('');
              setShowAssetForm(true);
            }}
            className="w-full py-4 rounded-xl border-2 border-dashed border-white/20 text-muted hover:text-teal-400 hover:border-teal-400/50 transition-colors flex flex-col items-center gap-2"
          >
            <Plus size={24} /> 
            <span className="font-bold">Tambah rumah pertama</span>
          </button>
        )}
      </div>

      {!currentAsset ? (
        data.assets.length > 0 && (
          <div className="glass-panel p-8 text-center flex flex-col items-center">
            <HomeIcon size={32} className="text-muted mb-3 opacity-50" />
            <p className="text-muted text-sm">Pilih rumah untuk lihat sejarah servis.</p>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => openEventForm()}
            className="w-full py-4 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-teal-500/50 hover:text-teal-500 light:hover:text-teal-700 transition-all flex items-center justify-center"
          >
            <Plus size={20} className="mr-2" /> Tambah Servis
          </button>

          {serviceTitles.length > 0 && (
            <div className="relative px-1" ref={filterRef}>
              <button
                onClick={() => { setShowFilterDropdown(o => !o); setFilterQuery(''); }}
                aria-expanded={showFilterDropdown}
                className={`w-full glass-panel px-4 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                  activeFilter === 'all' ? 'hover:border-teal-500/50' : 'border-teal-500/40'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Search size={14} className="text-muted shrink-0" />
                  <span className={`truncate text-sm font-bold ${
                    activeFilter === 'all' ? 'text-muted' : 'text-teal-500 light:text-teal-700'
                  }`}>
                    {activeFilter === 'all' ? 'Semua servis' : activeFilter}
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-muted">{currentEvents.length}</span>
                  <ChevronDown size={16} className="text-muted" />
                </span>
              </button>

              {showFilterDropdown && (
                <div className="absolute top-full left-1 right-1 mt-1 bg-surface border border-text/10 rounded-xl shadow-2xl z-50 p-1">
                  <input
                    autoFocus
                    value={filterQuery}
                    onChange={e => setFilterQuery(e.target.value)}
                    placeholder="Cari servis..."
                    className="w-full px-3 py-2 mb-1 bg-background/50 border border-text/10 rounded-lg text-sm text-text placeholder-muted focus:outline-none focus:border-teal-500/50"
                  />
                  <div className="max-h-48 overflow-y-auto">
                    {['all', ...serviceTitles]
                      .filter(t => t === 'all' || t.toLowerCase().includes(filterQuery.toLowerCase()))
                      .map(title => (
                        <button
                          key={title}
                          onClick={() => { setServiceFilter(title); setShowFilterDropdown(false); }}
                          className={`w-full px-3 py-2 text-sm rounded-lg flex items-center justify-between gap-2 hover:bg-text/5 transition-colors ${
                            activeFilter === title ? 'text-teal-500 light:text-teal-700 font-bold' : 'text-text'
                          }`}
                        >
                          <span className="truncate">{title === 'all' ? 'Semua servis' : title}</span>
                          <span className="text-xs text-muted shrink-0">
                            {title === 'all' ? assetEvents.length : assetEvents.filter(e => e.title === title).length}
                          </span>
                        </button>
                      ))}
                    {filterQuery.trim() && !serviceTitles.some(t => t.toLowerCase().includes(filterQuery.toLowerCase())) && (
                      <p className="px-3 py-3 text-xs text-muted">Takde servis sepadan “{filterQuery.trim()}”.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {assetEvents.length === 0 ? (
            <div className="glass-panel p-8 text-center flex flex-col items-center">
              <CalendarClock size={32} className="text-muted mb-3 opacity-50" />
              <p className="text-muted text-sm mb-4">Takde sejarah servis untuk rumah ni.</p>
              <button onClick={() => openEventForm()} className="px-4 py-2 bg-teal-500/20 text-teal-500 light:text-teal-700 rounded-lg font-bold hover:bg-teal-500/30 transition-colors text-sm">
                Tambah servis pertama
              </button>
            </div>
          ) : (
            <div className="relative space-y-4 before:content-[''] before:absolute before:left-[21px] before:top-3 before:bottom-3 before:w-[2px] before:bg-text/10">
              {currentEvents.map(event => {
                const isExpanded = expandedEvents.includes(event.id);
                return (
                  <div key={event.id} className="relative flex gap-3">
                    {/* The stamp a workshop presses into a service book: the date of the visit,
                        ringed, sitting on the timeline. It replaces a bare dot that hardcoded
                        ring-[#121212] and so showed as a black halo in light mode. */}
                    <div className="relative z-10 shrink-0 w-11 h-11 rounded-full bg-surface border-2 border-teal-500/50 flex flex-col items-center justify-center shadow-sm">
                      <span className="font-mono text-sm font-bold leading-none text-teal-500 light:text-teal-700"
                            style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {Number(event.date.slice(8, 10))}
                      </span>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-muted leading-none mt-0.5">
                        {MON[Number(event.date.slice(5, 7)) - 1]}
                      </span>
                    </div>

                    <div className="glass-panel p-4 flex-1 min-w-0 flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <h4 className="font-bold text-lg leading-tight truncate">{event.title}</h4>
                          <p className="font-mono text-xs text-muted mt-0.5 truncate">{formatDate(event.date)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEventForm(event)} aria-label="Ubah rekod" className="p-1.5 text-muted hover:text-teal-500 rounded-lg bg-text/5"><Pencil size={14} /></button>
                          <button onClick={() => deleteEvent(event.id)} aria-label="Padam rekod" className="p-1.5 text-muted hover:text-rose-500 rounded-lg bg-text/5"><Trash2 size={14} /></button>
                        </div>
                      </div>

                      {/* Cost is what a service history actually gets read for — "berapa aku bayar
                          kali lepas?" — so it carries the display face and the size. */}
                      <p className="font-display text-2xl font-extrabold leading-none text-emerald-500 light:text-emerald-700"
                         style={{ fontVariantNumeric: 'tabular-nums' }}>
                        RM {event.totalCost.toFixed(2)}
                      </p>

                      {event.nextServiceDate && (
                        <div className="flex items-center gap-2 flex-wrap border-t border-text/5 pt-2.5">
                            <p className={`text-xs font-bold flex items-center gap-1 ${
                              event.nextDone ? 'text-muted line-through' : 'text-rose-500 light:text-rose-700'
                            }`}>
                              <CalendarClock size={12} /> Seterusnya: {formatDate(event.nextServiceDate)}
                            </p>
                            <button
                              onClick={() => toggleNextDone(event.id)}
                              aria-pressed={!!event.nextDone}
                              title={event.nextDone ? 'Tap kalau belum buat lagi' : 'Tap kalau dah buat servis ni'}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors flex items-center gap-1 ${
                                event.nextDone
                                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-500 light:text-emerald-700'
                                  : 'border-text/20 text-muted hover:text-text hover:border-text/40'
                              }`}
                            >
                              {event.nextDone && <Check size={11} strokeWidth={3} />}
                              {event.nextDone ? 'Dah buat' : 'Dah buat?'}
                            </button>
                          </div>
                        )}

                      {event.notes && (
                        <div>
                          <button onClick={() => toggleExpand(event.id)} className="text-xs flex items-center gap-1 text-muted hover:text-text transition-colors py-1">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isExpanded ? 'Tutup butiran' : 'Lihat butiran'}
                          </button>
                          
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-white/5 space-y-3 animate-slide-up">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Nota</p>
                                <p className="text-sm text-text/80 bg-black/20 p-2.5 rounded-lg border border-white/5 whitespace-pre-wrap">{event.notes}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Asset Selector Modal */}
      {showAssetSelector && createPortal((
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowAssetSelector(false)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 flex flex-col max-h-[80vh] shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="font-bold text-lg">Pilih rumah</h3>
              <button onClick={() => setShowAssetSelector(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button>
            </div>
            
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input 
                autoFocus
                value={assetSearchQuery} 
                onChange={e => setAssetSearchQuery(e.target.value)} 
                placeholder="Cari rumah..." 
                className="input-field w-full pl-10" 
              />
            </div>

            <div className="overflow-y-auto space-y-2 custom-scrollbar pb-2">
              {filteredAssets.length === 0 ? (
                <p className="text-center text-muted text-sm py-4">Takde rumah dijumpai.</p>
              ) : (
                filteredAssets.map(asset => (
                  <div key={asset.id} className={`flex items-center justify-between p-3 rounded-xl border ${selectedAssetId === asset.id ? 'border-teal-500 bg-teal-500/10' : 'border-white/5 bg-black/20 hover:border-white/10'} transition-colors cursor-pointer`} onClick={() => { setSelectedAssetId(asset.id); setShowAssetSelector(false); }}>
                    <div>
                      <p className={`font-bold ${selectedAssetId === asset.id ? 'text-teal-400' : 'text-text'}`}>{asset.name}</p>
                      {asset.location && <p className="text-xs text-muted">{asset.location}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {selectedAssetId === asset.id && <Check size={18} className="text-teal-400 mr-1" />}
                      <button onClick={(e) => { e.stopPropagation(); openEditAsset(asset); }} className="p-1.5 text-muted hover:text-teal-400 rounded-lg hover:bg-black/40"><Pencil size={16} /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteAsset(asset.id); }} className="p-1.5 text-muted hover:text-rose-400 rounded-lg hover:bg-black/40"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="shrink-0 pt-4 border-t border-white/5 mt-auto">
              <button onClick={() => { setShowAssetSelector(false); setEditAssetId(null); setAssetName(''); setAssetLocation(''); setShowAssetForm(true); }} className="w-full py-3 rounded-xl border border-dashed border-white/20 text-teal-400 font-bold hover:bg-teal-500/10 transition-colors flex items-center justify-center gap-2">
                <Plus size={18} /> Tambah rumah baru
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* Asset Form Modal */}
      {showAssetForm && createPortal((
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowAssetForm(false)}>
          <div className="bg-surface border border-text/10 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{editAssetId ? 'Sunting' : 'Tambah'} Rumah</h3>
              <button onClick={() => setShowAssetForm(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Nama rumah</label>
              <input autoFocus value={assetName} onChange={e => setAssetName(e.target.value)} placeholder="cth. Rumah Setapak" className="input-field w-full" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Lokasi/Unit (pilihan)</label>
              <input value={assetLocation} onChange={e => setAssetLocation(e.target.value)} placeholder="cth. Blok A, Unit 12" className="input-field w-full" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Gambar (pilihan)</label>
              <input
                type="file"
                accept="image/*"
                ref={assetFileRef}
                onChange={e => {
                  const file = e.target.files?.[0];
                  // 600px is plenty for a card background and keeps the base64 out of quota trouble.
                  if (file) downscaleFile(file, 600).then(setAssetPhoto).catch(() => {});
                }}
                className="hidden"
                id="asset-photo"
              />
              {assetPhoto ? (
                <div className="relative h-24 rounded-xl overflow-hidden border border-text/10">
                  <img src={assetPhoto} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setAssetPhoto(''); if (assetFileRef.current) assetFileRef.current.value = ''; }}
                    aria-label="Buang gambar"
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#000]/50 text-[#fff]/80 hover:text-[#fff] backdrop-blur-md"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="asset-photo"
                  className="flex items-center justify-center gap-2 h-14 rounded-xl border border-dashed border-text/15 bg-text/5 text-muted text-sm cursor-pointer hover:text-text hover:bg-text/10 transition-colors"
                >
                  <ImageIcon size={18} /> Pilih gambar
                </label>
              )}
            </div>

            <button onClick={saveAsset} disabled={!assetName.trim()} className="w-full py-3 rounded-xl bg-teal-500 text-white font-bold hover:bg-teal-600 disabled:opacity-50 mt-2">
              Simpan rumah
            </button>
          </div>
        </div>
      ), document.body)}

      {/* Event Form Modal */}
      {showEventForm && createPortal((
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowEventForm(false)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 flex flex-col max-h-[90vh] shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="font-bold text-lg">{fId ? 'Sunting' : 'Tambah'} Rekod Servis</h3>
              <button onClick={() => setShowEventForm(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button>
            </div>
            
            <div className="overflow-y-auto pr-1 space-y-4 custom-scrollbar pb-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Tarikh</label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="input-field w-full" />
              </div>

              {/* Dynamic Service Title Dropdown */}
              <div className="space-y-1.5 relative" ref={dropdownRef}>
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Jenis servis</label>
                <div className="relative">
                  <input 
                    value={fTitle} 
                    onChange={e => {
                      setFTitle(e.target.value);
                      setShowTitleDropdown(true);
                    }} 
                    onFocus={() => setShowTitleDropdown(true)}
                    placeholder="Cari atau taip servis sendiri..." 
                    className="input-field w-full pr-8" 
                  />
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={16} />
                </div>
                
                {showTitleDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 p-1">
                    {filteredTitles.map(title => {
                      const isCustom = customTitles.includes(title);
                      return (
                        <div 
                          key={title} 
                          onClick={() => { setFTitle(title); setShowTitleDropdown(false); }}
                          className="px-3 py-2 text-sm hover:bg-white/5 rounded-lg cursor-pointer flex items-center justify-between group"
                        >
                          <span>{title}</span>
                          {isCustom && (
                            <button 
                              onClick={(e) => removeCustomTitle(e, title)} 
                              className="text-muted hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Padam servis sendiri"
                            >
                              <Trash size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {fTitle.trim() && !filteredTitles.includes(fTitle.trim()) && (
                      <div 
                        onClick={() => { setShowTitleDropdown(false); }}
                        className="px-3 py-2 text-sm hover:bg-teal-500/10 text-teal-400 rounded-lg cursor-pointer flex items-center gap-2 border-t border-white/5 mt-1"
                      >
                        <Plus size={14} /> Tambah "{fTitle.trim()}" sebagai baru
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Jumlah kos (RM)</label>
                <input type="number" min="0" step="0.01" value={fTotalCost} onChange={e => setFTotalCost(e.target.value)} placeholder="0.00" className="input-field w-full text-xl font-bold" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Tarikh servis seterusnya (pilihan)</label>
                <input type="date" value={fNextDate} onChange={e => setFNextDate(e.target.value)} className="input-field w-full text-rose-400" />
                <p className="text-[10px] text-muted">Set tarikh untuk dapat peringatan di skrin Utama.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Nota (pilihan)</label>
                <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="Kontraktor kata check paip 2 tahun lagi" className="input-field w-full h-16 resize-none py-2" />
              </div>
            </div>

            <div className="shrink-0 pt-4 border-t border-white/5">
              <button onClick={saveEvent} disabled={!fTitle.trim() || !fDate} className="w-full py-3 rounded-xl bg-teal-500 text-white font-bold hover:bg-teal-600 disabled:opacity-50">
                Simpan rekod servis
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

    </div>
  );
};

export default HomeServices;
