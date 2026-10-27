// A review sheet of the 3D action figures: each from the front, three-quarter and back (/lab/turntable/?c=),
// one row per character, labelled. Usage: node scripts/figure3d/review.mjs <base> <out.jpg> [slugs]
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import fs from 'node:fs';
const [base, out, only] = process.argv.slice(2);
const slugs = only ? only.split(',') : fs.readdirSync('public/figures3d').filter((f) => f.endsWith('.d3f')).map((f) => f.replace('.d3f', ''));
const W = 300, H = 420, ANG = [0, 40, 180];
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
const rows = [];
for (const s of slugs) {
  await p.goto(`${base}/lab/turntable/?c=${s}`);
  try { await p.waitForFunction(() => window.__ready, null, { timeout: 60000 }); } catch { console.log('no load', s); continue; }
  const shots = [];
  for (const a of ANG) { await p.evaluate((a) => { window.__angle = a; }, a); await p.waitForTimeout(250); shots.push(await p.screenshot()); }
  const label = Buffer.from(`<svg width="${W}" height="${H}"><rect width="100%" height="100%" fill="#111"/><text x="10" y="30" font-family="monospace" font-size="18" fill="#fff">${s}</text></svg>`);
  rows.push(await sharp({ create: { width: W * 4, height: H, channels: 3, background: '#000' } }).composite([{ input: label, left: 0, top: 0 }, ...shots.map((sh, i) => ({ input: sh, left: W * (i + 1), top: 0 }))]).png().toBuffer());
}
await b.close();
const per = 8;
for (let k = 0; k * per < rows.length; k++) {
  const rs = rows.slice(k * per, k * per + per);
  const f = out.replace(/\.jpg$/, `-${k}.jpg`);
  await sharp({ create: { width: W * 4, height: H * rs.length, channels: 3, background: '#000' } }).composite(rs.map((r, i) => ({ input: r, left: 0, top: i * H }))).jpeg({ quality: 72 }).toFile(f);
  console.log(f);
}
