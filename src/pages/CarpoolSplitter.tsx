import React, { useState } from 'react';
import { Car, Users, Info, Receipt } from 'lucide-react';

const CarpoolSplitter: React.FC = () => {
  const [fuel, setFuel] = useState('');
  const [toll, setToll] = useState('');
  const [parking, setParking] = useState('');
  const [passengers, setPassengers] = useState('4');

  const fuelCost = parseFloat(fuel.replace(/,/g, '')) || 0;
  const tollCost = parseFloat(toll.replace(/,/g, '')) || 0;
  const parkingCost = parseFloat(parking.replace(/,/g, '')) || 0;
  const totalPeople = parseInt(passengers) || 1;

  const totalCost = fuelCost + tollCost + parkingCost;
  const costPerPerson = totalCost / (totalPeople > 0 ? totalPeople : 1);

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
      <div className="flex items-center space-x-3 px-2 z-10 relative">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-500/20 text-cyan-400">
          <Car size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text/90">Carpool Splitter</h1>
          <p className="text-[10px] text-muted uppercase tracking-wider">Road Trip Math</p>
        </div>
      </div>

      <div className="glass-panel p-6 border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
        <div className="text-center mb-8">
          <p className="text-sm font-bold text-muted uppercase tracking-widest mb-2">Each Person Pays</p>
          <h2 className="text-6xl font-black text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <span className="text-2xl text-cyan-500/70 mr-1">RM</span>
            {costPerPerson.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <div className="mt-3 inline-flex items-center px-3 py-1 bg-text/5 rounded-full text-xs text-muted font-medium">
            <Receipt size={14} className="mr-2 opacity-50" />
            Total Trip Cost: RM {totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Fuel Cost (RM)</label>
              <input 
                type="text"
                inputMode="decimal"
                value={fuel} 
                onChange={e => setFuel(e.target.value.replace(/[^0-9.]/g, ''))}
                className="input-field w-full text-lg font-mono placeholder:text-text/20"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Toll Cost (RM)</label>
              <input 
                type="text"
                inputMode="decimal"
                value={toll} 
                onChange={e => setToll(e.target.value.replace(/[^0-9.]/g, ''))}
                className="input-field w-full text-lg font-mono placeholder:text-text/20"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Parking Cost (RM)</label>
              <input 
                type="text"
                inputMode="decimal"
                value={parking} 
                onChange={e => setParking(e.target.value.replace(/[^0-9.]/g, ''))}
                className="input-field w-full text-lg font-mono placeholder:text-text/20"
                placeholder="0.00"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center">
                <Users size={12} className="mr-1" /> Total People
              </label>
              <div className="flex items-center">
                <button 
                  onClick={() => setPassengers(p => Math.max(1, parseInt(p) - 1).toString())}
                  className="w-12 h-[46px] bg-text/5 border border-text/10 rounded-l-xl hover:bg-text/10 flex items-center justify-center text-xl font-bold"
                >
                  -
                </button>
                <input 
                  type="text"
                  inputMode="numeric"
                  value={passengers} 
                  onChange={e => setPassengers(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full h-[46px] bg-text/5 border-y border-text/10 text-center text-lg font-bold text-cyan-400 focus:outline-none focus:bg-text/10 transition-colors"
                />
                <button 
                  onClick={() => setPassengers(p => (parseInt(p) + 1).toString())}
                  className="w-12 h-[46px] bg-text/5 border border-text/10 rounded-r-xl hover:bg-text/10 flex items-center justify-center text-xl font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-cyan-500/10 rounded-xl border border-cyan-500/20 flex items-start text-xs text-muted">
          <Info size={16} className="text-cyan-400 mr-2 shrink-0 mt-0.5" />
          <p>
            Unlike normal expense splitting where different people pay for different items, carpool cost splitting simply sums up all the driver's vehicle expenses and divides it equally among everyone in the car.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CarpoolSplitter;
