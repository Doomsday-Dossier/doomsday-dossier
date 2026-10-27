// Stills of the 3D character prototypes (/lab/characters/) at set moments of each character's sequence, both
// styles, into <outdir>; then tile them with contact-sheet.mjs. One browser, one page at a time.
// Usage: node scripts/characters-frames.mjs <base> <outdir> [statue|collectible|both] [desktop|phone]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
const [base, out, which = 'both', mode = 'desktop'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const CH = ['victor-von-doom', 'steve-rogers', 'thor'];
const AT = { statue: [1.5, 5.2, 8.8, 12.6], collectible: [0.4, 2.4, 4.2] };
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1280, height: 760 } });
for (const style of which === 'both' ? ['statue', 'collectible'] : [which]) {
  for (const c of CH) {
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${base}/lab/characters/?s=${style}&c=${c}&rec`);
    await p.waitForFunction(() => window.__lab?.current, null, { timeout: 30000 });
    const t0 = Date.now();
    for (const s of AT[style]) {
      const wait = t0 + s * 1000 - Date.now(); if (wait > 0) await p.waitForTimeout(wait);
      await p.screenshot({ path: `${out}/${style}-${c}-${String(s).padStart(4, '0')}.png` });
    }
    if (errs.length) console.log(c, style, 'errors:', errs.slice(0, 3));
    await p.close();
  }
}
await b.close();
console.log('done');
