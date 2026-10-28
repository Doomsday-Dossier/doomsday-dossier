// Screens at tablet, laptop and big-monitor sizes, for the alignment pass: node scripts/sizes-shots.mjs <base> <outdir>
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = (process.argv[2] || 'http://localhost:4322').replace(/\/$/, ''), out = process.argv[3] || 'screenshots/sizes';
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
for (const [w, h] of [[768, 1024], [1024, 768], [1920, 1080], [2560, 1440]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1100, isMobile: false });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('dd-os-booted', '1'); } catch {} });
  const p = await ctx.newPage();
  for (const path of ['', 'targets', 'c/thor', 'timeline', 'versus', 'predictions', 'chamber']) {
    await p.goto(`${base}/${path}${path ? '/' : ''}`); await p.waitForTimeout(3800);
    await p.screenshot({ path: `${out}/${w}-${(path || 'home').replace('/', '_')}.png` });
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (ov > 1) console.log(w, path, 'overflow', ov);
  }
  await ctx.close();
}
await b.close(); console.log('done');
