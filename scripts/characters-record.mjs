// Screen recording, with sound, of one style of the 3D character prototypes: Doom, Steve Rogers and Thor in turn
// (/lab/characters/, window.__play). The browser's video joined to the page's own sound mix.
// Usage: node scripts/characters-record.mjs <base> <out.webm> <statue|collectible> [desktop|phone]
import { chromium, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [base, out, style = 'statue', mode = 'desktop'] = process.argv.slice(2);
const FF = 'C:/Users/DELL/AppData/Local/ms-playwright/ffmpeg-1013/ffmpeg-win64.exe';
const tmp = path.join(path.dirname(out), `.rec-chars-${style}-${mode}`);
fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
const size = mode === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 720 };
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ ...(mode === 'phone' ? devices['Pixel 7'] : {}), viewport: size, recordVideo: { dir: tmp, size } });
const p = await ctx.newPage();
const videoStart = Date.now();
await p.goto(`${base}/lab/characters/?s=${style}&rec`);
await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
const at = await p.evaluate(() => {
  const s = window.__ddSound;
  const type = ['audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(new MediaStream(s.record().getAudioTracks()), { mimeType: type, audioBitsPerSecond: 192000 });
  const parts = []; rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  rec.start(250);
  window.__stopAudio = () => new Promise((res) => { rec.onstop = () => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(new Blob(parts, { type })); }; rec.stop(); });
  return performance.timeOrigin + performance.now();
});
await p.evaluate(() => window.__play());
await p.waitForTimeout(800);
const data = await p.evaluate(() => window.__stopAudio());
await ctx.close(); await b.close();
const video = fs.readdirSync(tmp).find((f) => f.endsWith('.webm'));
const audio = path.join(tmp, 'audio.webm');
fs.writeFileSync(audio, Buffer.from(data.split('base64,')[1], 'base64'));
const offset = Math.max(0, (at - videoStart) / 1000);
// the seconds before the page was ready (models loading) are cut off the front
const joined = path.join(tmp, 'joined.webm');
execFileSync(FF, ['-y', '-i', path.join(tmp, video), '-itsoffset', offset.toFixed(3), '-i', audio, '-map', '0:v', '-map', '1:a', '-c', 'copy', joined], { stdio: 'ignore' });
// an exact cut needs a re-encode (a copy can only cut at keyframes): VP9, fast settings, the sound copied as is
execFileSync(FF, ['-y', '-i', joined, '-ss', (offset + 0.15).toFixed(2), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1', '-c:a', 'copy', out], { stdio: 'ignore' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(out, 'audio offset', offset.toFixed(2), 's');
