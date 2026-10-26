// Review frames for v2 character files: hero, push-in, subject, exhibits, next-file window.
// Usage: node scripts/files-shots.mjs <base> <out dir> <slug,slug> [desktop|phone]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const [base, out, list, mode = 'desktop'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
for (const slug of list.split(',')) {
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${base}/c/${slug}/`); await p.waitForTimeout(2600);
  const go = async (y) => { await p.evaluate((y) => window.__ddLenis.scrollTo(y, { immediate: true }), y); await p.waitForTimeout(1100); };
  const at = (sel, f = 0) => p.evaluate(([s, f]) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY + e.offsetHeight * f : 0; }, [sel, f]);
  await p.screenshot({ path: `${out}/${slug}-${mode}-1-hero.jpg`, quality: 70, type: 'jpeg' });
  await go(await at('[data-hero]', 0.4)); await p.screenshot({ path: `${out}/${slug}-${mode}-2-push.jpg`, quality: 70, type: 'jpeg' });
  await go((await at('[data-open]')) + (await p.evaluate(() => document.querySelector('[data-open]').offsetHeight - innerHeight)) * 0.97); await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/${slug}-${mode}-3-open.jpg`, quality: 70, type: 'jpeg' });
  await go(await at('[data-sub-pin]', 0.42)); await p.screenshot({ path: `${out}/${slug}-${mode}-4-subject.jpg`, quality: 70, type: 'jpeg' });
  await go((await at('[data-exhibits]')) + 200); await p.screenshot({ path: `${out}/${slug}-${mode}-5-exhibits.jpg`, quality: 70, type: 'jpeg' });
  await go((await at('[data-voyage]')) ); await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${slug}-${mode}-6-next.jpg`, quality: 70, type: 'jpeg' });
  console.log(slug, mode, errs.length ? errs : 'no errors');
  await p.close();
}
await b.close();
