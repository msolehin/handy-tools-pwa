// A country in the picker that the map can't fly to is a dead end: the user taps its chip on
// the dashboard and nothing happens. Every name we ship must resolve to an outline or a pin.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES, flagOf } from './countries.ts';
import { mapTarget, countryPath, SMALL_COUNTRY_POINTS, MAP_W, MAP_H } from './worldMap.ts';

describe('countries', () => {
  test('covers every UN member state', () => {
    assert.ok(COUNTRIES.length >= 195, `only ${COUNTRIES.length} countries listed`);
  });

  test('has no duplicate names or codes', () => {
    assert.equal(new Set(COUNTRIES.map((c) => c.name)).size, COUNTRIES.length);
    assert.equal(new Set(COUNTRIES.map((c) => c.code)).size, COUNTRIES.length);
  });

  test('every country can be shown on the map', () => {
    const unreachable = COUNTRIES.filter((c) => !mapTarget(c.name)).map((c) => c.name);
    assert.deepEqual(unreachable, [], 'these countries have neither an outline nor a pin');
  });

  test('pinned countries land inside the map, not off in the margins', () => {
    for (const name of Object.keys(SMALL_COUNTRY_POINTS)) {
      const t = mapTarget(name);
      assert.ok(t?.point, `${name} should resolve to a pin`);
      const [x, y] = t!.point!;
      assert.ok(x >= 0 && x <= MAP_W && y >= 0 && y <= MAP_H, `${name} pins to ${x},${y}`);
    }
  });

  test('pins are only for countries the atlas really cannot draw', () => {
    const drawnAnyway = Object.keys(SMALL_COUNTRY_POINTS).filter((n) => countryPath(n));
    assert.deepEqual(drawnAnyway, [], 'these have real outlines — drop the pin and use them');
  });

  test('flags come out as regional-indicator pairs', () => {
    assert.equal(flagOf('MY'), '🇲🇾');
    assert.equal(flagOf('jp'), '🇯🇵');
  });
});
