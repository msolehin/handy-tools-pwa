// Pure maths behind the expiry wall, kept out of the .tsx so it can be tested directly —
// Node's type stripping runs .ts but not JSX.

// Days are the same in both languages; only the labels come from copy.ts.
export const DAYS = [3, 12, 48, 91, 210];

const MAX_DAYS = 210;
const START_OFFSET = 210; // how far above its real value each count begins

export const urgency = (days: number) =>
  days <= 7
    ? { text: 'text-red-500', bar: 'bg-red-500' }
    : days <= 60
      ? { text: 'text-amber-500', bar: 'bg-amber-500' }
      : { text: 'text-emerald-500', bar: 'bg-emerald-500' };

/** Where one row sits at a given point in the intro. */
export function rowState(progress: number, index: number, days: number) {
  const local = Math.max(0, Math.min(1, (progress - index * 0.07) / 0.62));
  return {
    local,
    shown: Math.round(days + (1 - local) * START_OFFSET),
    opacity: 0.35 + local * 0.65,
    fill: local > 0.2 ? (days / MAX_DAYS) * 100 : 100,
  };
}
