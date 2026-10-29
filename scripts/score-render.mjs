// Renders the DOOM-OS score (sound/score-os.ts) offline at each level and writes WAVs, with peak and loudness per
// level, to check the mix and to listen to it. node scripts/score-render.mjs <base> <outdir> [bars]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const base = (process.argv[2] || 'http://localhost:4322').replace(/\/$/, '');
const out = process.argv[3] || 'screenshots/score';
const bars = Number(process.argv[4] || 8);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(`${base}/about/`); await p.waitForFunction(() => (window).__ddRenderScore, null, { timeout: 30000 });
// SOLO=1 also measures each instrument alone at the top level
const runs = [[0], [1], [2], [3], ...(process.env.SOLO ? ['pad', 'pulse', 'ost', 'drums', 'horn', 'choir', 'braam', 'trem'].map((x) => [3, x]) : [])];
for (const [level, solo] of runs) {
  const r = await p.evaluate(async ([level, bars, solo]) => {
    const buf = await window.__ddRenderScore(level, bars, 44100, solo);
    const ch = [buf.getChannelData(0), buf.getChannelData(1)], n = buf.length;
    let peak = 0, sum = 0;
    for (let i = 0; i < n; i++) { const v = Math.max(Math.abs(ch[0][i]), Math.abs(ch[1][i])); if (v > peak) peak = v; sum += ch[0][i] * ch[0][i]; }
    // 16-bit stereo WAV
    const data = new DataView(new ArrayBuffer(44 + n * 4));
    const w = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); data.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
    data.setUint32(24, buf.sampleRate, true); data.setUint32(28, buf.sampleRate * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, n * 4, true);
    const g = peak > 0.89 ? 0.89 / peak : 1;
    for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) data.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, ch[c][i] * g)) * 32767, true);
    const bytes = new Uint8Array(data.buffer); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { b64: btoa(s), peak, rms: Math.sqrt(sum / n), secs: n / buf.sampleRate };
  }, [level, bars, solo]);
  fs.writeFileSync(`${out}/level-${level}${solo ? "-" + solo : ""}.wav`, Buffer.from(r.b64, 'base64'));
  const db = (x) => (20 * Math.log10(x)).toFixed(1);
  console.log(`level ${level}${solo ? " " + solo : ""}: ${r.secs.toFixed(1)} s, peak ${db(r.peak)} dBFS, rms ${db(r.rms)} dBFS (before the score bus and master)`);
}
await b.close();
