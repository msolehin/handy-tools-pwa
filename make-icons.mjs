// Regenerates the PWA / favicon set from public/logo.png.
// The wordmark's dark "Senang" text was unreadable at icon size, so icons use
// only the bolt, centred on the brand background. Run: node make-icons.mjs
import sharp from 'sharp';

const BG = { r: 15, g: 23, b: 42, alpha: 1 }; // #0f172a, matches manifest theme/background
const BOLT_REGION = { left: 0, top: 0, width: 305, height: 512 }; // bolt sits left of the "S"

// two passes: sharp runs trim before extract within one pipeline, which would move the region
const cropped = await sharp('public/logo.png').extract(BOLT_REGION).png().toBuffer();
const bolt = await sharp(cropped).trim().png().toBuffer();
const { width, height } = await sharp(bolt).metadata();
console.log(`bolt: ${width}x${height}`);

// [file, size, how much of the canvas the bolt fills]
const ICONS = [
  ['public/pwa-192x192.png', 192, 0.62],
  ['public/pwa-512x512.png', 512, 0.62],
  ['public/pwa-maskable-512x512.png', 512, 0.5], // smaller: Android crops to a circle
  ['public/apple-touch-icon.png', 180, 0.62],
  ['public/favicon.png', 64, 0.75],
];

for (const [file, size, frac] of ICONS) {
  const mark = await sharp(bolt).resize({ height: Math.round(size * frac), fit: 'inside' }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(file);
  console.log(`wrote ${file} (${size}px)`);
}
