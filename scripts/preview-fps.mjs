// Frame rate while scrolling through v2 pages, CPU throttled (default 4x) to stand in for a mid-range phone.
// Usage: node scripts/preview-fps.mjs <base> [throttle] [desktop|phone]
import { chromium, devices } from '@playwright/test';
const [base, rate = '4', mode = 'phone'] = process.argv.slice(2);
const pages = ['/preview/', '/preview/c/thor/', '/preview/c/victor-von-doom/', '/preview/teams/avengers/', '/preview/versus/', '/preview/predictions/', '/preview/timeline/'];
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
for (const path of pages) {
  const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('dd-intro-seen', '1'); } catch {} });
  const p = await ctx.newPage();
  await p.goto(base + path); await p.waitForTimeout(2500);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(rate) });
  const r = await p.evaluate(() => new Promise((res) => {
    const H = Math.min(document.documentElement.scrollHeight - innerHeight, innerHeight * 6);
    const l = window.__ddLenis; const t0 = performance.now(); const times = []; let last = t0;
    const f = (now) => {
      times.push(now - last); last = now;
      const k = (now - t0) / 4000;
      if (l) l.scrollTo(H * Math.min(1, k), { immediate: true });
      if (k < 1) requestAnimationFrame(f); else {
        times.shift(); times.sort((a, b) => a - b);
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        res({ fps: Math.round(1000 / avg), p95: Math.round(times[Math.floor(times.length * 0.95)]), long: times.filter((x) => x > 50).length });
      }
    };
    requestAnimationFrame(f);
  }));
  console.log(path.padEnd(30), `${r.fps} fps, 95th percentile frame ${r.p95} ms, frames over 50 ms: ${r.long}`);
  await ctx.close();
}
await b.close();
