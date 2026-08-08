import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface CategoryChipsProps {
  cats: string[];
  value: string;
  onSelect: (cat: string) => void;
  onAdd: (cat: string) => void;
  onRemove?: (cat: string) => void;
  accent?: string;
}

const CategoryChips: React.FC<CategoryChipsProps> = ({ cats, value, onSelect, onAdd, onRemove, accent = 'rgb(59 130 246)' }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newVal, setNewVal] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newVal.trim()) {
      onAdd(newVal.trim());
      setNewVal('');
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {cats.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onSelect(c)}
          className={`pl-3 ${value === c && onRemove ? 'pr-1.5' : 'pr-3'} py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
            value === c 
              ? 'text-white' 
              : 'bg-text/5 text-muted hover:bg-text/10 hover:text-text'
          }`}
          style={value === c ? { backgroundColor: accent } : {}}
        >
          {c}
          {value === c && onRemove && (
            <span 
              onClick={(e) => { e.stopPropagation(); onRemove(c); }}
              className="p-1 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-colors"
              title="Padam Kategori"
            >
              <X size={12} />
            </span>
          )}
        </button>
      ))}
      
      {isAdding ? (
        <form onSubmit={handleAdd} className="flex items-center gap-1 bg-text/5 rounded-full pl-3 pr-1 py-0.5">
          <input 
            autoFocus
            type="text" 
            value={newVal}
            onChange={e => setNewVal(e.target.value)}
            placeholder="Baru..."
            className="bg-transparent border-none outline-none text-xs w-20 text-text placeholder:text-muted"
          />
          <button type="submit" className="p-1 text-emerald-400 hover:text-emerald-300 rounded-full"><Plus size={14} /></button>
          <button type="button" onClick={() => setIsAdding(false)} className="p-1 text-muted hover:text-rose-400 rounded-full"><X size={14} /></button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="px-3 py-1.5 rounded-full text-xs font-bold bg-text/5 text-muted hover:bg-text/10 hover:text-text border border-dashed border-text/20 flex items-center gap-1"
        >
          <Plus size={12} /> Tambah
        </button>
      )}
    </div>
  );
};

export default CategoryChips;
