import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { store } from '../lib/store';
import { useT, t as trs, getLang, locale } from '../lib/lang';
import {
  Wallet, Plus, Trash2, Check, X, ChevronLeft, ChevronRight, ChevronDown, Pencil, RotateCcw,
  TrendingUp, TrendingDown, PieChart, ListChecks, CreditCard, Coins, CalendarDays,
  Eye, EyeOff,
  Utensils, ShoppingCart, Car, ShoppingBag, Receipt, HeartPulse, GraduationCap, Clapperboard,
  Plane, Gift, HeartHandshake, Sparkles, Baby, CircleEllipsis, Landmark, Repeat, Zap, ShieldCheck,
  Home, Tag, Search
} from 'lucide-react';

interface Expense { id: string; description: string; amount: number; category: string; date: string; }
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
  endMonth?: string; // last month it applies — past payments stay on record after it ends
}

const STORAGE_KEY = 'expense_manager_data';
const HIDE_KEY = 'expense_manager_hide_balance';
// Categories are saved by id, never by label, so the language can change without touching
// stored data — the picker just reads whichever side the language switch is on.
type CatDef = { id: string; ms: string; en: string; Icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }> };
const catLang = (): 'ms' | 'en' => getLang();

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
  { id: 'other',     ms: 'Lain-lain',         en: 'Other',             Icon: CircleEllipsis },
];

const DEFAULT_COMMIT_CATS: CatDef[] = [
  { id: 'loan',         ms: 'Pinjaman',  en: 'Loan',         Icon: Landmark },
  { id: 'subscription', ms: 'Langganan', en: 'Subscription', Icon: Repeat },
  { id: 'utility',      ms: 'Utiliti',   en: 'Utilities',    Icon: Zap },
  { id: 'insurance',    ms: 'Insurans',  en: 'Insurance',    Icon: ShieldCheck },
  { id: 'rent',         ms: 'Sewa',      en: 'Rent',         Icon: Home },
  { id: 'commit-other', ms: 'Lain-lain', en: 'Other',        Icon: CircleEllipsis },
];

// Names used before categories had ids. Dropped from the picker on load; rows that still
// carry one keep displaying it, since an unknown id falls back to its own text.
const LEGACY_CATS = ['Makanan', 'Pengangkutan', 'Beli-belah', 'Bil', 'Kesihatan', 'Hiburan', 'Lain-lain', 'Pinjaman', 'Langganan', 'Utiliti', 'Insurans', 'Sewa'];

// True for a built-in, by id or by either label — so a user-added name that collides with a
// built-in can never show up as a second, deletable copy of it.
// What the commitment was scheduled at in a given month: the latest change effective on or
// before it. The ORIGIN key holds the figure from before the first recorded change.
const AMOUNT_ORIGIN = '0000-01';
const scheduledFor = (c: Commitment, mk: string) => {
  if (!c.amounts) return c.amount;
  let best = '';
  for (const k of Object.keys(c.amounts)) if (k <= mk && k > best) best = k;
  return best ? c.amounts[best] : c.amount;
};
// What a commitment actually cost in a given month. Records made before amounts were kept
// fall back to what was scheduled then, which is what they were counted as anyway.
const paidFor = (c: Commitment, mk: string) => c.paidAmounts?.[mk] ?? scheduledFor(c, mk);

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

