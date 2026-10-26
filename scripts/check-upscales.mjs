// Moves all-black upscales aside and deletes the photos2 files built from them, so the next build
// uses the originals. Run from the project folder.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const UP = 'photo-originals/upscaled', BAD = 'photo-originals/upscaled-bad';
fs.mkdirSync(BAD, { recursive: true });
const set = JSON.parse(fs.readFileSync('research/photos/user-set.json', 'utf8')).set;
const base = (f) => f.replace(/\.[^.]+$/, '');
let moved = 0, removed = 0;
for (const f of fs.readdirSync(UP).filter((x) => x.endsWith('.png'))) {
  const st = await sharp(path.join(UP, f)).stats();
  if (st.channels.slice(0, 3).reduce((a, c) => a + c.mean, 0) / 3 > 10) continue;
  fs.renameSync(path.join(UP, f), path.join(BAD, f)); moved++;
  for (const [slug, list] of Object.entries(set)) list.forEach((p, i) => {
    if (base(p.file) !== base(f)) return;
    for (const out of fs.readdirSync(path.join('public/photos2', slug)).filter((x) => x.startsWith(`${i + 1}-`))) { fs.rmSync(path.join('public/photos2', slug, out)); removed++; }
  });
}
console.log('moved', moved, 'black upscales; removed', removed, 'built files');
