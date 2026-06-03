import React, { useState, useEffect } from 'react';
import { Plus, X, Target, Play, RefreshCw, Trophy, Swords } from 'lucide-react';

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
  
  // Game States
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<Option | null>(null);
  
  // Multi-Spin (Best of X) States
  const [isMultiSpin, setIsMultiSpin] = useState(() => {
    return localStorage.getItem('dm_isMultiSpin') === 'true';
  });
  const [totalSpins, setTotalSpins] = useState(() => {
    const saved = localStorage.getItem('dm_totalSpins');
    return saved ? parseInt(saved, 10) : 3;
  });
  const [spinResults, setSpinResults] = useState<string[]>([]);
  const [tiedOptions, setTiedOptions] = useState<string[] | null>(null);
  const [intermediateWinner, setIntermediateWinner] = useState<Option | null>(null);
  const [isTieAnnounced, setIsTieAnnounced] = useState(false);

  useEffect(() => {
    localStorage.setItem('dm_question', question);
  }, [question]);

  useEffect(() => {
    localStorage.setItem('dm_options', JSON.stringify(options));
  }, [options]);

  useEffect(() => {
    localStorage.setItem('dm_isMultiSpin', isMultiSpin.toString());
  }, [isMultiSpin]);

  useEffect(() => {
    localStorage.setItem('dm_totalSpins', totalSpins.toString());
  }, [totalSpins]);

  const resetGame = () => {
    setSpinResults([]);
    setTiedOptions(null);
    setWinner(null);
    setIntermediateWinner(null);
    setIsTieAnnounced(false);
  };

  const handleResetOptions = () => {
    if (window.confirm("Reset to default question and options?")) {
      setQuestion(defaultQuestion);
      setOptions(defaultOptions);
      resetGame();
      localStorage.removeItem('dm_question');
      localStorage.removeItem('dm_options');
    }
  };

  const addOption = (e: React.FormEvent) => {
    e.preventDefault();
    if (newOption.trim() && options.length < 24) {
      setOptions([...options, { id: Math.random().toString(), text: newOption.trim() }]);
      setNewOption('');
      resetGame();
    }
  };

  const removeOption = (id: string) => {
    if (options.length > 2) {
      setOptions(options.filter(o => o.id !== id));
      resetGame();
    } else {
      alert("You need at least 2 options to make a decision!");
    }
  };

  // Determine which options to show on the wheel
  const activeOptions = tiedOptions 
    ? options.filter(o => tiedOptions.includes(o.id)) 
    : options;

  const spin = () => {
    if (isSpinning || activeOptions.length < 2) return;
    
    setIsSpinning(true);
    setWinner(null);
    setIntermediateWinner(null);
    setIsTieAnnounced(false);
    
    const spins = 5 + Math.random() * 5;
    const extraDegrees = Math.floor(Math.random() * 360);
    const totalRotation = rotation + (spins * 360) + extraDegrees;
    
    setRotation(totalRotation);

    const sliceSize = 360 / activeOptions.length;
    const normalizedRotation = totalRotation % 360;
    const topAngle = (360 - normalizedRotation) % 360;
    
    const winnerIndex = Math.floor(topAngle / sliceSize);
    const currentWinner = activeOptions[winnerIndex];
    
    setTimeout(() => {
      setIsSpinning(false);
      
      if (!isMultiSpin) {
        setWinner(currentWinner);
        return;
      }
      
      const newResults = [...spinResults, currentWinner.id];
      setSpinResults(newResults);
      
      if (tiedOptions) {
        // Sudden death tiebreaker over! First to win breaks the tie.
        setWinner(currentWinner);
        return;
      }

      if (newResults.length < totalSpins) {
        setIntermediateWinner(currentWinner);
      } else {
        // End of regular multi-spin round
        const counts: Record<string, number> = {};
        newResults.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
        
        let maxWins = 0;
        let winners: string[] = [];
        
        Object.entries(counts).forEach(([id, count]) => {
          if (count > maxWins) {
            maxWins = count;
            winners = [id];
          } else if (count === maxWins) {
            winners.push(id);
          }
        });
        
        if (winners.length === 1) {
          setWinner(options.find(o => o.id === winners[0]) || null);
        } else {
          setTiedOptions(winners);
          setIsTieAnnounced(true);
        }
      }
    }, 4000);
  };

  const getGradientStops = () => {
    const sliceSize = 360 / activeOptions.length;
    return activeOptions.map((_, i) => {
      // Find original index to keep color consistent if possible
      const originalIndex = options.findIndex(o => o.id === activeOptions[i].id);
      const colorIndex = originalIndex >= 0 ? originalIndex : i;
      const color = colors[colorIndex % colors.length];
      return `${color} ${i * sliceSize}deg ${(i + 1) * sliceSize}deg`;
    }).join(', ');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="text-center space-y-2">
        <input 
          type="text" 
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            resetGame();
          }}
          placeholder="What do you want to decide?"
          className="text-2xl font-bold bg-transparent text-center border-b border-transparent hover:border-white/20 focus:border-primary focus:outline-none transition-colors w-full px-2 py-1"
        />
      </div>

      <div className="relative flex justify-center py-8">
        <div className="absolute top-4 z-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          <Target className="text-white fill-primary" size={36} />
        </div>
        
        <div className={`relative w-72 h-72 rounded-full border-4 shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden transition-colors duration-500 ${tiedOptions ? 'border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)]' : 'border-white/20'}`}>
          <div 
            className="absolute inset-0 w-full h-full transition-transform ease-[cubic-bezier(0.15,0.85,0.15,1)]"
            style={{ 
              background: `conic-gradient(${getGradientStops()})`,
              transform: `rotate(${rotation}deg)`,
              transitionDuration: isSpinning ? '4s' : '0s'
            }}
          >
            {activeOptions.map((opt, i) => {
              const sliceSize = 360 / activeOptions.length;
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
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-12 h-12 bg-surface rounded-full border-4 shadow-inner flex items-center justify-center transition-colors ${tiedOptions ? 'border-red-500/50' : 'border-white/10'}`}>
              <div className={`w-3 h-3 rounded-full animate-pulse ${tiedOptions ? 'bg-red-500' : 'bg-primary'}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center -mt-2 mb-2">
        <button 
          onClick={spin}
          disabled={isSpinning || activeOptions.length < 2}
          className={`w-48 h-14 text-xl flex items-center justify-center space-x-2 transition-all ${
            tiedOptions 
              ? 'bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-500/20' 
              : 'btn-primary'
          } ${isSpinning ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
        >
          {tiedOptions && !isSpinning ? <Swords size={24} /> : <Play fill="currentColor" size={24} />}
          <span>
            {isSpinning 
              ? 'Spinning...' 
              : tiedOptions 
                ? 'TIEBREAKER!' 
                : isMultiSpin && spinResults.length > 0 
                  ? `SPIN ${spinResults.length + 1}` 
                  : 'SPIN!'}
          </span>
        </button>
      </div>

      <div className="glass-panel p-4 mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              id="multiSpinToggle"
              checked={isMultiSpin}
              onChange={(e) => {
                setIsMultiSpin(e.target.checked);
                resetGame();
              }}
              disabled={isSpinning}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary focus:ring-offset-background"
            />
            <label htmlFor="multiSpinToggle" className="text-sm font-medium">Best of Mode</label>
          </div>
          {isMultiSpin && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted">Total Spins:</span>
              <input 
                type="number" 
                min="2" max="15"
                value={totalSpins}
                onChange={(e) => {
                  setTotalSpins(parseInt(e.target.value) || 3);
                  resetGame();
                }}
                disabled={isSpinning || spinResults.length > 0}
                className="input-field w-16 py-1 px-2 text-center text-sm disabled:opacity-50"
              />
            </div>
          )}
        </div>

        {isMultiSpin && (
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Scoreboard</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${tiedOptions ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary'}`}>
                {tiedOptions ? 'Sudden Death' : `Round ${Math.min(spinResults.length + 1, totalSpins)} of ${totalSpins}`}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {options.map((opt, i) => {
                const wins = spinResults.filter(id => id === opt.id).length;
                const isTied = tiedOptions?.includes(opt.id);
                return (
                  <div key={opt.id} className={`flex items-center justify-between bg-black/20 px-3 py-2 rounded-lg text-sm border transition-colors ${isTied ? 'border-red-500/30 bg-red-500/10' : 'border-transparent'}`}>
                    <div className="flex items-center space-x-2 overflow-hidden pr-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                      <span className={`truncate ${isTied ? 'font-bold text-white' : 'text-white/80'}`}>{opt.text}</span>
                    </div>
                    <span className={`font-black ${isTied ? 'text-red-400' : 'text-white'}`}>{wins}</span>
                  </div>
                );
              })}
            </div>
            
            {spinResults.length > 0 && !tiedOptions && (
              <div className="mt-3 text-center">
                <button onClick={resetGame} disabled={isSpinning} className="text-xs text-muted hover:text-white transition-colors">
                  Restart Series
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="glass-panel p-4 space-y-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Options ({options.length}/24)</h3>
          <button 
            onClick={handleResetOptions}
            disabled={isSpinning || spinResults.length > 0}
            className="text-xs flex items-center text-muted hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className="mr-1" /> Reset
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
          {options.map((opt, index) => (
            <div key={opt.id} className={`bg-white/5 border border-white/10 rounded-lg p-2 flex justify-between items-center group transition-colors hover:bg-white/10 ${tiedOptions && !tiedOptions.includes(opt.id) ? 'opacity-30' : ''}`}>
              <span className="text-sm truncate mr-2 flex-1 flex items-center">
                <span className="w-3 h-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: colors[index % colors.length] }} />
                {opt.text}
              </span>
              <button 
                onClick={() => removeOption(opt.id)}
                disabled={isSpinning || spinResults.length > 0}
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
            disabled={isSpinning || options.length >= 24 || spinResults.length > 0}
            placeholder={options.length >= 24 ? "Max 24 options" : "Add new option..."}
            className="input-field flex-1"
          />
          <button 
            type="submit" 
            disabled={!newOption.trim() || isSpinning || options.length >= 24 || spinResults.length > 0}
            className="btn-secondary px-4 disabled:opacity-50"
          >
            <Plus size={20} />
          </button>
        </form>
      </div>

      {/* Intermediate Spin Winner Modal */}
      {intermediateWinner && !winner && !isTieAnnounced && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm" onClick={() => setIntermediateWinner(null)}>
          <div className="bg-surface border border-white/20 p-8 rounded-2xl w-full max-w-sm text-center shadow-2xl transform transition-all scale-100 animate-bounce-short" onClick={e => e.stopPropagation()}>
            <p className="text-muted text-sm uppercase tracking-wider mb-2">Round {spinResults.length} Winner</p>
            <h2 className="text-3xl font-bold text-white mb-6">
              {intermediateWinner.text}
            </h2>
            <button 
              onClick={() => setIntermediateWinner(null)}
              className="btn-secondary w-full py-3 text-white bg-white/10 border-white/20 hover:bg-white/20"
            >
              Continue to Next Spin
            </button>
          </div>
        </div>
      )}

      {/* Sudden Death Tie Announced Modal */}
      {isTieAnnounced && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm" onClick={() => setIsTieAnnounced(false)}>
          <div className="bg-surface border-2 border-red-500/50 p-8 rounded-2xl w-full max-w-sm text-center shadow-[0_0_50px_rgba(239,68,68,0.2)] transform transition-all scale-100 animate-bounce-short" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-red-500/20 rounded-full">
                <Swords size={48} className="text-red-400" />
              </div>
            </div>
            <h2 className="text-3xl font-black text-red-400 uppercase tracking-widest mb-2">It's a TIE!</h2>
            <p className="text-white/80 mb-6 leading-relaxed">
              The leaders are tied with equal wins. Entering <strong className="text-red-400">Sudden Death Mode</strong>. First to win the next spin takes it all!
            </p>
            <button 
              onClick={() => setIsTieAnnounced(false)}
              className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-500/20"
            >
              Begin Tiebreaker!
            </button>
          </div>
        </div>
      )}

      {/* Grand Winner Modal */}
      {winner && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm" onClick={resetGame}>
          <div className="bg-surface border border-primary/50 p-8 rounded-2xl w-full max-w-sm text-center shadow-[0_0_50px_rgba(var(--color-primary),0.2)] transform transition-all scale-100 animate-bounce-short" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-primary/20 rounded-full">
                <Trophy size={48} className="text-primary" />
              </div>
            </div>
            <p className="text-primary font-bold text-sm uppercase tracking-wider mb-2">
              {isMultiSpin ? 'Grand Winner!' : 'The Wheel has spoken!'}
            </p>
            <h2 className="text-4xl font-black text-white mb-6 break-words leading-tight">
              {winner.text}
            </h2>
            <button 
              onClick={resetGame}
              className="btn-primary w-full py-3 text-lg"
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
