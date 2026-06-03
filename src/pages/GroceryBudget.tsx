import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';

interface GroceryItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  checked: boolean;
}

const GroceryBudget: React.FC = () => {
  const [budget, setBudget] = useState<number>(() => {
    const saved = localStorage.getItem('gb_budget');
    return saved ? parseFloat(saved) : 0;
  });

  const [items, setItems] = useState<GroceryItem[]>(() => {
    const saved = localStorage.getItem('gb_items');
    return saved ? JSON.parse(saved) : [];
  });

  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('1');

  useEffect(() => {
    localStorage.setItem('gb_budget', budget.toString());
  }, [budget]);

  useEffect(() => {
    localStorage.setItem('gb_items', JSON.stringify(items));
  }, [items]);

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice) return;

    const newItem: GroceryItem = {
      id: Math.random().toString(36).substring(7),
      name: newItemName.trim(),
      price: parseFloat(newItemPrice) || 0,
      quantity: parseInt(newItemQuantity) || 1,
      checked: false
    };

    setItems([newItem, ...items]);
    setNewItemName('');
    setNewItemPrice('');
    setNewItemQuantity('1');
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const toggleCheck = (id: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const clearChecked = () => {
    if (window.confirm('Remove all checked items from the list?')) {
      setItems(items.filter(item => !item.checked));
    }
  };

  const clearAll = () => {
    if (window.confirm('Remove ALL items and start a new list?')) {
      setItems([]);
    }
  };

  const estimatedTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartTotal = items.reduce((sum, item) => item.checked ? sum + (item.price * item.quantity) : sum, 0);

  const budgetRemaining = budget - estimatedTotal;
  const isOverBudget = budget > 0 && estimatedTotal > budget;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center space-x-3 mb-2">
        <div className="p-3 bg-green-500/20 text-green-400 rounded-xl">
          <ShoppingCart size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Grocery Budget</h2>
          <p className="text-sm text-muted">Track items and running total</p>
        </div>
      </div>

      {/* Budget Summary Card */}
      <div className="glass-panel p-5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
        
        <div className="flex flex-col space-y-4 relative z-10">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm text-muted mb-1">Estimated Total</p>
              <h3 className={`text-4xl font-black ${isOverBudget ? 'text-red-400' : 'text-green-400'}`}>
                RM{estimatedTotal.toFixed(2)}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted mb-1">In Cart</p>
              <h3 className="text-xl font-bold text-white">
                RM{cartTotal.toFixed(2)}
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-3 bg-black/20 p-3 rounded-xl border border-white/5">
            <div className="flex-1">
              <p className="text-xs text-muted mb-1">Budget Limit (Optional)</p>
              <div className="flex items-center text-sm">
                <span className="text-muted mr-1">RM</span>
                <input 
                  type="number" 
                  min="0"
                  value={budget || ''}
                  onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="bg-transparent border-none outline-none text-white w-full font-bold"
                />
              </div>
            </div>
            {budget > 0 && (
              <div className="text-right flex-1 border-l border-white/10 pl-3">
                <p className="text-xs text-muted mb-1">Remaining</p>
                <p className={`text-sm font-bold ${budgetRemaining < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  RM{budgetRemaining.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Item Form */}
      <form onSubmit={addItem} className="glass-panel p-4 flex items-center space-x-2">
        <div className="flex-1 flex flex-col space-y-2">
          <input 
            type="text" 
            required
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Item name (e.g. Milk)"
            className="input-field w-full text-sm py-2"
          />
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">RM</span>
              <input 
                type="number" 
                required
                min="0" step="0.01"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="0.00"
                className="input-field w-full text-sm py-2 pl-8"
              />
            </div>
            <div className="relative w-24">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">Qty</span>
              <input 
                type="number" 
                min="1"
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(e.target.value)}
                className="input-field w-full text-sm py-2 pl-9"
              />
            </div>
          </div>
        </div>
        <button type="submit" disabled={!newItemName || !newItemPrice} className="btn-primary h-full self-stretch px-4 rounded-xl">
          <Plus size={24} />
        </button>
      </form>

      {/* Item List */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-bold text-muted uppercase tracking-wider">Shopping List</h3>
          {items.length > 0 && (
            <div className="flex space-x-3">
              <button onClick={clearChecked} className="text-xs text-muted hover:text-white transition-colors">
                Clear Checked
              </button>
              <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                Clear All
              </button>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="glass-panel p-8 text-center text-muted">
            <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
            <p>Your grocery list is empty.</p>
            <p className="text-sm mt-1">Add items above to start tracking!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div 
                key={item.id} 
                className={`glass-panel p-3 flex items-center transition-all ${item.checked ? 'opacity-60 bg-green-500/5 border-green-500/20' : ''}`}
              >
                <button 
                  onClick={() => toggleCheck(item.id)}
                  className={`mr-3 flex-shrink-0 transition-colors ${item.checked ? 'text-green-400' : 'text-muted hover:text-white'}`}
                >
                  {item.checked ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                </button>
                
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className={`font-medium truncate ${item.checked ? 'line-through text-white/50' : 'text-white'}`}>
                    {item.name}
                  </h4>
                  <p className="text-sm text-green-400 font-bold">
                    RM{item.price.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex items-center bg-black/20 rounded-lg border border-white/5">
                    <button 
                      onClick={() => updateQuantity(item.id, -1)}
                      className="px-2 py-1 text-muted hover:text-white"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, 1)}
                      className="px-2 py-1 text-muted hover:text-white"
                    >
                      +
                    </button>
                  </div>
                  <div className="w-16 text-right font-bold text-sm">
                    RM{(item.price * item.quantity).toFixed(2)}
                  </div>
                  <button 
                    onClick={() => removeItem(item.id)}
                    className="text-muted hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroceryBudget;
