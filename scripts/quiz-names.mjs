// Opens quiz results through shared links (random answers) until all 29 characters have come up, at
// phone, laptop and desktop size, and fails any result name that runs past its box or the screen edge.
// Widths must be checked against the screen: a grid column that grows to fit a wide word makes the name's
// own box wider than the screen, so a box-only check passes while the name is cut off (SAM WILSO/N).
// Usage: node scripts/quiz-names.mjs <base>
import { chromium, devices } from '@playwright/test';
const [base] = process.argv.slice(2);
const SIZES = { phone: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, laptop: { viewport: { width: 1280, height: 720 } }, desktop: { viewport: { width: 1440, height: 900 } } };
const b = await chromium.launch();
let bad = 0;
for (const [mode, opts] of Object.entries(SIZES)) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  await p.goto(`${base}/preview/quiz/`); await p.waitForTimeout(1500);
  const seen = new Set();
  for (let t = 0; t < 250 && seen.size < 29; t++) {
    const code = await p.evaluate(() => { const qs = JSON.parse(document.getElementById('qz-data').textContent).questions; return qs.map((q) => q.options[Math.floor(Math.random() * q.options.length)].id).join(''); });
    await p.goto(`${base}/preview/quiz/?a=${code}`); await p.waitForTimeout(900);
    const r = await p.evaluate(() => {
      const nm = document.querySelector('[data-r-name]'), box = nm.getBoundingClientRect();
      const words = [...nm.querySelectorAll('.ln > span')];
      return { name: nm.textContent, over: box.right > innerWidth + 1 || words.some((s) => s.getBoundingClientRect().right > Math.min(box.right, innerWidth) + 1) };
    });
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    if (r.over) { bad++; console.log('FAIL', mode, r.name); }
  }
  console.log(mode, seen.size, 'results checked');
  await ctx.close();
}
console.log(bad ? `${bad} name(s) overflow` : 'all result names fit');
await b.close();
