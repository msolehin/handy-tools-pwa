import React, { useState } from 'react';
import { Fuel, Car, Users, Landmark, Calculator, AlertCircle } from 'lucide-react';

const FUEL_TYPES = [
  { id: 'ron95_subsidized', name: 'RON 95 (Budi MADANI)', defaultPrice: 1.99 },
  { id: 'ron95_float', name: 'RON 95 (Float)', defaultPrice: 3.72 },
  { id: 'ron97', name: 'RON 97', defaultPrice: 4.35 },
  { id: 'diesel_subsidized', name: 'Diesel (Budi MADANI)', defaultPrice: 2.15 },
  { id: 'diesel_float', name: 'Diesel (Float)', defaultPrice: 4.67 },
];

const VEHICLE_PRESETS = [
  { id: 'compact', name: 'Compact (15 km/L)', kml: 15 },
  { id: 'sedan', name: 'Sedan (12 km/L)', kml: 12 },
  { id: 'suv', name: 'SUV / MPV (10 km/L)', kml: 10 },
  { id: 'custom', name: 'Custom...', kml: 0 },
];

const TRIP_TYPES = [
  { id: 'mixed', name: 'Urban & Highway', multiplier: 1.0 },
  { id: 'highway', name: 'Highway (More Efficient)', multiplier: 1.15 },
  { id: 'city', name: 'City (Less Efficient)', multiplier: 0.85 },
];

