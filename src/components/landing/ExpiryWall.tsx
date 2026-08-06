import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useCopy } from './copy';
import { DAYS, rowState, urgency } from './wall';

/**
 * The hero's signature: a stack of records showing days remaining, presented as the app's own
 * alert surface. It demonstrates the problem rather than describing it.
 *
 * Green/amber/red are *data* colours on this page — they encode urgency and appear nowhere
 * else, so the only colourful things a visitor sees are the deadlines themselves.
 */

const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ExpiryWall: React.FC = () => {
  const { t } = useCopy();
  // Resolved in initial state, so a reduced-motion visitor never sees a frame of animation.
  const [progress, setProgress] = useState(() => (prefersReducedMotion() ? 1 : 0));

  useEffect(() => {
    if (prefersReducedMotion()) return;

    // No ref guard here. A ref survives StrictMode's remount, so the first run would start the
    // animation, cleanup would cancel it, and the second run would bail out — leaving the wall
    // frozen at its opening frame: dim rows, inflated counts, everything green.
    const DURATION = 1100;
    let frame = 0;
    let start: number | null = null;

    const step = (now: number) => {
      start ??= now;
      const elapsed = Math.min(1, (now - start) / DURATION);
      setProgress(1 - Math.pow(1 - elapsed, 3)); // ease-out cubic: fast, then settles
      if (elapsed < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-text/10 bg-surface/60 shadow-2xl shadow-black/30 backdrop-blur-xl">
      {/* A header strip so the panel reads as a surface from the app, not a marketing card. */}
      <div className="flex items-center gap-2 border-b border-text/10 bg-text/[0.03] px-5 py-3.5">
        <Bell size={15} className="text-primary" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          {t.wall.title}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          {t.wall.live}
        </span>
      </div>

      <ul className="divide-y divide-text/[0.06]">
        {t.wall.records.map((record, i) => {
          const { shown, opacity, fill } = rowState(progress, i, DAYS[i]);
          const colour = urgency(shown);

          return (
            <li
              key={record.label}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-text/[0.02]"
              style={{ opacity }}
            >
              <span className={`h-9 w-[3px] shrink-0 rounded-full ${colour.bar}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-tight text-text">{record.label}</p>
                <p className="mt-0.5 truncate text-xs text-muted">{record.note}</p>
                <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-text/10">
                  <div
                    className={`h-full rounded-full ${colour.bar} transition-[width] duration-700 ease-out`}
                    style={{ width: `${fill}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={`block text-[28px] font-extrabold leading-none tracking-tight ${colour.text}`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {shown}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                  {t.wall.unit}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ExpiryWall;
