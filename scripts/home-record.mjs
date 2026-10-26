// Screen recording of a home version with its sound: the browser's own video of the page (so the real text is
// in it) joined to the page's sound mix, recorded inside the page. The visitor clicks the gate, watches the
// forge, then scrolls into the mask and through the first files.
// Usage: node scripts/home-record.mjs <base> <out.webm> <1|2|site> [desktop|phone] [files] (site: the real home page)
import { chromium, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [base, out, v = '1', mode = 'desktop', nFiles = '8'] = process.argv.slice(2);
const FF = 'C:/Users/DELL/AppData/Local/ms-playwright/ffmpeg-1013/ffmpeg-win64.exe';
const tmp = path.join(path.dirname(out), `.rec-${v}-${mode}`);
fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
const size = mode === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 720 };
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ ...(mode === 'phone' ? devices['Pixel 7'] : {}), viewport: size, recordVideo: { dir: tmp, size } });
const p = await ctx.newPage();
const videoStart = Date.now();
await p.goto(v === 'site' ? `${base}/?rec` : `${base}/lab/home-${v}/?first&rec`);
await p.waitForFunction(() => window.__forgeReady, null, { timeout: 30000 });
await p.waitForTimeout(2200);
await p.mouse.click(size.width / 2, size.height / 2);
await p.waitForTimeout(9200); // the forge, then Doom's eyes coming up behind the title
const glide = (y, s) => p.evaluate(([y, s]) => new Promise((r) => window.__ddLenis.scrollTo(y * innerHeight, { duration: s, easing: (t) => 1 - Math.pow(1 - t, 3), onComplete: r })), [y, s]);
// into the mask: the pull back, a beat on his face, then through the eye
await glide(0.75, 2.6); await p.waitForTimeout(700);
await glide(1.5, 2.4); await p.waitForTimeout(400);
await glide(2.25, 2.2); await p.waitForTimeout(1200);
const hall = v !== '2', per = hall ? 0.75 : 0.48, step = hall ? [1.6, 1100] : [1.0, 900];
for (let i = 1; i < Number(nFiles); i++) { await glide(2.2 + i * per, step[0]); await p.waitForTimeout(step[1]); }
await p.waitForTimeout(800);
const { data, at } = await p.evaluate(() => window.__stopAudio());
const origin = await p.evaluate(() => performance.timeOrigin);
await ctx.close(); await b.close();
const video = fs.readdirSync(tmp).find((f) => f.endsWith('.webm'));
const audio = path.join(tmp, 'audio.webm');
fs.writeFileSync(audio, Buffer.from(data.split('base64,')[1], 'base64'));
const offset = Math.max(0, (origin + at - videoStart) / 1000);
execFileSync(FF, ['-y', '-i', path.join(tmp, video), '-itsoffset', offset.toFixed(3), '-i', audio, '-map', '0:v', '-map', '1:a', '-c', 'copy', out], { stdio: 'ignore' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(out, 'audio offset', offset.toFixed(2), 's');
