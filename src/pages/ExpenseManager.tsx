import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Wallet, Plus, Trash2, Check, X, ChevronLeft, ChevronRight, Pencil, Archive, RotateCcw,
  TrendingUp, TrendingDown, PieChart, ListChecks, CreditCard, Coins, ArchiveRestore, CalendarDays
} from 'lucide-react';

interface Expense { id: string; description: string; amount: number; category: string; date: string; }
interface Income { id: string; title: string; amount: number; recurring: boolean; date: string; startMonth?: string; endMonth?: string; day?: number; }
interface Commitment {
  id: string; title: string; amount: number; paymentDay: number; category: string;
  archived: boolean; payments: Record<string, string>; // 'YYYY-MM' -> 'YYYY-MM-DD'
}

const STORAGE_KEY = 'expense_manager_data';
const DEFAULT_EXPENSE_CATS = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other'];
const DEFAULT_COMMIT_CATS = ['Loan', 'Subscription', 'Utilities', 'Insurance', 'Rent', 'Other'];
const CAT_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ec4899', '#8b5cf6', '#14b8a6', '#eab308', '#ef4444', '#06b6d4', '#a855f7'];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthOf = (key: string) => key.slice(0, 7);
const monthLabel = (mk: string) => { const [y, m] = mk.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const addMonth = (mk: string, delta: number) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const daysInMonth = (mk: string) => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const generateId = () => Math.random().toString(36).substring(2, 9);
const catColor = (cat: string, all: string[]) => CAT_COLORS[Math.max(0, all.indexOf(cat)) % CAT_COLORS.length];
// Is an income counted in a given month? Recurring incomes are effective-dated.
const incomeActive = (i: Income, mk: string) => {
  if (!i.recurring) return monthOf(i.date) === mk;
  if (i.startMonth && mk < i.startMonth) return false;
  if (i.endMonth && mk > i.endMonth) return false;
  return true;
};

const ExpenseManager: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [expenseCats, setExpenseCats] = useState<string[]>(DEFAULT_EXPENSE_CATS);
  const [commitCats, setCommitCats] = useState<string[]>(DEFAULT_COMMIT_CATS);
  const [isLoaded, setIsLoaded] = useState(false);

  const [tab, setTab] = useState<'dashboard' | 'commitment' | 'income' | 'transaction'>('dashboard');
  const today = new Date();
  const todayKey = dateKey(today);
  const currentMonth = monthOf(todayKey);
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const isPastView = viewMonth < currentMonth;

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (Array.isArray(p.expenses)) setExpenses(p.expenses);
        if (Array.isArray(p.incomes)) setIncomes(p.incomes);
        if (Array.isArray(p.commitments)) setCommitments(p.commitments);
        if (Array.isArray(p.expenseCats)) setExpenseCats(p.expenseCats);
        if (Array.isArray(p.commitCats)) setCommitCats(p.commitCats);
      } catch (e) {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) localStorage.setItem(STORAGE_KEY, JSON.stringify({ expenses, incomes, commitments, expenseCats, commitCats }));
  }, [expenses, incomes, commitments, expenseCats, commitCats, isLoaded]);

  // --- Derived for the viewed month ---
  const activeCommitments = commitments.filter(c => !c.archived);
  // Commitments to show for the viewed month: active ones (ongoing obligation) plus
  // archived ones that were actually paid that month (keep the history).
  const monthCommitments = commitments.filter(c => !c.archived || !!c.payments[viewMonth]);
  const monthExpenses = expenses.filter(e => monthOf(e.date) === viewMonth);
  const monthIncomes = incomes.filter(i => incomeActive(i, viewMonth));
  // Whether the income has actually been received (reached its pay day) in this month
  const incomeReceived = (i: Income, mk: string) => {
    if (!i.recurring) return i.date <= todayKey;
    if (mk < currentMonth) return true;
    if (mk > currentMonth) return false;
    // Clamp the pay day to the month's last day (e.g. day 31 falls on Feb 28)
    return today.getDate() >= Math.min(i.day || 1, daysInMonth(mk));
  };
  const totalIncome = monthIncomes.reduce((s, i) => s + i.amount, 0);
  const receivedIncome = monthIncomes.filter(i => incomeReceived(i, viewMonth)).reduce((s, i) => s + i.amount, 0);
  const pendingIncome = totalIncome - receivedIncome;
  const totalCommitment = monthCommitments.reduce((s, c) => s + c.amount, 0);
  const paidCommitment = commitments.filter(c => c.payments[viewMonth]).reduce((s, c) => s + c.amount, 0);
  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const balance = receivedIncome - paidCommitment - totalExpenses;

  const prevMonth = addMonth(viewMonth, -1);
  const prevIncome = incomes.filter(i => incomeActive(i, prevMonth)).reduce((s, i) => s + i.amount, 0);
  const prevExpense = expenses.filter(e => monthOf(e.date) === prevMonth).reduce((s, e) => s + e.amount, 0);
  const prevPaid = commitments.filter(c => c.payments[prevMonth]).reduce((s, c) => s + c.amount, 0);
  const prevNet = prevIncome - prevPaid - prevExpense;

  const todayExpenses = expenses.filter(e => e.date === todayKey);

  // --- Expense modal ---
  const [showExpense, setShowExpense] = useState(false);
  const [eDesc, setEDesc] = useState('');
  const [eAmount, setEAmount] = useState('');
  const [eCat, setECat] = useState(DEFAULT_EXPENSE_CATS[0]);
  const [eDate, setEDate] = useState(todayKey);
  const openExpense = () => { setEDesc(''); setEAmount(''); setECat(expenseCats[0]); setEDate(todayKey); setShowExpense(true); };
  const saveExpense = () => {
    const amount = parseFloat(eAmount);
    if (!eDesc.trim() || isNaN(amount) || amount <= 0) return;
    setExpenses(prev => [{ id: generateId(), description: eDesc.trim(), amount, category: eCat, date: eDate }, ...prev]);
    setShowExpense(false);
  };
  const deleteExpense = (id: string) => setExpenses(prev => prev.filter(e => e.id !== id));

  const addExpenseCat = (c: string) => { const v = c.trim(); if (v && !expenseCats.includes(v)) setExpenseCats(prev => [...prev, v]); setECat(v); };

  // --- Commitment add/edit ---
  const [cForm, setCForm] = useState<{ id: string | null; title: string; amount: string; day: string; category: string }>({ id: null, title: '', amount: '', day: '1', category: DEFAULT_COMMIT_CATS[0] });
  const [showCForm, setShowCForm] = useState(false);
  const openCForm = (c?: Commitment) => {
    if (c) setCForm({ id: c.id, title: c.title, amount: String(c.amount), day: String(c.paymentDay), category: c.category });
    else setCForm({ id: null, title: '', amount: '', day: '1', category: commitCats[0] });
    setShowCForm(true);
  };
  const saveCForm = () => {
    const amount = parseFloat(cForm.amount);
    const day = Math.min(31, Math.max(1, parseInt(cForm.day) || 1));
    if (!cForm.title.trim() || isNaN(amount) || amount <= 0) return;
    if (cForm.id) {
      setCommitments(prev => prev.map(c => c.id === cForm.id ? { ...c, title: cForm.title.trim(), amount, paymentDay: day, category: cForm.category } : c));
    } else {
      setCommitments(prev => [...prev, { id: generateId(), title: cForm.title.trim(), amount, paymentDay: day, category: cForm.category, archived: false, payments: {} }]);
    }
    setShowCForm(false);
  };
  const addCommitCat = (c: string) => { const v = c.trim(); if (v && !commitCats.includes(v)) setCommitCats(prev => [...prev, v]); setCForm(f => ({ ...f, category: v })); };
  const archiveCommitment = (id: string, val: boolean) => setCommitments(prev => prev.map(c => c.id === id ? { ...c, archived: val } : c));
  const deleteCommitment = (id: string) => { if (window.confirm('Delete this commitment and its payment history?')) setCommitments(prev => prev.filter(c => c.id !== id)); };

  // --- Commitment payment confirm ---
  const [payTarget, setPayTarget] = useState<Commitment | null>(null);
  const [payDate, setPayDate] = useState(todayKey);
  const openPay = (c: Commitment) => { setPayTarget(c); setPayDate(todayKey); };
  const confirmPay = () => {
    if (!payTarget) return;
    setCommitments(prev => prev.map(c => c.id === payTarget.id ? { ...c, payments: { ...c.payments, [viewMonth]: payDate } } : c));
    setPayTarget(null);
  };
  const undoPay = (id: string) => setCommitments(prev => prev.map(c => c.id === id ? { ...c, payments: Object.fromEntries(Object.entries(c.payments).filter(([k]) => k !== viewMonth)) } : c));

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

  // --- Edit income (handles raises: change going forward, keep past) ---
  const [editIncome, setEditIncome] = useState<Income | null>(null);
  const [ieTitle, setIeTitle] = useState('');
  const [ieAmount, setIeAmount] = useState('');
  const openIncomeEdit = (i: Income) => { setEditIncome(i); setIeTitle(i.title); setIeAmount(String(i.amount)); };
  const saveIncomeEdit = (scope: 'all' | 'forward') => {
    if (!editIncome) return;
    const amount = parseFloat(ieAmount);
    const title = ieTitle.trim();
    if (!title || isNaN(amount) || amount <= 0) return;

    if (!editIncome.recurring || scope === 'all') {
      setIncomes(prev => prev.map(i => i.id === editIncome.id ? { ...i, title, amount } : i));
    } else {
      // "From this month onward": cap the old record at the previous month, add a new one.
      const start = editIncome.startMonth || '';
      if (start && start >= viewMonth) {
        // It already starts this month or later — just update it in place.
        setIncomes(prev => prev.map(i => i.id === editIncome.id ? { ...i, title, amount, startMonth: viewMonth } : i));
      } else {
        const prevM = addMonth(viewMonth, -1);
        setIncomes(prev => [
          { id: generateId(), title, amount, recurring: true, date: `${viewMonth}-01`, startMonth: viewMonth, ...(editIncome.day ? { day: editIncome.day } : {}), ...(editIncome.endMonth ? { endMonth: editIncome.endMonth } : {}) },
          ...prev.map(i => i.id === editIncome.id ? { ...i, endMonth: prevM } : i),
        ]);
      }
    }
    setEditIncome(null);
  };

  // --- Transaction tab ---
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [txOffset, setTxOffset] = useState(0); // periods back from now (0 = current)
  const changePeriod = (p: 'daily' | 'weekly' | 'monthly') => { setPeriod(p); setTxOffset(0); };
  const shortDay = (d: Date) => `${pad(d.getDate())} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  // Selected window based on period + offset
  const selDay = new Date(today); selDay.setDate(today.getDate() - txOffset);
  const selWeekStart = new Date(today); selWeekStart.setDate(today.getDate() - today.getDay() - txOffset * 7);
  const selWeekEnd = new Date(selWeekStart); selWeekEnd.setDate(selWeekStart.getDate() + 6);
  const selMonth = addMonth(currentMonth, -txOffset);
  const inRange = (key: string) => {
    if (period === 'daily') return key === dateKey(selDay);
    if (period === 'weekly') return key >= dateKey(selWeekStart) && key <= dateKey(selWeekEnd);
    return monthOf(key) === selMonth;
  };
  const periodLabel = period === 'daily'
    ? (txOffset === 0 ? 'Today' : `${shortDay(selDay)} ${selDay.getFullYear()}`)
    : period === 'weekly'
      ? `${shortDay(selWeekStart)} – ${shortDay(selWeekEnd)}`
      : monthLabel(selMonth);
  type Txn = { id: string; date: string; label: string; amount: number; type: 'in' | 'out'; category?: string };
  const txns: Txn[] = [];
  expenses.forEach(e => { if (inRange(e.date)) txns.push({ id: 'e' + e.id, date: e.date, label: e.description, amount: e.amount, type: 'out', category: e.category }); });
  commitments.forEach(c => Object.entries(c.payments).forEach(([, d]) => { if (inRange(d)) txns.push({ id: 'c' + c.id + d, date: d, label: c.title, amount: c.amount, type: 'out', category: c.category }); }));
  incomes.forEach(i => {
    if (period === 'monthly') { if (incomeReceived(i, selMonth)) txns.push({ id: 'i' + i.id, date: i.date, label: i.title, amount: i.amount, type: 'in' }); }
    else if (!i.recurring && inRange(i.date)) txns.push({ id: 'i' + i.id, date: i.date, label: i.title, amount: i.amount, type: 'in' });
  });
  txns.sort((a, b) => b.date.localeCompare(a.date));
  const txIn = txns.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const txOut = txns.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const spendByCat: Record<string, number> = {};
  txns.filter(t => t.type === 'out').forEach(t => { const k = t.category || 'Other'; spendByCat[k] = (spendByCat[k] || 0) + t.amount; });
  const catRows = Object.entries(spendByCat).sort((a, b) => b[1] - a[1]);

  // --- Reusable category chips ---
  const CategoryChips = ({ cats, value, onSelect, onAdd, accent }: { cats: string[]; value: string; onSelect: (c: string) => void; onAdd: (c: string) => void; accent: string }) => {
    const [adding, setAdding] = useState(false);
    const [val, setVal] = useState('');
    return (
      <div className="flex flex-wrap gap-1.5">
        {cats.map(c => (
          <button key={c} type="button" onClick={() => onSelect(c)} className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${value === c ? 'text-white' : 'text-muted border-text/10 hover:text-text'}`} style={value === c ? { backgroundColor: accent, borderColor: accent } : {}}>{c}</button>
        ))}
        {adding ? (
          <span className="flex items-center gap-1">
            <input autoFocus value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { onAdd(val); setVal(''); setAdding(false); } }} placeholder="New" className="input-field py-1 text-xs w-20" />
            <button type="button" onClick={() => { onAdd(val); setVal(''); setAdding(false); }} className="text-emerald-400"><Check size={16} /></button>
          </span>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="px-2 py-1 rounded-lg text-xs font-bold border border-dashed border-text/20 text-muted hover:text-text">+ New</button>
        )}
      </div>
    );
  };

  const accent = 'rgb(16 185 129)'; // emerald base for this tool

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center space-x-3 px-1">
        <div className="p-3 bg-emerald-500/20 rounded-xl"><Wallet className="text-emerald-400" size={26} /></div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text/90">Expense Manager</h1>
          <p className="text-[10px] text-muted uppercase tracking-wider">Income · Commitments · Spending</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-text/5 rounded-xl">
        {([['dashboard', 'Home', PieChart], ['commitment', 'Commit', CreditCard], ['income', 'Income', Coins], ['transaction', 'Txns', ListChecks]] as const).map(([key, label, Icon]) => (
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
          <button onClick={() => setViewMonth(m => addMonth(m, 1))} className="p-1.5 rounded-lg bg-text/5 text-muted hover:text-text"><ChevronRight size={18} /></button>
        </div>
      )}

      {/* DASHBOARD */}
      {tab === 'dashboard' && (
        <div className="space-y-4">
          <div className="glass-panel p-5 text-center bg-gradient-to-br from-emerald-500/15 to-transparent">
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider">Balance</p>
            <p className={`text-3xl font-black font-mono mt-1 ${balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>RM{fmt(balance)}</p>
            {pendingIncome > 0 && <p className="text-[10px] text-amber-400 mt-1">+RM{fmt(pendingIncome)} income not received yet</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="glass-panel p-3 text-center">
              <p className="text-[9px] font-bold text-muted uppercase">Income</p>
              <p className="text-sm font-black text-emerald-400 font-mono mt-1">{fmt(totalIncome)}</p>
            </div>
            <div className="glass-panel p-3 text-center">
              <p className="text-[9px] font-bold text-muted uppercase">Commit</p>
              <p className="text-sm font-black text-amber-400 font-mono mt-1">{fmt(totalCommitment)}</p>
            </div>
            <div className="glass-panel p-3 text-center">
              <p className="text-[9px] font-bold text-muted uppercase">Expenses</p>
              <p className="text-sm font-black text-red-400 font-mono mt-1">{fmt(totalExpenses)}</p>
            </div>
          </div>

          {/* Commitment checklist */}
          <div className="glass-panel p-4 space-y-2">
            <h3 className="font-bold text-sm flex items-center gap-2"><CreditCard size={16} className="text-amber-400" /> Commitments</h3>
            {monthCommitments.length === 0 ? (
              <p className="text-xs text-muted text-center py-3">No commitments yet.</p>
            ) : monthCommitments.map(c => {
              const paid = !!c.payments[viewMonth];
              return (
                <div key={c.id} className="flex items-center gap-3 py-1">
                  <button onClick={() => paid ? undoPay(c.id) : openPay(c)} className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${paid ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-text/30 text-transparent'}`}><Check size={14} strokeWidth={3} /></button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${paid ? 'line-through text-text/50' : 'text-text/90'}`}>{c.title}</p>
                    <p className="text-[10px] text-muted">Day {c.paymentDay} · {c.category}{paid ? ` · paid ${c.payments[viewMonth]}` : ''}{c.archived ? ' · archived' : ''}</p>
                  </div>
                  <span className={`font-mono text-sm font-bold ${paid ? 'text-text/50' : 'text-amber-400'}`}>RM{fmt(c.amount)}</span>
                </div>
              );
            })}
          </div>

          {/* Today's expenses */}
          <div className="glass-panel p-4 space-y-2">
            <h3 className="font-bold text-sm flex items-center gap-2"><CalendarDays size={16} className="text-red-400" /> Today's Expenses</h3>
            {todayExpenses.length === 0 ? (
              <p className="text-xs text-muted text-center py-3">Nothing spent today.</p>
            ) : todayExpenses.map(e => (
              <div key={e.id} className="flex items-center gap-3 py-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColor(e.category, expenseCats) }} />
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate text-text/90">{e.description}</p><p className="text-[10px] text-muted">{e.category}</p></div>
                <span className="font-mono text-sm font-bold text-red-400">-RM{fmt(e.amount)}</span>
                <button onClick={() => deleteExpense(e.id)} className="text-rose-400 opacity-50 hover:opacity-100 p-1"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>

          {/* Last month overview */}
          <div className="glass-panel p-4">
            <h3 className="font-bold text-sm mb-2">{monthLabel(prevMonth)} Overview</h3>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-emerald-400">+RM{fmt(prevIncome)}</span>
              <span className="text-red-400">-RM{fmt(prevExpense + prevPaid)}</span>
              <span className={prevNet < 0 ? 'text-red-400 font-bold' : 'text-text/90 font-bold'}>Net RM{fmt(prevNet)}</span>
            </div>
          </div>
        </div>
      )}

      {/* COMMITMENT */}
      {tab === 'commitment' && (
        <div className="space-y-3">
          {activeCommitments.map(c => {
            const paid = !!c.payments[viewMonth];
            return (
              <div key={c.id} className="glass-panel p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-text/90 truncate">{c.title}</p>
                    <p className="text-[11px] text-muted">Day {c.paymentDay} · {c.category}</p>
                  </div>
                  <span className="font-mono font-bold text-amber-400 shrink-0">RM{fmt(c.amount)}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {paid ? (
                    <>
                      <span className="text-xs text-emerald-400 font-bold flex items-center gap-1"><Check size={14} /> Paid {c.payments[viewMonth]}</span>
                      <button onClick={() => undoPay(c.id)} className="text-xs px-2 py-1 rounded-lg bg-text/5 text-muted hover:text-text flex items-center gap-1"><RotateCcw size={12} /> Undo</button>
                    </>
                  ) : (
                    <button onClick={() => openPay(c)} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1"><Check size={13} /> Mark paid</button>
                  )}
                  <button onClick={() => openCForm(c)} className="text-xs px-2 py-1 rounded-lg bg-text/5 text-muted hover:text-text flex items-center gap-1 ml-auto"><Pencil size={12} /> Edit</button>
                  <button onClick={() => archiveCommitment(c.id, true)} className="text-xs px-2 py-1 rounded-lg bg-text/5 text-muted hover:text-text flex items-center gap-1"><Archive size={12} /></button>
                  <button onClick={() => deleteCommitment(c.id)} className="text-xs px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400"><Trash2 size={12} /></button>
                </div>
              </div>
            );
          })}

          <button onClick={() => openCForm()} className="w-full py-3 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-emerald-500/50 hover:text-emerald-400 transition-all flex items-center justify-center"><Plus size={18} className="mr-2" /> Add Commitment</button>

          {commitments.some(c => c.archived) && (
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1">Archived</h3>
              {commitments.filter(c => c.archived).map(c => (
                <div key={c.id} className="glass-panel p-3 flex items-center justify-between opacity-60">
                  <div className="min-w-0"><p className="font-medium truncate text-sm">{c.title}</p><p className="text-[10px] text-muted">{c.category}</p></div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs">RM{fmt(c.amount)}</span>
                    <button onClick={() => archiveCommitment(c.id, false)} className="text-muted hover:text-emerald-400" title="Restore"><ArchiveRestore size={15} /></button>
                    <button onClick={() => deleteCommitment(c.id)} className="text-rose-400"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* INCOME */}
      {tab === 'income' && (
        <div className="space-y-3">
          <div className="glass-panel p-4 space-y-3">
            <input value={iTitle} onChange={e => setITitle(e.target.value)} placeholder="Income title (e.g. Salary)" className="input-field w-full" />
            <div className="flex gap-2">
              <input type="number" value={iAmount} onChange={e => setIAmount(e.target.value)} placeholder="Amount" className="input-field flex-1 font-mono" />
              <button
                onClick={() => !isPastView && setIRecurring(r => !r)}
                disabled={isPastView}
                className={`px-3 rounded-xl text-xs font-bold border ${iRecurring && !isPastView ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-text/5 text-muted border-text/10'} ${isPastView ? 'opacity-50' : ''}`}
              >
                {iRecurring && !isPastView ? '🔁 Recurring' : 'One-time'}
              </button>
            </div>
            {iRecurring && !isPastView && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-muted">Pay day</label>
                  <input type="number" min={1} max={31} value={iDay} onChange={e => setIDay(e.target.value)} className={`input-field w-16 font-mono py-1.5 text-center ${payDayInvalid ? 'border-red-500/60 focus:ring-red-500/40' : ''}`} />
                  <span className="text-[10px] text-muted">Counts in balance from this day each month</span>
                </div>
                {payDayInvalid && <p className="text-[10px] text-red-400">Pay day must be between 1 and 31.</p>}
              </div>
            )}
            {isPastView && <p className="text-[10px] text-amber-400">Past month — will be saved as a one-time income for {monthLabel(viewMonth)}.</p>}
            <button onClick={addIncome} disabled={payDayInvalid} className="w-full py-2.5 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 disabled:opacity-40 disabled:pointer-events-none">Add Income</button>
          </div>

          <div className="glass-panel p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-sm">{monthLabel(viewMonth)}</h3>
              <span className="font-mono font-bold text-emerald-400">RM{fmt(totalIncome)}</span>
            </div>
            {monthIncomes.length === 0 ? (
              <p className="text-xs text-muted text-center py-3">No income this month.</p>
            ) : monthIncomes.map(i => {
              const received = incomeReceived(i, viewMonth);
              return (
              <div key={i.id} className="flex items-center gap-3 py-1.5 border-t border-white/5 first:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-text/90">{i.title}</p>
                  {i.recurring && <p className="text-[10px] text-emerald-400">🔁 Recurring{i.day ? ` · day ${i.day}` : ''}{i.startMonth ? ` · from ${monthLabel(i.startMonth)}` : ''}</p>}
                  {!received && <p className="text-[10px] text-amber-400">Not received yet</p>}
                </div>
                <span className={`font-mono text-sm font-bold ${received ? 'text-emerald-400' : 'text-amber-400/70'}`}>+RM{fmt(i.amount)}</span>
                <button onClick={() => openIncomeEdit(i)} className="text-muted hover:text-text p-1"><Pencil size={13} /></button>
                <button onClick={() => deleteIncome(i.id)} className="text-rose-400 opacity-50 hover:opacity-100 p-1"><Trash2 size={13} /></button>
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
            {(['daily', 'weekly', 'monthly'] as const).map(p => (
              <button key={p} onClick={() => changePeriod(p)} className={`flex-1 py-2 text-sm font-bold rounded-lg capitalize transition-all ${period === p ? 'bg-surface text-emerald-400 shadow-sm' : 'text-muted hover:text-text'}`}>{p}</button>
            ))}
          </div>

          <div className="flex items-center justify-between px-1">
            <button onClick={() => setTxOffset(o => o + 1)} className="p-1.5 rounded-lg bg-text/5 text-muted hover:text-text"><ChevronLeft size={18} /></button>
            <span className="text-sm font-bold text-text/90">{periodLabel}</span>
            <button onClick={() => setTxOffset(o => Math.max(0, o - 1))} disabled={txOffset === 0} className="p-1.5 rounded-lg bg-text/5 text-muted hover:text-text disabled:opacity-30"><ChevronRight size={18} /></button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="glass-panel p-3 text-center"><p className="text-[9px] font-bold text-muted uppercase flex items-center justify-center gap-1"><TrendingUp size={11} /> In</p><p className="text-sm font-black text-emerald-400 font-mono mt-1">{fmt(txIn)}</p></div>
            <div className="glass-panel p-3 text-center"><p className="text-[9px] font-bold text-muted uppercase flex items-center justify-center gap-1"><TrendingDown size={11} /> Out</p><p className="text-sm font-black text-red-400 font-mono mt-1">{fmt(txOut)}</p></div>
            <div className="glass-panel p-3 text-center"><p className="text-[9px] font-bold text-muted uppercase">Net</p><p className={`text-sm font-black font-mono mt-1 ${txIn - txOut < 0 ? 'text-red-400' : 'text-text/90'}`}>{fmt(txIn - txOut)}</p></div>
          </div>

          {/* Spending by category */}
          <div className="glass-panel p-4 space-y-2">
            <h3 className="font-bold text-sm flex items-center gap-2"><PieChart size={16} className="text-emerald-400" /> Spending by Category</h3>
            {catRows.length === 0 ? (
              <p className="text-xs text-muted text-center py-3">No spending in {periodLabel.toLowerCase()}.</p>
            ) : catRows.map(([cat, amt]) => {
              const pct = txOut > 0 ? (amt / txOut) * 100 : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs"><span className="text-text/80">{cat}</span><span className="font-mono text-muted">RM{fmt(amt)} · {pct.toFixed(0)}%</span></div>
                  <div className="h-1.5 bg-black/20 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: catColor(cat, expenseCats.concat(commitCats)) }} /></div>
                </div>
              );
            })}
          </div>

          {/* History */}
          <div className="glass-panel p-4 space-y-1">
            <h3 className="font-bold text-sm mb-1">History · {periodLabel}</h3>
            {txns.length === 0 ? (
              <p className="text-xs text-muted text-center py-3">No transactions.</p>
            ) : txns.map(t => (
              <div key={t.id} className="flex items-center gap-3 py-1.5 border-t border-white/5 first:border-0">
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate text-text/90">{t.label}</p><p className="text-[10px] text-muted">{t.date}{t.category ? ` · ${t.category}` : ''}</p></div>
                <span className={`font-mono text-sm font-bold ${t.type === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>{t.type === 'in' ? '+' : '-'}RM{fmt(t.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating add-expense button (dashboard only) */}
      {tab === 'dashboard' && (
        <button onClick={openExpense} className="fixed bottom-24 right-4 sm:absolute z-30 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/30 flex items-center justify-center active:scale-90 transition-transform" title="Add expense">
          <Plus size={26} />
        </button>
      )}

      {/* Add Expense modal */}
      {showExpense && createPortal((
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowExpense(false)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold text-lg">Add Expense</h3><button onClick={() => setShowExpense(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button></div>
            <input autoFocus value={eDesc} onChange={e => setEDesc(e.target.value)} placeholder="Description" className="input-field w-full" />
            <input type="number" value={eAmount} onChange={e => setEAmount(e.target.value)} placeholder="Amount (RM)" className="input-field w-full font-mono text-lg" />
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Category</label>
              <CategoryChips cats={expenseCats} value={eCat} onSelect={setECat} onAdd={addExpenseCat} accent={accent} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Date</label>
              <input type="date" value={eDate} max={todayKey} onChange={e => setEDate(e.target.value)} className="input-field w-full" />
            </div>
            <button onClick={saveExpense} className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600">Save Expense</button>
          </div>
        </div>
      ), document.body)}

      {/* Commitment add/edit modal */}
      {showCForm && createPortal((
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowCForm(false)}>
          <div className="bg-surface border border-text/10 rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold text-lg">{cForm.id ? 'Edit' : 'Add'} Commitment</h3><button onClick={() => setShowCForm(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button></div>
            <input autoFocus value={cForm.title} onChange={e => setCForm(f => ({ ...f, title: e.target.value }))} placeholder="Title (e.g. Car loan)" className="input-field w-full" />
            <div className="flex gap-2">
              <input type="number" value={cForm.amount} onChange={e => setCForm(f => ({ ...f, amount: e.target.value }))} placeholder="Amount" className="input-field flex-1 font-mono" />
              <input type="number" min={1} max={31} value={cForm.day} onChange={e => setCForm(f => ({ ...f, day: e.target.value }))} placeholder="Day" className="input-field w-20 font-mono" title="Payment day of month" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Category</label>
              <CategoryChips cats={commitCats} value={cForm.category} onSelect={c => setCForm(f => ({ ...f, category: c }))} onAdd={addCommitCat} accent="rgb(245 158 11)" />
            </div>
            <button onClick={saveCForm} className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600">{cForm.id ? 'Save Changes' : 'Add Commitment'}</button>
          </div>
        </div>
      ), document.body)}

      {/* Edit income modal */}
      {editIncome && createPortal((
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setEditIncome(null)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold text-lg">Edit Income</h3><button onClick={() => setEditIncome(null)} className="p-1 text-muted hover:text-text"><X size={20} /></button></div>
            <input autoFocus value={ieTitle} onChange={e => setIeTitle(e.target.value)} placeholder="Title" className="input-field w-full" />
            <input type="number" value={ieAmount} onChange={e => setIeAmount(e.target.value)} placeholder="Amount" className="input-field w-full font-mono text-lg" />
            {editIncome.recurring ? (
              <div className="space-y-2">
                <p className="text-xs text-muted">This is recurring income. How should the change apply?</p>
                <button onClick={() => saveIncomeEdit('forward')} className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600">Apply from {monthLabel(viewMonth)} (keep past)</button>
                <button onClick={() => saveIncomeEdit('all')} className="w-full py-2.5 rounded-xl bg-text/5 text-text font-bold hover:bg-text/10">Change all months</button>
              </div>
            ) : (
              <button onClick={() => saveIncomeEdit('all')} className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600">Save</button>
            )}
          </div>
        </div>
      ), document.body)}

      {/* Confirm payment modal */}
      {payTarget && createPortal((
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setPayTarget(null)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">Confirm Payment</h3>
            <p className="text-sm text-muted">{payTarget.title} · <span className="font-mono font-bold text-amber-400">RM{fmt(payTarget.amount)}</span></p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Payment date</label>
              <input type="date" value={payDate} max={todayKey} onChange={e => setPayDate(e.target.value)} className="input-field w-full" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPayTarget(null)} className="flex-1 py-3 rounded-xl bg-text/5 text-text font-bold">Cancel</button>
              <button onClick={confirmPay} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600">Confirm Paid</button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
};

export default ExpenseManager;
