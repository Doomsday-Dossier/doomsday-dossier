// Screen recording of a page being scrolled the way a visitor would (smooth Lenis glides with pauses),
// at phone or desktop size, for sending to the user. Localhost only (__ddLenis).
// Usage: node scripts/record.mjs <base> <outDir> <path> [phone|desktop] [seconds=24] [first]
// "first" plays the first-visit intro; otherwise the intro is marked as seen.
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const [base, out, page, mode = 'phone', secs = '24', first] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const size = mode === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ...(mode === 'phone' ? devices['Pixel 7'] : {}), viewport: size, recordVideo: { dir: out, size } });
if (!first) await ctx.addInitScript(() => { try { localStorage.setItem('dd-intro-seen', '1'); } catch {} });
const p = await ctx.newPage();
await p.goto(`${base}/${page.replace(/^\//, '')}`);
await p.waitForTimeout(first ? 5500 : 2500);
// glide down the page in steps, pausing on each screen like a reader
const total = Number(secs) * 1000 - (first ? 5500 : 2500);
const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const steps = Math.max(4, Math.round(total / 1600));
for (let i = 1; i <= steps; i++) {
  await p.evaluate(([y]) => window.__ddLenis.scrollTo(y, { duration: 1.1 }), [Math.round((H * 0.92 * i) / steps)]);
  await p.waitForTimeout(total / steps);
}
const v = p.video();
await ctx.close();
const dest = path.join(out, `${page.replace(/[\/]+/g, '_').replace(/^_|_$/g, '') || 'home'}-${mode}.webm`);
fs.renameSync(await v.path(), dest);
console.log(dest);
await b.close();
