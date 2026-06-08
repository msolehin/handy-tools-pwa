import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Plus, Clock, AlertTriangle, Trash2, Camera, Calendar,
  DollarSign, Store, Tag, FileText, CheckCircle, X,
  ShieldCheck, ShieldAlert, ShieldX, Activity, LayoutDashboard, List,
  Laptop, Car, Sofa, Wrench, Package, Zap, Search, Pencil
} from 'lucide-react';

export interface AssetItem {
  id: string;
  name: string;
  category: string;
  purchaseDate: string;
  purchasePrice: number;
  warrantyDuration: number; // In months
  expiryDate: string;
  serialNumber?: string;
  store?: string;
  notes?: string;
  receiptPhoto?: string; // Base64 string
}

const CATEGORIES = ['Electronics', 'Appliances', 'Vehicles', 'Furniture', 'Tools', 'Other'];
const WARRANTY_DURATIONS = [
  { label: '3 Months', value: 3 },
  { label: '6 Months', value: 6 },
  { label: '1 Year', value: 12 },
  { label: '2 Years', value: 24 },
  { label: '3 Years', value: 36 },
  { label: '5 Years', value: 60 },
  { label: '10 Years', value: 120 },
  { label: 'Custom Date', value: 0 },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Electronics: Laptop,
  Appliances: Zap,
  Vehicles: Car,
  Furniture: Sofa,
  Tools: Wrench,
  Other: Package,
};

const getCategoryIcon = (category: string): React.ElementType => CATEGORY_ICONS[category] || Package;

