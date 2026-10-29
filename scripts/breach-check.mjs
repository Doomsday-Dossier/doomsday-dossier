// The breach (scripts/os/trace.ts), played through on a local build: each hero's takeover, a won fight (every node
// cut) and a lost one (the file stolen, then taken back). Stills along the way.
// node scripts/breach-check.mjs <base> <outdir> [phone|desktop] [heroes]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const base = (process.argv[2] || 'http://localhost:4322').replace(/\/$/, '');
const out = process.argv[3] || 'screenshots/breach';
const dev = process.argv[4] === 'desktop' ? { viewport: { width: 1440, height: 900 } } : devices['Pixel 7'];
const heroes = (process.argv[5] || 'loki,professor-x,nightcrawler,ghost,shuri,thor').split(',');
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ...dev });
await ctx.addInitScript(() => { try { sessionStorage.setItem('dd-os-booted', '1'); } catch {} });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`${base}/c/magneto/`); await p.waitForTimeout(4000);
await p.waitForFunction(() => window.__breach);
for (const [i, h] of heroes.entries()) {
  const win = i % 2 === 0;
  await p.evaluate(([h]) => { window.__breach(h, 'thor'); }, [h]);
  await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${h}-1.png` });
  await p.waitForSelector('.br-node', { timeout: 15000 });
  await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${h}-2-fight.png` });
  if (win) {
    for (const n of await p.locator('.br-node').all()) { await n.click({ force: true }); await p.waitForTimeout(120); }
    await p.waitForTimeout(1300); await p.screenshot({ path: `${out}/${h}-3-won.png` });
  } else {
    await p.waitForTimeout(8600); await p.screenshot({ path: `${out}/${h}-3-lost.png` });
  }
  await p.waitForSelector('.breach', { state: 'detached', timeout: 15000 });
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('dd-reign') || '{}').stolen);
  console.log(h, win ? 'won' : 'lost', 'stolen:', JSON.stringify(st));
}
// the stolen file, and taking it back
await p.goto(`${base}/c/thor/`); await p.waitForTimeout(3500);
const stolen = p.locator('.stolen');
console.log('stolen panel on thor:', await stolen.count());
if (await stolen.count()) {
  await p.screenshot({ path: `${out}/thor-stolen.png` });
  await stolen.locator('button').click(); await p.waitForTimeout(900);
  console.log('after take back:', await p.locator('.stolen').count(), await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('dd-reign')).stolen)));
}
console.log('page errors:', errs.length ? errs : 'none');
await b.close();
