import { test } from 'node:test';
import assert from 'node:assert/strict';

// readable.ts reaches horizon.ts, which reaches store.ts and its module-scope listeners.
// Same minimal browser stub horizon.test.ts uses.
(globalThis as any).window = { addEventListener: () => {}, dispatchEvent: () => true };
(globalThis as any).document = { visibilityState: 'visible' };
(globalThis as any).Event = class { type: string; constructor(type: string) { this.type = type; } };

const { groupDigits, maskDigits, relativeDay } = await import('./readable.ts');

const NOW = new Date('2026-08-07T09:00:00');

test('groupDigits breaks long runs of digits into fours', () => {
  assert.equal(groupDigits('1234567890'), '1234 5678 90');
  assert.equal(groupDigits('12345678'), '1234 5678');
});

test('groupDigits leaves anything already formatted alone', () => {
  assert.equal(groupDigits('A1234-BB'), 'A1234-BB');
  assert.equal(groupDigits('012 3456 789'), '012 3456 789');
  assert.equal(groupDigits('123456'), '123456'); // too short to be worth splitting
});

test('maskDigits keeps the last four', () => {
  assert.equal(maskDigits('1234567890'), '•••••• 7890');
  assert.equal(maskDigits('1234'), '••••');
  assert.equal(maskDigits('12'), '••••'); // never reveals a value shorter than the mask
});

test('maskDigits caps the run of dots', () => {
  assert.equal(maskDigits('1'.repeat(40)), `${'•'.repeat(12)} 1111`);
});

test('relativeDay scales its unit to the distance', () => {
  assert.equal(relativeDay('2026-08-07', NOW), 'Hari ini');
  assert.equal(relativeDay('2026-08-10', NOW), '3 hari lagi');
  assert.equal(relativeDay('2026-06-07', NOW), '2 bulan lalu');
  assert.equal(relativeDay('2025-08-07', NOW), '1.0 tahun lalu');
  assert.equal(relativeDay('2021-08-07', NOW), '5 tahun lalu');
});
