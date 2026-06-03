import React, { useState, useEffect } from 'react';
import { Plane, Plus, Trash2, ChevronLeft, Map } from 'lucide-react';

interface BudgetItem {
  id: string;
  name: string;
  cost: number;
}

interface Trip {
  id: string;
  title: string;
  items: BudgetItem[];
}

const TripBudget: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>(() => {
    const saved = localStorage.getItem('tb_trips');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  
  // Home View State
  const [newTripTitle, setNewTripTitle] = useState('');

  // Edit View State
  const [newItemName, setNewItemName] = useState('');
  const [newItemCost, setNewItemCost] = useState('');

  useEffect(() => {
    localStorage.setItem('tb_trips', JSON.stringify(trips));
  }, [trips]);

  const addTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripTitle.trim()) return;
    
    const newTrip: Trip = {
      id: Math.random().toString(),
      title: newTripTitle.trim(),
      items: []
    };
    
    setTrips([...trips, newTrip]);
    setNewTripTitle('');
    setActiveTripId(newTrip.id);
  };

  const deleteTrip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this trip and all its budgets?")) {
      setTrips(trips.filter(t => t.id !== id));
    }
  };

  const activeTrip = trips.find(t => t.id === activeTripId);

  const addBudgetItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !newItemName.trim() || !newItemCost) return;
    const cost = parseFloat(newItemCost);
    if (isNaN(cost) || cost < 0) return;

    const updatedTrips = trips.map(t => {
      if (t.id === activeTrip.id) {
        return {
          ...t,
          items: [...t.items, { id: Math.random().toString(), name: newItemName.trim(), cost }]
        };
      }
      return t;
    });

    setTrips(updatedTrips);
    setNewItemName('');
    setNewItemCost('');
  };

  const removeBudgetItem = (itemId: string) => {
    if (!activeTrip) return;
    const updatedTrips = trips.map(t => {
      if (t.id === activeTrip.id) {
        return {
          ...t,
          items: t.items.filter(i => i.id !== itemId)
        };
      }
      return t;
    });
    setTrips(updatedTrips);
  };

  if (activeTrip) {
    const totalBudget = activeTrip.items.reduce((sum, item) => sum + item.cost, 0);

    return (
      <div className="space-y-6 animate-fade-in pb-12">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setActiveTripId(null)}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold truncate pr-4">{activeTrip.title}</h2>
            <p className="text-sm text-cyan-400 font-bold">Total: ${totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Add Item Form */}
        <div className="glass-panel p-5 border-white/10">
          <form onSubmit={addBudgetItem} className="flex space-x-2">
            <input 
              type="text" 
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Expense (e.g. Flight)"
              className="input-field flex-1"
            />
            <input 
              type="number" 
              step="0.01"
              min="0"
              value={newItemCost}
              onChange={(e) => setNewItemCost(e.target.value)}
              placeholder="$0.00"
              className="input-field w-24 text-center"
            />
            <button type="submit" disabled={!newItemName || !newItemCost} className="p-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-xl transition-colors disabled:opacity-50">
              <Plus size={20} />
            </button>
          </form>
        </div>

        {/* Items List */}
        <div className="space-y-2">
          {activeTrip.items.map(item => (
            <div key={item.id} className="flex justify-between items-center bg-white/5 border border-white/5 rounded-lg p-4 group hover:bg-white/10 transition-colors">
              <span className="font-medium">{item.name}</span>
              <div className="flex items-center space-x-4">
                <span className="font-bold text-cyan-400">${item.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <button onClick={() => removeBudgetItem(item.id)} className="text-muted hover:text-red-400 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {activeTrip.items.length === 0 && (
            <p className="text-center text-sm text-muted py-8 border border-dashed border-white/10 rounded-lg">No expenses added yet.</p>
          )}
        </div>
      </div>
    );
  }

  // Home View
  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl">
          <Plane size={24} />
        </div>
        <h2 className="text-2xl font-bold">Trip Budgets</h2>
      </div>

      <div className="glass-panel p-5 border-white/10">
        <h3 className="font-semibold mb-4 text-sm text-muted">Plan New Trip</h3>
        <form onSubmit={addTrip} className="flex space-x-2">
          <input 
            type="text" 
            value={newTripTitle}
            onChange={(e) => setNewTripTitle(e.target.value)}
            placeholder="Trip Name (e.g. Japan 2026)"
            className="input-field flex-1"
          />
          <button 
            type="submit" 
            disabled={!newTripTitle}
            className="px-4 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            Create
          </button>
        </form>
      </div>

      <div className="grid gap-4">
        {trips.map(trip => {
          const total = trip.items.reduce((sum, item) => sum + item.cost, 0);
          return (
            <div 
              key={trip.id} 
              onClick={() => setActiveTripId(trip.id)}
              className="glass-panel p-5 border-white/10 hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(34,211,238,0.1)] cursor-pointer transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-white/5 rounded-xl group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition-colors">
                  <Map size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{trip.title}</h3>
                  <p className="text-sm text-muted">{trip.items.length} expenses</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="font-bold text-lg text-cyan-400">
                  ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <button 
                  onClick={(e) => deleteTrip(trip.id, e)}
                  className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          );
        })}

        {trips.length === 0 && (
          <div className="glass-panel p-8 text-center text-muted border-dashed">
            <Plane size={48} className="mx-auto mb-3 opacity-20" />
            <p>No trips planned.<br/>Create a trip to start budgeting!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripBudget;
