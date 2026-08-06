// The wall's intro animation once failed to run at all, leaving it at rest on its opening
// frame: dim rows, inflated day counts, every row green. These assert the two states that
// matter — where it ends up, and that it ends up there for everyone.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rowState, urgency, DAYS } from './wall.ts';

describe('expiry wall', () => {
  test('comes to rest on the real day counts, fully opaque', () => {
    DAYS.forEach((days, i) => {
      const { shown, opacity, local } = rowState(1, i, days);
      assert.equal(shown, days, `row ${i} should settle on ${days}`);
      assert.equal(opacity, 1, `row ${i} should finish fully visible`);
      assert.equal(local, 1);
    });
  });

  test('the resting colours span the whole scale, not one flat state', () => {
    const colours = DAYS.map((days) => urgency(rowState(1, 0, days).shown).text);
    assert.equal(new Set(colours).size, 3,
      'the point of the wall is showing urgent, near and comfortable at once');
    assert.equal(colours[0], 'text-red-500', '3 days is urgent');
    assert.equal(colours[2], 'text-amber-500', '48 days is approaching');
    assert.equal(colours[4], 'text-emerald-500', '210 days is comfortable');
  });

  test('the opening frame is dim and inflated — so a stuck animation is obvious', () => {
    const { shown, opacity } = rowState(0, 0, DAYS[0]);
    assert.ok(shown > DAYS[0], 'counts start above their real value and tick down');
    assert.ok(opacity < 0.5, 'and start dim');
  });

  test('rows stagger: earlier rows lead later ones', () => {
    const mid = 0.5;
    const first = rowState(mid, 0, DAYS[0]).local;
    const last = rowState(mid, 4, DAYS[4]).local;
    assert.ok(first > last, 'row 0 should be further along than row 4 mid-animation');
  });

  test('urgency thresholds sit on the documented boundaries', () => {
    assert.equal(urgency(7).text, 'text-red-500');
    assert.equal(urgency(8).text, 'text-amber-500');
    assert.equal(urgency(60).text, 'text-amber-500');
    assert.equal(urgency(61).text, 'text-emerald-500');
  });
});
