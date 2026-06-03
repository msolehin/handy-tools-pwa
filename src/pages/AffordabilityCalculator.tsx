import React, { useState, useEffect } from 'react';
import { Wallet, Banknote, Clock, Percent, RefreshCw, Calendar, Briefcase } from 'lucide-react';

const AffordabilityCalculator: React.FC = () => {
  const [salary, setSalary] = useState(() => localStorage.getItem('aff_salary') || '');
  const [hoursPerDay, setHoursPerDay] = useState(() => localStorage.getItem('aff_hpd') || '8');
  const [price, setPrice] = useState(() => localStorage.getItem('aff_price') || '');

  useEffect(() => { localStorage.setItem('aff_salary', salary); }, [salary]);
  useEffect(() => { localStorage.setItem('aff_hpd', hoursPerDay); }, [hoursPerDay]);
  useEffect(() => { localStorage.setItem('aff_price', price); }, [price]);

  const handleReset = () => {
    if (window.confirm("Reset all inputs?")) {
      setSalary('');
      setHoursPerDay('8');
      setPrice('');
      localStorage.removeItem('aff_salary');
      localStorage.removeItem('aff_hpd');
      localStorage.removeItem('aff_price');
    }
  };

  const sVal = parseFloat(salary) || 0;
  const hpdVal = parseFloat(hoursPerDay) || 8;
  const pVal = parseFloat(price) || 0;

  let percentage = 0;
  let hoursNeeded = 0;
  let daysNeeded = 0;

  if (sVal > 0 && pVal > 0) {
    percentage = (pVal / sVal) * 100;
    // Assume 20 working days per month for hourly wage calculation
    const hourlyWage = sVal / (20 * hpdVal);
    hoursNeeded = pVal / hourlyWage;
    daysNeeded = hoursNeeded / hpdVal;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-500/20 text-green-400 rounded-xl">
            <Wallet size={24} />
          </div>
          <h2 className="text-2xl font-bold">Can I Afford It?</h2>
        </div>
        <button 
          onClick={handleReset}
          className="text-xs flex items-center text-muted hover:text-white transition-colors"
        >
          <RefreshCw size={12} className="mr-1" /> Reset
        </button>
      </div>

      <div className="space-y-4">
        {/* Salary Input */}
        <div className="glass-panel p-5 border-white/10">
          <div className="flex items-center space-x-2 mb-3">
            <Banknote className="text-green-400" size={18} />
            <h3 className="font-semibold">Monthly Salary</h3>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-muted text-lg font-medium">RM</span>
            </div>
            <input 
              type="number" 
              min="0"
              step="0.01"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              placeholder="e.g. 3200"
              className="w-full bg-background border border-white/10 rounded-xl pl-14 pr-4 py-4 text-xl font-bold text-white focus:outline-none focus:border-green-400 transition-colors"
            />
          </div>
          <p className="text-xs text-muted mt-2">
            *Assuming 20 working days per month.
          </p>
        </div>

        {/* Work Hours Input */}
        <div className="glass-panel p-5 border-white/10">
          <div className="flex items-center space-x-2 mb-3">
            <Briefcase className="text-blue-400" size={18} />
            <h3 className="font-semibold">Work Hours Per Day</h3>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <span className="text-muted font-medium">hours</span>
            </div>
            <input 
              type="number" 
              min="1"
              max="24"
              step="0.5"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(e.target.value)}
              placeholder="e.g. 8"
              className="w-full bg-background border border-white/10 rounded-xl pl-4 pr-16 py-4 text-xl font-bold text-white focus:outline-none focus:border-blue-400 transition-colors"
            />
          </div>
        </div>

        {/* Price Input */}
        <div className="glass-panel p-5 border-white/10">
          <div className="flex items-center space-x-2 mb-3">
            <Wallet className="text-accent" size={18} />
            <h3 className="font-semibold">Item Price</h3>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-muted text-lg font-medium">RM</span>
            </div>
            <input 
              type="number" 
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 150"
              className="w-full bg-background border border-white/10 rounded-xl pl-14 pr-4 py-4 text-xl font-bold text-white focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        {/* Output */}
        {sVal > 0 && pVal > 0 ? (
          <div className="glass-panel p-6 border-white/10 bg-gradient-to-br from-surface to-surface/50 mt-8 space-y-6 animate-slide-up relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 bg-green-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 p-12 bg-accent/5 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none" />
            
            <h3 className="font-semibold text-lg text-center mb-4">The True Cost</h3>
            
            <div className="flex flex-col space-y-4 relative z-10">
              <div className="flex items-center space-x-4 bg-black/20 p-4 rounded-xl">
                <div className="p-3 bg-accent/20 text-accent rounded-full shrink-0">
                  <Percent size={24} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">
                    {percentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
                  </div>
                  <div className="text-sm text-muted">of your monthly income</div>
                </div>
              </div>

              <div className="flex items-center space-x-4 bg-black/20 p-4 rounded-xl">
                <div className="p-3 bg-green-500/20 text-green-400 rounded-full shrink-0">
                  <Clock size={24} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">
                    {hoursNeeded.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-lg">hours</span>
                  </div>
                  <div className="text-sm text-muted">of actual work needed to buy this</div>
                </div>
              </div>

              <div className="flex items-center space-x-4 bg-black/20 p-4 rounded-xl">
                <div className="p-3 bg-blue-500/20 text-blue-400 rounded-full shrink-0">
                  <Calendar size={24} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">
                    {daysNeeded.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-lg">days</span>
                  </div>
                  <div className="text-sm text-muted">of full work days required</div>
                </div>
              </div>
            </div>
            
            {hoursNeeded > 40 && (
              <p className="text-xs text-center text-accent font-medium pt-2">
                Wow, that's more than a full week of work!
              </p>
            )}
          </div>
        ) : (
          <div className="glass-panel p-8 text-center text-muted mt-8 border-dashed">
            <p>Enter your salary and the item price to see the true cost.</p>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default AffordabilityCalculator;