const FuelCalculator: React.FC = () => {
  // Saved custom prices for each fuel type
  const [customPrices, setCustomPrices] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('fuel_custom_prices');
    return saved ? JSON.parse(saved) : {};
  });

  const [fuelType, setFuelType] = useState('ron95_subsidized');
  const [distance, setDistance] = useState<string>('');
  const [tollCost, setTollCost] = useState<string>('');
  const [passengers, setPassengers] = useState<number>(1);
  const [vehiclePreset, setVehiclePreset] = useState('sedan');
  const [customKml, setCustomKml] = useState<string>('');
  const [tripType, setTripType] = useState('mixed');

  // Get current active fuel price
  const activeFuel = FUEL_TYPES.find(f => f.id === fuelType)!;
  const currentPrice = customPrices[fuelType] ?? activeFuel.defaultPrice;

  // Handle custom price update
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      const newPrices = { ...customPrices, [fuelType]: val };
      setCustomPrices(newPrices);
      localStorage.setItem('fuel_custom_prices', JSON.stringify(newPrices));
    }
  };

  const resetPrice = () => {
    const newPrices = { ...customPrices };
    delete newPrices[fuelType];
    setCustomPrices(newPrices);
    localStorage.setItem('fuel_custom_prices', JSON.stringify(newPrices));
  };

  // Calculations
  const dist = parseFloat(distance) || 0;
  const tolls = parseFloat(tollCost) || 0;
  
  const getKml = () => {
    let baseKml = 12;
    if (vehiclePreset === 'custom') {
      baseKml = parseFloat(customKml) || 12;
    } else {
      baseKml = VEHICLE_PRESETS.find(p => p.id === vehiclePreset)?.kml || 12;
    }
    const tripMultiplier = TRIP_TYPES.find(t => t.id === tripType)?.multiplier || 1.0;
    return baseKml * tripMultiplier;
  };

  const kml = getKml();
  const fuelNeeded = kml > 0 ? dist / kml : 0;
  const fuelCost = fuelNeeded * currentPrice;
  const grandTotal = fuelCost + tolls;
  const perPerson = passengers > 0 ? grandTotal / passengers : grandTotal;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center space-x-3 mb-2">
        <div className="p-3 bg-orange-500/20 text-orange-400 rounded-xl">
          <Fuel size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Trip Cost Calculator</h2>
          <p className="text-sm text-muted">Estimate fuel and tolls for your journey</p>
        </div>
      </div>

      {/* Results Card */}
      <div className="glass-panel p-5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
        
        <div className="flex flex-col space-y-4 relative z-10">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted mb-1">Fuel Cost</p>
              <h3 className="text-xl font-bold text-text">RM {fuelCost.toFixed(2)}</h3>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted mb-1">Tolls</p>
              <h3 className="text-xl font-bold text-text">RM {tolls.toFixed(2)}</h3>
            </div>
          </div>
          
          <div className="h-px w-full bg-text/10" />

          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm text-muted mb-1">Grand Total</p>
              <h3 className="text-4xl font-black text-orange-400">
                RM {grandTotal.toFixed(2)}
              </h3>
            </div>
            {passengers > 1 && (
              <div className="text-right">
                <p className="text-sm text-muted mb-1">Per Person</p>
                <h3 className="text-xl font-bold text-text">
                  RM {perPerson.toFixed(2)}
                </h3>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input Form */}
      <div className="glass-panel p-5 space-y-5">
        
        {/* Distance & Tolls */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Distance (km)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <Calculator size={18} />
              </span>
              <input 
                type="number" 
                min="0" step="0.1"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="e.g. 350"
                className="input-field pl-10 w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Tolls (RM)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <Landmark size={18} />
              </span>
              <input 
                type="number" 
                min="0" step="0.1"
                value={tollCost}
                onChange={(e) => setTollCost(e.target.value)}
                placeholder="0.00"
                className="input-field pl-10 w-full"
              />
            </div>
          </div>
        </div>

        {/* Fuel & Vehicle */}
        <div className="space-y-4 pt-4 border-t border-text/5">
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Vehicle Efficiency</label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                  <Car size={18} />
                </span>
                <select 
                  value={vehiclePreset}
                  onChange={(e) => setVehiclePreset(e.target.value)}
                  className="input-field pl-10 w-full appearance-none"
                >
                  {VEHICLE_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {vehiclePreset === 'custom' && (
                <div className="relative w-24">
                  <input 
                    type="number" 
                    min="1" step="0.1"
                    value={customKml}
                    onChange={(e) => setCustomKml(e.target.value)}
                    placeholder="km/L"
                    className="input-field w-full px-2 text-center"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-2">Trip Type</label>
              <select 
                value={tripType}
                onChange={(e) => setTripType(e.target.value)}
                className="input-field w-full appearance-none"
              >
                {TRIP_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-2">Fuel Type</label>
              <select 
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value)}
                className="input-field w-full appearance-none"
              >
                {FUEL_TYPES.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>
            
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-muted">Price / Liter</label>
              {customPrices[fuelType] !== undefined && (
                <button onClick={resetPrice} className="text-[10px] text-orange-400 hover:text-orange-300">
                  Reset
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">RM</span>
              <input 
                type="number" 
                min="0" step="0.01"
                value={currentPrice}
                onChange={handlePriceChange}
                className="input-field w-full pl-10"
              />
            </div>
            <p className="text-[10px] text-muted/70 mt-1.5 italic">
              You can change the price manually. It will automatically be saved to your browser for next time.
            </p>
          </div>
        </div>

        {/* Passengers */}
        <div className="pt-4 border-t border-text/5">
          <label className="block text-sm font-medium text-muted mb-2">Split Bill (Passengers)</label>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setPassengers(Math.max(1, passengers - 1))}
              className="p-3 bg-black/20 rounded-xl hover:bg-black/40 transition-colors"
            >
              -
            </button>
            <div className="flex-1 flex items-center justify-center space-x-2 bg-black/10 rounded-xl py-2 border border-text/5">
              <Users size={18} className="text-muted" />
              <span className="font-bold text-lg">{passengers}</span>
            </div>
            <button 
              onClick={() => setPassengers(passengers + 1)}
              className="p-3 bg-black/20 rounded-xl hover:bg-black/40 transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>
      
      <div className="glass-panel p-4 flex items-start space-x-3 bg-orange-500/5 border-orange-500/10">
        <AlertCircle className="text-orange-400 shrink-0 mt-0.5" size={18} />
        <p className="text-xs text-muted leading-relaxed">
          Fuel prices default to standard Malaysian rates. You can edit the Price / Liter manually if rates change, and it will be saved on your device for next time. Turn on "Diesel (Budi MADANI)" if you receive targeted subsidies.
        </p>
      </div>

    </div>
  );
};

export default FuelCalculator;
