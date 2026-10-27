// A turntable recording of a trial 3D model (/lab/turntable/): one full turn, no sound.
// Usage: node scripts/turntable-record.mjs <base> <file.glb> <out.webm> [extra query] [seconds]
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [base, file, out, extra = '', secs = '13'] = process.argv.slice(2);
const FF = 'C:/Users/DELL/AppData/Local/ms-playwright/ffmpeg-1013/ffmpeg-win64.exe';
const tmp = path.join(path.dirname(out), '.rec-turntable'); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
const size = { width: 720, height: 960 };
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: size, recordVideo: { dir: tmp, size } });
const p = await ctx.newPage();
const t0 = Date.now();
await p.goto(`${base}/lab/turntable/?f=${file}${extra ? `&${extra}` : ''}`);
await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
const ready = (Date.now() - t0) / 1000;
await p.waitForTimeout(Number(secs) * 1000);
await ctx.close(); await b.close();
const v = fs.readdirSync(tmp).find((f) => f.endsWith('.webm'));
execFileSync(FF, ['-y', '-i', path.join(tmp, v), '-ss', (ready + 0.3).toFixed(2), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-deadline', 'realtime', '-cpu-used', '8', '-an', out], { stdio: 'ignore' });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(out);
