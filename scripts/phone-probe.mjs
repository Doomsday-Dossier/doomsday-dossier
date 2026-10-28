// Phone probe (Pixel 7 emulation, touch): taps on the Battleworld planet, then full-page stills of every module, to see
// what a phone visitor sees. node scripts/phone-probe.mjs <base> <outdir>
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const base = (process.argv[2] || 'http://localhost:4322').replace(/\/$/, '');
const out = process.argv[3] || 'screenshots/phone-probe';
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ...devices['Pixel 7'] });
await ctx.addInitScript(() => { try { sessionStorage.setItem('dd-os-booted', '1'); } catch {} });
const p = await ctx.newPage();
const log = [];
p.on('console', (m) => log.push(m.type() + ': ' + m.text()));
await p.goto(`${base}/`); await p.waitForTimeout(6000);
const cv = await p.locator('[data-bw]').boundingBox();
console.log('canvas', cv);
await p.screenshot({ path: `${out}/home-0.png` });
for (const [i, [fx, fy]] of [[0.5, 0.45], [0.42, 0.4], [0.58, 0.55]].entries()) {
  await p.touchscreen.tap(cv.x + cv.width * fx, cv.y + cv.height * fy); await p.waitForTimeout(700);
  const tag = await p.evaluate(() => { const t = document.querySelector('[data-bw-tag]'); return { hidden: t?.hidden, name: t?.querySelector('[data-bw-name]')?.textContent, url: location.pathname }; });
  console.log('tap', i, tag);
  await p.screenshot({ path: `${out}/home-tap${i}.png` });
}
await p.touchscreen.tap(cv.x + cv.width * 0.58, cv.y + cv.height * 0.55); await p.waitForTimeout(2500);
console.log('after second tap', await p.evaluate(() => location.pathname));
for (const path of ['targets', 'c/thor', 'timeline', 'versus', 'quiz', 'predictions', 'catch-up', 'chamber']) {
  await p.goto(`${base}/${path}/`); await p.waitForTimeout(3500);
  await p.screenshot({ path: `${out}/${path.replace('/', '_')}.png`, fullPage: true });
  const bad = await p.evaluate(() => { const o = []; document.querySelectorAll('.screen *').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && (r.right > innerWidth + 1 || r.left < -1) && o.length < 5 && !e.closest('.lv-body')) o.push(`${e.tagName}.${String(e.className).slice(0, 40)} ${Math.round(r.left)}..${Math.round(r.right)}`); }); return o; });
  if (bad.length) console.log(path, 'outside the screen:', bad);
}
console.log(log.filter((l) => /error/i.test(l)).slice(0, 5));
await b.close();
