// One grid image of hero views, for quick review of several scenes at once.
// Usage: node scripts/heroes.mjs <baseUrl> <out.jpg> <slug,slug,...> [phone]
import { chromium, devices } from '@playwright/test';
const [base, out, list, mode] = process.argv.slice(2);
const phone = mode === 'phone';
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(phone ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1280, height: 760 } });
const shots = [];
for (const slug of list.split(',')) {
  const page = await ctx.newPage();
  await page.goto(`${base.replace(/\/$/, '')}/c/${slug}/`, { waitUntil: 'load' });
  if (!phone) { await page.mouse.move(700, 380, { steps: 5 }); await page.waitForTimeout(1500); await page.mouse.move(820, 300, { steps: 20 }); }
  await page.waitForTimeout(3500);
  if (!phone) await page.mouse.move(760, 420, { steps: 15 });
  await page.waitForTimeout(400);
  shots.push({ slug, img: (await page.screenshot({ type: 'jpeg', quality: 75 })).toString('base64') });
  await page.close();
}
const sheet = await b.newPage({ viewport: { width: 2400, height: 900 } });
await sheet.setContent(`<body style="margin:0;background:#111;color:#aaa;font:13px monospace"><div style="display:grid;grid-template-columns:repeat(${phone ? 7 : 3},1fr);gap:8px;padding:8px">${shots.map((s) => `<div>${s.slug}<img style="width:100%;display:block" src="data:image/jpeg;base64,${s.img}"></div>`).join('')}</div></body>`);
await sheet.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 80 });
await b.close();
