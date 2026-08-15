import React, { useEffect, useState } from 'react';
import { Check, CloudOff, TriangleAlert, CloudDownload } from 'lucide-react';
import type { SyncStatus } from '../lib/store';

/**
 * The one place the app tells you whether a record reached your account. Rendered once from
 * Layout and fed by `store:status`, so all 20 tools report through the same channel and none
 * of them can claim a save the store didn't actually make.
 */
const STYLES: Record<SyncStatus['kind'], { icon: React.ReactNode; className: string }> = {
  saved: { icon: <Check size={16} />, className: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' },
  loaded: { icon: <CloudDownload size={16} />, className: 'bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-400' },
  offline: { icon: <CloudOff size={16} />, className: 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400' },
  error: { icon: <TriangleAlert size={16} />, className: 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400' },
  guest: { icon: <CloudOff size={16} />, className: 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400' },
};

// Long enough to read a failure, short enough that a save doesn't sit on the screen.
const HOLD_MS: Record<SyncStatus['kind'], number> = {
  saved: 1800, loaded: 3500, offline: 5000, error: 5000, guest: 4000,
};

const SyncToast: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onStatus = (e: Event) => {
      const next = (e as CustomEvent<SyncStatus>).detail;
      setStatus(next);
      clearTimeout(timer);
      timer = setTimeout(() => setStatus(null), HOLD_MS[next.kind] ?? 3000);
    };
    window.addEventListener('store:status', onStatus);
    return () => { window.removeEventListener('store:status', onStatus); clearTimeout(timer); };
  }, []);

  if (!status) return null;
  const style = STYLES[status.kind] ?? STYLES.error;

  return (
    <div
      // aria-live so the message is announced rather than only seen — a failed save is exactly
      // the thing a screen-reader user must not miss.
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 bottom-24 sm:bottom-8 z-[70] w-[min(22rem,calc(100vw-2rem))] pointer-events-none animate-slide-up"
    >
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-lg ${style.className}`}>
        <span className="shrink-0">{style.icon}</span>
        <p className="text-xs font-semibold leading-snug text-text/90">{status.message}</p>
      </div>
    </div>
  );
};

export default SyncToast;
