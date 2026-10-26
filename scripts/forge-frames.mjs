// Frames of a forge version at set moments after the click, for reviewing the picture beat by beat.
// Usage: node scripts/forge-frames.mjs <base> <out> <a|b> [desktop|phone] [t,t,t]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const [base, out, v = 'a', mode = 'desktop', list] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const times = (list || (v === 'b' ? '-1,0.6,1.1,1.6,2.2,2.8,3.3,3.6,4.2,5.2' : '-1,1.2,1.8,2.5,3.2,4.0,4.7,5.32,5.8,6.4,7.5')).split(',').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`${base}/lab/forge-${v}/?first`);
await p.waitForFunction(() => window.__forgeReady, null, { timeout: 30000 });
await p.waitForTimeout(800);
for (const t of times) {
  if (t >= 0) { await p.evaluate(() => window.__forgeBegin()); await p.evaluate((t) => window.__forgeSeek(t), t); }
  await p.waitForTimeout(t < 0 ? 300 : 180);
  await p.screenshot({ path: `${out}/${v}-${mode}-${String(t).replace('-', 'm')}.jpg`, type: 'jpeg', quality: 72 });
}
console.log(v, mode, errs.length ? errs.slice(0, 6) : 'no errors');
await b.close();
