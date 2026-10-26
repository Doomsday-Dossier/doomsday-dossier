// Showcase review: timed intro frames, fly-through depths and the file opening, desktop and phone,
// plus page errors and frame rate while scrolling. Usage:
//   node scripts/showcase-shots.mjs <base url> <out dir> [desktop,phone] [archive,file]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://localhost:4322').replace(/\/$/, '');
const out = process.argv[3] || 'screenshots/showcase';
const modes = (process.argv[4] || 'desktop,phone').split(',');
const pages = (process.argv[5] || 'archive,file').split(',');
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const VIEW = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } };

async function scrollTo(p, y) {
  await p.evaluate((y) => { const l = window.__ddLenis; if (l) l.scrollTo(y, { immediate: true }); else window.scrollTo(0, y); }, y);
}
async function fps(p, ms = 1500) {
  return p.evaluate((ms) => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(Math.round((n * 1000) / (performance.now() - t0))); }; requestAnimationFrame(f); }), ms);
}

for (const mode of modes) {
  const ctx = await b.newContext(VIEW[mode]);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  if (pages.includes('archive')) {
    await p.goto(base + '/');
    for (const t of [400, 1300, 2500, 3400, 4300, 5200]) { await p.waitForTimeout(t - (p.__t || 0)); p.__t = t; await p.screenshot({ path: `${out}/${mode}-intro-${t}.jpg`, quality: 72, type: 'jpeg' }); }
    p.__t = 0;
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    for (const f of [0.03, 0.08, 0.14, 0.22, 0.35, 0.5, 0.7, 0.86]) {
      await scrollTo(p, H * f); await p.waitForTimeout(900);
      await p.screenshot({ path: `${out}/${mode}-fly-${String(Math.round(f * 100)).padStart(2, '0')}.jpg`, quality: 72, type: 'jpeg' });
    }
    await scrollTo(p, H * 0.3); await p.waitForTimeout(300);
    const f1 = await fps(p);
    console.log(mode, 'archive fps (idle in corridor)', f1, 'errors', errs.length ? errs : 'none');
  }
  if (pages.includes('file')) {
    errs.length = 0;
    await p.goto(base + '/c/victor-von-doom/'); await p.waitForTimeout(2200);
    await p.screenshot({ path: `${out}/${mode}-file-00.jpg`, quality: 72, type: 'jpeg' });
    const openH = await p.evaluate(() => document.querySelector('[data-open]').offsetHeight - innerHeight);
    for (const f of [0.15, 0.3, 0.5, 0.7, 0.95]) { await scrollTo(p, openH * f); await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${mode}-file-open-${Math.round(f * 100)}.jpg`, quality: 72, type: 'jpeg' }); }
    const subTop = await p.evaluate(() => document.querySelector('[data-subject]').getBoundingClientRect().top + scrollY);
    const subH = await p.evaluate(() => document.querySelector('[data-subject]').offsetHeight);
    for (const f of [0.15, 0.35, 0.6]) { await scrollTo(p, subTop + subH * f); await p.waitForTimeout(1100); await p.screenshot({ path: `${out}/${mode}-file-subject-${Math.round(f * 100)}.jpg`, quality: 72, type: 'jpeg' }); }
    const f2 = await fps(p);
    for (const sel of ['#or-h', '#rec-h', '#sig-h', '#dd-h']) {
      await p.evaluate((s) => { const y = document.querySelector(s).getBoundingClientRect().top + scrollY - 120; const l = window.__ddLenis; if (l) l.scrollTo(y, { immediate: true }); else scrollTo(0, y); }, sel);
      await p.waitForTimeout(1200);
      await p.screenshot({ path: `${out}/${mode}-file-${sel.slice(1)}.jpg`, quality: 72, type: 'jpeg' });
    }
    console.log(mode, 'file fps (subject)', f2, 'errors', errs.length ? errs : 'none');
  }
  await ctx.close();
}
await b.close();
