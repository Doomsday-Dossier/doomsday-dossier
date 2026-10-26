// Loads every / page, reports page errors and takes a first-screen and a mid-page shot.
// Usage: node scripts/preview-sweep.mjs <base> <out dir> [desktop|phone] [filter]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const [base, out, mode = 'desktop', filter = ''] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const html = fs.readdirSync('dist/preview', { recursive: true }).filter((f) => String(f).endsWith('index.html')).map((f) => '/' + String(f).replace(/\\/g, '/').replace(/index\.html$/, ''));
const pages = html.filter((p) => p.includes(filter)).sort();
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('dd-intro-seen', '1'); } catch {} });
let bad = 0;
for (const path of pages) {
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*(arena|8787|challenges)/.test(m.text())) errs.push(m.text()); });
  const r = await p.goto(base + path); await p.waitForTimeout(2200);
  const name = path.replace(/^\/preview\/?/, '').replace(/\/$/, '').replace(/\//g, '_') || 'archive';
  await p.screenshot({ path: `${out}/${name}-a.jpg`, quality: 55, type: 'jpeg' });
  await p.evaluate(() => { const l = window.__ddLenis; const y = document.documentElement.scrollHeight * 0.45; if (l) l.scrollTo(y, { immediate: true }); else scrollTo(0, y); });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/${name}-b.jpg`, quality: 55, type: 'jpeg' });
  const wide = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (r.status() !== 200 || errs.length || wide) { bad++; console.log('FAIL', path, r.status(), wide ? 'sideways overflow' : '', errs.slice(0, 3)); }
  await p.close();
}
await b.close();
console.log(`${pages.length} pages, ${bad} with problems`);
