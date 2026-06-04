import React, { useState, useEffect } from 'react';
import { ListChecks, Plus, Trash2, CheckSquare, Square, Copy, ArrowLeft, RefreshCw, Calendar as CalendarIcon, Save } from 'lucide-react';

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface Checklist {
  id: string;
  title: string;
  icon: string;
  items: ChecklistItem[];
  dueDate?: string;
  isTemplate?: boolean;
}

const TEMPLATES: Checklist[] = [
  {
    id: 't-hiking',
    title: 'Hiking Trip',
    icon: '🏕',
    isTemplate: true,
    items: [
      { id: '1', text: 'Water Bottle (2L)', checked: false },
      { id: '2', text: 'Snacks / Energy Bars', checked: false },
      { id: '3', text: 'Power Bank', checked: false },
      { id: '4', text: 'Rain Jacket', checked: false },
      { id: '5', text: 'First Aid Kit', checked: false },
      { id: '6', text: 'Headlamp', checked: false },
      { id: '7', text: 'Hiking Shoes', checked: false },
      { id: '8', text: 'Extra Clothes', checked: false },
    ]
  },
  {
    id: 't-travel',
    title: 'Travel',
    icon: '✈️',
    isTemplate: true,
    items: [
      { id: '1', text: 'Passport / ID', checked: false },
      { id: '2', text: 'Flight Tickets', checked: false },
      { id: '3', text: 'Wallet & Cash', checked: false },
      { id: '4', text: 'Phone Charger', checked: false },
      { id: '5', text: 'Toothbrush & Toiletries', checked: false },
      { id: '6', text: 'Medication', checked: false },
      { id: '7', text: 'SIM Card / Roaming', checked: false },
      { id: '8', text: 'Power Bank', checked: false },
    ]
  },
  {
    id: 't-roadtrip',
    title: 'Road Trip',
    icon: '🚗',
    isTemplate: true,
    items: [
      { id: '1', text: 'Driving License', checked: false },
      { id: '2', text: "Touch 'n Go Card", checked: false },
      { id: '3', text: 'Vehicle Grant / Insurance', checked: false },
      { id: '4', text: 'Power Bank', checked: false },
      { id: '5', text: 'Water', checked: false },
      { id: '6', text: 'Snacks', checked: false },
      { id: '7', text: 'Phone Charger & Mount', checked: false },
      { id: '8', text: 'Fuel Full Tank', checked: false },
    ]
  },
  {
    id: 't-race',
    title: 'Running Race Day',
    icon: '🏃',
    isTemplate: true,
    items: [
      { id: '1', text: 'Running Shoes', checked: false },
      { id: '2', text: 'Running Socks', checked: false },
      { id: '3', text: 'Race Bib & Pins', checked: false },
      { id: '4', text: 'Energy Gels', checked: false },
      { id: '5', text: 'GPS Watch (Charged)', checked: false },
      { id: '6', text: 'Water Bottle', checked: false },
      { id: '7', text: 'Change of Clothes', checked: false },
      { id: '8', text: 'Towel', checked: false },
    ]
  },
  {
    id: 't-grocery',
    title: 'Grocery Shopping',
    icon: '🛒',
    isTemplate: true,
    items: [
      { id: '1', text: 'Milk & Dairy', checked: false },
      { id: '2', text: 'Eggs', checked: false },
      { id: '3', text: 'Bread', checked: false },
      { id: '4', text: 'Vegetables', checked: false },
      { id: '5', text: 'Fruits', checked: false },
      { id: '6', text: 'Chicken / Meat', checked: false },
      { id: '7', text: 'Rice / Pasta', checked: false },
      { id: '8', text: 'Snacks', checked: false },
    ]
  },
  {
    id: 't-job',
    title: 'Job Interview',
    icon: '💼',
    isTemplate: true,
    items: [
      { id: '1', text: 'Printed Resume', checked: false },
      { id: '2', text: 'Notebook & Pen', checked: false },
      { id: '3', text: 'Portfolio / Past Work', checked: false },
      { id: '4', text: 'Breath Mints', checked: false },
      { id: '5', text: 'Formal Clothes Ironed', checked: false },
      { id: '6', text: 'Research Company', checked: false },
      { id: '7', text: 'Prepare Questions to Ask', checked: false },
      { id: '8', text: 'Check Traffic/Route', checked: false },
    ]
  },
];

const STORAGE_KEY = 'my_checklists_data';

