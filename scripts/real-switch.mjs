// A reader's switch, as reported: open a file directly, read all the way down it (wheel scrolling, clearance
// requested on the way), then open another file from the list at the foot. Times each stage of the page change
// and lists every long frame, with the scripts Chrome blames, from the click until the next page is settled.
// Phone mode slows the CPU 4x and the network to a fast 4G.
// Usage: node scripts/real-switch.mjs <base> [from] [to] [desktop|phone]
import { chromium, devices } from '@playwright/test';
const [base, from = 'steve-rogers', to = 'thor', mode = 'phone'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
if (mode === 'phone') {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.RATE) || 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (9e6 / 8), uploadThroughput: (1.5e6 / 8) });
}
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`${base}/c/${from}/`);
await p.waitForTimeout(3000);
await p.mouse.click(200, 300); // the first tap starts the sound
await p.waitForTimeout(1500);
// read down the file: wheel steps, as a hand would, requesting clearance on the way
const H = await p.evaluate(() => document.documentElement.scrollHeight);
const vp = p.viewportSize();
let y = 0, asked = 0;
while (y < H) {
  await p.mouse.move(vp.width / 2, vp.height / 2);
  await p.mouse.wheel(0, 420); await p.waitForTimeout(110);
  y = await p.evaluate(() => (window.__ddLenis ? window.__ddLenis.scroll : scrollY) + innerHeight);
  if (process.env.CLEAR !== '0') for (const n of [2, 3]) {
    if (asked < n && await p.evaluate((n) => { const b = document.querySelector(`[data-request="${n}"]`); if (!b || !b.offsetParent) return false; const r = b.getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; }, n)) {
      await p.click(`[data-request="${n}"]`); asked = n; await p.waitForTimeout(1500);
    }
  }
  if (await p.evaluate(() => { const v = document.querySelector('.voy-list'); return v && v.getBoundingClientRect().top < innerHeight * 0.5; })) break;
}
await p.waitForTimeout(1200);
await p.evaluate(() => {
  const w = window; w.__t = { marks: [], loaf: [], gaps: [] };
  const m = (n) => w.__t.marks.push([n, Math.round(performance.now())]);
  for (const el of document.querySelectorAll('[data-pt], [data-ho]')) {
    let was = el.className;
    new MutationObserver(() => { const c = el.className; if (c !== was) { m(`${el.dataset.ho !== undefined ? 'ho' : 'pt'}[${c.replace(/^(pt|ho)\s*/, '') || '-'}]`); was = c; } }).observe(el, { attributes: true, attributeFilter: ['class'] });
  }
  new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__t.loaf.push({
    at: Math.round(e.startTime), dur: Math.round(e.duration), render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0),
    scripts: e.scripts.map((s) => `${Math.round(s.duration)}ms ${s.invokerType}:${s.invoker} ${(s.sourceURL || '').split('/').pop()}:${s.sourceFunctionName || ''}@${s.sourceCharPosition}`).slice(0, 4),
  }))).observe({ type: 'long-animation-frame', buffered: false });
  let last = performance.now();
  const f = (now) => { if (now - last > 50) w.__t.gaps.push([Math.round(last), Math.round(now - last)]); last = now; requestAnimationFrame(f); };
  requestAnimationFrame(f);
});
const sel = process.env.LINK || `.voy-list a[href*="/c/${to}/"]`;
const t0 = await p.evaluate((sel) => { const t = performance.now(); window.__t.marks.push(['click', Math.round(t)]); document.querySelector(sel).click(); return t; }, sel);
await p.waitForTimeout(mode === 'phone' ? 9000 : 6000);
const t = await p.evaluate(() => window.__t);
const rel = (x) => Math.round(x - t0);
console.log(`\n== read ${from}, then ${to} (${mode}${asked ? `, cleared to ${asked}` : ''}) ==`);
console.log('marks:', t.marks.map(([n, x]) => `${n} +${rel(x)}`).join(' | '));
console.log('frame gaps >50ms:', t.gaps.filter(([x]) => x >= t0).map(([x, d]) => `+${rel(x)}:${d}`).join(' '));
for (const l of t.loaf.filter((l) => l.at >= t0 - 5).sort((a, b) => b.dur - a.dur).slice(0, 8)) console.log(`  +${rel(l.at)} ${l.dur}ms (render ${l.render})`, l.scripts.join(' || '));
console.log('now at', p.url(), '| errors:', errs.length ? errs.slice(0, 3) : 'none');
await b.close();
