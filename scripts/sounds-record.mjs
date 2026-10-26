// Plays every action and signature sound on /lab/sounds/ in turn, records the mix and prints each one's peak
// and RMS loudness (dBFS), so no sound comes near the forge (about -13 dBFS at its loudest).
// Usage: node scripts/sounds-record.mjs <base> [out.webm]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [base, out = 'screenshots/sounds.webm'] = process.argv.slice(2);
const GAP = 3;
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.goto(`${base}/lab/sounds/`);
await p.waitForTimeout(500);
const { data, order } = await p.evaluate((g) => window.__playAll(g), GAP);
fs.writeFileSync(out, Buffer.from(data.split('base64,')[1], 'base64'));
const levels = await p.evaluate(async ([b64, n, gap]) => {
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  const a = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(buf);
  const L = a.getChannelData(0), R = a.getChannelData(1), sr = a.sampleRate, res = [];
  // the recorder starts a moment before the first sound; find it, then cut every gap seconds from there
  let start = 0; while (start < L.length && Math.abs(L[start]) < 1e-4 && Math.abs(R[start]) < 1e-4) start++;
  for (let i = 0; i < n; i++) {
    let pk = 0, e = 0, c = 0;
    for (let k = start + Math.floor(i * gap * sr); k < Math.min(L.length, start + Math.floor((i + 1) * gap * sr) - 1); k++) { const v = Math.max(Math.abs(L[k]), Math.abs(R[k])); if (v > pk) pk = v; e += (L[k] * L[k] + R[k] * R[k]) / 2; c++; }
    res.push([Math.round(20 * Math.log10(pk + 1e-9)), Math.round(10 * Math.log10(e / Math.max(1, c) + 1e-12))]);
  }
  return res;
}, [data.split('base64,')[1], order.length, GAP]);
order.forEach((k, i) => console.log(k.padEnd(18), 'peak', String(levels[i][0]).padStart(4), 'dBFS   rms', String(levels[i][1]).padStart(4)));
await b.close();
