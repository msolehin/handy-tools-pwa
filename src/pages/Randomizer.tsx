import React, { useState, useEffect } from 'react';
import { Coins, Hash, Dices, FlaskConical } from 'lucide-react';

const CoinFlip = () => {
  const [isFlipping, setIsFlipping] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<'Heads' | 'Tails' | null>(null);

  const dragStart = React.useRef<{x: number, y: number} | null>(null);

  const flipCoin = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    
    const isTails = Math.random() > 0.5;
    const currentRot = rotation;
    const isCurrentlyTails = (currentRot % 360) === 180;
    
    let nextRot = currentRot + 1800;
    
    if (isTails && !isCurrentlyTails) {
      nextRot += 180;
    } else if (!isTails && isCurrentlyTails) {
      nextRot += 180;
    }
    
    setRotation(nextRot);
    
    setTimeout(() => {
      setResult(isTails ? 'Tails' : 'Heads');
      setIsFlipping(false);
    }, 1500);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isFlipping) return;
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch(e) {}
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStart.current || isFlipping) return;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch(e) {}
    
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    if (distance > 20 || distance < 5) {
      flipCoin();
    }
    dragStart.current = null;
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-12 py-10 relative z-10">
      <div className="absolute top-0 text-[10px] uppercase tracking-widest text-muted/50 font-bold pointer-events-none mt-2">
        Swipe or click to flip
      </div>
      <div className="relative w-40 h-40 flex items-center justify-center">
        <div 
          className="relative w-40 h-40 touch-none cursor-grab active:cursor-grabbing perspective-[1000px]"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
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
              <span className="text-4xl font-bold text-text drop-shadow-md">T</span>
            </div>
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
          <div className={`text-6xl font-black font-mono tracking-tighter ${result !== null ? 'text-blue-400 scale-110 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]' : 'text-text/50 blur-[1px]'} transition-all duration-200`}>
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

