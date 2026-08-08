import React, { useState, useEffect } from 'react';
import { ArrowUp, X, Compass, AlertCircle } from 'lucide-react';

// Haversine formula for distance
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; 
}

// Bearing calculation
function getBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const λ1 = lon1 * Math.PI/180;
  const λ2 = lon2 * Math.PI/180;

  const y = Math.sin(λ2-λ1) * Math.cos(φ2);
  const x = Math.cos(φ1)*Math.sin(φ2) -
            Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
  const θ = Math.atan2(y, x);
  return (θ*180/Math.PI + 360) % 360; 
}

interface Props {
  targetLat: number;
  targetLng: number;
  onClose: () => void;
}

export const CompassNavigator: React.FC<Props> = ({ targetLat, targetLng, onClose }) => {
  const [distance, setDistance] = useState<number | null>(null);
  const [bearing, setBearing] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  const handleOrientation = (e: DeviceOrientationEvent) => {
    let newHeading = 0;
    if ((e as any).webkitCompassHeading) {
      newHeading = (e as any).webkitCompassHeading;
    } else if (e.alpha !== null) {
      // Android alpha is 0 when pointing west, goes up to 360. We might need absolute orientation.
      newHeading = 360 - e.alpha;
    }
    setHeading(newHeading);
  };

  const startNavigation = async () => {
    try {
      // iOS 13+ device orientation permission
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
        } else {
          setError("Kebenaran kompas ditolak.");
        }
      } else {
        window.addEventListener('deviceorientationabsolute', handleOrientation);
        window.addEventListener('deviceorientation', handleOrientation);
      }

      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const dist = getDistance(lat, lng, targetLat, targetLng);
          const bear = getBearing(lat, lng, targetLat, targetLng);
          
          setDistance(dist);
          setBearing(bear);
          
          // Fallback if device doesn't have compass but is moving
          if (pos.coords.heading !== null && heading === null) {
            setHeading(pos.coords.heading);
          }
        },
        (err) => setError("Ralat lokasi: " + err.message),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      
      setWatchId(id);
      setStarted(true);
    } catch (err: any) {
      setError(err.message || "Gagal memulakan navigasi");
    }
  };

  useEffect(() => {
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
    };
  }, [watchId]);

  const arrowRotation = (bearing !== null && heading !== null) ? (bearing - heading) : 0;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-fade-in">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-3 bg-text/10 hover:bg-text/20 rounded-full transition-colors"
      >
        <X size={24} />
      </button>

      {!started ? (
        <div className="glass-panel p-8 max-w-sm w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-primary/20 text-primary flex items-center justify-center rounded-2xl">
            <Compass size={32} />
          </div>
          <h2 className="text-xl font-bold">Mula Navigasi Dalam App</h2>
          <p className="text-muted text-sm">
            Ini akan guna kompas dan lokasi peranti anda untuk pandu anda kembali ke tempat parking.
          </p>
          <button onClick={startNavigation} className="btn-primary w-full py-4 text-lg">
            Mula Kompas
          </button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center w-full space-y-12">
          {error ? (
             <div className="bg-red-500/20 text-red-200 p-4 rounded-xl flex items-center space-x-2">
                <AlertCircle />
                <span>{error}</span>
             </div>
          ) : (
            <>
              <div className="relative">
                <div className="w-64 h-64 border-4 border-text/10 rounded-full flex items-center justify-center relative shadow-[0_0_50px_rgba(59,130,246,0.2)]">
                  {/* Cardinal points */}
                  <span className="absolute top-2 text-text/30 text-xs font-bold">N</span>
                  <span className="absolute bottom-2 text-text/30 text-xs font-bold">S</span>
                  <span className="absolute right-2 text-text/30 text-xs font-bold">E</span>
                  <span className="absolute left-2 text-text/30 text-xs font-bold">W</span>
                  
                  {/* The Arrow */}
                  <div 
                    className="transition-transform duration-300 ease-out flex flex-col items-center justify-center"
                    style={{ transform: `rotate(${arrowRotation}deg)` }}
                  >
                    <ArrowUp size={100} className={`${(distance !== null && distance < 10) ? 'text-secondary drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]' : 'text-primary drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]'}`} />
                  </div>
                </div>
              </div>

              <div className="text-center space-y-2 glass-panel p-6 w-full max-w-sm">
                <p className="text-muted uppercase tracking-widest text-xs font-semibold">Jarak ke kenderaan</p>
                {distance !== null ? (
                  <div className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {distance < 10 ? 'Dah sampai!' : `${Math.round(distance)}m`}
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-text animate-pulse">Mengira...</div>
                )}
                <p className="text-xs text-muted pt-2">
                  Ikut anak panah. Ia berputar mengikut kompas peranti anda.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
