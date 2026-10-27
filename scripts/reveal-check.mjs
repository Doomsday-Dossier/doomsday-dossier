// Scrolls each page to the bottom and back, then lists any block or title left hidden by a reveal that never
// started (scripts/dossier/reveal.ts: [data-settle] without .in, a split [data-rise] without .in), arriving both
// by a direct load and by a page change.
// Usage: node scripts/reveal-check.mjs <base> [desktop|phone]
import { chromium, devices } from '@playwright/test';
const [base, mode = 'desktop'] = process.argv.slice(2);
const PAGES = ['c/victor-von-doom/', 'c/reed-richards/', 'teams/x-men/', 'timeline/', 'versus/', 'catch-up/', 'predictions/', 'quiz/', 'about/', 'credits/'];
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const sweep = () => p.evaluate(async () => {
  const l = window.__ddLenis, H = document.documentElement.scrollHeight;
  for (let y = 0; y <= H; y += innerHeight * 0.5) { l ? l.scrollTo(y, { immediate: true }) : scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); }
  await new Promise((r) => setTimeout(r, 400));
  const stuck = [...document.querySelectorAll('[data-settle]:not(.in), [data-rise].split:not(.in)')].filter((el) => !el.closest('[inert]'));
  return { settle: document.querySelectorAll('[data-settle]').length, rise: document.querySelectorAll('[data-rise]').length, stuck: stuck.map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`).slice(0, 5), stuckN: stuck.length };
});
let bad = 0;
for (const path of PAGES) {
  await p.goto(`${base}/${path}`); await p.waitForTimeout(1500);
  const r = await sweep(); bad += r.stuckN;
  console.log(r.stuckN ? 'FAIL' : 'ok  ', 'direct', path, JSON.stringify(r));
}
// by page changes: from a file to each page through its link, where one is on the page
await p.goto(`${base}/c/thor/`); await p.waitForTimeout(1500);
for (const path of ['timeline/', 'quiz/', 'c/loki/']) {
  await p.evaluate((h) => { const a = document.createElement('a'); a.href = h; document.body.append(a); a.click(); }, `${base}/${path}`);
  await p.waitForTimeout(300);
  await p.waitForFunction(() => !document.querySelector('[data-pt].on, [data-ho].on'), null, { timeout: 8000 });
  await p.waitForTimeout(500);
  const r = await sweep(); bad += r.stuckN;
  console.log(r.stuckN ? 'FAIL' : 'ok  ', 'change', path, JSON.stringify(r));
}
console.log(bad ? `${bad} hidden` : 'nothing left hidden', '| page errors:', errs.length ? errs.slice(0, 4) : 'none');
await b.close();
