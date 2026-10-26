// Finds hitches: scrolls a page steadily for four seconds and lists every frame over 40 ms with where it
// happened (scroll position in screen heights). Optional CSS is injected first, to test a suspected cause.
// Usage: node scripts/long-frames.mjs <base> <path, without a leading slash> [desktop|phone] [css]
import { chromium, devices } from '@playwright/test';
const [base, path, mode = 'phone', css = ''] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${base}/${path}`);
if (css) await p.addStyleTag({ content: css });
await p.waitForTimeout(2500);
const long = await p.evaluate(() => new Promise((res) => {
  const H = Math.min(document.documentElement.scrollHeight - innerHeight, innerHeight * 6);
  const l = window.__ddLenis, t0 = performance.now(), out = [];
  let last = t0;
  const f = (now) => {
    const dt = now - last; last = now;
    if (dt > 40) out.push([Math.round(dt), Math.round((l ? l.scroll : scrollY) / innerHeight * 100) / 100]);
    const k = (now - t0) / 4000;
    if (l) l.scrollTo(H * Math.min(1, k), { immediate: true }); else scrollTo(0, H * Math.min(1, k));
    if (k < 1) requestAnimationFrame(f); else res(out);
  };
  requestAnimationFrame(f);
}));
console.log(path, mode, css ? `[${css.slice(0, 60)}]` : '', JSON.stringify(long));
await b.close();
