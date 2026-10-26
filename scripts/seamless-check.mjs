// Walks the site by clicking links, as a visitor would, and checks every change is seamless: no reload (a
// marker on window survives), sound keeps running, each page boots (its ScrollTriggers exist), window
// listeners don't pile up, and nothing errors. Usage: node scripts/seamless-check.mjs <base> [desktop|phone]
import { chromium, devices } from '@playwright/test';
const [base, mode = 'desktop'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
let loads = 0; p.on('load', () => loads++);
// count window listeners by wrapping add/remove before the site's scripts run
await p.addInitScript(() => {
  const live = new Set(); window.__listeners = () => live.size;
  const add = window.addEventListener, rem = window.removeEventListener;
  window.addEventListener = function (t, f, o) { live.add(t + '|' + (f && (f.__id ??= Math.random()))); return add.call(this, t, f, o); };
  window.removeEventListener = function (t, f, o) { live.delete(t + '|' + (f && f.__id)); return rem.call(this, t, f, o); };
});
await p.goto(`${base}/c/thor/`); await p.waitForTimeout(2000);
await p.mouse.click(700, 450); await p.waitForTimeout(600); // a first click starts sound
await p.evaluate(() => { window.__marker = 'same document'; });
const state = (label) => p.evaluate((label) => ({
  label, path: location.pathname, marker: window.__marker ?? 'RELOADED', page: document.body.dataset.page,
  triggers: window.ScrollTrigger?.getAll?.().length ?? (document.querySelectorAll('.pin-spacer').length + '?'), listeners: window.__listeners(),
  audio: (window.__ddSound?.ctx?.state) ?? 'n/a', cover: getComputedStyle(document.querySelector('[data-pt]')).transform,
}), label);
const go = async (sel, label) => { await p.locator(sel).first().click({ force: true }); await p.waitForTimeout(2600); console.log(JSON.stringify(await state(label))); };
console.log(JSON.stringify(await state('thor, first load')));
await go('a.voy-big', 'next file');
await go('.dx-nav a[href$="/timeline/"]', 'timeline');
await go('.dx-nav a[href$="/quiz/"]', 'quiz');
await go('a.dx-mark', 'home');
await p.waitForTimeout(3000); console.log(JSON.stringify(await state('home, forge played')));
await go('.index-list a', 'file from home index');
await p.goBack(); await p.waitForTimeout(2600); console.log(JSON.stringify(await state('back')));
console.log('full loads:', loads, '| errors:', errs.length ? errs.slice(0, 6) : 'none');
await b.close();
