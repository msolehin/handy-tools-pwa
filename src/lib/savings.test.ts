import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AMOUNT_ORIGIN, scheduledFor, paidFor, commitmentPaidTotal, goalSaved,
  type CommitmentLike,
} from './savings.ts';

const commit = (over: Partial<CommitmentLike> = {}): CommitmentLike =>
  ({ id: 'c1', amount: 1200, payments: {}, ...over });

// A forward-only change, as saveCForm writes it: seed the origin on the first one so the months
// before it keep the old figure.
const raise = (c: CommitmentLike, amount: number, from: string): CommitmentLike =>
  ({ ...c, amount, amounts: { ...(c.amounts ?? { [AMOUNT_ORIGIN]: c.amount }), [from]: amount } });

test('a commitment with no history reads its current amount in every month', () => {
  const c = commit();
  assert.equal(scheduledFor(c, '2020-01'), 1200);
  assert.equal(scheduledFor(c, '2030-12'), 1200);
});

test('raising the rent leaves the months before it alone', () => {
  const c = raise(commit(), 1400, '2026-08');
  assert.equal(scheduledFor(c, '2026-05'), 1200, 'a month before the raise');
  assert.equal(scheduledFor(c, '2026-07'), 1200, 'the month right before it');
  assert.equal(scheduledFor(c, '2026-08'), 1400, 'the month it takes effect');
  assert.equal(scheduledFor(c, '2026-11'), 1400, 'and after');
});

test('successive raises each apply from their own month', () => {
  const c = raise(raise(commit(), 1400, '2026-08'), 1500, '2026-10');
  assert.equal(scheduledFor(c, '2026-01'), 1200);
  assert.equal(scheduledFor(c, '2026-09'), 1400, 'between the two');
  assert.equal(scheduledFor(c, '2026-10'), 1500);
});

test('correcting a typo everywhere drops the history, so every month reads the new figure', () => {
  const { amounts, ...corrected } = raise(commit(), 1500, '2026-08');
  assert.equal(amounts && Object.keys(amounts).length, 2);
  assert.equal(scheduledFor(corrected as CommitmentLike, '2020-01'), 1500);
});

test('a recorded payment beats the schedule, and an unrecorded month falls back to it', () => {
  const c = raise(commit({ amount: 180, payments: { '2026-08': '2026-08-05' } }), 200, '2026-09');
  const paid = { ...c, paidAmounts: { '2026-08': 243.55 } };
  assert.equal(paidFor(paid, '2026-08'), 243.55, 'the bill that actually came in');
  assert.equal(paidFor(paid, '2026-07'), 180, 'no record, so the plan of its time');
  assert.equal(paidFor(paid, '2026-09'), 200, 'after the raise');
});

test('the paid total counts every month on record, at what each one cost', () => {
  const c = commit({
    amount: 500,
    payments: { '2026-06': '2026-06-01', '2026-07': '2026-07-01', '2026-08': '2026-08-01' },
    paidAmounts: { '2026-07': 480 },
  });
  assert.equal(commitmentPaidTotal(c), 500 + 480 + 500);
});

test('a stopped commitment still counts what it paid before it stopped', () => {
  const c = commit({
    amount: 300, endMonth: '2026-06', goalId: 'g1',
    payments: { '2026-05': '2026-05-02', '2026-06': '2026-06-02' },
  });
  assert.equal(goalSaved('g1', [c], [], []), 600);
});

test('a goal adds up its commitments, its expenses and its top-ups', () => {
  const commitments = [
    commit({ id: 'c1', amount: 500, goalId: 'g1', payments: { '2026-07': '2026-07-01', '2026-08': '2026-08-01' } }),
    commit({ id: 'c2', amount: 900, goalId: 'g2', payments: { '2026-08': '2026-08-01' } }),
  ];
  const expenses = [
    { id: 'e1', amount: 300, goalId: 'g1' },
    { id: 'e2', amount: 42, category: 'food' } as { id: string; amount: number; goalId?: string },
  ];
  const topups = [
    { id: 't1', goalId: 'g1', amount: 1000 },
    { id: 't2', goalId: 'g2', amount: 50 },
  ];
  assert.equal(goalSaved('g1', commitments, expenses, topups), 1000 + 300 + 1000);
  assert.equal(goalSaved('g2', commitments, expenses, topups), 900 + 50);
});

test('records pointing at a goal that no longer exists count towards nothing', () => {
  const commitments = [commit({ goalId: 'deleted', amount: 700, payments: { '2026-08': '2026-08-01' } })];
  const topups = [{ id: 't1', goalId: 'deleted', amount: 100 }];
  assert.equal(goalSaved('g1', commitments, [], topups), 0);
  assert.equal(goalSaved('deleted', commitments, [], topups), 800, 'still adds up if it comes back');
});

test('an unlinked commitment never counts, however much it has paid', () => {
  const c = commit({ amount: 999, payments: { '2026-08': '2026-08-01' } });
  assert.equal(goalSaved('g1', [c], [], []), 0);
});
