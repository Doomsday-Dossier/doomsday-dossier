// Turns a capture (scripts/promo/capture.mjs) into an MP4 (H.264 + AAC, 30 fps): every frame held until the next one
// arrived, the sound lined up by wall-clock time. node scripts/promo/encode.mjs <raw dir> <out.mp4> <W> <H> [from s] [to s]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { FF } from './ff.mjs';
const [raw, out, W = '1920', H = '1080', from = '0', to = ''] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(path.join(raw, 'frames.json'), 'utf8'));
const fr = meta.frames, t0 = fr[0].t;
// the concat list: each frame lasts until the next one
let list = 'ffconcat version 1.0\n';
fr.forEach((f, i) => {
  const d = i < fr.length - 1 ? Math.max(0.001, fr[i + 1].t - f.t) : 0.5;
  list += `file 'frames/${f.f}'\nduration ${d.toFixed(4)}\n`;
});
list += `file 'frames/${fr.at(-1).f}'\n`;
fs.writeFileSync(path.join(raw, 'list.txt'), list);
const offset = meta.audioAt - t0; // the sound started this long after the first frame
const ss = Number(from), dur = to ? Number(to) - ss : null;
const args = ['-y', '-f', 'concat', '-safe', '0', '-i', path.join(raw, 'list.txt')];
if (offset >= 0) args.push('-itsoffset', offset.toFixed(3), '-i', path.join(raw, 'audio.webm'));
else args.push('-ss', (-offset).toFixed(3), '-i', path.join(raw, 'audio.webm'));
args.push('-map', '0:v', '-map', '1:a',
  '-vf', `fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-ss', String(ss), ...(dur ? ['-t', String(dur)] : []), out);
execFileSync(FF, args, { stdio: ['ignore', 'ignore', 'pipe'] });
console.log(out, 'offset', offset.toFixed(2));
