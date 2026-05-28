#!/usr/bin/env node
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '..', 'crm', 'frontend', 'public');
const COLOR = { r: 0x0e, g: 0xa5, b: 0xe9, alpha: 1 };
const SIZES = [192, 512];

mkdirSync(PUBLIC_DIR, { recursive: true });

for (const size of SIZES) {
  const out = resolve(PUBLIC_DIR, `pwa-${size}x${size}.png`);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: COLOR,
    },
  })
    .png()
    .toFile(out);
  console.log(`wrote ${out}`);
}
