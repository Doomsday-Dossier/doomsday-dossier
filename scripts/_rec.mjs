import { chromium, devices } from '@playwright/test';
const out = process.argv[2];
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
for (const [n, o] of [['desk', { viewport: { width: 1440, height: 900 } }], ['phone', { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }]]) {
  const p = await (await b.newContext(o)).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:4323/preview/c/thor/'); await p.waitForTimeout(2400);
  if (n === 'desk') { await p.mouse.move(300, 300, { steps: 6 }); await p.mouse.move(1100, 650, { steps: 10 }); await p.waitForTimeout(900); }
  await p.screenshot({ path: `${out}/r-${n}-0hero.jpg`, quality: 65, type: 'jpeg' });
  const rec = await p.evaluate(() => { const r = document.querySelector('[data-record]'); return { t: r.getBoundingClientRect().top + scrollY, h: r.offsetHeight - innerHeight }; });
  for (const f of [0.0, 0.12, 0.45, 0.8, 1]) { await p.evaluate((y) => window.__ddLenis.scrollTo(y, { immediate: true }), rec.t + rec.h * f); await p.waitForTimeout(1300); await p.screenshot({ path: `${out}/r-${n}-${String(Math.round(f * 100)).padStart(3, '0')}.jpg`, quality: 65, type: 'jpeg' }); }
  await p.evaluate((y) => window.__ddLenis.scrollTo(y, { immediate: true }), rec.t + rec.h * 0.45); await p.waitForTimeout(900);
  const btn = await p.$$('[data-read]'); const vis = []; for (const x of btn) if (await x.isVisible() && (await x.boundingBox())?.x > 0 && (await x.boundingBox())?.x < o.viewport.width - 50) vis.push(x);
  if (vis[0]) { await vis[0].click(); await p.waitForTimeout(1100); await p.screenshot({ path: `${out}/r-${n}-drawer.jpg`, quality: 65, type: 'jpeg' }); }
  const d = await p.evaluate(() => ({ open: document.querySelector('[data-drawer]').classList.contains('is-open'), text: document.querySelector('[data-drawer-body]').textContent.trim().slice(0, 60) }));
  await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  const back = await p.evaluate(() => !!document.querySelector('[data-rec-chapters] #ch-comics, [data-rec-chapters] #ch-screen, [data-rec-chapters] #ch-origin'));
  // a page change: click the next-file link
  await p.evaluate(() => window.__ddLenis.scrollTo(document.querySelector('[data-voyage]').getBoundingClientRect().top + scrollY, { immediate: true })); await p.waitForTimeout(1000);
  await p.click('.voy-big'); await p.waitForTimeout(350);
  await p.screenshot({ path: `${out}/r-${n}-pt.jpg`, quality: 65, type: 'jpeg' }).catch(() => {});
  await p.waitForTimeout(2500);
  const landed = await p.evaluate(() => ({ url: location.pathname, cover: getComputedStyle(document.querySelector('[data-pt]')).transform }));
  console.log(n, JSON.stringify({ drawer: d, chapterBack: back, landed }), errs.length ? errs : 'no errors');
}
await b.close();
