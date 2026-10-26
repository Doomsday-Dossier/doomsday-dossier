// Screen recording of the showcase in one take: intro, fly-through, opening Doom's file from the
// corridor (the fly-in), then the whole file. Smooth scrolling goes through Lenis, as a visitor's would.
// Usage: node scripts/showcase-record.mjs <base url> <out dir> [desktop|phone]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://localhost:4322').replace(/\/$/, '');
const out = process.argv[3] || 'screenshots/showcase';
const mode = process.argv[4] || 'desktop';
fs.mkdirSync(out, { recursive: true });
const size = mode === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 720 };
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ...(mode === 'phone' ? devices['Pixel 7'] : {}), viewport: size, recordVideo: { dir: out, size } });
const p = await ctx.newPage();

// glide to a scroll position over `s` seconds, then let it settle
const glide = async (y, s) => {
  await p.evaluate(([y, s]) => window.__ddLenis.scrollTo(y, { duration: s, easing: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) }), [y, s]);
  await p.waitForTimeout(s * 1000 + 400);
};
const top = (sel) => p.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + scrollY, sel);

await p.goto(base + '/');
await p.waitForTimeout(5600); // the full first-visit intro
const fly = await top('[data-fly]');
const flyH = await p.evaluate(() => document.querySelector('[data-fly]').offsetHeight);
await glide(fly * 0.9, 3.2); // the figure turns, the camera dives through it
await glide(fly + (flyH - size.height) * 0.55, 9); // down the corridor
await glide(fly + (flyH - size.height) * 0.98, 4);
await glide(await top('.index'), 2.5);
await p.waitForTimeout(800);
// back to the first file and open it from the corridor: the camera flies into it
await glide(fly + (flyH - size.height) * 0.012, 3);
await p.waitForTimeout(700);
await p.click('[data-label]');
await p.waitForURL(/victor-von-doom/, { timeout: 15000 });
await p.waitForTimeout(2600);
const openEnd = await p.evaluate(() => { const o = document.querySelector('[data-open]'); return o.offsetTop + o.offsetHeight - innerHeight; });
await glide(openEnd * 0.6, 5);
await glide(openEnd, 3.5);
await p.waitForTimeout(900); // the stamp
const pin = await p.evaluate(() => { const s = document.querySelector('[data-sub-pin]'); return { t: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight }; });
await glide(pin.t, 2.5);
await glide(pin.t + (pin.h - (mode === 'phone' ? 0 : size.height)) * 0.85, 7);
for (const sel of ['#or-h', '#rec-h', '#sig-h', '#dd-h']) await glide((await top(sel)) - 110, 2.6);
await glide(await p.evaluate(() => document.documentElement.scrollHeight - innerHeight), 2.5);
await p.waitForTimeout(800);
const video = p.video();
await ctx.close();
const file = path.join(out, `showcase-${mode}.webm`);
fs.renameSync(await video.path(), file);
await b.close();
console.log('recorded', file, Math.round(fs.statSync(file).size / 1024), 'KB');
