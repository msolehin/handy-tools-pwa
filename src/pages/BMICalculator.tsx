import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw } from 'lucide-react';

const BMICalculator: React.FC = () => {
  const [height, setHeight] = useState(() => localStorage.getItem('bmi_height') || '');
  const [weight, setWeight] = useState(() => localStorage.getItem('bmi_weight') || '');

  useEffect(() => { localStorage.setItem('bmi_height', height); }, [height]);
  useEffect(() => { localStorage.setItem('bmi_weight', weight); }, [weight]);

  const handleReset = () => {
    if (window.confirm("Reset all inputs?")) {
      setHeight('');
      setWeight('');
      localStorage.removeItem('bmi_height');
      localStorage.removeItem('bmi_weight');
    }
  };

  const hVal = parseFloat(height) || 0; // cm
  const wVal = parseFloat(weight) || 0; // kg

  let bmi = 0;
  let category = '';
  let colorClass = '';
  let needlePercent = 0;

  if (hVal > 0 && wVal > 0) {
    const heightInMeters = hVal / 100;
    bmi = wVal / (heightInMeters * heightInMeters);

    if (bmi < 18.5) {
      category = 'Underweight';
      colorClass = 'text-blue-400';
      needlePercent = (bmi / 18.5) * 25; // First 25% of the bar
    } else if (bmi >= 18.5 && bmi <= 24.9) {
      category = 'Normal';
      colorClass = 'text-green-400';
      needlePercent = 25 + ((bmi - 18.5) / (24.9 - 18.5)) * 25; // 25% to 50%
    } else if (bmi >= 25 && bmi <= 29.9) {
      category = 'Overweight';
      colorClass = 'text-yellow-400';
      needlePercent = 50 + ((bmi - 25) / (29.9 - 25)) * 25; // 50% to 75%
    } else {
      category = 'Obese';
      colorClass = 'text-red-400';
      needlePercent = 75 + Math.min(((bmi - 30) / 10) * 25, 25); // 75% to 100% (cap at 40 BMI for gauge)
    }
    
    // Clamp needle for UI safely
    needlePercent = Math.max(0, Math.min(100, needlePercent));
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Activity size={24} />
          </div>
          <h2 className="text-2xl font-bold">BMI Calculator</h2>
        </div>
        <button 
          onClick={handleReset}
          className="text-xs flex items-center text-muted hover:text-white transition-colors"
        >
          <RefreshCw size={12} className="mr-1" /> Reset
        </button>
      </div>

      <div className="space-y-4">
        {/* Height Input */}
        <div className="glass-panel p-5 border-white/10">
          <h3 className="font-semibold mb-3">Height</h3>
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <span className="text-muted font-medium">cm</span>
            </div>
            <input 
              type="number" 
              min="0"
              step="0.1"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="e.g. 175"
              className="w-full bg-background border border-white/10 rounded-xl pl-4 pr-12 py-4 text-xl font-bold text-white focus:outline-none focus:border-emerald-400 transition-colors"
            />
          </div>
        </div>

        {/* Weight Input */}
        <div className="glass-panel p-5 border-white/10">
          <h3 className="font-semibold mb-3">Weight</h3>
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <span className="text-muted font-medium">kg</span>
            </div>
            <input 
              type="number" 
              min="0"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 70"
              className="w-full bg-background border border-white/10 rounded-xl pl-4 pr-12 py-4 text-xl font-bold text-white focus:outline-none focus:border-emerald-400 transition-colors"
            />
          </div>
        </div>

        {/* Output */}
        {bmi > 0 ? (
          <div className="glass-panel p-6 border-white/10 bg-gradient-to-br from-surface to-surface/50 mt-8 space-y-6 animate-slide-up relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            
            <div className="text-center relative z-10">
              <p className="text-sm text-muted mb-1">Your BMI</p>
              <h3 className={`text-6xl font-black mb-2 ${colorClass}`}>
                {bmi.toFixed(1)}
              </h3>
              <p className={`text-xl font-bold uppercase tracking-wider ${colorClass}`}>
                {category}
              </p>
            </div>

            {/* Gauge */}
            <div className="relative pt-6 pb-2 z-10">
              <div className="flex h-4 rounded-full overflow-hidden w-full">
                <div className="bg-blue-400/80 w-1/4 h-full" />
                <div className="bg-green-400/80 w-1/4 h-full" />
                <div className="bg-yellow-400/80 w-1/4 h-full" />
                <div className="bg-red-400/80 w-1/4 h-full" />
              </div>
              <div 
                className="absolute top-2 w-4 h-8 bg-white shadow-md rounded border-2 border-black -ml-2 transition-all duration-500 ease-out"
                style={{ left: `${needlePercent}%` }}
              >
                <div className="w-0.5 h-full bg-black mx-auto opacity-20" />
              </div>
              <div className="flex justify-between text-[10px] text-muted mt-2 font-bold px-1 uppercase">
                <span className="w-1/4 text-center">Under</span>
                <span className="w-1/4 text-center">Normal</span>
                <span className="w-1/4 text-center">Over</span>
                <span className="w-1/4 text-center">Obese</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel p-8 text-center text-muted mt-8 border-dashed">
            <p>Enter your height and weight to calculate your BMI.</p>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default BMICalculator;
