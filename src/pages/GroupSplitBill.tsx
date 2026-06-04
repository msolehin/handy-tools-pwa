import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, ArrowRight, X } from 'lucide-react';

interface Member {
  id: string;
  name: string;
}

interface SplitTransaction {
  id: string;
  description: string;
  amount: number;
  paidById: string;
  splitBetweenIds: string[];
}

interface Settlement {
  fromName: string;
  toName: string;
  amount: number;
}

const STORAGE_KEY = 'group_split_bill_data';

const GroupSplitBill: React.FC = () => {
  // Split Bill State
  const [members, setMembers] = useState<Member[]>([{ id: 'you', name: 'You' }]);
  const [newMemberName, setNewMemberName] = useState('');
  const [transactions, setTransactions] = useState<SplitTransaction[]>([]);
  
  // Transaction Form
  const [isAddingTx, setIsAddingTx] = useState(false);
  const [txDesc, setTxDesc] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txPaidBy, setTxPaidBy] = useState('you');
  const [txSplitIds, setTxSplitIds] = useState<string[]>(['you']);

  // Load state
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.members) setMembers(parsed.members);
        if (parsed.transactions) setTransactions(parsed.transactions);
      } catch (e) {}
    } else {
      // Migrate from old debt_tracker_data if available
      const oldSaved = localStorage.getItem('debt_tracker_data');
      if (oldSaved) {
        try {
          const parsed = JSON.parse(oldSaved);
          if (parsed.members) setMembers(parsed.members);
          if (parsed.transactions) setTransactions(parsed.transactions);
        } catch (e) {}
      }
    }
  }, []);

  // Save state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ members, transactions }));
  }, [members, transactions]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setMembers([...members, { id: generateId(), name: newMemberName.trim() }]);
    setNewMemberName('');
  };

  const addTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(txAmount);
    if (!txDesc.trim() || !amount || txSplitIds.length === 0) return;

    setTransactions([...transactions, {
      id: generateId(),
      description: txDesc.trim(),
      amount,
      paidById: txPaidBy,
      splitBetweenIds: txSplitIds
    }]);

    setTxDesc('');
    setTxAmount('');
    setIsAddingTx(false);
  };

  const toggleSplitMember = (id: string) => {
    if (txSplitIds.includes(id)) {
      setTxSplitIds(txSplitIds.filter(i => i !== id));
    } else {
      setTxSplitIds([...txSplitIds, id]);
    }
  };

  // Magic Settlement Algorithm
  const calculateSettlements = (): { balances: Record<string, number>, settlements: Settlement[] } => {
    const balances: Record<string, number> = {};
    members.forEach(m => balances[m.id] = 0);

    // Calculate net balances
    transactions.forEach(tx => {
      if (balances[tx.paidById] !== undefined) {
        balances[tx.paidById] += tx.amount;
      }
      const splitAmount = tx.amount / tx.splitBetweenIds.length;
      tx.splitBetweenIds.forEach(id => {
        if (balances[id] !== undefined) {
          balances[id] -= splitAmount;
        }
      });
    });

    // Separate into debtors and creditors
    const debtors: { id: string, amount: number }[] = [];
    const creditors: { id: string, amount: number }[] = [];

    Object.entries(balances).forEach(([id, bal]) => {
      if (bal < -0.01) debtors.push({ id, amount: -bal });
      if (bal > 0.01) creditors.push({ id, amount: bal });
    });

    // Sort by largest amounts first
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const settlements: Settlement[] = [];
    let d = 0, c = 0;

    while (d < debtors.length && c < creditors.length) {
      const settleAmount = Math.min(debtors[d].amount, creditors[c].amount);
      const fromName = members.find(m => m.id === debtors[d].id)?.name || 'Unknown';
      const toName = members.find(m => m.id === creditors[c].id)?.name || 'Unknown';

      if (settleAmount > 0.01) {
        settlements.push({ fromName, toName, amount: settleAmount });
      }

      debtors[d].amount -= settleAmount;
      creditors[c].amount -= settleAmount;

      if (debtors[d].amount < 0.01) d++;
      if (creditors[c].amount < 0.01) c++;
    }

    return { balances, settlements };
  };

  const { balances, settlements } = calculateSettlements();
  const myBalance = balances['you'] || 0;

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-6 animate-fade-in">
      <div className="flex items-center space-x-3 px-2 mb-2">
        <div className="p-3 bg-emerald-500/20 rounded-xl">
          <Users className="text-emerald-400" size={28} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text/90">Group Split Bill</h1>
          <p className="text-[10px] text-muted uppercase tracking-wider">Split Group Expenses</p>
        </div>
      </div>

      {/* Net Summary Card */}
      <div className="glass-panel p-6 border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)] relative overflow-hidden">
        <h3 className="font-bold text-lg mb-2">Your Net Balance</h3>
        <div className={`text-3xl font-black ${myBalance > 0 ? 'text-emerald-400' : myBalance < 0 ? 'text-rose-400' : 'text-text'}`}>
          {myBalance > 0 ? '+' : myBalance < 0 ? '-' : ''}RM{Math.abs(myBalance).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}
        </div>
        <p className="text-sm text-muted mt-1">
          {myBalance > 0 ? 'The group owes you overall.' : myBalance < 0 ? 'You owe the group overall.' : 'You are completely settled up!'}
        </p>
      </div>

      {/* How To Settle Up (Only show if there are settlements) */}
      {settlements.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mt-6 mb-2">How to settle up</h3>
          {settlements.map((s, i) => (
            <div key={i} className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
              <div className="flex items-center space-x-3 font-medium text-sm">
                <span>{s.fromName}</span>
                <ArrowRight size={14} className="text-emerald-400" />
                <span>{s.toName}</span>
              </div>
              <span className="font-black text-emerald-400">RM{s.amount.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
            </div>
          ))}
        </div>
      )}

      {/* Group Members */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider mt-6 mb-2">Group Members ({members.length})</h3>
        <div className="flex flex-wrap gap-2">
          {members.map(m => (
            <div key={m.id} className="px-3 py-1.5 bg-text/5 rounded-lg text-sm font-bold flex items-center group">
              {m.name}
              {m.id !== 'you' && (
                <button 
                  onClick={() => {
                    setMembers(members.filter(mem => mem.id !== m.id));
                    setTransactions(transactions.filter(tx => tx.paidById !== m.id).map(tx => ({...tx, splitBetweenIds: tx.splitBetweenIds.filter(id => id !== m.id)})));
                  }}
                  className="ml-2 text-muted hover:text-rose-400 opacity-50 hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={addMember} className="flex space-x-2 pt-1">
          <input 
            type="text" 
            placeholder="New member name..." 
            value={newMemberName} 
            onChange={(e) => setNewMemberName(e.target.value)}
            className="input-field flex-1 text-sm"
          />
          <button type="submit" className="p-3 bg-emerald-500 text-text rounded-xl shadow hover:bg-emerald-600 transition-colors">
            <UserPlus size={18} />
          </button>
        </form>
      </div>

      {/* Transactions */}
      {members.length > 1 && (
        <div className="pt-4 border-t border-text/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Group Expenses</h3>
            <button 
              onClick={() => setIsAddingTx(true)}
              className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-bold hover:bg-emerald-500/30 transition-colors"
            >
              + Add Expense
            </button>
          </div>

          {isAddingTx ? (
            <div className="glass-panel p-5 space-y-4 border-emerald-500/30">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Description</label>
                <input type="text" value={txDesc} onChange={e => setTxDesc(e.target.value)} placeholder="e.g. Dinner at Mario's" className="input-field w-full" />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Amount (RM)</label>
                <input type="number" step="0.01" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0.00" className="input-field w-full font-mono text-lg" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Who Paid?</label>
                <select value={txPaidBy} onChange={e => setTxPaidBy(e.target.value)} className="input-field w-full">
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Split Between (Select multiple)</label>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => (
                    <button
                      key={m.id}
                      onClick={() => toggleSplitMember(m.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${txSplitIds.includes(m.id) ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-transparent border-text/20 text-muted'}`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <button onClick={() => setIsAddingTx(false)} className="flex-1 py-3 rounded-xl bg-text/5 text-text font-bold hover:bg-text/10">Cancel</button>
                <button onClick={addTransaction} className="flex-1 py-3 rounded-xl bg-emerald-500 text-text font-bold shadow-lg hover:bg-emerald-600">Save Expense</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mt-6 mb-2">History</h3>
              {transactions.map(tx => {
                const paidByName = members.find(m => m.id === tx.paidById)?.name || 'Unknown';
                const splitNames = tx.splitBetweenIds.map(id => members.find(m => m.id === id)?.name || 'Unknown').join(', ');
                
                return (
                  <div key={tx.id} className="glass-panel p-4 flex items-center justify-between group">
                    <div>
                      <h4 className="font-bold text-text/90">{tx.description}</h4>
                      <p className="text-xs text-muted mt-1">{paidByName} paid for {splitNames}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-black text-lg">RM{tx.amount.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                      <button onClick={() => setTransactions(transactions.filter(t => t.id !== tx.id))} className="text-rose-400 opacity-50 hover:opacity-100 transition-opacity p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupSplitBill;
