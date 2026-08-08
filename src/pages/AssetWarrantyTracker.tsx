import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Plus, Clock, AlertTriangle, Trash2, Camera, Calendar,
  DollarSign, Store, Tag, FileText, CheckCircle, X,
  ShieldCheck, ShieldAlert, ShieldX, Activity, LayoutDashboard, List,
  Laptop, Car, Sofa, Wrench, Package, Zap, Search, Pencil
} from 'lucide-react';
import { downscaleFile, shrinkExisting } from '../lib/downscale';
import { store as syncStore } from '../lib/store';
import { addMonths } from '../lib/horizon';

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

const CATEGORIES = ['Elektronik', 'Perkakas Rumah', 'Kenderaan', 'Perabot', 'Peralatan', 'Lain-lain'];
const WARRANTY_DURATIONS = [
  { label: '3 Bulan', value: 3 },
  { label: '6 Bulan', value: 6 },
  { label: '1 Tahun', value: 12 },
  { label: '2 Tahun', value: 24 },
  { label: '3 Tahun', value: 36 },
  { label: '5 Tahun', value: 60 },
  { label: '10 Tahun', value: 120 },
  { label: 'Tarikh Sendiri', value: 0 },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Elektronik: Laptop,
  'Perkakas Rumah': Zap,
  Kenderaan: Car,
  Perabot: Sofa,
  Peralatan: Wrench,
  'Lain-lain': Package,
};

const getCategoryIcon = (category: string): React.ElementType => CATEGORY_ICONS[category] || Package;

// Every icon tile used to be the same orange, so a list of 20 assets read as one texture.
// A tint per category makes the list scannable by colour before a single word is read.
const CATEGORY_TONE: Record<string, string> = {
  Elektronik: 'bg-sky-500/15 text-sky-500 light:text-sky-700',
  'Perkakas Rumah': 'bg-amber-500/15 text-amber-500 light:text-amber-700',
  Kenderaan: 'bg-violet-500/15 text-violet-500 light:text-violet-700',
  Perabot: 'bg-teal-500/15 text-teal-500 light:text-teal-700',
  Peralatan: 'bg-blue-500/15 text-blue-500 light:text-blue-700',
  'Lain-lain': 'bg-slate-500/15 text-slate-400 light:text-slate-600',
};
const getCategoryTone = (c: string) => CATEGORY_TONE[c] || CATEGORY_TONE['Lain-lain'];

// One source of truth for the three warranty states — card rail, bar, number and chips all read it.
const STATUS_TONE = {
  active: { text: 'text-emerald-500 light:text-emerald-700', bar: 'bg-emerald-500', soft: 'bg-emerald-500/15 text-emerald-500 light:text-emerald-700', unit: 'hari lagi' },
  'expiring-soon': { text: 'text-orange-500 light:text-orange-700', bar: 'bg-orange-500', soft: 'bg-orange-500/15 text-orange-500 light:text-orange-700', unit: 'hari lagi' },
  expired: { text: 'text-rose-500 light:text-rose-700', bar: 'bg-rose-500', soft: 'bg-rose-500/15 text-rose-500 light:text-rose-700', unit: 'hari lewat' },
} as const;

const NUM = { fontVariantNumeric: 'tabular-nums' } as const;

