// Loudness of a recording's sound, in dBFS RMS every two seconds, decoded by the browser.
// Usage: node scripts/audio-levels.mjs <file.webm> [...]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage();
for (const f of process.argv.slice(2)) {
  const b64 = fs.readFileSync(f).toString('base64');
  const r = await p.evaluate(async (b64) => {
    const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
    const a = await new OfflineAudioContext(1, 48000, 48000).decodeAudioData(buf);
    const d = a.getChannelData(0), out = [];
    for (let s = 0; s < a.duration; s += 2) {
      let e = 0, n = 0;
      for (let i = Math.floor(s * a.sampleRate); i < Math.min(d.length, (s + 2) * a.sampleRate); i++) { e += d[i] * d[i]; n++; }
      out.push(Math.round(10 * Math.log10(e / n + 1e-12)));
    }
    return out.join(' ');
  }, b64);
  console.log(f, r);
}
await b.close();
