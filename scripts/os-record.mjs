// Screen recording, with sound, of the DOOM-OS prototype (/lab/os/): authenticate, boot, home, the register,
// Steve Rogers's file, then Doom's. The browser's video joined to the page's own sound mix.
// Usage: node scripts/os-record.mjs <base> <out.webm> [desktop|phone]
import { chromium, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [base, out, mode = 'desktop'] = process.argv.slice(2);
const FF = 'C:/Users/DELL/AppData/Local/ms-playwright/ffmpeg-1013/ffmpeg-win64.exe';
const tmp = path.join(path.dirname(out), `.rec-os-${mode}`); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
const size = mode === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 760 };
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ ...(mode === 'phone' ? devices['Pixel 7'] : {}), viewport: size, recordVideo: { dir: tmp, size } });
const p = await ctx.newPage();
const v0 = Date.now();
await p.goto(`${base}/lab/os/`); await p.waitForTimeout(900);
const at = await p.evaluate(() => {
  const s = window.__ddSound, type = ['audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(new MediaStream(s.record().getAudioTracks()), { mimeType: type, audioBitsPerSecond: 192000 });
  const parts = []; rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); }; rec.start(250);
  window.__stopAudio = () => new Promise((res) => { rec.onstop = () => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(new Blob(parts, { type })); }; rec.stop(); });
  return performance.timeOrigin + performance.now();
});
await p.waitForTimeout(700);
await p.click('[data-auth]');
await p.waitForTimeout(11500);
await p.evaluate(() => { location.hash = '#targets'; }); await p.waitForTimeout(2600);
if (mode === 'desktop') { await p.hover('[data-card]:nth-child(2)'); await p.waitForTimeout(900); }
await p.evaluate(() => { location.hash = '#t/steve-rogers'; }); await p.waitForTimeout(13000);
await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })); await p.waitForTimeout(3200);
await p.evaluate(() => { location.hash = '#t/victor-von-doom'; }); await p.waitForTimeout(9000);
const data = await p.evaluate(() => window.__stopAudio());
await ctx.close(); await b.close();
const v = fs.readdirSync(tmp).find((f) => f.endsWith('.webm')), audio = path.join(tmp, 'a.webm'), joined = path.join(tmp, 'j.webm');
fs.writeFileSync(audio, Buffer.from(data.split('base64,')[1], 'base64'));
const off = Math.max(0, (at - v0) / 1000);
execFileSync(FF, ['-y', '-i', path.join(tmp, v), '-itsoffset', off.toFixed(3), '-i', audio, '-map', '0:v', '-map', '1:a', '-c', 'copy', joined], { stdio: 'ignore' });
execFileSync(FF, ['-y', '-i', joined, '-ss', off.toFixed(2), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1', '-c:a', 'copy', out], { stdio: 'ignore' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(out);
