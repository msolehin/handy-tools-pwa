// The money maths behind Expense Manager's commitments and savings goals. Pure and free of React
// so it can be tested directly — node's test runner cannot import the .tsx page.

export interface CommitmentLike {
  id: string;
  amount: number;
  payments: Record<string, string>;      // 'YYYY-MM' -> 'YYYY-MM-DD' it was paid
  paidAmounts?: Record<string, number>;  // what was actually paid that month
  amounts?: Record<string, number>;      // scheduled amount effective from that month
  endMonth?: string;
  goalId?: string;
}

export interface ExpenseLike { id: string; amount: number; goalId?: string; }
export interface TopupLike { id: string; goalId: string; amount: number; }

// Holds the figure from before the first recorded change. Deliberately not a real month: it must
// sort before every genuine 'YYYY-MM', and it is never rendered.
export const AMOUNT_ORIGIN = '0000-01';

/**
 * What the commitment was scheduled at in a given month — the latest change effective on or
 * before it. Without the origin key, a month earlier than the first change would fall through to
 * the current amount, which is exactly the bug this exists to prevent.
 */
export const scheduledFor = (c: CommitmentLike, mk: string): number => {
  if (!c.amounts) return c.amount;
  let best = '';
  for (const k of Object.keys(c.amounts)) if (k <= mk && k > best) best = k;
  return best ? c.amounts[best] : c.amount;
};

/**
 * What the commitment actually cost in a given month. A recorded payment wins; otherwise fall back
 * to what was scheduled then. Records made before amounts were kept therefore read exactly as they
 * always did.
 */
export const paidFor = (c: CommitmentLike, mk: string): number =>
  c.paidAmounts?.[mk] ?? scheduledFor(c, mk);

/** Everything a commitment has actually paid, across every month on record. */
export const commitmentPaidTotal = (c: CommitmentLike): number =>
  Object.keys(c.payments ?? {}).reduce((sum, mk) => sum + paidFor(c, mk), 0);

/**
 * How much a goal holds: every payment made by the commitments feeding it, plus expenses tagged
 * into it, plus manual top-ups. The first two have already left the balance, so nothing is counted
 * twice; a top-up is a tally entry that moves nothing else.
 */
export const goalSaved = (
  goalId: string,
  commitments: CommitmentLike[],
  expenses: ExpenseLike[],
  topups: TopupLike[],
): number =>
  commitments.filter(c => c.goalId === goalId).reduce((s, c) => s + commitmentPaidTotal(c), 0)
  + expenses.filter(e => e.goalId === goalId).reduce((s, e) => s + e.amount, 0)
  + topups.filter(t => t.goalId === goalId).reduce((s, t) => s + t.amount, 0);
