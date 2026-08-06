import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert, Gift, CarFront, ListChecks, Plane, ArrowUpRight, Flame, Check,
  ZoomIn, ZoomOut, RotateCcw, Bell, Box, ChevronUp,
  BookOpen, Quote, Laptop, Zap, Sofa, HandCoins, CheckSquare, Square,
} from 'lucide-react';
import Reveal from './Reveal';
import { useCopy } from './copy';
import {
  habitWeeks, weekStreak, activeWeeks, rayaTotals,
  daysTone, TONE_CLASSES, YEAR_WEEKS,
} from './previews';
import { COUNTRY_PATHS, MAP_ALIAS, MAP_H, MAP_W, viewBoxFor } from '../../lib/worldMap';

/**
 * Actual record surfaces from the app, not screenshots — so the page shows what you get rather
 * than describing it. Each one animates once when scrolled to, then keeps still.
 *
 * Everything here sizes fractionally rather than in fixed pixels — a grid item defaults to
 * min-width:auto, so one fixed-width child widens its whole track and pushes the section off
 * the right of a phone screen.
 */

const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fires once when the element scrolls into view — drives the per-preview intro. */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(prefersReducedMotion);
  useEffect(() => {
    if (seen || !ref.current) return;
    const observer = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setSeen(true);
      observer.disconnect();
    }, { threshold: 0.25 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

/**
 * Only the title bar navigates. The body has to stay a plain container — the travel map puts
 * real zoom controls inside it, and interactive controls nested in an <a> are invalid and
 * unusable with a keyboard.
 */
const Frame: React.FC<{
  Icon: React.ElementType; title: string; to: string; children: React.ReactNode;
}> = ({ Icon, title, to, children }) => (
  <div className="group flex h-full flex-col overflow-hidden rounded-3xl border border-text/10 bg-surface/50 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-text/25 hover:shadow-2xl hover:shadow-black/25">
    <Link
      to={to}
      className="flex items-center gap-2.5 border-b border-text/10 bg-text/[0.03] px-5 py-3.5 transition-colors hover:bg-text/[0.07]"
    >
      <Icon size={16} className="text-primary transition-transform duration-300 group-hover:scale-110" />
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{title}</span>
      <ArrowUpRight
        size={15}
        className="ml-auto text-muted/30 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-text"
      />
    </Link>
    <div className="flex-1 p-5">{children}</div>
  </div>
);

// ---------------------------------------------------------------- document expiry

const DocumentPreview: React.FC = () => {
  const { t } = useCopy();
  const [ref, seen] = useInView<HTMLDivElement>();

  return (
    <div ref={ref} className="space-y-2.5">
      {t.previews.doc.items.map((item, i) => {
        const tone = TONE_CLASSES[daysTone(item.days)];
        return (
          <div
            key={item.label}
            className={`flex items-center gap-3 rounded-xl border ${tone.border} bg-text/[0.02] px-3.5 py-3 transition-all duration-500`}
            style={{
              opacity: seen ? 1 : 0,
              transform: seen ? 'none' : 'translateX(-10px)',
              transitionDelay: `${i * 110}ms`,
            }}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">{item.label}</p>
              <p className="truncate text-[11px] text-muted">{item.date}</p>
            </div>
            <div className="shrink-0 text-right">
              <span className={`block text-lg font-extrabold leading-none ${tone.text}`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}>
                {item.days}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-muted">{t.wall.unit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- kira duit raya

const RayaPreview: React.FC = () => {
  const { t } = useCopy();
  const [ref, seen] = useInView<HTMLDivElement>();
  const { given, percentUsed, remaining } = rayaTotals(t.previews.raya.recipients, t.previews.raya.budget);

  return (
    <div ref={ref}>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-extrabold tracking-tight text-text"
              style={{ fontVariantNumeric: 'tabular-nums' }}>
          RM {given}
        </span>
        <span className="text-xs text-muted">/ RM {t.previews.raya.budget}</span>
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-text/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-[1200ms] ease-out"
          style={{ width: seen ? `${percentUsed}%` : '0%' }}
        />
      </div>
      <p className="mt-2 text-[11px] text-muted">
        {t.previews.raya.remainingLabel} <span className="font-semibold text-text">RM {remaining}</span>
      </p>

      <ul className="mt-4 space-y-2">
        {t.previews.raya.recipients.map((r, i) => (
          <li
            key={r.name}
            className="flex items-center gap-2.5 text-sm transition-all duration-500"
            style={{
              opacity: seen ? 1 : 0,
              transform: seen ? 'none' : 'translateY(6px)',
              transitionDelay: `${300 + i * 90}ms`,
            }}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.given ? 'bg-emerald-500' : 'bg-text/20'}`} />
            <span className={`flex-1 truncate ${r.given ? 'text-muted line-through' : 'text-text'}`}>{r.name}</span>
            <span className="shrink-0 font-semibold text-text" style={{ fontVariantNumeric: 'tabular-nums' }}>
              RM {r.amount}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ---------------------------------------------------------------- servis kenderaan / rumah

const ServicePreview: React.FC = () => {
  const { t } = useCopy();
  const [ref, seen] = useInView<HTMLDivElement>();

  return (
    <div ref={ref} className="relative">
      {/* The spine draws itself downward — a service history is a timeline, so the line is the
          information, not an ornament. */}
      <span
        className="absolute left-[5px] top-2 w-px bg-gradient-to-b from-primary/60 to-text/10 transition-[height] duration-[1100ms] ease-out"
        style={{ height: seen ? 'calc(100% - 1rem)' : '0%' }}
      />
      <ul className="space-y-4">
        {t.previews.service.events.map((event, i) => (
          <li
            key={event.title}
            className="relative pl-6 transition-all duration-500"
            style={{
              opacity: seen ? 1 : 0,
              transform: seen ? 'none' : 'translateY(8px)',
              transitionDelay: `${200 + i * 160}ms`,
            }}
          >
            <span className={`absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-background ${event.upcoming ? 'bg-amber-500' : 'bg-primary'}`} />
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-semibold text-text">{event.title}</p>
              {event.cost && (
                <span className="shrink-0 text-xs font-semibold text-muted"
                      style={{ fontVariantNumeric: 'tabular-nums' }}>
                  RM {event.cost}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted">{event.meta}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ---------------------------------------------------------------- habit year (3 habits)

// Distinct hues per habit. Deliberately none of the urgency triad (emerald / amber / red) —
// those mean "how soon" everywhere else on this page and must not start meaning "which habit".
const HABIT_HUES = [
  { on: 'bg-violet-500', dim: 'bg-violet-500/35', mid: 'bg-violet-500/65', text: 'text-violet-500' },
  { on: 'bg-fuchsia-500', dim: 'bg-fuchsia-500/35', mid: 'bg-fuchsia-500/65', text: 'text-fuchsia-500' },
  { on: 'bg-cyan-500', dim: 'bg-cyan-500/35', mid: 'bg-cyan-500/65', text: 'text-cyan-500' },
];

const HabitPreview: React.FC = () => {
  const { t } = useCopy();
  const [ref, seen] = useInView<HTMLDivElement>();
  const [ticked, setTicked] = useState<Record<string, boolean>>({});

  return (
    <div ref={ref} className="space-y-4">
      {t.previews.habit.habits.map((habit, h) => {
        const raw = habitWeeks(habit.seed, habit.strength);
        // Only the current week is tickable, the way the tracker only lets you tick today. The
        // streak and active-week counts read off the same array, so they follow the tick.
        const done = ticked[habit.name] ?? raw[raw.length - 1] > 0;
        const weeks = done === (raw[raw.length - 1] > 0)
          ? raw
          : [...raw.slice(0, -1), done ? 3 : 0];
        const hue = HABIT_HUES[h % HABIT_HUES.length];
        // Each level is a row, so a week's intensity reads as a column that grows upward —
        // three lines instead of one shaded square, same data, easier to skim.
        const LEVEL_SHADE = [hue.on, hue.mid, hue.dim];

        return (
          <div key={habit.name} className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="shrink-0 text-sm">{habit.emoji}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{habit.name}</span>
              <span className={`flex shrink-0 items-center gap-1 text-xs font-bold ${hue.text}`}>
                <Flame size={12} />
                {weekStreak(weeks)}
              </span>
              <button
                type="button"
                onClick={() => setTicked((prev) => ({ ...prev, [habit.name]: !done }))}
                aria-pressed={done}
                aria-label={`${t.previews.habit.tickLabel} — ${habit.name}`}
                title={t.previews.habit.tickLabel}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                  done
                    ? `${hue.on} border-transparent text-[#ffffff]`
                    : 'border-text/25 text-transparent hover:border-text/50'
                }`}
              >
                <Check size={12} strokeWidth={3} />
              </button>
            </div>

            {/* Fractional columns, so the year always fits its container instead of forcing a
                fixed pixel width that would push the card off a phone screen. */}
            <div className="space-y-[2px]">
              {[3, 2, 1].map((level) => (
                <div
                  key={level}
                  className="grid gap-[2px]"
                  style={{ gridTemplateColumns: `repeat(${YEAR_WEEKS}, minmax(0, 1fr))` }}
                >
                  {weeks.map((value, i) => (
                    <span
                      key={i}
                      className={`h-2 rounded-[2px] ${value >= level ? LEVEL_SHADE[level - 1] : 'bg-text/[0.07]'}`}
                      style={{
                        opacity: seen ? 1 : 0,
                        transition: prefersReducedMotion() ? undefined : 'opacity 350ms ease-out',
                        transitionDelay: `${h * 160 + i * 10}ms`,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>

            <p className="mt-1 text-[10px] text-muted">
              {activeWeeks(weeks)} {t.previews.habit.weeksLabel}
            </p>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- travel history

const HOME = 'Malaysia';

type View = { x: number; y: number; w: number; h: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const parseBox = (box: string): View => {
  const [x, y, w, h] = box.split(' ').map(Number);
  return { x, y, w, h };
};

/** Keep at least half the frame over the projected world, so the map can't be lost off-screen. */
const settle = (next: View): View => ({
  ...next,
  x: clamp(next.x, -next.w / 2, MAP_W - next.w / 2),
  y: clamp(next.y, -next.h / 2, MAP_H - next.h / 2),
});

/**
 * Pan and zoom over the projected map. The starting frame is the visited countries; zooming out
 * bottoms out at the whole world. Drag to pan, wheel or the buttons to zoom.
 */
function useMapView(baseBox: string) {
  const base: View = React.useMemo(() => parseBox(baseBox), [baseBox]);

  const [view, setView] = useState<View | null>(null);
  const drag = useRef<{ px: number; py: number; from: View; scale: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const raf = useRef(0);
  const v = view ?? base;

  // Mirrors of what is on screen, for the callbacks below — they stay attached across renders,
  // so they can't read the current frame from a render closure.
  const baseRef = useRef(base);
  const viewRef = useRef(v);
  useEffect(() => { baseRef.current = base; viewRef.current = v; });
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Zoom about the centre of the current frame, keeping the map's aspect ratio.
  const zoom = React.useCallback((factor: number) => {
    cancelAnimationFrame(raf.current);
    setView((prev) => {
      const cur = prev ?? baseRef.current;
      const w = clamp(cur.w * factor, baseRef.current.w * 0.3, MAP_W);
      const h = w * MAP_H / MAP_W;
      return settle({ x: cur.x + (cur.w - w) / 2, y: cur.y + (cur.h - h) / 2, w, h });
    });
  }, []);

  /** Glide to a frame — a jump-cut across a map loses you. `null` goes back to the default. */
  const flyTo = React.useCallback((box: string | null) => {
    cancelAnimationFrame(raf.current);
    const target = box === null ? baseRef.current : settle(parseBox(box));
    if (prefersReducedMotion()) {
      setView(box === null ? null : target);
      return;
    }
    const from = viewRef.current;
    const started = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - started) / 480);
      const e = 1 - (1 - p) ** 3;
      if (p < 1) {
        setView({
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
          w: from.w + (target.w - from.w) * e,
          h: from.h + (target.h - from.h) * e,
        });
        raf.current = requestAnimationFrame(step);
      } else {
        // Landing on exactly null restores "untouched", so the reset button can fade away again.
        setView(box === null ? null : target);
      }
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  // Native and non-passive: React registers onWheel passively, so preventDefault there is
  // ignored and the page scrolls away under the cursor instead of the map zooming.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom]);

  const handlers = {
    ref: svgRef,
    onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => {
      cancelAnimationFrame(raf.current);
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = {
        px: e.clientX, py: e.clientY, from: v,
        scale: v.w / e.currentTarget.getBoundingClientRect().width,
      };
    },
    onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => {
      const d = drag.current;
      if (!d) return;
      setView(settle({
        ...d.from,
        x: d.from.x - (e.clientX - d.px) * d.scale,
        y: d.from.y - (e.clientY - d.py) * d.scale,
      }));
    },
    onPointerUp: () => { drag.current = null; },
    onPointerCancel: () => { drag.current = null; },
  };

  return {
    viewBox: `${v.x} ${v.y} ${v.w} ${v.h}`,
    zoom,
    flyTo,
    reset: () => flyTo(null),
    atBase: view === null,
    handlers,
  };
}

const TravelPreview: React.FC = () => {
  const { t } = useCopy();
  const [ref, seen] = useInView<HTMLDivElement>();
  // Which trip in the list is picked out on the map. Null is "none" — clicking the same row again
  // clears it, so there is always a way back to the plain map.
  const [picked, setPicked] = useState<string | null>(null);
  // The staggered intro delays must not also delay a click response, so they stop applying the
  // moment the list is used.
  const [touched, setTouched] = useState(false);

  // Trip order is the timeline order, so each country lights in the order you visited it.
  const litOrder = new Map<string, number>();
  t.previews.travel.trips.forEach((trip, i) => {
    litOrder.set(MAP_ALIAS[trip.country] ?? trip.country, i);
  });

  const spent = t.previews.travel.trips.reduce((sum, trip) => sum + trip.budget, 0);
  // Frame tight on where you have actually been, rather than showing an empty Atlantic.
  const map = useMapView(
    viewBoxFor([HOME, ...t.previews.travel.trips.map((trip) => trip.country)], 0.15),
  );

  // Picking a trip flies the map to that country and holds it outlined; picking it again lets go.
  const pick = (country: string) => {
    setTouched(true);
    const next = picked === country ? null : country;
    setPicked(next);
    map.flyTo(next === null ? null : viewBoxFor([next], 0.9));
  };

  return (
    <div ref={ref} className="min-w-0">
      {/* The same projection the Travel History tool draws, from the same shared module —
          so this is the real map, not an impression of one. */}
      <div className="relative -mx-1 mb-4 overflow-hidden rounded-2xl border border-text/10 bg-text/[0.03]">
        <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
          {([
            [ZoomIn, t.previews.travel.map.in, () => map.zoom(0.7), false],
            [ZoomOut, t.previews.travel.map.out, () => map.zoom(1 / 0.7), false],
            [RotateCcw, t.previews.travel.map.reset, map.reset, map.atBase],
          ] as const).map(([BtnIcon, label, onClick, disabled]) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              disabled={disabled}
              aria-label={label}
              title={label}
              className="rounded-lg border border-text/10 bg-surface/80 p-1.5 text-muted backdrop-blur-sm transition-colors hover:border-text/30 hover:text-text disabled:pointer-events-none disabled:opacity-0"
            >
              <BtnIcon size={14} />
            </button>
          ))}
        </div>

        {/* touch-action:none so a drag pans the map instead of scrolling the page under it. */}
        <svg viewBox={map.viewBox} className="block h-auto w-full cursor-grab touch-none active:cursor-grabbing"
             role="img" aria-label={t.previews.travel.title} {...map.handlers}>
          {COUNTRY_PATHS.map((country) => {
            const order = litOrder.get(country.name);
            const isHome = country.name === HOME;
            const lit = order !== undefined;
            const isPicked = picked !== null && country.name === (MAP_ALIAS[picked] ?? picked);

            return (
              <path
                key={country.name}
                d={country.d}
                fill={lit ? 'rgb(16 185 129)' : isHome ? 'rgb(59 130 246)' : 'rgba(148,163,184,0.14)'}
                stroke={isPicked ? 'rgb(255 255 255)' : 'rgba(148,163,184,0.25)'}
                strokeWidth={isPicked ? 1.6 : 0.4}
                vectorEffect="non-scaling-stroke"
                style={{
                  // Unvisited countries stay flat; only the ones you have been to glow, one
                  // after another along the timeline. A picked country is outlined and glows
                  // harder — and the rest of the map steps back so it reads as the answer.
                  opacity: lit || isHome ? (seen ? 1 : 0.12) : 1,
                  filter: isPicked ? 'drop-shadow(0 0 9px rgb(16 185 129)) drop-shadow(0 0 3px rgb(255 255 255))'
                        : lit && seen ? 'drop-shadow(0 0 4px rgb(16 185 129))'
                        : isHome && seen ? 'drop-shadow(0 0 3px rgb(59 130 246))' : undefined,
                  transition: prefersReducedMotion()
                    ? undefined
                    : 'opacity 500ms ease-out, filter 500ms ease-out, stroke-width 250ms ease-out',
                  transitionDelay: touched ? '0ms' : `${isHome ? 0 : 260 + (order ?? 0) * 320}ms`,
                }}
              />
            );
          })}
        </svg>
      </div>

      <div className="mb-3 flex items-center gap-4 text-xs">
        <span className="font-bold text-text">
          {t.previews.travel.trips.length}{' '}
          <span className="font-medium text-muted">{t.previews.travel.statCountries}</span>
        </span>
        <span className="font-bold text-text" style={{ fontVariantNumeric: 'tabular-nums' }}>
          RM {spent.toLocaleString('en-MY')}{' '}
          <span className="font-medium text-muted">{t.previews.travel.statSpent}</span>
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-muted">
          <span className="h-2 w-2 rounded-full bg-primary" />
          {HOME}
        </span>
      </div>

      <ul className="space-y-1">
        {t.previews.travel.trips.map((trip, i) => {
          const isPicked = picked === trip.country;
          return (
            <li
              key={trip.country}
              className="transition-all duration-500"
              style={{
                opacity: seen ? 1 : 0,
                transform: seen ? 'none' : 'translateY(6px)',
                transitionDelay: touched ? '0ms' : `${300 + i * 320}ms`,
              }}
            >
              <button
                type="button"
                onClick={() => pick(trip.country)}
                aria-pressed={isPicked}
                className={`flex w-full min-w-0 items-center gap-3 rounded-xl border px-2.5 py-1.5 text-left transition-colors ${
                  isPicked
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-transparent hover:border-text/10 hover:bg-text/[0.04]'
                }`}
              >
                <span className="shrink-0 text-base">{trip.flag}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{trip.country}</p>
                  <p className="truncate text-[11px] text-muted">{trip.note}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block text-sm font-semibold text-text"
                        style={{ fontVariantNumeric: 'tabular-nums' }}>
                    RM {trip.budget.toLocaleString('en-MY')}
                  </span>
                  <span className="block text-[11px] text-muted">{trip.meta}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// ---------------------------------------------------------------- my books

const BOOK_STATUS: Record<string, string> = {
  reading: 'bg-violet-500/15 text-violet-500',
  completed: 'bg-emerald-500/15 text-emerald-500',
  wishlist: 'bg-rose-500/15 text-rose-500',
};

const BookPreview: React.FC = () => {
  const { t } = useCopy();
  const [ref, seen] = useInView<HTMLDivElement>();
  const b = t.previews.book;

  return (
    <div ref={ref}>
      <div className="mb-4 flex items-baseline gap-4 text-xs">
        <span className="font-bold text-text" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {b.yearBooks} <span className="font-medium text-muted">{b.statBooks}</span>
        </span>
        <span className="font-bold text-text" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {b.yearPages.toLocaleString('en-MY')} <span className="font-medium text-muted">{b.statPages}</span>
        </span>
      </div>

      <ul className="space-y-3">
        {b.books.map((book, i) => {
          const pct = Math.round((book.page / book.total) * 100);
          return (
            <li
              key={book.title}
              className="flex min-w-0 gap-3 transition-all duration-500"
              style={{
                opacity: seen ? 1 : 0,
                transform: seen ? 'none' : 'translateY(6px)',
                transitionDelay: `${i * 130}ms`,
              }}
            >
              <span className="flex h-10 w-8 shrink-0 items-center justify-center rounded-md bg-text/[0.06] text-lg">
                {book.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{book.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${BOOK_STATUS[book.status]}`}>
                    {b.statusLabels[book.status as keyof typeof b.statusLabels]}
                  </span>
                </div>
                <p className="truncate text-[11px] text-muted">{book.author}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-text/10">
                    <div
                      className={`h-full rounded-full ${book.status === 'completed' ? 'bg-emerald-500' : 'bg-violet-500'}`}
                      style={{
                        width: seen ? `${pct}%` : '0%',
                        transition: prefersReducedMotion() ? undefined : 'width 1100ms ease-out',
                        transitionDelay: `${i * 130 + 200}ms`,
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-[10px] text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {book.page}/{book.total}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div
        className="mt-4 rounded-2xl border border-text/10 bg-text/[0.03] p-3.5 transition-all duration-500"
        style={{ opacity: seen ? 1 : 0, transitionDelay: '520ms' }}
      >
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
          <Quote size={11} /> {b.quoteLabel}
        </p>
        <p className="mt-1.5 text-sm italic leading-snug text-text">“{b.quote}”</p>
        <p className="mt-1 text-[11px] text-muted">{b.quoteMeta}</p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- asset & warranty

const ASSET_ICONS: Record<string, React.ElementType> = {
  electronics: Laptop, appliances: Zap, furniture: Sofa,
};

// The tool's own three warranty states.
const WARRANTY_TONES: Record<string, { pill: string; bar: string }> = {
  emerald: { pill: 'bg-emerald-500/15 text-emerald-500', bar: 'bg-emerald-500' },
  orange: { pill: 'bg-orange-500/15 text-orange-500', bar: 'bg-orange-500' },
  rose: { pill: 'bg-rose-500/15 text-rose-500', bar: 'bg-rose-500' },
};

const WarrantyPreview: React.FC = () => {
  const { t } = useCopy();
  const [ref, seen] = useInView<HTMLDivElement>();
  const w = t.previews.warranty;

  return (
    <div ref={ref}>
      <div className="mb-4 text-xs">
        <span className="text-lg font-extrabold text-text" style={{ fontVariantNumeric: 'tabular-nums' }}>
          RM {w.covered.toLocaleString('en-MY')}
        </span>{' '}
        <span className="text-muted">{w.statCovered}</span>
      </div>

      <ul className="space-y-3">
        {w.items.map((item, i) => {
          const Icon = ASSET_ICONS[item.icon];
          const tone = WARRANTY_TONES[item.tone];
          return (
            <li
              key={item.name}
              className="flex min-w-0 gap-3 transition-all duration-500"
              style={{
                opacity: seen ? 1 : 0,
                transform: seen ? 'none' : 'translateY(6px)',
                transitionDelay: `${i * 130}ms`,
              }}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.pill}`}>
                <Icon size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{item.name}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.pill}`}>
                    {item.status}
                  </span>
                </div>
                <p className="truncate text-[11px] text-muted">
                  {item.category} · RM {item.price.toLocaleString('en-MY')}
                </p>
                {/* How much of the warranty period is already spent. */}
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-text/10">
                  <div
                    className={`h-full rounded-full ${tone.bar}`}
                    style={{
                      width: seen ? `${item.elapsed}%` : '0%',
                      transition: prefersReducedMotion() ? undefined : 'width 1100ms ease-out',
                      transitionDelay: `${i * 130 + 200}ms`,
                    }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// ---------------------------------------------------------------- catat hutang

const DebtPreview: React.FC = () => {
  const { t } = useCopy();
  const [ref, seen] = useInView<HTMLDivElement>();
  const d = t.previews.debt;

  // Ticking a row here works the way it does in the tool: the record stays, it just stops
  // counting. Keyed by name so the toggles survive a language switch.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isSettled = (iou: { name: string; settled: boolean }) => toggled[iou.name] ?? iou.settled;

  return (
    <div ref={ref}>
      {/* The two directions sit side by side rather than interleaved — which way a debt runs is
          the first thing you want to know, so it becomes the column instead of a colour to read. */}
      <div className="grid grid-cols-2 gap-3">
        {([
          [d.owedToMeLabel, true, 'emerald'],
          [d.iOweLabel, false, 'rose'],
        ] as const).map(([label, owedToMe, hue], col) => {
          const rows = d.ious.filter((iou) => iou.owedToMe === owedToMe);
          const subtotal = rows.reduce((sum, iou) => (isSettled(iou) ? sum : sum + iou.amount), 0);
          const tint = hue === 'emerald' ? 'text-emerald-500' : 'text-rose-500';
          const edge = hue === 'emerald' ? 'border-emerald-500/25' : 'border-rose-500/25';

          return (
            <div key={label} className={`min-w-0 rounded-2xl border ${edge} bg-text/[0.02] p-3`}>
              <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
              <p className={`mt-1 text-lg font-extrabold leading-none ${tint}`}
                 style={{ fontVariantNumeric: 'tabular-nums' }}>
                {owedToMe ? '+' : '−'}RM {subtotal}
              </p>

              <ul className="mt-3 space-y-2">
                {rows.map((iou, i) => {
                  const settled = isSettled(iou);
                  return (
                    <li
                      key={iou.name}
                      className="min-w-0 transition-all duration-500"
                      style={{
                        opacity: seen ? 1 : 0,
                        transform: seen ? 'none' : 'translateY(6px)',
                        transitionDelay: `${col * 90 + i * 110}ms`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setToggled((prev) => ({ ...prev, [iou.name]: !settled }))}
                        aria-pressed={settled}
                        className={`w-full rounded-lg px-1 py-0.5 text-left transition-all hover:bg-text/[0.05] ${
                          settled ? 'opacity-45' : ''
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          {settled
                            ? <CheckSquare size={13} className="shrink-0 text-indigo-500" />
                            : <Square size={13} className="shrink-0 text-muted/40" />}
                          <span className={`min-w-0 flex-1 truncate text-[13px] font-semibold ${
                            settled ? 'text-muted line-through' : 'text-text'
                          }`}>
                            {iou.name}
                          </span>
                          <span className={`shrink-0 text-[13px] font-bold ${settled ? 'text-muted' : tint}`}
                                style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {iou.amount}
                          </span>
                        </span>
                        <span className="block truncate pl-[19px] text-[10px] text-muted">{iou.note}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- action needed (home screen)

// The same tints the Home screen gives each alert type, including its coloured glow — this strip
// is the app's own, not a restyled version of it.
const ALERT_TONES = {
  document: {
    Icon: ShieldAlert, tint: 'text-yellow-500', fill: 'bg-yellow-500/10',
    wrap: 'border-yellow-500/30 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.12)]',
  },
  service: {
    Icon: CarFront, tint: 'text-amber-500', fill: 'bg-amber-500/10',
    wrap: 'border-amber-500/30 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]',
  },
  habit: {
    Icon: ListChecks, tint: 'text-violet-500', fill: 'bg-violet-500/10',
    wrap: 'border-violet-500/30 bg-violet-500/10 shadow-[0_0_15px_rgba(139,92,246,0.15)]',
  },
  warranty: {
    Icon: Box, tint: 'text-orange-500', fill: 'bg-orange-500/10',
    wrap: 'border-orange-500/30 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.15)]',
  },
};

const AlertsPreview: React.FC = () => {
  const { t } = useCopy();
  const [ref, seen] = useInView<HTMLDivElement>();
  const { stripTitle, items } = t.previews.alerts;

  return (
    <div ref={ref}>
      <div className="mb-3 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <Bell size={17} className="animate-pulse text-yellow-500" />
          <span className="text-sm font-bold text-text">
            {stripTitle} <span className="ml-0.5 text-xs font-normal text-muted">({items.length})</span>
          </span>
        </div>
        <ChevronUp size={16} className="text-muted" />
      </div>

      <div className="space-y-2.5">
        {items.map((item, i) => {
          const tone = ALERT_TONES[item.kind as keyof typeof ALERT_TONES];
          const percent = 'percent' in item ? item.percent : undefined;
          return (
            <div
              key={item.title}
              className={`relative overflow-hidden rounded-2xl border p-3.5 transition-all duration-500 ${tone.wrap}`}
              style={{
                opacity: seen ? 1 : 0,
                transform: seen ? 'none' : 'translateY(8px)',
                transitionDelay: `${i * 130}ms`,
              }}
            >
              {/* Progress-shaped alerts fill from the left, the way the Home screen draws them. */}
              {percent !== undefined && (
                <div
                  className={`absolute inset-y-0 left-0 ${tone.fill}`}
                  style={{
                    width: seen ? `${percent}%` : '0%',
                    transition: prefersReducedMotion() ? undefined : 'width 1200ms ease-out',
                    transitionDelay: `${i * 130 + 200}ms`,
                  }}
                />
              )}
              <div className="relative">
                <div className="flex items-center gap-2">
                  <tone.Icon size={18} className={tone.tint} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text/60">{item.label}</span>
                </div>
                <p className="mt-2 truncate text-[13px] font-bold leading-tight text-text">{item.title}</p>
                <p className={`mt-1 text-[11px] font-medium leading-none ${tone.tint}`}>{item.status}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- section

const ToolPreviews: React.FC = () => {
  const { t } = useCopy();

  // `label`/`open` default to the tool wording; the last one is the app's home screen rather
  // than a tool, so it overrides both.
  const modules: {
    Icon: React.ElementType;
    to: string;
    copy: { title: string; lede: string; blurb: string; points: string[] };
    glow: string;
    body: React.ReactNode;
    label?: string;
    open?: string;
  }[] = [
    { Icon: ShieldAlert, to: '/document-expiry', copy: t.previews.doc, glow: 'from-red-500/30 to-amber-500/15', body: <DocumentPreview /> },
    { Icon: Gift, to: '/duit-raya', copy: t.previews.raya, glow: 'from-emerald-500/30 to-primary/15', body: <RayaPreview /> },
    { Icon: CarFront, to: '/vehicle-services', copy: t.previews.service, glow: 'from-primary/30 to-cyan-500/15', body: <ServicePreview /> },
    { Icon: ListChecks, to: '/habit-tracker', copy: t.previews.habit, glow: 'from-violet-500/30 to-fuchsia-500/15', body: <HabitPreview /> },
    { Icon: Plane, to: '/travel-history', copy: t.previews.travel, glow: 'from-accent/30 to-emerald-500/15', body: <TravelPreview /> },
    { Icon: BookOpen, to: '/book-tracker', copy: t.previews.book, glow: 'from-violet-500/30 to-amber-500/15', body: <BookPreview /> },
    { Icon: Box, to: '/asset-warranty', copy: t.previews.warranty, glow: 'from-orange-500/30 to-amber-500/15', body: <WarrantyPreview /> },
    { Icon: HandCoins, to: '/debt-tracker', copy: t.previews.debt, glow: 'from-indigo-500/30 to-rose-500/15', body: <DebtPreview /> },
    {
      Icon: Bell, to: '/app', copy: t.previews.alerts, glow: 'from-yellow-500/30 to-orange-500/15',
      body: <AlertsPreview />, label: t.previews.alerts.label, open: t.previews.alerts.open,
    },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
      <Reveal>
        <div className="max-w-2xl">
          <h2 className="font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">
            {t.previews.heading}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">{t.previews.body}</p>
        </div>
      </Reveal>

      <div className="mt-14 space-y-20 lg:mt-20 lg:space-y-28">
        {modules.map(({ Icon, to, copy, glow, body, label, open }, i) => {
          // Alternate which side the record sits on, so five modules in a row don't read as a
          // list. Only from lg — stacked, the explanation always comes first.
          const flipped = i % 2 === 1;
          return (
            <Reveal key={copy.title}>
              <div className="grid items-center gap-9 lg:grid-cols-2 lg:gap-16">
                <div className={flipped ? 'lg:order-2' : ''}>
                  <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                    <span className="text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="h-px w-6 bg-text/20" />
                    {label ?? t.previews.moduleLabel} · {copy.title}
                  </p>
                  <h3 className="mt-4 font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl">
                    {copy.lede}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-muted">{copy.blurb}</p>
                  <ul className="mt-6 space-y-2.5">
                    {copy.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-sm leading-snug">
                        <Check size={16} className="mt-0.5 shrink-0 text-primary" />
                        <span className="text-muted">{point}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={to}
                    className="group mt-7 inline-flex items-center gap-1.5 text-sm font-bold transition-colors hover:text-primary"
                  >
                    {open ?? t.previews.open}
                    <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </div>

                {/* The record itself, lifted off the page by a glow tinted to the tool. */}
                <div className={`relative min-w-0 ${flipped ? 'lg:order-1' : ''}`}>
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute -inset-5 rounded-[3rem] bg-gradient-to-br ${glow} blur-2xl sm:-inset-8 sm:blur-3xl`}
                  />
                  <div className="relative">
                    <Frame Icon={Icon} title={copy.title} to={to}>{body}</Frame>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
};

export default ToolPreviews;
