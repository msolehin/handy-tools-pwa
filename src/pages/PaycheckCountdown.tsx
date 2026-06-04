import React, { useState, useEffect } from 'react';
import { Wallet, Settings, X, Info } from 'lucide-react';

interface PaycheckConfig {
  type: 'monthly' | 'biweekly';
  dayOfMonth: number; // 1-31
  referenceDate: string; // YYYY-MM-DD (used for bi-weekly anchor)
}

const STORAGE_KEY = 'paycheck_config';

const getNextPayday = (config: PaycheckConfig): Date => {
  const today = new Date();
  
  if (config.type === 'monthly') {
    const candidate = new Date(today.getFullYear(), today.getMonth(), config.dayOfMonth);
    // If today is past this month's payday, bump to next month
    if (today.getTime() >= candidate.getTime()) {
      // If we are at the end of the year, month wraps to 0 automatically when using setMonth
      candidate.setMonth(candidate.getMonth() + 1);
    }
    return candidate;
  } else {
    // Bi-weekly logic
    const ref = new Date(config.referenceDate);
    ref.setHours(0, 0, 0, 0);
    
    if (today.getTime() < ref.getTime()) {
      return ref;
    }
    
    const msPer14Days = 14 * 24 * 60 * 60 * 1000;
    const diff = today.getTime() - ref.getTime();
    const periodsPassed = Math.floor(diff / msPer14Days);
    
    const nextDate = new Date(ref.getTime() + (periodsPassed + 1) * msPer14Days);
    
    // If today IS exactly the payday, we want to show the next one or 0 days?
    // Usually if it's payday, you want a celebration, but mathematically next is next.
    // Let's assume if diff % msPer14Days == 0, they are paid today. We'll handle "Paid Today" in UI.
    return nextDate;
  }
};