const ChecklistTemplate: React.FC = () => {
  const [myChecklists, setMyChecklists] = useState<Checklist[]>([]);
  const [view, setView] = useState<'gallery' | 'mine' | 'editor'>('mine');
  const [activeChecklist, setActiveChecklist] = useState<Checklist | null>(null);
  const [newItemText, setNewItemText] = useState('');

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMyChecklists(parsed);
      } catch (e) {}
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    if (myChecklists.length > 0 || localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(myChecklists));
    }
  }, [myChecklists]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const useTemplate = (template: Checklist) => {
    const newChecklist: Checklist = {
      ...template,
      id: generateId(),
      isTemplate: false,
      items: template.items.map(item => ({ ...item, id: generateId(), checked: false }))
    };
    setActiveChecklist(newChecklist);
    setView('editor');
  };

  const saveActiveChecklist = () => {
    if (!activeChecklist) return;
    
    setMyChecklists(prev => {
      const exists = prev.find(c => c.id === activeChecklist.id);
      if (exists) {
        return prev.map(c => c.id === activeChecklist.id ? activeChecklist : c);
      } else {
        return [activeChecklist, ...prev];
      }
    });
    setView('mine');
    setActiveChecklist(null);
  };

  const duplicateChecklist = (checklist: Checklist) => {
    const newChecklist: Checklist = {
      ...checklist,
      id: generateId(),
      title: `${checklist.title} (Copy)`,
      items: checklist.items.map(item => ({ ...item, id: generateId(), checked: false }))
    };
    setMyChecklists(prev => [newChecklist, ...prev]);
  };

  const deleteChecklist = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMyChecklists(prev => prev.filter(c => c.id !== id));
  };

  const resetActiveChecklist = () => {
    if (!activeChecklist) return;
    setActiveChecklist(prev => prev ? {
      ...prev,
      items: prev.items.map(i => ({ ...i, checked: false }))
    } : null);
  };

  const toggleItem = (itemId: string) => {
    if (!activeChecklist) return;
    setActiveChecklist(prev => prev ? {
      ...prev,
      items: prev.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i)
    } : null);
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChecklist || !newItemText.trim()) return;
    setActiveChecklist(prev => prev ? {
      ...prev,
      items: [...prev.items, { id: generateId(), text: newItemText.trim(), checked: false }]
    } : null);
    setNewItemText('');
  };

  const getProgress = (checklist: Checklist) => {
    if (!checklist.items || checklist.items.length === 0) return 0;
    const checked = checklist.items.filter(i => i.checked).length;
    return Math.round((checked / checklist.items.length) * 100);
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
      <div className="flex items-center space-x-3 px-2 z-10 relative mb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-500/20 text-violet-400">
          <ListChecks size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white/90">Checklists</h1>
          <p className="text-[10px] text-muted uppercase tracking-wider">Templates & To-Dos</p>
        </div>
      </div>

      {view !== 'editor' && (
        <div className="flex bg-white/5 p-1 rounded-xl mb-6 mx-2">
          <button 
            onClick={() => setView('mine')}
            className={`flex-1 p-2 rounded-lg text-sm font-bold transition-all ${view === 'mine' ? 'bg-violet-500 text-white shadow-lg' : 'text-muted hover:text-white'}`}
          >
            My Checklists
          </button>
          <button 
            onClick={() => setView('gallery')}
            className={`flex-1 p-2 rounded-lg text-sm font-bold transition-all ${view === 'gallery' ? 'bg-violet-500 text-white shadow-lg' : 'text-muted hover:text-white'}`}
          >
            Template Gallery
          </button>
        </div>
      )}

      {/* Editor View */}
      {view === 'editor' && activeChecklist && (
        <div className="animate-slide-up space-y-4">
          <div className="flex items-center justify-between px-2">
            <button onClick={() => setView('mine')} className="p-2 text-muted hover:text-white hover:bg-white/10 rounded-xl flex items-center">
              <ArrowLeft size={20} className="mr-2" /> Back
            </button>
            <div className="flex space-x-2">
              <button onClick={resetActiveChecklist} className="p-2 text-muted hover:text-white hover:bg-white/10 rounded-xl" title="Reset All">
                <RefreshCw size={20} />
              </button>
              <button onClick={saveActiveChecklist} className="p-2 bg-violet-500 text-white rounded-xl shadow-lg hover:bg-violet-600 font-bold flex items-center px-4">
                <Save size={18} className="mr-2" /> Save
              </button>
            </div>
          </div>

          <div className="glass-panel p-6 space-y-6">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <span className="text-3xl">{activeChecklist.icon}</span>
                <input 
                  type="text" 
                  value={activeChecklist.title}
                  onChange={e => setActiveChecklist({...activeChecklist, title: e.target.value})}
                  className="bg-transparent text-xl font-bold text-white w-full border-b border-transparent focus:border-white/20 focus:outline-none pb-1"
                />
              </div>

              <div className="flex items-center bg-black/20 rounded-lg p-3">
                <CalendarIcon size={18} className="text-muted mr-3" />
                <input 
                  type="date"
                  value={activeChecklist.dueDate || ''}
                  onChange={e => setActiveChecklist({...activeChecklist, dueDate: e.target.value})}
                  className="bg-transparent text-sm text-white/80 w-full focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-muted uppercase tracking-wider mb-2">
                <span>Progress</span>
                <span>{activeChecklist.items.filter(i => i.checked).length} / {activeChecklist.items.length} ({getProgress(activeChecklist)}%)</span>
              </div>
              <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-violet-500 transition-all duration-500 rounded-full"
                  style={{ width: `${getProgress(activeChecklist)}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 mt-6">
              {activeChecklist.items.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => toggleItem(item.id)}
                  className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition-all border ${
                    item.checked 
                      ? 'bg-violet-500/10 border-violet-500/30 text-white/60' 
                      : 'bg-white/5 border-white/5 hover:border-white/20 text-white/90'
                  }`}
                >
                  <div className={`shrink-0 ${item.checked ? 'text-violet-400' : 'text-muted'}`}>
                    {item.checked ? <CheckSquare size={20} /> : <Square size={20} />}
                  </div>
                  <span className={`text-sm ${item.checked ? 'line-through' : ''}`}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>

            <form onSubmit={addItem} className="flex space-x-2 pt-4">
              <input 
                type="text" 
                value={newItemText}
                onChange={e => setNewItemText(e.target.value)}
                placeholder="Add new item..."
                className="input-field flex-1"
              />
              <button type="submit" disabled={!newItemText.trim()} className="btn-primary px-4 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed">
                <Plus size={20} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Gallery View */}
      {view === 'gallery' && (
        <div className="animate-fade-in space-y-4">
          {TEMPLATES.map(template => (
            <div key={template.id} className="glass-panel p-4 flex items-center justify-between group hover:border-violet-500/30 transition-all">
              <div className="flex items-center space-x-4">
                <div className="text-3xl bg-white/5 p-3 rounded-xl">{template.icon}</div>
                <div>
                  <h3 className="font-bold text-white/90">{template.title}</h3>
                  <p className="text-xs text-muted">{template.items.length} items</p>
                </div>
              </div>
              <button 
                onClick={() => useTemplate(template)}
                className="btn-primary text-xs py-2 px-4 bg-violet-500 hover:bg-violet-600"
              >
                Use Template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* My Checklists View */}
      {view === 'mine' && (
        <div className="animate-fade-in space-y-4">
          {myChecklists.length === 0 ? (
            <div className="glass-panel p-8 text-center flex flex-col items-center border-dashed border-white/20">
              <ListChecks size={48} className="text-muted mb-4 opacity-50" />
              <h3 className="font-bold text-lg mb-2">No Checklists Yet</h3>
              <p className="text-sm text-muted mb-6">Create your first checklist by duplicating a template from the gallery.</p>
              <button onClick={() => setView('gallery')} className="btn-primary bg-violet-500 hover:bg-violet-600">
                Browse Templates
              </button>
            </div>
          ) : (
            myChecklists.map(checklist => (
              <div key={checklist.id} className="glass-panel p-4 hover:border-violet-500/30 transition-all relative overflow-hidden group">
                <div 
                  className="absolute bottom-0 left-0 h-1 bg-violet-500/50" 
                  style={{ width: `${getProgress(checklist)}%` }} 
                />
                
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setActiveChecklist(checklist); setView('editor'); }}>
                    <div className="text-2xl">{checklist.icon}</div>
                    <div>
                      <h3 className="font-bold text-white/90">{checklist.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-violet-400 font-bold bg-violet-500/10 px-2 py-0.5 rounded-full">
                          {getProgress(checklist)}% Complete
                        </span>
                        {checklist.dueDate && (
                          <span className="text-xs text-muted flex items-center">
                            <CalendarIcon size={10} className="mr-1" /> {new Date(checklist.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => duplicateChecklist(checklist)} className="p-2 text-muted hover:text-white hover:bg-white/10 rounded-lg" title="Duplicate">
                      <Copy size={16} />
                    </button>
                    <button onClick={(e) => deleteChecklist(checklist.id, e)} className="p-2 text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-lg" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ChecklistTemplate;
