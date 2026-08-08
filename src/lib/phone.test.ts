import { test } from 'node:test';
import assert from 'node:assert/strict';

import { waNumber } from './phone.ts';

test('local Malaysian notation becomes a country-coded number', () => {
  assert.equal(waNumber('0123456789'), '60123456789');
  assert.equal(waNumber('012-345 6789'), '60123456789');
  assert.equal(waNumber('011-1234 5678'), '601112345678');
});

test('numbers already carrying a country code are left alone', () => {
  assert.equal(waNumber('+60123456789'), '60123456789');
  assert.equal(waNumber('60123456789'), '60123456789');
  assert.equal(waNumber('+65 9123 4567'), '6591234567', 'a foreign landlord still has to be reachable');
});

test('anything too short or too long to dial is rejected, not guessed at', () => {
  assert.equal(waNumber(''), null);
  assert.equal(waNumber('   '), null);
  assert.equal(waNumber('012345'), null);
  assert.equal(waNumber('0123456789012345'), null);
  assert.equal(waNumber('not a phone'), null);
});
