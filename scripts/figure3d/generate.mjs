// Step 2 of a character's 3D action figure: sends the prepared image (prepare.mjs) to Tencent's public
// Hunyuan3D-2 demo on Hugging Face (shape only: its texture step does not run for anonymous use) and downloads the
// model. The visitor approved sending these photos there (27 October 2026). Runs curl (Windows' own: this PC's
// network re-signs TLS, which Node rejects). Retries a failed run with a growing wait.
// Usage: node scripts/figure3d/generate.mjs <slug> [octree resolution]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const [slug, res = '256'] = process.argv.slice(2);
const HOST = 'https://tencent-hunyuan3d-2.hf.space';
const input = path.join('photo-originals', 'to3d', `${slug}.png`), out = path.join('photo-originals', 'to3d', 'out', `${slug}.glb`);
fs.mkdirSync(path.dirname(out), { recursive: true });
const curl = (args, timeout = 120) => execFileSync('curl.exe', ['-s', '-m', String(timeout), ...args], { maxBuffer: 64 * 1024 * 1024 }).toString();

// TRIES=1 fails fast (retry.sh waits out the demo's free daily limit instead of hammering it)
const TRIES = Number(process.env.TRIES) || 4;
for (let attempt = 1; attempt <= TRIES; attempt++) {
  try {
    const up = JSON.parse(curl(['-F', `files=@${input};type=image/png`, `${HOST}/upload`]))[0];
    const body = path.join(os.tmpdir(), `hy-${slug}.json`);
    fs.writeFileSync(body, JSON.stringify({ data: ['', { path: up, meta: { _type: 'gradio.FileData' }, orig_name: `${slug}.png` }, null, null, null, null, 30, 5, 1234, Number(res), true, 8000, false] }));
    const ev = JSON.parse(curl(['-H', 'Content-Type: application/json', '-d', `@${body}`, `${HOST}/call/shape_generation`])).event_id;
    const stream = curl(['-N', `${HOST}/call/shape_generation/${ev}`], 420);
    const m = stream.match(/"path": "([^"]*white_mesh\.glb)"/);
    if (!m) throw new Error(stream.slice(0, 160).replace(/\s+/g, ' '));
    curl(['-o', out, `${HOST}/file=${m[1]}`], 300);
    console.log(slug, 'model', (fs.statSync(out).size / 1048576).toFixed(1), 'MB');
    process.exit(0);
  } catch (e) {
    console.log(slug, `attempt ${attempt} failed:`, String(e.message || e).slice(0, 160));
    if (attempt < TRIES) execFileSync('powershell', ['-NoProfile', '-Command', `Start-Sleep -Seconds ${attempt * 45}`]);
  }
}
process.exit(1);
