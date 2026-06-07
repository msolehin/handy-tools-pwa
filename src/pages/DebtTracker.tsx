import React, { useState, useEffect } from 'react';
import { HandCoins, Trash2, CheckSquare, Square, Plus } from 'lucide-react';

interface IOU {
  id: string;
  personName: string;
  description: string;
  amount: number;
  type: 'owe_me' | 'i_owe';
  isSettled: boolean;
}

const STORAGE_KEY = 'debt_tracker_ious';

const DebtTracker: React.FC = () => {
  const [ious, setIous] = useState<IOU[]>([]);
  const [isAddingIou, setIsAddingIou] = useState(false);
  const [iouName, setIouName] = useState('');
  const [iouDesc, setIouDesc] = useState('');
  const [iouAmount, setIouAmount] = useState('');
  const [iouType, setIouType] = useState<'owe_me' | 'i_owe'>('owe_me');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setIous(JSON.parse(saved));
      } catch (e) {}
    } else {
      // Migrate from old debt_tracker_data if available
      const oldSaved = localStorage.getItem('debt_tracker_data');
      if (oldSaved) {
        try {
          const parsed = JSON.parse(oldSaved);
          if (parsed.ious) setIous(parsed.ious);
        } catch (e) {}
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ious));
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

  const deleteIou = (id: string) => {
    setIous(ious.filter(i => i.id !== id));
  };

  const totalOwedToMe = ious.filter(i => i.type === 'owe_me' && !i.isSettled).reduce((acc, curr) => acc + curr.amount, 0);
  const totalIOwe = ious.filter(i => i.type === 'i_owe' && !i.isSettled).reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-6 animate-fade-in">
      <div className="flex items-center space-x-3 px-2 mb-2">
        <div className="p-3 bg-indigo-500/20 rounded-xl">
          <HandCoins className="text-indigo-400" size={28} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text/90">Catat Hutang</h1>
          <p className="text-[10px] text-muted uppercase tracking-wider">Simple IOUs</p>
        </div>
      </div>

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
            <button onClick={() => setIsAddingIou(false)} className="flex-1 py-3 rounded-xl bg-text/5 text-text font-bold hover:bg-text/10">Cancel</button>
            <button onClick={addIou} className="flex-1 py-3 rounded-xl bg-indigo-500 text-text font-bold shadow-lg hover:bg-indigo-600">Save Note</button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsAddingIou(true)}
          className="w-full py-4 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-indigo-500/50 hover:text-indigo-400 transition-all flex items-center justify-center"
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
                  className={`mt-1 rounded-md p-0.5 transition-colors ${iou.isSettled ? 'text-indigo-400 bg-indigo-500/20' : 'text-muted border border-text/20 hover:border-indigo-400'}`}
                >
                  {iou.isSettled ? <CheckSquare size={20} /> : <Square size={20} className="opacity-0" />}
                  {!iou.isSettled && <div className="w-5 h-5 absolute -mt-5" />} {/* Click target */}
                </button>
                <div>
                  <h4 className={`font-bold ${iou.isSettled ? 'line-through text-text/50' : 'text-text/90'}`}>
                    {iou.personName}
                  </h4>
                  {iou.description && <p className="text-xs text-muted mt-0.5">{iou.description}</p>}
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className={`font-black ${iou.isSettled ? 'text-text/50' : iou.type === 'owe_me' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {iou.type === 'owe_me' ? '+' : '-'}RM{iou.amount.toLocaleString(undefined, {minimumFractionDigits:2})}
                </span>
                <button onClick={() => deleteIou(iou.id)} className="text-rose-400 opacity-50 hover:opacity-100 transition-opacity p-1 mt-1 hover:bg-rose-500/20 rounded">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {ious.length === 0 && !isAddingIou && (
          <div className="text-center p-8 text-muted text-sm border border-dashed border-text/10 rounded-2xl">
            No active IOUs. You're all settled!
          </div>
        )}
      </div>
    </div>
  );
};

export default DebtTracker;
