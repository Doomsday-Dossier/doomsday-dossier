// The iron-and-green grade (CLAUDE.md, design system v3, lesson 7): shadows lifted to gunmetal, a green cast
// through the mids, highlights to bone, part of the photo's own colour kept so faces stay themselves.
// Applied to raw RGB(A) pixels by photos2-build.mjs; run directly for a before/after sheet of a few photos.
// Usage: node scripts/grade.mjs <out-dir> <photo> [photo...]
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LO = [0.035, 0.045, 0.05], MID = [0.2, 0.3, 0.25], HI = [0.9, 0.92, 0.86];
export const KEEP = 0.34;
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Grades a raw buffer in place: `channels` 3 or 4 (alpha untouched). Works on display (sRGB) values. */
export function gradePixels(buf, channels, keep = KEEP) {
  for (let i = 0; i < buf.length; i += channels) {
    const r = buf[i] / 255, g = buf[i + 1] / 255, b = buf[i + 2] / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const a = ss(0, 0.55, l), h = ss(0.5, 1.05, l);
    for (let c = 0; c < 3; c++) {
      const tone = (LO[c] + (MID[c] - LO[c]) * a) * (1 - h) + HI[c] * h;
      buf[i + c] = Math.round(Math.min(1, tone + ([r, g, b][c] - tone) * keep) * 255);
    }
  }
  return buf;
}

/** A sharp pipeline's RGB output, graded, as a new sharp instance. */
export async function graded(img, keep = KEEP) {
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  gradePixels(data, 3, keep);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [out, ...photos] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  for (const p of photos) {
    const name = path.basename(path.dirname(p)) + '-' + path.basename(p).replace(/\.[^.]+$/, '');
    await sharp(p).resize({ width: 640 }).jpeg({ quality: 80 }).toFile(path.join(out, `${name}-a-before.jpg`));
    await (await graded(sharp(p).resize({ width: 640 }))).jpeg({ quality: 80 }).toFile(path.join(out, `${name}-b-after.jpg`));
  }
  console.log(photos.length, 'graded into', out);
}
