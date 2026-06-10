/**
 * Generate ScholarNerve PWA / home-screen icons from a 1024x1024 master.
 * Usage: node scripts/generate-app-icons.mjs [master.png]
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const require = createRequire(pathToFileURL(path.join(root, 'backend', 'package.json')));
const sharp = require('sharp');
const publicDir = path.join(root, 'public');

const MASTER = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(publicDir, 'scholarnerve-app-icon-1024.png');

const SIZES = [
  { name: 'android-chrome-512x512.png', size: 512 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'og-image.png', size: 512 },
];

async function buildIcon(inputBuffer, size, { maskable = false } = {}) {
  const padRatio = maskable ? 0.1 : 0.06;
  const pad = Math.round(size * padRatio);
  const inner = Math.max(1, size - pad * 2);

  const graphic = await sharp(inputBuffer)
    .trim({ threshold: 18 })
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: graphic, gravity: 'center' }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function main() {
  const masterBuffer = await fs.readFile(MASTER);
  console.log('Using master:', MASTER);

  for (const { name, size } of SIZES) {
    const outPath = path.join(publicDir, name);
    const buffer = await buildIcon(masterBuffer, size, { maskable: false });
    await fs.writeFile(outPath, buffer);
    console.log('Wrote', name, size);
  }

  // Maskable variants for Android adaptive icons (slightly more safe-zone padding)
  for (const size of [512, 192]) {
    const buffer = await buildIcon(masterBuffer, size, { maskable: true });
    const outPath = path.join(publicDir, `android-chrome-maskable-${size}x${size}.png`);
    await fs.writeFile(outPath, buffer);
    console.log('Wrote', path.basename(outPath));
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
