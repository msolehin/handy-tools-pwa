import React, { useState, useEffect, useRef } from 'react';
import { Gauge, MapPin, Play, Square, Navigation, Compass, TriangleAlert } from 'lucide-react';

type Unit = 'kmh' | 'mph';

const Speedometer: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [speedMs, setSpeedMs] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [altitude, setAltitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [unit, setUnit] = useState<Unit>('kmh');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const toggleTest = () => {
    if (isActive) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsActive(false);
      setSpeedMs(null);
      setHeading(null);
      setAltitude(null);
      setAccuracy(null);
    } else {
      if (!('geolocation' in navigator)) {
        setErrorMsg('Geolocation is not supported by your device.');
        return;
      }
      setErrorMsg(null);
      setIsActive(true);
      
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          // speed is in meters per second
          setSpeedMs(position.coords.speed);
          setHeading(position.coords.heading);
          setAltitude(position.coords.altitude);
          setAccuracy(position.coords.accuracy);
          setErrorMsg(null);
        },
        (error) => {
          console.error(error);
          setIsActive(false);
          switch(error.code) {
            case error.PERMISSION_DENIED:
              setErrorMsg('Location permission denied. Please allow location access to use the speedometer.');
              break;
            case error.POSITION_UNAVAILABLE:
              setErrorMsg('Location information is unavailable. Ensure your GPS is active.');
              break;
            case error.TIMEOUT:
              setErrorMsg('The request to get user location timed out.');
              break;
            default:
              setErrorMsg('An unknown error occurred.');
              break;
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000
        }
      );
    }
  };

  // Convert speed
  const displaySpeed = speedMs === null ? 0 : unit === 'kmh' ? speedMs * 3.6 : speedMs * 2.23694;
  
  // Cap max speed for gauge visualization (e.g. max 200 kmh or 120 mph)
  const maxSpeed = unit === 'kmh' ? 200 : 120;
  const progress = Math.min(100, Math.max(0, (displaySpeed / maxSpeed) * 100));

  // Circular progress math
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 75% of a circle
  const dashOffset = arcLength - ((progress / 100) * arcLength);

  // Dynamic colors based on speed
  const getSpeedColor = () => {
    if (progress < 30) return 'text-emerald-400';
    if (progress < 70) return 'text-yellow-400';
    return 'text-rose-400';
  };
  const gaugeColor = getSpeedColor();

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-6 animate-fade-in">
      <div className="flex items-center space-x-3 px-2 mb-2">
        <div className="p-3 bg-cyan-500/20 rounded-xl">
          <Gauge className="text-cyan-400" size={28} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text/90">Speedometer</h1>
          <p className="text-[10px] text-muted uppercase tracking-wider">GPS Live Speed Tracker</p>
        </div>
      </div>

      {errorMsg && (
        <div className="glass-panel p-4 border-rose-500/40 bg-rose-500/10 flex items-start space-x-3 animate-fade-in">
          <TriangleAlert className="text-rose-400 shrink-0 mt-0.5" size={20} />
          <p className="text-sm font-medium text-rose-200">{errorMsg}</p>
        </div>
      )}

      {/* Main Gauge */}
      <div className="glass-panel p-6 relative flex flex-col items-center justify-center border-cyan-500/20 overflow-hidden min-h-[350px]">
        {isActive && speedMs === null && !errorMsg && (
          <div className="absolute top-4 w-full text-center text-xs text-yellow-400 animate-pulse font-bold tracking-wider">
            Acquiring GPS Signal...
          </div>
        )}
        
        {/* Glow effect behind gauge */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 blur-[80px] rounded-full opacity-20 transition-colors duration-500 ${gaugeColor.replace('text-', 'bg-')}`} />
        
        <div className="relative w-[240px] h-[220px] flex items-center justify-center mt-4">
          <svg className="absolute inset-0 w-full h-full transform translate-y-4 rotate-[135deg] pointer-events-none drop-shadow-xl">
            {/* Background Arc */}
            <circle
              cx="120"
              cy="120"
              r={radius}
              fill="none"
              stroke="currentColor"
              className="text-text opacity-10"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${circumference}`}
            />
            {/* Progress Arc */}
            <circle
              cx="120"
              cy="120"
              r={radius}
              fill="none"
              stroke="currentColor"
              className={`transition-all duration-[800ms] ease-out ${gaugeColor}`}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={isActive ? dashOffset : arcLength}
            />
          </svg>

          {/* Center Data */}
          <div className="absolute flex flex-col items-center justify-center -translate-y-2">
            <div className="text-6xl font-black font-mono tracking-tighter text-text drop-shadow-md tabular-nums">
              {displaySpeed.toFixed(0)}
            </div>
            
            {/* Unit Toggle inside gauge */}
            <div className="flex bg-black/30 rounded-lg p-1 mt-2">
              <button 
                onClick={() => setUnit('kmh')}
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-colors ${unit === 'kmh' ? 'bg-text/20 text-text' : 'text-muted hover:text-text/80'}`}
              >
                km/h
              </button>
              <button 
                onClick={() => setUnit('mph')}
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-colors ${unit === 'mph' ? 'bg-text/20 text-text' : 'text-muted hover:text-text/80'}`}
              >
                mph
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={toggleTest}
          className={`mt-6 relative z-10 w-full max-w-[200px] py-3.5 rounded-full font-bold tracking-wide shadow-lg active:scale-95 transition-all flex items-center justify-center space-x-2 ${
            isActive 
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30' 
              : 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
          }`}
        >
          {isActive ? (
            <>
              <Square size={18} fill="currentColor" />
              <span>Stop Tracking</span>
            </>
          ) : (
            <>
              <Play size={18} fill="currentColor" />
              <span>Start Tracking</span>
            </>
          )}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-panel p-4 flex flex-col items-center justify-center text-center">
          <Navigation size={16} className="text-blue-400 mb-2" />
          <div className="text-lg font-black font-mono">
            {heading !== null && !isNaN(heading) ? heading.toFixed(0) + '°' : '---'}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted font-bold mt-1">Heading</div>
        </div>
        <div className="glass-panel p-4 flex flex-col items-center justify-center text-center">
          <Compass size={16} className="text-emerald-400 mb-2" />
          <div className="text-lg font-black font-mono">
            {altitude !== null && !isNaN(altitude) ? altitude.toFixed(0) + 'm' : '---'}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted font-bold mt-1">Altitude</div>
        </div>
        <div className="glass-panel p-4 flex flex-col items-center justify-center text-center">
          <MapPin size={16} className="text-purple-400 mb-2" />
          <div className="text-lg font-black font-mono">
            {accuracy !== null && !isNaN(accuracy) ? '±' + accuracy.toFixed(0) + 'm' : '---'}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted font-bold mt-1">Accuracy</div>
        </div>
      </div>
      
      <div className="text-center px-4">
        <p className="text-xs text-muted leading-relaxed">
          This tool uses your device's built-in GPS. It works best outdoors and while in motion. Your location data never leaves your device.
        </p>
      </div>

    </div>
  );
};

export default Speedometer;
