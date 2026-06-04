import React, { useState, useEffect, useRef } from 'react';
import { Coins, Hash, Dices } from 'lucide-react';

const CoinFlip = () => {
  const [isFlipping, setIsFlipping] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<'Heads' | 'Tails' | null>(null);

  const flipCoin = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    
    // Determine random result: 0 = Heads, 1 = Tails
    const isTails = Math.random() > 0.5;
    
    // Base rotation is current rotation
    // Add 1800 degrees (5 full spins) plus extra 180 if we need to flip to the other side
    // We must calculate the target absolute rotation
    const currentRot = rotation;
    const isCurrentlyTails = (currentRot % 360) === 180;
    
    let nextRot = currentRot + 1800; // 5 spins
    
    if (isTails && !isCurrentlyTails) {
      nextRot += 180;
    } else if (!isTails && isCurrentlyTails) {
      nextRot += 180;
    }
    
    setRotation(nextRot);
    
    setTimeout(() => {
      setResult(isTails ? 'Tails' : 'Heads');
      setIsFlipping(false);
    }, 1500); // matches CSS transition duration
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-12 py-10">
      <div 
        className="relative w-40 h-40 cursor-pointer perspective-[1000px]"
        onClick={flipCoin}
      >
        <div 
          className="w-full h-full rounded-full absolute shadow-2xl transition-transform duration-[1500ms]"
          style={{ 
            transformStyle: 'preserve-3d',
            transform: `rotateY(${rotation}deg)`,
            transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.1)'
          }}
        >
          {/* Heads Side */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-full flex flex-col items-center justify-center border-4 border-yellow-200 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)] backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="w-32 h-32 rounded-full border-2 border-yellow-500/50 flex items-center justify-center">
              <span className="text-4xl font-bold text-yellow-100 drop-shadow-md">H</span>
            </div>
          </div>
          
          {/* Tails Side */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex flex-col items-center justify-center border-4 border-gray-200 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)] backface-hidden"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="w-32 h-32 rounded-full border-2 border-gray-400/50 flex items-center justify-center">
              <span className="text-4xl font-bold text-white drop-shadow-md">T</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="text-center h-12">
        {result && !isFlipping && (
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 animate-fade-in drop-shadow-lg">
            {result}!
          </h2>
        )}
        {isFlipping && (
          <h2 className="text-xl font-bold text-muted animate-pulse">Flipping...</h2>
        )}
      </div>
      
      <button 
        onClick={flipCoin}
        disabled={isFlipping}
        className="btn-primary w-full py-4 text-lg"
      >
        Flip Coin
      </button>
    </div>
  );
};

const RandomNumber = () => {
  const [min, setMin] = useState('1');
  const [max, setMax] = useState('100');
  const [result, setResult] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [displayNum, setDisplayNum] = useState<number | null>(null);

  const generate = () => {
    if (isGenerating) return;
    
    const minNum = parseInt(min);
    const maxNum = parseInt(max);
    
    if (isNaN(minNum) || isNaN(maxNum) || minNum >= maxNum) {
      alert('Please enter a valid range where Min is less than Max.');
      return;
    }
    
    setIsGenerating(true);
    setResult(null);
    
    const finalResult = Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
    
    // Slot machine fast counter effect
    let iterations = 0;
    const maxIterations = 20;
    
    const interval = setInterval(() => {
      setDisplayNum(Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum);
      iterations++;
      
      if (iterations >= maxIterations) {
        clearInterval(interval);
        setDisplayNum(finalResult);
        setResult(finalResult);
        setIsGenerating(false);
      }
    }, 50);
  };

  return (
    <div className="space-y-8 py-4">
      <div className="flex space-x-4">
        <div className="flex-1 space-y-2">
          <label className="text-xs font-bold text-blue-400 uppercase tracking-wider">Min</label>
          <input 
            type="number" 
            value={min} 
            onChange={(e) => setMin(e.target.value)}
            className="input-field w-full text-center text-xl font-mono"
          />
        </div>
        <div className="flex-1 space-y-2">
          <label className="text-xs font-bold text-blue-400 uppercase tracking-wider">Max</label>
          <input 
            type="number" 
            value={max} 
            onChange={(e) => setMax(e.target.value)}
            className="input-field w-full text-center text-xl font-mono"
          />
        </div>
      </div>
      
      <div className="glass-panel h-40 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-500/5 mix-blend-overlay"></div>
        {displayNum !== null ? (
          <div className={`text-6xl font-black font-mono tracking-tighter ${result !== null ? 'text-blue-400 scale-110 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]' : 'text-white/50 blur-[1px]'} transition-all duration-200`}>
            {displayNum}
          </div>
        ) : (
          <div className="text-muted/50 text-xl font-medium">Ready</div>
        )}
      </div>
      
      <button 
        onClick={generate}
        disabled={isGenerating}
        className="btn-primary bg-blue-500 hover:bg-blue-600 border-blue-400/50 shadow-[0_0_20px_rgba(59,130,246,0.3)] w-full py-4 text-lg"
      >
        Generate Number
      </button>
    </div>
  );
};

