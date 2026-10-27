// Stills through the DOOM-OS prototype (/lab/os/): boot, home, the register, a target file filling in.
// Usage: node scripts/os-frames.mjs <base> <outdir> [desktop|phone] [target slug]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const [base, out, mode = 'desktop', slug = 'steve-rogers'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await (await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 860 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const shot = (n) => p.screenshot({ path: `${out}/${mode}-${n}.png` });
await p.goto(`${base}/lab/os/`); await p.waitForTimeout(1200); await shot('00-gate');
await p.evaluate(() => window.__start());
await p.waitForTimeout(1800); await shot('01-boot');
await p.waitForTimeout(4200); await shot('02-home-scan');
await p.waitForTimeout(3500); await shot('03-home');
await p.evaluate(() => { location.hash = '#targets'; }); await p.waitForTimeout(1800); await shot('04-register');
await p.evaluate((s) => { location.hash = `#t/${s}`; }, slug);
await p.waitForTimeout(1400); await shot('05-file-scan');
await p.waitForTimeout(3600); await shot('06-file-locked');
await p.waitForTimeout(7000); await shot('07-file-full');
await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(800); await shot('08-file-lower');
console.log(errs.length ? errs.slice(0, 5) : 'no errors');
await b.close();
