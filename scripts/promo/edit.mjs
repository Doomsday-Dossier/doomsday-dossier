// The promo edit: cuts from the desktop and phone recordings (scripts/promo/capture.mjs + encode.mjs), the phone shown in
// a frame for the wide video, the end cards (cards.mjs), short audio fades at every cut and loudness brought up to a
// social-video level. node scripts/promo/edit.mjs <promo dir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FF } from './ff.mjs';

const dir = process.argv[2] || 'screenshots/promo';
const C = path.join(dir, 'cards'), S = JSON.parse(fs.readFileSync(path.join(C, 'screen.json'), 'utf8'));
const run = (args) => execFileSync(FF, args, { stdio: ['ignore', 'ignore', 'pipe'] });
const enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000'];

/** Builds one video from a list of parts: [input index, from, to] cuts, or ready-made labelled parts. */
function cut(i, a, b, k) {
  const d = (b - a).toFixed(3);
  return `[${i}:v]trim=start=${a}:end=${b},setpts=PTS-STARTPTS,fps=30,format=yuv420p[v${k}];` +
    `[${i}:a]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS,afade=t=in:d=0.06,afade=t=out:st=${(b - a - 0.08).toFixed(3)}:d=0.08[a${k}];`;
}
const endPart = (i, k, secs) => `[${i}:v]fps=30,format=yuv420p,fade=t=in:st=0:d=0.6[v${k}];anullsrc=r=48000:cl=stereo,atrim=0:${secs}[a${k}];`;
// the frames arrive full-range (JPEG); video sites expect broadcast range, so everything is converted to it at the end
const finish = (n) => `${Array.from({ length: n }, (_, k) => `[v${k}][a${k}]`).join('')}concat=n=${n}:v=1:a=1[vc0][ac];[vc0]scale=out_range=tv:out_color_matrix=bt709,format=yuv420p[vc];[ac]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[ao]`;

// THE WIDE CUT (16:9): the desktop tour, the phone in its frame, the end card
{
  const D = path.join(dir, 'desktop-full.mp4'), P = path.join(dir, 'phone-full.mp4');
  const segs = [[0, 4.4], [7.0, 23.0], [23.0, 31.5], [33.0, 35.5], [39.0, 48.0], [49.0, 59.5], [73.2, 81.0]];
  let f = '', k = 0;
  for (const [a, b] of segs) f += cut(0, a, b, k++);
  // the phone, its screen rounded by the mask, on the backdrop, under the bezel
  const pa = 11.0, pb = 21.0, pd = pb - pa;
  f += `[1:v]trim=start=${pa}:end=${pb},setpts=PTS-STARTPTS,fps=30,scale=${S.w}:${S.h},format=rgba[pv];[4:v]format=gray,scale=${S.w}:${S.h}[pm];[pv][pm]alphamerge[pvm];` +
    `[2:v]fps=30,trim=0:${pd},setpts=PTS-STARTPTS[pbg];[pbg][pvm]overlay=${S.x}:${S.y}:shortest=1[pt];[pt][3:v]overlay=0:0:shortest=1,format=yuv420p,fade=t=in:st=0:d=0.3[v${k}];` +
    `[1:a]atrim=start=${pa}:end=${pb},asetpts=PTS-STARTPTS,afade=t=in:d=0.2,afade=t=out:st=${pd - 0.2}:d=0.2[a${k}];`;
  k++;
  f += endPart(5, k++, 4.5);
  f += finish(k);
  run(['-y', '-i', D, '-i', P, '-loop', '1', '-t', '12', '-i', path.join(C, 'phone-bg.png'), '-loop', '1', '-t', '12', '-i', path.join(C, 'bezel.png'), '-i', path.join(C, 'mask.png'),
    '-loop', '1', '-t', '4.5', '-i', path.join(C, 'end-wide.png'), '-filter_complex', f, '-map', '[vc]', '-map', '[ao]', ...enc, path.join(dir, 'doomsday-dossier-wide.mp4')]);
  console.log('wide done');
}

// THE TALL CUT (9:16): the phone tour and the end card
{
  const P = path.join(dir, 'phone-full.mp4');
  const segs = [[0, 2.8], [4.5, 7.0], [8.6, 25.0], [25.0, 33.0], [35.5, 40.5]];
  let f = '', k = 0;
  for (const [a, b] of segs) f += cut(0, a, b, k++);
  f += endPart(1, k++, 4);
  f += finish(k);
  run(['-y', '-i', P, '-loop', '1', '-t', '4', '-i', path.join(C, 'end-tall.png'), '-filter_complex', f, '-map', '[vc]', '-map', '[ao]', ...enc, path.join(dir, 'doomsday-dossier-vertical.mp4')]);
  console.log('tall done');
}
