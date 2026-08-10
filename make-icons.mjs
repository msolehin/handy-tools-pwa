// Regenerates the PWA / apple-touch icon set from public/favicon.png.
//
// favicon.png is the header logo itself — the transparent bolt Layout.tsx:319 and the landing
// header render, and the one reminder emails embed. Sourcing from it (rather than re-cropping
// logo.png, which is a different, older bolt) is what keeps the installed icon and the in-app
// header the same mark.
//
// The wordmark is deliberately not in the icon: "SenangKit" at 192px would be ~30px of text.
// Android and iOS already print the manifest `name` under the icon in the system font.
//
// Run: node make-icons.mjs
import sharp from 'sharp';

const BG = { r: 16, g: 16, b: 16, alpha: 1 }; // #101010 = --color-background (dark), matches manifest

const SRC = 'public/favicon.png';

// [file, size, how much of the canvas the bolt fills]
const ICONS = [
  ['public/pwa-192x192.png', 192, 0.62],
  ['public/pwa-512x512.png', 512, 0.62],
  ['public/pwa-maskable-512x512.png', 512, 0.5], // smaller: Android crops to a circle
  ['public/apple-touch-icon.png', 180, 0.62],
];

const bolt = await sharp(SRC).trim().png().toBuffer();
const { width, height } = await sharp(bolt).metadata();
console.log(`bolt: ${width}x${height} (from ${SRC})`);

for (const [file, size, frac] of ICONS) {
  const mark = await sharp(bolt).resize({ height: Math.round(size * frac), fit: 'inside' }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(file);
  console.log(`wrote ${file} (${size}px)`);
}
