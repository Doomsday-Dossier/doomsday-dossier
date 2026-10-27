// Builds a 3D figure from one of the supplied photos (CLAUDE.md, "3D figures from the photos"): the cut-out
// (background removed) is raised into a front surface by its depth map (Depth Anything V2, made locally), a
// rounded back is grown from the silhouette (a distance transform, so the figure has real volume), and the two
// are stitched along the outline into one closed solid, textured with the photo itself. Written as a gzipped
// `.dfig` (src/scripts/gl/figure.ts) next to a copy of the cut-out as its texture.
// Usage: node scripts/figure/build.mjs <slug> <photo number> [grid rows]
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [slug, num = '1', rowsArg] = process.argv.slice(2);
const SRC = path.join('public', 'photos2', slug);
const OUT = path.join('public', 'figures');
fs.mkdirSync(OUT, { recursive: true });

const cutFile = path.join(SRC, `${num}-cut-1920.webp`), depFile = path.join(SRC, `${num}-cdepth-1024.webp`);
const meta = await sharp(cutFile).metadata();
const aspect = meta.width / meta.height;
const rows = Number(rowsArg) || 360, cols = Math.round(rows * aspect);

// the mask and the depth, sampled on the mesh grid (depth lightly blurred: the model's fine noise is not shape)
const alpha = await sharp(cutFile).ensureAlpha().extractChannel(3).resize(cols, rows, { fit: 'fill' }).raw().toBuffer();
const depth = await sharp(depFile).greyscale().resize(cols, rows, { fit: 'fill' }).blur(1.2).raw().toBuffer();
const inside = new Uint8Array(cols * rows);
for (let i = 0; i < inside.length; i++) inside[i] = alpha[i] > 140 ? 1 : 0;

// distance to the silhouette's edge (two-pass chamfer), for the body's roundness
const dist = new Float32Array(cols * rows).fill(1e9);
for (let i = 0; i < dist.length; i++) if (!inside[i]) dist[i] = 0;
const at = (x, y) => y * cols + x;
for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
  const i = at(x, y); if (!inside[i]) continue;
  let d = dist[i];
  if (x > 0) d = Math.min(d, dist[at(x - 1, y)] + 1);
  if (y > 0) d = Math.min(d, dist[at(x, y - 1)] + 1);
  if (x > 0 && y > 0) d = Math.min(d, dist[at(x - 1, y - 1)] + 1.414);
  if (x < cols - 1 && y > 0) d = Math.min(d, dist[at(x + 1, y - 1)] + 1.414);
  if (x === 0 || y === 0 || x === cols - 1) d = Math.min(d, 1);
  dist[i] = d;
}
for (let y = rows - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--) {
  const i = at(x, y); if (!inside[i]) continue;
  let d = dist[i];
  if (x < cols - 1) d = Math.min(d, dist[at(x + 1, y)] + 1);
  if (y < rows - 1) d = Math.min(d, dist[at(x, y + 1)] + 1);
  if (x < cols - 1 && y < rows - 1) d = Math.min(d, dist[at(x + 1, y + 1)] + 1.414);
  if (x > 0 && y < rows - 1) d = Math.min(d, dist[at(x - 1, y + 1)] + 1.414);
  dist[i] = d;
}
let maxDist = 1, dlo = 255, dhi = 0;
for (let i = 0; i < dist.length; i++) if (inside[i]) { maxDist = Math.max(maxDist, dist[i]); dlo = Math.min(dlo, depth[i]); dhi = Math.max(dhi, depth[i]); }

// the figure stands 1 unit tall (the photo's height); depth from the photo gives the front its relief, the
// silhouette distance gives the whole body its thickness, front and back
const H = 1, W = aspect;
const relief = Number(process.env.RELIEF ?? 0.22), thick = Number(process.env.THICK ?? 0.13);
const round = (i) => Math.sqrt(Math.min(1, dist[i] / (maxDist * 0.55)));
const zFront = (i) => ((depth[i] - dlo) / Math.max(1, dhi - dlo)) * relief + round(i) * thick * 0.55;
const zBack = (i) => -round(i) * thick;

