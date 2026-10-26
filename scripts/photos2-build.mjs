// Design system v2 photos. For every photo in research/photos/user-set.json, writes to public/photos2/<slug>/:
//   <n>-<w>.webp       the photo at 640/1280/1920/2560 px wide (from the Real-ESRGAN upscale when it exists,
//                      otherwise the original; never wider than the source)
//   <n>-cut-<w>.webp   the subject cut out (alpha), same framing, at 640/1280/1920 px, when a mask exists
// and records sizes, the subject's bounding box, its head point, a portrait crop for the particle
// figure, a placeholder and the average colour in src/data/photos2.json.
// Inputs (git-ignored): photo-originals/user, photo-originals/upscaled, photo-originals/masks.
// Usage: node scripts/photos2-build.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'photo-originals/user', UP = 'photo-originals/upscaled', MASKS = 'photo-originals/masks', OUT = 'public/photos2';
const FULL = [640, 1280, 1920, 2560], CUT = [640, 1280, 1920];
const set = JSON.parse(fs.readFileSync('research/photos/user-set.json', 'utf8')).set;
const base = (f) => f.replace(/\.[^.]+$/, '');

/** Bounding box (0..1) of the mask above half opacity, and the head point: the middle of the top of the subject. */
async function measure(maskFile) {
  const W = 256;
  const { data, info } = await sharp(maskFile).greyscale().resize({ width: W }).raw().toBuffer({ resolveWithObject: true });
  const H = info.height;
  let x0 = W, y0 = H, x1 = 0, y1 = 0, count = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[y * W + x] > 128) { count++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (count < W * H * 0.01) return null; // no clear subject
  // head: centre of the subject's pixels within the top 18% of its height
  const band = y0 + Math.max(2, Math.round((y1 - y0) * 0.18));
  let sx = 0, n = 0;
  for (let y = y0; y <= band; y++) for (let x = x0; x <= x1; x++) if (data[y * W + x] > 128) { sx += x; n++; }
  const head = [n ? sx / n / W : (x0 + x1) / 2 / W, (y0 + (band - y0) * 0.6) / H];
  return { bbox: [x0 / W, y0 / H, (x1 + 1) / W, (y1 + 1) / H], head, aspect: W / H, cover: count / (W * H) };
}

/** A portrait window around the subject for the particle figure, in photo coordinates. */
function figureCrop(m) {
  const [x0, y0, x1, y1] = m.bbox;
  const pad = 0.03;
  let cx0 = Math.max(0, x0 - pad), cy0 = Math.max(0, y0 - pad), cx1 = Math.min(1, x1 + pad), cy1 = Math.min(1, y1 + pad);
  // keep it no wider than 0.95:1 in pixels, centred on the head, so the figure reads as a bust
  const pxW = (cx1 - cx0) * m.aspect, pxH = cy1 - cy0;
  if (pxW > pxH * 0.95) {
    const w = (pxH * 0.95) / m.aspect, c = Math.min(1 - w / 2, Math.max(w / 2, m.head[0]));
    cx0 = c - w / 2; cx1 = c + w / 2;
  }
  const r = (v) => Math.round(v * 1000) / 1000;
  return { crop: [r(cx0), r(cy0), r(cx1), r(cy1)], focus: [r((m.head[0] - cx0) / (cx1 - cx0)), r(Math.min(0.6, ((m.head[1] - cy0) / (cy1 - cy0)) + 0.18))] };
}

const data = {};
let bytes = 0, files = 0, upscaled = 0, cut = 0;
for (const [slug, list] of Object.entries(set)) {
  fs.mkdirSync(path.join(OUT, slug), { recursive: true });
  data[slug] = [];
  for (const [i, p] of list.entries()) {
    const n = i + 1;
    const orig = path.join(SRC, p.file);
    const upFile = path.join(UP, base(p.file) + '.png');
    const useUp = fs.existsSync(upFile);
    const src = useUp ? upFile : orig;
    if (useUp) upscaled++;
    const om = await sharp(orig).metadata();
    const meta = await sharp(src).metadata();
    const W = meta.width, H = meta.height;
    const entry = { n, w: W, h: H, hd: useUp, focus: p.focus, focusM: p.focusM ?? p.focus, full: [], cut: [], bbox: null, head: null, figure: null, lqip: '', color: '' };
    for (const w of FULL.filter((w) => w <= W || w === FULL[0])) {
      const out = path.join(OUT, slug, `${n}-${w}.webp`);
      await sharp(src).resize({ width: Math.min(w, W) }).webp({ quality: 82, effort: 5 }).toFile(out);
      bytes += fs.statSync(out).size; files++;
      entry.full.push({ w: Math.min(w, W), src: `photos2/${slug}/${n}-${w}.webp` });
    }
    const maskFile = path.join(MASKS, base(p.file) + '.png');
    if (fs.existsSync(maskFile)) {
      const m = await measure(maskFile);
      if (m) {
        entry.bbox = m.bbox.map((v) => Math.round(v * 1000) / 1000);
        entry.head = m.head.map((v) => Math.round(v * 1000) / 1000);
        entry.figure = figureCrop(m);
        for (const w of CUT.filter((w) => w <= W || w === CUT[0])) {
          const ww = Math.min(w, W), hh = Math.round((H / W) * ww);
          const rgb = await sharp(src).resize(ww, hh).removeAlpha().toBuffer();
          const alpha = await sharp(maskFile).greyscale().resize(ww, hh).toBuffer();
          const out = path.join(OUT, slug, `${n}-cut-${w}.webp`);
          await sharp(rgb).joinChannel(alpha).webp({ quality: 84, alphaQuality: 90, effort: 5 }).toFile(out);
          bytes += fs.statSync(out).size; files++;
          entry.cut.push({ w: ww, src: `photos2/${slug}/${n}-cut-${w}.webp` });
        }
        cut++;
      }
    }
    const tiny = await sharp(orig).resize(16).webp({ quality: 40 }).toBuffer();
    entry.lqip = `data:image/webp;base64,${tiny.toString('base64')}`;
    const { dominant } = await sharp(orig).stats();
    entry.color = `rgb(${dominant.r},${dominant.g},${dominant.b})`;
    void om;
    data[slug].push(entry);
  }
}
fs.writeFileSync('src/data/photos2.json', JSON.stringify(data, null, 1));
console.log(`${files} files, ${(bytes / 1048576).toFixed(1)} MB; ${upscaled} from upscales, ${cut} with cut-outs`);
