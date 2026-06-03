import React, { useState, useEffect } from 'react';
import { Landmark, Percent, Calendar, RefreshCw, BadgeDollarSign } from 'lucide-react';

type TermType = 'years' | 'months';

const LoanCalculator: React.FC = () => {
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
      setPrincipal('');
      setRate('');
      setTerm('');
      setTermType('years');
      localStorage.removeItem('lc_principal');
      localStorage.removeItem('lc_rate');
      localStorage.removeItem('lc_term');
      localStorage.removeItem('lc_termType');
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
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-500/20 text-orange-400 rounded-xl">
            <Landmark size={24} />
          </div>
          <h2 className="text-2xl font-bold">Loan Calculator</h2>
        </div>
        <button 
          onClick={handleReset}
          className="text-xs flex items-center text-muted hover:text-white transition-colors"
        >
          <RefreshCw size={12} className="mr-1" /> Reset
        </button>
      </div>

      <div className="space-y-4">
        {/* Principal Input */}
        <div className="glass-panel p-5 border-white/10">
          <div className="flex items-center space-x-2 mb-3">
            <BadgeDollarSign className="text-orange-400" size={18} />
            <h3 className="font-semibold">Loan Amount</h3>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-muted text-lg font-medium">RM</span>
            </div>
            <input 
              type="number" 
              min="0"
              step="0.01"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              placeholder="e.g. 10000"
              className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-4 text-xl font-bold text-white focus:outline-none focus:border-orange-400 transition-colors"
            />
          </div>
        </div>

        {/* Rate Input */}
        <div className="glass-panel p-5 border-white/10">
          <div className="flex items-center space-x-2 mb-3">
            <Percent className="text-accent" size={18} />
            <h3 className="font-semibold">Interest Rate (Annual)</h3>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <span className="text-muted text-lg font-medium">%</span>
            </div>
            <input 
              type="number" 
              min="0"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 5.5"
              className="w-full bg-background border border-white/10 rounded-xl pl-4 pr-10 py-4 text-xl font-bold text-white focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        {/* Term Input */}
        <div className="glass-panel p-5 border-white/10">
          <div className="flex items-center space-x-2 mb-3">
            <Calendar className="text-primary" size={18} />
            <h3 className="font-semibold">Loan Term</h3>
          </div>
          <div className="flex space-x-2 w-full">
            <input 
              type="number" 
              min="0"
              step="0.1"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="e.g. 30"
              className="w-2/3 min-w-0 bg-background border border-white/10 rounded-xl px-4 py-4 text-xl font-bold text-white focus:outline-none focus:border-primary transition-colors"
            />
            <select 
              value={termType}
              onChange={(e) => setTermType(e.target.value as TermType)}
              className="w-1/3 min-w-0 bg-background border border-white/10 rounded-xl px-2 py-4 text-sm text-white focus:outline-none focus:border-primary transition-colors appearance-none text-center"
            >
              <option value="years">Years</option>
              <option value="months">Months</option>
            </select>
          </div>
        </div>

        {/* Output */}
        {pVal > 0 && tVal > 0 ? (
          <div className="glass-panel p-6 border-white/10 bg-gradient-to-br from-surface to-surface/50 mt-8 space-y-6 animate-slide-up relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 bg-orange-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            
            <h3 className="font-semibold text-lg text-center mb-2">Payment Summary</h3>
            
            <div className="flex flex-col space-y-4 relative z-10">
              <div className="flex flex-col items-center justify-center bg-black/30 p-6 rounded-2xl border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.15)]">
                <div className="text-sm text-orange-400 font-medium mb-1">Monthly Payment</div>
                <div className="text-4xl font-black text-white">
                  RM{monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 p-4 rounded-xl text-center">
                  <div className="text-xs text-muted mb-1">Total Interest</div>
                  <div className="text-lg font-bold text-accent">
                    RM{totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                
                <div className="bg-black/20 p-4 rounded-xl text-center">
                  <div className="text-xs text-muted mb-1">Total Cost</div>
                  <div className="text-lg font-bold text-white">
                    RM{totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel p-8 text-center text-muted mt-8 border-dashed">
            <p>Enter your loan details to calculate the monthly payments.</p>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default LoanCalculator;
