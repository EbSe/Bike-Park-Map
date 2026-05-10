#!/usr/bin/env node
// Generate PWA icons + apple-touch-icon as PNGs from SVG using sharp.
// Run via: npm run icons
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '..', 'public', 'icons');
const apple = path.join(__dirname, '..', 'public', 'apple-touch-icon.png');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1220"/>
      <stop offset="100%" stop-color="#1a3a52"/>
    </linearGradient>
    <linearGradient id="m" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4fd1c5"/>
      <stop offset="100%" stop-color="#38b2ac"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#g)"/>
  <!-- Mountain ridge -->
  <path d="M 30 360 L 130 220 L 200 290 L 290 170 L 380 280 L 482 200 L 482 482 L 30 482 Z" fill="url(#m)" opacity="0.5"/>
  <path d="M 30 400 L 110 290 L 180 340 L 270 240 L 360 320 L 482 250 L 482 482 L 30 482 Z" fill="#4fd1c5"/>
  <!-- Bike emoji style -->
  <g transform="translate(256 256)">
    <circle r="180" fill="rgba(11,18,32,0.4)"/>
    <text x="0" y="40" text-anchor="middle" font-size="220" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif">🚵</text>
  </g>
</svg>`;

const svgMaskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1220"/>
      <stop offset="100%" stop-color="#1a3a52"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(256 256)">
    <text x="0" y="30" text-anchor="middle" font-size="180" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif">🚵</text>
  </g>
</svg>`;

async function main() {
  await fs.mkdir(out, { recursive: true });
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    process.stderr.write('sharp not installed; falling back to writing SVGs only.\n');
    await fs.writeFile(path.join(out, 'icon.svg'), svg);
    return;
  }
  await sharp(Buffer.from(svg)).resize(192, 192).png().toFile(path.join(out, 'icon-192.png'));
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(path.join(out, 'icon-512.png'));
  await sharp(Buffer.from(svgMaskable)).resize(512, 512).png().toFile(path.join(out, 'icon-maskable.png'));
  await sharp(Buffer.from(svg)).resize(180, 180).png().toFile(apple);
  process.stderr.write('Icons generated.\n');
}

main().catch((err) => { process.stderr.write(`Fatal: ${err.message}\n`); process.exit(1); });
