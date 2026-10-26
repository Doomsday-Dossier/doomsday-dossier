import { chromium, devices } from '@playwright/test';
const base = process.argv[2];
const b = await chromium.launch({ args: ['--use-gl=angle'] });
for (const path of ['/', '/c/thor/', '/versus/', '/catch-up/', '/quiz/']) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (2 * 1024 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const by = {}; let total = 0;
  cdp.on('Network.loadingFinished', (e) => { total += e.encodedDataLength; });
  const types = new Map();
  cdp.on('Network.responseReceived', (e) => types.set(e.requestId, { type: e.type, url: e.response.url }));
  cdp.on('Network.loadingFinished', (e) => { const t = types.get(e.requestId); if (!t) return; const k = t.type; by[k] = (by[k] || 0) + e.encodedDataLength; });
  await p.addInitScript(() => { window.__lcp = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); });
  const t0 = Date.now();
  await p.goto(base + path, { waitUntil: 'load', timeout: 90000 });
  const loadMs = Date.now() - t0;
  await p.waitForTimeout(5000);
  const m = await p.evaluate(() => ({ fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0), lcp: Math.round(window.__lcp), dcl: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd) }));
  const kb = (n) => Math.round(n / 1024);
  console.log(path.padEnd(12), `FCP ${m.fcp}ms  LCP ${m.lcp}ms  DCL ${m.dcl}ms  load ${loadMs}ms  total ${kb(total)} KB`, Object.entries(by).map(([k, v]) => `${k} ${kb(v)}`).join(', '));
  await ctx.close();
}
await b.close();
