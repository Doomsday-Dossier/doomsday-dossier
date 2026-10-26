// Frame times during wave 7 interactions, CPU throttled (default 4x).
// Usage: node scripts/interaction-fps.mjs [baseUrl] [throttle]
import { chromium } from '@playwright/test';
const base = (process.argv[2] || 'http://localhost:4322').replace(/\/$/, '');
const throttle = Number(process.argv[3] || 4);
const b = await chromium.launch({ args: ['--use-gl=angle'] });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
const startRec = () => page.evaluate(() => { window.__ft = []; let last = performance.now(); const tick = (t) => { window.__ft.push(t - last); last = t; if (window.__rec) requestAnimationFrame(tick); }; window.__rec = true; requestAnimationFrame(tick); });
const stopRec = async (label) => {
  const ft = await page.evaluate(() => { window.__rec = false; return window.__ft.slice(2); });
  ft.sort((a, b) => a - b);
  const avg = ft.reduce((s, x) => s + x, 0) / ft.length;
  console.log(`${label.padEnd(34)} avg ${Math.round(1000 / avg)} fps   p95 ${ft[Math.floor(ft.length * 0.95)].toFixed(1)} ms   (${ft.length} frames)`);
};
const settle = (ms) => page.waitForTimeout(ms);

await page.goto(`${base}/`); await settle(3500);
await page.evaluate(() => { document.querySelector('.picker').scrollIntoView(); scrollBy(0, -160); }); await settle(1500);
await startRec(); await page.click('.pk-chips button[data-team="x-men"]'); await settle(1200); await page.click('.pk-chips button[data-team="all"]'); await settle(1200); await stopRec('home: team filter (Flip)');
await page.click('.pk-chips button[data-team="avengers"]'); await settle(1300);
const box = await page.locator('.pk-grid .card:not(.pk-out)').nth(1).boundingBox();
await startRec(); await page.mouse.move(box.x + 100, box.y + 120); await page.mouse.down();
for (let i = 1; i <= 30; i++) { await page.mouse.move(box.x + 100 + Math.sin(i / 4) * 300, box.y + 120 + i * 4); await settle(16); }
await page.mouse.up(); await settle(1000); await stopRec('home: team chain drag');

await page.goto(`${base}/timeline/`); await settle(3000);
await page.evaluate(() => document.querySelector('[data-reel]').scrollIntoView({ block: 'center' })); await settle(800);
const sb = await page.locator('[data-strip]').boundingBox();
await startRec();
for (let k = 0; k < 3; k++) { await page.mouse.move(sb.x + sb.width * 0.85, sb.y + 200); await page.mouse.down(); for (let i = 1; i <= 8; i++) { await page.mouse.move(sb.x + sb.width * 0.85 - i * 110, sb.y + 200); await settle(12); } await page.mouse.up(); await settle(900); }
await stopRec('timeline: fling with burn');

await page.goto(`${base}/versus/`); await settle(3000);
await page.evaluate(() => { document.querySelector('.vs-stage').scrollIntoView(); scrollBy(0, -80); }); await settle(1000);
await startRec();
for (const s of ['thor', 'magneto', 'sue-storm', 'bob-reynolds']) { await page.click(`[data-pick="${s}"]`); await settle(1000); }
await stopRec('versus: switching characters');

await page.goto(`${base}/c/shuri/`); await settle(3000);
const start = await page.evaluate(() => document.querySelector('.act-comics').getBoundingClientRect().top + scrollY);
await page.evaluate((y) => scrollTo(0, y), start); await settle(800);
await startRec();
for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 120); await settle(40); }
await settle(800); await stopRec('character: Panel Flythrough scroll');
await b.close();