const Dice3D = ({ value, isRolling }: { value: number, isRolling: boolean }) => {
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const isFirstRender = React.useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      let targetX = 0; let targetY = 0;
      switch (value) {
        case 1: targetX = 0; targetY = 0; break;
        case 2: targetX = -90; targetY = 0; break;
        case 3: targetX = 0; targetY = -90; break;
        case 4: targetX = 0; targetY = 90; break;
        case 5: targetX = 90; targetY = 0; break;
        case 6: targetX = 0; targetY = 180; break;
      }
      setRotation({ x: targetX, y: targetY, z: 0 });
      isFirstRender.current = false;
      return;
    }

    if (isRolling) {
      setRotation(prev => ({
        x: prev.x + 1080 + Math.random() * 720,
        y: prev.y + 1080 + Math.random() * 720,
        z: prev.z + 720 + Math.random() * 720,
      }));
    } else {
      let targetX = 0; let targetY = 0;
      switch (value) {
        case 1: targetX = 0; targetY = 0; break;
        case 2: targetX = -90; targetY = 0; break;
        case 3: targetX = 0; targetY = -90; break;
        case 4: targetX = 0; targetY = 90; break;
        case 5: targetX = 90; targetY = 0; break;
        case 6: targetX = 0; targetY = 180; break;
      }
      
      const nearestAngle = (current: number, target: number) => {
        const diff = (target - (current % 360) + 540) % 360 - 180;
        return current + diff;
      };
      
      setRotation(prev => ({
        x: nearestAngle(prev.x, targetX),
        y: nearestAngle(prev.y, targetY),
        z: nearestAngle(prev.z, 0)
      }));
    }
  }, [isRolling, value]);

  const renderDots = (faceValue: number) => {
    const dots = [];
    if ([1, 3, 5].includes(faceValue)) dots.push('middle');
    if ([2, 3, 4, 5, 6].includes(faceValue)) { dots.push('top-left'); dots.push('bottom-right'); }
    if ([4, 5, 6].includes(faceValue)) { dots.push('top-right'); dots.push('bottom-left'); }
    if (faceValue === 6) { dots.push('middle-left'); dots.push('middle-right'); }
    
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
    return dots.map((pos, i) => (
      <div key={i} className={`absolute w-3.5 h-3.5 bg-white rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] ${getPosition(pos)}`} />
    ));
  };
  
  // Z-translation must be half of width/height (16 * 4 = 64px, so 32px)
  const faceBase = "absolute w-full h-full bg-purple-500 border border-purple-400 shadow-[inset_0_0_15px_rgba(0,0,0,0.2)] rounded-xl";

  return (
    <div className={`w-16 h-16 relative ${isRolling ? 'animate-toss' : ''}`} style={{ perspective: '800px' }}>
      <div 
        className="w-full h-full relative"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`,
          transition: isRolling ? 'transform 1.2s cubic-bezier(0.1, 0.7, 0.1, 1)' : 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)'
        }}
      >
        <div className={faceBase} style={{ transform: 'rotateY(0deg) translateZ(32px)' }}>{renderDots(1)}</div>
        <div className={faceBase} style={{ transform: 'rotateY(180deg) translateZ(32px)' }}>{renderDots(6)}</div>
        <div className={faceBase} style={{ transform: 'rotateY(90deg) translateZ(32px)' }}>{renderDots(3)}</div>
        <div className={faceBase} style={{ transform: 'rotateY(-90deg) translateZ(32px)' }}>{renderDots(4)}</div>
        <div className={faceBase} style={{ transform: 'rotateX(90deg) translateZ(32px)' }}>{renderDots(2)}</div>
        <div className={faceBase} style={{ transform: 'rotateX(-90deg) translateZ(32px)' }}>{renderDots(5)}</div>
      </div>
    </div>
  );
};

const DiceRoller = () => {
  const [diceCount, setDiceCount] = useState(2);
  const [diceValues, setDiceValues] = useState<number[]>([1, 1]);
  const [isRolling, setIsRolling] = useState(false);
  const dragStart = React.useRef<{x: number, y: number} | null>(null);

  useEffect(() => {
    setDiceValues(Array(diceCount).fill(1).map(() => Math.floor(Math.random() * 6) + 1));
  }, [diceCount]);

  const roll = () => {
    if (isRolling) return;
    setIsRolling(true);
    
    setTimeout(() => {
      setDiceValues(Array(diceCount).fill(0).map(() => Math.floor(Math.random() * 6) + 1));
      setIsRolling(false);
    }, 1200);
  };
  
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isRolling) return;
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch(e) {}
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStart.current || isRolling) return;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch(e) {}
    
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    if (distance > 20) {
      roll();
    }
    dragStart.current = null;
  };

  const total = diceValues.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8 py-4 flex flex-col items-center overflow-visible">
      <div className="flex space-x-2 bg-surface p-1 rounded-xl border border-text/10 w-full justify-center">
        {[1, 2, 3, 4, 5, 6].map(num => (
          <button
            key={num}
            onClick={() => setDiceCount(num)}
            className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${
              diceCount === num 
                ? 'bg-purple-500 text-text shadow-[0_0_10px_rgba(168,85,247,0.4)]' 
                : 'text-muted hover:bg-text/5'
            }`}
          >
            {num}
          </button>
        ))}
      </div>
      
      <div 
        className="glass-panel w-full min-h-[220px] p-6 flex flex-wrap gap-8 items-center justify-center touch-none cursor-grab active:cursor-grabbing relative z-10"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        style={{ perspective: '1000px' }}
      >
        <div className="absolute top-2 left-0 right-0 text-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-widest text-muted/50 font-bold">Swipe to roll</span>
        </div>
        {diceValues.map((val, i) => (
          <div key={i} style={{ animationDelay: `${i * 0.1}s` }} className="pointer-events-none z-20">
            <Dice3D value={val} isRolling={isRolling} />
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
        @keyframes toss {
          0% { transform: translateY(0) scale(1) rotateZ(0deg); }
          40% { transform: translateY(-80px) scale(1.3) rotateZ(10deg); }
          70% { transform: translateY(10px) scale(0.9) rotateZ(-5deg); }
          85% { transform: translateY(-15px) scale(1.05) rotateZ(2deg); }
          100% { transform: translateY(0) scale(1) rotateZ(0deg); }
        }
        .animate-toss {
          animation: toss 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}} />
    </div>
  );
};

