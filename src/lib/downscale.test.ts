// node --test src/lib/downscale.test.ts
// Covers shrinkExisting only — it rewrites stored user records in place, so its skip/replace
// decisions are the part that can silently destroy data. The canvas work in downscaleDataUrl
// is browser-only and is verified by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shrinkExisting } from './downscale.ts';

const big = 'x'.repeat(300_000);
const small = 'x'.repeat(100);
const fakeShrink = async () => 'shrunk';

test('replaces values over the threshold', async () => {
  const { items, changed } = await shrinkExisting(
    [{ id: '1', cover: big }], 'cover', 300, 200_000, fakeShrink);
  assert.equal(changed, true);
  assert.equal(items[0].cover, 'shrunk');
  assert.equal(items[0].id, '1', 'other fields survive');
});

test('leaves values under the threshold alone', async () => {
  const { items, changed } = await shrinkExisting(
    [{ cover: small }], 'cover', 300, 200_000, fakeShrink);
  assert.equal(changed, false);
  assert.equal(items[0].cover, small);
});

test('ignores missing and non-string fields', async () => {
  const input = [{ cover: undefined }, {}, { cover: 42 }] as { cover?: unknown }[];
  const { items, changed } = await shrinkExisting(input, 'cover', 300, 200_000, fakeShrink);
  assert.equal(changed, false);
  assert.deepEqual(items, input);
});

test('keeps the original when the result got no smaller', async () => {
  const grew = async () => big + 'more';
  const { items, changed } = await shrinkExisting(
    [{ cover: big }], 'cover', 300, 200_000, grew);
  assert.equal(changed, false);
  assert.equal(items[0].cover, big);
});

test('changed is false when nothing needed shrinking, so no pointless write', async () => {
  const { changed } = await shrinkExisting(
    [{ cover: small }, { cover: small }], 'cover', 300, 200_000, fakeShrink);
  assert.equal(changed, false);
});
