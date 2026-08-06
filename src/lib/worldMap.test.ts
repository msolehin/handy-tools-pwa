// The landing map lights countries by name. A typo, or a name world-atlas spells differently,
// lights nothing at all and looks like a broken map rather than an error.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRY_PATHS, COUNTRY_BOX, countryPath, viewBoxFor, MAP_W, MAP_H } from './worldMap.ts';
import { COPY } from '../components/landing/copy.ts';

describe('world map', () => {
  test('projects the whole world once', () => {
    assert.ok(COUNTRY_PATHS.length > 150, 'expected a full country set');
    assert.equal(MAP_W, 800);
    assert.equal(MAP_H, 388);
  });

  test('every country has drawable geometry', () => {
    const empty = COUNTRY_PATHS.filter((c) => !c.d);
    assert.deepEqual(empty, [], 'a country with no path renders as nothing');
  });

  test('paths stay inside the projected viewBox', () => {
    for (const name of ['Malaysia', 'Japan', 'Brazil']) {
      const [x, y, w, h] = COUNTRY_BOX[name].box;
      assert.ok(x >= -1 && y >= -1, `${name} starts outside the viewBox`);
      assert.ok(x + w <= MAP_W + 1 && y + h <= MAP_H + 1, `${name} runs past the viewBox`);
    }
  });

  test('every landing trip country resolves to a real path, in both languages', () => {
    for (const lang of ['ms', 'en'] as const) {
      for (const trip of COPY[lang].previews.travel.trips) {
        assert.ok(countryPath(trip.country),
          `${lang}: "${trip.country}" is not a country the map can light`);
      }
    }
  });

  test('the home country resolves too', () => {
    assert.ok(countryPath('Malaysia'));
  });

  test('the zoomed viewBox frames the visited countries, not the whole world', () => {
    const names = ['Malaysia', 'Japan', 'Thailand', 'Indonesia'];
    const [x, y, w, h] = viewBoxFor(names).split(' ').map(Number);

    assert.ok(w < MAP_W, 'a map of four Asian countries should not span the globe');
    assert.ok(h < MAP_H);

    // Every country has to sit inside the frame, or the glow happens off-screen.
    for (const name of names) {
      const [cx, cy, cw, ch] = COUNTRY_BOX[name].box;
      assert.ok(cx >= x && cy >= y, `${name} falls outside the top-left of the frame`);
      assert.ok(cx + cw <= x + w && cy + ch <= y + h, `${name} falls outside the frame`);
    }
  });

  test('the zoomed viewBox keeps the map aspect ratio, so nothing distorts', () => {
    const [, , w, h] = viewBoxFor(['Malaysia', 'Japan']).split(' ').map(Number);
    assert.ok(Math.abs(w / h - MAP_W / MAP_H) < 0.01);
  });

  test('unknown countries fall back to the whole world rather than an empty frame', () => {
    assert.equal(viewBoxFor(['Wakanda']), `0 0 ${MAP_W} ${MAP_H}`);
    assert.equal(viewBoxFor([]), `0 0 ${MAP_W} ${MAP_H}`);
  });

  test('aliases cover the names world-atlas spells differently', () => {
    assert.ok(countryPath('United States'), 'aliased to United States of America');
    assert.ok(countryPath('Czech Republic'), 'aliased to Czechia');
    assert.equal(countryPath('Wakanda'), null, 'an unknown country resolves to nothing, not a throw');
  });
});