export default function AssetWarrantyTracker() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assets' | 'expired'>('dashboard');
  const [items, setItems] = useState<AssetItem[]>(() => {
    const saved = localStorage.getItem('asset_warranty_tracker_data');
    return saved ? JSON.parse(saved) : [];
  });

  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('asset_warranty_custom_categories');
    return saved ? JSON.parse(saved) : [];
  });

  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<AssetItem | null>(null);
  const [search, setSearch] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [warrantyDuration, setWarrantyDuration] = useState<number>(12);
  const [expiryDate, setExpiryDate] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [store, setStore] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('asset_warranty_tracker_data', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('asset_warranty_custom_categories', JSON.stringify(customCategories));
  }, [customCategories]);

  // Recalculate expiry date when purchase date or warranty duration changes
  useEffect(() => {
    if (warrantyDuration > 0 && purchaseDate) {
      const pDate = new Date(purchaseDate);
      pDate.setMonth(pDate.getMonth() + warrantyDuration);
      setExpiryDate(pDate.toISOString().split('T')[0]);
    }
  }, [purchaseDate, warrantyDuration]);

  const resetForm = () => {
    setName('');
    setCategory(CATEGORIES[0]);
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPurchasePrice('');
    setWarrantyDuration(12);
    setExpiryDate('');
    setSerialNumber('');
    setStore('');
    setNotes('');
    setReceiptPhoto('');
    setEditingItem(null);
    setIsAdding(false);
  };

  const handleEdit = (item: AssetItem) => {
    setName(item.name);
    setCategory(item.category);
    setPurchaseDate(item.purchaseDate);
    setPurchasePrice(item.purchasePrice.toString());
    setWarrantyDuration(item.warrantyDuration);
    setExpiryDate(item.expiryDate);
    setSerialNumber(item.serialNumber || '');
    setStore(item.store || '');
    setNotes(item.notes || '');
    setReceiptPhoto(item.receiptPhoto || '');
    setEditingItem(item);
    setIsAdding(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !purchaseDate || !expiryDate || !purchasePrice) return;

    const newItem: AssetItem = {
      id: editingItem ? editingItem.id : Date.now().toString(),
      name,
      category,
      purchaseDate,
      purchasePrice: parseFloat(purchasePrice) || 0,
      warrantyDuration,
      expiryDate,
      serialNumber,
      store,
      notes,
      receiptPhoto
    };

    if (editingItem) {
      setItems(items.map(i => i.id === newItem.id ? newItem : i));
    } else {
      setItems([...items, newItem]);
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this asset?')) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setReceiptPhoto('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getDaysLeft = (targetDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getWarrantyStatus = (date: string) => {
    const days = getDaysLeft(date);
    if (days < 0) return 'expired';
    if (days <= 30) return 'expiring-soon';
    return 'active';
  };

  // Percentage of warranty period already elapsed (0–100)
  const getWarrantyProgress = (item: AssetItem) => {
    const start = new Date(item.purchaseDate).setHours(0, 0, 0, 0);
    const end = new Date(item.expiryDate).setHours(0, 0, 0, 0);
    const now = new Date().setHours(0, 0, 0, 0);
    if (end <= start) return 100;
    return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  };

  const formatRM = (val: number) => `RM${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Derived state
  const activeItems = items.filter(i => getWarrantyStatus(i.expiryDate) !== 'expired');
  const expiredItems = items.filter(i => getWarrantyStatus(i.expiryDate) === 'expired');
  const expiringSoonItems = items.filter(i => getWarrantyStatus(i.expiryDate) === 'expiring-soon').sort((a, b) => getDaysLeft(a.expiryDate) - getDaysLeft(b.expiryDate));

  const totalAssetsValue = items.reduce((sum, item) => sum + item.purchasePrice, 0);
  const underWarrantyValue = activeItems.reduce((sum, item) => sum + item.purchasePrice, 0);
  const expiredWarrantyValue = expiredItems.reduce((sum, item) => sum + item.purchasePrice, 0);

  // Search filtering for list tabs
  const matchesSearch = (item: AssetItem) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [item.name, item.category, item.store, item.serialNumber]
      .filter(Boolean)
      .some(f => f!.toLowerCase().includes(q));
  };

  const filteredActive = [...activeItems]
    .filter(matchesSearch)
    .sort((a, b) => getDaysLeft(a.expiryDate) - getDaysLeft(b.expiryDate));
  const filteredExpired = [...expiredItems]
    .filter(matchesSearch)
    .sort((a, b) => getDaysLeft(b.expiryDate) - getDaysLeft(a.expiryDate));

  const TABS = [
    { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, count: undefined },
    { key: 'assets', label: 'Assets', Icon: List, count: activeItems.length },
    { key: 'expired', label: 'Expired', Icon: Clock, count: expiredItems.length },
  ] as const;

  // Status pill shown on each asset card
  const StatusBadge = ({ date }: { date: string }) => {
    const status = getWarrantyStatus(date);
    const days = getDaysLeft(date);
    const map = {
      active: { cls: 'bg-emerald-500/15 text-emerald-500', Icon: ShieldCheck, text: `${days} days left` },
      'expiring-soon': { cls: 'bg-orange-500/15 text-orange-500', Icon: ShieldAlert, text: `${days} days left` },
      expired: { cls: 'bg-rose-500/15 text-rose-500', Icon: ShieldX, text: `Expired ${Math.abs(days)}d ago` },
    } as const;
    const { cls, Icon, text } = map[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cls}`}>
        <Icon size={12} /> {text}
      </span>
    );
  };

  // Reusable asset row used in Assets / Expired tabs
  const AssetCard = ({ item }: { item: AssetItem }) => {
    const Icon = getCategoryIcon(item.category);
    const status = getWarrantyStatus(item.expiryDate);
    const progress = getWarrantyProgress(item);
    const barColor = status === 'expired' ? 'bg-rose-500' : status === 'expiring-soon' ? 'bg-orange-500' : 'bg-emerald-500';
    const iconWrap = status === 'expired' ? 'bg-rose-500/10 text-rose-500' : 'bg-orange-500/10 text-orange-500';

    return (
      <div className={`glass-panel p-4 group transition-all hover:border-orange-500/30 ${status === 'expired' ? 'opacity-80' : ''}`}>
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconWrap}`}>
            <Icon size={22} />
          </div>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleEdit(item)}>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-text truncate">{item.name}</h3>
            </div>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted mt-1">
              <span className="px-2 py-0.5 rounded-md bg-text/5 font-medium text-text/70">{item.category}</span>
              <span className="flex items-center gap-1 font-semibold text-text/80">
                <DollarSign size={12} />{formatRM(item.purchasePrice)}
              </span>
              {item.store && (
                <span className="flex items-center gap-1 truncate">
                  <Store size={12} />{item.store}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleEdit(item)}
              aria-label="Edit asset"
              className="p-2 text-muted hover:text-orange-500 bg-text/5 hover:bg-orange-500/10 rounded-lg transition-colors"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
              aria-label="Delete asset"
              className="p-2 text-muted hover:text-rose-500 bg-text/5 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Warranty timeline */}
        <div className="mt-3 pt-3 border-t border-text/5">
          <div className="flex items-center justify-between mb-2">
            <StatusBadge date={item.expiryDate} />
            <span className="text-[11px] text-muted">Expires {formatDate(item.expiryDate)}</span>
          </div>
          <div className="h-1.5 w-full bg-text/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/15 text-orange-500 rounded-xl">
            <Box size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text leading-tight">Asset & Warranty</h1>
            <p className="text-sm text-muted">Track valuables and warranties</p>
          </div>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            aria-label="Add asset"
            className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-orange-500/20 shrink-0"
          >
            <Plus size={24} />
          </button>
        )}
      </div>

      {!isAdding && (
        <div className="grid grid-cols-3 gap-1 p-1 bg-text/5 rounded-xl">
          {TABS.map(({ key, label, Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex flex-col items-center gap-1 ${
                activeTab === key ? 'bg-surface text-orange-400 shadow-sm' : 'text-muted hover:text-text'
              }`}
            >
              <Icon size={16} />
              <span>{label}{typeof count === 'number' ? ` (${count})` : ''}</span>
            </button>
          ))}
        </div>
      )}

      {isAdding ? (
        <div className="glass-panel p-5 animate-slide-up relative">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-text">
              <Plus className="text-orange-500" />
              {editingItem ? 'Edit Asset' : 'Add New Asset'}
            </h2>
            <button
              onClick={resetForm}
              aria-label="Close form"
              className="p-2 bg-text/5 hover:bg-text/10 text-muted rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Item Name *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                  <Tag size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all"
                  placeholder="e.g. MacBook Pro, Air Fryer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider">Category</label>
                  {customCategories.includes(category) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete custom category "${category}"?`)) {
                          setCustomCategories(customCategories.filter(c => c !== category));
                          setCategory(CATEGORIES[0]);
                        }
                      }}
                      className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider"
                    >
                      Delete
                    </button>
                  )}
                </div>
                {category === 'Add Custom...' ? (
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Type custom category name..."
                      className="w-full px-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all"
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val && !CATEGORIES.includes(val) && !customCategories.includes(val)) {
                          setCustomCategories([...customCategories, val]);
                          setCategory(val);
                        } else if (val) {
                          setCategory(val);
                        } else {
                          setCategory(CATEGORIES[0]);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  </div>
                ) : (
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all appearance-none"
                  >
                    {[...CATEGORIES, ...customCategories, 'Add Custom...'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Price (RM) *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                    <DollarSign size={18} />
                  </div>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Purchase Date *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                    <Calendar size={18} />
                  </div>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Warranty</label>
                <select
                  value={warrantyDuration}
                  onChange={(e) => setWarrantyDuration(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all appearance-none"
                >
                  {WARRANTY_DURATIONS.map(w => <option key={w.label} value={w.value}>{w.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Expiry Date *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                  <ShieldAlert size={18} />
                </div>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  disabled={warrantyDuration > 0}
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all disabled:opacity-50 disabled:bg-text/5"
                />
              </div>
              {warrantyDuration > 0 && <p className="text-xs text-muted mt-1 px-1">Auto-calculated from purchase date</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Serial Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                    <Activity size={18} />
                  </div>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Store</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                    <Store size={18} />
                  </div>
                  <input
                    type="text"
                    value={store}
                    onChange={(e) => setStore(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all"
                    placeholder="e.g. Harvey Norman"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Notes</label>
              <div className="relative">
                <div className="absolute top-3 left-3 flex items-start pointer-events-none text-muted">
                  <FileText size={18} />
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all min-h-[80px]"
                  placeholder="Additional details..."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Receipt Photo</label>
              {receiptPhoto ? (
                <div className="relative inline-block w-full h-40 rounded-xl overflow-hidden border border-text/10">
                  <img src={receiptPhoto} alt="Receipt" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div
                  className="w-full border-2 border-dashed border-text/20 rounded-xl p-6 flex flex-col items-center justify-center text-muted hover:text-orange-500 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera size={24} className="mb-2" />
                  <span className="text-sm font-medium">Tap to upload receipt</span>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle size={20} />
              {editingItem ? 'Save Changes' : 'Add Asset'}
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              {/* Hero portfolio value */}
              <div className="glass-panel p-6 relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-orange-500/15 rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 text-muted mb-1">
                    <DollarSign size={16} className="text-orange-500" />
                    <span className="text-xs font-bold uppercase tracking-wider">Total Portfolio Value</span>
                  </div>
                  <div className="text-4xl font-black text-text">{formatRM(totalAssetsValue)}</div>
                  <div className="text-xs text-muted mt-1">{items.length} item{items.length !== 1 ? 's' : ''} tracked</div>

                  {totalAssetsValue > 0 && (
                    <div className="mt-4">
                      <div className="h-2 w-full rounded-full overflow-hidden flex bg-text/10">
                        <div className="h-full bg-emerald-500" style={{ width: `${(underWarrantyValue / totalAssetsValue) * 100}%` }} />
                        <div className="h-full bg-rose-500" style={{ width: `${(expiredWarrantyValue / totalAssetsValue) * 100}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[11px] font-medium">
                        <span className="flex items-center gap-1.5 text-emerald-500">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Covered {formatRM(underWarrantyValue)}
                        </span>
                        <span className="flex items-center gap-1.5 text-rose-500">
                          <span className="w-2 h-2 rounded-full bg-rose-500" /> Expired {formatRM(expiredWarrantyValue)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stat chips */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-panel p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-500 shrink-0">
                    <ShieldCheck size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl font-black text-text leading-none">{activeItems.length}</div>
                    <div className="text-xs text-muted mt-1">Under warranty</div>
                  </div>
                </div>
                <div className="glass-panel p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-500 shrink-0">
                    <ShieldX size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl font-black text-text leading-none">{expiredItems.length}</div>
                    <div className="text-xs text-muted mt-1">Expired</div>
                  </div>
                </div>
              </div>

              {/* Expiring Soon Section */}
              <div className="glass-panel p-5">
                <div className="flex items-center gap-2 mb-4 text-orange-500">
                  <AlertTriangle size={20} className={expiringSoonItems.length > 0 ? 'animate-pulse' : ''} />
                  <h3 className="font-bold text-lg text-text">Expiring Soon</h3>
                  {expiringSoonItems.length > 0 && (
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-500 text-xs font-bold">
                      {expiringSoonItems.length}
                    </span>
                  )}
                </div>

                {expiringSoonItems.length > 0 ? (
                  <div className="space-y-3">
                    {expiringSoonItems.map(item => {
                      const Icon = getCategoryIcon(item.category);
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleEdit(item)}
                          className="p-3 rounded-xl bg-surface border border-orange-500/30 flex items-center gap-3 cursor-pointer hover:bg-orange-500/5 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                            <Icon size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-text truncate">{item.name}</div>
                            <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                              <Store size={12} />
                              {item.store || 'Unknown Store'}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-orange-500">{getDaysLeft(item.expiryDate)}d left</div>
                            <div className="text-[11px] text-muted mt-0.5">{formatDate(item.expiryDate)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted bg-surface/50 rounded-xl border border-dashed border-text/10">
                    <ShieldCheck size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="font-medium text-sm">No items expiring soon.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assets Tab (Active items) */}
          {activeTab === 'assets' && (
            <div className="space-y-4 animate-fade-in">
              {activeItems.length > 0 && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search assets..."
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all"
                  />
                </div>
              )}

              {filteredActive.length > 0 ? (
                filteredActive.map(item => <AssetCard key={item.id} item={item} />)
              ) : activeItems.length > 0 ? (
                <div className="glass-panel p-8 text-center text-muted">
                  <Search size={28} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">No assets match “{search}”.</p>
                </div>
              ) : (
                <div className="glass-panel p-10 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500 mb-4">
                    <Box size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-text mb-2">No active assets</h3>
                  <p className="text-sm text-muted mb-6 max-w-xs mx-auto">Keep track of your valuable items and their warranty periods.</p>
                  <button
                    onClick={() => setIsAdding(true)}
                    className="px-6 py-3 bg-orange-500 text-white rounded-xl font-bold flex items-center gap-2 hover:shadow-lg hover:shadow-orange-500/30 transition-all hover:-translate-y-0.5"
                  >
                    <Plus size={20} />
                    Add Your First Asset
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Expired Tab */}
          {activeTab === 'expired' && (
            <div className="space-y-4 animate-fade-in">
              {expiredItems.length > 0 && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search expired..."
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all"
                  />
                </div>
              )}

              {filteredExpired.length > 0 ? (
                filteredExpired.map(item => <AssetCard key={item.id} item={item} />)
              ) : expiredItems.length > 0 ? (
                <div className="glass-panel p-8 text-center text-muted">
                  <Search size={28} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">No expired items match “{search}”.</p>
                </div>
              ) : (
                <div className="glass-panel p-10 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-4">
                    <ShieldCheck size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-text mb-2">No expired warranties</h3>
                  <p className="text-sm text-muted">All your tracked assets are currently under warranty.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
