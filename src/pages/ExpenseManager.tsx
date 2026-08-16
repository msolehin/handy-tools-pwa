import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { store } from '../lib/store';
import { useT, t as trs, getLang, locale } from '../lib/lang';
import { AMOUNT_ORIGIN, scheduledFor, paidFor, commitmentPaidTotal, commitActive, isSettled, goalSaved } from '../lib/savings';
import { downscaleFile } from '../lib/downscale';
import { SearchBox } from '../components/SearchBox';
import {
  Wallet, Plus, Trash2, Check, X, ChevronLeft, ChevronRight, ChevronDown, Pencil, RotateCcw,
  TrendingUp, TrendingDown, PieChart, ListChecks, CreditCard, Coins, CalendarDays,
  Eye, EyeOff,
  Utensils, ShoppingCart, Car, ShoppingBag, Receipt, HeartPulse, GraduationCap, Clapperboard,
  Plane, Gift, HeartHandshake, Sparkles, Baby, CircleEllipsis, Landmark, Repeat, Zap, ShieldCheck,
  Home, Tag, PiggyBank, LineChart, Image as ImageIcon, Loader, Settings, AlertTriangle
} from 'lucide-react';

interface Expense { id: string; description: string; amount: number; category: string; date: string; goalId?: string; }
// A savings goal is a tally, not a pot of its own: it counts money that already left through a
// linked commitment or expense, plus top-ups that move nothing else.
// photoPos is a CSS object-position ('50% 30%'): the list crop is a narrow slice of a wide
// photo, so the middle is frequently the wrong part of it.
interface SavingsGoal { id: string; name: string; target: number; deadline?: string; note?: string; photo?: string; photoPos?: string; }
interface Topup { id: string; goalId: string; date: string; amount: number; note?: string; }
interface Income { id: string; title: string; amount: number; recurring: boolean; date: string; startMonth?: string; endMonth?: string; day?: number; }
interface Commitment {
  id: string; title: string; amount: number; paymentDay: number; category: string;
  archived: boolean; payments: Record<string, string>; // 'YYYY-MM' -> 'YYYY-MM-DD'
  // What was actually paid that month, when it differed from the plan. Kept beside `payments`
  // rather than inside it so a device on an older build still reads the dates it expects.
  paidAmounts?: Record<string, number>; // 'YYYY-MM' -> amount
  // What the commitment was scheduled at, effective from each month. Written when a change is
  // meant to apply going forward only, so a past month still shows the figure of its time.
  // `amount` stays the current plan; older builds keep reading just that.
  amounts?: Record<string, number>; // 'YYYY-MM' -> amount effective from that month
  // First month it applies. A new commitment starts in the month it was added, so scrolling back
  // through the year no longer shows it owed in months you did not have it. Absent means no lower
  // bound, which is how every commitment saved before this behaved.
  startMonth?: string;
  endMonth?: string; // last month it applies — past payments stay on record after it ends
  goalId?: string;   // the savings goal this feeds, if any — at most one, so it lives here
  // A commitment that has an end: a loan, an instalment plan, a kutu. The total payable across the
  // whole term, interest already in it — the app does no rate maths. Its presence is the only thing
  // that turns a commitment into a loan: it earns a progress bar, and the payment that covers it
  // stops the commitment. Absent means the open-ended bill it has always been.
  payoffTotal?: number;
}

const STORAGE_KEY = 'expense_manager_data';
const HIDE_KEY = 'expense_manager_hide_balance';
// Categories are saved by id, never by label, so the language can change without touching
// stored data — the picker just reads whichever side the language switch is on.
type CatDef = { id: string; ms: string; en: string; Icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }> };
const catLang = (): 'ms' | 'en' => getLang();

// The only expense categories that can point into a savings goal — money set aside, not spent.
const FUND_CATS = ['savings', 'invest'];

const DEFAULT_EXPENSE_CATS: CatDef[] = [
  { id: 'food',      ms: 'Makanan & Minuman', en: 'Food & Dining',     Icon: Utensils },
  { id: 'groceries', ms: 'Barang Dapur',      en: 'Groceries',         Icon: ShoppingCart },
  { id: 'transport', ms: 'Pengangkutan',      en: 'Transport',         Icon: Car },
  { id: 'shopping',  ms: 'Beli-belah',        en: 'Shopping',          Icon: ShoppingBag },
  { id: 'bills',     ms: 'Bil & Utiliti',     en: 'Bills & Utilities', Icon: Receipt },
  { id: 'health',    ms: 'Kesihatan',         en: 'Health',            Icon: HeartPulse },
  { id: 'education', ms: 'Pendidikan',        en: 'Education',         Icon: GraduationCap },
  { id: 'entertain', ms: 'Hiburan',           en: 'Entertainment',     Icon: Clapperboard },
  { id: 'travel',    ms: 'Perjalanan',        en: 'Travel',            Icon: Plane },
  { id: 'gift',      ms: 'Hadiah',            en: 'Gift',              Icon: Gift },
  { id: 'charity',   ms: 'Zakat & Derma',     en: 'Zakat & Charity',   Icon: HeartHandshake },
  { id: 'family',    ms: 'Keluarga & Anak',   en: 'Family & Kids',     Icon: Baby },
  { id: 'personal',  ms: 'Penjagaan Diri',    en: 'Personal Care',     Icon: Sparkles },
  { id: 'savings',   ms: 'Simpanan',          en: 'Savings',           Icon: PiggyBank },
  { id: 'invest',    ms: 'Pelaburan',         en: 'Investment',        Icon: LineChart },
  { id: 'other',     ms: 'Lain-lain',         en: 'Other',             Icon: CircleEllipsis },
];

const DEFAULT_COMMIT_CATS: CatDef[] = [
  { id: 'loan',         ms: 'Pinjaman',  en: 'Loan',         Icon: Landmark },
  { id: 'subscription', ms: 'Langganan', en: 'Subscription', Icon: Repeat },
  { id: 'utility',      ms: 'Utiliti',   en: 'Utilities',    Icon: Zap },
  { id: 'insurance',    ms: 'Insurans',  en: 'Insurance',    Icon: ShieldCheck },
  { id: 'rent',         ms: 'Sewa',      en: 'Rent',         Icon: Home },
  // A standing monthly saving or investment — the kind a savings goal is usually fed by
  { id: 'commit-savings',  ms: 'Simpanan',  en: 'Savings',    Icon: PiggyBank },
  { id: 'commit-invest',   ms: 'Pelaburan', en: 'Investment', Icon: LineChart },
  { id: 'commit-other', ms: 'Lain-lain', en: 'Other',        Icon: CircleEllipsis },
];

// Names used before categories had ids. Dropped from the picker on load; rows that still
// carry one keep displaying it, since an unknown id falls back to its own text.
const LEGACY_CATS = ['Makanan', 'Pengangkutan', 'Beli-belah', 'Bil', 'Kesihatan', 'Hiburan', 'Lain-lain', 'Pinjaman', 'Langganan', 'Utiliti', 'Insurans', 'Sewa'];

// True for a built-in, by id or by either label — so a user-added name that collides with a
// built-in can never show up as a second, deletable copy of it.
const isDefaultCat = (id: string, defs: CatDef[]) => defs.some(d => d.id === id || d.ms === id || d.en === id);
const catLabel = (id: string, defs: CatDef[]) => defs.find(d => d.id === id)?.[catLang()] ?? id;
// A user-added category is its own id and label, and gets the generic tag icon
const asCatDef = (id: string): CatDef => ({ id, ms: id, en: id, Icon: Tag });
const CAT_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ec4899', '#8b5cf6', '#14b8a6', '#eab308', '#ef4444', '#06b6d4', '#a855f7'];

