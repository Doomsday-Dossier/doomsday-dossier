// Screen recording, with sound, of a DOOM-OS tour: the gate and the boot, Battleworld forming, a dive into a domain
// (and the breach it sets off), a verdict and level 2 clearance, the timeline's universes colliding, the combat
// simulation and the royal chamber. The browser's video joined to the page's own sound mix.
// Usage: node scripts/os-record.mjs <base> <out.webm> [desktop|phone]
import { chromium, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [base, out, mode = 'desktop'] = process.argv.slice(2);
const FF = 'C:/Users/DELL/AppData/Local/ms-playwright/ffmpeg-1013/ffmpeg-win64.exe';
const tmp = path.join(path.dirname(out), `.rec-os-${mode}`); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
const phone = mode === 'phone';
const size = phone ? { width: 390, height: 844 } : { width: 1280, height: 760 };
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ ...(phone ? devices['Pixel 7'] : {}), viewport: size, recordVideo: { dir: tmp, size } });
// five files already opened this session, so the dive sets off a breach
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('dd-trace')) sessionStorage.setItem('dd-trace', JSON.stringify({ n: 5, seen: ['shuri'] })); } catch {} });
const p = await ctx.newPage();
const v0 = Date.now();
await p.goto(`${base}/`); await p.waitForTimeout(900);
const at = await p.evaluate(() => {
  const s = window.__ddSound, type = ['audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(new MediaStream(s.record().getAudioTracks()), { mimeType: type, audioBitsPerSecond: 192000 });
  const parts = []; rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); }; rec.start(250);
  window.__stopAudio = () => new Promise((res) => { rec.onstop = () => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(new Blob(parts, { type })); }; rec.stop(); });
  return performance.timeOrigin + performance.now();
});
await p.waitForTimeout(700);
await p.click('[data-auth]');
await p.waitForTimeout(10500);
// turn the world, point at a domain, dive into it
const cv = await p.locator('[data-bw]').boundingBox();
const cx = cv.x + cv.width / 2, cy = cv.y + cv.height * 0.48;
if (!phone) {
  await p.mouse.move(cx - 160, cy); await p.mouse.down(); await p.mouse.move(cx + 40, cy + 20, { steps: 25 }); await p.mouse.up(); await p.waitForTimeout(1600);
  await p.mouse.move(cx, cy - 20, { steps: 12 }); await p.waitForTimeout(1600);
  await p.mouse.click(cx, cy - 20);
} else { await p.tap('[data-bw]', { position: { x: cv.width / 2, y: cv.height * 0.45 } }); await p.waitForTimeout(1400); await p.tap('[data-bw]', { position: { x: cv.width / 2, y: cv.height * 0.45 } }); }
await p.waitForTimeout(9500);
// judge the target, then ask for clearance
const scroll = async (dy, ms) => { const n = Math.max(1, Math.round(ms / 60)); for (let i = 0; i < n; i++) { await p.mouse.wheel(0, dy / n); await p.waitForTimeout(60); } };
await p.locator('[data-v="obstacle"]').scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(600);
await p.click('[data-v="obstacle"]').catch(() => {}); await p.waitForTimeout(1600);
await p.locator('[data-clear="2"]').scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(500);
await p.click('[data-clear="2"]').catch(() => {}); await p.waitForTimeout(1800);
await scroll(1600, 2600); await p.waitForTimeout(800);
// the timeline: universes collide
if (phone) { await p.click('[data-cmd-open]'); await p.waitForTimeout(500); await p.keyboard.type('archive', { delay: 60 }); await p.waitForTimeout(500); await p.keyboard.press('Enter'); }
else await p.click('a[data-mod="timeline"]');
await p.waitForTimeout(2200);
await scroll(5200, 3200); await scroll(5200, 3200); await scroll(4000, 2400); await scroll(3000, 2000); await p.waitForTimeout(1600);
// the combat simulation and the chamber, through the command line
await p.click('[data-cmd-open]'); await p.waitForTimeout(400); await p.keyboard.type('combat thor magneto', { delay: 55 }); await p.waitForTimeout(600); await p.keyboard.press('Enter');
await p.waitForTimeout(6500);
await scroll(500, 900); await p.waitForTimeout(1400);
if (phone) { await p.click('[data-cmd-open]'); await p.waitForTimeout(400); await p.keyboard.type('chamber', { delay: 55 }); await p.keyboard.press('Enter'); }
else await p.click('a[data-mod="chamber"]');
await p.waitForTimeout(3500);
const data = await p.evaluate(() => window.__stopAudio());
await ctx.close(); await b.close();
const v = fs.readdirSync(tmp).find((f) => f.endsWith('.webm')), audio = path.join(tmp, 'a.webm'), joined = path.join(tmp, 'j.webm');
fs.writeFileSync(audio, Buffer.from(data.split('base64,')[1], 'base64'));
const off = Math.max(0, (at - v0) / 1000);
execFileSync(FF, ['-y', '-i', path.join(tmp, v), '-itsoffset', off.toFixed(3), '-i', audio, '-map', '0:v', '-map', '1:a', '-c', 'copy', joined], { stdio: 'ignore' });
execFileSync(FF, ['-y', '-i', joined, '-ss', off.toFixed(2), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1', '-c:a', 'copy', out], { stdio: 'ignore' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(out);
