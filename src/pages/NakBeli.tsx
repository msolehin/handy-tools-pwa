import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingBag, Plus, Trash2, Check, X, TrendingUp, Clock, List, Settings, Calendar, Calculator, CheckCircle2, Pencil } from 'lucide-react';

interface NakBeliItem {
  id: string;
  name: string;
  price: number;
  priority: 'Need' | 'Want' | 'Maybe';
  category: string;
  purchased: boolean;
  purchaseDate?: string;
  actualPrice?: number;
}

interface NakBeliSettings {
  monthlySalary: number;
  workDaysPerMonth: number;
  workHoursPerDay: number;
}

interface NakBeliData {
  items: NakBeliItem[];
  settings: NakBeliSettings;
}

const STORAGE_KEY = 'nak_beli_data';
const EXPENSE_STORAGE_KEY = 'expense_manager_data';

const CATEGORIES = [
  { name: 'Home', icon: '🏠' },
  { name: 'Vehicle', icon: '🚗' },
  { name: 'Hiking', icon: '🏕' },
  { name: 'Tech', icon: '💻' },
  { name: 'Clothing', icon: '👕' },
  { name: 'Gifts', icon: '🎁' },
  { name: 'Other', icon: '📦' }
];

const PRIORITIES = [
  { level: 'Need', icon: '🔥', color: 'text-rose-500', bg: 'bg-rose-500/15' },
  { level: 'Want', icon: '⭐', color: 'text-amber-400', bg: 'bg-amber-400/15' },
  { level: 'Maybe', icon: '💭', color: 'text-slate-400', bg: 'bg-slate-400/15' },
] as const;

const generateId = () => Math.random().toString(36).substring(2, 9);
const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const saveToExpenseManager = (title: string, amount: number, date: string, category: string) => {
  try {
    const saved = localStorage.getItem(EXPENSE_STORAGE_KEY);
    const data = saved ? JSON.parse(saved) : { expenses: [], incomes: [], commitments: [], expenseCats: [], commitCats: [] };
    
    data.expenses = data.expenses || [];
    
    let expCat = 'Shopping'; // Default
    if (category === 'Vehicle') expCat = 'Transport';
    else if (category === 'Home') expCat = 'Other';
    else if (category === 'Tech') expCat = 'Shopping';
    else if (category === 'Clothing') expCat = 'Shopping';
    
    // Fallback if the user has custom categories and removed Shopping
    if (data.expenseCats && Array.isArray(data.expenseCats) && data.expenseCats.length > 0 && !data.expenseCats.includes(expCat)) {
      expCat = data.expenseCats[0];
    }

    data.expenses.push({
      id: generateId(),
      description: title,
      amount: amount,
      category: expCat,
      date: date
    });
    
    localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(data));
  } catch(e) {
    console.error('Failed to sync with Expense Manager', e);
  }
};