const MONTHS_MS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS = () => trs(MONTHS_MS, MONTHS_EN);
const pad = (n: number) => String(n).padStart(2, '0');
const PERIOD_LABELS = () => trs(
  { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan' },
  { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' },
);
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthOf = (key: string) => key.slice(0, 7);
const monthLabel = (mk: string) => { const [y, m] = mk.split('-').map(Number); return `${MONTHS()[m - 1]} ${y}`; };
const addMonth = (mk: string, delta: number) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const daysInMonth = (mk: string) => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const fmt = (n: number) => n.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (key: string) => { const [y, m, d] = key.split('-'); return `${Number(d)}/${Number(m)}/${y}`; }; // d/m/yyyy
const fmtLongDate = (key: string) => { const [y, m, d] = key.split('-'); return `${Number(d)} ${MONTHS()[Number(m) - 1]} ${y}`; };
const generateId = () => Math.random().toString(36).substring(2, 9);
const catColor = (cat: string, all: CatDef[]) => CAT_COLORS[Math.max(0, all.findIndex(d => d.id === cat)) % CAT_COLORS.length];
// Is an income counted in a given month? Recurring incomes are effective-dated.
const incomeActive = (i: Income, mk: string) => {
  if (!i.recurring) return monthOf(i.date) === mk;
  if (i.startMonth && mk < i.startMonth) return false;
  if (i.endMonth && mk > i.endMonth) return false;
  return true;
};

const catIcon = (id: string, defs: CatDef[]) => defs.find(d => d.id === id)?.Icon ?? Tag;

// A savings goal's progress, with the figures written on the bar itself: what is in, how far
// along, and what is left. The fill is kept translucent so `text-text` stays legible over both
// the filled and unfilled halves, in either theme.
// The two labels are overridable because a loan reuses this bar and reads the wrong way round:
// its figure is a debt, not a target, and reaching it is settled, not achieved.
const GoalBar = ({ saved, target, label, doneLabel }: { saved: number; target: number; label?: string; doneLabel?: string }) => {
  const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  const left = Math.max(0, target - saved);
  const done = saved >= target && target > 0;
  return (
    <div className="space-y-1">
      <div className="relative h-7 rounded-lg bg-text/10 overflow-hidden border border-text/5">
        <div
          className={`absolute inset-y-0 left-0 transition-all duration-700 ${done ? 'bg-emerald-500/45' : 'bg-emerald-500/30'}`}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-between px-2.5 text-[11px] font-bold text-text" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <span className="truncate">RM {fmt(saved)}</span>
          <span className="shrink-0 pl-2">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2 text-[10px] text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span>{label ?? trs('Sasaran', 'Target')} RM {fmt(target)}</span>
        <span className={done ? 'font-bold text-emerald-400 light:text-emerald-600' : ''}>
          {done ? (doneLabel ?? trs('Tercapai!', 'Reached!')) : trs(`Lagi RM ${fmt(left)}`, `RM ${fmt(left)} to go`)}
        </span>
      </div>
    </div>
  );
};

// Spending donut. Six wedges is where part-to-whole stops being readable, so five categories are
// named and the tail is grouped into one neutral wedge — never a generated hue, and never a
// second helping of a palette that only holds ten.
const DONUT_R = 42;
const DONUT_C = 2 * Math.PI * DONUT_R;
const DONUT_GAP = 2;   // viewBox units of surface between wedges, ~2px at the rendered size
const DONUT_MAX = 5;   // named wedges before the tail is grouped
const REST_COLOR = '#94a3b8'; // slate-400 — deliberately outside the category palette

// Percentages in a StatStrip are always a share of the money that came in
const shareOf = (n: number, base: number) => (base > 0 ? `${Math.round((n / base) * 100)}%` : '—');
const SEG_COMMIT = '#fbbf24'; // amber-400, matching the Komitmen column
const SEG_SPEND = '#fb7185';  // rose-400, matching Perbelanjaan / Keluar

// Three-up figure strip, shared by the dashboard and the transaction tab.
//
// The first column is always the money that came in, so it is the 100% every other column is a
// share of — which is what makes the percentages readable without a legend: the two outflows
// name their slice, and whatever the segments leave unpainted is what you still have.
const StatStrip = ({ items, segments }: {
  items: { label: string; value: string; Icon: CatDef['Icon']; tone: string; pct?: string }[];
  segments?: { pct: number; color: string }[];
}) => (
  <div className="glass-panel overflow-hidden">
    {segments && (
      // Heads the strip with how the money split. The figure is the painted share, which is the
      // outflow columns added up — so the bar and the columns visibly agree. Ratios survive the
      // Baki toggle: a share gives away nothing a shoulder could spend.
      <div className="flex items-center gap-2.5 px-3 pt-3">
        <div className="flex-1 flex h-1.5 rounded-full overflow-hidden bg-emerald-400/25 light:bg-emerald-500/25">
          {segments.map((s, i) => (
            <div
              key={i}
              className="h-full motion-safe:transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(0, Math.min(100, s.pct))}%`, backgroundColor: s.color }}
            />
          ))}
        </div>
        <span className="text-[10px] font-mono font-bold text-muted shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(segments.reduce((s, x) => s + x.pct, 0))}%
        </span>
      </div>
    )}
    <div className="grid grid-cols-3 divide-x divide-text/10">
      {items.map(it => (
        <div key={it.label} className="px-2 py-3.5 text-center">
          <div className="flex items-center justify-center gap-1.5 min-h-[24px]">
            <it.Icon size={12} className={`shrink-0 ${it.tone}`} />
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted leading-tight">{it.label}</p>
          </div>
          <p className={`font-mono text-[13px] font-black mt-2 leading-none ${it.tone}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{it.value}</p>
          {it.pct && <p className={`font-mono text-[9px] font-bold mt-1.5 leading-none opacity-70 ${it.tone}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{it.pct}</p>}
        </div>
      ))}
    </div>
  </div>
);

// Category dropdown — defaults carry an icon and are permanent; user-added ones can be removed.
// Module-level so removing an entry doesn't remount the menu shut.
const CategoryPicker = ({ options, value, onSelect, onAdd, onRemove, defaults, accent }: {
  options: CatDef[]; value: string; onSelect: (id: string) => void; onAdd: (name: string) => void;
  onRemove: (id: string) => void; defaults: CatDef[]; accent: string;
}) => {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState('');
  const sel = options.find(o => o.id === value);
  const SelIcon = sel?.Icon ?? Tag;
  const commit = () => { const v = val.trim(); if (v) onAdd(v); setVal(''); setAdding(false); setOpen(false); };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} className="input-field w-full flex items-center gap-2.5 text-left">
        <SelIcon size={16} style={{ color: accent }} />
        <span className="flex-1 truncate text-sm">{sel ? sel[catLang()] : catLabel(value, options) || trs('Pilih kategori', 'Choose a category')}</span>
        <ChevronDown size={16} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setAdding(false); }} />
          <div className="absolute z-20 bottom-full mb-2 left-0 right-0 max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-text/10 bg-surface shadow-2xl p-1">
            {options.map(o => {
              const own = !isDefaultCat(o.id, defaults);
              return (
                <div key={o.id} className={`flex items-center rounded-lg ${o.id === value ? 'bg-text/10' : 'hover:bg-text/5'}`}>
                  <button type="button" onClick={() => { onSelect(o.id); setOpen(false); }} className="flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-2 text-left">
                    <o.Icon size={15} style={{ color: accent }} />
                    <span className="text-sm truncate">{o[catLang()]}</span>
                  </button>
                  {own && (
                    <button type="button" onClick={() => onRemove(o.id)} title={trs('Padam kategori', 'Delete category')} aria-label={trs(`Padam kategori ${o[catLang()]}`, `Delete the ${o[catLang()]} category`)} className="px-2.5 py-2 text-muted/60 hover:text-rose-400">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
            <div className="border-t border-text/10 mt-1 pt-1">
              {adding ? (
                <div className="flex items-center gap-1 p-1">
                  <input autoFocus value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commit(); }} placeholder={trs('Nama kategori', 'Category name')} className="input-field py-1 text-sm flex-1" />
                  <button type="button" onClick={commit} className="p-1 text-emerald-400"><Check size={18} /></button>
                </div>
              ) : (
                <button type="button" onClick={() => setAdding(true)} className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm text-muted hover:text-text">
                  <Plus size={15} /> {trs('Kategori baru', 'New category')}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Dev-only: generate a rich set of sample data
const makeSampleData = (): { expenses: Expense[]; incomes: Income[]; commitments: Commitment[] } => {
  const today = new Date();
  const cur = monthOf(dateKey(today));
  const rnd = (n: number) => Math.floor(Math.random() * n);
  const descByCat: Record<string, string[]> = {
    food: ['Makan tengah hari', 'Makan malam', 'Kopi', 'Makanan segera', 'Bubble tea', 'Sarapan'],
    groceries: ['Barang dapur', 'Pasar tani', 'Beras & minyak', 'Jerung/mydin'],
    transport: ['Minyak', 'Tambang Grab', 'Tol', 'Parking', 'Tambang tren'],
    shopping: ['Pesanan Shopee', 'Baju', 'Kasut', 'Lazada', 'Gajet'],
    bills: ['Bil elektrik', 'Bil air', 'Internet', 'Topup telefon'],
    health: ['Farmasi', 'Klinik', 'Suplemen', 'Pas gim'],
    education: ['Yuran tuisyen', 'Buku', 'Kursus dalam talian'],
    entertain: ['Wayang', 'Spotify', 'Permainan', 'Tiket konsert'],
    travel: ['Tiket kapal terbang', 'Hotel', 'Percutian'],
    gift: ['Hadiah harijadi', 'Duit raya', 'Bunga'],
    charity: ['Derma masjid', 'Zakat', 'Sedekah'],
    family: ['Susu & lampin', 'Mainan anak', 'Yuran taska'],
    personal: ['Gunting rambut', 'Skincare', 'Salon'],
    other: ['Pelbagai', 'Tak dikategori'],
  };
  const expenses: Expense[] = [];
  for (let m = 0; m < 6; m++) {
    const mk = addMonth(cur, -m);
    const maxDay = mk === cur ? today.getDate() : daysInMonth(mk);
    const count = 10 + rnd(10);
    for (let i = 0; i < count; i++) {
      const cat = DEFAULT_EXPENSE_CATS[rnd(DEFAULT_EXPENSE_CATS.length)].id;
      const descs = descByCat[cat] || ['Perbelanjaan'];
      expenses.push({ id: generateId(), description: descs[rnd(descs.length)], amount: 5 + rnd(195), category: cat, date: `${mk}-${pad(1 + rnd(maxDay))}` });
    }
  }
  const sixAgo = addMonth(cur, -6);
  const lastMonth = addMonth(cur, -1);
  const incomes: Income[] = [
    { id: generateId(), title: 'Gaji', amount: 3700, recurring: true, date: `${sixAgo}-01`, startMonth: sixAgo, endMonth: addMonth(cur, -2), day: 25 },
    { id: generateId(), title: 'Gaji', amount: 4200, recurring: true, date: `${lastMonth}-01`, startMonth: lastMonth, day: 25 },
    { id: generateId(), title: 'Kerja bebas', amount: 600, recurring: true, date: `${sixAgo}-01`, startMonth: sixAgo, day: 10 },
    { id: generateId(), title: 'Bonus prestasi', amount: 2000, recurring: false, date: `${addMonth(cur, -3)}-15` },
    { id: generateId(), title: 'Jual telefon lama', amount: 800, recurring: false, date: `${lastMonth}-08` },
  ];
  const mkCommit = (title: string, amount: number, day: number, category: string): Commitment =>
    ({ id: generateId(), title, amount, paymentDay: day, category, archived: false, payments: {}, startMonth: sixAgo });
  const commitments: Commitment[] = [
    mkCommit('Pinjaman kereta', 950, 5, 'loan'),
    mkCommit('Sewa rumah', 1200, 1, 'rent'),
    mkCommit('Insurans kereta', 180, 15, 'insurance'),
    mkCommit('Netflix', 55, 8, 'subscription'),
    mkCommit('Spotify', 24, 8, 'subscription'),
    mkCommit('Keahlian gim', 130, 3, 'subscription'),
    mkCommit('Telefon pascabayar', 98, 20, 'utility'),
  ];
  commitments.forEach(c => {
    for (let m = 1; m <= 5; m++) { const mk = addMonth(cur, -m); c.payments[mk] = `${mk}-${pad(Math.min(c.paymentDay, daysInMonth(mk)))}`; }
    if (c.paymentDay <= today.getDate() && Math.random() > 0.4) c.payments[cur] = `${cur}-${pad(c.paymentDay)}`;
  });
  return { expenses, incomes, commitments };
};

const ExpenseManager: React.FC = () => {
  const tr = useT();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  // Only user-added categories are stored; the defaults live in code so they can never be lost
  const [expenseCats, setExpenseCats] = useState<string[]>([]);
  const [commitCats, setCommitCats] = useState<string[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [topups, setTopups] = useState<Topup[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [tab, setTab] = useState<'dashboard' | 'commitment' | 'income' | 'savings' | 'transaction'>('dashboard');
  const today = new Date();
  const todayKey = dateKey(today);
  const currentMonth = monthOf(todayKey);
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const isPastView = viewMonth < currentMonth;

  // Baki stays hidden across visits once the user taps it away (shoulder-surfing)
  const [hideBalance, setHideBalance] = useState(() => store.getItem(HIDE_KEY) === '1');
  const toggleBalance = () => setHideBalance(v => { store.setItem(HIDE_KEY, v ? '0' : '1'); return !v; });
  const masked = (n: number) => (hideBalance ? 'RM ••••' : `RM ${fmt(n)}`);

  // Settings — one destructive action: wipe this tool's records only. Nothing else in the app
  // is touched, and there is no undo, so it asks twice: the sheet warns, the confirm confirms.
  const [showSettings, setShowSettings] = useState(false);
  const wipeAll = () => {
    if (!window.confirm(tr(
      'Padam SEMUA data Expense Manager? Data yang dipadam TIDAK BOLEH dipulihkan.',
      'Delete ALL Expense Manager data? Deleted data CANNOT be recovered.',
    ))) return;
    setExpenses([]); setIncomes([]); setCommitments([]);
    setGoals([]); setTopups([]); setExpenseCats([]); setCommitCats([]);
    setShowSettings(false);
  };

  // Dashboard list filters — each narrows its own list only, never the figures above it
  const [commitQuery, setCommitQuery] = useState('');
  const [spendQuery, setSpendQuery] = useState('');
  const [commitTabQuery, setCommitTabQuery] = useState('');

  useEffect(() => {
    const saved = store.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (Array.isArray(p.expenses)) setExpenses(p.expenses);
        if (Array.isArray(p.incomes)) setIncomes(p.incomes);
        // Two repairs on the way in:
        //  - archiving is gone, so anything archived comes back rather than being stranded
        //  - payments made before amounts were recorded are stamped with the current figure,
        //    which is what they are already counted as. Without this, editing the amount
        //    still drags every past month with it.
        if (Array.isArray(p.commitments)) setCommitments(p.commitments.map((c: Commitment) => ({
          ...c,
          archived: false,
          paidAmounts: Object.fromEntries(Object.keys(c.payments || {}).map(mk => [mk, c.paidAmounts?.[mk] ?? c.amount])),
        })));
        // Old saves held the full list including the built-ins — keep only what the user added
        const custom = (list: unknown, defs: CatDef[]) => (list as string[]).filter(c => !LEGACY_CATS.includes(c) && !isDefaultCat(c, defs));
        if (Array.isArray(p.expenseCats)) setExpenseCats(custom(p.expenseCats, DEFAULT_EXPENSE_CATS));
        if (Array.isArray(p.commitCats)) setCommitCats(custom(p.commitCats, DEFAULT_COMMIT_CATS));
        if (Array.isArray(p.goals)) setGoals(p.goals);
        if (Array.isArray(p.topups)) setTopups(p.topups);
      } catch (e) {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) store.setItem(STORAGE_KEY, JSON.stringify({ expenses, incomes, commitments, goals, topups, expenseCats, commitCats }));
  }, [expenses, incomes, commitments, goals, topups, expenseCats, commitCats, isLoaded]);

  // Built-ins first, then anything the user added
  const expenseOptions: CatDef[] = [...DEFAULT_EXPENSE_CATS, ...expenseCats.map(asCatDef)];
  const commitOptions: CatDef[] = [...DEFAULT_COMMIT_CATS, ...commitCats.map(asCatDef)];
  const allOptions: CatDef[] = [...expenseOptions, ...commitOptions];

  // --- Derived for the viewed month ---
  // Ended commitments drop off the management list once their last month has passed.
  const activeCommitments = commitments.filter(c => !c.endMonth || c.endMonth >= currentMonth);
  // Commitments owed in the viewed month: inside their start/end window, plus any that were
  // actually paid that month (keeps the history of ended ones intact).
  const monthCommitments = commitments.filter(c => commitActive(c, viewMonth));
  // Search narrows the checklist only — the Jumlah/Dibayar/Baki figures still describe the month
  const shownCommitments = commitQuery.trim()
    ? monthCommitments.filter(c => {
        const q = commitQuery.trim().toLowerCase();
        return c.title.toLowerCase().includes(q) || catLabel(c.category, commitOptions).toLowerCase().includes(q);
      })
    : monthCommitments;
  const monthExpenses = expenses.filter(e => monthOf(e.date) === viewMonth);
  const monthIncomes = incomes.filter(i => incomeActive(i, viewMonth));
  // Whether the income has actually been received (reached its pay day) in this month
  const incomeReceived = (i: Income, mk: string) => {
    if (!incomeActive(i, mk)) return false; // not effective for this month (start/end window)
    if (!i.recurring) return i.date <= todayKey;
    if (mk < currentMonth) return true;
    if (mk > currentMonth) return false;
    // Clamp the pay day to the month's last day (e.g. day 31 falls on Feb 28)
    return today.getDate() >= Math.min(i.day || 1, daysInMonth(mk));
  };
  const totalIncome = monthIncomes.reduce((s, i) => s + i.amount, 0);
  const receivedIncome = monthIncomes.filter(i => incomeReceived(i, viewMonth)).reduce((s, i) => s + i.amount, 0);
  const pendingIncome = totalIncome - receivedIncome;
  // Paid ones count what they cost; the rest count what they are scheduled to
  const totalCommitment = monthCommitments.reduce((s, c) => s + (c.payments[viewMonth] ? paidFor(c, viewMonth) : scheduledFor(c, viewMonth)), 0);
  const paidCommitment = commitments.filter(c => c.payments[viewMonth]).reduce((s, c) => s + paidFor(c, viewMonth), 0);
  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const balance = receivedIncome - paidCommitment - totalExpenses;

  const prevMonth = addMonth(viewMonth, -1);
  const prevIncome = incomes.filter(i => incomeActive(i, prevMonth)).reduce((s, i) => s + i.amount, 0);
  const prevExpense = expenses.filter(e => monthOf(e.date) === prevMonth).reduce((s, e) => s + e.amount, 0);
  const prevPaid = commitments.filter(c => c.payments[prevMonth]).reduce((s, c) => s + paidFor(c, prevMonth), 0);
  const prevNet = prevIncome - prevPaid - prevExpense;

  // 6-month net trend (ending at the viewed month)
  const netForMonth = (mk: string) => {
    const inc = incomes.filter(i => incomeReceived(i, mk)).reduce((s, i) => s + i.amount, 0);
    const exp = expenses.filter(e => monthOf(e.date) === mk).reduce((s, e) => s + e.amount, 0);
    const paid = commitments.filter(c => c.payments[mk]).reduce((s, c) => s + paidFor(c, mk), 0);
    return inc - paid - exp;
  };
  const netTrend = Array.from({ length: 6 }, (_, k) => { const mk = addMonth(viewMonth, -(5 - k)); return { mk, net: netForMonth(mk) }; });
  // The baseline sits where zero actually falls, so six positive months use the full height
  // instead of politely staying in the top half.
  const netHi = Math.max(0, ...netTrend.map(d => d.net));
  const netLo = Math.min(0, ...netTrend.map(d => d.net));
  const netSpan = Math.max(1, netHi - netLo);
  const netAvg = netTrend.reduce((s, d) => s + d.net, 0) / netTrend.length;
  const netUp = netTrend.filter(d => d.net >= 0).length;
  const netBest = netTrend.reduce((a, b) => (b.net > a.net ? b : a));
  const netWorst = netTrend.reduce((a, b) => (b.net < a.net ? b : a));
  const compact = (n: number) => `${n < 0 ? '-' : '+'}${Math.abs(n) >= 1000 ? (Math.abs(n) / 1000).toFixed(1) + 'k' : Math.round(Math.abs(n))}`;

  const todayExpenses = expenses.filter(e => e.date === todayKey);

  // --- Expense modal ---
  const [showExpense, setShowExpense] = useState(false);
  const [expScope, setExpScope] = useState<'today' | 'month'>('today');
  const [frameEl, setFrameEl] = useState<HTMLElement | null>(null);
  useEffect(() => { setFrameEl(document.getElementById('app-frame')); }, []);
  const [eDesc, setEDesc] = useState('');
  const [eAmount, setEAmount] = useState('');
  const [eCat, setECat] = useState(DEFAULT_EXPENSE_CATS[0].id);
  const [eDate, setEDate] = useState(todayKey);
  const [eGoal, setEGoal] = useState('');
  // Same sheet adds and edits — eId null means a new one
  const [eId, setEId] = useState<string | null>(null);
  const openExpense = (e?: Expense) => {
    setEId(e?.id ?? null);
    setEDesc(e?.description ?? '');
    setEAmount(e ? String(e.amount) : '');
    setECat(e?.category ?? DEFAULT_EXPENSE_CATS[0].id);
    setEDate(e?.date ?? todayKey);
    setEGoal(e?.goalId ?? '');
    setShowExpense(true);
  };
  const saveExpense = () => {
    const amount = parseFloat(eAmount);
    if (!eDesc.trim() || isNaN(amount) || amount <= 0) return;
    // A fund only applies to a savings or investment expense, and '' means none — either way the key is left
    // off the record rather than stored empty. Checked here as well as in the form so no path
    // (adding a category, editing an older row) can leave a link behind that nothing displays.
    const goalId = eGoal && FUND_CATS.includes(eCat) ? eGoal : undefined;
    const fields = { description: eDesc.trim(), amount, category: eCat, date: eDate, goalId };
    setExpenses(prev => eId
      ? prev.map(x => x.id === eId ? { ...x, ...fields } : x)
      : [{ id: generateId(), ...fields }, ...prev]);
    setShowExpense(false);
  };
  // Small bin, no undo — worth one question before the record is gone
  const deleteExpense = (e: Expense) => {
    if (!window.confirm(`Padam "${e.description}" (RM ${fmt(e.amount)})?`)) return;
    setExpenses(prev => prev.filter(x => x.id !== e.id));
  };

  const addExpenseCat = (c: string) => {
    const v = c.trim();
    if (!v || expenseOptions.some(o => o.id === v || o.ms === v || o.en === v)) return;
    setExpenseCats(prev => [...prev, v]);
    setECat(v);
  };
  // Only user-added categories are removable, and never one that expenses still point at
  const removeExpenseCat = (c: string) => {
    if (expenses.some(e => e.category === c)) { window.alert(`"${c}" masih digunakan oleh perbelanjaan sedia ada.`); return; }
    setExpenseCats(prev => prev.filter(x => x !== c));
    if (eCat === c) setECat(DEFAULT_EXPENSE_CATS[0].id);
  };

  // --- Savings goals ---
  const [gForm, setGForm] = useState<{ id: string | null; name: string; target: string; deadline: string; photo: string; px: number; py: number }>({ id: null, name: '', target: '', deadline: '', photo: '', px: 50, py: 50 });
  const [goalPhotoBusy, setGoalPhotoBusy] = useState(false);
  const goalPhotoRef = useRef<HTMLInputElement>(null);
  const [showGForm, setShowGForm] = useState(false);
  const [openGoal, setOpenGoal] = useState<string | null>(null); // the goal whose sheet is open
  const [showSources, setShowSources] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupDate, setTopupDate] = useState(todayKey);

  const openGForm = (g?: SavingsGoal) => {
    const [px, py] = (g?.photoPos ?? '50% 50%').split(' ').map(v => parseInt(v) || 50);
    setGForm(g
      ? { id: g.id, name: g.name, target: String(g.target), deadline: g.deadline ?? '', photo: g.photo ?? '', px, py }
      : { id: null, name: '', target: '', deadline: '', photo: '', px: 50, py: 50 });
    setShowGForm(true);
  };
  const saveGForm = () => {
    const target = parseFloat(gForm.target);
    if (!gForm.name.trim() || isNaN(target) || target <= 0) return;
    const fields = {
      name: gForm.name.trim(), target,
      photo: gForm.photo || undefined,
      // Only worth storing when it is not the default, and never without a photo to position
      photoPos: gForm.photo && (gForm.px !== 50 || gForm.py !== 50) ? `${gForm.px}% ${gForm.py}%` : undefined,
      ...(gForm.deadline ? { deadline: gForm.deadline } : {}),
    };
    setGoals(prev => gForm.id
      ? prev.map(g => g.id === gForm.id ? { ...g, ...fields, ...(gForm.deadline ? {} : { deadline: undefined }) } : g)
      : [...prev, { id: generateId(), ...fields }]);
    setShowGForm(false);
  };
  // Deleting a goal unlinks rather than cascades: the commitments and expenses that fed it are
  // real money that still happened, so only the tally goes.
  const deleteGoal = (g: SavingsGoal) => {
    if (!window.confirm(trs(`Padam tabung "${g.name}"? Komitmen dan perbelanjaan yang dipautkan akan dilepaskan, bukan dipadam.`,
      `Delete the "${g.name}" fund? The commitments and expenses feeding it are unlinked, not deleted.`))) return;
    setCommitments(prev => prev.map(c => c.goalId === g.id ? { ...c, goalId: undefined } : c));
    setExpenses(prev => prev.map(e => e.goalId === g.id ? { ...e, goalId: undefined } : e));
    setTopups(prev => prev.filter(t => t.goalId !== g.id));
    setGoals(prev => prev.filter(x => x.id !== g.id));
    setOpenGoal(null);
  };
  // One commitment feeds at most one goal, so ticking one that already belongs elsewhere moves it.
  const linkCommitment = (c: Commitment, goalId: string) => {
    if (c.goalId && c.goalId !== goalId) {
      const from = goals.find(g => g.id === c.goalId)?.name ?? '';
      if (!window.confirm(trs(`"${c.title}" sedang masuk ke "${from}". Pindahkan ke tabung ini?`,
        `"${c.title}" currently feeds "${from}". Move it to this fund?`))) return;
    }
    setCommitments(prev => prev.map(x => x.id === c.id ? { ...x, goalId: x.goalId === goalId ? undefined : goalId } : x));
  };
  const addTopup = (goalId: string) => {
    const amount = parseFloat(topupAmount);
    if (isNaN(amount) || amount <= 0) return;
    setTopups(prev => [{ id: generateId(), goalId, date: topupDate, amount }, ...prev]);
    setTopupAmount('');
  };
  const savedFor = (goalId: string) => goalSaved(goalId, commitments, expenses, topups);
  const allSaved = goals.reduce((s, g) => s + savedFor(g.id), 0);
  const allTarget = goals.reduce((s, g) => s + g.target, 0);

  // --- Commitment add/edit ---
  const [cForm, setCForm] = useState<{ id: string | null; title: string; amount: string; day: string; category: string; payoff: string; start: string }>({ id: null, title: '', amount: '', day: '1', category: DEFAULT_COMMIT_CATS[0].id, payoff: '', start: '' });
  const [showCForm, setShowCForm] = useState(false);
  const openCForm = (c?: Commitment) => {
    // An existing commitment without a start month keeps its blank field: filling it in with today
    // would quietly rewrite which past months it covers.
    if (c) setCForm({ id: c.id, title: c.title, amount: String(c.amount), day: String(c.paymentDay), category: c.category, payoff: c.payoffTotal != null ? String(c.payoffTotal) : '', start: c.startMonth ?? '' });
    else setCForm({ id: null, title: '', amount: '', day: '1', category: DEFAULT_COMMIT_CATS[0].id, payoff: '', start: viewMonth });
    setShowCForm(true);
  };
  // 'forward' keeps past months on the old figure; 'all' rewrites it everywhere (a typo fix)
  const saveCForm = (scope: 'forward' | 'all' = 'all') => {
    const amount = parseFloat(cForm.amount);
    const day = Math.min(31, Math.max(1, parseInt(cForm.day) || 1));
    if (!cForm.title.trim() || isNaN(amount) || amount <= 0) return;
    // A blank field must never persist as 0, which would read as a loan that settles on its first
    // payment. undefined drops out of the stored JSON, so an emptied field goes back to absent —
    // which is what the server round trip expects of an optional column.
    const payoff = parseFloat(cForm.payoff);
    const payoffTotal = !isNaN(payoff) && payoff > 0 ? payoff : undefined;
    // Cleared means no lower bound: the commitment goes back through every month, as commitments
    // saved before this field existed still do.
    const startMonth = /^\d{4}-\d{2}$/.test(cForm.start) ? cForm.start : undefined;
    if (cForm.id) {
      setCommitments(prev => prev.map(c => {
        if (c.id !== cForm.id) return c;
        // Neither of these is effective-dated the way `amount` is — one figure and one window for
        // the whole term, so both are rewritten on either scope rather than kept per month.
        const base = { ...c, title: cForm.title.trim(), amount, paymentDay: day, category: cForm.category, payoffTotal, startMonth };
        if (scope === 'all') { const { amounts, ...rest } = base; return rest; }
        // Seed the origin on the first forward change, so months before it keep the old figure
        return { ...base, amounts: { ...(c.amounts ?? { [AMOUNT_ORIGIN]: c.amount }), [currentMonth]: amount } };
      }));
    } else {
      setCommitments(prev => [...prev, { id: generateId(), title: cForm.title.trim(), amount, paymentDay: day, category: cForm.category, archived: false, payments: {}, payoffTotal, startMonth }]);
    }
    setShowCForm(false);
  };
  const addCommitCat = (c: string) => {
    const v = c.trim();
    if (!v || commitOptions.some(o => o.id === v || o.ms === v || o.en === v)) return;
    setCommitCats(prev => [...prev, v]);
    setCForm(f => ({ ...f, category: v }));
  };
  const removeCommitCat = (c: string) => {
    if (commitments.some(k => k.category === c)) { window.alert(`"${c}" masih digunakan oleh komitmen sedia ada.`); return; }
    setCommitCats(prev => prev.filter(x => x !== c));
    setCForm(f => f.category === c ? { ...f, category: DEFAULT_COMMIT_CATS[0].id } : f);
  };
  // Same two-way delete as income: stop it going forward, or wipe it from every month.
  const [delCommit, setDelCommit] = useState<Commitment | null>(null);
  const deleteCommitment = (id: string) => setCommitments(prev => prev.filter(c => c.id !== id));
  const stopCommitmentFromNow = () => {
    if (!delCommit) return;
    const prevM = addMonth(currentMonth, -1);
    // Nothing paid before this month means there is no history worth keeping
    const hasPast = Object.keys(delCommit.payments).some(mk => mk <= prevM);
    if (hasPast) setCommitments(prev => prev.map(c => c.id === delCommit.id ? { ...c, endMonth: prevM } : c));
    else deleteCommitment(delCommit.id);
    setDelCommit(null);
  };

  // --- Commitment payment confirm ---
  const [payTarget, setPayTarget] = useState<Commitment | null>(null);
  const [payDate, setPayDate] = useState(todayKey);
  const [payAmount, setPayAmount] = useState('');
  const openPay = (c: Commitment) => {
    setPayTarget(c);
    setPayDate(viewMonth === currentMonth ? todayKey : `${viewMonth}-${pad(daysInMonth(viewMonth))}`);
    setPayAmount(String(paidFor(c, viewMonth)));
  };
  // ponytail: one payment per month, since `payments` is keyed by month. Settling a loan early with
  // a lump sum means undoing that month and re-marking it at the combined figure. Give payments
  // their own ids if part-payments ever need to stand apart.
  const confirmPay = () => {
    if (!payTarget) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) return;
    setCommitments(prev => prev.map(c => {
      if (c.id !== payTarget.id) return c;
      const paid = { ...c, payments: { ...c.payments, [viewMonth]: payDate }, paidAmounts: { ...c.paidAmounts, [viewMonth]: amount } };
      // The payment that covers the loan is also the one that ends it. endMonth is this month, not
      // last: it stays on the tab for the rest of the month, then drops off, and every month it
      // was alive keeps showing it.
      return isSettled(paid) ? { ...paid, endMonth: viewMonth } : paid;
    }));
    setPayTarget(null);
  };
  const undoPay = (id: string) => setCommitments(prev => prev.map(c => {
    if (c.id !== id) return c;
    const undone = {
      ...c,
      payments: Object.fromEntries(Object.entries(c.payments).filter(([k]) => k !== viewMonth)),
      paidAmounts: Object.fromEntries(Object.entries(c.paidAmounts || {}).filter(([k]) => k !== viewMonth)),
    };
    // Taking back the payment that settled a loan has to revive it, or a mistaken final payment
    // stops it for good. Only the exact stamp confirmPay wrote is cleared, so a manual stop stands.
    return c.endMonth === viewMonth && !isSettled(undone) ? { ...undone, endMonth: undefined } : undone;
  }));

  // --- Income ---
  const [iTitle, setITitle] = useState('');
  const [iAmount, setIAmount] = useState('');
  const [iRecurring, setIRecurring] = useState(true);
  const [iDay, setIDay] = useState('1');
  const addIncome = () => {
    const amount = parseFloat(iAmount);
    if (!iTitle.trim() || isNaN(amount) || amount <= 0) return;
    // Recurring only starts from the current month onward; past months are one-time only.
    const recurring = iRecurring && !isPastView;
    if (recurring) {
      const d = parseInt(iDay);
      if (isNaN(d) || d < 1 || d > 31) return; // invalid pay day
      const day = Math.min(31, Math.max(1, d));
      setIncomes(prev => [{ id: generateId(), title: iTitle.trim(), amount, recurring: true, date: `${currentMonth}-01`, startMonth: currentMonth, day }, ...prev]);
    } else {
      const date = viewMonth === currentMonth ? todayKey : `${viewMonth}-01`;
      setIncomes(prev => [{ id: generateId(), title: iTitle.trim(), amount, recurring: false, date }, ...prev]);
    }
    setITitle(''); setIAmount('');
  };
  const payDayNum = parseInt(iDay);
  const payDayInvalid = iRecurring && !isPastView && (iDay.trim() === '' || isNaN(payDayNum) || payDayNum < 1 || payDayNum > 31);
  const deleteIncome = (id: string) => setIncomes(prev => prev.filter(i => i.id !== id));
  // Safer delete: one-time asks confirm; recurring offers "stop from this month" vs "delete everywhere"
  const [delIncome, setDelIncome] = useState<Income | null>(null);
  const requestDeleteIncome = (i: Income) => {
    if (!i.recurring) {
      if (window.confirm(`Padam "${i.title}"? Ia akan dibuang dari ${monthLabel(viewMonth)}.`)) deleteIncome(i.id);
      return;
    }
    setDelIncome(i);
  };
  const stopIncomeFromMonth = () => {
    if (!delIncome) return;
    const start = delIncome.startMonth || '';
    if (start && start >= viewMonth) {
      // Starts this month or later → stopping now removes it entirely
      deleteIncome(delIncome.id);
    } else {
      const prevM = addMonth(viewMonth, -1);
      setIncomes(prev => prev.map(i => i.id === delIncome.id ? { ...i, endMonth: prevM } : i));
    }
    setDelIncome(null);
  };

  // --- Edit income (handles raises / pay-day changes; can keep past) ---
  const [editIncome, setEditIncome] = useState<Income | null>(null);
  const [ieTitle, setIeTitle] = useState('');
  const [ieAmount, setIeAmount] = useState('');
  const [ieDay, setIeDay] = useState('1');
  const ieDayNum = parseInt(ieDay);
  const ieDayInvalid = !!editIncome?.recurring && (ieDay.trim() === '' || isNaN(ieDayNum) || ieDayNum < 1 || ieDayNum > 31);
  const openIncomeEdit = (i: Income) => { setEditIncome(i); setIeTitle(i.title); setIeAmount(String(i.amount)); setIeDay(i.day ? String(i.day) : '1'); };
  const saveIncomeEdit = (scope: 'all' | 'forward') => {
    if (!editIncome) return;
    const amount = parseFloat(ieAmount);
    const title = ieTitle.trim();
    if (!title || isNaN(amount) || amount <= 0) return;
    if (editIncome.recurring && ieDayInvalid) return;
    const day = Math.min(31, Math.max(1, ieDayNum || 1));

    if (!editIncome.recurring || scope === 'all') {
      setIncomes(prev => prev.map(i => i.id === editIncome.id ? { ...i, title, amount, ...(editIncome.recurring ? { day } : {}) } : i));
    } else {
      // "From this month onward": cap the old record at the previous month, add a new one.
      const start = editIncome.startMonth || '';
      if (start && start >= viewMonth) {
        // It already starts this month or later — just update it in place.
        setIncomes(prev => prev.map(i => i.id === editIncome.id ? { ...i, title, amount, day, startMonth: viewMonth } : i));
      } else {
        const prevM = addMonth(viewMonth, -1);
        setIncomes(prev => [
          { id: generateId(), title, amount, recurring: true, date: `${viewMonth}-01`, startMonth: viewMonth, day, ...(editIncome.endMonth ? { endMonth: editIncome.endMonth } : {}) },
          ...prev.map(i => i.id === editIncome.id ? { ...i, endMonth: prevM } : i),
        ]);
      }
    }
    setEditIncome(null);
  };
  // Editing a PAST month → override that single month only (keeps the rest unchanged)
  const saveIncomeEditSingle = () => {
    if (!editIncome) return;
    const amount = parseFloat(ieAmount);
    const title = ieTitle.trim();
    if (!title || isNaN(amount) || amount <= 0) return;
    if (editIncome.recurring && ieDayInvalid) return;
    const day = Math.min(31, Math.max(1, ieDayNum || 1));
    const m = viewMonth;
    const orig = editIncome;
    const segments: Income[] = [];
    // months before m keep the original settings
    if (!orig.startMonth || orig.startMonth < m) {
      segments.push({ ...orig, id: generateId(), endMonth: addMonth(m, -1) });
    }
    // the single overridden month
    segments.push({ id: generateId(), title, amount, recurring: true, date: `${m}-01`, startMonth: m, endMonth: m, day });
    // months after m keep the original settings
    if (!orig.endMonth || orig.endMonth > m) {
      segments.push({ ...orig, id: generateId(), startMonth: addMonth(m, 1) });
    }
    setIncomes(prev => [...segments, ...prev.filter(i => i.id !== orig.id)]);
    setEditIncome(null);
  };

  // --- Transaction tab ---
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [txOffset, setTxOffset] = useState(0); // periods back from now (0 = current)
  // A year can hold thousands of rows; mounting them all is what costs, not computing them
  const TX_PAGE = 50;
  const [txLimit, setTxLimit] = useState(TX_PAGE);
  const [txQuery, setTxQuery] = useState('');
  // Tapping a category (row or wedge) pins the history to it; tapping it again lets go
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const toggleCatFilter = (cat: string) => {
    const next = catFilter === cat ? null : cat;
    setCatFilter(next);
    setTxLimit(TX_PAGE);
    // Pinning carries you to the answer; unpinning leaves you where you are, since you are
    // already reading the list and being thrown back up the page would lose your place.
    if (next) historyRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };
  // The pinned category is dropped when the window moves — it may not have been spent in the new
  // one, and an empty history under a filter you didn't set again reads as lost data.
  const changePeriod = (p: 'daily' | 'weekly' | 'monthly' | 'yearly') => { setPeriod(p); setTxOffset(0); setTxLimit(TX_PAGE); setCatFilter(null); };
  const changeOffset = (delta: number) => { setTxOffset(o => Math.max(0, o + delta)); setTxLimit(TX_PAGE); setCatFilter(null); };
  const shortDay = (d: Date) => `${d.getDate()} ${MONTHS()[d.getMonth()]}`;
  // Selected window based on period + offset
  const selDay = new Date(today); selDay.setDate(today.getDate() - txOffset);
  // Weeks run Monday–Sunday: getDay() is 0 for Sunday, which belongs to the week that started 6 days earlier
  const selWeekStart = new Date(today); selWeekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7) - txOffset * 7);
  const selWeekEnd = new Date(selWeekStart); selWeekEnd.setDate(selWeekStart.getDate() + 6);
  const selMonth = addMonth(currentMonth, -txOffset);
  const selYear = today.getFullYear() - txOffset;
  const inRange = (key: string) => {
    if (period === 'daily') return key === dateKey(selDay);
    if (period === 'weekly') return key >= dateKey(selWeekStart) && key <= dateKey(selWeekEnd);
    if (period === 'yearly') return key.slice(0, 4) === String(selYear);
    return monthOf(key) === selMonth;
  };
  // Only repeat the month and year when the week actually crosses one
  const weekLabel = selWeekStart.getMonth() === selWeekEnd.getMonth()
    ? `${selWeekStart.getDate()} – ${shortDay(selWeekEnd)} ${selWeekEnd.getFullYear()}`
    : selWeekStart.getFullYear() === selWeekEnd.getFullYear()
      ? `${shortDay(selWeekStart)} – ${shortDay(selWeekEnd)} ${selWeekEnd.getFullYear()}`
      : `${shortDay(selWeekStart)} ${selWeekStart.getFullYear()} – ${shortDay(selWeekEnd)} ${selWeekEnd.getFullYear()}`;
  const periodLabel = period === 'daily'
    ? `${txOffset === 0 ? 'Hari ini · ' : ''}${shortDay(selDay)} ${selDay.getFullYear()}`
    : period === 'weekly'
      ? weekLabel
      : period === 'yearly'
        ? String(selYear)
        : monthLabel(selMonth);
  type Txn = { id: string; date: string; label: string; amount: number; type: 'in' | 'out'; category?: string };
  const txns: Txn[] = [];
  expenses.forEach(e => { if (inRange(e.date)) txns.push({ id: 'e' + e.id, date: e.date, label: e.description, amount: e.amount, type: 'out', category: e.category }); });
  commitments.forEach(c => Object.entries(c.payments).forEach(([mk, d]) => { if (inRange(d)) txns.push({ id: 'c' + c.id + d, date: d, label: c.title, amount: paidFor(c, mk), type: 'out', category: c.category }); }));
  // Months the selected window can touch (a week can straddle two months)
  const rangeMonths = period === 'daily'
    ? [monthOf(dateKey(selDay))]
    : period === 'monthly'
      ? [selMonth]
      : period === 'yearly'
        ? Array.from({ length: 12 }, (_, i) => `${selYear}-${pad(i + 1)}`)
        : Array.from(new Set([monthOf(dateKey(selWeekStart)), monthOf(dateKey(selWeekEnd))]));
  incomes.forEach(i => {
    if (i.recurring) {
      // Emit the salary on its real pay date for each month in range (if active & not future)
      rangeMonths.forEach(mk => {
        if (!incomeActive(i, mk)) return;
        const payKey = `${mk}-${pad(Math.min(i.day || 1, daysInMonth(mk)))}`;
        if (payKey <= todayKey && inRange(payKey)) txns.push({ id: 'i' + i.id + mk, date: payKey, label: i.title, amount: i.amount, type: 'in' });
      });
    } else if (i.date <= todayKey && inRange(i.date)) {
      txns.push({ id: 'i' + i.id, date: i.date, label: i.title, amount: i.amount, type: 'in' });
    }
  });
  txns.sort((a, b) => b.date.localeCompare(a.date));
  // Search and the category tap both narrow the history only — the figures above stay the truth
  // about the period, so tapping a slice never makes the donut redraw itself around one wedge.
  const txq = txQuery.trim().toLowerCase();
  const foundTxns = txns.filter(t => {
    // A category holds spending, so filtering by one drops income rather than showing it uncategorised
    if (catFilter && (t.type !== 'out' || (t.category || 'other') !== catFilter)) return false;
    if (txq && !t.label.toLowerCase().includes(txq) && !catLabel(t.category || 'other', allOptions).toLowerCase().includes(txq)) return false;
    return true;
  });
  // Day totals in one pass — a filter per day is quadratic and a year of records feels it
  const dayNet: Record<string, number> = {};
  foundTxns.forEach(t => { dayNet[t.date] = (dayNet[t.date] || 0) + (t.type === 'in' ? t.amount : -t.amount); });
  const txIn = txns.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const txOut = txns.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const spendByCat: Record<string, number> = {};
  txns.filter(t => t.type === 'out').forEach(t => { const k = t.category || 'other'; spendByCat[k] = (spendByCat[k] || 0) + t.amount; });
  const catRows = Object.entries(spendByCat).sort((a, b) => b[1] - a[1]);

  // These are never three loose numbers — they are one ratio. Komitmen is paid-of-owed, Pendapatan
  // is received-of-due, Tabung is saved-of-target. The meter carries the relationship and the
  // columns annotate its two ends, so they anchor left and right instead of sitting in a row of
  // boxes. It also survives masking: a percentage gives away nothing worth hiding, so the bar
  // still answers "how far along am I" with the ringgit figures face-down.
  const totalsBar = (cols: { label: string; value: number; tone: string }[], done: number, of: number) => {
    const pct = of > 0 ? (done / of) * 100 : 0;
    return (
      <div className="bg-text/5 rounded-xl p-3 space-y-2.5">
        <div className="flex items-center gap-2.5">
          {/* The track is the whole of it; the fill is the part settled so far */}
          <div className="flex-1 h-1.5 rounded-full bg-amber-400/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400 light:bg-emerald-500 motion-safe:transition-[width] duration-500 ease-out"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <span className="text-[10px] font-mono font-bold text-muted shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(pct)}%</span>
        </div>
        <div className="flex items-baseline gap-2">
          {cols.map((c, i) => (
            <div key={c.label} className={`flex-1 min-w-0 ${i === 0 ? 'text-left' : i === cols.length - 1 ? 'text-right' : 'text-center'}`}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted leading-tight truncate">{c.label}</p>
              {/* Never truncated — a clipped "RM 12,3…" reads as a smaller number than it is */}
              <p className={`font-mono text-[13px] font-black mt-1 leading-none ${hideBalance ? 'text-muted' : c.tone}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{masked(c.value)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };
  const TONE_NEUTRAL = 'text-text';
  const TONE_GOOD = 'text-emerald-400 light:text-emerald-600';
  const TONE_LEFT = 'text-amber-400 light:text-amber-600';

  const accent = 'rgb(16 185 129)'; // emerald base for this tool

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center space-x-3 px-1">
        <div className="p-3 bg-emerald-500/20 rounded-xl"><Wallet className="text-emerald-400" size={26} /></div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-text/90">Expense Manager</h1>
          <p className="text-[10px] text-muted uppercase tracking-wider">{tr('Pendapatan · Komitmen · Perbelanjaan', 'Income · Commitments · Spending')}</p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          aria-label={tr('Tetapan', 'Settings')}
          className="ml-auto p-2 rounded-lg text-muted hover:text-text hover:bg-text/5 shrink-0"
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-5 gap-1 p-1 bg-text/5 rounded-xl">
        {([['dashboard', tr('Utama', 'Overview'), PieChart], ['commitment', tr('Komitmen', 'Commitments'), CreditCard], ['income', tr('Pendapatan', 'Income'), Coins], ['savings', tr('Tabung', 'Savings'), PiggyBank], ['transaction', tr('Transaksi', 'Transactions'), ListChecks]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`py-2 text-[10px] font-bold rounded-lg transition-all flex flex-col items-center gap-1 ${tab === key ? 'bg-surface text-emerald-400 light:text-emerald-600 shadow-sm' : 'text-muted hover:text-text'}`}>
            <Icon size={16} /> <span className="truncate max-w-full px-0.5">{label}</span>
          </button>
        ))}
      </div>

      {/* Month navigation (dashboard / income) */}
      {(tab === 'dashboard' || tab === 'income') && (
        <div className="flex items-center justify-between px-1">
          <button onClick={() => setViewMonth(m => addMonth(m, -1))} className="p-1.5 rounded-lg bg-text/5 text-muted hover:text-text"><ChevronLeft size={18} /></button>
          <span className="text-sm font-bold text-text/90">{monthLabel(viewMonth)}</span>
          <button onClick={() => setViewMonth(m => (m >= currentMonth ? m : addMonth(m, 1)))} disabled={viewMonth >= currentMonth} className="p-1.5 rounded-lg bg-text/5 text-muted hover:text-text disabled:opacity-30"><ChevronRight size={18} /></button>
        </div>
      )}

      {/* DASHBOARD */}
      {tab === 'dashboard' && (
        <div className="space-y-4">
          {/* Baki — a card you can flip face-down with a tap */}
          <button
            type="button"
            onClick={toggleBalance}
            aria-pressed={hideBalance}
            aria-label={hideBalance ? tr('Tunjuk baki', 'Show balance') : tr('Sembunyi baki', 'Hide balance')}
            className="relative w-full text-left rounded-2xl p-5 overflow-hidden shadow-xl transition-transform active:scale-[0.985] bg-gradient-to-br from-emerald-600 via-emerald-800 to-slate-900"
          >
            {/* Light catching the plastic */}
            <div className="absolute -top-16 -right-12 w-52 h-52 rounded-full bg-[#ffffff]/10 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-16 w-60 h-60 rounded-full bg-emerald-300/10 blur-2xl pointer-events-none" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffffff]/75">{tr('Baki', 'Balance')}</p>
                <p className="text-[11px] text-[#ffffff]/60 mt-0.5">{monthLabel(viewMonth)}</p>
              </div>
              {hideBalance ? <EyeOff size={16} className="text-[#ffffff]/75" /> : <Eye size={16} className="text-[#ffffff]/75" />}
            </div>

            <div className="relative mt-5 flex items-center gap-3">
              {/* Chip */}
              <div className="w-9 h-7 rounded-md shrink-0 bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500/80 shadow-inner grid grid-rows-3 gap-[3px] p-[3px]">
                <span className="bg-amber-700/25 rounded-[1px]" />
                <span className="bg-amber-700/25 rounded-[1px]" />
                <span className="bg-amber-700/25 rounded-[1px]" />
              </div>
              <p className={`text-3xl font-black font-mono tracking-tight ${hideBalance ? 'text-[#ffffff]/80' : balance < 0 ? 'text-rose-300' : 'text-[#ffffff]'}`}>
                {hideBalance ? 'RM ••••••' : `RM ${fmt(balance)}`}
              </p>
            </div>

            <div className="relative mt-4 flex items-end justify-between gap-3">
              <p className={`text-[10px] min-w-0 truncate ${!hideBalance && pendingIncome > 0 ? 'text-amber-200' : 'text-[#ffffff]/65'}`}>
                {!hideBalance && pendingIncome > 0 ? tr(`+RM ${fmt(pendingIncome)} pendapatan belum diterima`, `+RM ${fmt(pendingIncome)} income not yet received`) : ''}
              </p>
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#ffffff]/45 shrink-0">SenangKit</span>
            </div>
          </button>

          {/* Statement strip — one panel, three columns, reads as the card's back */}
          <StatStrip items={[
            { label: tr('Pendapatan', 'Income'), value: masked(totalIncome), Icon: TrendingUp, tone: hideBalance ? 'text-muted' : 'text-emerald-400 light:text-emerald-600', pct: totalIncome > 0 ? '100%' : '—' },
            { label: tr('Komitmen Dibayar', 'Commitments Paid'), value: masked(paidCommitment), Icon: CreditCard, tone: hideBalance ? 'text-muted' : 'text-amber-400 light:text-amber-600', pct: shareOf(paidCommitment, totalIncome) },
            { label: tr('Perbelanjaan', 'Spending'), value: masked(totalExpenses), Icon: TrendingDown, tone: hideBalance ? 'text-muted' : 'text-rose-400 light:text-rose-600', pct: shareOf(totalExpenses, totalIncome) },
          ]} segments={totalIncome > 0 ? [
            { pct: (paidCommitment / totalIncome) * 100, color: SEG_COMMIT },
            { pct: (totalExpenses / totalIncome) * 100, color: SEG_SPEND },
          ] : undefined} />

          {/* Commitment checklist */}
          <div className="glass-panel p-4 space-y-2">
            <h3 className="font-bold text-sm flex items-center gap-2 mb-1"><CreditCard size={16} className="text-amber-400" /> {tr('Komitmen', 'Commitments')}</h3>
            
            <div className="mb-3">{totalsBar([
              { label: tr('Jumlah', 'Total'), value: totalCommitment, tone: TONE_NEUTRAL },
              { label: tr('Dibayar', 'Paid'), value: paidCommitment, tone: TONE_GOOD },
              { label: tr('Baki', 'Left'), value: totalCommitment - paidCommitment, tone: TONE_LEFT },
            ], paidCommitment, totalCommitment)}</div>

            {monthCommitments.length > 4 && (
              <SearchBox value={commitQuery} onChange={setCommitQuery} placeholder={tr('Cari komitmen', 'Search commitments')} />
            )}

            {shownCommitments.length === 0 ? (
              <p className="text-xs text-muted text-center py-3">
                {commitQuery.trim()
                  ? tr(`Tiada padanan untuk "${commitQuery.trim()}".`, `No match for "${commitQuery.trim()}".`)
                  : tr('Belum ada komitmen.', 'No commitments yet.')}
              </p>
            ) : shownCommitments.map(c => {
              const paid = !!c.payments[viewMonth];
              const color = catColor(c.category, commitOptions);
              const Icon = catIcon(c.category, commitOptions);
              return (
                <div key={c.id} className="flex items-center gap-2.5 py-1">
                  <button onClick={() => paid ? undoPay(c.id) : openPay(c)} aria-label={paid ? tr('Buat asal', 'Undo') : tr('Tanda dibayar', 'Mark paid')} className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${paid ? 'bg-emerald-500 border-emerald-500 text-[#ffffff]' : 'border-text/30 text-transparent'}`}><Check size={14} strokeWidth={3} /></button>
                  <span className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: `${color}1f`, color }}>
                    <Icon size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${paid ? 'line-through text-text/50' : 'text-text/90'}`}>{c.title}</p>
                    <p className="text-[10px] text-muted truncate">{tr('Hari', 'Day')} {c.paymentDay} · {catLabel(c.category, commitOptions)}{paid ? tr(` · dibayar ${fmtDate(c.payments[viewMonth])}`, ` · paid ${fmtDate(c.payments[viewMonth])}`) : ''}</p>
                  </div>
                  <span className={`font-mono text-sm font-bold shrink-0 ${paid ? 'text-text/50' : 'text-amber-400 light:text-amber-600'}`}>RM {fmt(paid ? paidFor(c, viewMonth) : scheduledFor(c, viewMonth))}</span>
                </div>
              );
            })}
          </div>

          {/* Today's expenses (current month) or all of the viewed month */}
          <div className="glass-panel p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm flex items-center gap-2"><CalendarDays size={16} className="text-red-400" /> {isPastView || expScope === 'month' ? tr(`Perbelanjaan ${monthLabel(viewMonth)}`, `Spending in ${monthLabel(viewMonth)}`) : tr('Perbelanjaan Hari Ini', "Today's Spending")}</h3>
              {!isPastView && (
                <div className="flex p-0.5 bg-text/5 rounded-lg text-[10px] font-bold shrink-0">
                  <button onClick={() => setExpScope('today')} className={`px-2 py-0.5 rounded ${expScope === 'today' ? 'bg-surface text-red-400 shadow-sm' : 'text-muted'}`}>{tr('Hari ini', 'Today')}</button>
                  <button onClick={() => setExpScope('month')} className={`px-2 py-0.5 rounded ${expScope === 'month' ? 'bg-surface text-red-400 shadow-sm' : 'text-muted'}`}>{tr('Bulan', 'Month')}</button>
                </div>
              )}
            </div>
            {(() => {
              const showMonth = isPastView || expScope === 'month';
              const list = showMonth ? [...monthExpenses].sort((a, b) => b.date.localeCompare(a.date)) : todayExpenses;
              const sq = spendQuery.trim().toLowerCase();
              const shown = sq
                ? list.filter(e => e.description.toLowerCase().includes(sq) || catLabel(e.category, expenseOptions).toLowerCase().includes(sq))
                : list;
              return (
                <>
                  {list.length > 4 && (
                    <SearchBox value={spendQuery} onChange={setSpendQuery} placeholder={tr('Cari perbelanjaan', 'Search spending')} />
                  )}
                  {shown.length === 0 ? (
                    <p className="text-xs text-muted text-center py-3">
                      {sq
                        ? tr(`Tiada padanan untuk "${spendQuery.trim()}".`, `No match for "${spendQuery.trim()}".`)
                        : showMonth ? tr('Tiada perbelanjaan bulan ini.', 'No spending this month.') : tr('Tiada perbelanjaan hari ini.', 'No spending today.')}
                    </p>
                  ) : shown.map(e => {
                    const color = catColor(e.category, expenseOptions);
                    const Icon = catIcon(e.category, expenseOptions);
                    return (
                      <div key={e.id} className="flex items-center gap-2.5 py-1">
                        <span className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: `${color}1f`, color }}>
                          <Icon size={15} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-text/90">{e.description}</p>
                          <p className="text-[10px] text-muted truncate">{catLabel(e.category, expenseOptions)}{showMonth ? ` · ${fmtDate(e.date)}` : ''}</p>
                        </div>
                        <span className="font-mono text-sm font-bold text-rose-400 light:text-rose-600 shrink-0">−RM {fmt(e.amount)}</span>
                        <button onClick={() => openExpense(e)} aria-label={tr('Sunting perbelanjaan', 'Edit expense')} className="text-muted opacity-60 hover:opacity-100 hover:text-text p-1 shrink-0"><Pencil size={13} /></button>
                        <button onClick={() => deleteExpense(e)} aria-label={tr('Padam perbelanjaan', 'Delete expense')} className="text-rose-400 opacity-50 hover:opacity-100 p-1 shrink-0"><Trash2 size={13} /></button>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>

          {/* Month Comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-panel p-4">
              <h3 className="font-bold text-xs mb-2 text-muted uppercase tracking-wider">{monthLabel(prevMonth)}</h3>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between"><span className="text-text/50">{tr('Masuk', 'In')}</span><span className="text-emerald-400">+RM{fmt(prevIncome)}</span></div>
                <div className="flex justify-between"><span className="text-text/50">{tr('Keluar', 'Out')}</span><span className="text-red-400">-RM{fmt(prevExpense + prevPaid)}</span></div>
                <div className="flex justify-between pt-1 border-t border-text/10 mt-1">
                  <span className="text-text/80 font-bold">{tr('Bersih', 'Net')}</span>
                  <span className={prevNet < 0 ? 'text-red-400 font-bold' : 'text-text/90 font-bold'}>{prevNet < 0 ? '-' : ''}RM{fmt(Math.abs(prevNet))}</span>
                </div>
              </div>
            </div>
            
            <div className="glass-panel p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500/50" />
              <h3 className="font-bold text-xs mb-2 text-emerald-400 uppercase tracking-wider">{monthLabel(viewMonth)}</h3>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between"><span className="text-text/50">{tr('Masuk', 'In')}</span><span className="text-emerald-400">+RM{fmt(receivedIncome)}</span></div>
                <div className="flex justify-between"><span className="text-text/50">{tr('Keluar', 'Out')}</span><span className="text-red-400">-RM{fmt(totalExpenses + paidCommitment)}</span></div>
                <div className="flex justify-between pt-1 border-t border-text/10 mt-1">
                  <span className="text-text/80 font-bold">{tr('Bersih', 'Net')}</span>
                  <span className={balance < 0 ? 'text-red-400 font-bold' : 'text-text/90 font-bold'}>{balance < 0 ? '-' : ''}RM{fmt(Math.abs(balance))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 6-month net trend — what was left over each month, and how that is trending */}
          {(() => {
            const H = 84;                                     // plot height in px
            // Where zero actually falls. With nothing recorded at all, put it on the floor so the
            // stub bars rest on the baseline rather than hanging off the top of the plot.
            const zeroTop = netHi === 0 && netLo === 0 ? H : (netHi / netSpan) * H;
            const avgTop = ((netHi - netAvg) / netSpan) * H;
            // A number on every bar is noise. Only the extremes and the month you are looking at
            // get one — those are the three a person actually reads off a six-bar chart.
            const labelled = new Set([netBest.mk, netWorst.mk, viewMonth]);
            return (
              <div className="glass-panel p-4 space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-400 light:text-emerald-600" /> {tr('Trend Bersih 6 Bulan', '6-Month Net Trend')}
                  </h3>
                  <span className="text-[10px] text-muted shrink-0">{tr(`${netUp}/6 bulan lebih`, `${netUp}/6 months up`)}</span>
                </div>

                <p className="text-[11px] text-muted">
                  {tr('Purata', 'Average')}{' '}
                  <span className={`font-mono font-bold ${hideBalance ? 'text-muted' : netAvg < 0 ? 'text-rose-400 light:text-rose-600' : 'text-emerald-400 light:text-emerald-600'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {netAvg < 0 && !hideBalance ? '−' : ''}{masked(Math.abs(netAvg))}
                  </span>{' '}
                  {tr('sebulan', 'a month')}
                </p>

                <div className="relative" style={{ height: H }}>
                  {/* Average reference, so each bar reads against the run rather than in isolation */}
                  <div className="absolute left-0 right-0 border-t border-dashed border-text/25 pointer-events-none z-10" style={{ top: avgTop }} />
                  {/* Zero */}
                  <div className="absolute left-0 right-0 border-t border-text/20 pointer-events-none" style={{ top: zeroTop }} />

                  <div className="absolute inset-0 flex gap-1.5">
                    {netTrend.map(d => {
                      const h = Math.max(2, Math.round((Math.abs(d.net) / netSpan) * H));
                      const up = d.net >= 0;
                      const isView = d.mk === viewMonth;
                      return (
                        <button
                          key={d.mk}
                          onClick={() => setViewMonth(d.mk)}
                          title={`${monthLabel(d.mk)}: RM ${fmt(d.net)}`}
                          aria-label={`${monthLabel(d.mk)}: RM ${fmt(d.net)}`}
                          className="relative flex-1 min-w-0 group"
                        >
                          <span
                            className={`absolute left-1/2 -translate-x-1/2 w-3/5 transition-all ${up ? 'rounded-t' : 'rounded-b'} ${
                              isView
                                ? (up ? 'bg-emerald-500' : 'bg-rose-500')
                                : (up ? 'bg-emerald-400/70 light:bg-emerald-600/60' : 'bg-rose-400/70 light:bg-rose-600/60')
                            } group-hover:opacity-100 opacity-90`}
                            style={up ? { bottom: H - zeroTop, height: h } : { top: zeroTop, height: h }}
                          />
                          {labelled.has(d.mk) && !hideBalance && (
                            <span
                              className={`absolute left-1/2 -translate-x-1/2 text-[8px] font-mono whitespace-nowrap ${isView ? 'text-text font-bold' : 'text-muted'}`}
                              style={up ? { bottom: H - zeroTop + h + 1 } : { top: zeroTop + h + 1 }}
                            >
                              {compact(d.net)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {netTrend.map(d => (
                    <span key={d.mk} className={`flex-1 text-center text-[9px] truncate ${d.mk === viewMonth ? 'text-emerald-400 light:text-emerald-600 font-bold' : 'text-muted'}`}>
                      {MONTHS()[parseInt(d.mk.slice(5, 7)) - 1].slice(0, 3)}
                    </span>
                  ))}
                </div>

                <p className="text-[10px] text-muted">{tr('Ketuk bulan untuk lihat butirannya.', 'Tap a month to open it.')}</p>
              </div>
            );
          })()}
        </div>
      )}

      {/* COMMITMENT */}
      {tab === 'commitment' && (() => {
        // Due order, not the order they happened to be typed in — this tab is a bill calendar.
        const q = commitTabQuery.trim().toLowerCase();
        const sorted = [...activeCommitments].sort((a, b) => a.paymentDay - b.paymentDay);
        const shown = q
          ? sorted.filter(c => c.title.toLowerCase().includes(q) || catLabel(c.category, commitOptions).toLowerCase().includes(q))
          : sorted;
        // The list shows everything still running; the figures describe only what this month owes,
        // so one that has not started yet is listed but not counted.
        const due = sorted.filter(c => commitActive(c, viewMonth));
        const paidCount = due.filter(c => c.payments[viewMonth]).length;
        // Paid ones count what they actually cost, the rest what they are scheduled to — the
        // dashboard's convention, so Baki here is what is genuinely still owed this month.
        const tabTotal = due.reduce((s, c) => s + (c.payments[viewMonth] ? paidFor(c, viewMonth) : scheduledFor(c, viewMonth)), 0);
        const tabPaid = due.filter(c => c.payments[viewMonth]).reduce((s, c) => s + paidFor(c, viewMonth), 0);
        return (
          <div className="space-y-3">
            <button onClick={() => openCForm()} className="w-full py-3 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-emerald-500/50 hover:text-emerald-400 transition-all flex items-center justify-center"><Plus size={18} className="mr-2" /> {tr('Tambah Komitmen', 'Add a Commitment')}</button>

            {sorted.length > 0 && (
              <div className="space-y-1.5">
                {/* This tab carries no month picker, so the figures have to name their month */}
                <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-muted">
                  <span>{tr(`${due.length} komitmen · ${paidCount} dibayar`, `${due.length} commitments · ${paidCount} paid`)}</span>
                  <span className="font-bold">{monthLabel(viewMonth)}</span>
                </div>
                {totalsBar([
                  { label: tr('Jumlah', 'Total'), value: tabTotal, tone: TONE_NEUTRAL },
                  { label: tr('Dibayar', 'Paid'), value: tabPaid, tone: TONE_GOOD },
                  { label: tr('Baki', 'Left'), value: tabTotal - tabPaid, tone: TONE_LEFT },
                ], tabPaid, tabTotal)}
              </div>
            )}

            {sorted.length > 4 && (
              <SearchBox value={commitTabQuery} onChange={setCommitTabQuery} placeholder={tr('Cari komitmen', 'Search commitments')} />
            )}

            {shown.length === 0 && (
              <p className="text-xs text-muted text-center py-6">
                {q ? tr(`Tiada padanan untuk "${commitTabQuery.trim()}".`, `No match for "${commitTabQuery.trim()}".`) : tr('Belum ada komitmen.', 'No commitments yet.')}
              </p>
            )}

            {shown.map(c => {
              const paid = !!c.payments[viewMonth];
              const color = catColor(c.category, commitOptions);
              const Icon = catIcon(c.category, commitOptions);
              const goal = c.goalId ? goals.find(g => g.id === c.goalId) : undefined;
              // Listed but not yet owed — say so, or it looks like it dropped out of the figures
              const notYet = !!c.startMonth && viewMonth < c.startMonth && !paid;
              // Only meaningful while looking at the month you are actually living in
              const dueIn = viewMonth === currentMonth ? Math.min(c.paymentDay, daysInMonth(currentMonth)) - today.getDate() : null;
              const late = !paid && !notYet && dueIn !== null && dueIn < 0;
              const soon = !paid && !notYet && dueIn !== null && dueIn >= 0 && dueIn <= 7;
              return (
                <div key={c.id} className="glass-panel p-4 space-y-2.5">
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{ backgroundColor: `${color}1f`, color }}>
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold truncate ${paid ? 'text-text/60' : 'text-text/90'}`}>{c.title}</p>
                      <p className="text-[11px] text-muted truncate">
                        {tr('Hari', 'Day')} {c.paymentDay} · {catLabel(c.category, commitOptions)}
                        {/* The link is only editable from the fund, so name it here to make it findable */}
                        {goal && <span className="text-emerald-400 light:text-emerald-600"> · {tr('masuk', 'feeds')} {goal.name}</span>}
                      </p>
                      {notYet && (
                        <p className="text-[10px] font-bold mt-0.5 text-muted">
                          {tr(`Bermula ${monthLabel(c.startMonth!)}`, `Starts ${monthLabel(c.startMonth!)}`)}
                        </p>
                      )}
                      {!paid && (late || soon) && (
                        <p className={`text-[10px] font-bold mt-0.5 ${late ? 'text-rose-400 light:text-rose-600' : 'text-amber-400 light:text-amber-600'}`}>
                          {late
                            ? tr(`Lewat ${Math.abs(dueIn!)} hari`, `${Math.abs(dueIn!)} days late`)
                            : dueIn === 0 ? tr('Kena bayar hari ini', 'Due today') : tr(`${dueIn} hari lagi`, `Due in ${dueIn} days`)}
                        </p>
                      )}
                    </div>
                    <span className={`font-mono font-bold shrink-0 ${paid ? 'text-text/50' : 'text-amber-400 light:text-amber-600'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      RM {fmt(scheduledFor(c, viewMonth))}
                    </span>
                  </div>

                  {/* A loan knows where it finishes, so show how far along it is. Same bar as a
                      savings goal, read the other way round: what is owed, not what is aimed at. */}
                  {c.payoffTotal != null && (
                    <GoalBar saved={commitmentPaidTotal(c)} target={c.payoffTotal} label={tr('Jumlah', 'Total')} doneLabel={tr('Selesai!', 'Settled!')} />
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {paid ? (
                      <>
                        <span className="text-xs text-emerald-400 light:text-emerald-600 font-bold flex items-center gap-1"><Check size={14} /> {tr('Dibayar', 'Paid')} {fmtDate(c.payments[viewMonth])}{paidFor(c, viewMonth) !== scheduledFor(c, viewMonth) ? ` · RM ${fmt(paidFor(c, viewMonth))}` : ''}</span>
                        <button onClick={() => undoPay(c.id)} className="text-xs px-2 py-1 rounded-lg bg-text/5 text-muted hover:text-text flex items-center gap-1"><RotateCcw size={12} /> {tr('Buat asal', 'Undo')}</button>
                      </>
                    ) : (
                      <button onClick={() => openPay(c)} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 light:text-emerald-700 border border-emerald-500/30 font-bold flex items-center gap-1"><Check size={13} /> {tr('Tanda dibayar', 'Mark as paid')}</button>
                    )}
                    <button onClick={() => openCForm(c)} aria-label={tr('Sunting', 'Edit')} className="text-xs px-2 py-1 rounded-lg bg-text/5 text-muted hover:text-text flex items-center gap-1 ml-auto"><Pencil size={12} /> {tr('Sunting', 'Edit')}</button>
                    <button onClick={() => setDelCommit(c)} aria-label={tr('Berhentikan', 'Stop')} className="text-xs px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400"><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* INCOME */}
      {tab === 'income' && (
        <div className="space-y-3">
          <div className="glass-panel p-4 space-y-3">
            <input value={iTitle} onChange={e => setITitle(e.target.value)} placeholder={tr('Tajuk pendapatan (cth. Gaji)', 'Income title (e.g. Salary, Freelance)')} className="input-field w-full" />
            <div className="flex gap-2">
              <input type="number" value={iAmount} onChange={e => setIAmount(e.target.value)} placeholder={tr('Jumlah', 'Amount')} className="input-field flex-1 font-mono" />
              <button
                onClick={() => !isPastView && setIRecurring(r => !r)}
                disabled={isPastView}
                className={`px-3 rounded-xl text-xs font-bold border ${iRecurring && !isPastView ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-text/5 text-muted border-text/10'} ${isPastView ? 'opacity-50' : ''}`}
              >
                {iRecurring && !isPastView ? tr('🔁 Berulang', '🔁 Recurring') : tr('Sekali sahaja', 'One-off')}
              </button>
            </div>
            {iRecurring && !isPastView && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-muted">{tr('Hari gaji', 'Pay day')}</label>
                  <input type="number" min={1} max={31} value={iDay} onChange={e => setIDay(e.target.value)} className={`input-field w-16 font-mono py-1.5 text-center ${payDayInvalid ? 'border-red-500/60 focus:ring-red-500/40' : ''}`} />
                  <span className="text-[10px] text-muted">{tr('Dikira dalam baki dari hari ini setiap bulan', 'Counted in the balance from this day each month')}</span>
                </div>
                {payDayInvalid && <p className="text-[10px] text-red-400">{tr('Hari gaji mesti antara 1 hingga 31.', 'Pay day must be between 1 and 31.')}</p>}
              </div>
            )}
            {isPastView && <p className="text-[10px] text-amber-400">{tr(`Bulan lepas — akan disimpan sebagai pendapatan sekali sahaja untuk ${monthLabel(viewMonth)}.`, `A past month — this will be saved as one-off income for ${monthLabel(viewMonth)}.`)}</p>}
            <button onClick={addIncome} disabled={payDayInvalid} className="w-full py-2.5 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 disabled:opacity-40 disabled:pointer-events-none">{tr('Tambah Pendapatan', 'Add Income')}</button>
          </div>

          {monthIncomes.length > 0 && totalsBar([
            { label: tr('Jumlah', 'Total'), value: totalIncome, tone: TONE_NEUTRAL },
            { label: tr('Diterima', 'Received'), value: receivedIncome, tone: TONE_GOOD },
            { label: tr('Belum', 'Pending'), value: pendingIncome, tone: TONE_LEFT },
          ], receivedIncome, totalIncome)}

          <div className="glass-panel p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-sm">{monthLabel(viewMonth)}</h3>
            </div>
            {monthIncomes.length === 0 ? (
              <p className="text-xs text-muted text-center py-3">{tr('Tiada pendapatan bulan ini.', 'No income this month.')}</p>
            ) : monthIncomes.map(i => {
              const received = incomeReceived(i, viewMonth);
              return (
              <div key={i.id} className="flex items-center gap-3 py-1.5 border-t border-white/5 first:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-text/90">{i.title}</p>
                  {i.recurring && <p className="text-[10px] text-emerald-400">{tr('🔁 Berulang', '🔁 Recurring')}{i.day ? tr(` · hari ${i.day}`, ` · day ${i.day}`) : ''}{i.startMonth ? tr(` · dari ${monthLabel(i.startMonth)}`, ` · from ${monthLabel(i.startMonth)}`) : ''}</p>}
                  {!received && <p className="text-[10px] text-amber-400">{tr('Belum diterima', 'Not yet received')}</p>}
                </div>
                <span className={`font-mono text-sm font-bold ${received ? 'text-emerald-400' : 'text-amber-400/70'}`}>+RM{fmt(i.amount)}</span>
                <button onClick={() => openIncomeEdit(i)} className="text-muted hover:text-text p-1"><Pencil size={13} /></button>
                <button onClick={() => requestDeleteIncome(i)} className="text-rose-400 opacity-50 hover:opacity-100 p-1"><Trash2 size={13} /></button>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TRANSACTION */}
      {/* SAVINGS — a tally of money that already left through a commitment or expense, plus top-ups */}
      {tab === 'savings' && (
        <div className="space-y-3">
          <button onClick={() => openGForm()} className="w-full py-3 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-emerald-500/50 hover:text-emerald-400 transition-all flex items-center justify-center">
            <Plus size={18} className="mr-2" /> {tr('Tambah Tabung', 'Add a fund')}
          </button>

          {goals.length > 0 && totalsBar([
            { label: tr('Terkumpul', 'Saved'), value: allSaved, tone: TONE_GOOD },
            { label: tr('Sasaran', 'Target'), value: allTarget, tone: TONE_NEUTRAL },
          ], allSaved, allTarget)}

          {goals.length === 0 ? (
            <p className="text-xs text-muted text-center py-6 leading-relaxed">
              {tr('Belum ada tabung. Buat satu, kemudian tandakan komitmen mana yang masuk ke dalamnya.',
                'No funds yet. Make one, then tick which commitments feed it.')}
            </p>
          ) : goals.map(g => {
            const saved = savedFor(g.id);
            const feeders = commitments.filter(c => c.goalId === g.id);
            const done = saved >= g.target;
            // The padding sits on the content, not the card, so the photo reaches the edge
            // without negative margins pulling it past one.
            return (
              <button key={g.id} onClick={() => { setOpenGoal(g.id); setShowSources(!commitments.some(c => c.goalId === g.id)); }} className="w-full text-left glass-panel hover:border-emerald-500/30 transition-colors overflow-hidden relative block">
                <div className="flex items-stretch">
                  {/* Below 360px the photo is dropped and the content takes the width back */}
                  <div className={`min-w-0 flex-1 space-y-2.5 p-4 ${g.photo ? 'pr-[76px] max-[360px]:pr-4' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-text/90 truncate flex items-center gap-1.5">
                          {done && <Check size={14} className="text-emerald-400 light:text-emerald-600 shrink-0" />}{g.name}
                        </p>
                        <p className="text-[10px] text-muted truncate">
                          {feeders.length > 0
                            ? tr(`${feeders.length} komitmen`, `${feeders.length} commitments`)
                            : tr('Belum dipautkan', 'Nothing linked yet')}
                          {g.deadline ? ` · ${fmtLongDate(g.deadline)}` : ''}
                        </p>
                      </div>
                      {!g.photo && <ChevronRight size={16} className="text-muted shrink-0 mt-0.5" />}
                    </div>

                    <GoalBar saved={saved} target={g.target} />
                  </div>

                  {/* Out of flow: as a flex child it could size itself from the image's own
                      dimensions and drag the card past its column. */}
                  {g.photo && (
                    <img
                      src={g.photo}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{ objectPosition: g.photoPos ?? '50% 50%' }}
                      className="absolute inset-y-0 right-0 w-16 h-full object-cover max-[360px]:hidden"
                    />
                  )}
                </div>
              </button>
            );
          })}

          {goals.length > 0 && (
            <p className="text-[10px] text-muted leading-relaxed px-1">
              {tr('Tabung hanya mengira — duit komitmen dan perbelanjaan yang dipautkan sudah pun ditolak dari baki. Tambah nilai tidak mengubah baki.',
                'A fund only counts. Money from linked commitments and expenses has already left your balance, and a top-up changes nothing else.')}
            </p>
          )}
        </div>
      )}

      {tab === 'transaction' && (
        <div className="space-y-4">
          <div className="flex p-1 bg-text/5 rounded-xl">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
              <button key={p} onClick={() => changePeriod(p)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${period === p ? 'bg-surface text-emerald-400 shadow-sm' : 'text-muted hover:text-text'}`}>{PERIOD_LABELS()[p]}</button>
            ))}
          </div>

          <div className="flex items-center justify-between px-1">
            <button onClick={() => changeOffset(1)} className="p-1.5 rounded-lg bg-text/5 text-muted hover:text-text"><ChevronLeft size={18} /></button>
            <span className="text-sm font-bold text-text/90">{periodLabel}</span>
            <button onClick={() => changeOffset(-1)} disabled={txOffset === 0} className="p-1.5 rounded-lg bg-text/5 text-muted hover:text-text disabled:opacity-30"><ChevronRight size={18} /></button>
          </div>

          <StatStrip items={[
            { label: tr('Masuk', 'In'), value: `RM ${fmt(txIn)}`, Icon: TrendingUp, tone: 'text-emerald-400 light:text-emerald-600', pct: txIn > 0 ? '100%' : '—' },
            { label: tr('Keluar', 'Out'), value: `RM ${fmt(txOut)}`, Icon: TrendingDown, tone: 'text-rose-400 light:text-rose-600', pct: shareOf(txOut, txIn) },
            { label: tr('Bersih', 'Net'), value: `RM ${fmt(txIn - txOut)}`, Icon: Wallet, tone: txIn - txOut < 0 ? 'text-rose-400 light:text-rose-600' : 'text-text', pct: shareOf(txIn - txOut, txIn) },
          ]} segments={txIn > 0 ? [{ pct: (txOut / txIn) * 100, color: SEG_SPEND }] : undefined} />

          {/* Spending by category */}
          <div className="glass-panel p-4 space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2"><PieChart size={16} className="text-emerald-400 light:text-emerald-600" /> {tr('Perbelanjaan Ikut Kategori', 'Spending by Category')}</h3>
            {catRows.length === 0 ? (
              <p className="text-xs text-muted text-center py-3">{tr(`Tiada perbelanjaan dalam ${periodLabel.toLowerCase()}.`, `No spending in ${periodLabel.toLowerCase()}.`)}</p>
            ) : null}

            {catRows.length > 0 && (() => {
              // Part-to-whole at a glance, and only that: six wedges is the readable ceiling, so
              // the tail is grouped. Close values are compared on the rows underneath, which carry
              // the exact ringgit — a ring is the wrong instrument for reading two similar slices.
              const top = catRows.slice(0, DONUT_MAX);
              const rest = catRows.slice(DONUT_MAX);
              const restTotal = rest.reduce((s, [, amt]) => s + amt, 0);
              const wedges = [
                ...top.map(([cat, amt]) => ({ key: cat, label: catLabel(cat, allOptions), amt, color: catColor(cat, allOptions) })),
                ...(restTotal > 0 ? [{ key: '__rest', label: tr(`${rest.length} kategori lain`, `${rest.length} more categories`), amt: restTotal, color: REST_COLOR }] : []),
              ];
              // A lone wedge is a closed ring; a gap in it would read as a missing slice
              const gap = wedges.length > 1 ? DONUT_GAP : 0;
              let start = 0;
              return (
                <div className="flex justify-center py-1">
                  {/* 160px keeps a 13-character yearly total clear of the ring's inner edge */}
                  <div className="relative w-[160px] h-[160px]">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" role="img"
                      aria-label={tr(
                        `Perbelanjaan ikut kategori. Terbesar: ${wedges[0].label}, ${(wedges[0].amt / txOut * 100).toFixed(0)} peratus.`,
                        `Spending by category. Largest: ${wedges[0].label}, ${(wedges[0].amt / txOut * 100).toFixed(0)} percent.`)}>
                      {wedges.map(w => {
                        const len = (w.amt / txOut) * DONUT_C;
                        const draw = Math.max(len - gap, 0.6); // a sliver still reads as present
                        const dash = `${draw} ${DONUT_C - draw}`;
                        // The grouped wedge is several categories at once, so there is nothing
                        // single for it to pin the history to — only named wedges are tappable.
                        const named = w.key !== '__rest';
                        const dimmed = catFilter !== null && catFilter !== w.key;
                        const el = (
                          <circle key={w.key} cx="50" cy="50" r={DONUT_R} fill="none" stroke={w.color} strokeWidth="13"
                            strokeDasharray={dash} strokeDashoffset={-start}
                            opacity={dimmed ? 0.25 : 1}
                            onClick={named ? () => toggleCatFilter(w.key) : undefined}
                            className={`motion-safe:transition-[stroke-dasharray,opacity] duration-500 ease-out ${named ? 'cursor-pointer' : ''}`}>
                            <title>{`${w.label} · RM ${fmt(w.amt)} · ${(w.amt / txOut * 100).toFixed(0)}%`}</title>
                          </circle>
                        );
                        start += len;
                        return el;
                      })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted">{tr('Keluar', 'Out')}</span>
                      <span className="font-mono text-[14px] font-black text-text leading-tight mt-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>RM {fmt(txOut)}</span>
                      <span className="text-[9px] text-muted mt-0.5">{tr(`${catRows.length} kategori`, `${catRows.length} categories`)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {catRows.map(([cat, amt]) => {
              const pct = txOut > 0 ? (amt / txOut) * 100 : 0;
              const color = catColor(cat, allOptions);
              const Icon = catIcon(cat, allOptions);
              const pinned = catFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => toggleCatFilter(cat)}
                  aria-pressed={pinned}
                  title={tr(`Lihat transaksi ${catLabel(cat, allOptions)}`, `See ${catLabel(cat, allOptions)} transactions`)}
                  className={`w-full flex items-center gap-2.5 text-left rounded-lg -mx-1 px-1 py-1 transition-colors ${pinned ? 'bg-text/[0.07]' : 'hover:bg-text/5'}`}
                >
                  <span className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: `${color}22`, color }}>
                    <Icon size={14} />
                  </span>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex justify-between items-baseline gap-2 text-xs">
                      <span className="text-text/80 truncate">{catLabel(cat, allOptions)}</span>
                      <span className="font-mono text-muted shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>RM {fmt(amt)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-text/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* History — grouped by day, each row led by its category icon */}
          <div ref={historyRef} className="glass-panel p-4 scroll-mt-4">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <h3 className="font-bold text-sm">{tr('Sejarah', 'History')} · {periodLabel}</h3>
              {foundTxns.length > 0 && <span className="text-[10px] text-muted shrink-0">{tr(`${foundTxns.length} transaksi`, `${foundTxns.length} transactions`)}</span>}
            </div>

            {/* The pin is stated in the list it narrows, with the way out on the chip itself —
                a filter set three panels up is otherwise invisible from down here. */}
            {catFilter && (
              <button
                onClick={() => toggleCatFilter(catFilter)}
                className="mb-2 flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1 text-[11px] font-bold border transition-colors hover:bg-text/5"
                style={{ borderColor: `${catColor(catFilter, allOptions)}66`, color: catColor(catFilter, allOptions) }}
              >
                {(() => { const I = catIcon(catFilter, allOptions); return <I size={13} />; })()}
                {catLabel(catFilter, allOptions)}
                <X size={13} className="opacity-70" />
              </button>
            )}

            <div className="mb-2">
              <SearchBox
                value={txQuery}
                onChange={v => { setTxQuery(v); setTxLimit(TX_PAGE); }}
                placeholder={tr('Cari nama atau kategori', 'Search a name or category')}
              />
            </div>

            {foundTxns.length === 0 ? (
              <p className="text-xs text-muted text-center py-3">
                {txq
                  ? tr(`Tiada padanan untuk "${txQuery.trim()}".`, `No match for "${txQuery.trim()}".`)
                  : catFilter
                    ? tr(`Tiada transaksi ${catLabel(catFilter, allOptions)}.`, `No ${catLabel(catFilter, allOptions)} transactions.`)
                    : tr('Tiada transaksi.', 'No transactions.')}
              </p>
            ) : foundTxns.slice(0, txLimit).map((t, i, page) => {
              const newDay = i === 0 || page[i - 1].date !== t.date;
              const income = t.type === 'in';
              const color = income ? 'rgb(16 185 129)' : catColor(t.category || 'other', allOptions);
              const Icon = income ? Coins : catIcon(t.category || 'other', allOptions);
              return (
                <React.Fragment key={t.id}>
                  {newDay && (
                    <div className="flex items-baseline justify-between gap-2 pt-3 first:pt-0 pb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{fmtLongDate(t.date)}</span>
                      <span className={`text-[10px] font-mono font-bold ${dayNet[t.date] < 0 ? 'text-muted' : 'text-emerald-400 light:text-emerald-600'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {dayNet[t.date] < 0 ? '−' : '+'}RM {fmt(Math.abs(dayNet[t.date]))}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 py-2 border-t border-text/5">
                    <span className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center" style={{ backgroundColor: `${color}1f`, color }}>
                      <Icon size={16} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-text/90">{t.label}</p>
                      <p className="text-[10px] text-muted truncate">{income ? tr('Pendapatan', 'Income') : catLabel(t.category || 'other', allOptions)}</p>
                    </div>
                    <span className={`font-mono text-sm font-bold shrink-0 ${income ? 'text-emerald-400 light:text-emerald-600' : 'text-rose-400 light:text-rose-600'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {income ? '+' : '−'}RM {fmt(t.amount)}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
            {foundTxns.length > txLimit && (
              <button onClick={() => setTxLimit(n => n + TX_PAGE)} className="w-full mt-3 py-2.5 rounded-xl bg-text/5 text-muted hover:text-text text-xs font-bold transition-colors">
                {tr(`Tunjuk ${Math.min(TX_PAGE, foundTxns.length - txLimit)} lagi · ${foundTxns.length - txLimit} baki`, `Show ${Math.min(TX_PAGE, foundTxns.length - txLimit)} more · ${foundTxns.length - txLimit} left`)}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dev tools — only on localhost / dev server */}
      {import.meta.env.DEV && (
        <div className="border border-dashed border-amber-500/30 rounded-2xl p-3 space-y-2">
          <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">{tr('Alat dev (localhost sahaja)', 'Dev tools (localhost only)')}</p>
          <div className="flex gap-2">
            <button onClick={() => { const d = makeSampleData(); setExpenses(d.expenses); setIncomes(d.incomes); setCommitments(d.commitments); }} className="flex-1 py-2 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-bold hover:bg-amber-500/25">{tr('Jana data contoh', 'Generate sample data')}</button>
            <button onClick={() => { if (window.confirm(trs('Kosongkan semua data perbelanjaan?', 'Clear every expense record?'))) { setExpenses([]); setIncomes([]); setCommitments([]); } }} className="flex-1 py-2 rounded-lg bg-rose-500/15 text-rose-400 text-xs font-bold hover:bg-rose-500/25">{tr('Kosongkan semua data', 'Clear all data')}</button>
          </div>
        </div>
      )}

      {/* Floating add-expense button (dashboard only) — portaled into the phone frame so it
          stays pinned bottom-right above the menu bar and never scrolls away */}
      {tab === 'dashboard' && frameEl && createPortal((
        <button onClick={() => openExpense()} className="fixed bottom-24 right-4 sm:absolute z-30 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/30 flex items-center justify-center active:scale-90 transition-transform" title={tr('Tambah perbelanjaan', 'Add an expense')}>
          <Plus size={26} />
        </button>
      ), frameEl)}

      {/* Add Expense modal */}
      {showExpense && createPortal((
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowExpense(false)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold text-lg">{eId ? tr('Sunting Perbelanjaan', 'Edit Expense') : tr('Tambah Perbelanjaan', 'Add Expense')}</h3><button onClick={() => setShowExpense(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button></div>
            <input autoFocus value={eDesc} onChange={e => setEDesc(e.target.value)} placeholder={tr('Keterangan', 'Description')} className="input-field w-full" />
            <input type="number" value={eAmount} onChange={e => setEAmount(e.target.value)} placeholder={tr('Jumlah (RM)', 'Amount (RM)')} className="input-field w-full font-mono text-lg" />
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">{tr('Kategori', 'Category')}</label>
              <CategoryPicker options={expenseOptions} value={eCat} onSelect={(c: string) => { setECat(c); if (!FUND_CATS.includes(c)) setEGoal(''); }} onAdd={addExpenseCat} onRemove={removeExpenseCat} defaults={DEFAULT_EXPENSE_CATS} accent={accent} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">{tr('Tarikh', 'Date')}</label>
              <input type="date" value={eDate} max={todayKey} onChange={e => setEDate(e.target.value)} className="input-field w-full" />
            </div>
            {/* Only on a savings or investment expense, and only once there is a fund for it */}
            {FUND_CATS.includes(eCat) && goals.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">{tr('Masuk ke tabung', 'Into a fund')}</label>
                <select value={eGoal} onChange={e => setEGoal(e.target.value)} className="input-field w-full">
                  <option value="">{tr('Tiada', 'None')}</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}
            <button onClick={saveExpense} className="w-full py-3 rounded-xl bg-emerald-500 text-[#ffffff] font-bold hover:bg-emerald-600">{eId ? tr('Simpan Perubahan', 'Save Changes') : tr('Simpan Perbelanjaan', 'Save Expense')}</button>
          </div>
        </div>
      ), document.body)}

      {/* Commitment add/edit modal */}
      {showCForm && createPortal((
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowCForm(false)}>
          <div className="bg-surface border border-text/10 rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold text-lg">{cForm.id ? tr('Sunting Komitmen', 'Edit Commitment') : tr('Tambah Komitmen', 'Add Commitment')}</h3><button onClick={() => setShowCForm(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button></div>
            <input autoFocus value={cForm.title} onChange={e => setCForm(f => ({ ...f, title: e.target.value }))} placeholder={tr('Tajuk (cth. Pinjaman kereta)', 'Title (e.g. Car loan)')} className="input-field w-full" />
            <div className="flex gap-2">
              <input type="number" value={cForm.amount} onChange={e => setCForm(f => ({ ...f, amount: e.target.value }))} placeholder={tr('Jumlah', 'Amount')} className="input-field flex-1 font-mono" />
              <input type="number" min={1} max={31} value={cForm.day} onChange={e => setCForm(f => ({ ...f, day: e.target.value }))} placeholder={tr('Hari', 'Day')} className="input-field w-20 font-mono" title={tr('Hari bayaran dalam bulan', 'Day of the month it is due')} />
            </div>
            {/* Defaults to the month being viewed, so a new commitment does not appear owed in
                months you did not have it. Set it earlier to claim those months back. */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">{tr('Bermula', 'Starts')}</label>
              <input type="month" value={cForm.start} onChange={e => setCForm(f => ({ ...f, start: e.target.value }))} className="input-field w-full font-mono" />
              <p className="text-[10px] text-muted px-1">
                {cForm.start
                  ? tr(`Bulan sebelum ${monthLabel(cForm.start)} tidak dikira — kecuali yang sudah ditanda dibayar.`, `Months before ${monthLabel(cForm.start)} are not counted — bar any already marked paid.`)
                  : tr('Kosong: dikira untuk setiap bulan lepas juga.', 'Blank: counted in every past month too.')}
              </p>
            </div>
            {/* Only for a commitment that ends. Left blank, it stays the open-ended bill it was. */}
            <div className="space-y-1">
              <input type="number" value={cForm.payoff} onChange={e => setCForm(f => ({ ...f, payoff: e.target.value }))} placeholder={tr('Jumlah keseluruhan (pilihan)', 'Total to pay (optional)')} className="input-field w-full font-mono" />
              {(() => {
                const total = parseFloat(cForm.payoff);
                const monthly = parseFloat(cForm.amount);
                if (isNaN(total) || total <= 0) return <p className="text-[10px] text-muted px-1">{tr('Untuk pinjaman atau ansuran — biarkan kosong untuk bil bulanan biasa.', 'For a loan or instalment plan — leave blank for an ordinary monthly bill.')}</p>;
                if (isNaN(monthly) || monthly <= 0) return null;
                const months = Math.ceil(total / monthly);
                return <p className="text-[10px] text-muted px-1">{tr(`± ${months} bulan · berhenti sendiri bila cukup bayar`, `≈ ${months} months · stops itself once fully paid`)}</p>;
              })()}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">{tr('Kategori', 'Category')}</label>
              <CategoryPicker options={commitOptions} value={cForm.category} onSelect={(c: string) => setCForm(f => ({ ...f, category: c }))} onAdd={addCommitCat} onRemove={removeCommitCat} defaults={DEFAULT_COMMIT_CATS} accent="rgb(245 158 11)" />
            </div>
            {(() => {
              if (!cForm.id) return <button onClick={() => saveCForm('all')} className="w-full py-3 rounded-xl bg-emerald-500 text-[#ffffff] font-bold hover:bg-emerald-600">{tr('Tambah Komitmen', 'Add Commitment')}</button>;
              const before = commitments.find(c => c.id === cForm.id)?.amount;
              const now = parseFloat(cForm.amount);
              const amountChanged = !isNaN(now) && now > 0 && now !== before;
              if (!amountChanged) return (
                <>
                  <p className="text-xs text-muted leading-relaxed bg-text/5 rounded-xl p-3">
                    {tr('Bulan yang sudah ditanda dibayar kekal pada jumlah yang direkod — sejarah anda tidak berubah.', 'Months already marked paid keep the amount they were recorded at — your history does not change.')}
                  </p>
                  <button onClick={() => saveCForm('all')} className="w-full py-3 rounded-xl bg-emerald-500 text-[#ffffff] font-bold hover:bg-emerald-600">{tr('Simpan Perubahan', 'Save Changes')}</button>
                </>
              );
              return (
                <div className="space-y-2">
                  <p className="text-xs text-muted leading-relaxed bg-text/5 rounded-xl p-3">
                    {tr(`Jumlah berubah dari RM ${fmt(before ?? 0)} ke RM ${fmt(now)}. Naik harga sebenar? Pilih yang pertama — bulan lepas kekal pada RM ${fmt(before ?? 0)}. Tersalah taip dari awal? Pilih yang kedua.`, `The amount changed from RM ${fmt(before ?? 0)} to RM ${fmt(now)}. A real price rise? Pick the first — past months stay at RM ${fmt(before ?? 0)}. A typo from the start? Pick the second.`)}
                  </p>
                  <button onClick={() => saveCForm('forward')} className="w-full py-3 rounded-xl bg-emerald-500 text-[#ffffff] font-bold hover:bg-emerald-600">{tr('Ubah mulai', 'Change from')} {monthLabel(currentMonth)}</button>
                  <button onClick={() => saveCForm('all')} className="w-full py-2.5 rounded-xl bg-text/5 text-text font-bold hover:bg-text/10">{tr('Ubah semua bulan', 'Change every month')}</button>
                </div>
              );
            })()}
          </div>
        </div>
      ), document.body)}

      {/* Edit income modal */}
      {editIncome && createPortal((
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setEditIncome(null)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold text-lg">{tr('Sunting Pendapatan', 'Edit Income')}</h3><button onClick={() => setEditIncome(null)} className="p-1 text-muted hover:text-text"><X size={20} /></button></div>
            <input autoFocus value={ieTitle} onChange={e => setIeTitle(e.target.value)} placeholder={tr('Tajuk', 'Title')} className="input-field w-full" />
            <input type="number" value={ieAmount} onChange={e => setIeAmount(e.target.value)} placeholder={tr('Jumlah', 'Amount')} className="input-field w-full font-mono text-lg" />
            {editIncome.recurring && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-muted">{tr('Hari gaji', 'Pay day')}</label>
                  <input type="number" min={1} max={31} value={ieDay} onChange={e => setIeDay(e.target.value)} className={`input-field w-16 font-mono py-1.5 text-center ${ieDayInvalid ? 'border-red-500/60 focus:ring-red-500/40' : ''}`} />
                  <span className="text-[10px] text-muted">{tr('Hari gaji diterima setiap bulan', 'The day the pay lands each month')}</span>
                </div>
                {ieDayInvalid && <p className="text-[10px] text-red-400">{tr('Hari gaji mesti antara 1 hingga 31.', 'Pay day must be between 1 and 31.')}</p>}
              </div>
            )}
            {editIncome.recurring ? (
              <div className="space-y-2">
                {isPastView ? (
                  <>
                    <p className="text-xs text-muted">{tr(`${monthLabel(viewMonth)} ialah bulan lepas — perubahan ini hanya untuk bulan tersebut.`, `${monthLabel(viewMonth)} is a past month — this change applies to that month only.`)}</p>
                    <button onClick={saveIncomeEditSingle} disabled={ieDayInvalid} className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 disabled:opacity-40 disabled:pointer-events-none">{tr(`Guna untuk ${monthLabel(viewMonth)} sahaja`, `Apply to ${monthLabel(viewMonth)} only`)}</button>
                    <button onClick={() => saveIncomeEdit('all')} disabled={ieDayInvalid} className="w-full py-2.5 rounded-xl bg-text/5 text-text font-bold hover:bg-text/10 disabled:opacity-40 disabled:pointer-events-none">{tr('Ubah semua bulan', 'Change every month')}</button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted">{tr(`Digunakan untuk ${monthLabel(viewMonth)} dan setiap bulan akan datang (bulan lepas kekal sama).`, `Applies to ${monthLabel(viewMonth)} and every month after it (past months stay as they are).`)}</p>
                    <button onClick={() => saveIncomeEdit('forward')} disabled={ieDayInvalid} className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 disabled:opacity-40 disabled:pointer-events-none">{tr(`Guna dari ${monthLabel(viewMonth)} ke hadapan`, `Apply from ${monthLabel(viewMonth)} onwards`)}</button>
                    <button onClick={() => saveIncomeEdit('all')} disabled={ieDayInvalid} className="w-full py-2.5 rounded-xl bg-text/5 text-text font-bold hover:bg-text/10 disabled:opacity-40 disabled:pointer-events-none">{tr('Ubah semua bulan', 'Change every month')}</button>
                  </>
                )}
              </div>
            ) : (
              <button onClick={() => saveIncomeEdit('all')} className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600">{tr('Simpan', 'Save')}</button>
            )}
          </div>
        </div>
      ), document.body)}

      {/* Delete recurring income modal */}
      {delIncome && createPortal((
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDelIncome(null)}>
          <div className="bg-surface border border-text/10 rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">{tr('Berhentikan pendapatan', 'Stop this income')}</h3>
            <p className="text-sm text-muted">{delIncome.title} · <span className="font-mono font-bold text-emerald-400">RM{fmt(delIncome.amount)}</span></p>
            <p className="text-xs text-muted">{tr(`Pendapatan ini akan berhenti dari ${monthLabel(viewMonth)} dan seterusnya. Rekod bulan-bulan lepas kekal tidak berubah.`, `This income stops from ${monthLabel(viewMonth)} onwards. Past months stay exactly as they are.`)}</p>
            <button onClick={stopIncomeFromMonth} className="w-full py-3 rounded-xl bg-emerald-500 text-[#ffffff] font-bold hover:bg-emerald-600">{tr(`Berhenti dari ${monthLabel(viewMonth)}`, `Stop from ${monthLabel(viewMonth)}`)}</button>
            <button onClick={() => setDelIncome(null)} className="w-full py-2.5 rounded-xl bg-text/5 text-text font-bold hover:bg-text/10">{tr('Batal', 'Cancel')}</button>
          </div>
        </div>
      ), document.body)}

      {/* Goal add/edit modal */}
      {showGForm && createPortal((
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowGForm(false)}>
          <div className="bg-surface border border-text/10 rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{gForm.id ? tr('Sunting Tabung', 'Edit fund') : tr('Tambah Tabung', 'Add a fund')}</h3>
              <button onClick={() => setShowGForm(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button>
            </div>
            <input autoFocus value={gForm.name} onChange={e => setGForm(f => ({ ...f, name: e.target.value }))} placeholder={tr('Nama (cth. Umrah)', 'Name (e.g. Umrah)')} className="input-field w-full" />
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">{tr('Sasaran', 'Target')}</label>
              <input type="number" value={gForm.target} onChange={e => setGForm(f => ({ ...f, target: e.target.value }))} placeholder="RM" className="input-field w-full font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">{tr('Tarikh sasaran (pilihan)', 'Target date (optional)')}</label>
              <input type="date" value={gForm.deadline} onChange={e => setGForm(f => ({ ...f, deadline: e.target.value }))} className="input-field w-full" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">{tr('Gambar (pilihan)', 'Photo (optional)')}</label>
              <input
                type="file"
                accept="image/*"
                ref={goalPhotoRef}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setGoalPhotoBusy(true);
                  // Same 900/0.82 as a trip cover — big enough to stay sharp at 2x on a phone
                  downscaleFile(file, 900, 0.82)
                    .then(photo => setGForm(f => ({ ...f, photo })))
                    .catch(() => {})
                    .finally(() => setGoalPhotoBusy(false));
                }}
                className="hidden"
                id="goal-photo"
              />
              {gForm.photo ? (
                <div className="relative h-28 rounded-xl overflow-hidden border border-text/10">
                  <img src={gForm.photo} alt="" style={{ objectPosition: `${gForm.px}% ${gForm.py}%` }} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <label htmlFor="goal-photo" title={tr('Tukar gambar', 'Change photo')} className="p-1.5 rounded-lg bg-[#000]/50 text-[#ffffff]/80 hover:text-[#ffffff] backdrop-blur-md cursor-pointer">
                      <Pencil size={14} />
                    </label>
                    <button
                      type="button"
                      onClick={() => { setGForm(f => ({ ...f, photo: '' })); if (goalPhotoRef.current) goalPhotoRef.current.value = ''; }}
                      aria-label={tr('Buang gambar', 'Remove photo')}
                      className="p-1.5 rounded-lg bg-[#000]/50 text-[#ffffff]/80 hover:text-[#ffffff] backdrop-blur-md"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <label htmlFor="goal-photo" className="flex items-center justify-center gap-2 h-14 rounded-xl border border-dashed border-text/15 bg-text/5 text-muted text-sm cursor-pointer hover:text-text hover:bg-text/10 transition-colors">
                  {goalPhotoBusy
                    ? <><Loader size={18} className="animate-spin" /> {tr('Memproses…', 'Processing…')}</>
                    : <><ImageIcon size={18} /> {tr('Pilih gambar', 'Choose a photo')}</>}
                </label>
              )}

              {/* Reposition. The list crop is a narrow slice, so the preview beside the sliders is
                  rendered at exactly the size the list uses — anything else would lie about it. */}
              {gForm.photo && (
                <div className="flex items-center gap-3 pt-1">
                  <img
                    src={gForm.photo}
                    alt={tr('Pratonton senarai', 'List preview')}
                    style={{ objectPosition: `${gForm.px}% ${gForm.py}%` }}
                    className="w-20 h-24 rounded-lg object-cover shrink-0 border border-text/10"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-[10px] text-muted">{tr('Geser untuk pilih bahagian gambar', 'Slide to choose the part that shows')}</p>
                    <label className="flex items-center gap-2">
                      <span className="text-[10px] text-muted w-4 shrink-0">↔</span>
                      <input type="range" min={0} max={100} value={gForm.px} onChange={e => setGForm(f => ({ ...f, px: Number(e.target.value) }))} aria-label={tr('Kedudukan mendatar', 'Horizontal position')} className="w-full accent-emerald-500" />
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="text-[10px] text-muted w-4 shrink-0">↕</span>
                      <input type="range" min={0} max={100} value={gForm.py} onChange={e => setGForm(f => ({ ...f, py: Number(e.target.value) }))} aria-label={tr('Kedudukan menegak', 'Vertical position')} className="w-full accent-emerald-500" />
                    </label>
                    <button type="button" onClick={() => setGForm(f => ({ ...f, px: 50, py: 50 }))} className="text-[10px] text-muted hover:text-text underline">
                      {tr('Set semula ke tengah', 'Reset to centre')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button onClick={saveGForm} className="w-full py-3 rounded-xl bg-emerald-500 text-[#ffffff] font-bold hover:bg-emerald-600">
              {gForm.id ? tr('Simpan Perubahan', 'Save changes') : tr('Tambah Tabung', 'Add fund')}
            </button>
          </div>
        </div>
      ), document.body)}

      {/* Goal detail sheet — what feeds it, and what has been dropped in by hand */}
      {openGoal && createPortal((() => {
        const g = goals.find(x => x.id === openGoal);
        if (!g) return null;
        const saved = savedFor(g.id);
        const pct = g.target > 0 ? Math.min(100, (saved / g.target) * 100) : 0;
        const linkedExpenses = expenses.filter(e => e.goalId === g.id);
        // Every ringgit that reached this fund, whatever it came from, newest first. A commitment
        // contributes once per month it was paid, at what that month actually cost.
        type Feed = { key: string; date: string; label: string; from: string; amount: number; expense?: Expense; topupId?: string };
        const feed: Feed[] = [
          ...commitments.filter(c => c.goalId === g.id).flatMap(c =>
            Object.entries(c.payments).map(([mk, d]) => ({
              key: `c${c.id}${mk}`, date: d, label: c.title,
              from: tr('Komitmen', 'Commitment'), amount: paidFor(c, mk),
            }))),
          ...linkedExpenses.map(e => ({
            key: `e${e.id}`, date: e.date, label: e.description,
            from: catLabel(e.category, expenseOptions), amount: e.amount, expense: e,
          })),
          ...topups.filter(t => t.goalId === g.id).map(t => ({
            key: `t${t.id}`, date: t.date, label: tr('Tambah nilai', 'Top-up'),
            from: tr('Manual', 'Manual'), amount: t.amount, topupId: t.id,
          })),
        ].sort((a, b) => b.date.localeCompare(a.date));
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setOpenGoal(null)}>
            <div className="bg-surface border border-text/10 rounded-t-3xl w-full max-w-md max-h-[88dvh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-2 p-5 pb-3 shrink-0 border-b border-text/5">
                <div className="min-w-0">
                  <h3 className="font-bold text-lg truncate">{g.name}</h3>
                  <p className="text-xs text-muted font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    RM {fmt(saved)} {tr('daripada', 'of')} RM {fmt(g.target)} · {pct.toFixed(0)}%
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setOpenGoal(null); openGForm(g); }} aria-label={tr('Sunting', 'Edit')} className="p-2 text-muted hover:text-text"><Pencil size={16} /></button>
                  <button onClick={() => deleteGoal(g)} aria-label={tr('Padam', 'Delete')} className="p-2 text-rose-400"><Trash2 size={16} /></button>
                  <button onClick={() => setOpenGoal(null)} aria-label={tr('Tutup', 'Close')} className="p-2 text-muted hover:text-text"><X size={18} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain p-5 pt-4 space-y-5">
                <GoalBar saved={saved} target={g.target} />

                {/* Sources — the one place the link is edited */}
                <div className="space-y-2">
                  <button onClick={() => setShowSources(v => !v)} className="w-full flex items-center gap-2 text-left">
                    <h4 className="text-xs font-bold text-muted uppercase tracking-wider">{tr('Sumber', 'Sources')}</h4>
                    <span className="text-[10px] text-muted">
                      {tr(`${commitments.filter(c => c.goalId === g.id).length} daripada ${activeCommitments.length} komitmen`,
                        `${commitments.filter(c => c.goalId === g.id).length} of ${activeCommitments.length} commitments`)}
                    </span>
                    <ChevronDown size={14} className={`ml-auto text-muted transition-transform ${showSources ? 'rotate-180' : ''}`} />
                  </button>
                  {!showSources ? null : activeCommitments.length === 0 ? (
                    <p className="text-xs text-muted">{tr('Belum ada komitmen untuk dipautkan.', 'No commitments to link yet.')}</p>
                  ) : activeCommitments.map(c => {
                    const linked = c.goalId === g.id;
                    const elsewhere = !!c.goalId && !linked;
                    return (
                      <button key={c.id} onClick={() => linkCommitment(c, g.id)} className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-colors text-left ${linked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-text/[0.03] border-text/5 hover:border-text/15'}`}>
                        <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${linked ? 'bg-emerald-500 border-emerald-500 text-[#ffffff]' : 'border-text/25 text-transparent'}`}><Check size={12} strokeWidth={3} /></span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate text-text/90">{c.title}</span>
                          <span className="block text-[10px] text-muted truncate">
                            RM {fmt(scheduledFor(c, currentMonth))} · {tr(`hari ${c.paymentDay}`, `day ${c.paymentDay}`)}
                            {elsewhere ? ` · ${tr('masuk', 'feeds')} ${goals.find(x => x.id === c.goalId)?.name ?? ''}` : ''}
                          </span>
                        </span>
                        {linked && <span className="font-mono text-xs font-bold text-emerald-400 light:text-emerald-600 shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>RM {fmt(commitmentPaidTotal(c))}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Top-ups — pure tally, deliberately outside the balance */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-muted uppercase tracking-wider">{tr('Tambah nilai', 'Top-ups')}</h4>
                  <div className="flex gap-2">
                    <input type="number" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} placeholder="RM" className="input-field flex-1 font-mono py-2 text-sm" />
                    <input type="date" value={topupDate} max={todayKey} onChange={e => setTopupDate(e.target.value)} className="input-field w-36 py-2 text-sm" />
                    <button onClick={() => addTopup(g.id)} aria-label={tr('Tambah', 'Add')} className="px-3 rounded-xl bg-emerald-500 text-[#ffffff] font-bold hover:bg-emerald-600 shrink-0"><Plus size={18} /></button>
                  </div>
                </div>

                {/* Where every ringgit came from */}
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="text-xs font-bold text-muted uppercase tracking-wider">{tr('Rekod', 'Record')}</h4>
                    {feed.length > 0 && <span className="text-[10px] text-muted">{tr(`${feed.length} masukan`, `${feed.length} entries`)}</span>}
                  </div>
                  {feed.length === 0 ? (
                    <p className="text-xs text-muted py-2">{tr('Belum ada apa-apa masuk lagi.', 'Nothing has gone in yet.')}</p>
                  ) : feed.map(f => (
                    <div key={f.key} className="flex items-center gap-2.5 py-2 border-t border-text/5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-text/90">{f.label}</p>
                        <p className="text-[10px] text-muted truncate">{fmtLongDate(f.date)} · {f.from}</p>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-400 light:text-emerald-600 shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        +RM {fmt(f.amount)}
                      </span>
                      {/* Expenses and top-ups belong to this fund, so they are managed here. A
                          commitment payment belongs to the commitment — undo it on that tab. */}
                      {f.expense && (
                        <>
                          <button onClick={() => { setOpenGoal(null); openExpense(f.expense); }} aria-label={tr('Sunting', 'Edit')} className="p-1 text-muted opacity-60 hover:opacity-100 hover:text-text shrink-0"><Pencil size={13} /></button>
                          <button onClick={() => deleteExpense(f.expense!)} aria-label={tr('Padam', 'Delete')} className="p-1 text-rose-400 opacity-60 hover:opacity-100 shrink-0"><Trash2 size={13} /></button>
                        </>
                      )}
                      {f.topupId && (
                        <button onClick={() => setTopups(prev => prev.filter(x => x.id !== f.topupId))} aria-label={tr('Padam', 'Delete')} className="p-1 text-rose-400 opacity-60 hover:opacity-100 shrink-0"><Trash2 size={13} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {/* Settings sheet */}
      {showSettings && createPortal((
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowSettings(false)}>
          <div className="bg-surface border border-text/10 rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold text-lg">{tr('Tetapan', 'Settings')}</h3><button onClick={() => setShowSettings(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button></div>
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-2">
              <p className="flex items-center gap-2 text-sm font-bold text-rose-400 light:text-rose-600"><AlertTriangle size={16} className="shrink-0" />{tr('Padam semua data', 'Delete all data')}</p>
              <p className="text-xs text-muted">{tr(
                'Membuang semua perbelanjaan, pendapatan, komitmen, tabung dan kategori sendiri dalam Expense Manager sahaja. Alat lain tidak disentuh.',
                'Removes every expense, income, commitment, savings goal and custom category in Expense Manager only. Other tools are left alone.',
              )}</p>
              <p className="text-xs font-bold text-rose-400 light:text-rose-600">{tr(
                'Amaran: data yang dipadam tidak boleh dipulihkan.',
                'Warning: deleted data cannot be recovered.',
              )}</p>
              <button onClick={wipeAll} className="w-full py-3 rounded-xl bg-rose-500 text-[#ffffff] font-bold hover:bg-rose-600 flex items-center justify-center gap-2"><Trash2 size={16} />{tr('Padam semua data', 'Delete all data')}</button>
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full py-2.5 rounded-xl bg-text/5 text-text font-bold hover:bg-text/10">{tr('Tutup', 'Close')}</button>
          </div>
        </div>
      ), document.body)}

      {/* Delete commitment modal */}
      {delCommit && createPortal((
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDelCommit(null)}>
          <div className="bg-surface border border-text/10 rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">{tr('Berhentikan komitmen', 'Stop this commitment')}</h3>
            <p className="text-sm text-muted">{delCommit.title} · <span className="font-mono font-bold text-amber-400 light:text-amber-600">RM {fmt(delCommit.amount)}</span></p>
            <p className="text-xs text-muted">{tr(`Komitmen ini akan berhenti dari ${monthLabel(currentMonth)} dan seterusnya. Bayaran yang sudah direkod pada bulan-bulan lepas kekal tidak berubah.`, `This commitment stops from ${monthLabel(currentMonth)} onwards. Payments already recorded in past months stay as they are.`)}</p>
            <button onClick={stopCommitmentFromNow} className="w-full py-3 rounded-xl bg-emerald-500 text-[#ffffff] font-bold hover:bg-emerald-600">{tr(`Berhenti dari ${monthLabel(currentMonth)}`, `Stop from ${monthLabel(currentMonth)}`)}</button>
            <button onClick={() => setDelCommit(null)} className="w-full py-2.5 rounded-xl bg-text/5 text-text font-bold hover:bg-text/10">{tr('Batal', 'Cancel')}</button>
          </div>
        </div>
      ), document.body)}

      {/* Confirm payment modal */}
      {payTarget && createPortal((() => {
        const payDateValid = payDate.startsWith(viewMonth) && payDate <= (viewMonth === currentMonth ? todayKey : `${viewMonth}-${pad(daysInMonth(viewMonth))}`);
        const payNum = parseFloat(payAmount);
        const payAmountValid = !isNaN(payNum) && payNum > 0;
        const differs = payAmountValid && payNum !== payTarget.amount;
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setPayTarget(null)}>
            <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg">{tr('Sahkan Bayaran', 'Confirm Payment')}</h3>
              <p className="text-sm text-muted">{payTarget.title} · {tr('dijadualkan', 'scheduled')} <span className="font-mono font-bold text-amber-400 light:text-amber-600">RM {fmt(payTarget.amount)}</span></p>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">{tr('Jumlah dibayar', 'Amount paid')}</label>
                <input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} className={`input-field w-full font-mono ${!payAmountValid ? 'border-red-500/60 text-red-400' : ''}`} />
                <p className="text-[10px] text-muted">
                  {differs
                    ? tr(`Direkod sebagai RM ${fmt(payNum)} untuk ${monthLabel(viewMonth)} sahaja — jadual kekal RM ${fmt(payTarget.amount)}.`, `Recorded as RM ${fmt(payNum)} for ${monthLabel(viewMonth)} only — the schedule stays at RM ${fmt(payTarget.amount)}.`)
                    : tr('Ubah jika bil bulan ini berbeza (contoh: bil elektrik).', 'Change it if this month\'s bill differs (an electricity bill, say).')}
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">{tr('Tarikh bayaran', 'Payment date')}</label>
                <input type="date" min={`${viewMonth}-01`} max={viewMonth === currentMonth ? todayKey : `${viewMonth}-${pad(daysInMonth(viewMonth))}`} value={payDate} onChange={e => setPayDate(e.target.value)} className={`input-field w-full ${!payDateValid ? 'border-red-500/60 text-red-400' : ''}`} />
                {!payDateValid && <p className="text-[10px] text-red-400">{tr(`Tarikh mesti dalam ${monthLabel(viewMonth)}${viewMonth === currentMonth ? ' dan bukan masa hadapan' : ''}.`, `The date must fall in ${monthLabel(viewMonth)}${viewMonth === currentMonth ? ' and not be in the future' : ''}.`)}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPayTarget(null)} className="flex-1 py-3 rounded-xl bg-text/5 text-text font-bold">{tr('Batal', 'Cancel')}</button>
                <button onClick={confirmPay} disabled={!payDateValid || !payAmountValid} className="flex-1 py-3 rounded-xl bg-emerald-500 text-[#ffffff] font-bold hover:bg-emerald-600 disabled:opacity-40 disabled:pointer-events-none">{tr('Sahkan Dibayar', 'Confirm as Paid')}</button>
              </div>
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
};

export default ExpenseManager;
