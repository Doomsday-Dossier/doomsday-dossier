// Frame-perfect promo capture. The page runs on a virtual clock (vtime.js): each video frame moves it on exactly 1/30 s,
// waits for the frame to be drawn completely, and takes it, however long that takes on this PC, so nothing ever drops.
// Sound is rendered offline on the same clock. Captions from overlay.js, paced to be read.
// node scripts/promo/vcapture.mjs <base> <out dir> desktop|phone
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [base = 'http://localhost:4322', out = 'screenshots/promo/v-desktop', mode = 'desktop'] = process.argv.slice(2);
const phone = mode === 'phone', FPS = 30, DT = 1000 / FPS;
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
const vtime = fs.readFileSync(new URL('./vtime.js', import.meta.url), 'utf8');
const overlay = fs.readFileSync(new URL('./overlay.js', import.meta.url), 'utf8');

const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext(phone
  ? { viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' }
  : { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await ctx.addInitScript(({ vtime, overlay, phone }) => {
  (0, eval)(vtime);
  try { sessionStorage.setItem('dd-trace', JSON.stringify({ n: 4, seen: ['shuri', 'namor'] })); localStorage.removeItem('dd-clearance'); localStorage.removeItem('dd-reign'); } catch {}
  const add = () => { if (phone) document.documentElement.classList.add('pv-phone'); (0, eval)(overlay); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add); else add();
}, { vtime, overlay, phone });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message));
const cdp = await ctx.newCDPSession(p);

// THE CLOCK
let n = 0, recording = false, startVt = 0;
const advance = (ms) => p.evaluate((ms) => window.__advance(ms), ms);
const frame = async () => {
  await advance(DT);
  if (!recording) return;
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93 });
  fs.writeFileSync(path.join(out, 'frames', `f${String(++n).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
  if (n % 150 === 0) console.log(`  ${(n / FPS).toFixed(0)} s`);
};
/** Plays `ms` of the page, one frame at a time; `each(k)` runs before frame k (k from 0 to 1). */
const play = async (ms, each) => { const f = Math.max(1, Math.round(ms / DT)); for (let i = 0; i < f; i++) { if (each) await each(i / (f - 1 || 1)); await frame(); } };
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const cap = (k, t, s) => p.evaluate(([k, t, s]) => window.__cap(k, t, s), [k, t, s]);
const hide = () => p.evaluate(() => window.__cap());
const box = async (sel) => { const bb = await p.locator(sel).first().boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }; };
let mx = phone ? 200 : 960, my = phone ? 400 : 540;
const glideMouse = async (x, y, ms) => { const x0 = mx, y0 = my; await play(ms, async (k) => { const e = ease(k); mx = x0 + (x - x0) * e; my = y0 + (y - y0) * e; await p.mouse.move(mx, my); }); };
const clickAt = async (x, y) => { if (phone) { await p.evaluate(([x, y]) => window.__tap(x, y), [x, y]); await p.touchscreen.tap(x, y); } else { await glideMouse(x, y, 500); await p.mouse.down(); await play(80); await p.mouse.up(); } };
const clickEl = async (sel) => { const c = await box(sel); await clickAt(c.x, c.y); };
const scrollTo = async (y, ms) => { const y0 = await p.evaluate(() => scrollY); await play(ms, (k) => p.evaluate((yy) => window.scrollTo(0, yy), Math.round(y0 + (y - y0) * ease(k)))); };
const scrollToEl = async (sel, ms, at = 0.45) => { const y = await p.evaluate(([sel, at]) => { const r = document.querySelector(sel).getBoundingClientRect(); return scrollY + r.top - innerHeight * at; }, [sel, at]); await scrollTo(Math.max(0, y), ms); };
const type = async (text, msPer = 110) => { for (const ch of text) { await p.keyboard.type(ch); await play(msPer); } };
const until = async (fn, max = 8000) => { for (let t = 0; t < max; t += DT) { if (await p.evaluate(fn)) return; await frame(); } };

await p.goto(`${base}/`, { waitUntil: 'load' });
for (let i = 0; i < 45; i++) await advance(DT); // fonts and layout settle before the first frame
await p.evaluate(() => document.fonts.ready);
startVt = await p.evaluate(() => window.__vt());
recording = true;

if (!phone) {
  await cap('Avengers: Doomsday // fan site', 'Doomsday Dossier', "Every hero, every film, every comic, as Doctor Doom's own surveillance system.");
  await play(5500);
  await hide(); await play(300);
  await clickEl('[data-auth]');
  await play(900);
  await cap('00 // Web Audio', 'I am Doom', 'Every sound is synthesised live in code. No audio files.');
  await until(() => !document.querySelector('[data-boot]'), 12000);
  await play(1500);
  await cap('01 // WebGL', 'Battleworld', '29 heroes, each a shard of a 3D planet. Custom WebGL shaders.');
  await play(4200);
  // turn the world slowly, then choose Thor
  const cv = await box('[data-bw]');
  await glideMouse(cv.x - 260, cv.y + 40, 700);
  await p.mouse.down();
  await glideMouse(cv.x + 120, cv.y + 80, 2200);
  await p.mouse.up();
  await play(1200);
  await p.evaluate(() => window.__bw.select(2));
  await play(1400);
  const at = await p.evaluate(() => { const r = document.querySelector('[data-bw]').getBoundingClientRect(), s = window.__bw.screenOf(2); return { x: r.left + s.x, y: r.top + s.y }; });
  await glideMouse(at.x, at.y, 900);
  await play(1600);
  await hide();
  await p.mouse.down(); await play(80); await p.mouse.up();
  await play(1800);
  await until(() => document.body.dataset.page === 'file' && document.querySelector('[data-status]')?.textContent?.includes('locked'), 10000);
  await cap('02 // Depth scanning', 'Target acquired', 'Each photo is scanned over its own depth map, then locked on.');
  await play(6500);
  await hide();
  await scrollToEl('[data-v="obstacle"]', 1400);
  await cap('03 // You are Doom', 'Pass judgement', 'Ally, pawn, obstacle or beneath notice.');
  await play(1200);
  await clickEl('[data-v="obstacle"]');
  await play(2600);
  await scrollToEl('[data-clear="2"]', 1200, 0.3);
  await clickEl('[data-clear="2"]');
  await play(2800);
  await hide(); await play(300);
  // the sixth file: a hero breaks in
  await p.keyboard.press('/'); await play(500); await type('loki', 130); await play(500); await p.keyboard.press('Enter');
  await until(() => document.body.dataset.page === 'file', 6000);
  await play(2200);
  await cap('04 // Live game', 'The heroes hack back', 'Open six files and a hero breaks in. Doom fights back.');
  await play(7500);
  await hide(); await play(400);
  // universes collide
  await clickEl('a[data-mod="timeline"]');
  await until(() => document.body.dataset.page === 'timeline', 6000);
  await play(1500);
  await cap('05 // Data visualisation', 'Universes collide', '94 sightings since 1939, three universes drifting together.');
  const end = await p.evaluate(() => { const ev = [...document.querySelectorAll('[data-ev]')].at(-2); return scrollY + ev.getBoundingClientRect().top - innerHeight * 0.5; });
  await scrollTo(end, 12000);
  await play(3000);
  await hide(); await play(400);
  // combat through the command line
  await p.keyboard.press('/'); await play(500); await type('combat thor magneto', 80); await play(700); await p.keyboard.press('Enter');
  await until(() => document.body.dataset.page === 'versus', 6000);
  await play(2600);
  await cap('06 // Command line', 'Combat simulation', 'Type any matchup. Power grids, sourced feats, fan voting.');
  await play(7000);
  await hide(); await play(800);
} else {
  await cap('Avengers: Doomsday // fan site', 'Doomsday Dossier', 'Built for phones too.');
  await play(4500); await hide(); await play(300);
  await clickEl('[data-auth]');
  await until(() => !document.querySelector('[data-boot]'), 12000);
  await play(1500);
  await cap('01 // WebGL', 'Battleworld', 'Tap a shard, or pick a face from the strip.');
  await play(4500);
  await clickEl('.bw-strip button:nth-child(3)');
  await play(2200);
  await hide();
  await clickEl('[data-bw-go]');
  await until(() => document.body.dataset.page === 'file' && document.querySelector('[data-status]')?.textContent?.includes('locked'), 10000);
  await cap('02 // Scan', 'Target acquired', 'Depth-map scan, lock-on and callouts.');
  await play(5500);
  await hide();
  await scrollToEl('[data-v="obstacle"]', 1600, 0.4);
  await play(600);
  await clickEl('[data-v="obstacle"]');
  await play(2200);
  await clickEl('.dock a[data-mod="timeline"]');
  await until(() => document.body.dataset.page === 'timeline', 6000);
  await play(1200);
  await cap('03 // Data', 'Universes collide', '94 sightings since 1939.');
  const end = await p.evaluate(() => { const ev = [...document.querySelectorAll('[data-ev]')].at(-2); return scrollY + ev.getBoundingClientRect().top - innerHeight * 0.75; });
  await scrollTo(end, 10000);
  await play(2500);
  await hide();
  await clickEl('.dock a[data-mod="versus"]');
  await until(() => document.body.dataset.page === 'versus', 6000);
  await play(1800);
  await cap('04 // Combat', 'Pick two targets', 'Swipe the roster, compare power grids, vote.');
  await play(1500);
  await play(1500, (k) => p.evaluate((x) => { document.querySelector('.cb-roster').scrollLeft = x; }, Math.round(760 * ease(k))));
  await clickEl('.cb-roster button[data-pick="magneto"]');
  await play(2500);
  await hide();
  // down to the two fighters and the radar between them
  await scrollToEl('.cb-stage', 1800, 0.12);
  await play(4500);
}
recording = false;
const endVt = await p.evaluate(() => window.__vt());
console.log('rendering sound');
const wav = await p.evaluate(() => window.__renderAudio(window.__ddSound.ctx));
fs.writeFileSync(path.join(out, 'audio.wav'), Buffer.from(wav, 'base64'));
fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({ fps: FPS, frames: n, audioStart: (startVt + DT) / 1000, seconds: (endVt - startVt) / 1000 }));
await b.close();
console.log(out, n, 'frames', (n / FPS).toFixed(1), 's');
