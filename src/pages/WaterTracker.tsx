import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Droplets, Undo2, Settings, X, RotateCcw, Smartphone } from 'lucide-react';
import { store } from '../lib/store';

interface WaterData {
  date: string;
  intake: number;
  goal: number;
  history: number[]; // to allow undo
}

const STORAGE_KEY = 'water_tracker_data';

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const WaterTracker: React.FC = () => {
  const [data, setData] = useState<WaterData>({
    date: getTodayString(),
    intake: 0,
    goal: 2500,
    history: []
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempGoal, setTempGoal] = useState('2500');

  // Device-tilt water motion
  const waterRef = useRef<HTMLDivElement>(null);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);

  const MAX_TILT = 14; // degrees the water surface can lean
  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    if (!waterRef.current) return;
    const gamma = e.gamma ?? 0; // left/right tilt, -90..90
    const clamped = Math.max(-MAX_TILT, Math.min(MAX_TILT, gamma));
    // Counter-rotate so the surface leans toward the lower side, like real water
    waterRef.current.style.transform = `rotate(${-clamped}deg)`;
  }, []);

  const enableMotion = useCallback(async () => {
    const DOE = window.DeviceOrientationEvent as any;
    try {
      if (DOE && typeof DOE.requestPermission === 'function') {
        const res = await DOE.requestPermission();
        if (res !== 'granted') return;
      }
      window.addEventListener('deviceorientation', handleOrientation);
      setMotionEnabled(true);
      setNeedsPermission(false);
    } catch (e) {
      // ignore — motion just won't be available
    }
  }, [handleOrientation]);

  useEffect(() => {
    const DOE = window.DeviceOrientationEvent as any;
    if (!DOE) return; // no sensor (most desktops)
    if (typeof DOE.requestPermission === 'function') {
      // iOS 13+ — needs a user tap to grant motion access
      setNeedsPermission(true);
    } else {
      // Android / others — attach directly
      window.addEventListener('deviceorientation', handleOrientation);
      setMotionEnabled(true);
    }
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [handleOrientation]);

  useEffect(() => {
    const saved = store.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as WaterData;
        if (parsed.date === getTodayString()) {
          setData(parsed);
          setTempGoal(parsed.goal.toString());
        } else {
          // Reset for a new day
          const newData = {
            date: getTodayString(),
            intake: 0,
            goal: parsed.goal || 2500,
            history: []
          };
          setData(newData);
          setTempGoal(newData.goal.toString());
          store.setItem(STORAGE_KEY, JSON.stringify(newData));
        }
      } catch (e) {}
    }
  }, []);

  const save = (newData: WaterData) => {
    setData(newData);
    store.setItem(STORAGE_KEY, JSON.stringify(newData));
  };

  const addWater = (amount: number) => {
    const newData = {
      ...data,
      intake: data.intake + amount,
      history: [...data.history, amount]
    };
    save(newData);
  };

  const undo = () => {
    if (data.history.length === 0) return;
    const newHistory = [...data.history];
    const lastAmount = newHistory.pop() || 0;
    const newData = {
      ...data,
      intake: Math.max(0, data.intake - lastAmount),
      history: newHistory
    };
    save(newData);
  };

  const reset = () => {
    if (window.confirm('Anda pasti mahu set semula pengambilan air hari ini?')) {
      const newData = {
        ...data,
        intake: 0,
        history: []
      };
      save(newData);
    }
  };

  const saveSettings = () => {
    const parsed = parseInt(tempGoal);
    if (!isNaN(parsed) && parsed > 0) {
      save({ ...data, goal: parsed });
    }
    setIsSettingsOpen(false);
  };

  const percentage = Math.min(100, Math.round((data.intake / data.goal) * 100));

  // CSS wave effect
  const waveSvg1 = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 88.7'%3E%3Cpath d='M800 56.9c-155.5 0-204.9-50-405.5-49.9-200 0-250 49.9-394.5 49.9v31.8h800v-.2-31.6z' fill='%2360a5fa' opacity='0.4'/%3E%3C/svg%3E`;
  const waveSvg2 = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 88.7'%3E%3Cpath d='M800 56.9c-155.5 0-204.9-50-405.5-49.9-200 0-250 49.9-394.5 49.9v31.8h800v-.2-31.6z' fill='%233b82f6' opacity='0.6'/%3E%3C/svg%3E`;

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20 relative min-h-[85vh] flex flex-col">
      <div className="flex items-center justify-between z-10 relative px-2">
        <div className="flex items-center space-x-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 text-blue-400">
            <Droplets size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text/90">Minum</h1>
            <p className="text-xs text-muted">Sasaran Harian: {data.goal}ml</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {needsPermission && !motionEnabled && (
            <button
              onClick={enableMotion}
              title="Hidupkan gerakan condong"
              className="p-3 bg-blue-500/15 rounded-xl hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 transition-colors active:scale-90"
            >
              <Smartphone size={20} />
            </button>
          )}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-3 bg-text/5 rounded-xl hover:bg-text/10 text-muted transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 pointer-events-none mt-10">
        <h2 className="text-6xl font-black text-text drop-shadow-2xl font-mono tracking-tighter">
          {data.intake}<span className="text-2xl text-text/70">ml</span>
        </h2>
        <p className="text-xl font-bold mt-2 text-blue-200 drop-shadow-md bg-black/20 px-4 py-1 rounded-full backdrop-blur-sm">
          {percentage}% Selesai
        </p>
        
        {data.intake >= data.goal && (
          <div className="mt-4 px-4 py-2 bg-emerald-500/20 text-emerald-300 font-bold rounded-xl border border-emerald-500/30 animate-fade-in backdrop-blur-md">
            Sasaran Tercapai! 🎉
          </div>
        )}
      </div>

      {/* Quick Add Buttons */}
      <div className="grid grid-cols-3 gap-3 z-10 relative mt-auto pt-20">
        <button 
          onClick={() => addWater(250)}
          className="glass-panel p-4 flex flex-col items-center justify-center hover:bg-text/10 active:scale-95 transition-all border-blue-500/20 hover:border-blue-400/50"
        >
          <Droplets size={20} className="text-blue-300 mb-2" />
          <span className="font-bold text-sm">+250ml</span>
        </button>
        <button 
          onClick={() => addWater(500)}
          className="glass-panel p-4 flex flex-col items-center justify-center hover:bg-text/10 active:scale-95 transition-all border-blue-500/30 hover:border-blue-400/50 bg-blue-500/5"
        >
          <Droplets size={24} className="text-blue-400 mb-2" />
          <span className="font-bold text-sm">+500ml</span>
        </button>
        <button 
          onClick={() => addWater(1000)}
          className="glass-panel p-4 flex flex-col items-center justify-center hover:bg-text/10 active:scale-95 transition-all border-blue-500/40 hover:border-blue-400/50 bg-blue-500/10"
        >
          <Droplets size={28} className="text-blue-500 mb-2" />
          <span className="font-bold text-sm">+1L</span>
        </button>
      </div>

      {(data.history.length > 0 || data.intake > 0) && (
        <div className="flex justify-center space-x-3 z-10 relative mt-4">
          {data.history.length > 0 && (
            <button 
              onClick={undo}
              className="flex items-center space-x-2 px-4 py-2 bg-text/5 rounded-full text-sm font-medium text-muted hover:text-text hover:bg-text/10 transition-colors"
            >
              <Undo2 size={16} />
              <span>Buat Asal</span>
            </button>
          )}
          {data.intake > 0 && (
            <button 
              onClick={reset}
              className="flex items-center space-x-2 px-4 py-2 bg-rose-500/10 text-rose-400 rounded-full text-sm font-medium hover:bg-rose-500/20 transition-colors border border-rose-500/20"
            >
              <RotateCcw size={16} />
              <span>Set Semula</span>
            </button>
          )}
        </div>
      )}

      {/* Water Fill Animation Background (clipped to the viewport) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div
          ref={waterRef}
          className="absolute left-[-75%] right-[-75%] bg-blue-600/30 origin-top"
          style={{
            bottom: '-60vh',
            height: `calc(${Math.min(95, percentage)}% + 60vh)`,
            transition: 'height 1500ms cubic-bezier(0.4,0,0.2,1), transform 250ms ease-out'
          }}
        >
          {/* Waves */}
          {percentage > 0 && (
            <>
              <div
                className="absolute w-[200%] h-12 left-0 -top-[47px] bg-repeat-x wave-anim"
                style={{ backgroundImage: `url("${waveSvg1}")`, backgroundSize: '400px 100%' }}
              />
              <div
                className="absolute w-[200%] h-12 left-0 -top-[47px] bg-repeat-x wave-anim-fast"
                style={{ backgroundImage: `url("${waveSvg2}")`, backgroundSize: '400px 100%' }}
              />
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-blue-900/80 to-blue-500/20" />
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-text/10 p-6 rounded-3xl w-full max-w-sm shadow-2xl relative animate-slide-up">
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 p-2 text-muted hover:text-text bg-text/5 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
            
            <h2 className="text-xl font-bold mb-6">Tetapan</h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Sasaran Harian (ml)</label>
                <input 
                  type="number"
                  inputMode="numeric"
                  value={tempGoal} 
                  onChange={e => setTempGoal(e.target.value)}
                  className="input-field w-full text-xl font-mono text-center"
                />
              </div>
              <button 
                onClick={saveSettings}
                className="w-full btn-primary bg-blue-500 hover:bg-blue-600 mt-6"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes wave {
          0% { transform: translateX(0) translateZ(0); }
          50% { transform: translateX(-25%) translateZ(0); }
          100% { transform: translateX(-50%) translateZ(0); }
        }
        .wave-anim {
          animation: wave 10s linear infinite;
        }
        .wave-anim-fast {
          animation: wave 7s linear infinite reverse;
        }
      `}} />
    </div>
  );
};

export default WaterTracker;
