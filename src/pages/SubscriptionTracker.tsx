import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Trash2, Edit2, X, Calendar, AlertCircle, RefreshCw } from 'lucide-react';

export type BillingCycle = 'weekly' | 'monthly' | 'yearly';

export interface Subscription {
  id: string;
  name: string;
  price: number;
  cycle: BillingCycle;
  startDate: string; // YYYY-MM-DD
}

const STORAGE_KEY = 'sub_tracker_data';

export const getNextRenewalDate = (startDate: string, cycle: BillingCycle): Date => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (start > today) {
    return start;
  }

  let next = new Date(start.getTime());
  
  // Loop until the next billing date is strictly in the future or today
  while (next < today) {
    if (cycle === 'weekly') {
      next.setDate(next.getDate() + 7);
    } else if (cycle === 'monthly') {
      next.setMonth(next.getMonth() + 1);
    } else if (cycle === 'yearly') {
      next.setFullYear(next.getFullYear() + 1);
    }
  }
  
  return next;
};

export const getDaysUntil = (target: Date): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const SubscriptionTracker: React.FC = () => {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [startDate, setStartDate] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSubs(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse subs');
      }
    }
  }, []);

  const saveSubs = (newSubs: Subscription[]) => {
    setSubs(newSubs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSubs));
  };

  const openForm = (sub?: Subscription) => {
    if (sub) {
      setEditingId(sub.id);
      setName(sub.name);
      setPriceStr(sub.price.toString());
      setCycle(sub.cycle);
      setStartDate(sub.startDate);
    } else {
      setEditingId(null);
      setName('');
      setPriceStr('');
      setCycle('monthly');
      setStartDate(new Date().toISOString().split('T')[0]);
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !priceStr || !startDate) return;

    const price = parseFloat(priceStr.replace(/,/g, ''));
    if (isNaN(price)) return;

    if (editingId) {
      saveSubs(subs.map(s => s.id === editingId ? { id: s.id, name, price, cycle, startDate } : s));
    } else {
      const newSub: Subscription = {
        id: Date.now().toString(),
        name,
        price,
        cycle,
        startDate
      };
      saveSubs([...subs, newSub]);
    }
    closeForm();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this subscription?')) {
      saveSubs(subs.filter(s => s.id !== id));
    }
  };

  // Calculations
  const monthlyTotal = subs.reduce((acc, sub) => {
    if (sub.cycle === 'monthly') return acc + sub.price;
    if (sub.cycle === 'yearly') return acc + (sub.price / 12);
    if (sub.cycle === 'weekly') return acc + ((sub.price * 52) / 12);
    return acc;
  }, 0);

  const yearlyTotal = monthlyTotal * 12;

  // Sort subs by next renewal date
  const sortedSubs = [...subs].sort((a, b) => {
    const dateA = getNextRenewalDate(a.startDate, a.cycle);
    const dateB = getNextRenewalDate(b.startDate, b.cycle);
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/20 text-indigo-400 mb-2">
          <RefreshCw size={32} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white/90">Subscriptions</h1>
        <p className="text-sm text-muted">Track your recurring payments</p>
      </div>

      {/* Dashboard Totals */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel p-5 border-l-4 border-l-indigo-500 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <CreditCard size={48} />
          </div>
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Monthly</p>
          <p className="text-2xl font-black text-white">RM {monthlyTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        
        <div className="glass-panel p-5 border-l-4 border-l-purple-500 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Calendar size={48} />
          </div>
          <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">Yearly</p>
          <p className="text-2xl font-black text-white">RM {yearlyTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Action Button */}
      <button 
        onClick={() => openForm()}
        className="w-full btn-primary bg-indigo-500 hover:bg-indigo-600 border-indigo-400/50 shadow-[0_0_20px_rgba(99,102,241,0.3)] py-4 text-lg flex items-center justify-center"
      >
        <Plus size={20} className="mr-2" /> Add Subscription
      </button>

      {/* Subscription List */}
      <div className="space-y-3">
        {sortedSubs.length === 0 ? (
          <div className="text-center p-8 bg-white/5 rounded-2xl border border-white/10 border-dashed">
            <p className="text-muted">No subscriptions tracked yet.</p>
          </div>
        ) : (
          sortedSubs.map(sub => {
            const nextDate = getNextRenewalDate(sub.startDate, sub.cycle);
            const daysLeft = getDaysUntil(nextDate);
            const isUrgent = daysLeft <= 3;

            return (
              <div key={sub.id} className="glass-panel p-4 flex items-center justify-between group">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-lg text-white/90">{sub.name}</h3>
                    {isUrgent && <AlertCircle size={14} className="text-rose-400 animate-pulse" />}
                  </div>
                  <div className="flex items-center text-xs text-muted mt-1 space-x-3">
                    <span className="flex items-center">
                      <CreditCard size={12} className="mr-1 opacity-70" />
                      RM {sub.price.toFixed(2)} / {sub.cycle}
                    </span>
                    <span className={`flex items-center font-medium ${isUrgent ? 'text-rose-400' : 'text-indigo-300'}`}>
                      <Calendar size={12} className="mr-1 opacity-70" />
                      Renews: {nextDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {daysLeft === 0 ? ' (Today)' : daysLeft === 1 ? ' (Tmrw)' : ` (${daysLeft}d)`}
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openForm(sub)} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-blue-400 transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(sub.id)} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-rose-400 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-white/10 p-6 rounded-3xl w-full max-w-sm shadow-2xl relative animate-slide-up">
            <button 
              onClick={closeForm}
              className="absolute top-4 right-4 p-2 text-muted hover:text-white bg-white/5 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
            
            <h2 className="text-xl font-bold mb-6">{editingId ? 'Edit' : 'Add'} Subscription</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Service Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="input-field w-full"
                  placeholder="e.g. Netflix, Spotify"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">Price (RM)</label>
                  <input 
                    type="text"
                    inputMode="decimal"
                    value={priceStr} 
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      setPriceStr(val);
                    }}
                    className="input-field w-full"
                    placeholder="0.00"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">Cycle</label>
                  <select 
                    value={cycle} 
                    onChange={e => setCycle(e.target.value as BillingCycle)}
                    className="input-field w-full appearance-none"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">First/Last Billing Date</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)}
                  className="input-field w-full"
                  required
                />
                <p className="text-[10px] text-muted italic">Used to calculate upcoming renewals.</p>
              </div>

              <button type="submit" className="w-full btn-primary bg-indigo-500 hover:bg-indigo-600 mt-6">
                Save
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionTracker;