const DiceFace = ({ value, isRolling }: { value: number, isRolling: boolean }) => {
  // SVG points for 3x3 grid
  const dots = [];
  if ([1, 3, 5].includes(value)) dots.push('middle'); // Center
  if ([2, 3, 4, 5, 6].includes(value)) {
    dots.push('top-left');
    dots.push('bottom-right');
  }
  if ([4, 5, 6].includes(value)) {
    dots.push('top-right');
    dots.push('bottom-left');
  }
  if (value === 6) {
    dots.push('middle-left');
    dots.push('middle-right');
  }

  const getPosition = (pos: string) => {
    switch (pos) {
      case 'top-left': return 'top-2 left-2';
      case 'top-right': return 'top-2 right-2';
      case 'middle-left': return 'top-1/2 -translate-y-1/2 left-2';
      case 'middle': return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
      case 'middle-right': return 'top-1/2 -translate-y-1/2 right-2';
      case 'bottom-left': return 'bottom-2 left-2';
      case 'bottom-right': return 'bottom-2 right-2';
      default: return '';
    }
  };

  return (
    <div className={`w-20 h-20 bg-white rounded-xl shadow-[inset_0_-4px_0_rgba(0,0,0,0.2),_0_8px_15px_rgba(0,0,0,0.2)] relative ${isRolling ? 'animate-shake' : ''}`}>
      {dots.map((pos, i) => (
        <div key={i} className={`absolute w-4 h-4 bg-gray-800 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] ${getPosition(pos)}`} />
      ))}
    </div>
  );
};

