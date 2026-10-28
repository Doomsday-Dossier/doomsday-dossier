// The sweep: every page as a visitor sees it, screen by screen while scrolling (fixed bars, docks and overlays
// included), at desktop and phone size, joined into one contact sheet per page and size for close review.
// node scripts/sweep.mjs <base> <outdir> [desktop|phone] [page,page]
import { chromium, devices } from '@playwright/test';
import sharp from 'sharp';
import fs from 'node:fs';
const base = (process.argv[2] || 'http://localhost:4322').replace(/\/$/, ''), out = process.argv[3] || 'screenshots/sweep';
const modes = (process.argv[4] || 'desktop,phone').split(','), only = process.argv[5]?.split(',');
const pages = only ?? ['', 'targets', 'c/victor-von-doom', 'c/sue-storm', 'timeline', 'versus', 'quiz', 'predictions', 'catch-up', 'chamber', 'about', 'credits'];
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
for (const mode of modes) {
  const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'] } : { viewport: { width: 1440, height: 860 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('dd-os-booted', '1'); localStorage.setItem('dd-clearance', '3'); } catch {} });
  const p = await ctx.newPage();
  for (const path of pages) {
    await p.goto(`${base}/${path}${path ? '/' : ''}`); await p.waitForTimeout(4200);
    const H = await p.evaluate(() => document.documentElement.scrollHeight), vh = await p.evaluate(() => innerHeight);
    const shots = [];
    for (let y = 0, i = 0; y < H && i < 14; y += Math.round(vh * 0.9), i++) {
      await p.evaluate((yy) => scrollTo(0, yy), y); await p.waitForTimeout(700);
      shots.push(await p.screenshot());
    }
    const w = mode === 'phone' ? 300 : 560, cols = mode === 'phone' ? 7 : 4;
    const ims = await Promise.all(shots.map((s) => sharp(s).resize(w).toBuffer()));
    const h = (await sharp(ims[0]).metadata()).height;
    const rows = Math.ceil(ims.length / cols);
    await sharp({ create: { width: cols * (w + 8), height: rows * (h + 8), channels: 3, background: '#444' } })
      .composite(ims.map((im, i) => ({ input: im, left: (i % cols) * (w + 8), top: Math.floor(i / cols) * (h + 8) }))).jpeg({ quality: 80 })
      .toFile(`${out}/${mode}-${(path || 'home').replace('/', '_')}.jpg`);
  }
  await ctx.close();
}
await b.close(); console.log('done');
