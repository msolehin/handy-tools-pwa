import React, { useState, useEffect } from 'react';
import { 
  Calculator, Landmark, Wallet, PiggyBank, Briefcase, 
  Tag, Calendar, RefreshCw, Plus, Trash2, Clock
} from 'lucide-react';

type TabType = 'loan' | 'commitment' | 'savings' | 'salary' | 'discount';

// ==========================================
// 1. LOAN CALCULATOR
// ==========================================
type TermType = 'years' | 'months';

const LoanTab = () => {
  const [principal, setPrincipal] = useState(() => localStorage.getItem('lc_principal') || '');
  const [rate, setRate] = useState(() => localStorage.getItem('lc_rate') || '');
  const [term, setTerm] = useState(() => localStorage.getItem('lc_term') || '');
  const [termType, setTermType] = useState<TermType>(() => (localStorage.getItem('lc_termType') as TermType) || 'years');

  useEffect(() => { localStorage.setItem('lc_principal', principal); }, [principal]);
  useEffect(() => { localStorage.setItem('lc_rate', rate); }, [rate]);
  useEffect(() => { localStorage.setItem('lc_term', term); }, [term]);
  useEffect(() => { localStorage.setItem('lc_termType', termType); }, [termType]);

  const handleReset = () => {
    if (window.confirm("Reset all inputs?")) {
      setPrincipal(''); setRate(''); setTerm(''); setTermType('years');
      ['lc_principal', 'lc_rate', 'lc_term', 'lc_termType'].forEach(k => localStorage.removeItem(k));
    }
  };

  const pVal = parseFloat(principal) || 0;
  const rValAnnual = parseFloat(rate) || 0;
  const tVal = parseFloat(term) || 0;

  let monthlyPayment = 0;
  let totalPayment = 0;
  let totalInterest = 0;

  if (pVal > 0 && tVal > 0) {
    const months = termType === 'years' ? tVal * 12 : tVal;
    if (rValAnnual > 0) {
      const monthlyRate = rValAnnual / 100 / 12;
      const mathPower = Math.pow(1 + monthlyRate, months);
      monthlyPayment = (pVal * (monthlyRate * mathPower)) / (mathPower - 1);
    } else {
      monthlyPayment = pVal / months;
    }
    totalPayment = monthlyPayment * months;
    totalInterest = totalPayment - pVal;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center px-1">
        <h3 className="font-bold text-lg">Loan Calculator</h3>
        <button onClick={handleReset} className="text-xs flex items-center text-muted hover:text-white transition-colors">
          <RefreshCw size={12} className="mr-1" /> Reset
        </button>
      </div>

      <div className="glass-panel p-5">
        <label className="block text-sm font-medium text-muted mb-2">Loan Amount (RM)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">RM</span>
          <input type="number" min="0" step="0.01" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="10000" className="input-field pl-10 w-full" />
        </div>
      </div>

      <div className="glass-panel p-5">
        <label className="block text-sm font-medium text-muted mb-2">Interest Rate (Annual %)</label>
        <div className="relative">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">%</span>
          <input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="5.5" className="input-field pr-10 w-full" />
        </div>
      </div>

      <div className="glass-panel p-5">
        <label className="block text-sm font-medium text-muted mb-2">Loan Term</label>
        <div className="flex space-x-2">
          <input type="number" min="0" step="0.1" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="30" className="input-field flex-1" />
          <select value={termType} onChange={(e) => setTermType(e.target.value as TermType)} className="input-field w-32 appearance-none text-center">
            <option value="years">Years</option>
            <option value="months">Months</option>
          </select>
        </div>
      </div>

      {pVal > 0 && tVal > 0 && (
        <div className="glass-panel p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 mt-6 text-center space-y-4">
          <div>
            <p className="text-sm text-muted mb-1">Monthly Payment</p>
            <h3 className="text-4xl font-black text-white">RM {monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
              <p className="text-xs text-muted mb-1">Total Interest</p>
              <p className="font-bold text-accent">RM {totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
              <p className="text-xs text-muted mb-1">Total Cost</p>
              <p className="font-bold text-white">RM {totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 2. COMMITMENT CALCULATOR
// ==========================================
interface CommitmentItem {
  id: string;
  name: string;
  amount: number;
}

const DEFAULT_COMMITMENTS = [
  { id: '1', name: 'Car Loan', amount: 0 },
  { id: '2', name: 'Rent / Mortgage', amount: 0 },
  { id: '3', name: 'PTPTN / Student Loan', amount: 0 },
  { id: '4', name: 'Internet', amount: 0 },
];

const CommitmentTab = () => {
  const [items, setItems] = useState<CommitmentItem[]>(() => {
    const saved = localStorage.getItem('fin_commitments');
    return saved ? JSON.parse(saved) : DEFAULT_COMMITMENTS;
  });

  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');

  useEffect(() => {
    localStorage.setItem('fin_commitments', JSON.stringify(items));
  }, [items]);

  const updateAmount = (id: string, val: string) => {
    setItems(items.map(i => i.id === id ? { ...i, amount: parseFloat(val) || 0 } : i));
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setItems([...items, { id: Math.random().toString(), name: newName.trim(), amount: parseFloat(newAmount) || 0 }]);
    setNewName('');
    setNewAmount('');
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const total = items.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <h3 className="font-bold text-lg px-1">Monthly Commitments</h3>
      
      <div className="glass-panel p-6 text-center bg-gradient-to-br from-red-500/10 to-orange-500/10">
        <p className="text-sm text-muted mb-1">Total Fixed Expenses</p>
        <h3 className="text-4xl font-black text-red-400">RM {total.toFixed(2)}</h3>
        <p className="text-xs text-muted mt-2">Per Month</p>
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="glass-panel p-3 flex items-center space-x-3">
            <div className="flex-1 font-medium text-sm">{item.name}</div>
            <div className="relative w-32">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">RM</span>
              <input 
                type="number" min="0" step="0.01" 
                value={item.amount || ''} onChange={(e) => updateAmount(item.id, e.target.value)} 
                placeholder="0.00" className="input-field pl-8 py-1.5 text-sm w-full" 
              />
            </div>
            <button onClick={() => removeItem(item.id)} className="text-muted hover:text-red-400 p-1">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={addItem} className="glass-panel p-3 flex items-center space-x-2">
        <input type="text" placeholder="e.g. Netflix" value={newName} onChange={(e) => setNewName(e.target.value)} className="input-field flex-1 text-sm py-2" required />
        <div className="relative w-28">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">RM</span>
          <input type="number" min="0" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0.00" className="input-field pl-8 py-2 text-sm w-full" />
        </div>
        <button type="submit" disabled={!newName} className="btn-primary p-2 rounded-xl">
          <Plus size={20} />
        </button>
      </form>
    </div>
  );
};

// ==========================================
// 3. SAVINGS GOAL CALCULATOR
// ==========================================
const SavingsTab = () => {
  const [goalAmount, setGoalAmount] = useState(() => localStorage.getItem('fin_save_goal') || '5000');
  const [months, setMonths] = useState(() => localStorage.getItem('fin_save_months') || '12');

  useEffect(() => { localStorage.setItem('fin_save_goal', goalAmount); }, [goalAmount]);
  useEffect(() => { localStorage.setItem('fin_save_months', months); }, [months]);

  const goal = parseFloat(goalAmount) || 0;
  const m = parseInt(months) || 0;

  const perMonth = m > 0 ? goal / m : 0;
  const perWeek = m > 0 ? goal / (m * 4.333) : 0;
  const perDay = m > 0 ? goal / (m * 30.416) : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      <h3 className="font-bold text-lg px-1">Savings Goal</h3>

      <div className="glass-panel p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-2">Target Amount (RM)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">RM</span>
            <input type="number" min="0" step="0.01" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} className="input-field pl-10 w-full" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-2">Timeframe (Months)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Calendar size={18} /></span>
            <input type="number" min="1" step="1" value={months} onChange={(e) => setMonths(e.target.value)} className="input-field pl-10 w-full" />
          </div>
        </div>
      </div>

      {goal > 0 && m > 0 && (
        <div className="glass-panel p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 text-center space-y-4">
          <p className="text-sm text-muted">You need to save:</p>
          <div>
            <h3 className="text-4xl font-black text-green-400">RM {perMonth.toFixed(2)}</h3>
            <p className="text-xs text-muted mt-1">per month</p>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
            <div>
              <p className="font-bold text-white">RM {perWeek.toFixed(2)}</p>
              <p className="text-xs text-muted">per week</p>
            </div>
            <div>
              <p className="font-bold text-white">RM {perDay.toFixed(2)}</p>
              <p className="text-xs text-muted">per day</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 4. SALARY / HOURLY CALCULATOR
// ==========================================
const SalaryTab = () => {
  const [salary, setSalary] = useState(() => localStorage.getItem('fin_salary') || '3000');
  const [hoursPerWeek, setHoursPerWeek] = useState(() => localStorage.getItem('fin_hours') || '40');

  useEffect(() => { localStorage.setItem('fin_salary', salary); }, [salary]);
  useEffect(() => { localStorage.setItem('fin_hours', hoursPerWeek); }, [hoursPerWeek]);

  const sal = parseFloat(salary) || 0;
  const hpw = parseFloat(hoursPerWeek) || 0;
  
  // Average weeks in a month = 52 / 12 = 4.333
  const hoursPerMonth = hpw * 4.3333;
  const hourlyRate = hoursPerMonth > 0 ? sal / hoursPerMonth : 0;
  const dailyRate = hourlyRate * (hpw / 5); // Assuming 5 days a week for daily breakdown

  return (
    <div className="space-y-4 animate-fade-in">
      <h3 className="font-bold text-lg px-1">Salary to Hourly Wage</h3>

      <div className="glass-panel p-5 grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-muted mb-2">Monthly Salary (RM)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">RM</span>
            <input type="number" min="0" step="0.01" value={salary} onChange={(e) => setSalary(e.target.value)} className="input-field pl-10 w-full font-bold text-lg" />
          </div>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-muted mb-2">Working Hours (per week)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Clock size={18} /></span>
            <input type="number" min="1" step="1" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} className="input-field pl-10 w-full" />
          </div>
        </div>
      </div>

      {sal > 0 && hpw > 0 && (
        <div className="glass-panel p-6 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 text-center space-y-4">
          <p className="text-sm text-muted">Your exact hourly rate is:</p>
          <h3 className="text-4xl font-black text-indigo-400">RM {hourlyRate.toFixed(2)} <span className="text-lg font-bold text-white/50">/ hr</span></h3>
          <div className="text-sm text-muted mt-2">
            Approx <span className="font-bold text-white">RM {dailyRate.toFixed(2)}</span> per day (based on a 5-day week).
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 5. DISCOUNT CALCULATOR
// ==========================================
const DiscountTab = () => {
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('35');

  const p = parseFloat(price) || 0;
  const d = parseFloat(discount) || 0;

  const saved = p * (d / 100);
  const finalPrice = p - saved;

  return (
    <div className="space-y-4 animate-fade-in">
      <h3 className="font-bold text-lg px-1">Discount Calculator</h3>

      <div className="glass-panel p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-2">Original Price</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">RM</span>
            <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="199.00" className="input-field pl-10 w-full font-bold text-lg" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-2">Discount Percentage</label>
          <div className="relative">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">%</span>
            <input type="number" min="0" step="1" max="100" value={discount} onChange={(e) => setDiscount(e.target.value)} className="input-field pr-10 w-full" />
          </div>
        </div>
        
        {/* Quick discount buttons */}
        <div className="flex space-x-2 pt-2">
          {['10', '20', '30', '50', '70'].map(pct => (
            <button key={pct} onClick={() => setDiscount(pct)} className={`flex-1 py-1 text-xs rounded-lg transition-colors ${discount === pct ? 'bg-white text-black font-bold' : 'bg-white/10 hover:bg-white/20'}`}>
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {p > 0 && (
        <div className="glass-panel p-6 bg-gradient-to-br from-pink-500/10 to-rose-500/10 text-center">
          <p className="text-sm text-muted mb-1">Final Price</p>
          <h3 className="text-5xl font-black text-pink-400 mb-4">RM {finalPrice.toFixed(2)}</h3>
          <div className="bg-black/20 rounded-xl p-3 inline-block">
            <p className="text-sm">You save <span className="font-bold text-white">RM {saved.toFixed(2)}</span></p>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================
const FinancialCalculators: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    return (localStorage.getItem('fin_active_tab') as TabType) || 'loan';
  });

  useEffect(() => {
    localStorage.setItem('fin_active_tab', activeTab);
  }, [activeTab]);

  const tabs: { id: TabType; name: string; icon: any }[] = [
    { id: 'loan', name: 'Loan', icon: Landmark },
    { id: 'commitment', name: 'Commitment', icon: Wallet },
    { id: 'savings', name: 'Savings Goal', icon: PiggyBank },
    { id: 'salary', name: 'Salary/Hourly', icon: Briefcase },
    { id: 'discount', name: 'Discount', icon: Tag },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center space-x-3 mb-2">
        <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl shrink-0">
          <Calculator size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Financial Hub</h2>
          <p className="text-sm text-muted">All your financial tools in one place</p>
        </div>
      </div>

      {/* Wrapped Tab Bar */}
      <div className="flex flex-wrap gap-2 pb-2 -mx-1 px-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                isActive ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={16} />
              <span>{tab.name}</span>
            </button>
          )
        })}
      </div>

      {/* Render Active Tab */}
      <div className="pt-2">
        {activeTab === 'loan' && <LoanTab />}
        {activeTab === 'commitment' && <CommitmentTab />}
        {activeTab === 'savings' && <SavingsTab />}
        {activeTab === 'salary' && <SalaryTab />}
        {activeTab === 'discount' && <DiscountTab />}
      </div>
    </div>
  );
};

export default FinancialCalculators;
