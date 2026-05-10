#!/usr/bin/env node
// Generate PWA icons + apple-touch-icon as PNGs from SVG using sharp.
// Run via: npm run icons
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '..', 'public', 'icons');
const apple = path.join(__dirname, '..', 'public', 'apple-touch-icon.png');

// Modern icon: subtle gradient bg, abstract mountain ridge, accent glow.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0e1c2c"/>
      <stop offset="50%" stop-color="#0a1322"/>
      <stop offset="100%" stop-color="#06080d"/>
    </linearGradient>
    <linearGradient id="ridge1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5be9c0"/>
      <stop offset="100%" stop-color="#2dd4a8"/>
    </linearGradient>
    <linearGradient id="ridge2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff8c5a"/>
      <stop offset="100%" stop-color="#ff7846"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="35%" r="55%">
      <stop offset="0%" stop-color="#5be9c0" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#5be9c0" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="110" fill="url(#bg)"/>
  <rect width="512" height="512" rx="110" fill="url(#glow)"/>
  <!-- Back ridge -->
  <path d="M 0 380 L 80 270 L 150 320 L 230 220 L 310 290 L 400 200 L 512 270 L 512 512 L 0 512 Z" fill="url(#ridge2)" opacity="0.40"/>
  <!-- Front ridge -->
  <path d="M 0 420 L 70 320 L 140 360 L 220 260 L 310 340 L 400 280 L 512 330 L 512 512 L 0 512 Z" fill="url(#ridge1)"/>
  <!-- Sun/Moon -->
  <circle cx="390" cy="150" r="38" fill="#5be9c0" opacity="0.85"/>
  <circle cx="390" cy="150" r="38" fill="none" stroke="#fff" stroke-width="2" opacity="0.25"/>
  <!-- Bike rider -->
  <text x="256" y="380" text-anchor="middle" font-size="180" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">🚵</text>
</svg>`;

const svgMaskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0e1c2c"/>
      <stop offset="100%" stop-color="#06080d"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="200" r="60" fill="#5be9c0" opacity="0.8"/>
  <text x="256" y="350" text-anchor="middle" font-size="160" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">🚵</text>
</svg>`;

async function main() {
  await fs.mkdir(out, { recursive: true });
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    process.stderr.write('sharp not installed; writing SVG fallback.\n');
    await fs.writeFile(path.join(out, 'icon.svg'), svg);
    return;
  }
  await sharp(Buffer.from(svg)).resize(192, 192).png().toFile(path.join(out, 'icon-192.png'));
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(path.join(out, 'icon-512.png'));
  await sharp(Buffer.from(svgMaskable)).resize(512, 512).png().toFile(path.join(out, 'icon-maskable.png'));
  await sharp(Buffer.from(svg)).resize(180, 180).png().toFile(apple);
  process.stderr.write('Icons regenerated with modern design.\n');
}

main().catch((err) => { process.stderr.write(`Fatal: ${err.message}\n`); process.exit(1); });
