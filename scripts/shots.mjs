// Screenshots of every page at desktop and phone width.
// Usage: node scripts/shots.mjs [baseUrl] [outDir] [pathFilter]
// Each page gets a contact sheet of frames taken while scrolling top to bottom.
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://localhost:4321').replace(/\/$/, '');
const out = process.argv[3] || 'screenshots/latest';
const filter = process.argv[4] || '';
fs.mkdirSync(out, { recursive: true });

// Discover pages from the build output.
function pages(dir = 'dist', rel = '') {
  const res = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith('_')) res.push(...pages(dir, path.join(rel, e.name)));
    else if (e.name === 'index.html') res.push('/' + rel.split(path.sep).join('/') + (rel ? '/' : ''));
  }
  return res;
}
const list = pages().filter((p) => p.includes(filter)).sort();

const VIEWS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
};
const FRAMES = { desktop: 6, phone: 6 };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const report = [];
for (const [name, opts] of Object.entries(VIEWS)) {
  const ctx = await browser.newContext(opts);
  for (const p of list) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(base + p, { waitUntil: 'load' });
    if (name === 'desktop') await page.mouse.move(opts.viewport.width * 0.62, opts.viewport.height * 0.42, { steps: 8 });
    await page.waitForTimeout(3800);
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const shots = [];
    const n = FRAMES[name];
    for (let i = 0; i < n; i++) {
      const y = Math.round((total * i) / (n - 1));
      await page.evaluate((y) => window.scrollTo(0, y), y);
      if (name === 'desktop') await page.mouse.move(opts.viewport.width * (0.3 + 0.1 * i), opts.viewport.height * 0.5, { steps: 6 });
      await page.waitForTimeout(i === 0 ? 400 : 1600);
      const buf = await page.screenshot({ type: 'jpeg', quality: 78 });
      shots.push(buf.toString('base64'));
    }
    // Contact sheet
    const sheet = await ctx.browser().newPage({ viewport: { width: name === 'desktop' ? 2400 : 2400, height: 1000 }, deviceScaleFactor: 1 });
    const cols = name === 'desktop' ? 3 : 6;
    await sheet.setContent(`<html><body style="margin:0;background:#111;font:14px monospace;color:#bbb">
      <div style="padding:14px 18px">${p} &middot; ${name} &middot; ${n} frames top to bottom</div>
      <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px;padding:0 18px 18px">
      ${shots.map((s) => `<img style="width:100%;display:block;border:1px solid #333" src="data:image/jpeg;base64,${s}">`).join('')}
      </div></body></html>`);
    await sheet.waitForTimeout(200);
    const slug = p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/\//g, '-');
    const file = path.join(out, `${slug}-${name}.jpg`);
    await sheet.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 82 });
    await sheet.close();
    report.push({ page: p, view: name, file, errors });
    console.log(`${name.padEnd(8)} ${p.padEnd(28)} ${errors.length ? 'ERRORS: ' + errors.join(' | ') : 'ok'}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
