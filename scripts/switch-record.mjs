// Screen recording, with sound, of the two page changes: from Doom's file the next-file handoff into Steve
// Rogers's, then from the list at the foot of Steve's file the redaction wipe into Thor's. The browser's video
// joined to the page's own sound mix (as file-record.mjs).
// Usage: node scripts/switch-record.mjs <base> <out.webm> [desktop|phone]
import { chromium, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [base, out, mode = 'desktop'] = process.argv.slice(2);
const FF = 'C:/Users/DELL/AppData/Local/ms-playwright/ffmpeg-1013/ffmpeg-win64.exe';
const tmp = path.join(path.dirname(out), `.rec-switch-${mode}`);
fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
const size = mode === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 720 };
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ ...(mode === 'phone' ? devices['Pixel 7'] : {}), viewport: size, recordVideo: { dir: tmp, size } });
const p = await ctx.newPage();
const videoStart = Date.now();
await p.goto(`${base}/c/victor-von-doom/`);
await p.waitForTimeout(300);
const at = await p.evaluate(() => {
  const s = window.__ddSound;
  const type = ['audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(new MediaStream(s.record().getAudioTracks()), { mimeType: type, audioBitsPerSecond: 192000 });
  const parts = []; rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  rec.start(250);
  window.__stopAudio = () => new Promise((res) => { rec.onstop = () => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(new Blob(parts, { type })); }; rec.stop(); });
  return performance.timeOrigin + performance.now();
});
await p.mouse.click(size.width * 0.5, size.height * 0.4);
await p.waitForTimeout(1500);
const glide = (y, s) => p.evaluate(([y, s]) => new Promise((r) => window.__ddLenis.scrollTo(y, { duration: s, easing: (t) => 1 - Math.pow(1 - t, 3), onComplete: r })), [y, s]);
const top = (sel) => p.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + window.__ddLenis.scroll, sel);
// jump near the foot of the file, then glide to the next-file window and open it: the handoff
await p.evaluate(async () => { const v = document.querySelector('[data-voyage]'); window.__ddLenis.scrollTo(v.getBoundingClientRect().top + window.__ddLenis.scroll - innerHeight * 1.2, { immediate: true }); });
await p.waitForTimeout(600);
await glide((await top('[data-voyage]')) + (mode === 'phone' ? -40 : 0), 2); await p.waitForTimeout(900);
await p.locator('[data-voy-window]').click(); await p.waitForTimeout(4200);
// on Steve's file: a little of the briefing, then down to the list of files and on to Thor: the wipe
await glide(size.height * 0.8, 1.6); await p.waitForTimeout(700);
await p.evaluate(async () => { const v = document.querySelector('[data-voyage]'); window.__ddLenis.scrollTo(v.getBoundingClientRect().top + window.__ddLenis.scroll - innerHeight * 1.2, { immediate: true }); });
await p.waitForTimeout(600);
await glide((await top('.voy-list')) - size.height * 0.4, 1.8); await p.waitForTimeout(800);
await p.locator('.voy-list a[href*="/c/thor/"]').click(); await p.waitForTimeout(4200);
const data = await p.evaluate(() => window.__stopAudio());
await ctx.close(); await b.close();
const video = fs.readdirSync(tmp).find((f) => f.endsWith('.webm'));
const audio = path.join(tmp, 'audio.webm');
fs.writeFileSync(audio, Buffer.from(data.split('base64,')[1], 'base64'));
const offset = Math.max(0, (at - videoStart) / 1000);
execFileSync(FF, ['-y', '-i', path.join(tmp, video), '-itsoffset', offset.toFixed(3), '-i', audio, '-map', '0:v', '-map', '1:a', '-c', 'copy', out], { stdio: 'ignore' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(out, 'audio offset', offset.toFixed(2), 's');
