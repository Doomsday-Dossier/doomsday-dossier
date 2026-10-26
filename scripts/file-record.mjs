// Screen recording of a character file with its sound: the hero and its signature sound, the 30-second
// briefing as the bars tear and the stamp lands, a clearance request, the subject, then the next file over a
// seamless page change (the score carries on). The browser's video joined to the page's own sound mix.
// Usage: node scripts/file-record.mjs <base> <out.webm> <slug> [desktop|phone]
import { chromium, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [base, out, slug = 'victor-von-doom', mode = 'desktop'] = process.argv.slice(2);
const FF = 'C:/Users/DELL/AppData/Local/ms-playwright/ffmpeg-1013/ffmpeg-win64.exe';
const tmp = path.join(path.dirname(out), `.rec-file-${mode}`);
fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
const size = mode === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 720 };
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ ...(mode === 'phone' ? devices['Pixel 7'] : {}), viewport: size, recordVideo: { dir: tmp, size } });
const p = await ctx.newPage();
const videoStart = Date.now();
await p.goto(`${base}/c/${slug}/`);
await p.waitForTimeout(300);
// the sound mix, recorded inside the page; navigation is seamless, so one recorder covers every page
const at = await p.evaluate(() => {
  const s = window.__ddSound;
  const type = ['audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(new MediaStream(s.record().getAudioTracks()), { mimeType: type, audioBitsPerSecond: 192000 });
  const parts = []; rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  rec.start(250);
  window.__stopAudio = () => new Promise((res) => { rec.onstop = () => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(new Blob(parts, { type })); }; rec.stop(); });
  return performance.timeOrigin + performance.now();
});
// a first tap starts the sound: the score, and the signature while the hero is in view
await p.mouse.click(size.width * 0.5, size.height * 0.4);
await p.waitForTimeout(3200);
const glide = (y, s) => p.evaluate(([y, s]) => new Promise((r) => window.__ddLenis.scrollTo(y, { duration: s, easing: (t) => 1 - Math.pow(1 - t, 3), onComplete: r })), [y, s]);
const top = (sel) => p.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + window.__ddLenis.scroll, sel);
const openTop = await top('[data-open]'), openH = await p.evaluate(() => document.querySelector('[data-open]').offsetHeight);
// the briefing: the cover lifts, the bars tear, the stamp lands; then a pause to read it
await glide(openTop, 2.4); await p.waitForTimeout(300);
await glide(openTop + (openH - size.height) * 0.6, 3.2);
await glide(openTop + openH - size.height, 2.2); await p.waitForTimeout(3500);
// request level 2
await glide((await top('#level-2')) - 40, 2.4); await p.waitForTimeout(1200);
await p.click('[data-request="2"]'); await p.waitForTimeout(2600);
await glide((await top('[data-sub-photo]')) - 90, 2.2); await p.waitForTimeout(800);
await glide((await top('[data-sub-photo]')) + size.height * (mode === 'phone' ? 1.0 : 1.6), 5); await p.waitForTimeout(800);
// the next file, over a seamless page change: the score carries on and the next signature plays
await glide((await top('[data-voyage]')) + (mode === 'phone' ? size.height * 0.6 : 0), 2.6); await p.waitForTimeout(1200);
await p.locator('a.voy-big').click(); await p.waitForTimeout(4500);
const data = await p.evaluate(() => window.__stopAudio());
await ctx.close(); await b.close();
const video = fs.readdirSync(tmp).find((f) => f.endsWith('.webm'));
const audio = path.join(tmp, 'audio.webm');
fs.writeFileSync(audio, Buffer.from(data.split('base64,')[1], 'base64'));
const offset = Math.max(0, (at - videoStart) / 1000);
execFileSync(FF, ['-y', '-i', path.join(tmp, video), '-itsoffset', offset.toFixed(3), '-i', audio, '-map', '0:v', '-map', '1:a', '-c', 'copy', out], { stdio: 'ignore' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(out, 'audio offset', offset.toFixed(2), 's');
