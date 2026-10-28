// Promo capture: drives the site like a visitor and records every frame the compositor paints (CDP screencast, JPEG 92)
// plus the site's own sound mix, with captions from overlay.js. Writes <out>/frames/*.jpg, frames.json (timestamps) and
// audio.webm with its start time. node scripts/promo/capture.mjs <base> <out> desktop|phone
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [base = 'http://localhost:4322', out = 'promo/raw', mode = 'desktop'] = process.argv.slice(2);
const phone = mode === 'phone';
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
const overlay = fs.readFileSync(new URL('./overlay.js', import.meta.url), 'utf8');

const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling'] });
const ctx = await b.newContext(phone
  ? { viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' }
  : { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
// a fresh visitor: the gate and the boot, nothing judged; four files already opened this session so the sixth breaks in
await ctx.addInitScript(({ overlay, phone }) => {
  try { sessionStorage.setItem('dd-trace', JSON.stringify({ n: 4, seen: ['shuri', 'namor'] })); localStorage.removeItem('dd-clearance'); localStorage.removeItem('dd-reign'); } catch {}
  const run = () => { if (phone) document.documentElement.classList.add('pv-phone'); (0, eval)(overlay); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', run); else run();
}, { overlay, phone });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
const frames = [];
let n = 0;
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const f = `f${String(++n).padStart(5, '0')}.jpg`;
  fs.writeFileSync(path.join(out, 'frames', f), Buffer.from(data, 'base64'));
  frames.push({ f, t: metadata.timestamp });
  try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch {}
});
const wait = (ms) => p.waitForTimeout(ms);
const cap = (k, t, s) => p.evaluate(([k, t, s]) => window.__cap(k, t, s), [k, t, s]);
const hide = () => p.evaluate(() => window.__cap());
const tap = async (x, y) => { await p.evaluate(([x, y]) => window.__tap(x, y), [x, y]); await p.touchscreen.tap(x, y); };
const tapEl = async (sel) => { const bb = await p.locator(sel).first().boundingBox(); await tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
const glide = async (dy, ms) => { const steps = Math.round(ms / 40); for (let i = 0; i < steps; i++) { await p.mouse.wheel(0, dy / steps); await wait(40); } };
const swipeScroll = async (dy, ms) => { await p.evaluate(([dy, ms]) => new Promise((res) => { const y0 = scrollY, t0 = performance.now(); const f = (now) => { const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, y0 + dy * e); if (k < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }), [dy, ms]); };

await p.goto(`${base}/`, { waitUntil: 'load' });
await wait(900);
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: phone ? 1080 : 1920, maxHeight: phone ? 1920 : 1080, everyNthFrame: 1 });
const audioAt = await p.evaluate(() => {
  const s = window.__ddSound, type = ['audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(new MediaStream(s.record().getAudioTracks()), { mimeType: type, audioBitsPerSecond: 192000 });
  const parts = []; rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); }; rec.start(250);
  window.__stopAudio = () => new Promise((res) => { rec.onstop = () => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(new Blob(parts, { type })); }; rec.stop(); });
  return Date.now() / 1000;
});
const mark = {};
const stamp = async (k) => { mark[k] = await p.evaluate(() => Date.now() / 1000); };

