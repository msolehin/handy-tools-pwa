import React, { useState, useEffect } from 'react';
import { Plus, X, Target, Play, RefreshCw } from 'lucide-react';

interface Option {
  id: string;
  text: string;
}

const colors = [
  '#f43f5e', '#ec4899', '#d946ef', '#8b5cf6', 
  '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', 
  '#14b8a6', '#10b981', '#22c55e', '#84cc16',
  '#eab308', '#f59e0b', '#f97316', '#ef4444'
];

const DecisionMaker: React.FC = () => {
  const defaultQuestion = 'Where should I eat?';
  const defaultOptions = [
    { id: '1', text: 'Pizza' },
    { id: '2', text: 'Burgers' },
    { id: '3', text: 'Sushi' },
    { id: '4', text: 'Salad' },
  ];

  const [question, setQuestion] = useState(() => {
    const saved = localStorage.getItem('dm_question');
    return saved !== null ? saved : defaultQuestion;
  });
  
  const [options, setOptions] = useState<Option[]>(() => {
    const saved = localStorage.getItem('dm_options');
    return saved ? JSON.parse(saved) : defaultOptions;
  });
  
  const [newOption, setNewOption] = useState('');
  
  useEffect(() => {
    localStorage.setItem('dm_question', question);
  }, [question]);

  useEffect(() => {
    localStorage.setItem('dm_options', JSON.stringify(options));
  }, [options]);

  const handleReset = () => {
    if (window.confirm("Reset to default question and options?")) {
      setQuestion(defaultQuestion);
      setOptions(defaultOptions);
      localStorage.removeItem('dm_question');
      localStorage.removeItem('dm_options');
    }
  };
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<Option | null>(null);
  


  const addOption = (e: React.FormEvent) => {
    e.preventDefault();
    if (newOption.trim() && options.length < 24) {
      setOptions([...options, { id: Math.random().toString(), text: newOption.trim() }]);
      setNewOption('');
    }
  };

  const removeOption = (id: string) => {
    if (options.length > 2) {
      setOptions(options.filter(o => o.id !== id));
    } else {
      alert("You need at least 2 options to make a decision!");
    }
  };

  const spin = () => {
    if (isSpinning || options.length < 2) return;
    
    setIsSpinning(true);
    setWinner(null);
    
    // Calculate new rotation
    const spins = 5 + Math.random() * 5; // 5 to 10 full spins
    const extraDegrees = Math.floor(Math.random() * 360);
    const totalRotation = rotation + (spins * 360) + extraDegrees;
    
    setRotation(totalRotation);

    // Calculate winner
    // The top position is at 0 degrees relative to the container.
    // As the wheel rotates clockwise by X degrees, the slice at the top is shifted back by X.
    // Therefore, the effective angle at the top is (360 - (totalRotation % 360)) % 360
    const sliceSize = 360 / options.length;
    const normalizedRotation = totalRotation % 360;
    const topAngle = (360 - normalizedRotation) % 360;
    
    // Find which slice contains the topAngle
    const winnerIndex = Math.floor(topAngle / sliceSize);
    
    setTimeout(() => {
      setIsSpinning(false);
      setWinner(options[winnerIndex]);
    }, 4000); // matches CSS transition duration
  };

  const getGradientStops = () => {
    const sliceSize = 360 / options.length;
    return options.map((_, i) => {
      const color = colors[i % colors.length];
      return `${color} ${i * sliceSize}deg ${(i + 1) * sliceSize}deg`;
    }).join(', ');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="text-center space-y-2">
        <input 
          type="text" 
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What do you want to decide?"
          className="text-2xl font-bold bg-transparent text-center border-b border-transparent hover:border-white/20 focus:border-primary focus:outline-none transition-colors w-full px-2 py-1"
        />
      </div>

      <div className="relative flex justify-center py-8">
        {/* Pointer */}
        <div className="absolute top-4 z-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          <Target className="text-white fill-primary" size={36} />
        </div>
        
        {/* Wheel */}
        <div 
          className="relative w-72 h-72 rounded-full border-4 border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden"
        >
          <div 
            className="absolute inset-0 w-full h-full transition-transform ease-[cubic-bezier(0.15,0.85,0.15,1)]"
            style={{ 
              background: `conic-gradient(${getGradientStops()})`,
              transform: `rotate(${rotation}deg)`,
              transitionDuration: isSpinning ? '4s' : '0s'
            }}
          >
            {options.map((opt, i) => {
              const sliceSize = 360 / options.length;
              const angle = (i * sliceSize) + (sliceSize / 2);
              return (
                <div 
                  key={opt.id} 
                  className="absolute top-1/2 left-1/2 w-[50%] h-[30px] -mt-[15px] origin-left flex items-center justify-end pr-6"
                  style={{ transform: `rotate(${angle - 90}deg)` }}
                >
                  <span className="text-white font-bold text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] truncate max-w-full">
                    {opt.text}
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Center Hub */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 bg-surface rounded-full border-4 border-white/10 shadow-inner flex items-center justify-center">
              <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center -mt-4 mb-8">
        <button 
          onClick={spin}
          disabled={isSpinning || options.length < 2}
          className={`btn-primary w-48 h-14 text-xl flex items-center justify-center space-x-2 ${isSpinning ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
        >
          <Play fill="currentColor" size={24} />
          <span>{isSpinning ? 'Spinning...' : 'SPIN!'}</span>
        </button>
      </div>

      <div className="glass-panel p-4 space-y-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Options ({options.length}/24)</h3>
          <button 
            onClick={handleReset}
            disabled={isSpinning}
            className="text-xs flex items-center text-muted hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className="mr-1" /> Reset
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
          {options.map((opt, index) => (
            <div key={opt.id} className="bg-white/5 border border-white/10 rounded-lg p-2 flex justify-between items-center group transition-colors hover:bg-white/10">
              <span className="text-sm truncate mr-2 flex-1 flex items-center">
                <span className="w-3 h-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: colors[index % colors.length] }} />
                {opt.text}
              </span>
              <button 
                onClick={() => removeOption(opt.id)}
                disabled={isSpinning}
                className="text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        
        <form onSubmit={addOption} className="flex space-x-2 pt-2 border-t border-white/10">
          <input 
            type="text" 
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            disabled={isSpinning || options.length >= 24}
            placeholder={options.length >= 24 ? "Max 24 options" : "Add new option..."}
            className="input-field flex-1"
          />
          <button 
            type="submit" 
            disabled={!newOption.trim() || isSpinning || options.length >= 24}
            className="btn-secondary px-4 disabled:opacity-50"
          >
            <Plus size={20} />
          </button>
        </form>
      </div>

      {winner && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm" onClick={() => setWinner(null)}>
          <div className="bg-surface border border-white/20 p-8 rounded-2xl w-full max-w-sm text-center shadow-2xl transform transition-all scale-100 animate-bounce-short" onClick={e => e.stopPropagation()}>
            <p className="text-muted text-sm uppercase tracking-wider mb-2">The Wheel has spoken!</p>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-6">
              {winner.text}
            </h2>
            <button 
              onClick={() => setWinner(null)}
              className="btn-primary w-full py-3"
            >
              Awesome!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DecisionMaker;
