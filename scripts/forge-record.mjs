// Screen recording of a forge version WITH SOUND: the page records its own canvas and its sound mix together
// (MediaRecorder), from the gate through the click to the settled title and the score coming in.
// Then checks the file has sound by decoding its audio and printing loudness per half second.
// Usage: node scripts/forge-record.mjs <base> <out.webm> <a|b> [desktop|phone] [seconds after the click]
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const [base, out, v = 'a', mode = 'desktop', after] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext(mode === 'phone' ? { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`${base}/lab/forge-${v}/?record`);
await p.waitForFunction(() => window.__forgeReady, null, { timeout: 30000 });
await p.waitForTimeout(2200); // the gate: the ember and "Enter the forge"
const box = p.viewportSize();
await p.mouse.click(box.width / 2, box.height / 2);
await p.waitForTimeout(Number(after || (v === 'b' ? 9 : 11)) * 1000);
const dataUrl = await p.evaluate(() => window.__stopRec());
// the header says codecs=vp9,opus: split on 'base64,', not the first comma
const b64 = dataUrl.slice(dataUrl.indexOf('base64,') + 7);
const buf = Buffer.from(b64, 'base64');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buf);
// check the sound: decode the recording's audio and measure it
const report = await p.evaluate(async (b64) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ac = new OfflineAudioContext(1, 48000, 48000);
  try {
    const audio = await ac.decodeAudioData(bytes.buffer);
    const d = audio.getChannelData(0), step = Math.floor(audio.sampleRate / 2), rows = [];
    for (let i = 0; i < d.length; i += step) { let s = 0; for (let k = i; k < Math.min(d.length, i + step); k++) s += d[k] * d[k]; rows.push(Math.round(20 * Math.log10(Math.sqrt(s / step) + 1e-6))); }
    return { seconds: audio.duration.toFixed(1), dbPerHalfSecond: rows.join(' ') };
  } catch (e) { return { error: String(e) }; }
}, b64);
console.log(out, (buf.length / 1048576).toFixed(1) + ' MB', JSON.stringify(report), errs.length ? errs : '');
await b.close();
