import React, { useState, useEffect } from 'react';
import { HandCoins, Trash2, Check, Plus, X } from 'lucide-react';
import { store } from '../lib/store';

interface IOU {
  id: string;
  personName: string;
  description: string;
  amount: number;
  type: 'owe_me' | 'i_owe';
  isSettled: boolean;
}

const STORAGE_KEY = 'debt_tracker_ious';

type Filter = 'all' | 'owe_me' | 'i_owe';

const money = (n: number) =>
  `RM${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Each tone names its light-mode partner: emerald-500 is 2.5:1 on white, emerald-700 is 3.2:1 on
// the dark surface, so neither shade works alone in both themes.
const GREEN = 'text-emerald-500 light:text-emerald-700';
const RED = 'text-rose-500 light:text-rose-700';

const TAB_LABELS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'owe_me', label: 'Orang hutang you' },
  { key: 'i_owe', label: 'You hutang orang' },
];

/**
 * One debt, read as a ledger line: name, dotted leader, amount. That is how a kedai runcit credit
 * book is written, and the leader is what makes the amounts scan as a column.
 *
 * Hoisted out of the page component on purpose — declared inline it would be a new component type
 * every render, so React would tear down and rebuild every row on each keystroke.
 */
const Row: React.FC<{
  iou: IOU;
  onToggle: (id: string) => void;
  onDelete: (iou: IOU) => void;
}> = ({ iou, onToggle, onDelete }) => {
  const settled = iou.isSettled;
  const incoming = iou.type === 'owe_me';
  const initial = iou.personName.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className={`glass-panel px-3 py-3 transition-all ${settled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        {/* The person's disc is also the settle control — one target instead of a checkbox
            beside an avatar, and the check reads as "paid" on the person rather than on a box. */}
        <button
          onClick={() => onToggle(iou.id)}
          aria-pressed={settled}
          aria-label={settled ? `Mark ${iou.personName} unsettled` : `Mark ${iou.personName} settled`}
          title={settled ? 'Tap: belum settle' : 'Tap: dah settle'}
          className={`w-9 h-9 shrink-0 rounded-full border flex items-center justify-center font-display text-sm font-extrabold transition-all hover:ring-2 hover:ring-indigo-500/40 ${
            settled
              ? 'bg-indigo-500 border-indigo-500 text-[#fff]'
              : incoming
                ? `bg-emerald-500/15 border-emerald-500/40 ${GREEN}`
                : `bg-rose-500/15 border-rose-500/40 ${RED}`
          }`}
        >
          {settled ? <Check size={16} strokeWidth={3} /> : initial}
        </button>

        <span className={`min-w-0 truncate font-semibold ${settled ? 'line-through text-text/50' : 'text-text'}`}>
          {iou.personName}
        </span>
        <span className="flex-1 border-b border-dotted border-text/25 min-w-[1rem]" aria-hidden="true" />
        <span
          className={`shrink-0 font-display text-base font-extrabold ${settled ? 'text-text/50' : incoming ? GREEN : RED}`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {incoming ? '+' : '−'}{money(iou.amount)}
        </span>
        <button
          onClick={() => onDelete(iou)}
          aria-label={`Delete note for ${iou.personName}`}
          className="shrink-0 p-1.5 -mr-1 rounded-lg text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {iou.description && (
        <p className="text-xs text-muted mt-1 pl-12 truncate">{iou.description}</p>
      )}
    </div>
  );
};

