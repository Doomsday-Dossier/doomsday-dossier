// Encodes a frame-perfect capture (vcapture.mjs) to MP4: the frames at exactly 30 fps, the offline-rendered sound
// trimmed to start on the first frame. node scripts/promo/vencode.mjs <capture dir> <out.mp4> <W> <H>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FF } from './ff.mjs';

const [dir, out, W = '1920', H = '1080'] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
execFileSync(FF, ['-y', '-framerate', String(meta.fps), '-i', path.join(dir, 'frames', 'f%05d.jpg'), '-ss', meta.audioStart.toFixed(4), '-i', path.join(dir, 'audio.wav'),
  '-map', '0:v', '-map', '1:a', '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', out],
{ stdio: ['ignore', 'ignore', 'pipe'] });
console.log(out, `${(meta.frames / meta.fps).toFixed(1)} s`);
