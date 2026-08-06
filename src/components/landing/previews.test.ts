// The previews claim to be real app surfaces, so their maths has to match what the tools
// actually compute. A preview that shows an impossible total is worse than no preview.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  habitYear, currentStreak, completedCount, rayaTotals, daysTone, HABIT_CELLS,
  habitWeeks, weekStreak, activeWeeks, YEAR_WEEKS,
} from './previews.ts';

describe('habit year grid', () => {
  test('fills exactly one year of cells', () => {
    assert.equal(habitYear().length, HABIT_CELLS);
    assert.equal(HABIT_CELLS, 371, '53 weeks x 7 days, matching the real tracker grid');
  });

  test('is deterministic — the grid must not reshuffle between renders', () => {
    assert.deepEqual(habitYear(), habitYear());
    assert.notDeepEqual(habitYear(1), habitYear(2), 'but different seeds give different years');
  });

  test('every cell is a valid intensity', () => {
    for (const cell of habitYear()) {
      assert.ok(cell >= 0 && cell <= 3 && Number.isInteger(cell), `bad intensity ${cell}`);
    }
  });

  test('shows a habit being kept, not noise', () => {
    const cells = habitYear();
    const done = completedCount(cells);
    assert.ok(done > HABIT_CELLS * 0.3, 'a sparse grid would look like a failed habit');
    assert.ok(done < HABIT_CELLS * 0.9, 'a full grid would look fake');

    // Weighted towards recent weeks — the point is a habit that stuck.
    const firstQuarter = completedCount(cells.slice(0, HABIT_CELLS / 4));
    const lastQuarter = completedCount(cells.slice(-HABIT_CELLS / 4));
    assert.ok(lastQuarter > firstQuarter, 'recent weeks should be denser than a year ago');
  });

  test('the streak counts back from today and stops at the first gap', () => {
    assert.equal(currentStreak([1, 0, 2, 3, 1]), 3);
    assert.equal(currentStreak([1, 1, 0]), 0, 'a gap today means no streak');
    assert.equal(currentStreak([]), 0);
    assert.equal(currentStreak([2, 2, 2]), 3, 'an unbroken year is all of it');
  });
});

describe('duit raya totals', () => {
  const recipients = [
    { name: 'A', amount: 50, given: true },
    { name: 'B', amount: 20, given: true },
    { name: 'C', amount: 30, given: false },
  ];

  test('counts only what has actually been given', () => {
    const totals = rayaTotals(recipients, 1500);
    assert.equal(totals.given, 70, 'C has not been given yet');
    assert.equal(totals.allocated, 100, 'but C is still allocated');
    assert.equal(totals.remaining, 1430);
    assert.equal(totals.unallocated, 1400);
  });

  test('the progress bar never exceeds full, even when overspent', () => {
    const over = rayaTotals([{ name: 'X', amount: 5000, given: true }], 1500);
    assert.equal(over.percentUsed, 100, 'a bar past 100% would overflow its track');
    assert.ok(over.remaining < 0, 'while the number still shows the real overspend');
  });

  test('a zero budget does not divide by zero', () => {
    assert.equal(rayaTotals(recipients, 0).percentUsed, 0);
  });
});

describe('urgency tone matches the rest of the page', () => {
  test('uses the same thresholds as the expiry wall', () => {
    assert.equal(daysTone(3), 'red');
    assert.equal(daysTone(7), 'red');
    assert.equal(daysTone(8), 'amber');
    assert.equal(daysTone(60), 'amber');
    assert.equal(daysTone(61), 'emerald');
    assert.equal(daysTone(208), 'emerald');
  });
});

describe('per-habit year strips', () => {
  test('each habit is a full year of weeks', () => {
    assert.equal(habitWeeks(11).length, YEAR_WEEKS);
    assert.equal(YEAR_WEEKS, 52);
  });

  test('different habits look different, the same habit never changes', () => {
    assert.deepEqual(habitWeeks(11, 0.9), habitWeeks(11, 0.9));
    assert.notDeepEqual(habitWeeks(11, 0.9), habitWeeks(27, 0.9));
  });

  test('strength orders the three habits, so the card shows a range not three clones', () => {
    const strong = activeWeeks(habitWeeks(11, 0.9));
    const middling = activeWeeks(habitWeeks(27, 0.62));
    const weak = activeWeeks(habitWeeks(43, 0.45));
    assert.ok(strong > middling, 'the kept habit should be densest');
    assert.ok(middling > weak, 'and the neglected one sparsest');
  });

  test('week streak stops at the first missed week', () => {
    assert.equal(weekStreak([1, 0, 2, 3]), 2, 'counts back from the end, the 0 stops it');
    assert.equal(weekStreak([3, 0]), 0, 'a missed current week means no streak');
    assert.equal(weekStreak([1, 1, 1]), 3);
  });
});

