import React, { useState, useEffect } from 'react';
import { Banknote, ArrowRightLeft, RefreshCw, WifiOff, Globe } from 'lucide-react';

const CURRENCIES: Record<string, { name: string, flag: string }> = {
  MYR: { name: 'Malaysian Ringgit', flag: '🇲🇾' },
  USD: { name: 'US Dollar', flag: '🇺🇸' },
  SGD: { name: 'Singapore Dollar', flag: '🇸🇬' },
  IDR: { name: 'Indonesian Rupiah', flag: '🇮🇩' },
  THB: { name: 'Thai Baht', flag: '🇹🇭' },
  EUR: { name: 'Euro', flag: '🇪🇺' },
  GBP: { name: 'British Pound', flag: '🇬🇧' },
  JPY: { name: 'Japanese Yen', flag: '🇯🇵' },
  AUD: { name: 'Australian Dollar', flag: '🇦🇺' },
  CNY: { name: 'Chinese Yuan', flag: '🇨🇳' },
  KRW: { name: 'South Korean Won', flag: '🇰🇷' },
  INR: { name: 'Indian Rupee', flag: '🇮🇳' },
  AED: { name: 'UAE Dirham', flag: '🇦🇪' },
  SAR: { name: 'Saudi Riyal', flag: '🇸🇦' },
  CHF: { name: 'Swiss Franc', flag: '🇨🇭' },
  CAD: { name: 'Canadian Dollar', flag: '🇨🇦' },
};

// Base currency is USD as per open.er-api.com
interface Rates {
  [key: string]: number;
}

const CACHE_KEY = 'currency_rates_cache';

const CurrencyConverter: React.FC = () => {
  const [rates, setRates] = useState<Rates>({});
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isOffline, setIsOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [fromCur, setFromCur] = useState('MYR');
  const [toCur, setToCur] = useState('USD');
  const [fromVal, setFromVal] = useState('1');
  const [toVal, setToVal] = useState('');

  const fetchRates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      
      if (data && data.rates) {
        setRates(data.rates);
        const dateStr = new Date(data.time_last_update_unix * 1000).toLocaleString();
        setLastUpdated(dateStr);
        setIsOffline(false);
        
        // Save to cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          rates: data.rates,
          timestamp: dateStr
        }));
      }
    } catch (err) {
      console.error('Failed to fetch rates', err);
      // Fallback to cache
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setRates(parsed.rates);
          setLastUpdated(parsed.timestamp);
          setIsOffline(true);
        } catch (e) {
          // Bad cache
        }
      } else {
        setIsOffline(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  // Helper to format numbers with commas
  const formatAmount = (num: number) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    });
  };

  // Helper to format input string as you type
  const formatInputStr = (val: string) => {
    if (val === '') return '';
    let clean = val.replace(/[^0-9.]/g, '');
    if (clean === '') return '';
    
    const parts = clean.split('.');
    let intPart = parts[0];
    let decPart = parts.length > 1 ? '.' + parts[1] : '';
    
    if (intPart !== '') {
      const parsed = parseInt(intPart, 10);
      intPart = isNaN(parsed) ? '0' : parsed.toString();
      intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    } else {
      intPart = '0';
    }
    
    return intPart + decPart;
  };

  // Recalculate whenever inputs or rates change
  useEffect(() => {
    if (!rates[fromCur] || !rates[toCur]) return;

    if (fromVal === '') {
      setToVal('');
      return;
    }
    
    // Strip commas for math
    const num = parseFloat(fromVal.replace(/,/g, ''));
    if (isNaN(num)) {
      setToVal('');
      return;
    }

    // Convert from -> USD -> to
    const inUsd = num / rates[fromCur];
    const converted = inUsd * rates[toCur];
    
    setToVal(formatAmount(converted));
  }, [fromVal, fromCur, toCur, rates]);

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatInputStr(e.target.value);
    setFromVal(formatted);
  };

  const handleSwap = () => {
    const oldFrom = fromCur;
    setFromCur(toCur);
    setToCur(oldFrom);
    // When swapping, the active value shifts
    setFromVal(toVal);
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatInputStr(e.target.value);
    setToVal(formatted);
    
    if (!rates[fromCur] || !rates[toCur]) return;
    
    if (formatted === '') {
      setFromVal('');
      return;
    }

    const num = parseFloat(formatted.replace(/,/g, ''));
    if (isNaN(num)) {
      setFromVal('');
      return;
    }

    // Convert to -> USD -> from
    const inUsd = num / rates[toCur];
    const converted = inUsd * rates[fromCur];
    
    setFromVal(formatAmount(converted));
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mb-2">
          <Banknote size={32} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white/90">Currency Converter</h1>
        <p className="text-sm text-muted">Live exchange rates & offline support</p>
      </div>

      <div className="glass-panel p-6 space-y-6 relative">
        
        {/* Status Indicator */}
        <div className="absolute top-4 right-4 flex items-center space-x-2">
          {isLoading ? (
            <RefreshCw size={14} className="text-emerald-400 animate-spin" />
          ) : isOffline ? (
            <div className="flex items-center text-orange-400 text-[10px]" title="Using cached offline rates">
              <WifiOff size={12} className="mr-1" /> Offline
            </div>
          ) : (
            <div className="flex items-center text-emerald-400 text-[10px]" title="Live rates synced">
              <Globe size={12} className="mr-1" /> Live
            </div>
          )}
        </div>

        {Object.keys(rates).length === 0 && !isLoading ? (
          <div className="text-center p-4 bg-orange-500/10 rounded-xl border border-orange-500/20">
            <p className="text-sm text-orange-400">No exchange rates available. Please connect to the internet to fetch rates for the first time.</p>
          </div>
        ) : (
          <>
            {/* FROM */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider">From</label>
              <div className="flex space-x-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={fromVal}
                  onChange={handleFromChange}
                  className="input-field flex-1 text-lg font-mono placeholder:text-white/20"
                  placeholder="0.00"
                />
                <select
                  value={fromCur}
                  onChange={(e) => setFromCur(e.target.value)}
                  className="input-field w-36 appearance-none text-sm"
                >
                  {Object.entries(CURRENCIES).map(([code, cur]) => (
                    <option key={code} value={code}>
                      {cur.flag} {code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* SWAP BUTTON */}
            <div className="flex justify-center -my-2 relative z-10">
              <button 
                onClick={handleSwap}
                className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-muted hover:text-white hover:bg-white/5 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all active:scale-95"
              >
                <ArrowRightLeft size={18} className="rotate-90" />
              </button>
            </div>

            {/* TO */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider">To</label>
              <div className="flex space-x-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={toVal}
                  onChange={handleToChange}
                  className="input-field flex-1 text-lg font-mono placeholder:text-white/20"
                  placeholder="0.00"
                />
                <select
                  value={toCur}
                  onChange={(e) => setToCur(e.target.value)}
                  className="input-field w-36 appearance-none text-sm"
                >
                  {Object.entries(CURRENCIES).map(([code, cur]) => (
                    <option key={code} value={code}>
                      {cur.flag} {code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {lastUpdated && (
              <p className="text-[10px] text-muted text-center italic mt-4 border-t border-white/5 pt-4">
                Rates last updated: {lastUpdated}
              </p>
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default CurrencyConverter;