// Three-up figure strip, shared by the dashboard and the transaction tab
const StatStrip = ({ items }: { items: { label: string; value: string; Icon: CatDef['Icon']; tone: string }[] }) => (
  <div className="glass-panel grid grid-cols-3 divide-x divide-text/10 overflow-hidden">
    {items.map(it => (
      <div key={it.label} className="px-2 py-3.5 text-center">
        <div className="flex items-center justify-center gap-1.5 min-h-[24px]">
          <it.Icon size={12} className={`shrink-0 ${it.tone}`} />
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted leading-tight">{it.label}</p>
        </div>
        <p className={`font-mono text-[13px] font-black mt-2 leading-none ${it.tone}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{it.value}</p>
      </div>
    ))}
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
    ({ id: generateId(), title, amount, paymentDay: day, category, archived: false, payments: {} });
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
  const [isLoaded, setIsLoaded] = useState(false);

  const [tab, setTab] = useState<'dashboard' | 'commitment' | 'income' | 'transaction'>('dashboard');
  const today = new Date();
  const todayKey = dateKey(today);
  const currentMonth = monthOf(todayKey);
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const isPastView = viewMonth < currentMonth;

  // Baki stays hidden across visits once the user taps it away (shoulder-surfing)
  const [hideBalance, setHideBalance] = useState(() => store.getItem(HIDE_KEY) === '1');
  const toggleBalance = () => setHideBalance(v => { store.setItem(HIDE_KEY, v ? '0' : '1'); return !v; });
  const masked = (n: number) => (hideBalance ? 'RM ••••' : `RM ${fmt(n)}`);

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
      } catch (e) {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) store.setItem(STORAGE_KEY, JSON.stringify({ expenses, incomes, commitments, expenseCats, commitCats }));
  }, [expenses, incomes, commitments, expenseCats, commitCats, isLoaded]);

  // Built-ins first, then anything the user added
  const expenseOptions: CatDef[] = [...DEFAULT_EXPENSE_CATS, ...expenseCats.map(asCatDef)];
  const commitOptions: CatDef[] = [...DEFAULT_COMMIT_CATS, ...commitCats.map(asCatDef)];
  const allOptions: CatDef[] = [...expenseOptions, ...commitOptions];

  // --- Derived for the viewed month ---
  // Ended commitments drop off the management list once their last month has passed.
  const activeCommitments = commitments.filter(c => !c.endMonth || c.endMonth >= currentMonth);
  // Commitments to show for the viewed month: ones still running that month, plus any
  // that were actually paid that month (keeps the history of ended ones intact).
  const monthCommitments = commitments.filter(c => !c.endMonth || viewMonth <= c.endMonth || !!c.payments[viewMonth]);
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
  const netMaxAbs = Math.max(1, ...netTrend.map(d => Math.abs(d.net)));
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
  // Same sheet adds and edits — eId null means a new one
  const [eId, setEId] = useState<string | null>(null);
  const openExpense = (e?: Expense) => {
    setEId(e?.id ?? null);
    setEDesc(e?.description ?? '');
    setEAmount(e ? String(e.amount) : '');
    setECat(e?.category ?? DEFAULT_EXPENSE_CATS[0].id);
    setEDate(e?.date ?? todayKey);
    setShowExpense(true);
  };
  const saveExpense = () => {
    const amount = parseFloat(eAmount);
    if (!eDesc.trim() || isNaN(amount) || amount <= 0) return;
    const fields = { description: eDesc.trim(), amount, category: eCat, date: eDate };
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

  // --- Commitment add/edit ---
  const [cForm, setCForm] = useState<{ id: string | null; title: string; amount: string; day: string; category: string }>({ id: null, title: '', amount: '', day: '1', category: DEFAULT_COMMIT_CATS[0].id });
  const [showCForm, setShowCForm] = useState(false);
  const openCForm = (c?: Commitment) => {
    if (c) setCForm({ id: c.id, title: c.title, amount: String(c.amount), day: String(c.paymentDay), category: c.category });
    else setCForm({ id: null, title: '', amount: '', day: '1', category: DEFAULT_COMMIT_CATS[0].id });
    setShowCForm(true);
  };
  // 'forward' keeps past months on the old figure; 'all' rewrites it everywhere (a typo fix)
  const saveCForm = (scope: 'forward' | 'all' = 'all') => {
    const amount = parseFloat(cForm.amount);
    const day = Math.min(31, Math.max(1, parseInt(cForm.day) || 1));
    if (!cForm.title.trim() || isNaN(amount) || amount <= 0) return;
    if (cForm.id) {
      setCommitments(prev => prev.map(c => {
        if (c.id !== cForm.id) return c;
        const base = { ...c, title: cForm.title.trim(), amount, paymentDay: day, category: cForm.category };
        if (scope === 'all') { const { amounts, ...rest } = base; return rest; }
        // Seed the origin on the first forward change, so months before it keep the old figure
        return { ...base, amounts: { ...(c.amounts ?? { [AMOUNT_ORIGIN]: c.amount }), [currentMonth]: amount } };
      }));
    } else {
      setCommitments(prev => [...prev, { id: generateId(), title: cForm.title.trim(), amount, paymentDay: day, category: cForm.category, archived: false, payments: {} }]);
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
  const confirmPay = () => {
    if (!payTarget) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) return;
    setCommitments(prev => prev.map(c => c.id === payTarget.id
      ? { ...c, payments: { ...c.payments, [viewMonth]: payDate }, paidAmounts: { ...c.paidAmounts, [viewMonth]: amount } }
      : c));
    setPayTarget(null);
  };
  const undoPay = (id: string) => setCommitments(prev => prev.map(c => c.id === id ? {
    ...c,
    payments: Object.fromEntries(Object.entries(c.payments).filter(([k]) => k !== viewMonth)),
    paidAmounts: Object.fromEntries(Object.entries(c.paidAmounts || {}).filter(([k]) => k !== viewMonth)),
  } : c));

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
  const changePeriod = (p: 'daily' | 'weekly' | 'monthly' | 'yearly') => { setPeriod(p); setTxOffset(0); setTxLimit(TX_PAGE); };
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
  // Search narrows the history only — the figures above stay the truth about the period
  const txq = txQuery.trim().toLowerCase();
  const foundTxns = txq
    ? txns.filter(t => t.label.toLowerCase().includes(txq) || catLabel(t.category || 'other', allOptions).toLowerCase().includes(txq))
    : txns;
  // Day totals in one pass — a filter per day is quadratic and a year of records feels it
  const dayNet: Record<string, number> = {};
  foundTxns.forEach(t => { dayNet[t.date] = (dayNet[t.date] || 0) + (t.type === 'in' ? t.amount : -t.amount); });
  const txIn = txns.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const txOut = txns.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const spendByCat: Record<string, number> = {};
  txns.filter(t => t.type === 'out').forEach(t => { const k = t.category || 'other'; spendByCat[k] = (spendByCat[k] || 0) + t.amount; });
  const catRows = Object.entries(spendByCat).sort((a, b) => b[1] - a[1]);

  const accent = 'rgb(16 185 129)'; // emerald base for this tool

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center space-x-3 px-1">
        <div className="p-3 bg-emerald-500/20 rounded-xl"><Wallet className="text-emerald-400" size={26} /></div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text/90">Expense Manager</h1>
          <p className="text-[10px] text-muted uppercase tracking-wider">{tr('Pendapatan · Komitmen · Perbelanjaan', 'Income · Commitments · Spending')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-text/5 rounded-xl">
        {([['dashboard', tr('Utama', 'Overview'), PieChart], ['commitment', tr('Komitmen', 'Commitments'), CreditCard], ['income', tr('Pendapatan', 'Income'), Coins], ['transaction', tr('Transaksi', 'Transactions'), ListChecks]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`py-2 text-xs font-bold rounded-lg transition-all flex flex-col items-center gap-1 ${tab === key ? 'bg-surface text-emerald-400 shadow-sm' : 'text-muted hover:text-text'}`}>
            <Icon size={16} /> {label}
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
            { label: tr('Pendapatan', 'Income'), value: masked(totalIncome), Icon: TrendingUp, tone: hideBalance ? 'text-muted' : 'text-emerald-400 light:text-emerald-600' },
            { label: tr('Komitmen Dibayar', 'Commitments Paid'), value: masked(paidCommitment), Icon: CreditCard, tone: hideBalance ? 'text-muted' : 'text-amber-400 light:text-amber-600' },
            { label: tr('Perbelanjaan', 'Spending'), value: masked(totalExpenses), Icon: TrendingDown, tone: hideBalance ? 'text-muted' : 'text-rose-400 light:text-rose-600' },
          ]} />

          {/* Commitment checklist */}
          <div className="glass-panel p-4 space-y-2">
            <h3 className="font-bold text-sm flex items-center gap-2 mb-1"><CreditCard size={16} className="text-amber-400" /> {tr('Komitmen', 'Commitments')}</h3>
            
            <div className="flex items-center justify-between text-[10px] font-bold text-muted bg-text/5 rounded-lg p-2 mb-3">
              <div className="text-center flex-1 border-r border-text/10">
                {tr('Jumlah', 'Total')}<br/><span className="text-text text-xs">RM{fmt(totalCommitment)}</span>
              </div>
              <div className="text-center flex-1 border-r border-text/10">
                {tr('Dibayar', 'Paid')}<br/><span className="text-emerald-400 text-xs">RM{fmt(paidCommitment)}</span>
              </div>
              <div className="text-center flex-1">
                {tr('Baki', 'Left')}<br/><span className="text-amber-400 text-xs">RM{fmt(totalCommitment - paidCommitment)}</span>
              </div>
            </div>
            
            {monthCommitments.length === 0 ? (
              <p className="text-xs text-muted text-center py-3">{tr('Belum ada komitmen.', 'No commitments yet.')}</p>
            ) : monthCommitments.map(c => {
              const paid = !!c.payments[viewMonth];
              return (
                <div key={c.id} className="flex items-center gap-3 py-1">
                  <button onClick={() => paid ? undoPay(c.id) : openPay(c)} className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${paid ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-text/30 text-transparent'}`}><Check size={14} strokeWidth={3} /></button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${paid ? 'line-through text-text/50' : 'text-text/90'}`}>{c.title}</p>
                    <p className="text-[10px] text-muted">{tr('Hari', 'Day')} {c.paymentDay} · {catLabel(c.category, commitOptions)}{paid ? tr(` · dibayar ${fmtDate(c.payments[viewMonth])}`, ` · paid ${fmtDate(c.payments[viewMonth])}`) : ''}</p>
                  </div>
                  <span className={`font-mono text-sm font-bold ${paid ? 'text-text/50' : 'text-amber-400 light:text-amber-600'}`}>RM {fmt(paid ? paidFor(c, viewMonth) : scheduledFor(c, viewMonth))}</span>
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
              if (list.length === 0) return <p className="text-xs text-muted text-center py-3">{showMonth ? tr('Tiada perbelanjaan bulan ini.', 'No spending this month.') : tr('Tiada perbelanjaan hari ini.', 'No spending today.')}</p>;
              return list.map(e => (
                <div key={e.id} className="flex items-center gap-3 py-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColor(e.category, expenseOptions) }} />
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate text-text/90">{e.description}</p><p className="text-[10px] text-muted">{catLabel(e.category, expenseOptions)}{showMonth ? ` · ${fmtDate(e.date)}` : ''}</p></div>
                  <span className="font-mono text-sm font-bold text-rose-400 light:text-rose-600">−RM {fmt(e.amount)}</span>
                  <button onClick={() => openExpense(e)} aria-label={tr('Sunting perbelanjaan', 'Edit expense')} className="text-muted opacity-60 hover:opacity-100 hover:text-text p-1"><Pencil size={13} /></button>
                  <button onClick={() => deleteExpense(e)} aria-label={tr('Padam perbelanjaan', 'Delete expense')} className="text-rose-400 opacity-50 hover:opacity-100 p-1"><Trash2 size={13} /></button>
                </div>
              ));
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

          {/* 6-month net trend */}
          <div className="glass-panel p-4 space-y-2">
            <h3 className="font-bold text-sm flex items-center gap-2"><TrendingUp size={16} className="text-emerald-400" /> {tr('Trend Bersih 6 Bulan', '6-Month Net Trend')}</h3>
            <div className="flex gap-1.5 items-stretch" style={{ height: 112 }}>
              {netTrend.map(d => {
                const h = Math.round((Math.abs(d.net) / netMaxAbs) * 46);
                const isView = d.mk === viewMonth;
                return (
                  <div key={d.mk} className="flex-1 flex flex-col items-center min-w-0" title={`${monthLabel(d.mk)}: RM${fmt(d.net)}`}>
                    <span className={`text-[8px] font-mono mb-0.5 ${d.net < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{compact(d.net)}</span>
                    <div className="relative w-full flex-1 flex flex-col">
                      <div className="h-1/2 flex items-end justify-center">
                        {d.net >= 0 && <div className="w-3/5 rounded-t" style={{ height: h, backgroundColor: 'rgb(52 211 153)' }} />}
                      </div>
                      <div className="h-1/2 flex items-start justify-center border-t border-text/15">
                        {d.net < 0 && <div className="w-3/5 rounded-b" style={{ height: h, backgroundColor: 'rgb(248 113 113)' }} />}
                      </div>
                    </div>
                    <span className={`text-[9px] mt-1 ${isView ? 'text-emerald-400 font-bold' : 'text-muted'}`}>{MONTHS()[parseInt(d.mk.slice(5, 7)) - 1].slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* COMMITMENT */}
      {tab === 'commitment' && (
        <div className="space-y-3">
          <button onClick={() => openCForm()} className="w-full py-3 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-emerald-500/50 hover:text-emerald-400 transition-all flex items-center justify-center"><Plus size={18} className="mr-2" /> {tr('Tambah Komitmen', 'Add a Commitment')}</button>

          {activeCommitments.map(c => {
            const paid = !!c.payments[viewMonth];
            return (
              <div key={c.id} className="glass-panel p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-text/90 truncate">{c.title}</p>
                    <p className="text-[11px] text-muted">{tr('Hari', 'Day')} {c.paymentDay} · {catLabel(c.category, commitOptions)}</p>
                  </div>
                  <span className="font-mono font-bold text-amber-400 shrink-0">RM{fmt(c.amount)}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {paid ? (
                    <>
                      <span className="text-xs text-emerald-400 light:text-emerald-600 font-bold flex items-center gap-1"><Check size={14} /> {tr('Dibayar', 'Paid')} {fmtDate(c.payments[viewMonth])}{paidFor(c, viewMonth) !== scheduledFor(c, viewMonth) ? ` · RM ${fmt(paidFor(c, viewMonth))}` : ''}</span>
                      <button onClick={() => undoPay(c.id)} className="text-xs px-2 py-1 rounded-lg bg-text/5 text-muted hover:text-text flex items-center gap-1"><RotateCcw size={12} /> {tr('Buat asal', 'Undo')}</button>
                    </>
                  ) : (
                    <button onClick={() => openPay(c)} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1"><Check size={13} /> {tr('Tanda dibayar', 'Mark as paid')}</button>
                  )}
                  <button onClick={() => openCForm(c)} className="text-xs px-2 py-1 rounded-lg bg-text/5 text-muted hover:text-text flex items-center gap-1 ml-auto"><Pencil size={12} /> {tr('Sunting', 'Edit')}</button>
                  <button onClick={() => setDelCommit(c)} className="text-xs px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400"><Trash2 size={12} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INCOME */}
      {tab === 'income' && (
        <div className="space-y-3">
          <div className="glass-panel p-4 space-y-3">
            <input value={iTitle} onChange={e => setITitle(e.target.value)} placeholder={tr('Tajuk pendapatan (cth. Gaji)', 'Income title (e.g. Salary)')} className="input-field w-full" />
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

          <div className="glass-panel p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-sm">{monthLabel(viewMonth)}</h3>
              <span className="font-mono font-bold text-emerald-400">RM{fmt(totalIncome)}</span>
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
      {tab === 'transaction' && (
        <div className="space-y-4">
          <div className="flex p-1 bg-text/5 rounded-xl">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
              <button key={p} onClick={() => changePeriod(p)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${period === p ? 'bg-surface text-emerald-400 shadow-sm' : 'text-muted hover:text-text'}`}>{PERIOD_LABELS()[p]}</button>
            ))}
          </div>

          <div className="flex items-center justify-between px-1">
            <button onClick={() => { setTxOffset(o => o + 1); setTxLimit(TX_PAGE); }} className="p-1.5 rounded-lg bg-text/5 text-muted hover:text-text"><ChevronLeft size={18} /></button>
            <span className="text-sm font-bold text-text/90">{periodLabel}</span>
            <button onClick={() => { setTxOffset(o => Math.max(0, o - 1)); setTxLimit(TX_PAGE); }} disabled={txOffset === 0} className="p-1.5 rounded-lg bg-text/5 text-muted hover:text-text disabled:opacity-30"><ChevronRight size={18} /></button>
          </div>

          <StatStrip items={[
            { label: tr('Masuk', 'In'), value: `RM ${fmt(txIn)}`, Icon: TrendingUp, tone: 'text-emerald-400 light:text-emerald-600' },
            { label: tr('Keluar', 'Out'), value: `RM ${fmt(txOut)}`, Icon: TrendingDown, tone: 'text-rose-400 light:text-rose-600' },
            { label: tr('Bersih', 'Net'), value: `RM ${fmt(txIn - txOut)}`, Icon: Wallet, tone: txIn - txOut < 0 ? 'text-rose-400 light:text-rose-600' : 'text-text' },
          ]} />

          {/* Spending by category */}
          <div className="glass-panel p-4 space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2"><PieChart size={16} className="text-emerald-400 light:text-emerald-600" /> {tr('Perbelanjaan Ikut Kategori', 'Spending by Category')}</h3>
            {catRows.length === 0 ? (
              <p className="text-xs text-muted text-center py-3">{tr(`Tiada perbelanjaan dalam ${periodLabel.toLowerCase()}.`, `No spending in ${periodLabel.toLowerCase()}.`)}</p>
            ) : catRows.map(([cat, amt]) => {
              const pct = txOut > 0 ? (amt / txOut) * 100 : 0;
              const color = catColor(cat, allOptions);
              const Icon = catIcon(cat, allOptions);
              return (
                <div key={cat} className="flex items-center gap-2.5">
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
                </div>
              );
            })}
          </div>

          {/* History — grouped by day, each row led by its category icon */}
          <div className="glass-panel p-4">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <h3 className="font-bold text-sm">{tr('Sejarah', 'History')} · {periodLabel}</h3>
              {foundTxns.length > 0 && <span className="text-[10px] text-muted shrink-0">{tr(`${foundTxns.length} transaksi`, `${foundTxns.length} transactions`)}</span>}
            </div>

            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                value={txQuery}
                onChange={e => { setTxQuery(e.target.value); setTxLimit(TX_PAGE); }}
                placeholder={tr('Cari nama atau kategori', 'Search a name or category')}
                className="input-field w-full text-sm py-2 pl-9 pr-9"
              />
              {txQuery && (
                <button onClick={() => { setTxQuery(''); setTxLimit(TX_PAGE); }} aria-label={tr('Kosongkan carian', 'Clear the search')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-text">
                  <X size={14} />
                </button>
              )}
            </div>

            {foundTxns.length === 0 ? (
              <p className="text-xs text-muted text-center py-3">{txq ? tr(`Tiada padanan untuk "${txQuery.trim()}".`, `No match for "${txQuery.trim()}".`) : tr('Tiada transaksi.', 'No transactions.')}</p>
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
              <CategoryPicker options={expenseOptions} value={eCat} onSelect={setECat} onAdd={addExpenseCat} onRemove={removeExpenseCat} defaults={DEFAULT_EXPENSE_CATS} accent={accent} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">{tr('Tarikh', 'Date')}</label>
              <input type="date" value={eDate} max={todayKey} onChange={e => setEDate(e.target.value)} className="input-field w-full" />
            </div>
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
