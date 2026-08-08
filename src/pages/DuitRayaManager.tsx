import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Users, Coins, Check, ChevronDown, ChevronRight, Wallet, Trophy, Wallet2, Search, X, RotateCcw } from 'lucide-react';
import { store } from '../lib/store';

interface Recipient {
  id: string;
  name: string;
  amount: number;
  given: boolean;
}

interface Family {
  id: string;
  name: string;
  recipients: Recipient[];
}

type ThemeKey = 'raya' | 'angpao';

interface SavedState {
  theme: ThemeKey;
  budget: number;
  families: Family[];
  disabledDenoms?: number[];
}

const STORAGE_KEY = 'duit_raya_manager_data';

const THEMES: Record<ThemeKey, {
  label: string;
  emoji: string;
  greeting: string;
  pageBg: string;
  headerBg: string;
  iconWrap: string;
  iconText: string;
  accentText: string;
  accentBg: string;
  accentBorder: string;
  solidBtn: string;
  bar: string;
  packetBg: string;
  packetBorder: string;
  addHover: string;
}> = {
  raya: {
    label: 'Duit Raya',
    emoji: '🌙',
    greeting: 'Selamat Hari Raya',
    pageBg: 'from-emerald-500/10',
    headerBg: 'from-emerald-500/20 to-green-600/5',
    iconWrap: 'bg-emerald-500/20',
    iconText: 'dr-accent',
    accentText: 'dr-accent',
    accentBg: 'bg-emerald-500/15',
    accentBorder: 'border-emerald-500/30',
    solidBtn: 'bg-emerald-500 hover:bg-emerald-600',
    bar: 'from-emerald-400 to-green-500',
    packetBg: 'bg-emerald-500/5',
    packetBorder: 'border-emerald-500/20',
    addHover: 'hover:text-emerald-400 hover:border-emerald-400/50',
  },
  angpao: {
    label: 'Angpao',
    emoji: '🧧',
    greeting: 'Gong Xi Fa Cai',
    pageBg: 'from-red-500/10',
    headerBg: 'from-red-500/20 to-rose-600/5',
    iconWrap: 'bg-red-500/20',
    iconText: 'ap-accent',
    accentText: 'ap-accent',
    accentBg: 'bg-red-500/15',
    accentBorder: 'border-red-500/30',
    solidBtn: 'bg-red-500 hover:bg-red-600',
    bar: 'from-red-400 to-rose-500',
    packetBg: 'bg-red-500/5',
    packetBorder: 'border-red-500/20',
    addHover: 'hover:text-red-400 hover:border-red-400/50',
  },
};

// Malaysian currency denominations (in sen) — notes + common coins
const DENOMS: { sen: number; label: string }[] = [
  { sen: 10000, label: 'RM100' },
  { sen: 5000, label: 'RM50' },
  { sen: 2000, label: 'RM20' },
  { sen: 1000, label: 'RM10' },
  { sen: 500, label: 'RM5' },
  { sen: 100, label: 'RM1' },
  { sen: 50, label: '50 sen' },
  { sen: 20, label: '20 sen' },
  { sen: 10, label: '10 sen' },
  { sen: 5, label: '5 sen' },
];

