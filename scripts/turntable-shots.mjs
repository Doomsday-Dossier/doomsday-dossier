// Views of a trial 3D model from round it (/lab/turntable/), to judge it from every side.
// Usage: node scripts/turntable-shots.mjs <base> <file.glb> <out.jpg> [angles, comma-separated] [clay]
import { chromium } from '@playwright/test';
import sharp from 'sharp';
const [base, file, out, angles = '0,45,90,180,270,315', extra = ''] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 520, height: 720 } })).newPage();
const shots = [];
for (const a of angles.split(',')) {
  await p.goto(`${base}/lab/turntable/?f=${file}&angle=${a}${extra ? `&${extra}` : ''}`);
  await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await p.waitForTimeout(400);
  if (!shots.length) console.log(JSON.stringify(await p.evaluate(() => window.__stats)));
  shots.push(await p.screenshot());
}
await b.close();
const W = 520, H = 720;
await sharp({ create: { width: W * shots.length, height: H, channels: 3, background: '#000' } })
  .composite(shots.map((s, i) => ({ input: s, left: i * W, top: 0 }))).jpeg({ quality: 82 }).toFile(out);
console.log(out);
