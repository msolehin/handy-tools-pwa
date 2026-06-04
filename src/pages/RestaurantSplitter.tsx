import React, { useState, useEffect } from 'react';
import { Users, Receipt, Plus, X, Trash2, Percent, RefreshCw, Calculator } from 'lucide-react';

interface FoodItem {
  id: string;
  name: string;
  price: number;
}

interface Person {
  id: string;
  name: string;
  items: FoodItem[];
}

interface TaxFee {
  id: string;
  name: string;
  rate: number;
  isActive: boolean;
}

const DEFAULT_TAXES: TaxFee[] = [
  { id: 'sc', name: 'Service Charge', rate: 10, isActive: true },
  { id: 'sst', name: 'SST', rate: 6, isActive: true },
];

const RestaurantSplitter: React.FC = () => {
  const [people, setPeople] = useState<Person[]>(() => {
    const saved = localStorage.getItem('rs_people');
    return saved ? JSON.parse(saved) : [];
  });

  const [taxes, setTaxes] = useState<TaxFee[]>(() => {
    const saved = localStorage.getItem('rs_taxes');
    return saved ? JSON.parse(saved) : DEFAULT_TAXES;
  });

  const [newPersonName, setNewPersonName] = useState('');
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxRate, setNewTaxRate] = useState('');

  useEffect(() => { localStorage.setItem('rs_people', JSON.stringify(people)); }, [people]);
  useEffect(() => { localStorage.setItem('rs_taxes', JSON.stringify(taxes)); }, [taxes]);

  const handleReset = () => {
    if (window.confirm("Clear all people and items?")) {
      setPeople([]);
      setNewPersonName('');
    }
  };

  const addPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;
    setPeople([...people, { id: Math.random().toString(), name: newPersonName.trim(), items: [] }]);
    setNewPersonName('');
  };

  const removePerson = (id: string) => {
    setPeople(people.filter(p => p.id !== id));
  };

  const addItemToPerson = (personId: string, itemName: string, itemPrice: number) => {
    setPeople(people.map(p => {
      if (p.id === personId) {
        return {
          ...p,
          items: [...p.items, { id: Math.random().toString(), name: itemName, price: itemPrice }]
        };
      }
      return p;
    }));
  };

  const removeItemFromPerson = (personId: string, itemId: string) => {
    setPeople(people.map(p => {
      if (p.id === personId) {
        return {
          ...p,
          items: p.items.filter(i => i.id !== itemId)
        };
      }
      return p;
    }));
  };

  const toggleTax = (id: string) => {
    setTaxes(taxes.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t));
  };

  const updateTaxRate = (id: string, rate: number) => {
    setTaxes(taxes.map(t => t.id === id ? { ...t, rate } : t));
  };

  const removeTax = (id: string) => {
    setTaxes(taxes.filter(t => t.id !== id));
  };

  const addTax = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaxName.trim() || !newTaxRate) return;
    const rate = parseFloat(newTaxRate);
    if (isNaN(rate)) return;
    
    setTaxes([...taxes, { id: Math.random().toString(), name: newTaxName.trim(), rate, isActive: true }]);
    setNewTaxName('');
    setNewTaxRate('');
  };

  // Calculations
  const subtotal = people.reduce((sum, p) => sum + p.items.reduce((s, i) => s + i.price, 0), 0);
  const totalTaxes = taxes.filter(t => t.isActive).reduce((sum, t) => sum + (subtotal * (t.rate / 100)), 0);
  const grandTotal = subtotal + totalTaxes;

  const getPersonSubtotal = (person: Person) => person.items.reduce((s, i) => s + i.price, 0);
  
  const getPersonProportionalTax = (personSubtotal: number) => {
    if (subtotal === 0) return 0;
    return (personSubtotal / subtotal) * totalTaxes;
  };

  const PersonCard = ({ person }: { person: Person }) => {
    const [itemName, setItemName] = useState('');
    const [itemPrice, setItemPrice] = useState('');

    const handleAddItem = (e: React.FormEvent) => {
      e.preventDefault();
      if (!itemName.trim() || !itemPrice) return;
      const price = parseFloat(itemPrice);
      if (isNaN(price) || price < 0) return;
      
      addItemToPerson(person.id, itemName.trim(), price);
      setItemName('');
      setItemPrice('');
    };

    const pSubtotal = getPersonSubtotal(person);
    const pTax = getPersonProportionalTax(pSubtotal);
    const pTotal = pSubtotal + pTax;

    return (
      <div className="glass-panel p-5 border-text/10 mb-4 animate-fade-in relative">
        <div className="flex items-center justify-between mb-4 border-b border-text/10 pb-3">
          <h3 className="font-bold text-lg text-primary">{person.name}</h3>
          <button onClick={() => removePerson(person.id)} className="text-muted hover:text-red-400 p-1">
            <Trash2 size={18} />
          </button>
        </div>

        <form onSubmit={handleAddItem} className="flex space-x-2 mb-4">
          <input 
            type="text" 
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Food/Drink name"
            className="input-field flex-1 text-sm py-2"
          />
          <input 
            type="number" 
            step="0.01"
            min="0"
            value={itemPrice}
            onChange={(e) => setItemPrice(e.target.value)}
            placeholder="RM0.00"
            className="input-field w-24 text-center text-sm py-2"
          />
          <button type="submit" disabled={!itemName || !itemPrice} className="px-3 bg-text/10 hover:bg-text/20 text-text rounded-xl transition-colors disabled:opacity-50">
            <Plus size={18} />
          </button>
        </form>

        <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
          {person.items.map(item => (
            <div key={item.id} className="flex justify-between items-center bg-text/5 rounded-lg p-2 group hover:bg-text/10 transition-colors">
              <span className="text-sm font-medium pl-1">{item.name}</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted">RM{item.price.toFixed(2)}</span>
                <button onClick={() => removeItemFromPerson(person.id, item.id)} className="text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
          {person.items.length === 0 && (
            <p className="text-center text-xs text-muted py-2">No items added yet</p>
          )}
        </div>

        <div className="bg-surface border border-text/10 rounded-xl p-3 text-sm">
          <div className="flex justify-between text-muted mb-1">
            <span>Subtotal:</span>
            <span>RM{pSubtotal.toFixed(2)}</span>
          </div>
          <div className="space-y-1 mb-2">
            {taxes.filter(t => t.isActive).map(t => {
              const pSpecificTax = pSubtotal * (t.rate / 100);
              return (
                <div key={t.id} className="flex justify-between text-muted/80 text-[13px]">
                  <span>{t.name} ({t.rate}%):</span>
                  <span>RM{pSpecificTax.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between font-bold text-text pt-2 border-t border-text/10">
            <span>Must Pay:</span>
            <span className="text-primary">RM{pTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
            <Receipt size={24} />
          </div>
          <h2 className="text-2xl font-bold">Restaurant Splitter</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleReset}
            className="text-xs flex items-center text-muted hover:text-text transition-colors bg-text/5 p-2 rounded-lg"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Overview Card */}
      <div className="glass-panel p-6 border-text/10 bg-gradient-to-br from-surface to-surface/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 bg-rose-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
        
        <div className="flex justify-between items-end relative z-10">
          <div>
            <p className="text-sm text-muted mb-1">Grand Total</p>
            <h3 className="text-3xl font-bold text-text">RM{grandTotal.toFixed(2)}</h3>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted mb-1 flex items-center justify-end"><Calculator size={12} className="mr-1"/> Subtotal</p>
            <h3 className="text-xl font-bold text-text/80">RM{subtotal.toFixed(2)}</h3>
          </div>
        </div>

        {totalTaxes > 0 && (
          <div className="mt-4 pt-4 border-t border-text/10 relative z-10 flex flex-wrap gap-2 text-xs text-muted">
            <span className="bg-text/5 px-2 py-1 rounded-md">Total Taxes: RM{totalTaxes.toFixed(2)}</span>
            {taxes.filter(t => t.isActive).map(t => (
              <span key={t.id} className="bg-text/5 px-2 py-1 rounded-md">
                {t.name} ({t.rate}%): RM{(subtotal * (t.rate / 100)).toFixed(2)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tax Settings Panel */}
      <div className="glass-panel p-5 border-text/10">
        <h3 className="font-semibold mb-4 flex items-center"><Percent size={18} className="mr-2 text-rose-400" /> Tax & Fees Settings</h3>
        
        <div className="space-y-3 mb-6">
          {taxes.map(tax => (
            <div key={tax.id} className="flex items-center space-x-3">
              <button 
                onClick={() => toggleTax(tax.id)}
                className={`w-10 h-6 rounded-full transition-colors relative flex items-center ${tax.isActive ? 'bg-rose-500' : 'bg-text/20'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-text absolute transition-transform ${tax.isActive ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
              <div className="flex-1">
                <span className={`text-sm ${tax.isActive ? 'text-text' : 'text-muted'}`}>{tax.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="number"
                  step="0.1"
                  min="0"
                  value={tax.rate}
                  onChange={(e) => updateTaxRate(tax.id, parseFloat(e.target.value) || 0)}
                  disabled={!tax.isActive}
                  className="input-field w-16 text-center text-sm py-1 disabled:opacity-50"
                />
                <span className="text-muted text-sm">%</span>
                <button onClick={() => removeTax(tax.id)} className="text-muted hover:text-red-400 p-1">
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={addTax} className="flex space-x-2 border-t border-text/10 pt-4">
          <input 
            type="text" 
            value={newTaxName}
            onChange={(e) => setNewTaxName(e.target.value)}
            placeholder="New Tax Name"
            className="input-field flex-1 text-sm"
          />
          <input 
            type="number" 
            step="0.1"
            min="0"
            value={newTaxRate}
            onChange={(e) => setNewTaxRate(e.target.value)}
            placeholder="Rate %"
            className="input-field w-20 text-center text-sm"
          />
          <button type="submit" disabled={!newTaxName || !newTaxRate} className="px-3 bg-text/10 hover:bg-text/20 text-text rounded-xl transition-colors disabled:opacity-50">
            <Plus size={18} />
          </button>
        </form>
      </div>

      {/* Add Person */}
      <div className="glass-panel p-5 border-text/10">
        <form onSubmit={addPerson} className="flex space-x-2">
          <input 
            type="text" 
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            placeholder="Add a person's name..."
            className="input-field flex-1"
          />
          <button type="submit" disabled={!newPersonName} className="p-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-xl transition-colors disabled:opacity-50 flex items-center">
            <Users size={20} className="mr-1" /> <Plus size={16} />
          </button>
        </form>
      </div>

      {/* People List */}
      <div className="space-y-4">
        {people.map(person => (
          <PersonCard key={person.id} person={person} />
        ))}
        {people.length === 0 && (
          <div className="text-center p-10 border border-dashed border-text/10 rounded-2xl">
            <Users size={32} className="mx-auto text-muted mb-3 opacity-50" />
            <p className="text-muted">Add people above to start splitting the bill.</p>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default RestaurantSplitter;
