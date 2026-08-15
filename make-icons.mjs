// Regenerates every raster form of the logo from public/favicon.svg, the vector bolt.
//
// The bolt used to be a raster crop of the original 1024x512 logo render, which made it ~188px
// tall at its largest. The 512px PWA icon needs 317px of bolt, so it was upscaled 1.7x and
// looked soft and jagged; the crop also carried a grey matte fringe left behind by the rembg
// background removal, which read as a halo once the icon sat on a dark background. Rendering
// from vector fixes both, at any size we ask for.
//
// favicon.png is still generated because email clients drop inline SVG (server/reminders.ts
// embeds it) and it is the <link rel="icon"> fallback.
//
// The wordmark is deliberately not in the icon: "SenangKit" at 192px would be ~30px of text.
// Android and iOS already print the manifest `name` under the icon in the system font.
//
// Run: node make-icons.mjs
import sharp from 'sharp';

const SRC = 'public/favicon.svg';
const BG = { r: 16, g: 16, b: 16, alpha: 1 }; // #101010 = --color-background (dark), matches manifest

// Rasterise the SVG at the exact pixel height wanted. Passing `density` rather than resizing a
// fixed-size render is what keeps the edges true vector-sharp instead of resampled.
const BOLT_ASPECT = 117.4 / 193.7; // viewBox of favicon.svg
const bolt = (h) =>
  sharp(SRC, { density: 72 * (h / 193.7) })
    .resize({ height: Math.round(h), width: Math.round(h * BOLT_ASPECT), fit: 'fill' })
    .png()
    .toBuffer();

// [file, canvas size, how much of the canvas height the bolt fills]
const ICONS = [
  ['public/pwa-192x192.png', 192, 0.62],
  ['public/pwa-512x512.png', 512, 0.62],
  ['public/pwa-maskable-512x512.png', 512, 0.5], // smaller: Android crops to a circle
  ['public/apple-touch-icon.png', 180, 0.62],
];

for (const [file, size, frac] of ICONS) {
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: await bolt(size * frac), gravity: 'center' }])
    .png()
    .toFile(file);
  console.log(`wrote ${file} (${size}px)`);
}

// Transparent, and larger than any place it renders — the app header shows it at 24-32px and
// the reminder email at 18x28, both of which want headroom for 2x/3x screens.
await sharp(await bolt(512)).png().toFile('public/favicon.png');
console.log('wrote public/favicon.png (512px tall, transparent)');
