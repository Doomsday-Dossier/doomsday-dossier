// Step 1 of a character's 3D action figure (CLAUDE.md, "3D action figures"): from the chosen cut-out photo,
// - the generator's input: the figure alone, cropped square with a margin, flattened onto white (a cut-out keeps
//   the whole original photo under its transparent pixels, and the generator ignores transparency: it modelled
//   the hidden background as slabs), brightened if the photo is very dark (the generator reads shape from light);
// - the paint: the same square, sharp with its alpha (projected onto the front), and a heavily blurred copy of its
//   colours spread past the outline (for the sides and back, so colours wrap round without front details), plus
//   the figure's average colour in bands down its height (where nothing else reaches).
// Usage: node scripts/figure3d/prepare.mjs <slug> <photo number>
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [slug, num] = process.argv.slice(2);
const IN = path.join('photo-originals', 'to3d'), PUB = path.join('public', 'figures3d');
fs.mkdirSync(IN, { recursive: true }); fs.mkdirSync(PUB, { recursive: true });
const src = path.join('public', 'photos2', slug, `${num}-cut-1920.webp`);
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
let x0 = W, y0 = H, x1 = 0, y1 = 0, lum = 0, n = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4;
  if (data[i + 3] > 80) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); lum += 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]; n++; }
}
lum /= Math.max(1, n);
// the square around the figure, with a margin
const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.05);
const side = Math.max(x1 - x0, y1 - y0) + 2 * pad;
const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
const left = Math.round(cx - side / 2), top = Math.round(cy - side / 2);
// place the crop on a transparent square (parts of the square may lie outside the photo)
const ex = { left: Math.max(0, left), top: Math.max(0, top) };
ex.width = Math.min(W, left + side) - ex.left; ex.height = Math.min(H, top + side) - ex.top;
const crop = await sharp(src).ensureAlpha().extract(ex).png().toBuffer();
// RGB cleared wherever alpha is clear, so nothing hidden survives
const sq = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: crop, left: ex.left - left, top: ex.top - top }]).png().toBuffer();
const S = 1024;
const square = await sharp(sq).resize(S, S).raw().toBuffer();
for (let i = 0; i < S * S; i++) if (square[i * 4 + 3] < 8) { square[i * 4] = square[i * 4 + 1] = square[i * 4 + 2] = 0; }
// a dark photo is lifted for the generator and, less, for the paint
const dark = lum < 70, lift = (img, g, k) => sharp(img, { raw: { width: S, height: S, channels: 4 } }).gamma(2.2, g).linear(k, 3);
const genIn = await (dark ? lift(square, 1.6, 1.35) : sharp(square, { raw: { width: S, height: S, channels: 4 } })).flatten({ background: '#ffffff' }).png().toBuffer();
fs.writeFileSync(path.join(IN, `${slug}.png`), genIn);
const paintRaw = await (dark ? lift(square, 1.25, 1.12) : sharp(square, { raw: { width: S, height: S, channels: 4 } })).raw().toBuffer();
await sharp(paintRaw, { raw: { width: S, height: S, channels: 4 } }).webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(PUB, `${slug}-paint.webp`));
// the blurred colour: premultiplied, blurred, divided by blurred alpha, so colour spreads out past the edges
const B = 256;
const small = await sharp(paintRaw, { raw: { width: S, height: S, channels: 4 } }).resize(B, B).raw().toBuffer();
const pre = Buffer.alloc(B * B * 4);
for (let i = 0; i < B * B; i++) { const a = small[i * 4 + 3] / 255; pre[i * 4] = small[i * 4] * a; pre[i * 4 + 1] = small[i * 4 + 1] * a; pre[i * 4 + 2] = small[i * 4 + 2] * a; pre[i * 4 + 3] = small[i * 4 + 3]; }
const blurred = await sharp(pre, { raw: { width: B, height: B, channels: 4 } }).blur(9).raw().toBuffer();
const spread = Buffer.alloc(B * B * 3);
for (let i = 0; i < B * B; i++) { const a = Math.max(1, blurred[i * 4 + 3]) / 255; for (let c = 0; c < 3; c++) spread[i * 3 + c] = Math.min(255, Math.round(blurred[i * 4 + c] / a)); }
await sharp(spread, { raw: { width: B, height: B, channels: 3 } }).webp({ quality: 85 }).toFile(path.join(PUB, `${slug}-wrap.webp`));
// the figure's box inside the square, and its average colour in bands down its height
let bx0 = S, by0 = S, bx1 = 0, by1 = 0;
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (paintRaw[(y * S + x) * 4 + 3] > 80) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
const bands = [];
for (let b = 0; b < 48; b++) {
  let r = 0, g = 0, bl = 0, m = 0;
  const ya = by0 + Math.floor(((by1 - by0) * b) / 48), yb = by0 + Math.floor(((by1 - by0) * (b + 1)) / 48);
  for (let y = ya; y < yb; y++) for (let x = bx0; x <= bx1; x++) { const i = (y * S + x) * 4; if (paintRaw[i + 3] > 150) { r += paintRaw[i]; g += paintRaw[i + 1]; bl += paintRaw[i + 2]; m++; } }
  bands.push(m ? [Math.round(r / m), Math.round(g / m), Math.round(bl / m)] : bands[b - 1] ?? [30, 30, 30]);
}
fs.writeFileSync(path.join(IN, `${slug}.json`), JSON.stringify({ slug, photo: Number(num), bbox: [bx0 / S, by0 / S, bx1 / S, by1 / S], bands, dark, lum: Math.round(lum) }));
console.log(slug, `photo ${num}`, dark ? `dark (${Math.round(lum)}), lifted` : `lum ${Math.round(lum)}`, 'box', [bx0, by0, bx1, by1].map((v) => (v / S).toFixed(2)).join(','));
