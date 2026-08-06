// Data and maths behind the tool previews. Kept out of the .tsx so it can be tested — Node's
// type stripping runs .ts but not JSX.
//
// The numbers here are illustrative, but every calculation matches what the real tool does,
// so the previews can't drift into showing something the app would never produce.

/** Deterministic pseudo-random, so the year grid looks organic but never changes between renders. */
const seeded = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

export const HABIT_WEEKS = 53;
export const HABIT_CELLS = HABIT_WEEKS * 7;

/** Weeks in the compact per-habit year strip. */
export const YEAR_WEEKS = 52;

/**
 * A year of one habit as weekly intensity 0–3 (how many days that week were ticked, bucketed).
 * One row per habit rather than a full 7-row grid, so three habits fit a card — and it scales
 * with the container instead of forcing a fixed pixel width.
 */
export function habitWeeks(seed: number, strength = 0.6): number[] {
  const rand = seeded(seed);
  return Array.from({ length: YEAR_WEEKS }, (_, i) => {
    const recency = i / YEAR_WEEKS;
    const chance = strength * (0.45 + recency * 0.75);
    const roll = rand();
    if (roll > chance) return 0;
    return 1 + Math.floor(rand() * 3);
  });
}

/** Weeks with at least one tick — what the tracker calls an active week. */
export const activeWeeks = (weeks: number[]) => weeks.filter((w) => w > 0).length;

/** Consecutive active weeks counting back from this one. */
export function weekStreak(weeks: number[]): number {
  let streak = 0;
  for (let i = weeks.length - 1; i >= 0 && weeks[i] > 0; i--) streak++;
  return streak;
}

/**
 * A year of habit ticks as intensity 0–3, matching the real tracker's column-flow grid
 * (7 rows, one column per week). Weighted so recent weeks look stronger — a habit being kept.
 */
export function habitYear(seed = 20260807): number[] {
  const rand = seeded(seed);
  return Array.from({ length: HABIT_CELLS }, (_, i) => {
    const recency = i / HABIT_CELLS;           // 0 = a year ago, 1 = today
    const chance = 0.18 + recency * 0.62;      // the habit sticks over time
    const roll = rand();
    if (roll > chance) return 0;
    return 1 + Math.floor(rand() * 3);
  });
}

/** Consecutive completed days counting back from today — the number the tracker shows. */
export function currentStreak(cells: number[]): number {
  let streak = 0;
  for (let i = cells.length - 1; i >= 0 && cells[i] > 0; i--) streak++;
  return streak;
}

export const completedCount = (cells: number[]) => cells.filter((c) => c > 0).length;

// ---------------------------------------------------------------- duit raya

export type Recipient = { name: string; amount: number; given: boolean };

/** Mirrors DuitRayaManager: given vs budget, and what is still unallocated. */
export function rayaTotals(recipients: Recipient[], budget: number) {
  const given = recipients.filter((r) => r.given).reduce((sum, r) => sum + r.amount, 0);
  const allocated = recipients.reduce((sum, r) => sum + r.amount, 0);
  return {
    given,
    allocated,
    remaining: budget - given,
    unallocated: budget - allocated,
    percentUsed: budget > 0 ? Math.min(100, (given / budget) * 100) : 0,
  };
}

// ---------------------------------------------------------------- shared urgency

/** Same thresholds the expiry wall and the app's alerts use. */
export const daysTone = (days: number) =>
  days <= 7 ? 'red' : days <= 60 ? 'amber' : 'emerald';

export const TONE_CLASSES: Record<string, { text: string; bg: string; border: string }> = {
  red: { text: 'text-red-500', bg: 'bg-red-500', border: 'border-red-500/30' },
  amber: { text: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-500/30' },
  emerald: { text: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-500/25' },
};
