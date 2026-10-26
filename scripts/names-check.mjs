// Steps through every slide of the pinned name stages (team pages) at phone, laptop and desktop size
// and fails any name whose word breaks across lines or runs past its box. The clip audit cannot see
// these: the letters are split into inline blocks and nothing clips them. Localhost only (__ddLenis).
// Usage: node scripts/names-check.mjs <base> [page,page]
import { chromium, devices } from '@playwright/test';
const [base, list = 'adversary,avengers,fantastic-four,x-men,thunderbolts,wakanda-talokan,more'] = process.argv.slice(2);
const SIZES = { phone: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, laptop: { viewport: { width: 1280, height: 720 } }, desktop: { viewport: { width: 1440, height: 900 } } };
const b = await chromium.launch();
let bad = 0;
for (const [mode, opts] of Object.entries(SIZES)) {
  const ctx = await b.newContext(opts);
  await ctx.addInitScript(() => { try { localStorage.setItem('dd-intro-seen', '1'); } catch {} });
  for (const team of list.split(',')) {
    const p = await ctx.newPage();
    await p.goto(`${base}/teams/${team}/`); await p.waitForTimeout(2500);
    const n = await p.evaluate(() => document.querySelectorAll('[data-slide]').length);
    for (let i = 0; i < n; i++) {
      await p.evaluate((i) => { const c = document.querySelector('[data-carousel]'); const span = c.offsetHeight - innerHeight; window.__ddLenis.scrollTo(c.offsetTop + span * ((i + 0.5) / document.querySelectorAll('[data-slide]').length), { immediate: true }); }, i);
      await p.waitForTimeout(1800);
      const r = await p.evaluate((i) => {
        const el = document.querySelectorAll('[data-name]')[i];
        const box = el.getBoundingClientRect(), out = [];
        // a word is a group of letters with no space between them; all its letters must share one line
        const words = [...el.querySelectorAll('.ln > div')];
        for (const w of words) {
          const tops = [...w.children].map((c) => Math.round(c.offsetTop));
          if (new Set(tops).size > 1) out.push(`"${w.textContent}" breaks across lines`);
          const wr = w.getBoundingClientRect();
          if (wr.right > box.right + 2 || wr.right > innerWidth) out.push(`"${w.textContent}" runs past its box (${Math.round(wr.right)} > ${Math.round(Math.min(box.right, innerWidth))})`);
        }
        if (!words.length) out.push('name not split');
        return { name: el.textContent.trim(), out };
      }, i);
      if (r.out.length) { bad++; console.log('FAIL', mode, team, r.name, '-', r.out.join('; ')); }
    }
    await p.close();
  }
  await ctx.close();
}
console.log(bad ? `${bad} broken name(s)` : 'all names whole');
await b.close();
