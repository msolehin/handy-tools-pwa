import React, { useEffect, useState } from 'react';
import { Check, CloudOff, TriangleAlert, CloudDownload, CloudUpload } from 'lucide-react';
import type { SyncStatus } from '../lib/store';

/**
 * The one place the app tells you whether a record reached your account. Rendered once from
 * Layout and fed by `store:status`, so all 20 tools report through the same channel and none
 * of them can claim a save the store didn't actually make.
 */
const STYLES: Record<SyncStatus['kind'], { icon: React.ReactNode; className: string }> = {
  saving: { icon: <CloudUpload size={16} />, className: 'bg-primary/10 border-primary/30 text-primary' },
  saved: { icon: <Check size={16} />, className: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' },
  loaded: { icon: <CloudDownload size={16} />, className: 'bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-400' },
  offline: { icon: <CloudOff size={16} />, className: 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400' },
  error: { icon: <TriangleAlert size={16} />, className: 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400' },
  guest: { icon: <CloudOff size={16} />, className: 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400' },
};

// Long enough to read a failure, short enough that a save doesn't sit on the screen.
//
// `saving` is not a message to be read and dismissed — it is replaced by whatever the push
// turns out to be. Its timeout is only a backstop, for the case where the flush never runs at
// all (the connection dropped in the gap after the write was accepted). A spinner that never
// resolves is worse than no spinner, so it does eventually give up.
const HOLD_MS: Record<SyncStatus['kind'], number> = {
  saving: 12000, saved: 1800, loaded: 3500, offline: 5000, error: 5000, guest: 4000,
};

const SyncToast: React.FC = () => {
  // `seq` counts announcements. React would otherwise reuse the fill bar's DOM node between two
  // consecutive saves and let its animation run on from wherever it had got to; as a key it
  // forces a fresh element, so every write restarts the fill from empty.
  const [status, setStatus] = useState<(SyncStatus & { seq: number }) | null>(null);
  // The store tells us how long the debounce is, but not when it ends — so the bar watches its
  // own fill finish and hands over to the sweep itself. Nothing has to be announced twice.
  const [sweeping, setSweeping] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onStatus = (e: Event) => {
      const next = (e as CustomEvent<SyncStatus>).detail;
      setStatus((prev) => ({ ...next, seq: (prev?.seq ?? 0) + 1 }));
      setSweeping(false);
      clearTimeout(timer);
      timer = setTimeout(() => setStatus(null), HOLD_MS[next.kind] ?? 3000);
    };
    window.addEventListener('store:status', onStatus);
    return () => { window.removeEventListener('store:status', onStatus); clearTimeout(timer); };
  }, []);

  if (!status) return null;
  const style = STYLES[status.kind] ?? STYLES.error;
  const filling = status.kind === 'saving' && Boolean(status.waitMs) && !sweeping;

  return (
    <div
      // aria-live so the message is announced rather than only seen — a failed save is exactly
      // the thing a screen-reader user must not miss.
      role="status"
      aria-live="polite"
      // Centred with inset + mx-auto rather than left-1/2 + -translate-x-1/2: no transform means
      // nothing an animation does to `transform` can knock the toast off centre.
      className="fixed inset-x-4 bottom-24 sm:bottom-8 z-[70] mx-auto w-[min(22rem,100%)] pointer-events-none animate-slide-up"
    >
      <div className={`rounded-2xl border backdrop-blur-md shadow-lg overflow-hidden ${style.className}`}>
        <div className="flex items-center gap-2.5 px-4 py-3">
          <span className="shrink-0">{style.icon}</span>
          <p className="text-xs font-semibold leading-snug text-text/90">{status.message}</p>
        </div>
        {/* The progress bar is decoration — aria-live above already announces "Saving…", and a
            sweeping div has nothing to add to that. Indeterminate because the wait is a debounce
            plus a round trip: any percentage shown here would be invented. */}
        {status.kind === 'saving' && (
          // h-1 rather than a hairline: at phone pixel density a 2px sweep is too faint to read
          // as movement, which is the only thing this element exists to communicate.
          //
          // Two phases, because the wait has two halves and only one of them is knowable. The
          // bar fills across the debounce, then sweeps for as long as the request is out.
          // animate-pulse under reduced motion, never animate-none: a frozen progress bar does
          // not read as "we respect your settings", it reads as "this app has hung" — and a 4px
          // bar that fades is nobody's vestibular trigger.
          <div className="h-1 bg-text/10" aria-hidden="true">
            {filling ? (
              // No motion-reduce override on this one, deliberately. animate-none here would
              // stop onAnimationEnd ever firing and strand the bar in the fill phase for good.
              // A 4px bar widening once is also not what prefers-reduced-motion is protecting
              // anyone from, and it is load-bearing status rather than decoration.
              //
              // w-0 only ever shows before the animation's first frame — during and (thanks to
              // `forwards`) after, the keyframes own the width. Without it the div's auto width
              // could paint one frame at full.
              <div
                key={status.seq}
                className="h-full w-0 bg-primary animate-progress-fill"
                style={{ animationDuration: `${status.waitMs}ms` }}
                onAnimationEnd={() => setSweeping(true)}
              />
            ) : (
              <div className="h-full w-2/5 bg-primary animate-indeterminate motion-reduce:w-full motion-reduce:animate-pulse" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncToast;
