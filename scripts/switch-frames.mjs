// Stills through a page change, to check how it looks: the handoff from the next-file link, or (LINK=<selector>)
// the redaction wipe. Frames at set times after the click, into <outdir>/<name>-<ms>.jpg.
// Usage: node scripts/switch-frames.mjs <base> <outdir> [from-slug] [desktop|phone] [name]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const [base, out, from = 'victor-von-doom', mode = 'desktop', name = 'handoff'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${base}/c/${from}/`); await p.waitForTimeout(2500);
const sel = process.env.LINK || 'a.voy-big';
// bring the link into view the way a reader would reach it
await p.evaluate((s) => { const a = document.querySelector(s); const y = a.closest('[data-voyage]')?.getBoundingClientRect().top ?? a.getBoundingClientRect().top; window.__ddLenis ? window.__ddLenis.scrollTo(window.__ddLenis.scroll + y, { immediate: true }) : scrollBy(0, y); }, sel);
await p.waitForTimeout(1800);
const t0 = Date.now();
await p.evaluate((s) => document.querySelector(s).click(), sel);
for (const ms of (process.env.AT || '120,350,650,1000,1600,2400,2800,3300,4200').split(',').map(Number)) {
  const wait = t0 + ms - Date.now(); if (wait > 0) await p.waitForTimeout(wait);
  await p.screenshot({ path: `${out}/${name}-${mode}-${String(ms).padStart(4, '0')}.jpg`, quality: 70, type: 'jpeg' });
}
console.log('at', p.url());
await b.close();
