import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, AlertCircle, RefreshCw, ExternalLink, Filter, CheckCircle2 } from 'lucide-react';
import { store } from '../lib/store';
import { Link } from 'react-router-dom';
import { daysUntil } from '../lib/horizon';

const EXPENSE_STORAGE_KEY = 'expense_manager_data';

const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

interface Commitment {
  id: string; title: string; amount: number; paymentDay: number; category: string;
  archived: boolean; payments: Record<string, string>;
}

interface CommitmentView {
  id: string;
  name: string;
  price: number;
  category: string;
  renewalDate: Date;
}

const CommitmentTracker: React.FC = () => {
  const [commitments, setCommitments] = useState<CommitmentView[]>([]);
  const [paidCommitments, setPaidCommitments] = useState<CommitmentView[]>([]);
  const [categories, setCategories] = useState<string[]>(['Semua']);
  const [selectedCat, setSelectedCat] = useState<string>('Semua');

  useEffect(() => {
    const saved = store.getItem(EXPENSE_STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.commitments && Array.isArray(data.commitments)) {
          const today = new Date();
          const currentMonth = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
          const maxDay = daysInMonth(today.getFullYear(), today.getMonth());
          
          const unarchived = data.commitments.filter((c: Commitment) => !c.archived);
          
          const mappedPending: CommitmentView[] = [];
          const mappedPaid: CommitmentView[] = [];
          
          unarchived.forEach((c: Commitment) => {
            const day = Math.min(c.paymentDay, maxDay);
            const renewalDate = new Date(today.getFullYear(), today.getMonth(), day);
            
            const view: CommitmentView = {
              id: c.id,
              name: c.title,
              price: c.amount,
              category: c.category,
              renewalDate
            };
            
            if (!c.payments || !c.payments[currentMonth]) {
              mappedPending.push(view);
            } else {
              mappedPaid.push(view);
            }
          });

          mappedPending.sort((a: CommitmentView, b: CommitmentView) => a.renewalDate.getTime() - b.renewalDate.getTime());
          mappedPaid.sort((a: CommitmentView, b: CommitmentView) => a.renewalDate.getTime() - b.renewalDate.getTime());
          
          setCommitments(mappedPending);
          setPaidCommitments(mappedPaid);
          
          const allMapped = [...mappedPending, ...mappedPaid];
          const uniqueCats = Array.from(new Set(allMapped.map(m => m.category))).sort();
          setCategories(['Semua', ...uniqueCats]);
        }
      } catch (e) {
        console.error('Failed to parse expense manager data', e);
      }
    }
  }, []);

  const displayedPending = selectedCat === 'Semua' 
    ? commitments 
    : commitments.filter(c => c.category === selectedCat);
    
  const displayedPaid = selectedCat === 'Semua' 
    ? paidCommitments 
    : paidCommitments.filter(c => c.category === selectedCat);

  const pendingTotal = displayedPending.reduce((acc, c) => acc + c.price, 0);
  const paidTotal = displayedPaid.reduce((acc, c) => acc + c.price, 0);

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24 animate-fade-in">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/20 text-indigo-400 mb-2">
          <RefreshCw size={32} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text/90">Commitments</h1>
        <p className="text-sm text-muted">Disegerak dari Expense Manager</p>
      </div>

      {/* Category Filter */}
      {categories.length > 1 && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-hide px-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
                selectedCat === cat 
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                  : 'bg-surface border border-text/10 text-muted hover:text-text'
              }`}
            >
              {cat === 'Semua' && <Filter size={14} />}
              <span>{cat}</span>
            </button>
          ))}
        </div>
      )}

      {/* Dashboard Totals */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel p-4 border-l-4 border-l-indigo-500 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <CreditCard size={40} />
          </div>
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Belum Bayar</p>
          <p className="text-xl font-black text-text">RM {pendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        
        <div className="glass-panel p-4 border-l-4 border-l-emerald-500 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <CheckCircle2 size={40} />
          </div>
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Sudah Bayar</p>
          <p className="text-xl font-black text-text">RM {paidTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>

        <div className="glass-panel p-4 border-l-4 border-l-purple-500 relative overflow-hidden group col-span-2">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <Calendar size={40} />
          </div>
          <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">Anggaran Setahun (Semua Aktif)</p>
          <p className="text-xl font-black text-text">RM {((pendingTotal + paidTotal) * 12).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      </div>

      <Link 
        to="/expense-manager"
        className="w-full bg-surface border border-text/10 hover:border-indigo-500/30 rounded-2xl p-4 flex items-center justify-between text-left transition-colors group"
      >
        <div>
          <p className="font-bold text-sm text-text/90">Urus dalam Expense Manager</p>
          <p className="text-[10px] text-muted">Tambah atau bayar komitmen di sana.</p>
        </div>
        <ExternalLink size={16} className="text-muted group-hover:text-indigo-400 transition-colors" />
      </Link>

      {/* Lists */}
      <div className="space-y-6">
        
        {displayedPaid.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold text-xs uppercase text-emerald-400 tracking-wider px-1">Sudah Bayar Bulan Ini</h3>
            {displayedPaid.map(sub => (
              <div key={sub.id} className="glass-panel p-4 flex items-center justify-between opacity-70">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-lg text-text/90 line-through">{sub.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-text/5 text-muted uppercase tracking-wider">
                      {sub.category}
                    </span>
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  </div>
                  <div className="flex items-center text-xs text-muted mt-2 space-x-3">
                    <span className="flex items-center">
                      <CreditCard size={12} className="mr-1 opacity-70" />
                      RM {sub.price.toFixed(2)} / bln
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <h3 className="font-bold text-xs uppercase text-indigo-400 tracking-wider px-1">Belum Bayar Bulan Ini</h3>
          {displayedPending.length === 0 ? (
            <div className="text-center p-8 bg-text/5 rounded-2xl border border-text/10 border-dashed">
              <p className="text-muted text-sm">Semua komitmen dalam kategori ini sudah dibayar bulan ini!</p>
            </div>
          ) : (
            displayedPending.map(sub => {
              const daysLeft = daysUntil(sub.renewalDate);
              const isUrgent = daysLeft <= 3 && daysLeft >= 0;
              const isOverdue = daysLeft < 0;

              return (
                <div key={sub.id} className="glass-panel p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-lg text-text/90">{sub.name}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-text/5 text-muted uppercase tracking-wider">
                        {sub.category}
                      </span>
                      {(isUrgent || isOverdue) && <AlertCircle size={14} className="text-rose-400 animate-pulse" />}
                    </div>
                    <div className="flex items-center text-xs text-muted mt-2 space-x-3">
                      <span className="flex items-center">
                        <CreditCard size={12} className="mr-1 opacity-70" />
                        RM {sub.price.toFixed(2)} / bln
                      </span>
                      <span className={`flex items-center font-medium ${isOverdue ? 'text-rose-500' : isUrgent ? 'text-rose-400' : 'text-indigo-300'}`}>
                        <Calendar size={12} className="mr-1 opacity-70" />
                        Bayar: {sub.renewalDate.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' })}
                        {isOverdue ? ` (${Math.abs(daysLeft)}h lewat)` : daysLeft === 0 ? ' (Hari ini)' : daysLeft === 1 ? ' (Esok)' : ` (${daysLeft}h)`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CommitmentTracker;
