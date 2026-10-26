// 3D hero review: each file's depth diorama at rest, with the pointer to the left and right (the orbit),
// and partway through the scroll push-in. Usage: node scripts/dio-shots.mjs <base> <out> <slug,slug> [desktop|phone]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const [base, out, list, mode = 'desktop'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
for (const slug of list.split(',')) {
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${base}/preview/c/${slug}/`); await p.waitForTimeout(3200);
  const on = await p.evaluate(() => document.documentElement.classList.contains('dio-on'));
  await p.screenshot({ path: `${out}/${slug}-${mode}-1.jpg`, quality: 70, type: 'jpeg' });
  if (mode !== 'phone') {
    await p.mouse.move(150, 450, { steps: 8 }); await p.waitForTimeout(1300);
    await p.screenshot({ path: `${out}/${slug}-${mode}-2-left.jpg`, quality: 70, type: 'jpeg' });
    await p.mouse.move(1300, 300, { steps: 12 }); await p.waitForTimeout(1300);
    await p.screenshot({ path: `${out}/${slug}-${mode}-3-right.jpg`, quality: 70, type: 'jpeg' });
  }
  await p.evaluate(() => window.__ddLenis.scrollTo(document.querySelector('[data-hero]').offsetHeight * 0.45, { immediate: true })); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/${slug}-${mode}-4-push.jpg`, quality: 70, type: 'jpeg' });
  console.log(slug, mode, on ? '3D on' : '3D OFF', errs.length ? errs : 'no errors');
  await p.close();
}
await b.close();