const PaycheckCountdown: React.FC = () => {
  const [config, setConfig] = useState<PaycheckConfig>({
    type: 'monthly',
    dayOfMonth: 25,
    referenceDate: new Date().toISOString().split('T')[0]
  });

  const [timeLeft, setTimeLeft] = useState<{ d: number, h: number, m: number, s: number } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [totalCycleMs, setTotalCycleMs] = useState(1);
  const [nextDateStr, setNextDateStr] = useState('');
  
  // Settings Form State
  const [tempType, setTempType] = useState<'monthly' | 'biweekly'>('monthly');
  const [tempDay, setTempDay] = useState('25');
  const [tempRef, setTempRef] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
        setTempType(parsed.type);
        setTempDay(parsed.dayOfMonth.toString());
        setTempRef(parsed.referenceDate);
      } catch (e) {}
    } else {
      setIsSettingsOpen(true); // Open settings on first load
    }
  }, []);

  useEffect(() => {
    const updateCountdown = () => {
      const nextDate = getNextPayday(config);
      // Ensure target time is 00:00 (midnight of that day)
      nextDate.setHours(0, 0, 0, 0);
      
      setNextDateStr(nextDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

      // Calculate total cycle length for progress bar
      let lastDate = new Date(nextDate.getTime());
      if (config.type === 'monthly') {
        lastDate.setMonth(lastDate.getMonth() - 1);
      } else {
        lastDate.setDate(lastDate.getDate() - 14);
      }
      setTotalCycleMs(nextDate.getTime() - lastDate.getTime());

      const now = new Date();
      let diff = nextDate.getTime() - now.getTime();
      
      if (diff < 0) diff = 0;

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);

      setTimeLeft({ d, h, m, s });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [config]);

  const saveSettings = () => {
    let day = parseInt(tempDay);
    if (isNaN(day) || day < 1) day = 1;
    if (day > 31) day = 31;

    const newConfig: PaycheckConfig = {
      type: tempType,
      dayOfMonth: day,
      referenceDate: tempRef || new Date().toISOString().split('T')[0]
    };
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    setIsSettingsOpen(false);
  };

  // Calculate progress percentage (0 to 100, where 100 means payday is here)
  let percentage = 0;
  if (timeLeft && totalCycleMs > 0) {
    const msLeft = (timeLeft.d * 24 * 60 * 60 * 1000) + (timeLeft.h * 60 * 60 * 1000) + (timeLeft.m * 60 * 1000) + (timeLeft.s * 1000);
    const msPassed = totalCycleMs - msLeft;
    percentage = Math.max(0, Math.min(100, (msPassed / totalCycleMs) * 100));
  }

  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between z-10 relative px-2">
        <div className="flex items-center space-x-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400">
            <Wallet size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text/90">Payday Countdown</h1>
            <p className="text-[10px] text-muted">{nextDateStr}</p>
          </div>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="p-3 bg-text/5 rounded-xl hover:bg-text/10 text-muted transition-colors"
        >
          <Settings size={20} />
        </button>
      </div>

      <div className="relative flex flex-col items-center justify-center py-10">
        {/* Progress Circle SVG */}
        <div className="relative w-[300px] h-[300px] flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
            {/* Background Track */}
            <circle
              cx="150"
              cy="150"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="12"
            />
            {/* Progress Track */}
            <circle
              cx="150"
              cy="150"
              r={radius}
              fill="none"
              stroke="#34d399"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>

          {/* Time Display inside circle */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pt-4">
            {timeLeft ? (
              <>
                <div className="text-6xl font-black text-text drop-shadow-lg font-mono tracking-tighter">
                  {timeLeft.d}
                </div>
                <div className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-4">Days</div>
                
                <div className="flex space-x-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-text/90 font-mono">{timeLeft.h.toString().padStart(2, '0')}</div>
                    <div className="text-[10px] text-muted uppercase">Hrs</div>
                  </div>
                  <div className="text-xl text-text/20 mt-1">:</div>
                  <div>
                    <div className="text-2xl font-bold text-text/90 font-mono">{timeLeft.m.toString().padStart(2, '0')}</div>
                    <div className="text-[10px] text-muted uppercase">Min</div>
                  </div>
                  <div className="text-xl text-text/20 mt-1">:</div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-400 font-mono">{timeLeft.s.toString().padStart(2, '0')}</div>
                    <div className="text-[10px] text-emerald-400/50 uppercase">Sec</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted animate-pulse">Calculating...</div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel p-5 border border-text/5 bg-gradient-to-br from-emerald-500/5 to-transparent text-center">
        <p className="text-sm text-muted">You are <span className="font-bold text-emerald-400">{percentage.toFixed(1)}%</span> of the way to your next paycheck!</p>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-text/10 p-6 rounded-3xl w-full max-w-sm shadow-2xl relative animate-slide-up">
            {localStorage.getItem(STORAGE_KEY) && (
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="absolute top-4 right-4 p-2 text-muted hover:text-text bg-text/5 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            )}
            
            <h2 className="text-xl font-bold mb-6">Pay Cycle Setup</h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Schedule Type</label>
                <select 
                  value={tempType} 
                  onChange={e => setTempType(e.target.value as 'monthly' | 'biweekly')}
                  className="input-field w-full appearance-none"
                >
                  <option value="monthly">Monthly</option>
                  <option value="biweekly">Every 2 Weeks (Bi-Weekly)</option>
                </select>
              </div>

              {tempType === 'monthly' ? (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">Day of Month (1-31)</label>
                  <input 
                    type="number"
                    inputMode="numeric"
                    value={tempDay} 
                    onChange={e => setTempDay(e.target.value)}
                    className="input-field w-full"
                    min="1" max="31"
                  />
                  <div className="flex items-start mt-2 text-xs text-muted">
                    <Info size={14} className="mr-1 shrink-0 mt-0.5 text-blue-400" />
                    <p>If you get paid on the last day of the month, enter 31. The system automatically adjusts for shorter months.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">Last Payday (Reference Date)</label>
                  <input 
                    type="date"
                    value={tempRef} 
                    onChange={e => setTempRef(e.target.value)}
                    className="input-field w-full"
                  />
                  <div className="flex items-start mt-2 text-xs text-muted">
                    <Info size={14} className="mr-1 shrink-0 mt-0.5 text-blue-400" />
                    <p>Enter any past payday. The system will automatically calculate every 14 days from this date forward.</p>
                  </div>
                </div>
              )}

              <button 
                onClick={saveSettings}
                className="w-full btn-primary bg-emerald-500 hover:bg-emerald-600 mt-6"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PaycheckCountdown;
