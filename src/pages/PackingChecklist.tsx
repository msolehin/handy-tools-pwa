import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Trash2, CheckCircle2, Circle, ChevronDown, ChevronRight } from 'lucide-react';

interface PackingItem {
  id: string;
  name: string;
  category: string;
  checked: boolean;
}

const CATEGORIES = [
  'Clothes',
  'Toiletries',
  'Electronics',
  'Documents',
  'Health & Meds',
  'Other'
];

const PackingChecklist: React.FC = () => {
  const [items, setItems] = useState<PackingItem[]>(() => {
    const saved = localStorage.getItem('packing_items');
    return saved ? JSON.parse(saved) : [];
  });

  const [newItemName, setNewItemName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: true }), {})
  );

  useEffect(() => {
    localStorage.setItem('packing_items', JSON.stringify(items));
  }, [items]);

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newItem: PackingItem = {
      id: Math.random().toString(36).substring(7),
      name: newItemName.trim(),
      category: selectedCategory,
      checked: false
    };

    setItems([...items, newItem]);
    setNewItemName('');
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const toggleCheck = (id: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const clearChecked = () => {
    if (window.confirm('Remove all checked items from the checklist?')) {
      setItems(items.filter(item => !item.checked));
    }
  };

  const clearAll = () => {
    if (window.confirm('Remove ALL items and start a new list?')) {
      setItems([]);
    }
  };

  const totalItems = items.length;
  const packedItems = items.filter(i => i.checked).length;
  const progress = totalItems === 0 ? 0 : Math.round((packedItems / totalItems) * 100);

  // Group items by category
  const groupedItems = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = items.filter(item => item.category === cat);
    return acc;
  }, {} as Record<string, PackingItem[]>);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center space-x-3 mb-2">
        <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl">
          <Briefcase size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Packing Checklist</h2>
          <p className="text-sm text-muted">Never forget an item again</p>
        </div>
      </div>

      {/* Progress Card */}
      <div className="glass-panel p-5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
        
        <div className="flex flex-col space-y-4 relative z-10">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm text-muted mb-1">Packing Progress</p>
              <h3 className="text-4xl font-black text-purple-400">
                {progress}%
              </h3>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted mb-1">Items Packed</p>
              <h3 className="text-xl font-bold text-white">
                {packedItems} / {totalItems}
              </h3>
            </div>
          </div>

          <div className="h-3 w-full bg-black/30 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-purple-500 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Add Item Form */}
      <form onSubmit={addItem} className="glass-panel p-4 flex flex-col space-y-3">
        <div className="flex space-x-2">
          <input 
            type="text" 
            required
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Add an item (e.g. Passport)"
            className="input-field flex-1 text-sm py-2"
          />
          <button type="submit" disabled={!newItemName} className="btn-primary px-4 rounded-xl">
            <Plus size={20} />
          </button>
        </div>
        <div className="flex overflow-x-auto space-x-2 pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </form>

      {/* Checklist */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-bold text-muted uppercase tracking-wider">Your Bags</h3>
          {items.length > 0 && (
            <div className="flex space-x-3">
              <button onClick={clearChecked} className="text-xs text-muted hover:text-white transition-colors">
                Clear Packed
              </button>
              <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                Clear All
              </button>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="glass-panel p-8 text-center text-muted">
            <Briefcase size={48} className="mx-auto mb-4 opacity-20" />
            <p>Your packing list is empty.</p>
            <p className="text-sm mt-1">Add some items to start packing!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {CATEGORIES.map(category => {
              const categoryItems = groupedItems[category];
              if (categoryItems.length === 0) return null;

              const isExpanded = expandedCategories[category];
              const categoryPacked = categoryItems.filter(i => i.checked).length;

              return (
                <div key={category} className="glass-panel overflow-hidden">
                  <button 
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      {isExpanded ? <ChevronDown size={18} className="text-muted" /> : <ChevronRight size={18} className="text-muted" />}
                      <span className="font-bold text-sm">{category}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-medium text-muted">
                        {categoryPacked}/{categoryItems.length}
                      </span>
                      {categoryPacked === categoryItems.length && (
                        <CheckCircle2 size={16} className="text-purple-400" />
                      )}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="p-2 space-y-1">
                      {categoryItems.map(item => (
                        <div 
                          key={item.id} 
                          className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                            item.checked ? 'opacity-60 bg-white/5' : 'hover:bg-white/5'
                          }`}
                        >
                          <button 
                            onClick={() => toggleCheck(item.id)}
                            className="flex items-center space-x-3 flex-1 text-left"
                          >
                            <div className={`transition-colors ${item.checked ? 'text-purple-400' : 'text-muted'}`}>
                              {item.checked ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                            </div>
                            <span className={`text-sm ${item.checked ? 'line-through text-white/50' : 'text-white'}`}>
                              {item.name}
                            </span>
                          </button>
                          
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="text-muted hover:text-red-400 transition-colors p-2"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PackingChecklist;