const DiceRoller = () => {
  const [diceCount, setDiceCount] = useState(2);
  const [diceValues, setDiceValues] = useState<number[]>([1, 1]);
  const [isRolling, setIsRolling] = useState(false);

  // Initialize dice when count changes
  useEffect(() => {
    setDiceValues(Array(diceCount).fill(1).map(() => Math.floor(Math.random() * 6) + 1));
  }, [diceCount]);

  const roll = () => {
    if (isRolling) return;
    setIsRolling(true);
    
    let rolls = 0;
    const maxRolls = 15;
    
    const interval = setInterval(() => {
      setDiceValues(Array(diceCount).fill(0).map(() => Math.floor(Math.random() * 6) + 1));
      rolls++;
      
      if (rolls >= maxRolls) {
        clearInterval(interval);
        setIsRolling(false);
      }
    }, 60);
  };

  const total = diceValues.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8 py-4 flex flex-col items-center">
      <div className="flex space-x-2 bg-surface p-1 rounded-xl border border-white/10 w-full justify-center">
        {[1, 2, 3, 4, 5, 6].map(num => (
          <button
            key={num}
            onClick={() => setDiceCount(num)}
            className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${
              diceCount === num 
                ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' 
                : 'text-muted hover:bg-white/5'
            }`}
          >
            {num}
          </button>
        ))}
      </div>
      
      <div className="glass-panel w-full min-h-[200px] p-6 flex flex-wrap gap-6 items-center justify-center perspective-[500px]">
        {diceValues.map((val, i) => (
          <div key={i} style={{ animationDelay: `${i * 0.05}s` }}>
            <DiceFace value={val} isRolling={isRolling} />
          </div>
        ))}
      </div>
      
      <div className="text-center h-8">
        {!isRolling && (
          <p className="text-xl font-bold text-purple-400 animate-fade-in">Total: {total}</p>
        )}
      </div>

      <button 
        onClick={roll}
        disabled={isRolling}
        className="btn-primary bg-purple-500 hover:bg-purple-600 border-purple-400/50 shadow-[0_0_20px_rgba(168,85,247,0.3)] w-full py-4 text-lg"
      >
        Roll Dice
      </button>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0% { transform: translate(1px, 1px) rotate(0deg) scale(1); }
          10% { transform: translate(-1px, -2px) rotate(-10deg) scale(1.1); }
          20% { transform: translate(-3px, 0px) rotate(10deg) scale(0.9); }
          30% { transform: translate(3px, 2px) rotate(0deg) scale(1.05); }
          40% { transform: translate(1px, -1px) rotate(10deg) scale(0.95); }
          50% { transform: translate(-1px, 2px) rotate(-10deg) scale(1); }
          60% { transform: translate(-3px, 1px) rotate(0deg) scale(1.1); }
          70% { transform: translate(3px, 1px) rotate(-10deg) scale(0.9); }
          80% { transform: translate(-1px, -1px) rotate(10deg) scale(1.05); }
          90% { transform: translate(1px, 2px) rotate(0deg) scale(0.95); }
          100% { transform: translate(1px, -2px) rotate(-10deg) scale(1); }
        }
        .animate-shake {
          animation: shake 0.3s infinite;
        }
      `}} />
    </div>
  );
};

type TabType = 'coin' | 'number' | 'dice';

const Randomizer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('coin');

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 mb-2">
          <Dices size={32} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white/90">Randomizer</h1>
        <p className="text-sm text-muted">Coin, Dice, and Numbers</p>
      </div>

      <div className="glass-panel p-1 flex relative">
        <div 
          className="absolute inset-y-1 bg-white/10 rounded-xl transition-all duration-300 shadow-[inset_0_0_10px_rgba(255,255,255,0.05)] border border-white/10"
          style={{
            width: 'calc(33.333% - 4px)',
            left: activeTab === 'coin' ? '4px' : activeTab === 'number' ? 'calc(33.333% + 2px)' : 'calc(66.666%)',
          }}
        />
        
        <button 
          onClick={() => setActiveTab('coin')}
          className={`flex-1 flex items-center justify-center py-2.5 z-10 font-medium text-sm transition-colors ${activeTab === 'coin' ? 'text-white' : 'text-muted hover:text-white/80'}`}
        >
          <Coins size={16} className="mr-2" /> Coin
        </button>
        <button 
          onClick={() => setActiveTab('number')}
          className={`flex-1 flex items-center justify-center py-2.5 z-10 font-medium text-sm transition-colors ${activeTab === 'number' ? 'text-white' : 'text-muted hover:text-white/80'}`}
        >
          <Hash size={16} className="mr-2" /> Number
        </button>
        <button 
          onClick={() => setActiveTab('dice')}
          className={`flex-1 flex items-center justify-center py-2.5 z-10 font-medium text-sm transition-colors ${activeTab === 'dice' ? 'text-white' : 'text-muted hover:text-white/80'}`}
        >
          <Dices size={16} className="mr-2" /> Dice
        </button>
      </div>

      <div className="px-2">
        {activeTab === 'coin' && <CoinFlip />}
        {activeTab === 'number' && <RandomNumber />}
        {activeTab === 'dice' && <DiceRoller />}
      </div>
    </div>
  );
};

export default Randomizer;
