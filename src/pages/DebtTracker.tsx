import React, { useState, useEffect } from 'react';
import { HandCoins, Users, UserPlus, Trash2, ArrowRight, CheckSquare, Square, Plus, X } from 'lucide-react';

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

interface IOU {
  id: string;
  personName: string;
  description: string;
  amount: number;
  type: 'owe_me' | 'i_owe';
  isSettled: boolean;
}

interface Settlement {
  fromName: string;
  toName: string;
  amount: number;
}

const STORAGE_KEY = 'debt_tracker_data';

const DebtTracker: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'split' | 'iou'>('split');

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

  // IOU State
  const [ious, setIous] = useState<IOU[]>([]);
  const [isAddingIou, setIsAddingIou] = useState(false);
  const [iouName, setIouName] = useState('');
  const [iouDesc, setIouDesc] = useState('');
  const [iouAmount, setIouAmount] = useState('');
  const [iouType, setIouType] = useState<'owe_me' | 'i_owe'>('owe_me');

  // Load state
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.members) setMembers(parsed.members);
        if (parsed.transactions) setTransactions(parsed.transactions);
        if (parsed.ious) setIous(parsed.ious);
      } catch (e) {}
    }
  }, []);

  // Save state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ members, transactions, ious }));
  }, [members, transactions, ious]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // --- SPLIT BILL LOGIC ---

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

  // --- IOU LOGIC ---

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

  const deleteIou = (id: string) => {
    setIous(ious.filter(i => i.id !== id));
  };

  const totalOwedToMe = ious.filter(i => i.type === 'owe_me' && !i.isSettled).reduce((acc, curr) => acc + curr.amount, 0);
  const totalIOwe = ious.filter(i => i.type === 'i_owe' && !i.isSettled).reduce((acc, curr) => acc + curr.amount, 0);


  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
      <div className="flex items-center space-x-3 px-2 z-10 relative mb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400">
          <HandCoins size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white/90">Split & Track</h1>
          <p className="text-[10px] text-muted uppercase tracking-wider">Group Bills & IOUs</p>
        </div>
      </div>

      <div className="flex bg-white/5 p-1 rounded-xl mb-6 mx-2">
        <button 
          onClick={() => setActiveTab('split')}
          className={`flex-1 p-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'split' ? 'bg-indigo-500 text-white shadow-lg' : 'text-muted hover:text-white'}`}
        >
          Group Split Bill
        </button>
        <button 
          onClick={() => setActiveTab('iou')}
          className={`flex-1 p-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'iou' ? 'bg-indigo-500 text-white shadow-lg' : 'text-muted hover:text-white'}`}
        >
          Simple IOUs
        </button>
      </div>

      {/* --- TAB A: SPLIT BILL --- */}
      {activeTab === 'split' && (
        <div className="animate-fade-in space-y-6">
          {/* Net Summary Card */}
          <div className="glass-panel p-6 border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.1)] relative overflow-hidden">
            <h3 className="font-bold text-lg mb-2">Your Net Balance</h3>
            <div className={`text-3xl font-black ${myBalance > 0 ? 'text-emerald-400' : myBalance < 0 ? 'text-rose-400' : 'text-white'}`}>
              {myBalance > 0 ? '+' : myBalance < 0 ? '-' : ''}RM{Math.abs(myBalance).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}
            </div>
            <p className="text-sm text-muted mt-1">
              {myBalance > 0 ? '(Overall owed to you)' : myBalance < 0 ? '(Overall you owe)' : 'You are all settled up!'}
            </p>
          </div>

          {/* Members Manager */}
          <div className="glass-panel p-5">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 flex items-center">
              <Users size={14} className="mr-1.5" /> Group Members
            </h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {members.map(m => (
                <div key={m.id} className="bg-white/10 px-3 py-1.5 rounded-full text-sm font-medium flex items-center">
                  {m.name}
                  {m.id !== 'you' && (
                    <button onClick={() => setMembers(members.filter(x => x.id !== m.id))} className="ml-2 text-muted hover:text-rose-400">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={addMember} className="flex space-x-2">
              <input 
                type="text" 
                value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)}
                placeholder="Add person..."
                className="input-field flex-1 text-sm py-2"
              />
              <button type="submit" className="btn-primary py-2 px-4 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50" disabled={!newMemberName.trim()}>
                <UserPlus size={16} />
              </button>
            </form>
          </div>

          {/* Magic Settlements */}
          {settlements.length > 0 && (
            <div className="glass-panel p-5 border-emerald-500/20 bg-emerald-500/5">
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-4">✨ Final Settlement</h3>
              <p className="text-xs text-emerald-400/70 mb-4">Simplified minimum transactions required to settle all group debts.</p>
              <div className="space-y-3">
                {settlements.map((s, i) => (
                  <div key={i} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-white/90">{s.fromName}</span>
                      <ArrowRight size={14} className="text-muted" />
                      <span className="font-bold text-white/90">{s.toName}</span>
                    </div>
                    <span className="font-black text-emerald-400">RM{s.amount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Transaction */}
          {isAddingTx ? (
            <div className="glass-panel p-5 space-y-4 border-indigo-500/30">
              <h3 className="font-bold text-lg mb-2">New Expense</h3>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Description</label>
                <input type="text" value={txDesc} onChange={e => setTxDesc(e.target.value)} placeholder="e.g. Dinner at Murni" className="input-field w-full" />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Amount (RM)</label>
                <input type="number" step="0.01" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0.00" className="input-field w-full font-mono text-lg" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Paid By</label>
                <select value={txPaidBy} onChange={e => setTxPaidBy(e.target.value)} className="input-field w-full appearance-none">
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Split Between (Equal)</label>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => (
                    <button 
                      key={m.id}
                      type="button"
                      onClick={() => toggleSplitMember(m.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
                        txSplitIds.includes(m.id) ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-muted'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <button onClick={() => setIsAddingTx(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10">Cancel</button>
                <button onClick={addTransaction} className="flex-1 py-3 rounded-xl bg-indigo-500 text-white font-bold shadow-lg hover:bg-indigo-600">Save Expense</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsAddingTx(true)}
              className="w-full py-4 border-2 border-dashed border-white/20 rounded-2xl text-muted font-bold hover:border-indigo-500/50 hover:text-indigo-400 transition-all flex items-center justify-center"
            >
              <Plus size={20} className="mr-2" /> Add Group Expense
            </button>
          )}

          {/* Transaction History */}
          {transactions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mt-6 mb-2">History</h3>
              {transactions.map(tx => {
                const paidByName = members.find(m => m.id === tx.paidById)?.name || 'Unknown';
                const splitNames = tx.splitBetweenIds.map(id => members.find(m => m.id === id)?.name || 'Unknown').join(', ');
                
                return (
                  <div key={tx.id} className="glass-panel p-4 flex items-center justify-between group">
                    <div>
                      <h4 className="font-bold text-white/90">{tx.description}</h4>
                      <p className="text-xs text-muted mt-1">{paidByName} paid for {splitNames}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-black text-lg">RM{tx.amount.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                      <button onClick={() => setTransactions(transactions.filter(t => t.id !== tx.id))} className="text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">
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

      {/* --- TAB B: SIMPLE IOUs --- */}
      {activeTab === 'iou' && (
        <div className="animate-fade-in space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-panel p-4 border-emerald-500/20 text-center">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Owed To You</p>
              <p className="text-xl font-black text-emerald-400">RM{totalOwedToMe.toLocaleString(undefined, {minimumFractionDigits:2})}</p>
            </div>
            <div className="glass-panel p-4 border-rose-500/20 text-center">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">You Owe</p>
              <p className="text-xl font-black text-rose-400">RM{totalIOwe.toLocaleString(undefined, {minimumFractionDigits:2})}</p>
            </div>
          </div>

          {isAddingIou ? (
            <div className="glass-panel p-5 space-y-4 border-indigo-500/30">
              <h3 className="font-bold text-lg mb-2">New Note</h3>
              
              <div className="flex p-1 bg-black/20 rounded-xl">
                <button 
                  onClick={() => setIouType('owe_me')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg ${iouType === 'owe_me' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-muted'}`}
                >
                  They owe me
                </button>
                <button 
                  onClick={() => setIouType('i_owe')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg ${iouType === 'i_owe' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-muted'}`}
                >
                  I owe them
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Person's Name</label>
                <input type="text" value={iouName} onChange={e => setIouName(e.target.value)} placeholder="e.g. Sara" className="input-field w-full" />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Amount (RM)</label>
                <input type="number" step="0.01" value={iouAmount} onChange={e => setIouAmount(e.target.value)} placeholder="0.00" className="input-field w-full font-mono text-lg" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">For What? (Optional)</label>
                <input type="text" value={iouDesc} onChange={e => setIouDesc(e.target.value)} placeholder="e.g. Concert Tickets" className="input-field w-full" />
              </div>

              <div className="flex space-x-2 pt-2">
                <button onClick={() => setIsAddingIou(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10">Cancel</button>
                <button onClick={addIou} className="flex-1 py-3 rounded-xl bg-indigo-500 text-white font-bold shadow-lg hover:bg-indigo-600">Save Note</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsAddingIou(true)}
              className="w-full py-4 border-2 border-dashed border-white/20 rounded-2xl text-muted font-bold hover:border-indigo-500/50 hover:text-indigo-400 transition-all flex items-center justify-center"
            >
              <Plus size={20} className="mr-2" /> Add Debt Note
            </button>
          )}

          <div className="space-y-3">
            {ious.map(iou => (
              <div key={iou.id} className={`glass-panel p-4 transition-all ${iou.isSettled ? 'opacity-50 bg-black/40' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <button 
                      onClick={() => toggleIouSettle(iou.id)}
                      className={`mt-1 rounded-md p-0.5 transition-colors ${iou.isSettled ? 'text-indigo-400 bg-indigo-500/20' : 'text-muted border border-white/20 hover:border-indigo-400'}`}
                    >
                      {iou.isSettled ? <CheckSquare size={20} /> : <Square size={20} className="opacity-0" />}
                      {!iou.isSettled && <div className="w-5 h-5 absolute -mt-5" />} {/* Click target */}
                    </button>
                    <div>
                      <h4 className={`font-bold ${iou.isSettled ? 'line-through text-white/50' : 'text-white/90'}`}>
                        {iou.personName}
                      </h4>
                      {iou.description && <p className="text-xs text-muted mt-0.5">{iou.description}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`font-black ${iou.isSettled ? 'text-white/50' : iou.type === 'owe_me' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {iou.type === 'owe_me' ? '+' : '-'}RM{iou.amount.toLocaleString(undefined, {minimumFractionDigits:2})}
                    </span>
                    <button onClick={() => deleteIou(iou.id)} className="text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 mt-1 hover:bg-rose-500/20 rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {ious.length === 0 && !isAddingIou && (
              <div className="text-center p-8 text-muted text-sm border border-dashed border-white/10 rounded-2xl">
                No active IOUs. You're all settled!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DebtTracker;
