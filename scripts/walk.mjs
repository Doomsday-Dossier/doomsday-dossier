// Walks a page the way a visitor scrolls it and saves a frame every half screen, at phone, laptop and
// desktop sizes, for reviewing overlaps and motion by eye. Localhost only (scrolls through __ddLenis).
// Usage: node scripts/walk.mjs <base> <out> <path,path> [phone,laptop,desktop] [step=0.5]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const [base, out, list, modes = 'phone,laptop,desktop', step = '0.5'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const SIZES = { phone: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, laptop: { viewport: { width: 1280, height: 720 } }, desktop: { viewport: { width: 1440, height: 900 } } };
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
for (const mode of modes.split(',')) {
  const ctx = await b.newContext(SIZES[mode]);
  await ctx.addInitScript(() => { try { localStorage.setItem('dd-intro-seen', '1'); } catch {} });
  for (const path of list.split(',')) {
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    // paths come without a leading slash (Git Bash rewrites /... into a Windows path)
    await p.goto(base + '/' + path.replace(/^\//, '')); await p.waitForTimeout(3000);
    const name = path.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'home';
    const H = await p.evaluate(() => document.documentElement.scrollHeight), vh = SIZES[mode].viewport.height;
    let i = 0;
    for (let y = 0; y < H - vh * 0.5; y += vh * Number(step)) {
      await p.evaluate((y) => window.__ddLenis ? window.__ddLenis.scrollTo(y, { immediate: true }) : scrollTo(0, y), y);
      await p.waitForTimeout(700);
      await p.screenshot({ path: `${out}/${name}-${mode}-${String(i++).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 60 });
      if (i > 80) break;
    }
    console.log(mode, path, i, 'frames', errs.length ? errs : '');
    await p.close();
  }
  await ctx.close();
}
await b.close();
