// Where the main thread goes while scrolling a file: CPU-profiles three seconds of steady scrolling, either on
// a page loaded directly or on one reached by a seamless page change, and lists self time by script and function.
// Usage: node scripts/scroll-profile.mjs <base> <slug> [direct|hop] [desktop|phone]
import { chromium, devices } from '@playwright/test';
const [base, slug = 'steve-rogers', how = 'hop', mode = 'phone'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
if (mode === 'phone') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
if (how === 'hop') {
  await p.goto(`${base}/c/victor-von-doom/`); await p.waitForTimeout(3500);
  await p.evaluate((s) => { const a = document.querySelector(`a[href$="/c/${s}/"]`) || document.querySelector('a.voy-big'); a.click(); }, slug);
} else await p.goto(`${base}/c/${slug}/`);
await p.waitForTimeout(6000);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');
const fps = await p.evaluate(() => new Promise((res) => {
  const l = window.__ddLenis, H = Math.min(document.documentElement.scrollHeight - innerHeight, innerHeight * 5);
  const t0 = performance.now(); let n = 0;
  const f = (now) => { n++; const k = (now - t0) / 3000; l ? l.scrollTo(H * Math.min(1, k), { immediate: true }) : scrollTo(0, H * Math.min(1, k)); k < 1 ? requestAnimationFrame(f) : res(Math.round(n / 3)); };
  requestAnimationFrame(f);
}));
const { profile } = await cdp.send('Profiler.stop');
const dt = profile.timeDeltas, self = new Map();
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
profile.samples.forEach((id, i) => { const n = byId.get(id); const cf = n.callFrame; const key = `${(cf.url || '(native)').split('/').pop()} ${cf.functionName || '(anon)'}:${cf.lineNumber}:${cf.columnNumber}`; self.set(key, (self.get(key) || 0) + (dt[i] || 0) / 1000); });
const total = [...self.values()].reduce((a, v) => a + v, 0);
console.log(`${slug} ${how} ${mode}: ${fps} fps, profiled ${Math.round(total)} ms`);
[...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, v]) => console.log(`  ${Math.round(v).toString().padStart(5)} ms  ${k}`));
const bin = new Map(); for (const [k, v] of self) { const f = k.split(' ')[0]; bin.set(f, (bin.get(f) || 0) + v); }
console.log('  by script:', [...bin.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${Math.round(v)}`).join(' | '));
await b.close();
