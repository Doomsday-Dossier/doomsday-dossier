// Hops file to file (the "next file" link) several times and, after each hop, scrolls for three seconds:
// shows whether page changes leave something behind that makes each page slower than the last.
// Usage: node scripts/switch-chain.mjs <base> [hops] [desktop|phone]
import { chromium, devices } from '@playwright/test';
const [base, hops = '6', mode = 'phone'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
if (mode === 'phone') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const scroll = () => p.evaluate(() => new Promise((res) => {
  const l = window.__ddLenis, H = Math.min(document.documentElement.scrollHeight - innerHeight, innerHeight * 5);
  const t0 = performance.now(); let last = t0, n = 0, long = 0;
  const f = (now) => { const dt = now - last; last = now; n++; if (dt > 34) long++;
    const k = (now - t0) / 3000; l ? l.scrollTo(H * Math.min(1, k), { immediate: true }) : scrollTo(0, H * k);
    if (k < 1) requestAnimationFrame(f); else { l?.scrollTo(0, { immediate: true }); res({ fps: Math.round(n / 3), long, heap: Math.round(performance.memory.usedJSHeapSize / 1e6), nodes: document.getElementsByTagName('*').length, st: window.ScrollTrigger?.getAll().length, tweens: window.gsap?.globalTimeline.getChildren(true, true, false).length }); } };
  requestAnimationFrame(f);
}));
await p.goto(`${base}/c/victor-von-doom/`); await p.waitForTimeout(3500);
console.log(mode, 'start ', p.url().split('/c/')[1], JSON.stringify(await scroll()));
for (let i = 0; i < Number(hops); i++) {
  await p.evaluate(() => document.querySelector('a.voy-big').click());
  await p.waitForTimeout(Number(process.env.WAIT || 4000));
  const [gpu] = await Promise.all([p.evaluate(() => performance.getEntriesByType('resource').length)]);
  console.log(mode, `hop ${i + 1}`, p.url().split('/c/')[1], JSON.stringify(await scroll()), 'resources', gpu);
}
await b.close();
