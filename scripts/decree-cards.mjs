// Decree cards: seals a decree on a phone and saves both images (16:9 and the 9:16 story), plus a still of the
// buttons, to check the layouts. node scripts/decree-cards.mjs <base> <outdir> [recipient]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const base = (process.argv[2] || 'http://localhost:4322').replace(/\/$/, '');
const out = process.argv[3] || 'screenshots/decree';
const who = process.argv[4] || 'All who would stand against Doom';
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['Pixel 7'], acceptDownloads: true });
await ctx.addInitScript(() => { try { sessionStorage.setItem('dd-os-booted', '1'); } catch {} });
const p = await ctx.newPage();
await p.goto(`${base}/chamber/`); await p.waitForTimeout(3000);
await p.selectOption('[data-dc-to]', who);
await p.fill('[data-dc-text]', 'Kneel before Doom, for Latveria rises and every hero who stands in the way of His Majesty will be remembered only as a footnote in the history of his reign.');
await p.click('[data-dc-seal]');
for (const fmt of ['wide', 'story']) {
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click(`[data-dc-card="${fmt}"]`)]);
  await dl.saveAs(`${out}/${dl.suggestedFilename()}`);
  console.log('saved', dl.suggestedFilename());
}
await p.locator('.decree').screenshot({ path: `${out}/panel.png` });
await b.close();
