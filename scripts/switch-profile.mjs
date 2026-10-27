// Profiles a seamless page change between two files: when the click lands, when the new page swaps in and
// boots, every long animation frame afterwards (with the scripts Chrome blames for it), and the bytes fetched.
// Phone mode slows the CPU 4x, roughly a mid-range phone.
// Usage: node scripts/switch-profile.mjs <base> [from-slug] [to-slug] [desktop|phone]
import { chromium, devices } from '@playwright/test';
const [base, from = 'victor-von-doom', to = 'steve-rogers', mode = 'desktop'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
// NODIO=1 serves the next file without its depth diorama (the flat hero), to tell the two apart
if (process.env.NODIO) await p.route(`**/c/${to}/`, async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace(/data-dio="[^"]*"/, 'data-dio="null"') }); });
await p.goto(`${base}/c/${from}/?perf`);
// a first tap starts the sound, as a visitor's would; NOSOUND=1 leaves it off
if (!process.env.NOSOUND) await p.mouse.click(200, 300);
await p.waitForTimeout(3000);
let bytes = 0; const big = [];
// counting bytes pulls every response body over DevTools, which can stall the page by itself: BYTES=1 to count
if (process.env.BYTES) p.on('response', async (r) => { try { const n = Number(r.headers()['content-length'] || (await r.body()).length); bytes += n; if (n > 150e3) big.push(`${Math.round(n / 1024)}KB ${r.url().split('/').slice(-3).join('/')}`); } catch {} });
// phone runs slow the CPU 4x (RATE=n to change), roughly a mid-range phone
if (mode === 'phone') await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.RATE) || 4 });
await p.evaluate(() => {
  const w = window; w.__t = { marks: [], loaf: [] };
  const m = (n) => w.__t.marks.push([n, Math.round(performance.now())]);
  // the covers persist across the swap, so their classes time the stages: up, waiting, lifting, gone
  for (const el of document.querySelectorAll('[data-pt], [data-ho]')) {
    let was = el.className;
    new MutationObserver(() => { const c = el.className; if (c !== was) { m(`${el.dataset.ho !== undefined ? 'ho' : 'pt'}[${c.replace(/^(pt|ho)\s*/, '') || '-'}]`); was = c; } }).observe(el, { attributes: true, attributeFilter: ['class'] });
  }
  new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__t.loaf.push({
    at: Math.round(e.startTime), dur: Math.round(e.duration), block: Math.round(e.blockingDuration), render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0),
    scripts: e.scripts.map((s) => `${Math.round(s.duration)}ms ${s.invokerType}:${s.invoker} ${(s.sourceURL || '').split('/').pop()}:${s.sourceFunctionName || ''}@${s.sourceCharPosition}`).slice(0, 4),
  }))).observe({ type: 'long-animation-frame', buffered: false });
  let last = performance.now(); w.__t.gaps = [];
  let q = w.__ddEngine?.ctx.quality;
  const f = (now) => {
    if (now - last > 50) w.__t.gaps.push([Math.round(last), Math.round(now - last)]); last = now;
    const nq = w.__ddEngine?.ctx.quality; if (nq !== q) { m(`quality ${q}->${nq}`); q = nq; } // the governor stepping down
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
});
// the next-file link (the handoff) by default; LINK=<selector> clicks another (the redaction wipe)
// NOGL=1 stops the 3D engine drawing, to tell its cost from the page's
if (process.env.NOGL) await p.evaluate(() => { const e = window.__ddEngine; if (e) { e.tick = () => {}; e.prime = () => {}; e.compile = async () => {}; } });
const t0 = await p.evaluate((sel) => { const a = document.querySelector(sel); const t = performance.now(); window.__t.marks.push(['click', Math.round(t)]); a.click(); return t; }, process.env.LINK || 'a.voy-big');
await p.waitForTimeout(Number(process.env.WAIT) || (mode === 'phone' ? 9000 : 6000));
const t = await p.evaluate(() => window.__t);
const rel = (x) => Math.round(x - t0);
console.log(`\n== ${from} -> ${to} (${mode}) ==`);
console.log('marks:', t.marks.map(([n, x]) => `${n.replace('astro:', '')} +${rel(x)}`).join(' | '));
console.log('frame gaps >50ms:', t.gaps.filter(([x]) => x >= t0).map(([x, d]) => `+${rel(x)}:${d}`).join(' '));
console.log('total blocked:', t.gaps.filter(([x]) => x >= t0).reduce((a, [, d]) => a + d, 0), 'ms');
// what the visitor sees move: the cover going up, and everything from the lift on (the wait itself is still)
const waitAt = t.marks.find(([n]) => /\[on wait\]/.test(n))?.[1], liftAt = t.marks.filter(([n]) => /\[on\]$/.test(n)).pop()?.[1];
if (waitAt && liftAt) {
  const seen = t.gaps.filter(([x, d]) => (x >= t0 && x + d <= waitAt + 30) || x >= liftAt);
  console.log(`visible: cover up ${rel(waitAt)} ms, waiting ${Math.round(liftAt - waitAt)} ms; gaps >50ms while moving:`, seen.map(([x, d]) => `+${rel(x)}:${d}`).join(' ') || 'none');
}
for (const l of t.loaf.filter((l) => l.at >= t0 - 5).sort((a, b) => b.dur - a.dur).slice(0, 8)) console.log(`  +${rel(l.at)} ${l.dur}ms (render ${l.render})`, l.scripts.join(' || '));
console.log('fetched', Math.round(bytes / 1024), 'KB; large:', big.join(', '));
await b.close();
