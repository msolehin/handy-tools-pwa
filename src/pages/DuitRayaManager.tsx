import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Users, Coins, Check, ChevronDown, ChevronRight, Wallet } from 'lucide-react';

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
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DuitRayaManager: React.FC = () => {
  const [theme, setTheme] = useState<ThemeKey>('raya');
  const [budget, setBudget] = useState<number>(0);
  const [families, setFamilies] = useState<Family[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [newFamilyName, setNewFamilyName] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Per-family draft for adding a recipient
  const [activeFamily, setActiveFamily] = useState<string | null>(null);
  const [recipName, setRecipName] = useState('');
  const [recipAmount, setRecipAmount] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: SavedState = JSON.parse(saved);
        if (parsed.theme) setTheme(parsed.theme);
        if (typeof parsed.budget === 'number') setBudget(parsed.budget);
        if (Array.isArray(parsed.families)) setFamilies(parsed.families);
      } catch (e) {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      const data: SavedState = { theme, budget, families };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [theme, budget, families, isLoaded]);

  const t = THEMES[theme];

  // --- Derived totals ---
  const allRecipients = families.flatMap(f => f.recipients);
  const allocated = allRecipients.reduce((acc, r) => acc + (r.amount || 0), 0);
  const given = allRecipients.filter(r => r.given).reduce((acc, r) => acc + (r.amount || 0), 0);
  const remaining = budget - given;
  const percentUsed = budget > 0 ? (given / budget) * 100 : 0;
  const overBudget = allocated > budget && budget > 0;

  // --- Cash preparation: denominations needed for envelopes not yet given ---
  const pending = allRecipients.filter(r => !r.given && r.amount > 0);
  const cashNeed: Record<number, number> = {};
  let cashTotalSen = 0;
  pending.forEach(r => {
    let sen = Math.round(r.amount * 100);
    cashTotalSen += sen;
    for (const d of DENOMS) {
      if (sen <= 0) break;
      const count = Math.floor(sen / d.sen);
      if (count > 0) {
        cashNeed[d.sen] = (cashNeed[d.sen] || 0) + count;
        sen -= count * d.sen;
      }
    }
  });
  const cashRows = DENOMS.filter(d => cashNeed[d.sen] > 0);

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
      if (!window.confirm(`Delete "${fam.name}" and its ${fam.recipients.length} recipient(s)?`)) return;
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

  return (
    <div className={`max-w-md mx-auto p-4 pb-24 space-y-6 animate-fade-in`}>
      {/* Header */}
      <div className={`glass-panel p-4 bg-gradient-to-br ${t.headerBg} border-white/10`}>
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-xl ${t.iconWrap} text-2xl leading-none`}>{t.emoji}</div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text/90">{t.label} Manager</h1>
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

      {/* Budget & progress */}
      <div className="glass-panel p-5 space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Wallet size={14} /> Budget (RM)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={budget === 0 ? '' : budget}
            onChange={e => setBudget(parseFloat(e.target.value) || 0)}
            placeholder="e.g. 1000"
            className="input-field w-full font-mono text-lg"
          />
        </div>

        <div className="space-y-2 font-mono text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Budget</span>
            <span className="text-text/90 font-bold">RM{fmt(budget)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Given</span>
            <span className={`font-bold ${t.accentText}`}>RM{fmt(given)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Remaining</span>
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
          <p className="text-right text-xs font-bold text-muted">{percentUsed.toFixed(0)}% Used</p>
        </div>

        {overBudget && (
          <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
            ⚠️ Allocated RM{fmt(allocated)} exceeds your budget by RM{fmt(allocated - budget)}.
          </p>
        )}
      </div>

      {/* Cash preparation */}
      <div className="glass-panel p-5 space-y-3">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Coins size={18} className={t.accentText} /> Cash Preparation
        </h3>
        {cashRows.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">
            {allRecipients.length === 0
              ? 'Add recipients to see how much cash to prepare.'
              : 'All envelopes given — nothing left to prepare 🎉'}
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted uppercase tracking-wider">Need (for pending envelopes)</p>
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
              <span>Total</span>
              <span className={t.accentText}>RM{fmt(cashTotalSen / 100)}</span>
            </div>
          </>
        )}
      </div>

      {/* Families */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Users size={18} className={t.accentText} /> Families
          </h3>
          <span className="text-xs text-muted">{allRecipients.length} recipient(s)</span>
        </div>

        {families.map(family => {
          const famTotal = family.recipients.reduce((acc, r) => acc + r.amount, 0);
          const famGiven = family.recipients.filter(r => r.given).length;
          const isCollapsed = collapsed[family.id];
          return (
            <div key={family.id} className={`glass-panel border ${t.packetBorder} overflow-hidden`}>
              {/* Family header */}
              <div className={`flex items-center justify-between p-4 ${t.packetBg}`}>
                <button onClick={() => toggleCollapse(family.id)} className="flex items-center gap-2 flex-1 text-left">
                  {isCollapsed ? <ChevronRight size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
                  <div>
                    <h4 className="font-bold text-text/90">{family.name}</h4>
                    <p className="text-[11px] text-muted">{famGiven}/{family.recipients.length} given · RM{fmt(famTotal)}</p>
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
                        title={r.given ? 'Marked as given' : 'Mark as given'}
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
                          placeholder="Name"
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
                        <button onClick={() => setActiveFamily(null)} className="flex-1 py-2 rounded-lg bg-text/5 text-text text-sm font-bold hover:bg-text/10">Done</button>
                        <button onClick={() => addRecipient(family.id)} className={`flex-1 py-2 rounded-lg text-white text-sm font-bold ${t.solidBtn}`}>Add</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => openAddRecipient(family.id)}
                      className={`w-full py-2.5 rounded-xl border border-dashed border-text/20 text-muted text-sm font-bold ${t.addHover} transition-all flex items-center justify-center`}
                    >
                      <Plus size={16} className="mr-1.5" /> Add Name
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add family */}
        <form onSubmit={addFamily} className="flex gap-2">
          <input
            type="text"
            value={newFamilyName}
            onChange={e => setNewFamilyName(e.target.value)}
            placeholder="New family / group name"
            className="input-field flex-1"
          />
          <button type="submit" className={`px-4 rounded-xl text-white font-bold ${t.solidBtn} flex items-center`}>
            <Plus size={18} className="mr-1" /> Family
          </button>
        </form>

        {families.length === 0 && (
          <div className="text-center p-8 text-muted text-sm border border-dashed border-text/10 rounded-2xl">
            Set your budget, then add a family to start planning your {t.label.toLowerCase()}.
          </div>
        )}
      </div>
    </div>
  );
};

export default DuitRayaManager;
