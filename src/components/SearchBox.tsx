import { Search, X } from 'lucide-react';
import { t as trs } from '../lib/lang';

// Module level, not defined inside a page: a component re-created every render remounts its
// input, and the field would lose focus on each keystroke.
export const SearchBox = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative">
    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="input-field w-full text-sm py-2 pl-9 pr-9"
    />
    {value && (
      <button onClick={() => onChange('')} aria-label={trs('Kosongkan carian', 'Clear search')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-text">
        <X size={14} />
      </button>
    )}
  </div>
);

export default SearchBox;
