// Shared presentational pieces every Garaj tab (Tasks 9-13) composes from. No tabs, no forms,
// no data loading here — this file receives data and renders it. Everything uses the app's
// theme tokens except Cluster, which is the tool's one deliberate dark surface: it is built
// entirely from literal colours, never a `white`/`black` CSS-variable token, because those
// tokens are what change between the app's two themes and Cluster must not.
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, X } from 'lucide-react';
import {
  currentOdo, economy, costPerKm, statusOf, DOC_LABELS,
  type GarageData, type Vehicle, type Level, type DueItem, type VDoc,
} from '../../lib/garage';
import { kindsFor, unitFor } from '../../lib/garage-presets';
import { useT } from '../../lib/lang';

// This file deliberately exports formatters and colour tables alongside components — Tasks
// 10-13 import the whole module as one shared contract (see the Task 8 brief). react-refresh's
// "component-only file" rule is a dev-mode HMR nicety with no effect on the production build;
// splitting this single, deliberately-unified module to satisfy it would undo the point of the task.
/* eslint-disable react-refresh/only-export-components */

export const EDGE_COLORS = ['#0E5C4A', '#D4451A', '#2C6E9B', '#B87709', '#6B4E9E', '#3F7A3A'];

export const fmtKm = (n: number) => Math.round(n).toLocaleString('en-MY');
export const fmtRM = (n: number) =>
  `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtRM0 = (n: number) => `RM ${Math.round(n || 0).toLocaleString('en-MY')}`;
export const niceDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

export const initialsOf = (v: Vehicle) =>
  (v.nickname || v.model || '?').trim().slice(0, 2).toUpperCase();

/** A small coloured initials badge, keyed off the vehicle's own colorIdx into EDGE_COLORS. */
export const avatarOf = (v: Vehicle, size = 28) => (
  <span
    // Literal hex, not the `white` token: that token flips to dark slate in light mode (see
    // index.css), which is right for elements that sit on the app's own surface but wrong here —
    // this badge's background is a fixed hex from EDGE_COLORS in both themes.
    className="inline-flex items-center justify-center rounded-full font-display font-bold text-[#ffffff] shrink-0"
    style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: EDGE_COLORS[v.colorIdx % EDGE_COLORS.length] }}
  >
    {initialsOf(v)}
  </span>
);

const num = { fontVariantNumeric: 'tabular-nums' } as const;

/**
 * The odometer cluster. Leading zeros are dimmed rather than hidden so the digit count stays
 * fixed and the number does not jump sideways as it rolls over.
 */
export function Cluster({ vehicle, data }: { vehicle: Vehicle; data: GarageData }) {
  const odo = currentOdo(data, vehicle);
  const digits = String(Math.min(odo, 999999)).padStart(6, '0');
  const firstReal = digits.search(/[1-9]/);

  const kinds = kindsFor(vehicle.energy);
  const primary = economy(data, vehicle, kinds[0]);
  const cpk = costPerKm(data, vehicle);
  const lastFill = data.energy
    .filter((e) => e.vehicleId === vehicle.id)
    .sort((a, b) => b.odo - a.odo)[0];
  const since = lastFill ? odo - lastFill.odo : null;
  const verb = kinds[0] === 'charge' ? 'charge' : 'fill';

  return (
    // Every `white`-tinted class below is a literal rgba/hex, never the `white` TOKEN (text-white,
    // bg-white/NN etc.) — that token flips to near-black under html.light (index.css), which would
    // turn this permanently-dark panel unreadable in light mode. The cluster must not react to the
    // theme at all, so nothing in it may resolve through a CSS variable that does.
    <div className="rounded-2xl p-4 text-[#ffffff] shadow-lg"
         style={{ background: 'linear-gradient(168deg,#1F2A27,#131B19 58%)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-[11px] uppercase tracking-[0.22em] text-[rgba(255,255,255,.4)]">
          {vehicle.nickname || vehicle.model} · odometer
        </span>
        {vehicle.plate && (
          <span className="font-display text-[12px] tracking-[0.12em] text-[rgba(255,255,255,.6)] border border-[rgba(255,255,255,.15)] rounded px-2 py-0.5">
            {vehicle.plate}
          </span>
        )}
      </div>

      <div className="flex items-end gap-[3px]">
        {digits.split('').map((d, i) => (
          <React.Fragment key={i}>
            <span className="font-mono text-[31px] font-bold leading-none rounded-[5px] px-1.5 py-2 border border-[rgba(255,255,255,.07)] text-center min-w-[26px]"
                  style={{
                    ...num,
                    background: 'rgba(0,0,0,.42)',
                    color: firstReal === -1 || i < firstReal ? 'rgba(143,233,198,.24)' : '#8FE9C6',
                    textShadow: firstReal === -1 || i < firstReal ? 'none' : '0 0 14px rgba(143,233,198,.4)',
                  }}>{d}</span>
            {i === 2 && <span className="w-1" />}
          </React.Fragment>
        ))}
        <span className="font-display text-[14px] tracking-[0.12em] text-[rgba(255,255,255,.45)] pb-2 ml-1.5">km</span>
      </div>

      <div className="flex gap-px mt-3.5 rounded-lg overflow-hidden bg-[rgba(255,255,255,.08)]">
        {[
          { v: since === null ? '—' : fmtKm(since), l: `km since ${verb}` },
          { v: primary ? primary.rate.toFixed(1) : '—', l: primary ? primary.unit : `km/${unitFor(kinds[0])}` },
          { v: cpk ? cpk.toFixed(2) : '—', l: 'RM per km' },
        ].map((c) => (
          <div key={c.l} className="flex-1 bg-[rgba(255,255,255,.04)] px-2.5 py-2.5">
            <b className="block font-mono text-[16px] font-bold text-[#ffffff]" style={num}>{c.v}</b>
            <span className="block font-display text-[10px] uppercase tracking-[0.13em] text-[rgba(255,255,255,.4)] mt-0.5">{c.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const LEVEL_CLASS: Record<Level, string> = {
  over: 'bg-rose-500/15 text-rose-500',
  soon: 'bg-amber-500/15 text-amber-500',
  ok:   'bg-emerald-500/15 text-emerald-500',
};

export const Pill = ({ level, children }: { level: Level; children: React.ReactNode }) => (
  <span className={`font-display text-[11.5px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full ${LEVEL_CLASS[level]}`}>
    {children}
  </span>
);

export const Eyebrow = ({ children, count }: { children: React.ReactNode; count?: string }) => (
  <div className="flex items-baseline gap-2.5 mt-6 mb-2.5">
    <span className="font-display text-[12px] uppercase tracking-[0.16em] text-muted">{children}</span>
    {count && <span className="text-[12px] tracking-[0.06em] text-muted">{count}</span>}
    <span className="flex-1 h-px bg-text/10" />
  </div>
);

export const Empty = ({ title, hint }: { title: string; hint: string }) => (
  <div className="text-center px-6 py-10">
    <p className="font-display text-[17px] text-muted m-0">{title}</p>
    <small className="text-[13px] text-muted">{hint}</small>
  </div>
);

// Shared across DueRow and DocPair so a document and a reminder colour their status identically —
// same idiom DocumentExpiry.tsx uses: rose/amber/emerald need a darker `light:` partner to clear
// contrast on the light surface.
const LEVEL_BAR: Record<Level, string> = { over: 'bg-rose-500', soon: 'bg-amber-500', ok: 'bg-emerald-500' };
const LEVEL_TEXT: Record<Level, string> = {
  over: 'text-rose-500 light:text-rose-700',
  soon: 'text-amber-500 light:text-amber-700',
  ok:   'text-emerald-500 light:text-emerald-700',
};
const LEVEL_BORDER_T: Record<Level, string> = {
  over: 'border-t-rose-500',
  soon: 'border-t-amber-500',
  ok:   'border-t-emerald-500',
};

/**
 * A row in the due list: a coloured bar for `item.status.level`, the label, the vehicle as a
 * tag (a garage mixes vehicles, so a bare label is ambiguous), the status text (already
 * bilingual — statusOf ran it through t() — so it is rendered as-is), and a tick button that
 * only reminders get: a document's status comes from its expiry date, so there is nothing to
 * "tick" — renewing one is done through its own sheet, not from the due list.
 */
export function DueRow({ item, onOpen, onTick, right }: {
  item: DueItem;
  onOpen: (item: DueItem) => void;
  onTick?: (item: DueItem) => void;
  /** A trailing value — the Docs pane's use of this same row shape for a cost, cf. its own
   *  comment. Reminders never pass this: their trailing slot is the tick button instead. */
  right?: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex items-stretch gap-0 rounded-xl bg-surface border border-text/10 overflow-hidden">
      <span className={`w-1 shrink-0 ${LEVEL_BAR[item.status.level]}`} />
      <button
        onClick={() => onOpen(item)}
        className="flex-1 min-w-0 flex items-center justify-between gap-3 py-3 px-3 text-left min-h-[44px] hover:bg-text/5"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{item.label}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-text/5 text-muted truncate max-w-[9rem]">
              {item.vehicle.nickname || item.vehicle.model}
            </span>
            <span className={`text-[11px] font-semibold ${LEVEL_TEXT[item.status.level]}`}>{item.status.text}</span>
          </div>
        </div>
        {right && <span className="font-mono text-sm font-semibold shrink-0" style={num}>{right}</span>}
      </button>
      {item.kind === 'reminder' && onTick && (
        <button
          onClick={() => onTick(item)}
          aria-label={t('Tanda selesai', 'Mark done')}
          className="shrink-0 w-11 min-h-[44px] flex items-center justify-center text-muted hover:text-emerald-500 border-l border-text/10"
        >
          <Check size={18} />
        </button>
      )}
    </div>
  );
}

/**
 * The generic list row: a title, an optional subtitle, a right-aligned monospace amount, and a
 * chevron when the row is tappable. `amount` is a pre-formatted string rather than a number —
 * this one row backs RM totals (fmtRM), economy figures (km/L) and plain odometer readings
 * alike, and only the caller knows which formatter applies.
 */
export function Row({ title, sub, amount, onClick }: {
  // `sub` takes a node, not just a string: EnergyPane wraps its numeric fragments (the odo
  // reading, the per-leg economy rate) in their own monospace spans, which a plain string
  // couldn't carry. Every existing caller already passes a string, which is a valid node too.
  title: string; sub?: React.ReactNode; amount?: string; onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 py-3 px-3.5 rounded-xl bg-surface border border-text/10 text-left min-h-[44px] ${onClick ? 'hover:bg-text/5 active:scale-[0.99] transition-transform' : ''}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        {sub && <p className="text-xs text-muted truncate mt-0.5">{sub}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {amount && <span className="font-mono text-sm font-semibold" style={num}>{amount}</span>}
        {onClick && <ChevronRight size={16} className="text-muted" />}
      </div>
    </Tag>
  );
}

/**
 * The two document cells every vehicle card shows up front: road tax and insurance, the two
 * that actually stop you driving legally. Each cell borders itself in its own status colour so
 * "about to lapse" reads before the date does.
 */
export function DocPair({ vehicle, data, onOpen }: {
  vehicle: Vehicle;
  data: GarageData;
  onOpen: (type: 'roadtax' | 'insurance', doc?: VDoc) => void;
}) {
  const t = useT();
  const types: ('roadtax' | 'insurance')[] = ['roadtax', 'insurance'];

  return (
    <div className="flex gap-2.5">
      {types.map((type) => {
        const doc = data.docs.find((d) => d.vehicleId === vehicle.id && d.type === type);
        const status = doc ? statusOf({ dueDate: doc.expiry }, data, vehicle) : null;
        return (
          <button
            key={type}
            onClick={() => onOpen(type, doc)}
            className={`flex-1 min-w-0 text-left rounded-xl border-t-4 border-x border-b border-text/10 bg-surface px-3.5 py-3 min-h-[44px] ${status ? LEVEL_BORDER_T[status.level] : 'border-t-text/15'}`}
          >
            <p className="font-display text-[11px] uppercase tracking-[0.1em] text-muted">{t(DOC_LABELS[type].ms, DOC_LABELS[type].en)}</p>
            {doc && status ? (
              <>
                <p className="text-sm font-medium mt-0.5">{niceDate(doc.expiry)}</p>
                <p className={`text-[11px] font-semibold mt-0.5 ${LEVEL_TEXT[status.level]}`}>{status.text}</p>
              </>
            ) : (
              <p className="text-sm text-muted mt-0.5">{t('Belum ditetapkan · Ketik untuk tambah', 'Not set · Tap to add')}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Shared by every add/edit sheet (sheets.tsx, logSheets.tsx) — one copy so a chip and a field
// label look identical whether the form is VehicleSheet's body/energy pair or ReminderSheet's
// mode choice.
export const chip = (active: boolean) =>
  `px-3 py-2 rounded-xl text-sm font-medium border min-h-[44px] transition-colors ${
    active ? 'bg-primary border-primary text-[#ffffff]' : 'bg-surface border-text/15 text-text hover:bg-text/5'
  }`;

export const fieldLabel = 'text-xs font-bold text-muted uppercase tracking-wider';

// Same scheme every other tool in the app uses for a local id (VehicleServices.tsx,
// DebtTracker.tsx, ExpenseManager.tsx, ...) — short and unique enough for one device's own
// records; a uuid dependency buys nothing here.
export const generateId = () => Math.random().toString(36).substring(2, 9);

/**
 * The bottom sheet every add/edit form in Tasks 10-13 wraps its fields in. Reuses the app's one
 * modal system rather than inventing a second: portalled into `document.body` with `fixed
 * inset-0`, the same as every actual dialog in the app (ExpenseManager's showExpense/showGForm,
 * DocumentExpiry's own reusable `sheet()` helper, Countdown, Tenancy...). `#app-frame` +
 * `sm:absolute` is what ExpenseManager's floating add-expense *button* uses to stay confined to
 * the phone-shaped frame — that's a FAB positioning trick, not the dialog pattern, so a dialog
 * here would be a visible seam against every other dialog in the app if it borrowed it.
 *
 * `onSubmit`/`submitLabel` are optional so Sheet also covers a read-only or picker use — most
 * callers will supply both and get a real form with a save button.
 */
export function Sheet({ open, title, sub, vehicle, onClose, onSubmit, submitLabel, extra, children }: {
  open: boolean;
  title: string;
  sub?: string;
  vehicle?: Vehicle;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useT();

  // Escape closes, same as every other sheet in the app (Countdown, DocumentExpiry, Tenancy...).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Focus lands on the panel itself, not lost behind the scrim — the panel has no single "first
  // field" to autofocus since its body is caller-supplied. None of the app's existing modals do
  // this; it's strictly additive on top of the pattern being matched, not a deviation from it.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) panelRef.current?.focus(); }, [open]);

  if (!open) return null;

  const body = onSubmit
    ? (
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {children}
        {/* bg-primary is a fixed blue in both themes (see index.css) — text-[#ffffff] for the
            same reason as avatarOf above, not the theme-flipping `white` token. */}
        <button type="submit" className="w-full py-3 rounded-xl bg-primary text-[#ffffff] font-bold hover:opacity-90 min-h-[44px]">
          {submitLabel ?? t('Simpan', 'Save')}
        </button>
      </form>
    )
    : <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>;

  return createPortal((
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-text/10 bg-surface animate-slide-up motion-reduce:animate-none flex flex-col max-h-[88dvh] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-text/10 shrink-0">
          <div className="min-w-0 flex items-center gap-2.5">
            {vehicle && avatarOf(vehicle, 32)}
            <div className="min-w-0">
              <h2 className="font-bold text-lg leading-tight truncate">{title}</h2>
              {sub && <p className="text-xs text-muted mt-0.5 truncate">{sub}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {extra}
            <button onClick={onClose} aria-label={t('Tutup', 'Close')} className="p-1.5 text-muted hover:text-text min-w-[44px] min-h-[44px] flex items-center justify-center">
              <X size={20} />
            </button>
          </div>
        </div>
        {body}
      </div>
    </div>
  ), document.body);
}
