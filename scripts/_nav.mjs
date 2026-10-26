import { chromium } from '@playwright/test';
const base = process.argv[2], out = process.argv[3];
const b = await chromium.launch({ args: ['--use-gl=angle'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const fails = []; p.on('requestfailed', (r) => fails.push(r.url() + ' ' + r.failure()?.errorText));
await p.goto(base + '/'); await p.waitForTimeout(3000);
await p.click('[data-menu-toggle]'); await p.waitForTimeout(1200);
const link = p.locator('#menu a', { hasText: /^Sam Wilson$/i }).first();
console.log('menu link count', await p.locator('#menu a').count(), 'sam link', await link.count(), await link.getAttribute('href').catch(() => null));
await link.click();
for (const t of [300, 800, 1500, 3000, 6000]) {
  await p.waitForTimeout(t === 300 ? 300 : t - [300, 800, 1500, 3000, 6000][[300, 800, 1500, 3000, 6000].indexOf(t) - 1]);
  const s = await p.evaluate(() => ({ url: location.pathname, bg: getComputedStyle(document.body).backgroundColor, sheets: [...document.styleSheets].length, links: [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href.split('/').pop()), styles: document.querySelectorAll('style').length, skipVisible: (() => { const a = [...document.querySelectorAll('a')].find((x) => /skip to content/i.test(x.textContent)); if (!a) return 'none'; const r = a.getBoundingClientRect(); return r.top >= 0 && r.bottom > 0 && r.left >= 0 && r.width > 1 ? 'VISIBLE' : 'hidden'; })() }));
  console.log(t + 'ms', JSON.stringify(s));
  await p.screenshot({ path: `${out}/nav-${t}.jpg`, quality: 60, type: 'jpeg' });
}
console.log('errors', errs.slice(0, 8), 'failed', fails.slice(0, 8));
await b.close();
