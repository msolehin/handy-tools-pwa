import React, { useState, useEffect } from 'react';
import { Timer, Activity, Footprints, RefreshCw } from 'lucide-react';

type Mode = 'pace' | 'time' | 'distance';

const distances = [
  { label: '5K', km: '5' },
  { label: '10K', km: '10' },
  { label: 'Half Marathon', km: '21.0975' },
  { label: 'Full Marathon', km: '42.195' },
];

const PaceCalculator: React.FC = () => {
  const [mode, setMode] = useState<Mode>(() => localStorage.getItem('pc_mode') as Mode || 'pace');

  const [timeHrs, setTimeHrs] = useState(() => localStorage.getItem('pc_timeHrs') || '');
  const [timeMins, setTimeMins] = useState(() => localStorage.getItem('pc_timeMins') || '');
  const [timeSecs, setTimeSecs] = useState(() => localStorage.getItem('pc_timeSecs') || '');
  
  const [distanceKm, setDistanceKm] = useState(() => localStorage.getItem('pc_distanceKm') || '');
  
  const [paceMins, setPaceMins] = useState(() => localStorage.getItem('pc_paceMins') || '');
  const [paceSecs, setPaceSecs] = useState(() => localStorage.getItem('pc_paceSecs') || '');

  useEffect(() => { localStorage.setItem('pc_mode', mode); }, [mode]);
  useEffect(() => { localStorage.setItem('pc_timeHrs', timeHrs); }, [timeHrs]);
  useEffect(() => { localStorage.setItem('pc_timeMins', timeMins); }, [timeMins]);
  useEffect(() => { localStorage.setItem('pc_timeSecs', timeSecs); }, [timeSecs]);
  useEffect(() => { localStorage.setItem('pc_distanceKm', distanceKm); }, [distanceKm]);
  useEffect(() => { localStorage.setItem('pc_paceMins', paceMins); }, [paceMins]);
  useEffect(() => { localStorage.setItem('pc_paceSecs', paceSecs); }, [paceSecs]);

  const handleReset = () => {
    if (window.confirm("Reset all Pace Calculator inputs?")) {
      setMode('pace');
      setTimeHrs('');
      setTimeMins('');
      setTimeSecs('');
      setDistanceKm('');
      setPaceMins('');
      setPaceSecs('');
      localStorage.removeItem('pc_mode');
      localStorage.removeItem('pc_timeHrs');
      localStorage.removeItem('pc_timeMins');
      localStorage.removeItem('pc_timeSecs');
      localStorage.removeItem('pc_distanceKm');
      localStorage.removeItem('pc_paceMins');
      localStorage.removeItem('pc_paceSecs');
    }
  };

  // Auto calculate Pace
  useEffect(() => {
    if (mode !== 'pace') return;
    
    const tH = parseInt(timeHrs) || 0;
    const tM = parseInt(timeMins) || 0;
    const tS = parseInt(timeSecs) || 0;
    const totalTimeSecs = (tH * 3600) + (tM * 60) + tS;
    const dKm = parseFloat(distanceKm) || 0;

    if (dKm > 0 && totalTimeSecs > 0) {
      const calculatedPaceSecs = totalTimeSecs / dKm;
      setPaceMins(Math.floor(calculatedPaceSecs / 60).toString());
      setPaceSecs(Math.round(calculatedPaceSecs % 60).toString().padStart(2, '0'));
    } else {
      setPaceMins('');
      setPaceSecs('');
    }
  }, [mode, timeHrs, timeMins, timeSecs, distanceKm]);

  // Auto calculate Time
  useEffect(() => {
    if (mode !== 'time') return;
    
    const dKm = parseFloat(distanceKm) || 0;
    const pM = parseInt(paceMins) || 0;
    const pS = parseInt(paceSecs) || 0;
    const paceTotalSecs = (pM * 60) + pS;

    if (dKm > 0 && paceTotalSecs > 0) {
      const calculatedTimeSecs = dKm * paceTotalSecs;
      setTimeHrs(Math.floor(calculatedTimeSecs / 3600).toString());
      setTimeMins(Math.floor((calculatedTimeSecs % 3600) / 60).toString().padStart(2, '0'));
      setTimeSecs(Math.round(calculatedTimeSecs % 60).toString().padStart(2, '0'));
    } else {
      setTimeHrs('');
      setTimeMins('');
      setTimeSecs('');
    }
  }, [mode, distanceKm, paceMins, paceSecs]);

  // Auto calculate Distance
  useEffect(() => {
    if (mode !== 'distance') return;
    
    const tH = parseInt(timeHrs) || 0;
    const tM = parseInt(timeMins) || 0;
    const tS = parseInt(timeSecs) || 0;
    const totalTimeSecs = (tH * 3600) + (tM * 60) + tS;
    
    const pM = parseInt(paceMins) || 0;
    const pS = parseInt(paceSecs) || 0;
    const paceTotalSecs = (pM * 60) + pS;

    if (totalTimeSecs > 0 && paceTotalSecs > 0) {
      const calculatedDistance = totalTimeSecs / paceTotalSecs;
      setDistanceKm(calculatedDistance.toFixed(2));
    } else {
      setDistanceKm('');
    }
  }, [mode, timeHrs, timeMins, timeSecs, paceMins, paceSecs]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/20 text-primary rounded-xl">
            <Activity size={24} />
          </div>
          <h2 className="text-2xl font-bold">Pace Calculator</h2>
        </div>
        <button 
          onClick={handleReset}
          className="text-xs flex items-center text-muted hover:text-text transition-colors"
        >
          <RefreshCw size={12} className="mr-1" /> Reset
        </button>
      </div>

      <div className="glass-panel p-4">
        <label className="block text-sm font-medium text-muted mb-2">What do you want to calculate?</label>
        <select 
          value={mode} 
          onChange={(e) => setMode(e.target.value as Mode)}
          className="w-full bg-background border border-text/10 rounded-xl px-4 py-3 text-text focus:outline-none focus:border-primary transition-colors appearance-none"
        >
          <option value="pace">Pace (min/km)</option>
          <option value="time">Time (hh:mm:ss)</option>
          <option value="distance">Distance (km)</option>
        </select>
      </div>

      <div className="space-y-4">
        {/* TIME INPUT */}
        <div className={`glass-panel p-4 transition-opacity duration-300 ${mode === 'time' ? 'opacity-60 border-primary/30' : 'border-text/10'}`}>
          <div className="flex items-center space-x-2 mb-3">
            <Timer className="text-primary" size={18} />
            <h3 className="font-semibold">Time</h3>
            {mode === 'time' && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded ml-2">Auto-calculated</span>}
          </div>
          <div className="flex space-x-2">
            <div className="flex-1">
              <label className="block text-xs text-muted mb-1 text-center">Hours</label>
              <input 
                type="number" 
                min="0"
                value={timeHrs}
                onChange={(e) => setTimeHrs(e.target.value)}
                readOnly={mode === 'time'}
                placeholder="0"
                className="input-field text-center text-lg py-3"
              />
            </div>
            <div className="flex items-center justify-center pt-5 font-bold">:</div>
            <div className="flex-1">
              <label className="block text-xs text-muted mb-1 text-center">Mins</label>
              <input 
                type="number" 
                min="0" max="59"
                value={timeMins}
                onChange={(e) => setTimeMins(e.target.value)}
                readOnly={mode === 'time'}
                placeholder="00"
                className="input-field text-center text-lg py-3"
              />
            </div>
            <div className="flex items-center justify-center pt-5 font-bold">:</div>
            <div className="flex-1">
              <label className="block text-xs text-muted mb-1 text-center">Secs</label>
              <input 
                type="number" 
                min="0" max="59"
                value={timeSecs}
                onChange={(e) => setTimeSecs(e.target.value)}
                readOnly={mode === 'time'}
                placeholder="00"
                className="input-field text-center text-lg py-3"
              />
            </div>
          </div>
        </div>

        {/* DISTANCE INPUT */}
        <div className={`glass-panel p-4 transition-opacity duration-300 ${mode === 'distance' ? 'opacity-60 border-primary/30' : 'border-text/10'}`}>
          <div className="flex items-center space-x-2 mb-3">
            <Footprints className="text-secondary" size={18} />
            <h3 className="font-semibold">Distance (km)</h3>
            {mode === 'distance' && <span className="text-xs bg-secondary/20 text-secondary px-2 py-0.5 rounded ml-2">Auto-calculated</span>}
          </div>
          <input 
            type="number" 
            min="0"
            step="0.01"
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            readOnly={mode === 'distance'}
            placeholder="e.g. 5.00"
            className="input-field text-xl py-3 px-4 mb-3"
          />
          
          <div className="grid grid-cols-4 gap-2">
            {distances.map(d => (
              <button
                key={d.label}
                disabled={mode === 'distance'}
                onClick={() => setDistanceKm(d.km)}
                className={`text-xs py-2 px-1 rounded-lg border font-medium transition-colors ${
                  distanceKm === d.km 
                    ? 'bg-secondary/20 border-secondary/50 text-secondary' 
                    : 'bg-text/5 border-text/10 text-muted hover:bg-text/10'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* PACE INPUT */}
        <div className={`glass-panel p-4 transition-opacity duration-300 ${mode === 'pace' ? 'opacity-60 border-accent/30' : 'border-text/10'}`}>
          <div className="flex items-center space-x-2 mb-3">
            <Activity className="text-accent" size={18} />
            <h3 className="font-semibold">Pace (min/km)</h3>
            {mode === 'pace' && <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded ml-2">Auto-calculated</span>}
          </div>
          <div className="flex space-x-4 max-w-[60%] mx-auto">
            <div className="flex-1">
              <label className="block text-xs text-muted mb-1 text-center">Mins</label>
              <input 
                type="number" 
                min="0" max="59"
                value={paceMins}
                onChange={(e) => setPaceMins(e.target.value)}
                readOnly={mode === 'pace'}
                placeholder="00"
                className="input-field text-center text-xl py-3 font-semibold"
              />
            </div>
            <div className="flex items-center justify-center pt-5 font-bold text-2xl">:</div>
            <div className="flex-1">
              <label className="block text-xs text-muted mb-1 text-center">Secs</label>
              <input 
                type="number" 
                min="0" max="59"
                value={paceSecs}
                onChange={(e) => setPaceSecs(e.target.value)}
                readOnly={mode === 'pace'}
                placeholder="00"
                className="input-field text-center text-xl py-3 font-semibold"
              />
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default PaceCalculator;
