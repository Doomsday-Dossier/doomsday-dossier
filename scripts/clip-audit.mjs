// Finds text that is cut off, at desktop and phone width, on every page.
// Checks: (1) text running past the viewport edge, (2) text clipped by an
// ancestor that hides overflow, (3) text overflowing its own box, and
// (4) a Panel Flythrough front panel that does not fit the screen.
// Usage: node scripts/clip-audit.mjs [baseUrl] [pathFilter,...] [view,...]
// Views: desktop (1440x900), laptop (1280x720), phone (390x844). Default: desktop,phone.
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://localhost:4322').replace(/\/$/, '');
const filters = (process.argv[3] || '').split(',').filter(Boolean);
function pages(dir = 'dist', rel = '') {
  const res = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith('_')) res.push(...pages(dir, path.join(rel, e.name)));
    else if (e.name === 'index.html') res.push('/' + rel.split(path.sep).join('/') + (rel ? '/' : ''));
  }
  return res;
}
const list = pages().filter((p) => !filters.length || filters.some((f) => p.includes(f))).sort();
const ALL = { desktop: { viewport: { width: 1440, height: 900 } }, laptop: { viewport: { width: 1280, height: 720 } }, phone: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } };
const pick = (process.argv[4] || 'desktop,phone').split(',');
const VIEWS = Object.fromEntries(Object.entries(ALL).filter(([k]) => pick.includes(k)));

const b = await chromium.launch({ args: ['--use-gl=angle'] });
let total = 0;
for (const [name, opts] of Object.entries(VIEWS)) {
  const ctx = await b.newContext(opts);
  for (const p of list) {
    const page = await ctx.newPage();
    await page.goto(base + p, { waitUntil: 'load' });
    await page.waitForTimeout(2600);
    // walk the page so every scroll-triggered reveal has played
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 500) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(90); }
    await page.waitForTimeout(1200);
    // open every source list so long links are measured too
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
    await page.waitForTimeout(300);
    const issues = await page.evaluate(() => {
      const out = [];
      const W = document.documentElement.clientWidth;
      // sideways rails move their text past the edges on purpose: only vertical cuts count there
      const inRail = (el) => !!el.closest('.tl-fly .tl-track, .sig-rail, [data-strip]');
      const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} "${(el.textContent || '').trim().slice(0, 40)}"`;
      const els = [...document.querySelectorAll('main h1, main h2, main h3, main p, main li, main dt, main dd, main a, main small, main b, footer p')];
      for (const el of els) {
        if (!el.textContent.trim() || el.closest('.sr-only')) continue;
        const rail = inRail(el);
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (!rail && (r.right > W + 1 || r.left < -1)) out.push(`past viewport (${Math.round(r.left)}..${Math.round(r.right)} of ${W}): ${label(el)}`);
        if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'visible' && el.clientWidth > 0) out.push(`overflows own box: ${label(el)}`);
        // clipped by an ancestor that hides overflow (ignore SplitText line masks, which are sized to their line)
        let a = el.parentElement;
        while (a && a !== document.body) {
          const acs = getComputedStyle(a);
          if ((acs.overflowX !== 'visible' || acs.overflowY !== 'visible') && !a.classList.contains('split-line')) {
            const ar = a.getBoundingClientRect();
            const xClip = !rail && acs.overflowX !== 'visible' && (r.right > ar.right + 1 || r.left < ar.left - 1);
            const yClip = acs.overflowY !== 'visible' && (r.bottom > ar.bottom + 1 || r.top < ar.top - 1) && !a.classList.contains('menu');
            if (xClip || yClip) { out.push(`clipped by ${a.tagName.toLowerCase()}.${String(a.className).split(' ')[0]}: ${label(el)}`); break; }
          }
          a = a.parentElement;
        }
      }
      // words split across two lines in headings and names (a word must never break)
      const heads = [...document.querySelectorAll('main h1, main h2, main h3, main .mem-name, main .card-name, main .next-name, main .cr-name')];
      for (const el of heads) {
        if (el.closest('.sr-only') || getComputedStyle(el).display === 'none') continue;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const words = [];
        let n; while ((n = walker.nextNode())) { const re = /S+/g; let m; while ((m = re.exec(n.data))) words.push([n, m.index, m.index + m[0].length, m[0]]); }
        // SplitText wraps each char in its own node (and each word in .split-word): rebuild words from char boxes
        const chars = el.querySelectorAll('.split-char, [class*=char]');
        if (chars.length) {
          let word = [], top = null, broke = false; const flush = () => { if (broke) out.push('word broken across lines: ' + label(el)); word = []; top = null; broke = false; };
          let box = null;
          for (const ch of chars) { const t = ch.textContent; const wb = ch.closest('.split-word'); if (wb !== box) { flush(); box = wb; } if (!t.trim()) { flush(); continue; } const r = ch.getBoundingClientRect(); if (top !== null && Math.abs(r.top - top) > r.height * 0.5) broke = true; top = r.top; word.push(t); if (ch.nextSibling && /s/.test(ch.nextSibling.textContent || '')) flush(); }
          flush();
        } else for (const [node, s0, e0] of words) {
          const range = document.createRange(); range.setStart(node, s0); range.setEnd(node, e0);
          const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top / 4)));
          if (tops.size > 1) { out.push('word broken across lines: ' + label(el)); break; }
        }
      }
      return [...new Set(out)];
    });
    // pinned sideways timeline: every card must fit the screen while pinned
    const pinned = await page.evaluate(async () => {
      // Panel Flythrough: walk through the pin; whichever panel is in front must fit the screen
      const sec = document.querySelector('.act-comics.tl-fly');
      if (!sec) return [];
      // the pin wraps the section in a spacer: its top is where the corridor starts
      const spacer = sec.parentElement?.classList.contains('pin-spacer') ? sec.parentElement : sec;
      if (window.__ddLenis) window.__ddLenis.scrollTo(0, { immediate: true, force: true }); else window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 300));
      const start = spacer.getBoundingClientRect().top + window.scrollY;
      const cards = [...sec.querySelectorAll('.tl-card')];
      const out = [];
      for (let k = 0; k < cards.length; k++) {
        // scroll as a visitor does: through Lenis when the page uses it, or it puts the page back
        const y = start + 5 + k * innerHeight * 0.85;
        if (window.__ddLenis) window.__ddLenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 900));
        for (const c of cards) {
          if (Number(getComputedStyle(c).opacity) < 0.95) continue;
          const r = c.getBoundingClientRect();
          if (r.bottom > innerHeight + 1 || r.top < 0) out.push(`front comics panel cut (${Math.round(r.top)}..${Math.round(r.bottom)} of ${innerHeight}): ${c.querySelector('.tl-title')?.textContent}`);
        }
      }
      return [...new Set(out)];
    });
    const all = [...issues, ...pinned];
    total += all.length;
    console.log(`${all.length ? 'FAIL' : 'ok  '} ${name.padEnd(7)} ${p}`);
    for (const i of all.slice(0, 8)) console.log('       - ' + i);
    if (all.length > 8) console.log(`       ... and ${all.length - 8} more`);
    await page.close();
  }
  await ctx.close();
}
await b.close();
console.log(`\n${total} issue(s)`);
process.exit(total ? 1 : 0);
