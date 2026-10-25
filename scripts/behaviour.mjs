// Behaviour checks: reduced motion keeps everything visible; client-side
// navigation runs the transition and mounts the next scene without errors.
import { chromium } from '@playwright/test';
const base = (process.argv[2] || 'http://localhost:4321').replace(/\/$/, '');
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
let fail = 0;

// 1. Reduced motion
{
  const ctx = await b.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
  for (const p of ['/', '/c/victor-von-doom/', '/c/joaquin-torres/', '/teams/avengers/']) {
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(base + p, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const hidden = [...document.querySelectorAll('main h1, main h2, main h3, main p')].filter((el) => {
        const cs = getComputedStyle(el); return parseFloat(cs.opacity) < 0.5 || cs.visibility === 'hidden';
      }).length;
      return { hidden, rm: document.documentElement.classList.contains('rm'), lenis: document.documentElement.classList.contains('lenis'), pins: document.querySelectorAll('.pin-spacer').length };
    });
    const ok = r.hidden === 0 && r.rm && !r.lenis && r.pins === 0 && !errs.length;
    if (!ok) fail++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} reduced-motion ${p.padEnd(22)} hiddenText=${r.hidden} smoothScroll=${r.lenis} pinned=${r.pins} ${errs.join(' | ')}`);
    await page.close();
  }
  await ctx.close();
}

// 2. Navigation chain via real link clicks
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const hops = [];
  await page.locator('a.card-cta, .card.live a').first().click();
  await page.waitForTimeout(3000); hops.push(new URL(page.url()).pathname);
  for (let i = 0; i < 3; i++) {
    await page.locator('a.next-link').click();
    await page.waitForTimeout(3000);
    hops.push(new URL(page.url()).pathname);
  }
  const state = await page.evaluate(() => ({ scene: document.body.dataset.scene, gl: getComputedStyle(document.getElementById('gl')).opacity, wipe: getComputedStyle(document.getElementById('wipe')).opacity, y: scrollY }));
  const ok = !errs.length && hops.length === 4 && new Set(hops).size === 4 && state.wipe === '0' && state.y === 0;
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} navigation ${hops.join(' > ')} scene=${state.scene} wipeOpacity=${state.wipe} scrollY=${state.y} ${errs.join(' | ')}`);
  await ctx.close();
}
await b.close();
process.exit(fail ? 1 : 0);
