// Frame rate of a home version while scrolling through the mask and into the archive.
// Usage: node scripts/home-fps.mjs <base> <1|2> [desktop|phone]
import { chromium, devices } from '@playwright/test';
const [base, v = '1', mode = 'desktop'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
await p.goto(`${base}/lab/home-${v}/?first`);
await p.waitForFunction(() => window.__forgeReady, null, { timeout: 30000 });
await p.evaluate(() => { window.__forgeBegin(); window.__forgeSeek(7.4); });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const out = [];
  for (const [a, z] of [[0, 2.2], [2.2, 6]]) {
    window.__ddLenis.scrollTo(a * innerHeight, { immediate: true, force: true });
    await new Promise((r) => setTimeout(r, 400));
    window.__ddLenis.scrollTo(z * innerHeight, { duration: 4, force: true });
    const ts = []; const t0 = performance.now();
    await new Promise((res) => { const f = (n) => { ts.push(n); n - t0 < 4000 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
    const gaps = ts.slice(1).map((t, i) => t - ts[i]).sort((x, y) => x - y);
    out.push({ span: `${a}-${z}`, fps: +(1000 * (ts.length - 1) / (ts.at(-1) - ts[0])).toFixed(1), p95: +gaps[Math.floor(gaps.length * 0.95)].toFixed(1) });
  }
  return out;
});
console.log(v, mode, JSON.stringify(r));
await b.close();
