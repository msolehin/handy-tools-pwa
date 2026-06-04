import React, { useState, useEffect, useRef } from 'react';
import { Wifi, Activity, Download, Upload, Server, Globe, MapPin, RefreshCw, AlertTriangle } from 'lucide-react';

type TestState = 'idle' | 'ping' | 'download' | 'upload' | 'done' | 'offline';

interface SpeedData {
  ping: number;
  download: number; // in Mbps
  upload: number;   // in Mbps
  progress: number; // 0 to 100 for current active test
}

interface MetaData {
  ip: string;
  city: string;
  country: string;
  isp: string;
}

const SpeedTest: React.FC = () => {
  const [testState, setTestState] = useState<TestState>('idle');
  const [data, setData] = useState<SpeedData>({ ping: 0, download: 0, upload: 0, progress: 0 });
  const [meta, setMeta] = useState<MetaData | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Check initial online status
    if (!navigator.onLine) {
      setTestState('offline');
    }

    const handleOffline = () => {
      setTestState('offline');
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
    const handleOnline = () => setTestState('idle');

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const getMetadata = async () => {
    try {
      // Just a tiny fetch to get headers
      const res = await fetch(`https://speed.cloudflare.com/__down?bytes=0`);
      const ip = res.headers.get('cf-meta-ip') || 'Unknown';
      const city = res.headers.get('cf-meta-city') || 'Unknown';
      const country = res.headers.get('cf-meta-country') || 'Unknown';
      const asn = res.headers.get('cf-meta-asn') || 'ISP';
      setMeta({ ip, city, country, isp: `AS${asn}` });
    } catch (e) {
      console.log('Failed to fetch metadata');
    }
  };

  const measurePing = async (signal: AbortSignal): Promise<number> => {
    setTestState('ping');
    setData(prev => ({ ...prev, progress: 0 }));
    
    let totalPing = 0;
    const pings = 5;
    
    for (let i = 0; i < pings; i++) {
      if (signal.aborted) throw new Error('aborted');
      const start = performance.now();
      await fetch(`https://speed.cloudflare.com/__down?bytes=0&_t=${Date.now()}`, { signal });
      const duration = performance.now() - start;
      totalPing += duration;
      
      setData(prev => ({ ...prev, ping: Math.round(totalPing / (i + 1)), progress: ((i + 1) / pings) * 100 }));
    }
    
    return Math.round(totalPing / pings);
  };

  const measureDownload = async (signal: AbortSignal): Promise<number> => {
    setTestState('download');
    setData(prev => ({ ...prev, progress: 0, download: 0 }));
    
    // Download 15MB
    const size = 15000000;
    const url = `https://speed.cloudflare.com/__down?bytes=${size}&_t=${Date.now()}`;
    
    const start = performance.now();
    const res = await fetch(url, { signal });
    
    if (!res.body) throw new Error('ReadableStream not supported');
    
    const reader = res.body.getReader();
    let received = 0;
    
    let lastUpdate = performance.now();
    let currentMbps = 0;

    while (true) {
      if (signal.aborted) throw new Error('aborted');
      
      const { done, value } = await reader.read();
      if (done) break;
      
      received += value.length;
      
      const now = performance.now();
      // Throttle UI updates to roughly 10FPS
      if (now - lastUpdate > 100) {
        const durationSec = (now - start) / 1000;
        const bitsLoaded = received * 8;
        currentMbps = bitsLoaded / durationSec / 1000000;
        
        setData(prev => ({
          ...prev,
          download: currentMbps,
          progress: Math.min(100, (received / size) * 100)
        }));
        lastUpdate = now;
      }
    }
    
    const totalDurationSec = (performance.now() - start) / 1000;
    const finalMbps = (size * 8) / totalDurationSec / 1000000;
    
    setData(prev => ({ ...prev, download: finalMbps, progress: 100 }));
    return finalMbps;
  };

  const measureUpload = async (signal: AbortSignal): Promise<number> => {
    setTestState('upload');
    setData(prev => ({ ...prev, progress: 0, upload: 0 }));
    
    // Upload 5MB
    const size = 5000000;
    const payload = new Uint8Array(size); // zeroes are fine
    
    const url = `https://speed.cloudflare.com/__up?_t=${Date.now()}`;
    
    setData(prev => ({ ...prev, progress: 30 })); // fake progress start
    
    const start = performance.now();
    await fetch(url, {
      method: 'POST',
      body: payload,
      signal
    });
    const durationSec = (performance.now() - start) / 1000;
    
    const finalMbps = (size * 8) / durationSec / 1000000;
    
    setData(prev => ({ ...prev, upload: finalMbps, progress: 100 }));
    return finalMbps;
  };

  const startTest = async () => {
    if (!navigator.onLine) {
      setTestState('offline');
      return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setData({ ping: 0, download: 0, upload: 0, progress: 0 });
    
    try {
      if (!meta) await getMetadata();
      await measurePing(signal);
      
      // Small pause between tests
      await new Promise(r => setTimeout(r, 500));
      
      await measureDownload(signal);
      
      await new Promise(r => setTimeout(r, 500));
      
      await measureUpload(signal);
      
      setTestState('done');
    } catch (e: any) {
      if (e.message !== 'aborted') {
        console.error("Test failed", e);
        setTestState('idle');
      }
    }
  };

  // Helper for formatting
  const formatSpeed = (val: number) => val === 0 ? '--' : val.toFixed(1);

  // Determine current main display value
  let mainValue = '--';
  let mainLabel = 'Ready';
  let gaugeColor = 'text-indigo-400';
  let activeIcon = <Wifi size={32} />;

  if (testState === 'ping') {
    mainValue = data.ping.toString();
    mainLabel = 'Ping (ms)';
    gaugeColor = 'text-yellow-400';
    activeIcon = <Activity size={32} />;
  } else if (testState === 'download') {
    mainValue = data.download.toFixed(1);
    mainLabel = 'Download (Mbps)';
    gaugeColor = 'text-emerald-400';
    activeIcon = <Download size={32} />;
  } else if (testState === 'upload') {
    mainValue = data.upload.toFixed(1);
    mainLabel = 'Upload (Mbps)';
    gaugeColor = 'text-blue-400';
    activeIcon = <Upload size={32} />;
  } else if (testState === 'done') {
    mainValue = data.download.toFixed(1);
    mainLabel = 'Download (Mbps)';
    gaugeColor = 'text-emerald-400';
  }

  // Circular progress math
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  // Make a gauge (not a full circle, say 75% of a circle)
  const arcLength = circumference * 0.75;
  const dashOffset = arcLength - ((data.progress / 100) * arcLength);

  if (testState === 'offline') {
    return (
      <div className="max-w-md mx-auto p-4 flex flex-col items-center justify-center min-h-[60vh] animate-fade-in text-center space-y-4">
        <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-400 mb-2">
          <AlertTriangle size={48} />
        </div>
        <h1 className="text-2xl font-bold">No Connection</h1>
        <p className="text-muted text-sm px-4">
          The speed test requires an active internet connection. Please connect to Wi-Fi or Cellular and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-6 animate-fade-in">
      <div className="flex items-center space-x-3 px-2 mb-2">
        <div className="p-3 bg-indigo-500/20 rounded-xl">
          <Wifi className="text-indigo-400" size={28} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text/90">Speed Test</h1>
          <p className="text-[10px] text-muted uppercase tracking-wider">Test your connection</p>
        </div>
      </div>

      {/* Main Gauge */}
      <div className="glass-panel p-6 relative flex flex-col items-center justify-center border-indigo-500/20 overflow-hidden">
        {/* Glow effect behind gauge */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 blur-[80px] rounded-full opacity-20 transition-colors duration-500 ${gaugeColor.replace('text-', 'bg-')}`} />
        
        <div className="relative w-[240px] h-[220px] flex items-center justify-center">
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
              className={`transition-all duration-300 ease-out ${gaugeColor}`}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={['idle', 'done'].includes(testState) ? 0 : dashOffset}
            />
          </svg>

          {/* Center Data */}
          <div className="absolute flex flex-col items-center justify-center -translate-y-2">
            <div className={`mb-2 transition-colors duration-300 ${gaugeColor}`}>
              {activeIcon}
            </div>
            <div className="text-5xl font-black font-mono tracking-tighter text-text drop-shadow-md">
              {mainValue}
            </div>
            <div className="text-[11px] font-bold text-muted uppercase tracking-widest mt-1">
              {mainLabel}
            </div>
          </div>
        </div>

        <button
          onClick={startTest}
          disabled={['ping', 'download', 'upload'].includes(testState)}
          className="mt-2 relative z-10 w-full max-w-[200px] py-3.5 rounded-full bg-indigo-500 text-white font-bold tracking-wide shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:bg-indigo-600 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          {testState === 'done' ? (
            <>
              <RefreshCw size={18} />
              <span>Test Again</span>
            </>
          ) : ['ping', 'download', 'upload'].includes(testState) ? (
            <span>Testing...</span>
          ) : (
            <span>Start Test</span>
          )}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`glass-panel p-4 flex flex-col items-center justify-center text-center transition-all ${testState === 'ping' ? 'border-yellow-400/40 shadow-[0_0_15px_rgba(250,204,21,0.1)]' : ''}`}>
          <Activity size={16} className="text-yellow-400 mb-2" />
          <div className="text-lg font-black font-mono">{formatSpeed(data.ping)}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted font-bold mt-1">Ping (ms)</div>
        </div>
        <div className={`glass-panel p-4 flex flex-col items-center justify-center text-center transition-all ${testState === 'download' ? 'border-emerald-400/40 shadow-[0_0_15px_rgba(52,211,153,0.1)]' : ''}`}>
          <Download size={16} className="text-emerald-400 mb-2" />
          <div className="text-lg font-black font-mono">{formatSpeed(data.download)}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted font-bold mt-1">Download</div>
        </div>
        <div className={`glass-panel p-4 flex flex-col items-center justify-center text-center transition-all ${testState === 'upload' ? 'border-blue-400/40 shadow-[0_0_15px_rgba(96,165,250,0.1)]' : ''}`}>
          <Upload size={16} className="text-blue-400 mb-2" />
          <div className="text-lg font-black font-mono">{formatSpeed(data.upload)}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted font-bold mt-1">Upload</div>
        </div>
      </div>

      {/* Meta Info */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-3 text-muted">
            <Globe size={16} />
            <span className="font-medium">Provider</span>
          </div>
          <div className="font-bold text-text/90">
            {meta?.isp || '---'}
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-3 text-muted">
            <Server size={16} />
            <span className="font-medium">IP Address</span>
          </div>
          <div className="font-bold text-text/90 font-mono text-[13px]">
            {meta?.ip || '---'}
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-3 text-muted">
            <MapPin size={16} />
            <span className="font-medium">Location</span>
          </div>
          <div className="font-bold text-text/90">
            {meta ? `${meta.city}, ${meta.country}` : '---'}
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default SpeedTest;
