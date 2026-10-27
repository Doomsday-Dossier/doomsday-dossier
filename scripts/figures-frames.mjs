// Stills of the photo-built 3D figures (/lab/figures/) at set moments of each figure's sequence, into <outdir>.
// One browser, one page at a time. Usage: node scripts/figures-frames.mjs <base> <outdir> [desktop|phone] [slugs]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const [base, out, mode = 'desktop', only] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const CH = only ? only.split(',') : ['victor-von-doom', 'steve-rogers', 'thor'];
const AT = [1.2, 4.6, 7.6, 12.6];
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1280, height: 760 } });
for (const c of CH) {
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`${base}/lab/figures/?c=${c}&nosound`);
  await p.waitForFunction(() => window.__lab?.current, null, { timeout: 60000 });
  const t0 = Date.now();
  for (const s of AT) { const w = t0 + s * 1000 - Date.now(); if (w > 0) await p.waitForTimeout(w); await p.screenshot({ path: `${out}/${mode}-${c}-${String(s).padStart(4, '0')}.png` }); }
  if (errs.length) console.log(c, 'errors:', errs.slice(0, 3));
  await p.close();
}
await b.close();
console.log('done');