const pos = [], uv = [], idx = [];
const front = new Int32Array(cols * rows).fill(-1), back = new Int32Array(cols * rows).fill(-1);
for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
  const i = at(x, y); if (!inside[i]) continue;
  const px = (x / (cols - 1) - 0.5) * W, py = (1 - y / (rows - 1)) * H, u = x / (cols - 1), v = 1 - y / (rows - 1);
  front[i] = pos.length / 3; pos.push(px, py, zFront(i)); uv.push(u, v);
  back[i] = pos.length / 3; pos.push(px, py, zBack(i)); uv.push(u, v);
}
// faces where all four corners of a grid square are inside; the back wound the other way
const edges = new Map(); // boundary edges of the front surface, to stitch the sides
const addEdge = (a, b) => { const k = a < b ? `${a},${b}` : `${b},${a}`; const e = edges.get(k); if (e) e.n++; else edges.set(k, { a, b, n: 1 }); };
for (let y = 0; y < rows - 1; y++) for (let x = 0; x < cols - 1; x++) {
  const i00 = at(x, y), i10 = at(x + 1, y), i01 = at(x, y + 1), i11 = at(x + 1, y + 1);
  const tri = (p, q, r) => {
    if (front[p] < 0 || front[q] < 0 || front[r] < 0) return;
    idx.push(front[p], front[r], front[q]);
    idx.push(back[p], back[q], back[r]);
    addEdge(p, q); addEdge(q, r); addEdge(r, p);
  };
  tri(i00, i10, i11); tri(i00, i11, i01);
}
// the sides: every edge used by one front triangle only is on the outline; a quad joins it front to back
let side = 0;
for (const { a, b, n } of edges.values()) {
  if (n !== 1) continue;
  idx.push(front[a], back[a], back[b], front[a], back[b], front[b]);
  side++;
}

// normals, smoothed; the winding of the sides is fixed to face outward by the normal of their front edge later
const V = pos.length / 3, nrm = new Float32Array(V * 3);
for (let t = 0; t < idx.length; t += 3) {
  const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
  const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
  const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  for (const k of [a, b, c]) { nrm[k * 3] += nx; nrm[k * 3 + 1] += ny; nrm[k * 3 + 2] += nz; }
}
for (let k = 0; k < V; k++) { const l = Math.hypot(nrm[k * 3], nrm[k * 3 + 1], nrm[k * 3 + 2]) || 1; nrm[k * 3] /= l; nrm[k * 3 + 1] /= l; nrm[k * 3 + 2] /= l; }

// write: header JSON, Float32 positions (small enough), Int8 normals, Uint16 uvs, Uint32 indices
const tex = `${slug}-${num}.webp`;
fs.copyFileSync(cutFile, path.join(OUT, tex));
// where the subject and its face sit in the photo (src/data/photos2.json), for framing the camera
const info = JSON.parse(fs.readFileSync('src/data/photos2.json', 'utf8'))[slug].find((p) => p.n === Number(num)) ?? {};
const head = { slug, photo: Number(num), aspect, rows, cols, vertices: V, indices: idx.length, texture: tex, relief, thick, bbox: info.bbox ?? [0, 0, 1, 1], face: info.head ?? [0.5, 0.15] };
const P = Buffer.from(new Float32Array(pos).buffer), N = Buffer.from(Int8Array.from(nrm, (v) => Math.round(v * 127)).buffer), U = Buffer.from(Uint16Array.from(uv, (v) => Math.round(v * 65535)).buffer), I = Buffer.from(Uint32Array.from(idx).buffer);
const pad = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
const json = Buffer.from(JSON.stringify({ ...head, offsets: { pos: 0, nrm: P.length, uv: P.length + pad(N).length, idx: P.length + pad(N).length + pad(U).length } }));
const jpad = (4 - ((8 + json.length) % 4)) % 4;
const hdr = Buffer.alloc(8); hdr.write('DFG1', 0); hdr.writeUInt32LE(json.length + jpad, 4);
const file = path.join(OUT, `${slug}-${num}.dfig`);
fs.writeFileSync(file, zlib.gzipSync(Buffer.concat([hdr, json, Buffer.alloc(jpad, 0x20), P, pad(N), pad(U), I]), { level: 9 }));
console.log(`${slug} #${num}: ${cols}x${rows} grid, ${V} vertices, ${idx.length / 3} triangles (${side} side quads), ${(fs.statSync(file).size / 1024).toFixed(0)} KB + texture`);
