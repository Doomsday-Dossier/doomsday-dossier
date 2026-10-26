// Checks every Real-ESRGAN upscale against its original and moves bad ones aside (to
// photo-originals/upscaled-bad), deleting the photos2 files built from them so the next build falls back
// to the original. An upscale is bad when any band of it differs strongly from the original shrunk to the
// same size: a starved GPU writes all-black images, or images that go black partway down (Sam Wilson,
// 26 October 2026), without reporting an error. Run from the project folder; then run photos2-build.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const SRC = 'photo-originals/user', UP = 'photo-originals/upscaled', BAD = 'photo-originals/upscaled-bad';
fs.mkdirSync(BAD, { recursive: true });
const set = JSON.parse(fs.readFileSync('research/photos/user-set.json', 'utf8')).set;
const base = (f) => f.replace(/\.[^.]+$/, '');
const W = 96, H = 96, BANDS = 8;
const small = (f) => sharp(f).removeAlpha().resize(W, H, { fit: 'fill' }).raw().toBuffer();
let moved = 0, removed = 0;
for (const f of fs.readdirSync(UP).filter((x) => x.endsWith('.png'))) {
  const orig = fs.readdirSync(SRC).find((x) => base(x) === base(f));
  if (!orig) continue;
  const [a, b] = await Promise.all([small(path.join(UP, f)), small(path.join(SRC, orig))]);
  // worst band: mean absolute difference per channel, 0..255
  let worst = 0;
  for (let band = 0; band < BANDS; band++) {
    let d = 0, n = 0;
    for (let y = (band * H) / BANDS; y < ((band + 1) * H) / BANDS; y++) for (let k = y * W * 3; k < (y + 1) * W * 3; k++) { d += Math.abs(a[k] - b[k]); n++; }
    worst = Math.max(worst, d / n);
  }
  if (worst < 40) continue;
  console.log('bad upscale', f, 'worst band differs by', worst.toFixed(0));
  fs.renameSync(path.join(UP, f), path.join(BAD, f)); moved++;
  for (const [slug, list] of Object.entries(set)) list.forEach((p, i) => {
    if (base(p.file) !== base(f)) return;
    for (const out of fs.readdirSync(path.join('public/photos2', slug)).filter((x) => x.startsWith(`${i + 1}-`))) { fs.rmSync(path.join('public/photos2', slug, out)); removed++; }
  });
}
console.log('moved', moved, 'bad upscales; removed', removed, 'built files');
