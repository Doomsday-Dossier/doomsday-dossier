// DOOM-OS checks (CLAUDE.md, "Design system v4"): every page loads without console errors, with and without reduced
// motion, at desktop and phone size, with no sideways overflow; then a walk through the site by clicking links
// (page changes through the shatter) to catch errors that only show after a swap.
// node scripts/os-check.mjs http://localhost:4322 [outdir]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://localhost:4322').replace(/\/$/, '');
const out = process.argv[3] || 'screenshots/os-check';
fs.mkdirSync(out, { recursive: true });
const pages = ['', 'targets', 'teams/x-men', 'c/victor-von-doom', 'c/thor', 'timeline', 'versus', 'quiz', 'predictions', 'catch-up', 'chamber', 'about', 'credits'];
const browser = await chromium.launch();
let bad = 0;
for (const [label, opts] of [['desktop', { viewport: { width: 1440, height: 860 } }], ['phone', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }], ['reduced', { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }]]) {
  const ctx = await browser.newContext(opts);
  // skip the gate: the session has already booted
  await ctx.addInitScript(() => { try { sessionStorage.setItem('dd-os-booted', '1'); } catch {} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  for (const p of pages) {
    errs.length = 0;
    await page.goto(`${base}/${p}${p ? '/' : ''}`, { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await page.screenshot({ path: `${out}/${label}-${(p || 'home').replace(/\//g, '_')}.png` });
    const e = errs.filter((x) => !/Turnstile|turnstile|favicon|ERR_|net::|Failed to load resource|GL Driver Message|KHR_parallel_shader_compile/.test(x));
    if (ov > 1 || e.length) { bad++; console.log(`${label} /${p}: overflow ${ov}px`, e.slice(0, 3)); }
  }
  await ctx.close();
}
// the walk: one full load, then page changes by clicking
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('dd-os-booted', '1'); } catch {} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`${base}/targets/`); await page.waitForTimeout(2000);
  const steps = ['a[href$="/c/thor/"]', 'a.nextf', 'a[data-mod="timeline"]', 'a[data-mod="chamber"]', 'a[data-mod="versus"]', 'a[data-mod="quiz"]', 'a[data-mod="catchup"]', 'a.bar-brand'];
  for (const s of steps) {
    await page.click(s).catch((e) => errs.push(`click ${s}: ${e.message.split('\n')[0]}`));
    await page.waitForTimeout(2600);
    const l = await page.evaluate(() => ({ url: location.pathname, canvases: document.querySelectorAll('canvas').length }));
    console.log('walk', s, '->', l.url, 'canvases', l.canvases);
  }
  if (errs.length) { bad++; console.log('walk errors', errs.slice(0, 5)); }
  await ctx.close();
}
await browser.close();
console.log(bad ? `${bad} problem(s)` : 'all clear');
