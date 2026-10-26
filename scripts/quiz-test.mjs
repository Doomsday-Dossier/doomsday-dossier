// Plays the quiz end to end: answers, Back, keyboard, result, shared link, both share cards,
// and checks the header still fits with five links. Usage: node scripts/quiz-test.mjs <base url> <out dir>
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://localhost:4322').replace(/\/$/, '');
const out = process.argv[3] || 'screenshots/quiz';
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle'] });
let fails = 0;
const check = (ok, msg) => { console.log(ok ? 'ok  ' : 'FAIL', msg); if (!ok) fails++; };

for (const [n, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }]]) {
  const ctx = await b.newContext({ ...opts, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${base}/quiz/`); await p.waitForTimeout(2200);
  await p.screenshot({ path: `${out}/${n}-start.jpg`, quality: 78, type: 'jpeg' });
  const visible = async () => p.evaluate(() => [...document.querySelectorAll('.qz-q')].filter((q) => getComputedStyle(q).display !== 'none').map((q) => q.dataset.q));
  check((await visible()).join() === 'q1', `${n}: only question 1 shows at start`);

  // answer with clicks, go back once, then finish with the keyboard on desktop
  await p.click('.qz-q.on [data-opt="c"]'); await p.waitForTimeout(900);
  check((await visible()).join() === 'q2', `${n}: advances to question 2`);
  await p.click('[data-back]'); await p.waitForTimeout(900);
  check((await visible()).join() === 'q1' && (await p.$('.qz-q.on button.picked')) !== null, `${n}: Back returns to question 1 with its answer marked`);
  await p.click('.qz-q.on [data-opt="c"]'); await p.waitForTimeout(900);
  if (n === 'phone') await p.screenshot({ path: `${out}/${n}-question.jpg`, quality: 78, type: 'jpeg' });
  for (let i = 1; i < 10; i++) {
    if (n === 'desktop') await p.keyboard.press(String(1 + (i % 3))); else await p.click(`.qz-q.on button >> nth=${i % 3}`);
    await p.waitForTimeout(800);
  }
  await p.waitForTimeout(2600);
  const res = await p.evaluate(() => ({ name: document.querySelector('[data-r-name]').textContent, why: document.querySelectorAll('[data-r-why] li').length, url: location.search, hidden: document.querySelector('[data-result]').hidden, link: document.querySelector('[data-r-link]').getAttribute('href') }));
  check(!res.hidden && res.name && res.why > 0 && /^\?a=[a-f]{10}$/.test(res.url), `${n}: result ${res.name} (${res.why} reasons, ${res.url}, ${res.link})`);
  await p.screenshot({ path: `${out}/${n}-result.jpg`, quality: 80, type: 'jpeg' });

  // a shared link opens on the same result
  const p2 = await ctx.newPage(); await p2.goto(`${base}/quiz/${res.url}`); await p2.waitForTimeout(2500);
  check((await p2.textContent('[data-r-name]')) === res.name, `${n}: shared link shows the same result`);
  await p2.close();

  if (n === 'desktop') {
    for (const kind of ['portrait', 'wide']) {
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click(`[data-card="${kind}"]`)]);
      const file = `${out}/card-${kind}.png`; await dl.saveAs(file);
      check(fs.statSync(file).size > 50000, `card ${kind}: ${dl.suggestedFilename()} ${Math.round(fs.statSync(file).size / 1024)} KB`);
    }
    // a sample of results with long names and wide faces, for the clip check
    for (const code of ['eaabaaaaee', 'aeeccaccdb', 'deaebfbeeb']) {
      await p.goto(`${base}/quiz/?a=${code}`); await p.waitForTimeout(2600);
      const over = await p.evaluate(() => { const h = document.querySelector('[data-r-name]'); return [...h.querySelectorAll('.ln > span')].some((s) => s.getBoundingClientRect().right > h.getBoundingClientRect().right + 1); });
      check(!over, `name fits: ${await p.textContent('[data-r-name]')}`);
    }
  }
  check(errs.length === 0, `${n}: no page errors ${errs.join(' | ')}`);
  await ctx.close();
}

// header fits at mid widths with five links
for (const w of [780, 870, 900, 1024, 1180]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 800 } })).newPage();
  await p.goto(`${base}/quiz/`); await p.waitForTimeout(800);
  const ok = await p.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const nav = r('.hdr-nav'), brand = r('.brand'), menu = r('.menu-btn');
    if (getComputedStyle(document.querySelector('.hdr-nav')).display === 'none') return menu.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth;
    return nav.left > brand.right + 8 && nav.height < 50 && menu.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth;
  });
  check(ok, `header fits at ${w}px`);
}
await b.close();
console.log(fails ? `${fails} failure(s)` : 'all passed');
