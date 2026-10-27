// Checks a build made with the live base path (/doomsday-dossier/): every page type loads, scrolls and
// changes page without a request failing (photos, depth maps, scripts, fonts) and without a page error.
// Usage: node scripts/base-check.mjs <base, e.g. http://localhost:4323/doomsday-dossier>
import { chromium } from '@playwright/test';
const [base] = process.argv.slice(2);
const PAGES = ['', 'c/victor-von-doom/', 'c/thor/', 'teams/fantastic-four/', 'versus/', 'timeline/', 'catch-up/', 'predictions/', 'quiz/', 'about/', 'credits/', 'lab/sounds/'];
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const bad = [];
p.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
p.on('requestfailed', (r) => { if (!/favicon/.test(r.url())) bad.push(`failed ${r.url()} ${r.failure()?.errorText}`); });
p.on('pageerror', (e) => bad.push(`error ${e.message}`));
for (const path of PAGES) {
  const r = await p.goto(`${base}/${path}`);
  if (!r || r.status() >= 400) bad.push(`${r?.status()} page ${path}`);
  await p.waitForTimeout(1200);
  for (let i = 1; i <= 6; i++) { await p.mouse.wheel(0, 900); await p.waitForTimeout(250); }
  await p.waitForTimeout(600);
}
// a seamless page change from a file to the next file, and from the menu
await p.goto(`${base}/c/victor-von-doom/`); await p.waitForTimeout(1200);
await p.evaluate(() => (window.__ddMarker = 1));
await p.locator('a.voy-big').click({ force: true }); await p.waitForTimeout(2500);
const kept = await p.evaluate(() => window.__ddMarker === 1);
console.log('seamless change kept the session:', kept, '| now at', p.url());
console.log(bad.length ? bad.join('\n') : 'no failed requests or page errors');
await b.close();
