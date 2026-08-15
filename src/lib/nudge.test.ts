// node --test src/lib/nudge.test.ts
//
// The message is what actually gets sent to another person, so the checks are on the things that
// would embarrass the user: a missing name, a dangling "for" with nothing after it, or a tone that
// silently returns nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nudge, TONES } from './nudge.ts';

test('every tone produces a message in both languages, with and without a description', () => {
  for (const { key } of TONES) {
    for (const lang of ['ms', 'en'] as const) {
      for (const desc of ['', 'tiket konsert']) {
        const msg = nudge(key, lang, 'Sara', 'RM50.00', desc);
        assert.ok(msg.length > 20, `${key}/${lang} is too short: ${msg}`);
        assert.ok(msg.includes('Sara'), `${key}/${lang} dropped the name`);
        assert.ok(msg.includes('RM50.00'), `${key}/${lang} dropped the amount`);
        assert.equal(msg.includes('tiket konsert'), desc !== '');
      }
    }
  }
});

test('an empty name falls back instead of leaving a gap', () => {
  assert.ok(!nudge('gentle', 'ms', '   ', 'RM10.00', '').startsWith('Hi ,'));
  assert.ok(nudge('gentle', 'en', '', 'RM10.00', '').startsWith('Hi there,'));
});

test('a whitespace-only description is treated as absent', () => {
  assert.equal(
    nudge('direct', 'en', 'Sara', 'RM50.00', '  '),
    nudge('direct', 'en', 'Sara', 'RM50.00', ''),
  );
});
