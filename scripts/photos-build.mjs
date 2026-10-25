// Builds the site's photos from the supplied originals (photo-originals/user, git-ignored).
// For every photo in research/photos/user-set.json it writes, to public/photos/<slug>/:
//   <n>-<w>.webp   responsive widths, never larger than the original
//   <n>-ht.png     a halftone print of the photo (white dots on black) for the Halftone Lens
// and records sizes, a tiny blurred placeholder and the average colour in src/data/photos.json.
// Usage: node scripts/photos-build.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'photo-originals/user';
const OUT = 'public/photos';
const WIDTHS = [400, 800, 1280, 1920];
const HT_W = 600, CELL = 6;
const set = JSON.parse(fs.readFileSync('research/photos/user-set.json', 'utf8')).set;

async function halftone(file, out) {
  const cols = HT_W / CELL;
  const img = sharp(file).rotate().greyscale();
  const meta = await img.metadata();
  const rows = Math.round((meta.height / meta.width) * cols);
  const { data } = await img.resize(cols, rows, { fit: 'fill' }).normalise().raw().toBuffer({ resolveWithObject: true });
  let dots = '';
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const l = data[y * cols + x] / 255;
    const r = (CELL / 2) * 1.2 * Math.sqrt(l);
    if (r > 0.35) dots += `<circle cx="${x * CELL + CELL / 2}" cy="${y * CELL + CELL / 2}" r="${r.toFixed(2)}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${HT_W}" height="${rows * CELL}"><rect width="100%" height="100%" fill="#000"/><g fill="#fff">${dots}</g></svg>`;
  await sharp(Buffer.from(svg)).png({ palette: true, colors: 4, compressionLevel: 9, effort: 10 }).toFile(out);
}

const data = {};
let bytes = 0, count = 0;
for (const [slug, list] of Object.entries(set)) {
  fs.mkdirSync(path.join(OUT, slug), { recursive: true });
  data[slug] = [];
  for (const [i, p] of list.entries()) {
    const n = i + 1;
    const file = path.join(SRC, p.file);
    const base = sharp(file).rotate().toColorspace('srgb');
    const meta = await sharp(file).rotate().metadata();
    const w = meta.width, h = meta.height;
    const widths = [...new Set([...WIDTHS.filter((x) => x < w * 0.95), Math.min(w, 1920)])].sort((a, b) => a - b);
    const srcset = [];
    for (const tw of widths) {
      const out = path.join(OUT, slug, `${n}-${tw}.webp`);
      await base.clone().resize({ width: tw, kernel: 'lanczos3' }).webp({ quality: tw >= w ? 84 : 80, effort: 5, smartSubsample: true }).toFile(out);
      bytes += fs.statSync(out).size; count++;
      srcset.push({ w: tw, src: `photos/${slug}/${n}-${tw}.webp` });
    }
    const htOut = path.join(OUT, slug, `${n}-ht.png`);
    await halftone(file, htOut);
    bytes += fs.statSync(htOut).size;
    const lq = await base.clone().resize({ width: 16 }).blur(0.6).webp({ quality: 40 }).toBuffer();
    const { dominant } = await base.clone().stats();
    data[slug].push({
      n, w, h, focus: p.focus, focusM: p.focusM ?? p.focus, srcset,
      ht: `photos/${slug}/${n}-ht.png`,
      lqip: `data:image/webp;base64,${lq.toString('base64')}`,
      color: `rgb(${dominant.r},${dominant.g},${dominant.b})`,
    });
  }
}
fs.writeFileSync('src/data/photos.json', JSON.stringify(data, null, 1));
console.log(`${Object.keys(data).length} characters, ${count} WebP files + halftones, ${(bytes / 1e6).toFixed(2)} MB total`);