const SpinBottle = () => {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const bottleRef = React.useRef<HTMLDivElement>(null);
  const dragState = React.useRef<{ x: number, y: number, angle: number, time: number } | null>(null);

  const getAngle = (clientX: number, clientY: number) => {
    if (!bottleRef.current) return 0;
    const rect = bottleRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSpinning) return;
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch (err) {}
    
    const angle = getAngle(e.clientX, e.clientY);
    dragState.current = { x: e.clientX, y: e.clientY, angle, time: Date.now() };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current || isSpinning) return;
    
    const currentAngle = getAngle(e.clientX, e.clientY);
    let dAngle = currentAngle - dragState.current.angle;
    if (dAngle > 180) dAngle -= 360;
    if (dAngle < -180) dAngle += 360;
    
    if (bottleRef.current) {
      bottleRef.current.style.transition = 'none';
      bottleRef.current.style.transform = `rotate(${rotation + dAngle}deg)`;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState.current || isSpinning) return;
    
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) {}

    const endAngle = getAngle(e.clientX, e.clientY);
    const endTime = Date.now();
    const dt = endTime - dragState.current.time;
    
    let dAngle = endAngle - dragState.current.angle;
    if (dAngle > 180) dAngle -= 360;
    if (dAngle < -180) dAngle += 360;
    
    const velocity = dt > 0 ? dAngle / dt : 0;
    let baseRotation = rotation + dAngle;
    
    if (Math.abs(velocity) < 0.2 && Math.abs(dAngle) < 20) {
      setRotation(baseRotation);
      if (bottleRef.current) {
        bottleRef.current.style.transition = 'transform 3s cubic-bezier(0.15, 0.9, 0.15, 1)';
        bottleRef.current.style.transform = `rotate(${baseRotation}deg)`;
      }
      dragState.current = null;
      return;
    }
    
    setIsSpinning(true);
    
    if (bottleRef.current) {
      bottleRef.current.style.transition = 'transform 3s cubic-bezier(0.15, 0.9, 0.15, 1)';
    }

    const direction = velocity > 0 ? 1 : -1;
    const speedMultiplier = Math.min(Math.max(Math.abs(velocity) * 2000, 1080), 5400); 
    
    const targetRotation = baseRotation + (speedMultiplier * direction);
    
    setRotation(targetRotation);
    
    setTimeout(() => {
      setIsSpinning(false);
    }, 3000);
    
    dragState.current = null;
  };
  
  useEffect(() => {
    if (bottleRef.current && isSpinning) {
      bottleRef.current.style.transition = 'transform 3s cubic-bezier(0.15, 0.9, 0.15, 1)';
      bottleRef.current.style.transform = `rotate(${rotation}deg)`;
    }
  }, [rotation, isSpinning]);

  const spinManually = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    
    const extraDegrees = 1800 + Math.random() * 1800; // 5 to 10 spins
    const direction = Math.random() > 0.5 ? 1 : -1;
    setRotation(prev => prev + (extraDegrees * direction));
    
    setTimeout(() => {
      setIsSpinning(false);
    }, 3000);
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-12 py-10 relative z-10">
      <div className="absolute top-0 text-[10px] uppercase tracking-widest text-muted/50 font-bold pointer-events-none mt-2">
        Swipe or click to spin
      </div>
      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* Circle track */}
        <div className="absolute inset-0 rounded-full border-4 border-dashed border-text/10" />
        
        {/* Interactive Overlay */}
        <div 
          className="absolute inset-0 z-10 touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />
        
        {/* Bottle */}
        <div 
          ref={bottleRef}
          className="w-14 h-48 relative pointer-events-none"
          style={{ 
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 3s cubic-bezier(0.15, 0.9, 0.15, 1)'
          }}
        >
          {/* Cap */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-6 bg-red-500 rounded-t-md shadow-sm z-10" />
          {/* Neck */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 w-6 h-14 bg-emerald-500/80 backdrop-blur-sm z-0 border-x border-t border-emerald-400/50" />
          {/* Body */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-14 h-32 bg-emerald-600/80 backdrop-blur-sm rounded-b-2xl rounded-t-[40%] shadow-[inset_-5px_-5px_15px_rgba(0,0,0,0.3),inset_5px_5px_15px_rgba(255,255,255,0.4)] border border-emerald-400/50 flex flex-col items-center justify-end pb-6">
             <div className="w-10 h-12 bg-white/20 rounded backdrop-blur-md border border-white/30" />
          </div>
        </div>
      </div>
      
      <div className="text-center h-8">
        {isSpinning ? (
          <h2 className="text-xl font-bold text-muted animate-pulse">Spinning...</h2>
        ) : (
          <h2 className="text-sm font-medium text-muted">Swipe or click to spin</h2>
        )}
      </div>
      
      <button 
        onClick={spinManually}
        disabled={isSpinning}
        className="btn-primary w-full py-4 text-lg"
      >
        Spin Bottle
      </button>
    </div>
  );
};

type TabType = 'coin' | 'number' | 'dice' | 'bottle';

const Randomizer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('coin');

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 mb-2">
          <Dices size={32} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text/90">Randomizer</h1>
        <p className="text-sm text-muted">Coin, Dice, and Numbers</p>
      </div>

      <div className="glass-panel p-1 flex relative">
        <div 
          className="absolute inset-y-1 bg-text/10 rounded-xl transition-all duration-300 shadow-[inset_0_0_10px_rgba(255,255,255,0.05)] border border-text/10"
          style={{
            width: 'calc(25% - 4px)',
            left: activeTab === 'coin' ? '4px' : activeTab === 'number' ? 'calc(25% + 2px)' : activeTab === 'dice' ? 'calc(50%)' : 'calc(75% - 2px)',
          }}
        />
        
        <button 
          onClick={() => setActiveTab('coin')}
          className={`flex-1 flex items-center justify-center py-2.5 z-10 font-medium text-sm transition-colors ${activeTab === 'coin' ? 'text-text' : 'text-muted hover:text-text/80'}`}
        >
          <Coins size={16} className="mr-2" /> Coin
        </button>
        <button 
          onClick={() => setActiveTab('number')}
          className={`flex-1 flex items-center justify-center py-2.5 z-10 font-medium text-sm transition-colors ${activeTab === 'number' ? 'text-text' : 'text-muted hover:text-text/80'}`}
        >
          <Hash size={16} className="mr-2" /> Num
        </button>
        <button 
          onClick={() => setActiveTab('dice')}
          className={`flex-1 flex items-center justify-center py-2.5 z-10 font-medium text-sm transition-colors ${activeTab === 'dice' ? 'text-text' : 'text-muted hover:text-text/80'}`}
        >
          <Dices size={16} className="mr-2" /> Dice
        </button>
        <button 
          onClick={() => setActiveTab('bottle')}
          className={`flex-1 flex items-center justify-center py-2.5 z-10 font-medium text-sm transition-colors ${activeTab === 'bottle' ? 'text-text' : 'text-muted hover:text-text/80'}`}
        >
          <FlaskConical size={16} className="mr-2" /> Bottle
        </button>
      </div>

      <div className="px-2">
        {activeTab === 'coin' && <CoinFlip />}
        {activeTab === 'number' && <RandomNumber />}
        {activeTab === 'dice' && <DiceRoller />}
        {activeTab === 'bottle' && <SpinBottle />}
      </div>
    </div>
  );
};

export default Randomizer;
