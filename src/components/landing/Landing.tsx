import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, WifiOff, ShieldCheck, Smartphone, Sun, Moon } from 'lucide-react';
import ExpiryWall from './ExpiryWall';
import ToolSections from './ToolSections';
import ToolPreviews from './ToolPreviews';
import Reveal from './Reveal';
import { DEFAULT_TOOLS } from '../../lib/tools';
import { getUser, subscribe, type User } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { useCopy } from './copy';

// text-white is theme-swapped in this app (it resolves to slate-900 in light mode), so text
// sitting on the blue CTA has to be a literal white.
const ON_PRIMARY = 'text-[#ffffff]';

const PROMISE_ICONS = [WifiOff, ShieldCheck, Smartphone];

// The colour key doubles as the page's explanation of its own visual language.
const SCALE_COLOURS = [
  { dot: 'bg-emerald-500', text: 'text-emerald-500' },
  { dot: 'bg-amber-500', text: 'text-amber-500' },
  { dot: 'bg-red-500', text: 'text-red-500' },
];

const Landing: React.FC = () => {
  const [user, setUser] = useState<User | null>(getUser());
  const [isLight, toggleTheme] = useTheme();
  const { lang, t, setLang } = useCopy();
  const navigate = useNavigate();

  // main.tsx's bootstrap() already resolves the session before first paint, so subscribing is
  // enough — no second /api/me call just to decide the CTA wording.
  useEffect(() => subscribe(setUser), []);

  // Installs made before start_url moved to /app still launch here. Nobody who already has the
  // app on their home screen should be shown an ad for it.
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) navigate('/app', { replace: true });
  }, [navigate]);

  const cta = user ? t.hero.ctaUser : t.hero.ctaGuest;
  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-text">
      {/* Layered atmosphere: a faint ruled grid for the forms-and-documents subject, plus two
          soft glows so large screens aren't a flat field. Decorative only. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(rgb(var(--color-text) / 0.045) 1px, transparent 1px),'
              + 'linear-gradient(90deg, rgb(var(--color-text) / 0.045) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 90% 60% at 50% 0%, #000 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 60% at 50% 0%, #000 40%, transparent 100%)',
          }}
        />
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute left-[-15%] top-[45%] h-[420px] w-[420px] rounded-full bg-accent/10 blur-[130px]" />
      </div>

      <div className="relative z-10">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.png" alt="" className="h-8 w-8 object-contain" />
            <span className="font-display text-lg font-extrabold tracking-tight">
              Senang
              <span className="bg-gradient-to-r from-pink-500 to-orange-400 bg-clip-text text-transparent">Kit</span>
            </span>
            <span className="hidden rounded border border-text/20 bg-text/5 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.18em] sm:inline">
              .MY
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-text/15 p-0.5" role="group" aria-label="Bahasa / Language">
              {(['ms', 'en'] as const).map((code) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={`rounded-[0.6rem] px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                    lang === code ? 'bg-text/10 text-text' : 'text-muted hover:text-text'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
            <button
              onClick={toggleTheme}
              className="rounded-xl border border-text/15 p-2.5 text-muted transition-colors hover:border-text/40 hover:text-text"
              aria-label={t.nav.theme(isLight)}
              title={t.nav.theme(isLight)}
            >
              {isLight ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            {/* Hidden on phones: the logo, language toggle and theme button already fill a 360px
                header, and the hero CTA sits right underneath. */}
            <Link
              to="/app"
              className="hidden rounded-xl border border-text/15 px-4 py-2 text-sm font-semibold transition-colors hover:border-text/40 hover:bg-text/5 sm:inline-block"
            >
              {t.nav.openApp}
            </Link>
          </div>
        </header>

        {/* ---------------------------------------------------------------- hero */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-14 pt-4 sm:px-8 sm:pt-10 lg:pb-24 lg:pt-16">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-16">
            <div>
              {/* The headline takes the top of the page — nothing above it to read past. Load
                  stagger runs headline, body, chips, then buttons.

                  clamp() rather than a breakpoint step: the longest line is two words, and at a
                  fixed 3.25rem it overflows a 360px phone in English. */}
              <h1
                className="font-display font-extrabold leading-[0.92] tracking-[-0.03em]"
                style={{ fontSize: 'clamp(2.6rem, 1.2rem + 8vw, 5.25rem)' }}
              >
                {t.hero.headline.map((line, i) => (
                  <span key={line} className="block overflow-hidden pb-[0.06em]">
                    <span
                      className="block"
                      style={{
                        animation: reduceMotion
                          ? undefined
                          : `headline-rise 900ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 110}ms both`,
                      }}
                    >
                      {i === t.hero.headline.length - 1
                        ? <span className="text-primary">{line}</span>
                        : line}
                    </span>
                  </span>
                ))}
              </h1>

              <Reveal delay={160}>
                <p className="mt-7 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                  {t.hero.bodyBefore}
                  <span className="font-semibold text-text">{t.hero.bodyEmphasis}</span>
                  {t.hero.bodyAfter}
                </p>
              </Reveal>

              {/* One chip per record type. As a single dot-separated line this wrapped into a
                  ragged three-line block on a phone; as chips it wraps into tidy rows. */}
              <Reveal delay={220}>
                <ul className="mt-7 flex flex-wrap gap-2">
                  {t.hero.chips.map((chip) => (
                    <li
                      key={chip}
                      className="inline-flex items-center gap-1.5 rounded-full border border-text/12 bg-surface/50 py-1.5 pl-2.5 pr-3 text-[12px] font-semibold text-muted backdrop-blur-sm sm:text-[13px]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                      {chip}
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal delay={300}>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    to="/app"
                    className={`group inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-4 text-base font-bold shadow-xl shadow-primary/25 transition-all hover:shadow-2xl hover:shadow-primary/35 active:scale-95 ${ON_PRIMARY}`}
                  >
                    {cta}
                    <ArrowRight size={19} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                  <a
                    href="#tools"
                    className="inline-flex items-center justify-center rounded-2xl border border-text/15 px-7 py-4 text-base font-semibold transition-colors hover:border-text/40 hover:bg-text/5"
                  >
                    {t.hero.secondary(DEFAULT_TOOLS.length)}
                  </a>
                </div>
                <p className="mt-4 text-xs text-muted">
                  {t.hero.note}
                </p>
              </Reveal>
            </div>

            {/* On mobile the wall follows the copy; on desktop it sits beside it. */}
            <Reveal delay={320} className="lg:pl-4">
              <ExpiryWall />
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start">
                {t.scale.map((step, i) => (
                  <span key={step.label} className="flex items-center gap-2 text-xs">
                    <span className={`h-2 w-2 rounded-full ${SCALE_COLOURS[i].dot}`} />
                    <span className={`font-semibold ${SCALE_COLOURS[i].text}`}>{step.label}</span>
                    <span className="text-muted">{step.hint}</span>
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <ToolPreviews />

        <ToolSections />

        {/* ---------------------------------------------------------------- promises */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {t.promises.map(({ title, body }, i) => {
              const Icon = PROMISE_ICONS[i];
              return (
              <Reveal key={title} delay={i * 90}>
                <div className="group h-full rounded-3xl border border-text/10 bg-surface/40 p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-text/25 hover:bg-surface/60 sm:p-7">
                  <div className="inline-flex rounded-2xl bg-primary/10 p-3 text-primary transition-transform duration-300 group-hover:scale-110">
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </Reveal>
              );
            })}
          </div>
        </section>

        {/* ---------------------------------------------------------------- closing */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-primary/[0.07] px-6 py-14 text-center sm:px-12 sm:py-20">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    'linear-gradient(rgb(var(--color-primary) / 0.07) 1px, transparent 1px),'
                    + 'linear-gradient(90deg, rgb(var(--color-primary) / 0.07) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }}
              />
              <div className="relative">
                <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                  {t.closing.heading[0]}
                  <br className="sm:hidden" /> {t.closing.heading[1]}
                </h2>
                <p className="mx-auto mt-4 max-w-md text-muted">
                  {t.closing.body}
                </p>
                <Link
                  to="/app"
                  className={`group mt-9 inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-4 text-base font-bold shadow-xl shadow-primary/25 transition-all hover:shadow-2xl hover:shadow-primary/35 active:scale-95 ${ON_PRIMARY}`}
                >
                  {cta}
                  <ArrowRight size={19} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        <footer className="mx-auto w-full max-w-6xl border-t border-text/8 px-5 py-8 text-xs text-muted sm:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>{t.footer}</p>
            <Link to="/app" className="font-semibold transition-colors hover:text-text">
              {t.nav.openApp} →
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
