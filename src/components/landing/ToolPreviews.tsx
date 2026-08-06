import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Gift, CarFront, ListChecks, Plane, ArrowUpRight, Flame } from 'lucide-react';
import Reveal from './Reveal';
import { useCopy } from './copy';
import {
  habitWeeks, weekStreak, activeWeeks, rayaTotals,
  daysTone, TONE_CLASSES, YEAR_WEEKS,
} from './previews';
import { COUNTRY_PATHS, MAP_ALIAS, viewBoxFor } from '../../lib/worldMap';

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

const Frame: React.FC<{
  Icon: React.ElementType; title: string; to: string; children: React.ReactNode;
}> = ({ Icon, title, to, children }) => (
  <Link
    to={to}
    className="group flex h-full flex-col overflow-hidden rounded-3xl border border-text/10 bg-surface/50 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-text/25 hover:shadow-2xl hover:shadow-black/25"
  >
    <div className="flex items-center gap-2.5 border-b border-text/10 bg-text/[0.03] px-5 py-3.5">
      <Icon size={16} className="text-primary transition-transform duration-300 group-hover:scale-110" />
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{title}</span>
      <ArrowUpRight
        size={15}
        className="ml-auto text-muted/30 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-text"
      />
    </div>
    <div className="flex-1 p-5">{children}</div>
  </Link>
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

  return (
    <div ref={ref} className="space-y-4">
      {t.previews.habit.habits.map((habit, h) => {
        const weeks = habitWeeks(habit.seed, habit.strength);
        const hue = HABIT_HUES[h % HABIT_HUES.length];
        const shade = (v: number) =>
          v === 0 ? 'bg-text/[0.07]' : v === 1 ? hue.dim : v === 2 ? hue.mid : hue.on;

        return (
          <div key={habit.name} className="min-w-0">
            <div className="mb-1.5 flex items-baseline gap-2">
              <span className="shrink-0 text-sm">{habit.emoji}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{habit.name}</span>
              <span className={`flex shrink-0 items-center gap-1 text-xs font-bold ${hue.text}`}>
                <Flame size={12} />
                {weekStreak(weeks)}
              </span>
            </div>

            {/* Fractional columns, so the year always fits its container instead of forcing a
                fixed pixel width that would push the card off a phone screen. */}
            <div
              className="grid gap-[2px]"
              style={{ gridTemplateColumns: `repeat(${YEAR_WEEKS}, minmax(0, 1fr))` }}
            >
              {weeks.map((value, i) => (
                <span
                  key={i}
                  className={`h-3 rounded-[2px] ${shade(value)}`}
                  style={{
                    opacity: seen ? 1 : 0,
                    transition: prefersReducedMotion() ? undefined : 'opacity 350ms ease-out',
                    transitionDelay: `${h * 160 + i * 10}ms`,
                  }}
                />
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

const TravelPreview: React.FC = () => {
  const { t } = useCopy();
  const [ref, seen] = useInView<HTMLDivElement>();

  // Trip order is the timeline order, so each country lights in the order you visited it.
  const litOrder = new Map<string, number>();
  t.previews.travel.trips.forEach((trip, i) => {
    litOrder.set(MAP_ALIAS[trip.country] ?? trip.country, i);
  });

  const spent = t.previews.travel.trips.reduce((sum, trip) => sum + trip.budget, 0);
  // Frame on where you have actually been, rather than showing an empty Atlantic.
  const viewBox = viewBoxFor([HOME, ...t.previews.travel.trips.map((trip) => trip.country)]);

  return (
    <div ref={ref} className="min-w-0">
      {/* The same projection the Travel History tool draws, from the same shared module —
          so this is the real map, not an impression of one. */}
      <div className="-mx-1 mb-4 overflow-hidden rounded-2xl border border-text/10 bg-text/[0.03]">
        <svg viewBox={viewBox} className="block h-auto w-full" role="img"
             aria-label={t.previews.travel.title}>
          {COUNTRY_PATHS.map((country) => {
            const order = litOrder.get(country.name);
            const isHome = country.name === HOME;
            const lit = order !== undefined;

            return (
              <path
                key={country.name}
                d={country.d}
                fill={lit ? 'rgb(16 185 129)' : isHome ? 'rgb(59 130 246)' : 'rgba(148,163,184,0.14)'}
                stroke="rgba(148,163,184,0.25)"
                strokeWidth={0.4}
                vectorEffect="non-scaling-stroke"
                style={{
                  // Unvisited countries stay flat; only the ones you have been to glow, one
                  // after another along the timeline.
                  opacity: lit || isHome ? (seen ? 1 : 0.12) : 1,
                  filter: lit && seen ? 'drop-shadow(0 0 4px rgb(16 185 129))'
                        : isHome && seen ? 'drop-shadow(0 0 3px rgb(59 130 246))' : undefined,
                  transition: prefersReducedMotion()
                    ? undefined
                    : 'opacity 500ms ease-out, filter 500ms ease-out',
                  transitionDelay: `${isHome ? 0 : 260 + (order ?? 0) * 320}ms`,
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

      <ul className="space-y-2">
        {t.previews.travel.trips.map((trip, i) => (
          <li
            key={trip.country}
            className="flex min-w-0 items-center gap-3 transition-all duration-500"
            style={{
              opacity: seen ? 1 : 0,
              transform: seen ? 'none' : 'translateY(6px)',
              transitionDelay: `${300 + i * 320}ms`,
            }}
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
          </li>
        ))}
      </ul>
    </div>
  );
};

// ---------------------------------------------------------------- section

const ToolPreviews: React.FC = () => {
  const { t } = useCopy();

  const cards = [
    { Icon: ShieldAlert, title: t.previews.doc.title, to: '/document-expiry', body: <DocumentPreview /> },
    { Icon: Gift, title: t.previews.raya.title, to: '/duit-raya', body: <RayaPreview /> },
    { Icon: CarFront, title: t.previews.service.title, to: '/vehicle-services', body: <ServicePreview /> },
    { Icon: ListChecks, title: t.previews.habit.title, to: '/habit-tracker', body: <HabitPreview /> },
    { Icon: Plane, title: t.previews.travel.title, to: '/travel-history', body: <TravelPreview /> },
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

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {cards.map(({ Icon, title, to, body }, i) => (
          <Reveal key={title} delay={i * 80} className="min-w-0">
            <Frame Icon={Icon} title={title} to={to}>{body}</Frame>
          </Reveal>
        ))}
      </div>
    </section>
  );
};

export default ToolPreviews;
