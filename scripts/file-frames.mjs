// Frames of a character file through its clearance levels: the hero, the briefing, each lock, each level
// opened, at desktop or phone size. Usage: node scripts/file-frames.mjs <base> <out> <slug> [desktop|phone]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const [base, out, slug = 'thor', mode = 'desktop'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`${base}/c/${slug}/`); await p.waitForTimeout(2500);
let n = 0;
const shot = async (name) => p.screenshot({ path: `${out}/${slug}-${mode}-${String(++n).padStart(2, '0')}-${name}.jpg`, type: 'jpeg', quality: 70 });
const to = async (y, wait = 900) => { await p.evaluate((y) => (window.__ddLenis ? window.__ddLenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y)), y); await p.waitForTimeout(wait); };
const top = (sel) => p.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + scrollY, sel);
await shot('hero');
const open = await top('[data-open]'), openH = await p.evaluate(() => document.querySelector('[data-open]').offsetHeight);
await to(open + (openH - 900) * 0.45); await shot('opening');
await to(open + openH - innerHeight_()); await shot('briefing');
function innerHeight_() { return mode === 'phone' ? 844 : 900; }
await to((await top('#level-2')) - 60); await shot('level2-locked');
await p.click('[data-request="2"]'); await p.waitForTimeout(2200); await shot('level2-open');
await to((await top('[data-sub-photo]')) - 140, 1400); await shot('subject');
await to((await top('#ch-screen')) - 40); await shot('screen');
await to((await top('#level-3')) - 60); await shot('level3-locked');
await p.click('[data-request="3"]'); await p.waitForTimeout(2200); await shot('level3-open');
await to((await top('#ch-abilities')) - 40); await shot('abilities');
console.log(slug, mode, errs.length ? errs.slice(0, 5) : 'no errors');
await b.close();
