// Frames of a home version at points down the scroll (in screen heights), after the forge has settled.
// Usage: node scripts/home-frames.mjs <base> <out> <1|2|site> [desktop|phone] [y,y,y] (site: the real home page)
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const [base, out, v = '1', mode = 'desktop', list] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const ys = (list || '0,0.3,0.7,1.1,1.5,1.8,2.0,2.15,2.4,2.8,3.4,4.2').split(',').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(v === "site" ? `${base}/` : `${base}/lab/home-${v}/?first`);
await p.waitForFunction(() => window.__forgeReady, null, { timeout: 30000 });
await p.evaluate(() => window.__forgeBegin());
await p.evaluate(() => window.__forgeSeek(7.4));
await p.waitForTimeout(2600);
for (const y of ys) {
  await p.evaluate((y) => window.__ddLenis.scrollTo(y * innerHeight, { immediate: true, force: true }), y);
  await p.waitForTimeout(y > 2.2 ? 1300 : 350);
  await p.screenshot({ path: `${out}/h${v}-${mode}-${String(y).replace('.', '_')}.jpg`, type: 'jpeg', quality: 72 });
}
console.log(v, mode, errs.length ? errs.slice(0, 6) : 'no errors');
await b.close();
