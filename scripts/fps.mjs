// Frame-time probe for every hero at phone size.
// Usage: node scripts/fps.mjs [baseUrl] [cpuThrottle]
// Note: this runs on the host GPU, so it is a proxy, not a real-phone measurement.
import { chromium, devices } from '@playwright/test';

const base = (process.argv[2] || 'http://localhost:4321').replace(/\/$/, '');
const throttle = Number(process.argv[3] || 1);
const paths = ['/', ...(process.argv[4] ? process.argv[4].split(',') : ['victor-von-doom', 'steve-rogers', 'thor', 'sam-wilson', 'bucky-barnes', 'scott-lang', 'shang-chi', 'joaquin-torres', 'reed-richards', 'sue-storm', 'johnny-storm', 'ben-grimm']).map((s) => `/c/${s}/`)];
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 } });
let first = true;
for (const p of paths) {
  const page = await ctx.newPage();
  if (throttle > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
  await page.goto(base + p, { waitUntil: 'load' });
  await page.waitForTimeout(4500); // let the quality governor settle
  if (first) {
    const gpu = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl'); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
    console.log('GPU:', gpu, '| CPU throttle:', throttle + 'x'); first = false;
  }
  const r = await page.evaluate(() => new Promise((res) => {
    const t = []; let last = performance.now();
    const f = (n) => { t.push(n - last); last = n; if (t.length < 240) requestAnimationFrame(f); else { t.shift(); t.sort((a, b) => a - b); res({ avg: 1000 / (t.reduce((a, b) => a + b, 0) / t.length), p95: t[Math.floor(t.length * 0.95)] }); } };
    requestAnimationFrame(f);
  }));
  const sErr = await page.evaluate(() => { const e = window.__ddEngine; return e ? e.renderer.info.programs.filter((x) => x.diagnostics).length : 0; });
  console.log(`${p.padEnd(24)}${sErr ? ' SHADER ERRORS ' + sErr : ''} avg ${r.avg.toFixed(0).padStart(3)} fps   p95 frame ${r.p95.toFixed(1)} ms`);
  await page.close();
}
await b.close();