if (!phone) {
  // THE GATE AND THE BOOT
  await stamp('start');
  await cap('Avengers: Doomsday // fan site', 'Doomsday Dossier', "Every hero, every film, every comic, as Doctor Doom's own surveillance system.");
  await wait(3400);
  await hide(); await wait(300);
  await p.mouse.move(960, 600); await p.mouse.move(960, 412, { steps: 14 });
  await p.click('[data-auth]');
  await wait(900);
  await cap('00 // Web Audio', 'I am Doom', 'Every sound you hear is synthesised live in code. No audio files.');
  await wait(5600);
  await cap('01 // WebGL', 'Battleworld', '29 heroes, each a shard of a living 3D planet. Hand-written shaders, real Voronoi geometry.');
  await wait(3600);
  // turn the world, point at a domain, dive into Thor
  await p.mouse.move(700, 560); await p.mouse.down(); await p.mouse.move(980, 600, { steps: 30 }); await p.mouse.up(); await wait(1200);
  await p.evaluate(() => window.__bw.select(2)); await wait(1100);
  const at = await p.evaluate(() => { const r = document.querySelector('[data-bw]').getBoundingClientRect(), s = window.__bw.screenOf(2); return { x: r.left + s.x, y: r.top + s.y }; });
  await p.mouse.move(at.x - 120, at.y + 60); await p.mouse.move(at.x, at.y, { steps: 16 }); await wait(1300);
  await hide();
  await p.mouse.click(at.x, at.y);
  await wait(2600);
  await cap('02 // Depth scanning', 'Target acquired', 'Each photo is swept in over its own depth map, then locked on with callouts and a power-grid radar.');
  await wait(4600);
  // judge, then ask for clearance
  await hide();
  await p.locator('[data-v="obstacle"]').scrollIntoViewIfNeeded(); await wait(500);
  await cap('03 // You are Doom', 'Pass judgement', 'Ally, pawn, obstacle or beneath notice. Your reign is kept on your device.');
  await p.hover('[data-v="obstacle"]'); await wait(500); await p.click('[data-v="obstacle"]'); await wait(1500);
  await p.locator('[data-clear="2"]').scrollIntoViewIfNeeded(); await wait(400);
  await p.hover('[data-clear="2"]'); await wait(300); await p.click('[data-clear="2"]'); await wait(1400);
  await glide(900, 1400); await wait(700);
  // the sixth file: a hero breaks in
  await hide();
  await p.keyboard.press('/'); await wait(500); await p.keyboard.type('loki', { delay: 90 }); await wait(500); await p.keyboard.press('Enter');
  await wait(2000);
  await cap('04 // Live game', 'The heroes hack back', 'Open six files and a hero breaks into the system. Doom fights back.');
  await wait(4400);
  await hide(); await wait(600);
  // universes collide
  await p.click('a[data-mod="timeline"]'); await wait(1800);
  await cap('05 // Data visualisation', 'Universes collide', "94 sightings since 1939: the comics, Fox and Marvel Studios, drifting together toward 18 December 2026.");
  await glide(9000, 2600); await glide(9000, 2600); await glide(7000, 2000); await glide(6000, 1800); await wait(1600);
  await hide(); await wait(400);
  // combat through the command line
  await p.keyboard.press('/'); await wait(500); await p.keyboard.type('combat thor magneto', { delay: 70 }); await wait(700); await p.keyboard.press('Enter');
  await wait(2200);
  await cap('06 // Command line', 'Combat simulation', 'Type any matchup. Power grids, sourced feats and live fan voting.');
  await wait(5200);
  await hide(); await wait(400);
  await p.click('a[data-mod="chamber"]'); await wait(1600);
  await cap('07 // Royal chamber', 'Your reign', 'Rank who falls first, issue decrees under your own seal, keep a royal log.');
  const li = p.locator('.cq-i').nth(3), bb = await li.boundingBox();
  await p.mouse.move(bb.x + 20, bb.y + bb.height / 2); await p.mouse.down(); await p.mouse.move(bb.x + 20, bb.y - 120, { steps: 30 }); await p.mouse.up();
  await wait(3200);
  await hide(); await wait(600);
} else {
  // THE PHONE: gate, boot, Battleworld, a face from the strip, a file, the dock
  await stamp('start');
  await cap('Avengers: Doomsday // fan site', 'Doomsday Dossier', 'Built for phones too.');
  await wait(2600); await hide(); await wait(300);
  await tapEl('[data-auth]');
  await wait(5600);
  await cap('01 // WebGL', 'Battleworld', 'Tap a shard, or pick a face from the strip.');
  await wait(3000);
  await p.locator('.bw-strip').evaluate((el) => el.scrollTo({ left: 0, behavior: 'smooth' }));
  await tapEl('.bw-strip button:nth-child(3)'); await wait(1600);
  await hide();
  await tapEl('[data-bw-go]'); await wait(2800);
  await cap('02 // Scan', 'Target acquired', 'Depth-map scan, lock-on and callouts, on a phone.');
  await wait(4200);
  await hide();
  await swipeScroll(820, 1300); await wait(700);
  await tapEl('[data-v="obstacle"]'); await wait(1600);
  await tapEl('.dock a[data-mod="timeline"]'); await wait(1800);
  await cap('03 // Data', 'Universes collide', '94 sightings since 1939.');
  await swipeScroll(9000, 2600); await swipeScroll(9000, 2600); await swipeScroll(8000, 2200); await wait(1200);
  await hide();
  await tapEl('.dock a[data-mod="versus"]'); await wait(2400);
  await cap('04 // Combat', 'Pick two targets', 'Swipe the roster, compare power grids, vote.');
  await p.locator('.cb-roster').evaluate((el) => el.scrollTo({ left: 760, behavior: 'smooth' })); await wait(1200);
  await tapEl('.cb-roster button[data-pick="magneto"]'); await wait(3600);
  await hide(); await wait(500);
}
await stamp('end');
await cdp.send('Page.stopScreencast');
const audio = await p.evaluate(() => window.__stopAudio());
fs.writeFileSync(path.join(out, 'audio.webm'), Buffer.from(audio.split('base64,')[1], 'base64'));
fs.writeFileSync(path.join(out, 'frames.json'), JSON.stringify({ frames, audioAt, mark }, null, 1));
await b.close();
console.log(out, frames.length, 'frames', (frames.at(-1).t - frames[0].t).toFixed(1), 's');