export default function AssetWarrantyTracker() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assets' | 'expired'>('dashboard');
  const [items, setItems] = useState<AssetItem[]>(() => {
    const saved = syncStore.getItem('asset_warranty_tracker_data');
    return saved ? JSON.parse(saved) : [];
  });

  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = syncStore.getItem('asset_warranty_custom_categories');
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
  // Only the "Custom Date" option owns a date of its own; every preset term is derived below.
  const [customExpiry, setCustomExpiry] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [store, setStore] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    syncStore.setItem('asset_warranty_tracker_data', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    syncStore.setItem('asset_warranty_custom_categories', JSON.stringify(customCategories));
  }, [customCategories]);

  // One-shot: receipts saved before downscaling existed are multi-MB and can push the whole
  // key past the localStorage quota. Runs once per device, then never again.
  useEffect(() => {
    if (localStorage.getItem('sk_img_v2_assets')) return;
    shrinkExisting(items, 'receiptPhoto', 900).then(({ items: next, changed }) => {
      if (changed) setItems(next);
      localStorage.setItem('sk_img_v2_assets', '1');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived during render, never stored. Keeping this in state and syncing it from an effect meant
  // resetForm() could blank it without changing [purchaseDate, warrantyDuration] — so the effect
  // never re-fired, the disabled field stayed empty (skipping `required`), and every save after the
  // first hit the guard in handleSave and silently did nothing.
  const expiryDate = warrantyDuration > 0
    ? (purchaseDate ? addMonths(purchaseDate, warrantyDuration) : '')
    : customExpiry;

  const resetForm = () => {
    setName('');
    setCategory(CATEGORIES[0]);
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPurchasePrice('');
    setWarrantyDuration(12);
    setCustomExpiry('');
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
    setCustomExpiry(item.expiryDate);
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
    if (window.confirm('Anda pasti mahu padam aset ini?')) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 900px: a receipt has to stay legible for a warranty claim.
      downscaleFile(file, 900).then(setReceiptPhoto).catch(() => {});
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

  const formatRM = (val: number) => `RM${val.toLocaleString('ms-MY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ms-MY', {
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
    { key: 'dashboard', label: 'Papan Pemuka', Icon: LayoutDashboard, count: undefined },
    { key: 'assets', label: 'Aset', Icon: List, count: activeItems.length },
    { key: 'expired', label: 'Tamat', Icon: Clock, count: expiredItems.length },
  ] as const;

  // Reusable asset row used in Assets / Expired tabs.
  // Days-left is the only reason anyone opens this list, so it gets the display face and the size —
  // everything else is support text sized to be skipped.
  const AssetCard = ({ item }: { item: AssetItem }) => {
    const Icon = getCategoryIcon(item.category);
    const status = getWarrantyStatus(item.expiryDate);
    const tone = STATUS_TONE[status];
    const days = getDaysLeft(item.expiryDate);
    const progress = getWarrantyProgress(item);

    return (
      <div className="glass-panel overflow-hidden p-4 transition-colors hover:border-text/25">
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${getCategoryTone(item.category)}`}>
            <Icon size={22} />
          </div>

          {/* Tap-anywhere to edit, as before; keyboard users get the labelled Pencil button below. */}
          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleEdit(item)}>
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-muted truncate">{item.category}</span>
            <h3 className="font-bold text-text truncate leading-tight">{item.name}</h3>
            <p className="text-xs text-muted truncate mt-0.5" style={NUM}>
              {formatRM(item.purchasePrice)}{item.store ? ` · ${item.store}` : ''}
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className={`font-display text-4xl font-extrabold leading-none ${tone.text}`} style={NUM}>
              {Math.abs(days)}
            </span>
            <span className={`block text-[10px] font-bold uppercase tracking-[0.16em] mt-1.5 ${tone.text}`}>
              {days === 0 ? 'tamat hari ni' : tone.unit}
            </span>
          </div>
        </div>

        {/* Warranty timeline */}
        <div className="mt-3 pt-3 border-t border-text/5 flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <div className="h-1.5 w-full bg-text/10 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${tone.bar} transition-[width] duration-700`} style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[11px] text-muted mt-1.5 truncate" style={NUM}>
              {formatDate(item.purchaseDate)} <span className="text-text/30">→</span>{' '}
              <span className={`font-semibold ${tone.text}`}>{formatDate(item.expiryDate)}</span>
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleEdit(item)}
              aria-label={`Sunting ${item.name}`}
              className="p-2 text-muted hover:text-orange-500 bg-text/5 hover:bg-orange-500/10 rounded-lg transition-colors"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => handleDelete(item.id)}
              aria-label={`Padam ${item.name}`}
              className="p-2 text-muted hover:text-rose-500 bg-text/5 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Divides a long list into scannable buckets instead of one uniform wall of cards.
  const SectionHeader = ({ label, count, tone }: { label: string; count: number; tone: string }) => (
    <div className="flex items-center gap-2.5 pt-1">
      <span className={`text-[11px] font-bold uppercase tracking-[0.18em] ${tone}`}>{label}</span>
      <span className="text-[11px] font-bold text-muted" style={NUM}>{count}</span>
      <div className="h-px flex-1 bg-text/10" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/15 text-orange-500 rounded-xl">
            <Box size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-extrabold text-text leading-tight tracking-tight">Asset & Warranty</h1>
            <p className={`text-sm ${expiringSoonItems.length ? 'font-semibold text-orange-500 light:text-orange-700' : 'text-muted'}`}>
              {expiringSoonItems.length
                ? `${expiringSoonItems.length} waranti hampir tamat`
                : 'Rekod barang berharga & waranti'}
            </p>
          </div>
        </div>
      </div>

      {!isAdding && (
        <div className="grid grid-cols-3 gap-1 p-1 bg-text/5 rounded-xl">
          {TABS.map(({ key, label, Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`py-2.5 rounded-lg transition-colors flex flex-col items-center gap-1 ${
                activeTab === key ? 'bg-surface text-orange-500 light:text-orange-700 shadow-sm' : 'text-muted hover:text-text'
              }`}
            >
              <Icon size={16} />
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em]">
                {label}
                {typeof count === 'number' && count > 0 && (
                  <span className="px-1.5 rounded-full bg-text/10 text-text/70 text-[10px]" style={NUM}>{count}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full py-4 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-orange-500/50 hover:text-orange-500 light:hover:text-orange-700 transition-all flex items-center justify-center"
        >
          <Plus size={20} className="mr-2" /> Tambah Aset
        </button>
      )}

      {isAdding ? (
        <div className="glass-panel p-5 animate-slide-up relative">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-text">
              <Plus className="text-orange-500" />
              {editingItem ? 'Sunting Aset' : 'Tambah Aset Baru'}
            </h2>
            <button
              onClick={resetForm}
              aria-label="Tutup borang"
              className="p-2 bg-text/5 hover:bg-text/10 text-muted rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Nama Item *</label>
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
                  placeholder="cth. MacBook Pro, Air Fryer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider">Kategori</label>
                  {customCategories.includes(category) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Padam kategori sendiri "${category}"?`)) {
                          setCustomCategories(customCategories.filter(c => c !== category));
                          setCategory(CATEGORIES[0]);
                        }
                      }}
                      className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider"
                    >
                      Padam
                    </button>
                  )}
                </div>
                {category === 'Tambah Sendiri...' ? (
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Taip nama kategori sendiri..."
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
                    {[...CATEGORIES, ...customCategories, 'Tambah Sendiri...'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Harga (RM) *</label>
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
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Tarikh Beli *</label>
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
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Waranti</label>
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
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Tarikh Tamat *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                  <ShieldAlert size={18} />
                </div>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setCustomExpiry(e.target.value)}
                  disabled={warrantyDuration > 0}
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all disabled:opacity-50 disabled:bg-text/5"
                />
              </div>
              {warrantyDuration > 0 && <p className="text-xs text-muted mt-1 px-1">Dikira automatik dari tarikh beli</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Nombor Siri</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                    <Activity size={18} />
                  </div>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all"
                    placeholder="Pilihan"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Kedai</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                    <Store size={18} />
                  </div>
                  <input
                    type="text"
                    value={store}
                    onChange={(e) => setStore(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all"
                    placeholder="cth. Harvey Norman"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Nota</label>
              <div className="relative">
                <div className="absolute top-3 left-3 flex items-start pointer-events-none text-muted">
                  <FileText size={18} />
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all min-h-[80px]"
                  placeholder="Butiran tambahan..."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Gambar Resit</label>
              {receiptPhoto ? (
                <div className="relative inline-block w-full h-40 rounded-xl overflow-hidden border border-text/10">
                  <img src={receiptPhoto} alt="Resit" className="w-full h-full object-cover" />
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
                  <span className="text-sm font-medium">Tekan untuk muat naik resit</span>
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
              {editingItem ? 'Simpan Perubahan' : 'Tambah Aset'}
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
                  <div className="flex items-center gap-2 text-muted mb-2">
                    <DollarSign size={14} className="text-orange-500" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Jumlah Nilai Portfolio</span>
                  </div>
                  <div className="font-display text-5xl font-extrabold text-text leading-none tracking-tight" style={NUM}>
                    {formatRM(totalAssetsValue)}
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted mt-2.5" style={NUM}>
                    {items.length} item direkod
                  </div>

                  {totalAssetsValue > 0 && (
                    <div className="mt-5">
                      <div className="h-2 w-full rounded-full overflow-hidden flex bg-text/10">
                        <div className="h-full bg-emerald-500 transition-[width] duration-700" style={{ width: `${(underWarrantyValue / totalAssetsValue) * 100}%` }} />
                        <div className="h-full bg-rose-500 transition-[width] duration-700" style={{ width: `${(expiredWarrantyValue / totalAssetsValue) * 100}%` }} />
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-2.5 text-[11px] font-bold" style={NUM}>
                        <span className="flex items-center gap-1.5 text-emerald-500 light:text-emerald-700 truncate">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Dilindungi {formatRM(underWarrantyValue)}
                        </span>
                        <span className="flex items-center gap-1.5 text-rose-500 light:text-rose-700 truncate">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" /> Tamat {formatRM(expiredWarrantyValue)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stat chips — three states at a glance, each a shortcut into its list */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { n: activeItems.length - expiringSoonItems.length, label: 'Selamat', Icon: ShieldCheck, tone: STATUS_TONE.active, tab: 'assets' as const },
                  { n: expiringSoonItems.length, label: 'Hampir tamat', Icon: ShieldAlert, tone: STATUS_TONE['expiring-soon'], tab: 'assets' as const },
                  { n: expiredItems.length, label: 'Tamat', Icon: ShieldX, tone: STATUS_TONE.expired, tab: 'expired' as const },
                ].map(({ n, label, Icon, tone, tab }) => (
                  <button
                    key={label}
                    onClick={() => setActiveTab(tab)}
                    className="glass-panel p-3.5 text-left transition-colors hover:border-text/25"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${tone.soft}`}>
                      <Icon size={18} />
                    </div>
                    <div className={`font-display text-3xl font-extrabold leading-none ${n > 0 ? tone.text : 'text-text/25'}`} style={NUM}>
                      {n}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mt-1.5 truncate">{label}</div>
                  </button>
                ))}
              </div>

              {/* Expiring Soon Section */}
              <div className="glass-panel p-5">
                <div className="flex items-center gap-2 mb-4 text-orange-500 light:text-orange-700">
                  <AlertTriangle size={20} className={expiringSoonItems.length > 0 ? 'animate-pulse' : ''} />
                  <h3 className="font-display font-extrabold text-lg text-text tracking-tight">Hampir Tamat</h3>
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">30 hari</span>
                  {expiringSoonItems.length > 0 && (
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-orange-500/15 text-xs font-bold" style={NUM}>
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
                            <div className="font-bold text-text truncate leading-tight">{item.name}</div>
                            <div className="text-xs text-muted flex items-center gap-1 mt-0.5 truncate">
                              <Store size={12} className="shrink-0" />
                              {item.store || 'Kedai tidak diketahui'}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-display text-2xl font-extrabold leading-none text-orange-500 light:text-orange-700" style={NUM}>
                              {getDaysLeft(item.expiryDate)}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mt-1" style={NUM}>{formatDate(item.expiryDate)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted bg-surface/50 rounded-xl border border-dashed border-text/10">
                    <ShieldCheck size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="font-medium text-sm">Tiada item hampir tamat.</p>
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
                    placeholder="Cari aset..."
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all"
                  />
                </div>
              )}

              {filteredActive.length > 0 ? (
                ([
                  { key: 'expiring-soon', label: 'Perlu perhatian' },
                  { key: 'active', label: 'Selamat' },
                ] as const).map(({ key, label }) => {
                  const group = filteredActive.filter(i => getWarrantyStatus(i.expiryDate) === key);
                  if (group.length === 0) return null;
                  return (
                    <div key={key} className="space-y-3">
                      <SectionHeader label={label} count={group.length} tone={STATUS_TONE[key].text} />
                      {group.map(item => <AssetCard key={item.id} item={item} />)}
                    </div>
                  );
                })
              ) : activeItems.length > 0 ? (
                <div className="glass-panel p-8 text-center text-muted">
                  <Search size={28} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">Tiada aset sepadan “{search}”.</p>
                </div>
              ) : (
                <div className="glass-panel p-10 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500 mb-4">
                    <Box size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-text mb-2">Tiada aset aktif</h3>
                  <p className="text-sm text-muted max-w-xs mx-auto">Rekod barang berharga anda dan tempoh warantinya.</p>
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
                    placeholder="Cari yang tamat..."
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-text/10 rounded-xl text-text focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all"
                  />
                </div>
              )}

              {filteredExpired.length > 0 ? (
                filteredExpired.map(item => <AssetCard key={item.id} item={item} />)
              ) : expiredItems.length > 0 ? (
                <div className="glass-panel p-8 text-center text-muted">
                  <Search size={28} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">Tiada item tamat sepadan “{search}”.</p>
                </div>
              ) : (
                <div className="glass-panel p-10 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-4">
                    <ShieldCheck size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-text mb-2">Tiada waranti tamat</h3>
                  <p className="text-sm text-muted">Semua aset anda masih dalam tempoh waranti.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
