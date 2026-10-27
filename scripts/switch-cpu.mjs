// CPU profile of a seamless page change (click to settled): self time by function, to see what the next page
// spends its time on while it builds. Build with NOMINIFY=1 for readable names.
// Usage: node scripts/switch-cpu.mjs <base> [from-slug] [desktop|phone]
import { chromium, devices } from '@playwright/test';
const [base, from = 'victor-von-doom', mode = 'phone'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await p.goto(`${base}/c/${from}/?perf`); await p.waitForTimeout(3000);
if (mode === 'phone') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
await cdp.send('Profiler.start');
await p.evaluate(() => document.querySelector('a.voy-big').click());
await p.waitForTimeout(mode === 'phone' ? 5000 : 3000);
const { profile } = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map(); profile.nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)));
const self = new Map(), total = new Map();
profile.samples.forEach((id, i) => {
  const ms = (profile.timeDeltas[i] || 0) / 1000;
  const cf = byId.get(id).callFrame;
  const k = `${cf.functionName || '(anon)'} ${(cf.url || '').split('/').pop()}:${cf.lineNumber + 1}`;
  self.set(k, (self.get(k) || 0) + ms);
  // inclusive time: every distinct frame on the stack
  const seen = new Set();
  for (let n = id; n; n = parent.get(n)) { const f = byId.get(n).callFrame; const kk = `${f.functionName || '(anon)'} ${(f.url || '').split('/').pop()}:${f.lineNumber + 1}`; if (!seen.has(kk)) { seen.add(kk); total.set(kk, (total.get(kk) || 0) + ms); } }
});
const top = (m, n) => [...m.entries()].filter(([k]) => !/^\((idle|program|root|garbage collector)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${String(Math.round(v)).padStart(5)} ms  ${k}`).join('\n');
console.log(`== ${mode}: self ==\n${top(self, 18)}\n== inclusive ==\n${top(total, 30)}`);
await b.close();