const generateId = () => Math.random().toString(36).substring(2, 9);
const fmt = (n: number) => n.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DuitRayaManager: React.FC = () => {
  const [theme, setTheme] = useState<ThemeKey>('raya');
  const [budget, setBudget] = useState<number>(0);
  const [families, setFamilies] = useState<Family[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [tab, setTab] = useState<'plan' | 'board'>('plan');
  const [boardTab, setBoardTab] = useState<'names' | 'families'>('names');
  const [planSearch, setPlanSearch] = useState('');
  const [disabledDenoms, setDisabledDenoms] = useState<number[]>([]); // denominations the user excluded (RM1 can't be excluded)
  const [newFamilyName, setNewFamilyName] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Per-family draft for adding a recipient
  const [activeFamily, setActiveFamily] = useState<string | null>(null);
  const [recipName, setRecipName] = useState('');
  const [recipAmount, setRecipAmount] = useState('');

  useEffect(() => {
    const saved = store.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: SavedState = JSON.parse(saved);
        if (parsed.theme) setTheme(parsed.theme);
        if (typeof parsed.budget === 'number') setBudget(parsed.budget);
        if (Array.isArray(parsed.families)) setFamilies(parsed.families);
        if (Array.isArray(parsed.disabledDenoms)) setDisabledDenoms(parsed.disabledDenoms.filter(s => s !== 100));
      } catch (e) {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      const data: SavedState = { theme, budget, families, disabledDenoms };
      store.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [theme, budget, families, disabledDenoms, isLoaded]);

  // Notify the rest of the app (nav / menus) when the theme changes so labels update live
  useEffect(() => {
    if (isLoaded) window.dispatchEvent(new Event('duitraya-theme'));
  }, [theme, isLoaded]);

  const t = THEMES[theme];

  // --- Derived totals ---
  const allRecipients = families.flatMap(f => f.recipients);
  const allocated = allRecipients.reduce((acc, r) => acc + (r.amount || 0), 0);
  const given = allRecipients.filter(r => r.given).reduce((acc, r) => acc + (r.amount || 0), 0);
  const remaining = budget - given;
  const unallocated = budget - allocated; // budget still free to assign to more people
  const percentUsed = budget > 0 ? (given / budget) * 100 : 0;
  const overBudget = allocated > budget && budget > 0;

  // --- Cash preparation: denominations needed for envelopes not yet given ---
  // RM1 (100 sen) is mandatory and can never be excluded.
  const denomEnabled = (sen: number) => sen === 100 || !disabledDenoms.includes(sen);
  const activeDenoms = DENOMS.filter(d => denomEnabled(d.sen));
  const toggleDenom = (sen: number) => {
    if (sen === 100) return; // RM1 stays on
    setDisabledDenoms(prev => prev.includes(sen) ? prev.filter(s => s !== sen) : [...prev, sen]);
  };

  const pending = allRecipients.filter(r => !r.given && r.amount > 0);
  const cashNeed: Record<number, number> = {};
  let cashTotalSen = 0;
  let cashLeftoverSen = 0; // amount that couldn't be made with the enabled denominations
  pending.forEach(r => {
    let sen = Math.round(r.amount * 100);
    cashTotalSen += sen;
    for (const d of activeDenoms) {
      if (sen <= 0) break;
      const count = Math.floor(sen / d.sen);
      if (count > 0) {
        cashNeed[d.sen] = (cashNeed[d.sen] || 0) + count;
        sen -= count * d.sen;
      }
    }
    cashLeftoverSen += sen;
  });
  const cashRows = DENOMS.filter(d => cashNeed[d.sen] > 0);

  // --- Leaderboards (ties broken alphabetically) ---
  const nameBoard = families
    .flatMap(f => f.recipients.map(r => ({ ...r, familyName: f.name })))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  const familyBoard = families
    .map(f => ({
      id: f.id,
      name: f.name,
      total: f.recipients.reduce((s, r) => s + r.amount, 0),
      count: f.recipients.length,
      allGiven: f.recipients.length > 0 && f.recipients.every(r => r.given),
    }))
    .filter(f => f.count > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const maxName = nameBoard[0]?.amount || 0;
  const maxFam = familyBoard[0]?.total || 0;
  const rankLabel = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`);

  // --- Plan search: filter families + recipients by name ---
  const planQuery = planSearch.trim().toLowerCase();
  const visibleFamilies: Family[] = !planQuery
    ? families
    : families
        .map(f => {
          const famMatch = f.name.toLowerCase().includes(planQuery);
          const recs = famMatch ? f.recipients : f.recipients.filter(r => r.name.toLowerCase().includes(planQuery));
          return famMatch || recs.length > 0 ? { ...f, recipients: recs } : null;
        })
        .filter((f): f is Family => f !== null);

  // --- Mutations ---
  const addFamily = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyName.trim()) return;
    setFamilies(prev => [...prev, { id: generateId(), name: newFamilyName.trim(), recipients: [] }]);
    setNewFamilyName('');
  };

  const deleteFamily = (id: string) => {
    const fam = families.find(f => f.id === id);
    if (fam && fam.recipients.length > 0) {
      if (!window.confirm(`Padam "${fam.name}" dan ${fam.recipients.length} penerimanya?`)) return;
    }
    setFamilies(prev => prev.filter(f => f.id !== id));
  };

  const openAddRecipient = (familyId: string) => {
    setActiveFamily(familyId);
    setRecipName('');
    setRecipAmount('');
  };

  const addRecipient = (familyId: string) => {
    const amount = parseFloat(recipAmount);
    if (!recipName.trim() || isNaN(amount) || amount <= 0) return;
    setFamilies(prev => prev.map(f => f.id === familyId
      ? { ...f, recipients: [...f.recipients, { id: generateId(), name: recipName.trim(), amount, given: false }] }
      : f
    ));
    setRecipName('');
    setRecipAmount('');
  };

  const toggleGiven = (familyId: string, recipId: string) => {
    setFamilies(prev => prev.map(f => f.id === familyId
      ? { ...f, recipients: f.recipients.map(r => r.id === recipId ? { ...r, given: !r.given } : r) }
      : f
    ));
  };

  const deleteRecipient = (familyId: string, recipId: string) => {
    setFamilies(prev => prev.map(f => f.id === familyId
      ? { ...f, recipients: f.recipients.filter(r => r.id !== recipId) }
      : f
    ));
  };

  const toggleCollapse = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const resetAll = () => {
    if (!window.confirm('Set semula semua? Ini akan kosongkan bajet dan semua keluarga/penerima. Tindakan ini tidak boleh dibatalkan.')) return;
    setBudget(0);
    setFamilies([]);
    setPlanSearch('');
    setActiveFamily(null);
    setCollapsed({});
  };

  return (
    <div className={`max-w-md mx-auto p-4 pb-24 space-y-6 animate-fade-in`}>
      {/* Header */}
      <div className={`glass-panel p-4 bg-gradient-to-br ${t.headerBg} border-white/10`}>
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-xl ${t.iconWrap} text-2xl leading-none`}>{t.emoji}</div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text/90">Kira {t.label}</h1>
            <p className="text-[10px] text-muted uppercase tracking-wider">{t.greeting}</p>
          </div>
        </div>

        {/* Theme switch */}
        <div className="flex p-1 bg-black/10 rounded-xl mt-4">
          <button
            onClick={() => setTheme('raya')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${theme === 'raya' ? 'bg-emerald-500/20 dr-accent border border-emerald-500/30' : 'text-muted'}`}
          >
            🌙 Duit Raya
          </button>
          <button
            onClick={() => setTheme('angpao')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${theme === 'angpao' ? 'bg-red-500/20 ap-accent border border-red-500/30' : 'text-muted'}`}
          >
            🧧 Angpao
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-text/5 rounded-xl">
        <button
          onClick={() => setTab('plan')}
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${tab === 'plan' ? `bg-surface ${t.accentText} shadow-sm` : 'text-muted hover:text-text'}`}
        >
          <Wallet2 size={16} /> Rancang
        </button>
        <button
          onClick={() => setTab('board')}
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${tab === 'board' ? `bg-surface ${t.accentText} shadow-sm` : 'text-muted hover:text-text'}`}
        >
          <Trophy size={16} /> Ranking
        </button>
      </div>

      {tab === 'plan' && (<>
      {/* Budget & progress */}
      <div className="glass-panel p-5 space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Wallet size={14} /> Bajet (RM)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={budget === 0 ? '' : budget}
            onChange={e => setBudget(parseFloat(e.target.value) || 0)}
            placeholder="cth. 1000"
            className="input-field w-full font-mono text-lg"
          />
        </div>

        <div className="space-y-2 font-mono text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Bajet</span>
            <span className="text-text/90 font-bold">RM{fmt(budget)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Diagih kepada nama</span>
            <span className="text-text/90 font-bold">RM{fmt(allocated)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Baki untuk diagih</span>
            <span className={`font-bold ${unallocated < 0 ? 'text-red-400' : t.accentText}`}>RM{fmt(unallocated)}</span>
          </div>
          <div className="h-px bg-white/10 my-1" />
          <div className="flex justify-between">
            <span className="text-muted">Dah beri</span>
            <span className={`font-bold ${t.accentText}`}>RM{fmt(given)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Baki</span>
            <span className={`font-bold ${remaining < 0 ? 'text-red-400' : 'text-text/90'}`}>RM{fmt(remaining)}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-3 w-full bg-black/30 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${percentUsed > 100 ? 'from-red-400 to-rose-500' : t.bar} transition-all duration-500`}
              style={{ width: `${Math.min(100, percentUsed)}%` }}
            />
          </div>
          <p className="text-right text-xs font-bold text-muted">{percentUsed.toFixed(0)}% Digunakan</p>
        </div>

        {overBudget && (
          <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
            ⚠️ Agihan RM{fmt(allocated)} melebihi bajet anda sebanyak RM{fmt(allocated - budget)}.
          </p>
        )}
      </div>

      {/* Cash preparation */}
      <div className="glass-panel p-5 space-y-3">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Coins size={18} className={t.accentText} /> Sediakan Duit Tunai
        </h3>

        {/* Denomination toggles — tap to exclude notes you don't want (RM1 is locked) */}
        <div>
          <p className="text-[11px] text-muted uppercase tracking-wider mb-2">Guna not/duit ini</p>
          <div className="flex flex-wrap gap-1.5">
            {DENOMS.map(d => {
              const on = denomEnabled(d.sen);
              const locked = d.sen === 100;
              return (
                <button
                  key={d.sen}
                  onClick={() => toggleDenom(d.sen)}
                  disabled={locked}
                  title={locked ? 'RM1 wajib dan tidak boleh dimatikan' : on ? 'Tekan untuk keluarkan' : 'Tekan untuk masukkan'}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                    on
                      ? `${t.accentBg} ${t.accentBorder} ${t.accentText}`
                      : 'border-text/10 text-muted/60 line-through'
                  } ${locked ? 'cursor-default opacity-100' : 'hover:opacity-80'}`}
                >
                  {d.label}{locked ? ' 🔒' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {cashRows.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">
            {allRecipients.length === 0
              ? 'Tambah penerima untuk lihat berapa tunai perlu disediakan.'
              : 'Semua sampul dah diberi — tiada apa perlu disediakan 🎉'}
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted uppercase tracking-wider">Perlu (untuk sampul belum diberi)</p>
            <div className="space-y-1.5 font-mono text-sm">
              {cashRows.map(d => (
                <div key={d.sen} className="flex items-center justify-between">
                  <span className="text-text/80">
                    <span className={`font-bold ${t.accentText}`}>{cashNeed[d.sen]}</span>
                    <span className="text-muted mx-1.5">×</span>
                    {d.label}
                  </span>
                  <span className="text-muted">RM{fmt((cashNeed[d.sen] * d.sen) / 100)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 pt-2 flex justify-between font-mono text-sm font-bold">
              <span>Jumlah</span>
              <span className={t.accentText}>RM{fmt(cashTotalSen / 100)}</span>
            </div>
            {cashLeftoverSen > 0 && (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                ⚠️ RM{fmt(cashLeftoverSen / 100)} tidak boleh dibuat dengan not yang dipilih. Hidupkan nilai lebih kecil untuk menampungnya.
              </p>
            )}
          </>
        )}
      </div>

      {/* Families */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Users size={18} className={t.accentText} /> Keluarga
          </h3>
          <span className="text-xs text-muted">{allRecipients.length} penerima</span>
        </div>

        {/* Search */}
        {families.length > 0 && (
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              value={planSearch}
              onChange={e => setPlanSearch(e.target.value)}
              placeholder="Cari nama atau keluarga…"
              className="input-field w-full pl-9 pr-9 text-sm"
            />
            {planSearch && (
              <button
                onClick={() => setPlanSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-text rounded-md hover:bg-text/10"
                title="Kosongkan carian"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}

        {visibleFamilies.map(family => {
          const famTotal = family.recipients.reduce((acc, r) => acc + r.amount, 0);
          const famGiven = family.recipients.filter(r => r.given).length;
          const isCollapsed = collapsed[family.id] && !planQuery;
          return (
            <div key={family.id} className={`glass-panel border ${t.packetBorder} overflow-hidden`}>
              {/* Family header */}
              <div className={`flex items-center justify-between p-4 ${t.packetBg}`}>
                <button onClick={() => toggleCollapse(family.id)} className="flex items-center gap-2 flex-1 text-left">
                  {isCollapsed ? <ChevronRight size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
                  <div>
                    <h4 className="font-bold text-text/90">{family.name}</h4>
                    <p className="text-[11px] text-muted">{famGiven}/{family.recipients.length} dah beri · RM{fmt(famTotal)}</p>
                  </div>
                </button>
                <button onClick={() => deleteFamily(family.id)} className="text-rose-400 opacity-60 hover:opacity-100 p-1.5 hover:bg-rose-500/20 rounded-lg transition-all">
                  <Trash2 size={16} />
                </button>
              </div>

              {!isCollapsed && (
                <div className="p-4 pt-0 space-y-2">
                  {family.recipients.map(r => (
                    <div key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border ${r.given ? 'bg-black/20 border-white/5 opacity-60' : `${t.packetBg} ${t.packetBorder}`}`}>
                      <button
                        onClick={() => toggleGiven(family.id, r.id)}
                        className={`shrink-0 w-6 h-6 rounded-md border flex items-center justify-center transition-all ${r.given ? `${t.solidBtn} border-transparent text-white` : 'border-text/30 text-transparent hover:border-text/60'}`}
                        title={r.given ? 'Ditanda dah beri' : 'Tanda dah beri'}
                      >
                        <Check size={16} />
                      </button>
                      <span className={`flex-1 font-medium ${r.given ? 'line-through text-text/50' : 'text-text/90'}`}>{r.name}</span>
                      <span className={`font-mono font-bold ${r.given ? 'text-text/50' : t.accentText}`}>RM{fmt(r.amount)}</span>
                      <button onClick={() => deleteRecipient(family.id, r.id)} className="text-rose-400 opacity-50 hover:opacity-100 p-1 hover:bg-rose-500/20 rounded transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  {/* Add recipient */}
                  {activeFamily === family.id ? (
                    <div className={`p-3 rounded-xl border border-dashed ${t.accentBorder} space-y-2`}>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={recipName}
                          onChange={e => setRecipName(e.target.value)}
                          placeholder="Nama"
                          autoFocus
                          className="input-field flex-1 py-2 text-sm"
                          onKeyDown={e => { if (e.key === 'Enter') addRecipient(family.id); }}
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={recipAmount}
                          onChange={e => setRecipAmount(e.target.value)}
                          placeholder="RM"
                          className="input-field w-24 py-2 text-sm font-mono"
                          onKeyDown={e => { if (e.key === 'Enter') addRecipient(family.id); }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setActiveFamily(null)} className="flex-1 py-2 rounded-lg bg-text/5 text-text text-sm font-bold hover:bg-text/10">Siap</button>
                        <button onClick={() => addRecipient(family.id)} className={`flex-1 py-2 rounded-lg text-white text-sm font-bold ${t.solidBtn}`}>Tambah</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => openAddRecipient(family.id)}
                      className={`w-full py-2.5 rounded-xl border border-dashed border-text/20 text-muted text-sm font-bold ${t.addHover} transition-all flex items-center justify-center`}
                    >
                      <Plus size={16} className="mr-1.5" /> Tambah Nama
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {planQuery && visibleFamilies.length === 0 && families.length > 0 && (
          <div className="text-center p-6 text-muted text-sm border border-dashed border-text/10 rounded-2xl">
            Tiada nama atau keluarga sepadan “{planSearch}”.
          </div>
        )}

        {/* Add family */}
        <form onSubmit={addFamily} className="flex gap-2">
          <input
            type="text"
            value={newFamilyName}
            onChange={e => setNewFamilyName(e.target.value)}
            placeholder="Nama keluarga / kumpulan baru"
            className="input-field flex-1"
          />
          <button type="submit" className={`px-4 rounded-xl text-white font-bold ${t.solidBtn} flex items-center`}>
            <Plus size={18} className="mr-1" /> Keluarga
          </button>
        </form>

        {families.length === 0 && (
          <div className="text-center p-8 text-muted text-sm border border-dashed border-text/10 rounded-2xl">
            Tetapkan bajet anda, kemudian tambah keluarga untuk mula merancang {t.label.toLowerCase()} anda.
          </div>
        )}

        {(budget > 0 || families.length > 0) && (
          <button
            onClick={resetAll}
            className="w-full mt-2 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/10 transition-all flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={16} /> Set Semula Semua
          </button>
        )}
      </div>
      </>)}

      {tab === 'board' && (<>
        {/* Leaderboard sub-tabs */}
        <div className="flex p-1 bg-text/5 rounded-xl">
          <button
            onClick={() => setBoardTab('names')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${boardTab === 'names' ? `bg-surface ${t.accentText} shadow-sm` : 'text-muted hover:text-text'}`}
          >
            <Trophy size={15} /> Penerima
          </button>
          <button
            onClick={() => setBoardTab('families')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${boardTab === 'families' ? `bg-surface ${t.accentText} shadow-sm` : 'text-muted hover:text-text'}`}
          >
            <Users size={15} /> Keluarga
          </button>
        </div>

        {boardTab === 'names' && (
        /* Leaderboard: by name */
        <div className="glass-panel p-5 space-y-3">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Trophy size={18} className={t.accentText} /> Penerima Teratas
          </h3>
          {nameBoard.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">Tambah penerima untuk lihat ranking.</p>
          ) : (
            <div className="space-y-2">
              {nameBoard.map((r, i) => (
                <div key={r.id} className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="w-7 text-center text-sm font-bold text-muted shrink-0">{rankLabel(i)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate flex items-center gap-1.5 ${r.given ? 'text-text/60' : 'text-text/90'}`}>
                        <span className="truncate">{r.name}</span>
                        {r.given && (
                          <span className={`shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full ${t.solidBtn} text-white`} title="Sudah diberi">
                            <Check size={11} strokeWidth={3} />
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted truncate">{r.familyName}</p>
                    </div>
                    <span className={`font-mono font-bold shrink-0 ${t.accentText}`}>RM{fmt(r.amount)}</span>
                  </div>
                  <div className="h-1.5 ml-10 bg-black/20 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${t.bar} rounded-full`} style={{ width: `${maxName > 0 ? (r.amount / maxName) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {boardTab === 'families' && (
        /* Leaderboard: by family */
        <div className="glass-panel p-5 space-y-3">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Users size={18} className={t.accentText} /> Keluarga Teratas
          </h3>
          {familyBoard.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">Tambah keluarga dengan penerima untuk lihat ranking.</p>
          ) : (
            <div className="space-y-2">
              {familyBoard.map((f, i) => (
                <div key={f.id} className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="w-7 text-center text-sm font-bold text-muted shrink-0">{rankLabel(i)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate flex items-center gap-1.5 ${f.allGiven ? 'text-text/60' : 'text-text/90'}`}>
                        <span className="truncate">{f.name}</span>
                        {f.allGiven && (
                          <span className={`shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full ${t.solidBtn} text-white`} title="Semua penerima sudah diberi">
                            <Check size={11} strokeWidth={3} />
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted">{f.count} penerima</p>
                    </div>
                    <span className={`font-mono font-bold shrink-0 ${t.accentText}`}>RM{fmt(f.total)}</span>
                  </div>
                  <div className="h-1.5 ml-10 bg-black/20 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${t.bar} rounded-full`} style={{ width: `${maxFam > 0 ? (f.total / maxFam) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </>)}
    </div>
  );
};

export default DuitRayaManager;
