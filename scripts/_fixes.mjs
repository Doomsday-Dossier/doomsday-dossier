import { chromium, devices } from '@playwright/test';
const base = 'http://localhost:4322', out = process.argv[2];
const b = await chromium.launch({ args: ['--use-gl=angle'] });
// 1. stale file guard: the first request for the global stylesheet 404s, the page must reload itself styled
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
  let failed = 0;
  await p.route(/\/_astro\/about\.[^/]+\.css$/, (r) => { if (!failed++) return r.fulfill({ status: 404, body: 'gone' }); return r.continue(); });
  let loads = 0; p.on('load', () => loads++);
  await p.goto(base + '/c/sam-wilson/'); await p.waitForTimeout(3500);
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log('guard: css 404s', failed, 'times, page loads', loads, 'body bg', bg, bg !== 'rgba(0, 0, 0, 0)' ? 'ok (styled)' : 'FAIL');
  await ctx.close();
}
// 2. Sam's screen act: heading and year inside their column
for (const [n, vp] of [['desktop', { width: 1440, height: 900 }], ['laptop', { width: 1280, height: 720 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  for (const slug of ['sam-wilson', 'victor-von-doom', 'magneto', 'mbaku', 'bucky-barnes']) {
    await p.goto(`${base}/c/${slug}/`); await p.waitForTimeout(1500);
    await p.evaluate(() => document.querySelector('.act-screen').scrollIntoView()); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const side = document.querySelector('.scr-side').getBoundingClientRect();
      const words = [...document.querySelectorAll('.scr-side .act-title .split-word, .scr-side .act-title')].map((w) => w.getBoundingClientRect().right);
      const y = document.querySelector('.scr-year').getBoundingClientRect();
      return { titleOver: Math.max(...words) - side.right, yearOver: y.right - side.right };
    });
    const ok = r.titleOver <= 1 && r.yearOver <= 1;
    console.log(ok ? 'ok  ' : 'FAIL', n, slug, 'title overhang', Math.round(r.titleOver), 'year overhang', Math.round(r.yearOver));
    if (slug === 'sam-wilson') await p.screenshot({ path: `${out}/sam-screen-${n}.jpg`, quality: 70, type: 'jpeg' });
  }
}
// 3. catch-up: title descender and days agree with the countdown
{
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto(base + '/catch-up/?c=thor'); await p.waitForTimeout(3000);
  const t = await p.evaluate(() => { const h = document.querySelector('.cu-title'); const lines = [...h.querySelectorAll('.split-line')]; return lines.map((l) => { const r = l.getBoundingClientRect(); const inner = [...l.querySelectorAll('.split-word')].map((w) => w.getBoundingClientRect().bottom); return Math.round(r.bottom - Math.max(...inner)); }); });
  const meta = await p.textContent('[data-meta]');
  await p.goto(base + '/'); await p.waitForTimeout(2500);
  const cd = await p.evaluate(() => document.querySelector('[data-countdown] [data-k="d"]')?.textContent);
  console.log('catch-up mask room below words (px, >= 0 is ok):', t.join(','), '| planner:', meta.match(/\d+ days?/)?.[0], '| countdown days:', cd);
  await p.goto(base + '/catch-up/'); await p.waitForTimeout(3000);
  await p.screenshot({ path: `${out}/catchup-title.jpg`, quality: 70, type: 'jpeg', clip: { x: 0, y: 0, width: 1440, height: 520 } });
}
await b.close();
