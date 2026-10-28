// Timeline probe: the multiverse stage at full resolution at set points of the scroll, desktop and phone.
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const base = process.argv[2] || 'http://localhost:4322', out = process.argv[3] || 'screenshots/tl-probe';
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle'] });
for (const mode of ['desktop', 'phone']) {
  const ctx = await b.newContext(mode === 'phone' ? devices['Pixel 7'] : { viewport: { width: 1440, height: 860 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('dd-os-booted', '1'); } catch {} });
  const p = await ctx.newPage();
  await p.goto(`${base}/timeline/`); await p.waitForTimeout(2500);
  const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (const f of [0.08, 0.3, 0.5, 0.7, 0.85, 0.97]) {
    await p.evaluate((y) => scrollTo(0, y), Math.round(H * f)); await p.waitForTimeout(1600);
    await p.screenshot({ path: `${out}/${mode}-${Math.round(f * 100)}.png` });
  }
  await ctx.close();
}
await b.close(); console.log('ok');
