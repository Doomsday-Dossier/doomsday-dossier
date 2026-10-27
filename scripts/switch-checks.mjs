// Checks the page changes around their edges: reduced motion (no cover, the page simply swaps and its entrance
// is already in place), a link in the index menu (the wipe, and the menu closed on the next page), the back
// button (the wipe again, onto the right page), and that every cover is gone afterwards.
// Usage: node scripts/switch-checks.mjs <base> [desktop|phone]
import { chromium, devices } from '@playwright/test';
const [base, mode = 'desktop'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const opts = mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } };
const errs = [];
const page = async (extra = {}) => { const c = await b.newContext({ ...opts, ...extra }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
const settled = (p) => p.waitForFunction(() => !document.querySelector('[data-pt].on, [data-ho].on'), null, { timeout: 8000 }).then(() => p.waitForTimeout(600));
const look = (p) => p.evaluate(() => ({
  path: location.pathname, page: document.body.dataset.page, slug: document.querySelector('[data-file]')?.dataset.slug ?? null,
  cover: document.querySelector('[data-pt].on, [data-ho].on') ? 'UP' : 'none', menu: document.documentElement.classList.contains('menu-open') ? 'OPEN' : 'closed',
  name: (() => { const w = document.querySelector('.hero-name .hw'); return w ? getComputedStyle(w).opacity : null; })(),
}));
const ok = (label, cond, v) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`, JSON.stringify(v));

// 1. reduced motion: no cover; the next file is there at once, its name visible
{
  const p = await page({ reducedMotion: 'reduce' });
  await p.goto(`${base}/c/victor-von-doom/`); await p.waitForTimeout(1500);
  await p.evaluate(() => (window.__m = 1));
  await p.evaluate(() => document.querySelector('a.voy-big').click());
  await p.waitForTimeout(150);
  const during = await p.evaluate(() => !!document.querySelector('[data-pt].on, [data-ho].on'));
  await p.waitForTimeout(1500);
  const v = await look(p);
  ok('reduced motion: next file, no cover, name shown', !during && v.slug === 'steve-rogers' && v.cover === 'none' && v.name === '1' && (await p.evaluate(() => window.__m)) === 1, { during, ...v });
  await p.context().close();
}

// 2. the index menu: a link wipes to the page and the menu is closed when it arrives
{
  const p = await page();
  await p.goto(`${base}/c/thor/`); await p.waitForTimeout(1800);
  await p.click('[data-menu-toggle]'); await p.waitForTimeout(900);
  await p.locator('[data-menu] a[href$="/c/loki/"]').first().click();
  await p.waitForTimeout(250);
  const kind = await p.evaluate(() => (document.querySelector('[data-pt].on') ? 'wipe' : document.querySelector('[data-ho].on') ? 'handoff' : 'none'));
  await settled(p);
  const v = await look(p);
  ok('menu link: wipe to Loki, menu closed', kind === 'wipe' && v.slug === 'loki' && v.menu === 'closed' && v.cover === 'none' && v.name === '1', { kind, ...v });
  // 3. back: the wipe again, onto Thor's file
  await p.goBack(); await p.waitForTimeout(250);
  const kb = await p.evaluate(() => (document.querySelector('[data-pt].on') ? 'wipe' : 'none'));
  await settled(p);
  const vb = await look(p);
  ok('back button: wipe back to Thor', kb === 'wipe' && vb.slug === 'thor' && vb.cover === 'none' && vb.name === '1', { kind: kb, ...vb });
  // 4. a file to the home page and back into a file from the hall's index
  await p.locator('a.dx-mark').click(); await p.waitForTimeout(250); await settled(p);
  const vh = await look(p);
  ok('file to home', vh.page === 'archive' && vh.cover === 'none', vh);
  await p.context().close();
}
console.log('page errors:', errs.length ? errs.slice(0, 5) : 'none');
await b.close();
