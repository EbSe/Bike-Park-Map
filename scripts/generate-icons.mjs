#!/usr/bin/env node
// Minimal modern PWA icon: solid gradient background + clean mark.
// No SVG decoration / mountain illustrations.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '..', 'public', 'icons');
const apple = path.join(__dirname, '..', 'public', 'apple-touch-icon.png');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0e1f2c"/>
      <stop offset="100%" stop-color="#0a1322"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5be9c0"/>
      <stop offset="100%" stop-color="#2dd4a8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="118" fill="url(#bg)"/>
  <circle cx="256" cy="220" r="74" fill="url(#accent)"/>
  <circle cx="256" cy="220" r="74" fill="none" stroke="#5be9c0" stroke-width="2" stroke-opacity="0.3"/>
  <rect x="120" y="350" width="272" height="14" rx="7" fill="url(#accent)" opacity="0.55"/>
  <rect x="160" y="380" width="192" height="10" rx="5" fill="url(#accent)" opacity="0.30"/>
</svg>`;

const svgMaskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0e1f2c"/>
      <stop offset="100%" stop-color="#0a1322"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5be9c0"/>
      <stop offset="100%" stop-color="#2dd4a8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="240" r="84" fill="url(#accent)"/>
  <rect x="140" y="370" width="232" height="12" rx="6" fill="url(#accent)" opacity="0.5"/>
</svg>`;

async function main() {
  await fs.mkdir(out, { recursive: true });
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    await fs.writeFile(path.join(out, 'icon.svg'), svg);
    process.stderr.write('Sharp not available, wrote SVG only.\n');
    return;
  }
  await sharp(Buffer.from(svg)).resize(192, 192).png().toFile(path.join(out, 'icon-192.png'));
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(path.join(out, 'icon-512.png'));
  await sharp(Buffer.from(svgMaskable)).resize(512, 512).png().toFile(path.join(out, 'icon-maskable.png'));
  await sharp(Buffer.from(svg)).resize(180, 180).png().toFile(apple);
  process.stderr.write('Minimal icons regenerated.\n');
}

main().catch((err) => { process.stderr.write(`Fatal: ${err.message}\n`); process.exit(1); });
