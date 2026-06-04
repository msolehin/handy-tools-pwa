import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Ruler, Weight, Thermometer, Droplets } from 'lucide-react';

type CategoryId = 'length' | 'weight' | 'temperature' | 'volume';

interface UnitDef {
  name: string;
  toBase: (v: number) => number;
  fromBase: (v: number) => number;
}

interface CategoryDef {
  name: string;
  icon: React.FC<any>;
  base: string;
  units: Record<string, UnitDef>;
}

const CATEGORIES: Record<CategoryId, CategoryDef> = {
  length: {
    name: 'Length',
    icon: Ruler,
    base: 'm',
    units: {
      km: { name: 'Kilometers (km)', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
      m: { name: 'Meters (m)', toBase: (v) => v, fromBase: (v) => v },
      cm: { name: 'Centimeters (cm)', toBase: (v) => v / 100, fromBase: (v) => v * 100 },
      mm: { name: 'Millimeters (mm)', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
      mi: { name: 'Miles (mi)', toBase: (v) => v * 1609.34, fromBase: (v) => v / 1609.34 },
      yd: { name: 'Yards (yd)', toBase: (v) => v * 0.9144, fromBase: (v) => v / 0.9144 },
      ft: { name: 'Feet (ft)', toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
      in: { name: 'Inches (in)', toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
    }
  },
  weight: {
    name: 'Weight',
    icon: Weight,
    base: 'kg',
    units: {
      kg: { name: 'Kilograms (kg)', toBase: (v) => v, fromBase: (v) => v },
      g: { name: 'Grams (g)', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
      mg: { name: 'Milligrams (mg)', toBase: (v) => v / 1e6, fromBase: (v) => v * 1e6 },
      lb: { name: 'Pounds (lb)', toBase: (v) => v * 0.453592, fromBase: (v) => v / 0.453592 },
      oz: { name: 'Ounces (oz)', toBase: (v) => v * 0.0283495, fromBase: (v) => v / 0.0283495 },
    }
  },
  temperature: {
    name: 'Temperature',
    icon: Thermometer,
    base: 'c',
    units: {
      c: { name: 'Celsius (°C)', toBase: (v) => v, fromBase: (v) => v },
      f: { name: 'Fahrenheit (°F)', toBase: (v) => (v - 32) * 5/9, fromBase: (v) => (v * 9/5) + 32 },
      k: { name: 'Kelvin (K)', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    }
  },
  volume: {
    name: 'Volume',
    icon: Droplets,
    base: 'l',
    units: {
      l: { name: 'Liters (L)', toBase: (v) => v, fromBase: (v) => v },
      ml: { name: 'Milliliters (mL)', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
      gal: { name: 'Gallons (US)', toBase: (v) => v * 3.78541, fromBase: (v) => v / 3.78541 },
      oz: { name: 'Fluid Ounces (US)', toBase: (v) => v * 0.0295735, fromBase: (v) => v / 0.0295735 },
    }
  }
};

const UnitConverter: React.FC = () => {
  const [category, setCategory] = useState<CategoryId>('length');
  const [unitFrom, setUnitFrom] = useState('m');
  const [unitTo, setUnitTo] = useState('ft');
  
  const [valFrom, setValFrom] = useState('1');
  const [valTo, setValTo] = useState('');

  // Handle category change
  useEffect(() => {
    const keys = Object.keys(CATEGORIES[category].units);
    setUnitFrom(keys[0]);
    setUnitTo(keys[1] || keys[0]);
  }, [category]);

  // Convert whenever relevant state changes
  useEffect(() => {
    if (valFrom === '') {
      setValTo('');
      return;
    }
    
    const num = parseFloat(valFrom);
    if (isNaN(num)) {
      setValTo('');
      return;
    }

    const catDef = CATEGORIES[category];
    const fromDef = catDef.units[unitFrom];
    const toDef = catDef.units[unitTo];

    if (!fromDef || !toDef) return;

    // Convert from -> base -> to
    const baseValue = fromDef.toBase(num);
    const toValue = toDef.fromBase(baseValue);
    
    // Format: drop insignificant decimals up to 6 places
    setValTo(parseFloat(toValue.toFixed(6)).toString());
  }, [valFrom, unitFrom, unitTo, category]);

  const handleSwap = () => {
    const oldFrom = unitFrom;
    setUnitFrom(unitTo);
    setUnitTo(oldFrom);
    setValFrom(valTo);
  };

  const handleValFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValFrom(e.target.value);
  };

  const handleValToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValTo(e.target.value);
    
    if (e.target.value === '') {
      setValFrom('');
      return;
    }
    
    const num = parseFloat(e.target.value);
    if (isNaN(num)) {
      setValFrom('');
      return;
    }

    const catDef = CATEGORIES[category];
    const fromDef = catDef.units[unitFrom];
    const toDef = catDef.units[unitTo];

    if (!fromDef || !toDef) return;

    // Reverse conversion: to -> base -> from
    const baseValue = toDef.toBase(num);
    const fromValue = fromDef.fromBase(baseValue);
    
    setValFrom(parseFloat(fromValue.toFixed(6)).toString());
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/20 text-indigo-400 mb-2">
          <ArrowRightLeft size={32} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white/90">Unit Converter</h1>
        <p className="text-sm text-muted">Instantly convert measurements</p>
      </div>

      {/* Category Tabs */}
      <div className="glass-panel p-2 flex flex-wrap gap-2 justify-center">
        {(Object.entries(CATEGORIES) as [CategoryId, CategoryDef][]).map(([key, cat]) => {
          const Icon = cat.icon;
          return (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${
                category === key 
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} />
              <span className="text-sm font-medium">{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Conversion Area */}
      <div className="glass-panel p-6 space-y-6">
        
        {/* FROM */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider">From</label>
          <div className="flex space-x-3">
            <input
              type="number"
              value={valFrom}
              onChange={handleValFromChange}
              className="input-field flex-1 text-lg font-mono placeholder:text-white/20"
              placeholder="0"
            />
            <select
              value={unitFrom}
              onChange={(e) => setUnitFrom(e.target.value)}
              className="input-field w-32 appearance-none text-sm"
            >
              {Object.entries(CATEGORIES[category].units).map(([uKey, uDef]) => (
                <option key={uKey} value={uKey}>{uDef.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* SWAP BUTTON */}
        <div className="flex justify-center -my-2 relative z-10">
          <button 
            onClick={handleSwap}
            className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-muted hover:text-white hover:bg-white/5 hover:border-indigo-500/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all active:scale-95"
          >
            <ArrowRightLeft size={18} className="rotate-90" />
          </button>
        </div>

        {/* TO */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider">To</label>
          <div className="flex space-x-3">
            <input
              type="number"
              value={valTo}
              onChange={handleValToChange}
              className="input-field flex-1 text-lg font-mono placeholder:text-white/20"
              placeholder="0"
            />
            <select
              value={unitTo}
              onChange={(e) => setUnitTo(e.target.value)}
              className="input-field w-32 appearance-none text-sm"
            >
              {Object.entries(CATEGORIES[category].units).map(([uKey, uDef]) => (
                <option key={uKey} value={uKey}>{uDef.name}</option>
              ))}
            </select>
          </div>
        </div>

      </div>
    </div>
  );
};

export default UnitConverter;