const DebtTracker: React.FC = () => {
  const [ious, setIous] = useState<IOU[]>([]);
  const [isAddingIou, setIsAddingIou] = useState(false);
  const [iouName, setIouName] = useState('');
  const [iouDesc, setIouDesc] = useState('');
  const [iouAmount, setIouAmount] = useState('');
  const [iouType, setIouType] = useState<'owe_me' | 'i_owe'>('owe_me');
  const [isLoaded, setIsLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const saved = store.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setIous(JSON.parse(saved));
      } catch { /* unreadable blob — start empty rather than crash the page */ }
    } else {
      // Migrate from old debt_tracker_data if available
      const oldSaved = localStorage.getItem('debt_tracker_data');
      if (oldSaved) {
        try {
          const parsed = JSON.parse(oldSaved);
          if (parsed.ious) setIous(parsed.ious);
        } catch { /* same */ }
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      store.setItem(STORAGE_KEY, JSON.stringify(ious));
    }
  }, [ious, isLoaded]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addIou = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(iouAmount);
    if (!iouName.trim() || !amount) return;

    setIous([{
      id: generateId(),
      personName: iouName.trim(),
      description: iouDesc.trim(),
      amount,
      type: iouType,
      isSettled: false
    }, ...ious]);

    setIouName('');
    setIouDesc('');
    setIouAmount('');
    setIsAddingIou(false);
  };

  const toggleIouSettle = (id: string) => {
    setIous(ious.map(i => i.id === id ? { ...i, isSettled: !i.isSettled } : i));
  };

  const deleteIou = (iou: IOU) => {
    if (window.confirm(`Delete the note for ${iou.personName}?`)) {
      setIous(ious.filter(i => i.id !== iou.id));
    }
  };

  const open = ious.filter(i => !i.isSettled);
  const totalOwedToMe = open.filter(i => i.type === 'owe_me').reduce((acc, curr) => acc + curr.amount, 0);
  const totalIOwe = open.filter(i => i.type === 'i_owe').reduce((acc, curr) => acc + curr.amount, 0);

  const net = totalOwedToMe - totalIOwe;
  const board = totalOwedToMe + totalIOwe; // everything still on the table, the beam's full width

  const countFor = (key: Filter) => key === 'all' ? open.length : open.filter(i => i.type === key).length;

  const visible = ious.filter(i => filter === 'all' || i.type === filter);
  const active = visible.filter(i => !i.isSettled);
  const settled = visible.filter(i => i.isSettled);

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      <div className="flex items-center gap-3 px-1">
        <div className="p-2.5 bg-indigo-500/15 text-indigo-500 light:text-indigo-700 rounded-xl shrink-0">
          <HandCoins size={24} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">Catat Hutang</h1>
          <p className="text-sm text-muted truncate">Siapa hutang siapa, sebelum lupa</p>
        </div>
      </div>

      {/* Running totals — open notes only, so settling one takes it off the board */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel p-4 border-emerald-500/30 text-center relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-emerald-500/10 blur-xl" aria-hidden="true" />
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Orang hutang you</p>
          <p className={`text-xl font-display font-extrabold ${GREEN}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {money(totalOwedToMe)}
          </p>
        </div>
        <div className="glass-panel p-4 border-rose-500/30 text-center relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-rose-500/10 blur-xl" aria-hidden="true" />
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">You hutang orang</p>
          <p className={`text-xl font-display font-extrabold ${RED}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {money(totalIOwe)}
          </p>
        </div>
      </div>

      {/* The balance beam. Where the two colours meet IS the ratio between them, so the bar says
          something the two numbers above cannot: which way the page is leaning, at a glance. */}
      <div className="glass-panel px-4 py-3">
        <div className="flex items-baseline justify-between gap-2 mb-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted shrink-0">Balance</span>
          <span
            className={`font-display text-lg font-extrabold leading-none truncate ${
              net > 0 ? GREEN : net < 0 ? RED : 'text-muted'
            }`}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {board === 0 ? 'Kosong' : net === 0 ? 'Seri' : `${net > 0 ? 'You lebih' : 'You kurang'} ${money(net)}`}
          </span>
        </div>
        <div className="flex h-2.5 gap-0.5 rounded-full overflow-hidden bg-text/10">
          {board > 0 && (
            <>
              <div
                className="bg-emerald-500 transition-[width] duration-500 ease-out"
                style={{ width: `${(totalOwedToMe / board) * 100}%` }}
              />
              <div
                className="bg-rose-500 transition-[width] duration-500 ease-out"
                style={{ width: `${(totalIOwe / board) * 100}%` }}
              />
            </>
          )}
        </div>
      </div>

      {isAddingIou ? (
        <div className="glass-panel p-5 space-y-4 border-indigo-500/30 animate-slide-up motion-reduce:animate-none">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">New note</h3>
            <button onClick={() => setIsAddingIou(false)} aria-label="Close" className="p-1 text-muted hover:text-text">
              <X size={20} />
            </button>
          </div>

          <div className="flex p-1 bg-text/5 rounded-xl gap-1">
            <button
              onClick={() => setIouType('owe_me')}
              aria-pressed={iouType === 'owe_me'}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                iouType === 'owe_me' ? `bg-emerald-500/20 ${GREEN} border border-emerald-500/30` : 'text-muted hover:text-text'
              }`}
            >
              Orang hutang you
            </button>
            <button
              onClick={() => setIouType('i_owe')}
              aria-pressed={iouType === 'i_owe'}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                iouType === 'i_owe' ? `bg-rose-500/20 ${RED} border border-rose-500/30` : 'text-muted hover:text-text'
              }`}
            >
              You hutang orang
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="dt-name">Person's name</label>
            <input id="dt-name" autoFocus type="text" value={iouName} onChange={e => setIouName(e.target.value)} placeholder="e.g. Sara" className="input-field w-full" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="dt-amount">Amount (RM)</label>
            <input id="dt-amount" type="number" step="0.01" value={iouAmount} onChange={e => setIouAmount(e.target.value)} placeholder="0.00" className="input-field w-full font-mono text-lg" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="dt-desc">For what? (optional)</label>
            <input id="dt-desc" type="text" value={iouDesc} onChange={e => setIouDesc(e.target.value)} placeholder="e.g. Concert tickets" className="input-field w-full" />
          </div>

          <button
            onClick={addIou}
            disabled={!iouName.trim() || !parseFloat(iouAmount)}
            className="w-full py-3 rounded-xl bg-indigo-600 text-[#fff] font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none"
          >
            Save note
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAddingIou(true)}
          className="w-full py-4 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-indigo-500/50 hover:text-indigo-500 light:hover:text-indigo-700 transition-all flex items-center justify-center"
        >
          <Plus size={20} className="mr-2" /> Add Debt Note
        </button>
      )}

      {/* Filter tabs */}
      <div className="flex p-1 bg-text/5 rounded-xl gap-1">
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`flex-1 min-w-0 py-2 px-1 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
              filter === key ? 'bg-surface shadow-sm' : 'hover:bg-text/5'
            }`}
          >
            <span className={`text-[10px] font-bold leading-tight truncate max-w-full ${
              filter === key ? 'text-text' : 'text-muted'
            }`}>
              {label}
            </span>
            <span
              className={`text-sm font-black leading-none ${filter === key ? 'text-indigo-500 light:text-indigo-700' : 'text-muted'}`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {countFor(key)}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {active.map(iou => (
          <Row key={iou.id} iou={iou} onToggle={toggleIouSettle} onDelete={deleteIou} />
        ))}

        {active.length === 0 && !isAddingIou && (
          <div className="text-center p-8 text-muted text-sm border border-dashed border-text/10 rounded-2xl">
            {ious.length === 0
              ? 'Takde hutang lagi. Catat satu sebelum lupa siapa hutang siapa.'
              : filter === 'all' ? 'Semua dah settle.'
                : filter === 'owe_me' ? 'Takde siapa hutang you.'
                  : 'You takde hutang sesiapa.'}
          </div>
        )}
      </div>

      {settled.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted px-1">
            Dah settle · {settled.length}
          </h2>
          {settled.map(iou => (
            <Row key={iou.id} iou={iou} onToggle={toggleIouSettle} onDelete={deleteIou} />
          ))}
        </div>
      )}
    </div>
  );
};

export default DebtTracker;
