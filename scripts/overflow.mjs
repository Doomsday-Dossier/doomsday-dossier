// Lists elements wider than a phone viewport on each page.
// Usage: node scripts/overflow.mjs [baseUrl]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://localhost:4321').replace(/\/$/, '');
function pages(dir = 'dist', rel = '') {
  const res = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith('_')) res.push(...pages(dir, path.join(rel, e.name)));
    else if (e.name === 'index.html') res.push('/' + rel.split(path.sep).join('/') + (rel ? '/' : ''));
  }
  return res;
}
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 } });
let bad = 0;
for (const p of pages().sort()) {
  const page = await ctx.newPage();
  await page.goto(base + p, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const out = [];
    document.querySelectorAll('body *').forEach((el) => {
      const rc = el.getBoundingClientRect();
      if (rc.right > W + 1 && rc.width > 0 && getComputedStyle(el).position !== 'fixed') {
        let clipped = false; let a = el.parentElement;
        while (a && a !== document.documentElement) { const o = getComputedStyle(a).overflowX; if (o === 'hidden' || o === 'clip') { clipped = true; break; } a = a.parentElement; }
        if (!clipped) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} right=${Math.round(rc.right)}`);
      }
    });
    return { W, vv: Math.round(visualViewport.width), out: out.slice(0, 5) };
  });
  const ok = r.vv <= r.W && r.out.length === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${p.padEnd(26)} viewport=${r.W} visual=${r.vv} ${r.out.join(' | ')}`);
  await page.close();
}
await b.close();
process.exit(bad ? 1 : 0);