const NakBeli: React.FC = () => {
  const [data, setData] = useState<NakBeliData>({
    items: [],
    settings: { monthlySalary: 3200, workDaysPerMonth: 20, workHoursPerDay: 8 }
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [tab, setTab] = useState<'dashboard' | 'items' | 'settings'>('dashboard');
  
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setData({
          items: Array.isArray(parsed.items) ? parsed.items : [],
          settings: parsed.settings || { monthlySalary: 3200, workDaysPerMonth: 20, workHoursPerDay: 8 }
        });
      } catch (e) {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data, isLoaded]);

  const activeItems = useMemo(() => data.items.filter(i => !i.purchased), [data.items]);
  const purchasedItems = useMemo(() => data.items.filter(i => i.purchased), [data.items]);

  const totalCost = activeItems.reduce((acc, i) => acc + i.price, 0);
  const totalPurchased = purchasedItems.reduce((acc, i) => acc + (i.actualPrice || i.price), 0);
  
  const needCount = activeItems.filter(i => i.priority === 'Need').length;
  const wantCount = activeItems.filter(i => i.priority === 'Want').length;

  const getTrueCost = (price: number) => {
    const { monthlySalary, workDaysPerMonth, workHoursPerDay } = data.settings;
    if (!monthlySalary || monthlySalary <= 0) return null;
    
    const pct = (price / monthlySalary) * 100;
    const hourlyRate = monthlySalary / (workDaysPerMonth * workHoursPerDay);
    const hours = price / hourlyRate;
    const days = hours / workHoursPerDay;

    let affordabilityStatus;
    if (pct <= 10) affordabilityStatus = { text: 'Easily Affordable', color: 'text-green-400 bg-green-500/10 border-green-500/30' };
    else if (pct <= 25) affordabilityStatus = { text: 'Affordable', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    else if (pct <= 50) affordabilityStatus = { text: 'Think Twice', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' };
    else if (pct <= 100) affordabilityStatus = { text: 'Not Recommended', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' };
    else affordabilityStatus = { text: 'Not Affordable', color: 'text-red-400 bg-red-500/10 border-red-500/30' };
    
    return { pct, hours, days, affordabilityStatus };
  };

  // Forms & Modals
  const [showItemForm, setShowItemForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fName, setFName] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fPriority, setFPriority] = useState<NakBeliItem['priority']>('Want');
  const [fCategory, setFCategory] = useState('Home');

  const openAdd = () => {
    setEditId(null); setFName(''); setFPrice(''); setFPriority('Want'); setFCategory('Home');
    setShowItemForm(true);
  };
  
  const openEdit = (i: NakBeliItem) => {
    setEditId(i.id); setFName(i.name); setFPrice(i.price.toString()); setFPriority(i.priority); setFCategory(i.category);
    setShowItemForm(true);
  };

  const saveItem = () => {
    if (!fName.trim() || !fPrice) return;
    const price = parseFloat(fPrice);
    if (isNaN(price) || price <= 0) return;

    const newItem: NakBeliItem = {
      id: editId || generateId(),
      name: fName.trim(),
      price,
      priority: fPriority,
      category: fCategory,
      purchased: editId ? (data.items.find(i => i.id === editId)?.purchased || false) : false,
      purchaseDate: editId ? data.items.find(i => i.id === editId)?.purchaseDate : undefined,
      actualPrice: editId ? data.items.find(i => i.id === editId)?.actualPrice : undefined,
    };

    setData(prev => ({
      ...prev,
      items: editId ? prev.items.map(i => i.id === editId ? newItem : i) : [...prev.items, newItem]
    }));
    setShowItemForm(false);
    showToast(editId ? 'Item updated' : 'Item added to Wishlist');
  };

  const deleteItem = (id: string) => {
    if (window.confirm('Delete this item?')) {
      setData(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));
    }
  };

  const [purchaseModalId, setPurchaseModalId] = useState<string | null>(null);
  const [pDate, setPDate] = useState(dateKey(new Date()));
  const [pPrice, setPPrice] = useState('');
  const [pSync, setPSync] = useState(true);

  const openPurchase = (i: NakBeliItem) => {
    setPurchaseModalId(i.id);
    setPDate(dateKey(new Date()));
    setPPrice(i.price.toString());
    setPSync(true);
  };

  const confirmPurchase = () => {
    const item = data.items.find(i => i.id === purchaseModalId);
    if (!item) return;

    const price = parseFloat(pPrice);
    if (isNaN(price) || price < 0) return;

    if (pSync) {
      saveToExpenseManager(item.name, price, pDate, item.category);
    }

    setData(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === purchaseModalId ? { ...i, purchased: true, purchaseDate: pDate, actualPrice: price } : i)
    }));
    setPurchaseModalId(null);
    showToast('Item marked as purchased 🎉');
  };

  const undoPurchase = (id: string) => {
    if (window.confirm('Mark this item as NOT purchased? (Note: It will NOT be removed from Expense Manager automatically)')) {
      setData(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === id ? { ...i, purchased: false, purchaseDate: undefined, actualPrice: undefined } : i)
      }));
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-5 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-surface border border-text/10 shadow-2xl text-sm font-bold text-text text-center animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center space-x-3 px-1">
        <div className="p-3 bg-fuchsia-500/20 rounded-xl"><ShoppingBag className="text-fuchsia-500" size={26} /></div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text/90">Nak Beli</h1>
          <p className="text-[10px] text-muted uppercase tracking-wider">Wishlist & Planning</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-text/5 rounded-xl">
        <button onClick={() => setTab('dashboard')} className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${tab === 'dashboard' ? 'bg-surface text-fuchsia-500 shadow-sm' : 'text-muted hover:text-text'}`}>
          <TrendingUp size={15} /> Dashboard
        </button>
        <button onClick={() => setTab('items')} className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${tab === 'items' ? 'bg-surface text-fuchsia-500 shadow-sm' : 'text-muted hover:text-text'}`}>
          <List size={15} /> Wishlist
        </button>
        <button onClick={() => setTab('settings')} className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${tab === 'settings' ? 'bg-surface text-fuchsia-500 shadow-sm' : 'text-muted hover:text-text'}`}>
          <Settings size={15} /> Settings
        </button>
      </div>

      {tab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-panel p-4 flex flex-col justify-center">
              <p className="text-[10px] font-bold text-muted uppercase">Wishlist Items</p>
              <p className="text-2xl font-black text-text/90 mt-1">{activeItems.length}</p>
            </div>
            <div className="glass-panel p-4 flex flex-col justify-center">
              <p className="text-[10px] font-bold text-muted uppercase">Total Cost</p>
              <p className="text-xl font-black text-rose-400 mt-1 font-mono">RM{fmt(totalCost)}</p>
            </div>
            <div className="glass-panel p-3">
              <p className="text-[10px] font-bold text-muted uppercase mb-1">🔥 Need</p>
              <p className="text-lg font-bold text-rose-500">{needCount}</p>
            </div>
            <div className="glass-panel p-3">
              <p className="text-[10px] font-bold text-muted uppercase mb-1">⭐ Want</p>
              <p className="text-lg font-bold text-amber-400">{wantCount}</p>
            </div>
          </div>

          <div className="glass-panel p-4 space-y-3">
            <h3 className="font-bold text-sm text-text/90 flex items-center gap-2"><CheckCircle2 className="text-emerald-500" size={16} /> Purchase Statistics</h3>
            <div className="flex justify-between items-center bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
              <div>
                <p className="text-[10px] text-emerald-500 font-bold uppercase">Purchased This Year</p>
                <p className="text-xl font-black text-emerald-500 font-mono mt-0.5">RM{fmt(totalPurchased)}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-500">{purchasedItems.length}</p>
                <p className="text-[10px] text-emerald-500/70 uppercase">Items</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'items' && (
        <div className="space-y-4">
          <button onClick={openAdd} className="w-full py-3 border-2 border-dashed border-fuchsia-500/30 rounded-2xl text-fuchsia-500 font-bold hover:bg-fuchsia-500/5 transition-all flex items-center justify-center">
            <Plus size={18} className="mr-2" /> Add New Wishlist Item
          </button>

          {data.items.length === 0 ? (
            <div className="text-center p-8 text-muted text-sm border border-dashed border-text/10 rounded-2xl">
              Your wishlist is empty. Plan your next purchase!
            </div>
          ) : (
            <>
              {activeItems.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase text-muted px-1 flex items-center gap-2">To Buy <span className="bg-text/10 px-2 py-0.5 rounded-full text-[10px]">{activeItems.length}</span></h3>
                  {[...activeItems].sort((a, b) => {
                    const order = { 'Need': 1, 'Want': 2, 'Maybe': 3 };
                    return order[a.priority] - order[b.priority];
                  }).map(item => {
                    const tc = getTrueCost(item.price);
                    const prio = PRIORITIES.find(p => p.level === item.priority)!;
                    const cat = CATEGORIES.find(c => c.name === item.category);
                    
                    return (
                      <div key={item.id} className="glass-panel p-4 relative overflow-hidden group">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3">
                            <button onClick={() => openPurchase(item)} className="mt-1 w-5 h-5 rounded-full border-2 border-text/30 flex items-center justify-center hover:border-emerald-500 hover:text-emerald-500 transition-colors shrink-0">
                              <Check size={12} className="opacity-0 hover:opacity-100" />
                            </button>
                            <div>
                              <h4 className="font-bold text-text/90 leading-tight flex items-center gap-2">
                                {item.name}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 ${prio.bg} ${prio.color}`}>
                                  {prio.icon} {prio.level}
                                </span>
                              </h4>
                              <p className="text-[11px] text-muted flex items-center gap-1 mt-1">
                                <span>{cat?.icon || '📦'} {item.category}</span>
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-black text-rose-400 font-mono">RM{fmt(item.price)}</p>
                            <div className="flex gap-2 mt-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEdit(item)} className="text-muted hover:text-text"><Pencil size={14} /></button>
                              <button onClick={() => deleteItem(item.id)} className="text-rose-400/70 hover:text-rose-500"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        </div>
                        
                        {/* True Cost Display */}
                        {tc && (
                          <div className="bg-text/5 rounded-xl p-3 mt-2">
                            <div className="grid grid-cols-3 gap-2 mb-2">
                              <div className="text-center">
                                <p className="text-[9px] uppercase text-muted font-bold mb-0.5">Of Salary</p>
                                <p className={`text-xs font-bold font-mono ${tc.pct > 50 ? 'text-rose-500' : tc.pct > 20 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                  {tc.pct.toFixed(1)}%
                                </p>
                              </div>
                              <div className="text-center border-l border-text/10">
                                <p className="text-[9px] uppercase text-muted font-bold mb-0.5">Work Hours</p>
                                <p className="text-xs font-bold font-mono text-cyan-500">{tc.hours.toFixed(1)}h</p>
                              </div>
                              <div className="text-center border-l border-text/10">
                                <p className="text-[9px] uppercase text-muted font-bold mb-0.5">Work Days</p>
                                <p className="text-xs font-bold font-mono text-cyan-500">{tc.days.toFixed(1)}d</p>
                              </div>
                            </div>
                            <div className={`text-[10px] font-bold text-center py-1 rounded-lg border ${tc.affordabilityStatus.color}`}>
                              {tc.affordabilityStatus.text}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {purchasedItems.length > 0 && (
                <div className="space-y-3 mt-6 opacity-75">
                  <h3 className="text-xs font-bold uppercase text-muted px-1 flex items-center gap-2">Purchased <span className="bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full text-[10px]">{purchasedItems.length}</span></h3>
                  {[...purchasedItems].sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || '')).map(item => {
                    const cat = CATEGORIES.find(c => c.name === item.category);
                    return (
                      <div key={item.id} className="glass-panel p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button onClick={() => undoPurchase(item.id)} className="w-5 h-5 rounded-full bg-emerald-500 text-surface flex items-center justify-center shrink-0">
                            <Check size={12} strokeWidth={3} />
                          </button>
                          <div>
                            <p className="font-bold text-sm text-text/80 line-through decoration-text/30">{item.name}</p>
                            <p className="text-[10px] text-muted flex items-center gap-1">
                              {cat?.icon || '📦'} {item.category} • <Calendar size={10} className="ml-1" /> {item.purchaseDate}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-emerald-500 font-mono">RM{fmt(item.actualPrice || item.price)}</p>
                          <button onClick={() => deleteItem(item.id)} className="text-[10px] text-rose-400/70 hover:text-rose-500 mt-1">Delete</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-4">
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="text-fuchsia-500" size={20} />
              <h3 className="font-bold">True Cost Settings</h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Set your income and working hours. This is used strictly offline on your device to calculate how much of your life energy goes into buying an item.
            </p>
            
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted uppercase">Monthly Salary / Income (RM)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold font-mono">RM</span>
                  <input 
                    type="number" 
                    value={data.settings.monthlySalary || ''} 
                    onChange={e => setData(p => ({ ...p, settings: { ...p.settings, monthlySalary: parseFloat(e.target.value) || 0 } }))} 
                    className="input-field w-full pl-10 font-mono" 
                    placeholder="3200" 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Work Days/Month</label>
                  <input 
                    type="number" 
                    value={data.settings.workDaysPerMonth || ''} 
                    onChange={e => setData(p => ({ ...p, settings: { ...p.settings, workDaysPerMonth: parseFloat(e.target.value) || 0 } }))} 
                    className="input-field w-full font-mono" 
                    placeholder="20" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Work Hours/Day</label>
                  <input 
                    type="number" 
                    value={data.settings.workHoursPerDay || ''} 
                    onChange={e => setData(p => ({ ...p, settings: { ...p.settings, workHoursPerDay: parseFloat(e.target.value) || 0 } }))} 
                    className="input-field w-full font-mono" 
                    placeholder="8" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showItemForm && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowItemForm(false)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{editId ? 'Edit Item' : 'Add to Wishlist'}</h3>
              <button onClick={() => setShowItemForm(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted uppercase">Item Name</label>
                <input value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Naturehike Tent" className="input-field w-full text-sm" autoFocus />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted uppercase">Target Price (RM)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold font-mono">RM</span>
                  <input type="number" value={fPrice} onChange={e => setFPrice(e.target.value)} placeholder="350" className="input-field w-full pl-10 font-mono text-sm" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted uppercase">Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRIORITIES.map(p => (
                    <button
                      key={p.level}
                      onClick={() => setFPriority(p.level)}
                      className={`py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all
                        ${fPriority === p.level ? `border-${p.color.split('-')[1]}-500 ${p.bg} ${p.color} ring-1 ring-${p.color.split('-')[1]}-500` : 'border-text/10 text-muted hover:bg-text/5'}`}
                    >
                      {p.icon} {p.level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted uppercase">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.name}
                      onClick={() => setFCategory(c.name)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${fCategory === c.name ? 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-500' : 'border-text/10 text-muted hover:bg-text/5'}`}
                    >
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live True Cost Preview */}
            {parseFloat(fPrice) > 0 && getTrueCost(parseFloat(fPrice)) && (
              <div className="bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-xl p-3 flex flex-col items-center text-center">
                <p className="text-[10px] text-fuchsia-500 font-bold uppercase mb-1 flex items-center gap-1"><Clock size={12} /> True Cost Preview</p>
                <p className="text-xs text-text/80 font-medium leading-relaxed mb-2">
                  Requires <strong className="text-fuchsia-400">{getTrueCost(parseFloat(fPrice))?.hours.toFixed(1)} hours</strong> of work<br/>
                  (<strong className="text-fuchsia-400">{getTrueCost(parseFloat(fPrice))?.pct.toFixed(1)}%</strong> of your monthly income)
                </p>
                <div className={`text-[10px] font-bold px-3 py-1 rounded-lg border ${getTrueCost(parseFloat(fPrice))?.affordabilityStatus.color}`}>
                  {getTrueCost(parseFloat(fPrice))?.affordabilityStatus.text}
                </div>
              </div>
            )}

            <button onClick={saveItem} className="w-full py-3 bg-fuchsia-500 hover:bg-fuchsia-600 text-white rounded-xl font-bold transition-colors">
              {editId ? 'Save Changes' : 'Add to Wishlist'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Purchase Modal */}
      {purchaseModalId && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setPurchaseModalId(null)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-emerald-500 flex items-center gap-2"><CheckCircle2 size={20} /> Record Purchase</h3>
              <button onClick={() => setPurchaseModalId(null)} className="p-1 text-muted hover:text-text"><X size={20} /></button>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <p className="font-bold text-text/90">{data.items.find(i => i.id === purchaseModalId)?.name}</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted uppercase">Bought Date</label>
                <input type="date" value={pDate} onChange={e => setPDate(e.target.value)} className="input-field w-full text-sm" />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted uppercase">Actual Price Paid (RM)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold font-mono">RM</span>
                  <input type="number" value={pPrice} onChange={e => setPPrice(e.target.value)} placeholder="0.00" className="input-field w-full pl-10 font-mono text-sm" />
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 bg-text/5 hover:bg-text/10 rounded-xl cursor-pointer transition-colors border border-text/5">
                <input type="checkbox" checked={pSync} onChange={e => setPSync(e.target.checked)} className="w-5 h-5 rounded accent-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-text/90">Sync to Expense Manager</p>
                  <p className="text-[10px] text-muted leading-tight">Automatically records this purchase as an expense</p>
                </div>
              </label>
            </div>

            <button onClick={confirmPurchase} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
              <Check size={18} /> Confirm Purchase
            </button>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default NakBeli;
