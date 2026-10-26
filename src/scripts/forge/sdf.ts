/**
 * The title as a signed distance field: DOOMSDAY DOSSIER set in Big Shoulders Display 900 on two lines, drawn
 * to a canvas and turned into distances with an exact Euclidean distance transform (Felzenszwalb and
 * Huttenlocher). Stored as 0.5 + distance * 8 in title widths, so the shader reads crisp letter edges at any
 * size, bevels from the gradient, and lets cracks grow outward from the letters.
 */
const INF = 1e20;

function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}

/** Squared distance from every pixel to the nearest pixel where `on` is true. */
function edt(on: Uint8Array, w: number, h: number) {
  const grid = new Float64Array(w * h), n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let i = 0; i < w * h; i++) grid[i] = on[i] ? 0 : INF;
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = grid[y * w + x]; edt1d(f, h, d, v, z); for (let y = 0; y < h; y++) grid[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = grid[y * w + x]; edt1d(f, w, d, v, z); for (let x = 0; x < w; x++) grid[y * w + x] = d[x]; }
  return grid;
}

export type TitleField = { data: Uint8Array; w: number; h: number; aspect: number };

export async function titleField(lines = ['DOOMSDAY', 'DOSSIER'], w = 1024): Promise<TitleField> {
  const family = "'Big Shoulders Display Variable', 'Big Shoulders Display', Impact, sans-serif";
  await document.fonts.load(`900 200px ${family}`, lines.join(' ')).catch(() => {});
  const pad = Math.round(w * 0.04);
  const cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true })!;
  // size the type so the longer line fills the width, then fit the canvas height to two lines
  g.font = `900 100px ${family}`;
  const widest = Math.max(...lines.map((l) => g.measureText(l).width));
  const size = Math.floor(((w - pad * 2) / widest) * 100);
  const lineH = size * 0.86, h = Math.round(lineH * lines.length + pad * 2);
  cv.width = w; cv.height = h;
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff'; g.font = `900 ${size}px ${family}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, w / 2, pad + lineH * (i + 0.5) + size * 0.03));
  const px = g.getImageData(0, 0, w, h).data;
  const inside = new Uint8Array(w * h), outside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { const a = px[i * 4] > 127; inside[i] = a ? 1 : 0; outside[i] = a ? 0 : 1; }
  const dOut = edt(inside, w, h), dIn = edt(outside, w, h);
  const data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const sd = (Math.sqrt(dOut[i]) - Math.sqrt(dIn[i])) / w; // in title widths, negative inside
    data[i] = Math.max(0, Math.min(255, Math.round((0.5 + sd * 8) * 255)));
  }
  return { data, w, h, aspect: h / w };
}
