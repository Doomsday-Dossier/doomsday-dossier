// Joins stills into one labelled grid image, to review an animation at a glance.
// Usage: node scripts/contact-sheet.mjs <out.jpg> <cols> <width-per-frame> <frames...>
import sharp from 'sharp';
import path from 'node:path';
const [out, cols, w, ...files] = process.argv.slice(2);
const C = Number(cols), W = Number(w);
const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
const H = Math.round(W * metas[0].height / metas[0].width);
const rows = Math.ceil(files.length / C);
const tiles = await Promise.all(files.map(async (f, i) => {
  const label = Buffer.from(`<svg width="${W}" height="22"><rect width="100%" height="100%" fill="#000" opacity="0.6"/><text x="6" y="16" font-family="monospace" font-size="14" fill="#fff">${path.basename(f, path.extname(f))}</text></svg>`);
  const img = await sharp(f).resize(W, H).composite([{ input: label, top: 0, left: 0 }]).toBuffer();
  return { input: img, left: (i % C) * (W + 4), top: Math.floor(i / C) * (H + 4) };
}));
await sharp({ create: { width: C * (W + 4), height: rows * (H + 4), channels: 3, background: '#222' } }).composite(tiles).jpeg({ quality: 80 }).toFile(out);
console.log(out);
