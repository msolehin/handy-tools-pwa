import React, { useState, useEffect } from 'react';
import { Users, Receipt, Plus, X, Check, RefreshCw } from 'lucide-react';

interface ExpenseItem {
  id: string;
  name: string;
  price: number;
}

interface Person {
  id: string;
  name: string;
  isSettled: boolean;
}

const ExpenseSplitter: React.FC = () => {
  const [items, setItems] = useState<ExpenseItem[]>(() => {
    const saved = localStorage.getItem('es_items');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [people, setPeople] = useState<Person[]>(() => {
    const saved = localStorage.getItem('es_people');
    return saved ? JSON.parse(saved) : [];
  });

  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newPersonName, setNewPersonName] = useState('');

  useEffect(() => { localStorage.setItem('es_items', JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem('es_people', JSON.stringify(people)); }, [people]);

  const handleReset = () => {
    if (window.confirm("Clear all items and people?")) {
      setItems([]);
      setPeople([]);
      setNewItemName('');
      setNewItemPrice('');
      setNewPersonName('');
    }
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice.trim()) return;
    const price = parseFloat(newItemPrice);
    if (isNaN(price) || price <= 0) return;

    setItems([...items, { id: Math.random().toString(), name: newItemName.trim(), price }]);
    setNewItemName('');
    setNewItemPrice('');
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const addPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;
    setPeople([...people, { id: Math.random().toString(), name: newPersonName.trim(), isSettled: false }]);
    setNewPersonName('');
  };

  const removePerson = (id: string) => {
    setPeople(people.filter(p => p.id !== id));
  };

  const toggleSettled = (id: string) => {
    setPeople(people.map(p => p.id === id ? { ...p, isSettled: !p.isSettled } : p));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.price, 0);
  const splitAmount = people.length > 0 ? totalAmount / people.length : 0;
  
  const settledCount = people.filter(p => p.isSettled).length;
  const collectedAmount = settledCount * splitAmount;
  const progressPercent = totalAmount > 0 ? (collectedAmount / totalAmount) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
            <Users size={24} />
          </div>
          <h2 className="text-2xl font-bold">Expense Splitter</h2>
        </div>
        <button 
          onClick={handleReset}
          className="text-xs flex items-center text-muted hover:text-white transition-colors"
        >
          <RefreshCw size={12} className="mr-1" /> Reset
        </button>
      </div>

      {/* Overview Card */}
      <div className="glass-panel p-6 border-white/10 bg-gradient-to-br from-surface to-surface/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 bg-purple-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
        
        <div className="flex justify-between items-end relative z-10">
          <div>
            <p className="text-sm text-muted mb-1">Grand Total</p>
            <h3 className="text-3xl font-bold text-white">${totalAmount.toFixed(2)}</h3>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted mb-1">Per Person</p>
            <h3 className="text-xl font-bold text-purple-400">${splitAmount.toFixed(2)}</h3>
          </div>
        </div>

        {totalAmount > 0 && people.length > 0 && (
          <div className="mt-6 relative z-10">
            <div className="flex justify-between text-xs text-muted mb-2">
              <span>Collected: ${collectedAmount.toFixed(2)}</span>
              <span>Remaining: ${(totalAmount - collectedAmount).toFixed(2)}</span>
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bill Items Section */}
      <div className="glass-panel p-5 border-white/10">
        <div className="flex items-center space-x-2 mb-4">
          <Receipt className="text-muted" size={18} />
          <h3 className="font-semibold">The Bill</h3>
        </div>

        <form onSubmit={addItem} className="flex space-x-2 mb-4">
          <input 
            type="text" 
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Item (e.g. Dinner)"
            className="input-field flex-1"
          />
          <input 
            type="number" 
            step="0.01"
            min="0"
            value={newItemPrice}
            onChange={(e) => setNewItemPrice(e.target.value)}
            placeholder="$0.00"
            className="input-field w-24 text-center"
          />
          <button type="submit" disabled={!newItemName || !newItemPrice} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors disabled:opacity-50">
            <Plus size={20} />
          </button>
        </form>

        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
          {items.map(item => (
            <div key={item.id} className="flex justify-between items-center bg-white/5 border border-white/5 rounded-lg p-3 group hover:bg-white/10 transition-colors">
              <span className="text-sm font-medium">{item.name}</span>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-muted">${item.price.toFixed(2)}</span>
                <button onClick={() => removeItem(item.id)} className="text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-center text-sm text-muted py-4 border border-dashed border-white/10 rounded-lg">No items added yet</p>
          )}
        </div>
      </div>

      {/* The Squad Section */}
      <div className="glass-panel p-5 border-white/10">
        <div className="flex items-center space-x-2 mb-4">
          <Users className="text-purple-400" size={18} />
          <h3 className="font-semibold">The Squad</h3>
        </div>

        <form onSubmit={addPerson} className="flex space-x-2 mb-4">
          <input 
            type="text" 
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            placeholder="Person's name..."
            className="input-field flex-1"
          />
          <button type="submit" disabled={!newPersonName} className="p-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-xl transition-colors disabled:opacity-50">
            <Plus size={20} />
          </button>
        </form>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
          {people.map(person => (
            <div 
              key={person.id} 
              className={`flex justify-between items-center border rounded-lg p-3 transition-colors ${
                person.isSettled 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-white/5 border-white/5 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => toggleSettled(person.id)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${
                    person.isSettled 
                      ? 'bg-green-500 border-green-500 text-white' 
                      : 'border-white/30 text-transparent hover:border-purple-400'
                  }`}
                >
                  <Check size={14} />
                </button>
                <span className={`text-sm font-medium ${person.isSettled ? 'text-green-400' : 'text-white'}`}>
                  {person.name}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`text-sm ${person.isSettled ? 'text-green-400/70 line-through' : 'text-purple-400 font-bold'}`}>
                  ${splitAmount.toFixed(2)}
                </span>
                <button onClick={() => removePerson(person.id)} className="text-muted hover:text-red-400">
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
          {people.length === 0 && (
            <p className="text-center text-sm text-muted py-4 border border-dashed border-white/10 rounded-lg">Add people sharing the bill</p>
          )}
        </div>
      </div>
      
    </div>
  );
};

export default ExpenseSplitter;
