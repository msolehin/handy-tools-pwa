import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Home as HomeIcon, Plus, Trash2, Pencil, X, CalendarClock, ChevronDown, ChevronUp, Search, Check, Trash
} from 'lucide-react';

interface HomeAsset {
  id: string;
  name: string;
  location: string;
  createdAt: number;
}

interface ServiceEvent {
  id: string;
  assetId: string;
  date: string; // YYYY-MM-DD
  title: string;
  totalCost: number;
  notes: string;
  nextServiceDate?: string;
}

interface HomeData {
  assets: HomeAsset[];
  events: ServiceEvent[];
}

const STORAGE_KEY = 'home_services_data';
const TITLES_KEY = 'home_custom_titles';
const DEFAULT_TITLES = ['Aircond Chemical Wash', 'Water Filter Replacement', 'Plumbing Repair', 'Pest Control', 'General Cleaning', 'Roof Repair'];

const generateId = () => Math.random().toString(36).substring(2, 9);
const pad = (n: number) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
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
  const [frameEl, setFrameEl] = useState<HTMLElement | null>(null);

  const [customTitles, setCustomTitles] = useState<string[]>(() => {
    const saved = localStorage.getItem(TITLES_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => { setFrameEl(document.getElementById('app-frame')); }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(TITLES_KEY, JSON.stringify(customTitles));
    }
  }, [data, customTitles, isLoaded]);

  // Current selected asset tab
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');

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
  const [assetLocation, setAssetLocation] = useState('');

  const saveAsset = () => {
    if (!assetName.trim()) return;
    
    setData(prev => {
      if (editAssetId) {
        return {
          ...prev,
          assets: prev.assets.map(a => a.id === editAssetId ? { ...a, name: assetName.trim(), location: assetLocation.trim() } : a)
        };
      } else {
        const newAsset = { id: generateId(), name: assetName.trim(), location: assetLocation.trim(), createdAt: Date.now() };
        return { ...prev, assets: [...prev.assets, newAsset] };
      }
    });
    
    setShowAssetForm(false);
    setShowAssetSelector(false);
    setEditAssetId(null);
  };

  const openEditAsset = (asset: HomeAsset) => {
    setEditAssetId(asset.id);
    setAssetName(asset.name);
    setAssetLocation(asset.location);
    setShowAssetForm(true);
  };

  const deleteAsset = (id: string) => {
    if (window.confirm('Delete this home and all its service history?')) {
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
      nextServiceDate: fNextDate || undefined
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
    if (window.confirm("Delete this service record?")) {
      setData(prev => ({ ...prev, events: prev.events.filter(e => e.id !== id) }));
    }
  };

  const currentAsset = data.assets.find(a => a.id === selectedAssetId);
  const currentEvents = data.events
    .filter(e => e.assetId === selectedAssetId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredAssets = data.assets.filter(a => a.name.toLowerCase().includes(assetSearchQuery.toLowerCase()) || a.location.toLowerCase().includes(assetSearchQuery.toLowerCase()));

  const [expandedEvents, setExpandedEvents] = useState<string[]>([]);
  const toggleExpand = (id: string) => {
    setExpandedEvents(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const allTitles = [...DEFAULT_TITLES, ...customTitles];
  const filteredTitles = allTitles.filter(t => t.toLowerCase().includes(fTitle.toLowerCase()));

  const removeCustomTitle = (e: React.MouseEvent, title: string) => {
    e.stopPropagation();
    if (window.confirm(`Delete the custom service name "${title}"?`)) {
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
          <p className="text-sm text-muted">Track home repairs & cost</p>
        </div>
      </div>

      {/* Searchable Asset Selector (Button that opens Modal) */}
      <div className="px-1">
        {data.assets.length > 0 ? (
          <button 
            onClick={() => setShowAssetSelector(true)}
            className="w-full glass-panel p-4 flex items-center justify-between hover:border-teal-500/50 transition-colors"
          >
            {currentAsset ? (
              <div className="text-left">
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-0.5">Current Home</p>
                <p className="font-bold text-lg text-teal-400">{currentAsset.name}</p>
                {currentAsset.location && <p className="text-xs text-text/80">{currentAsset.location}</p>}
              </div>
            ) : (
              <p className="font-bold text-muted">Select a Home...</p>
            )}
            <ChevronDown className="text-muted" />
          </button>
        ) : (
          <button
            onClick={() => {
              setAssetName('');
              setAssetLocation('');
              setShowAssetForm(true);
            }}
            className="w-full py-4 rounded-xl border-2 border-dashed border-white/20 text-muted hover:text-teal-400 hover:border-teal-400/50 transition-colors flex flex-col items-center gap-2"
          >
            <Plus size={24} /> 
            <span className="font-bold">Add Your First Home</span>
          </button>
        )}
      </div>

      {!currentAsset ? (
        data.assets.length > 0 && (
          <div className="glass-panel p-8 text-center flex flex-col items-center">
            <HomeIcon size={32} className="text-muted mb-3 opacity-50" />
            <p className="text-muted text-sm">Please select a home to view its service history.</p>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {currentEvents.length === 0 ? (
            <div className="glass-panel p-8 text-center flex flex-col items-center">
              <CalendarClock size={32} className="text-muted mb-3 opacity-50" />
              <p className="text-muted text-sm mb-4">No service history for this home.</p>
              <button onClick={() => openEventForm()} className="px-4 py-2 bg-teal-500/20 text-teal-400 rounded-lg font-bold hover:bg-teal-500/30 transition-colors text-sm">
                Add First Service
              </button>
            </div>
          ) : (
            <div className="relative pl-4 space-y-6 before:content-[''] before:absolute before:left-[23px] before:top-4 before:bottom-4 before:w-[2px] before:bg-white/10">
              {currentEvents.map(event => {
                const isExpanded = expandedEvents.includes(event.id);
                return (
                  <div key={event.id} className="relative pl-6">
                    <div className="absolute left-[-1px] top-1.5 w-3 h-3 rounded-full bg-teal-500 ring-4 ring-[#121212] z-10" />
                    <div className="glass-panel p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs text-teal-400 font-bold mb-1">{formatDate(event.date)}</p>
                          <h4 className="font-bold text-lg">{event.title}</h4>
                          {event.nextServiceDate && (
                            <p className="text-xs mt-0.5 font-bold flex items-center gap-1 text-rose-400">
                              <CalendarClock size={12} /> Next: {formatDate(event.nextServiceDate)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-emerald-400">RM {event.totalCost.toFixed(2)}</p>
                          <div className="flex items-center gap-1 mt-1 justify-end">
                            <button onClick={() => openEventForm(event)} className="p-1.5 text-muted hover:text-teal-400 rounded-lg bg-text/5"><Pencil size={14} /></button>
                            <button onClick={() => deleteEvent(event.id)} className="p-1.5 text-muted hover:text-rose-400 rounded-lg bg-text/5"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>

                      {event.notes && (
                        <div>
                          <button onClick={() => toggleExpand(event.id)} className="text-xs flex items-center gap-1 text-muted hover:text-text transition-colors py-1">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isExpanded ? 'Hide Details' : 'View Details'}
                          </button>
                          
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-white/5 space-y-3 animate-slide-up">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Notes</p>
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

      {currentAsset && frameEl && createPortal((
        <button onClick={() => openEventForm()} className="fixed bottom-24 right-4 sm:absolute z-30 w-14 h-14 rounded-full bg-teal-500 hover:bg-teal-600 text-white shadow-xl shadow-teal-500/30 flex items-center justify-center active:scale-90 transition-transform" title="Add Service">
          <Plus size={26} />
        </button>
      ), frameEl)}

      {/* Asset Selector Modal */}
      {showAssetSelector && createPortal((
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowAssetSelector(false)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 flex flex-col max-h-[80vh] shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="font-bold text-lg">Select Home</h3>
              <button onClick={() => setShowAssetSelector(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button>
            </div>
            
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input 
                autoFocus
                value={assetSearchQuery} 
                onChange={e => setAssetSearchQuery(e.target.value)} 
                placeholder="Search homes..." 
                className="input-field w-full pl-10" 
              />
            </div>

            <div className="overflow-y-auto space-y-2 custom-scrollbar pb-2">
              {filteredAssets.length === 0 ? (
                <p className="text-center text-muted text-sm py-4">No homes found.</p>
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
                <Plus size={18} /> Add New Home
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
              <h3 className="font-bold text-lg">{editAssetId ? 'Edit' : 'Add'} Home</h3>
              <button onClick={() => setShowAssetForm(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Home Name</label>
              <input autoFocus value={assetName} onChange={e => setAssetName(e.target.value)} placeholder="e.g. My Apartment" className="input-field w-full" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Location/Unit (Optional)</label>
              <input value={assetLocation} onChange={e => setAssetLocation(e.target.value)} placeholder="e.g. Block A, Unit 12" className="input-field w-full" />
            </div>

            <button onClick={saveAsset} disabled={!assetName.trim()} className="w-full py-3 rounded-xl bg-teal-500 text-white font-bold hover:bg-teal-600 disabled:opacity-50 mt-2">
              Save Home
            </button>
          </div>
        </div>
      ), document.body)}

      {/* Event Form Modal */}
      {showEventForm && createPortal((
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowEventForm(false)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 flex flex-col max-h-[90vh] shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="font-bold text-lg">{fId ? 'Edit' : 'Add'} Service Record</h3>
              <button onClick={() => setShowEventForm(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button>
            </div>
            
            <div className="overflow-y-auto pr-1 space-y-4 custom-scrollbar pb-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Date</label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="input-field w-full" />
              </div>

              {/* Dynamic Service Title Dropdown */}
              <div className="space-y-1.5 relative" ref={dropdownRef}>
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Service Title</label>
                <div className="relative">
                  <input 
                    value={fTitle} 
                    onChange={e => {
                      setFTitle(e.target.value);
                      setShowTitleDropdown(true);
                    }} 
                    onFocus={() => setShowTitleDropdown(true)}
                    placeholder="Search or type custom service..." 
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
                              title="Delete custom service"
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
                        <Plus size={14} /> Add "{fTitle.trim()}" as new
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Total Cost (RM)</label>
                <input type="number" min="0" step="0.01" value={fTotalCost} onChange={e => setFTotalCost(e.target.value)} placeholder="0.00" className="input-field w-full text-xl font-bold" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Next Service Date (Optional)</label>
                <input type="date" value={fNextDate} onChange={e => setFNextDate(e.target.value)} className="input-field w-full text-rose-400" />
                <p className="text-[10px] text-muted">Set a date to get reminded on the Home screen.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Notes (Optional)</label>
                <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="Contractor said to check piping in 2 years" className="input-field w-full h-16 resize-none py-2" />
              </div>
            </div>

            <div className="shrink-0 pt-4 border-t border-white/5">
              <button onClick={saveEvent} disabled={!fTitle.trim() || !fDate} className="w-full py-3 rounded-xl bg-teal-500 text-white font-bold hover:bg-teal-600 disabled:opacity-50">
                Save Service Record
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

    </div>
  );
};

export default HomeServices;
