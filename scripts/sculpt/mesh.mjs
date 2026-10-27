/**
 * Turns a sculpt (sdf.mjs) into a mesh at build time, so the site only draws triangles. Surface nets: the field
 * is sampled on a grid (coarse first, then finely only near the surface), one vertex per cell the surface crosses,
 * pulled onto the surface; normals from the field's gradient; each vertex keeps its material and an ambient
 * occlusion value baked from the field (how buried it is), which gives the sculpt its depth under any light.
 * Written to a compact binary file (`.ddm`, read by src/scripts/gl/model.ts).
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

/**
 * Meshes a sculpt inside the box [min, max] with cells of size h. Returns positions, normals, materials (0-255),
 * occlusion (0-255) and triangle indices.
 */
export function meshSDF(sdf, bmin, bmax, h, { ao = true } = {}) {
  const t0 = Date.now();
  const nx = Math.ceil((bmax[0] - bmin[0]) / h) + 1, ny = Math.ceil((bmax[1] - bmin[1]) / h) + 1, nz = Math.ceil((bmax[2] - bmin[2]) / h) + 1;
  const N = nx * ny * nz, field = new Float32Array(N);
  const at = (i, j, k) => i + nx * (j + ny * k);
  const X = (i) => bmin[0] + i * h, Y = (j) => bmin[1] + j * h, Z = (k) => bmin[2] + k * h;
  // coarse pass: blocks well away from the surface are filled with the coarse value (only its sign matters)
  const S = 4, far = S * h * 1.8;
  let evals = 0;
  for (let kb = 0; kb < nz; kb += S) for (let jb = 0; jb < ny; jb += S) for (let ib = 0; ib < nx; ib += S) {
    const cx = Math.min(ib + S / 2, nx - 1), cy = Math.min(jb + S / 2, ny - 1), cz = Math.min(kb + S / 2, nz - 1);
    const dc = sdf.d(X(cx), Y(cy), Z(cz)); evals++;
    const exact = Math.abs(dc) < far + S * h;
    for (let k = kb; k < Math.min(kb + S, nz); k++) for (let j = jb; j < Math.min(jb + S, ny); j++) for (let i = ib; i < Math.min(ib + S, nx); i++) {
      field[at(i, j, k)] = exact ? (evals++, sdf.d(X(i), Y(j), Z(k))) : dc;
    }
  }
  // one vertex per cell the surface crosses
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cat = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { v[c] = field[at(i + corners[c][0], j + corners[c][1], k + corners[c][2])]; if (v[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
      sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
      sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t; n++;
    }
    cellVert[cat(i, j, k)] = pos.length / 3;
    pos.push(X(i) + (sx / n) * h, Y(j) + (sy / n) * h, Z(k) + (sz / n) * h);
  }
  // faces: every grid edge the surface crosses joins the four cells around it
  const idx = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const d0 = field[at(i, j, k)] < 0;
    if (i < nx - 1 && d0 !== (field[at(i + 1, j, k)] < 0)) quad(cellVert[cat(i, j - 1, k - 1)], cellVert[cat(i, j, k - 1)], cellVert[cat(i, j, k)], cellVert[cat(i, j - 1, k)], !d0);
    if (j < ny - 1 && d0 !== (field[at(i, j + 1, k)] < 0)) quad(cellVert[cat(i - 1, j, k - 1)], cellVert[cat(i - 1, j, k)], cellVert[cat(i, j, k)], cellVert[cat(i, j, k - 1)], !d0);
    if (k < nz - 1 && d0 !== (field[at(i, j, k + 1)] < 0)) quad(cellVert[cat(i - 1, j - 1, k)], cellVert[cat(i, j - 1, k)], cellVert[cat(i, j, k)], cellVert[cat(i - 1, j, k)], !d0);
  }
  // pull each vertex onto the surface, then its normal, material and occlusion
  const V = pos.length / 3, P = new Float32Array(pos), Nrm = new Float32Array(V * 3), M = new Uint8Array(V), A = new Uint8Array(V);
  const e = h * 0.5;
  const grad = (x, y, z) => {
    const gx = sdf.d(x + e, y, z) - sdf.d(x - e, y, z), gy = sdf.d(x, y + e, z) - sdf.d(x, y - e, z), gz = sdf.d(x, y, z + e) - sdf.d(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1; return [gx / l, gy / l, gz / l];
  };
  for (let q = 0; q < V; q++) {
    let x = P[q * 3], y = P[q * 3 + 1], z = P[q * 3 + 2];
    for (let it = 0; it < 2; it++) { const d = sdf.d(x, y, z); if (Math.abs(d) > h) break; const g = grad(x, y, z); x -= g[0] * d; y -= g[1] * d; z -= g[2] * d; }
    P[q * 3] = x; P[q * 3 + 1] = y; P[q * 3 + 2] = z;
    const g = grad(x, y, z); Nrm[q * 3] = g[0]; Nrm[q * 3 + 1] = g[1]; Nrm[q * 3 + 2] = g[2];
    M[q] = sdf.m(x - g[0] * h * 0.3, y - g[1] * h * 0.3, z - g[2] * h * 0.3);
    if (ao) {
      // how much of the field crowds in along the normal: creases, under the brow, the folds of a hood
      let occ = 0, w = 1;
      for (let s = 1; s <= 6; s++) { const dist = 0.006 * s * s; occ += w * Math.max(0, dist - sdf.d(x + g[0] * dist, y + g[1] * dist, z + g[2] * dist)) / dist; w *= 0.62; }
      A[q] = Math.round(255 * Math.max(0, Math.min(1, 1 - occ * 0.55)));
    } else A[q] = 255;
  }
  // wind every triangle to face the way the field's gradient points (outward), so back faces can be culled
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const wx = P[c * 3] - P[a * 3], wy = P[c * 3 + 1] - P[a * 3 + 1], wz = P[c * 3 + 2] - P[a * 3 + 2];
    const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
    const nx_ = Nrm[a * 3] + Nrm[b * 3] + Nrm[c * 3], ny_ = Nrm[a * 3 + 1] + Nrm[b * 3 + 1] + Nrm[c * 3 + 1], nz_ = Nrm[a * 3 + 2] + Nrm[b * 3 + 2] + Nrm[c * 3 + 2];
    if (fx * nx_ + fy * ny_ + fz * nz_ < 0) { idx[t + 1] = c; idx[t + 2] = b; }
  }
  return { positions: P, normals: Nrm, materials: M, ao: A, indices: Uint32Array.from(idx), stats: { grid: [nx, ny, nz], evals, vertices: V, triangles: idx.length / 3, ms: Date.now() - t0 } };
}

/**
 * Writes parts (each a mesh with a name) to one `.ddm` file: a JSON header, then per part quantised positions
 * (Int16), normals with occlusion (Int8 x3 + Uint8), materials (Uint8) and indices (Uint16 or Uint32).
 */
export function writeDDM(file, parts, meta = {}) {
  const chunks = [], head = { ...meta, parts: [] };
  let offset = 0;
  const add = (buf) => { const pad = (4 - (buf.byteLength % 4)) % 4; chunks.push(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)); if (pad) chunks.push(Buffer.alloc(pad)); const o = offset; offset += buf.byteLength + pad; return o; };
  for (const p of parts) {
    const m = p.mesh, V = m.positions.length / 3;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < V; i++) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], m.positions[i * 3 + c]); hi[c] = Math.max(hi[c], m.positions[i * 3 + c]); }
    const q = new Int16Array(V * 3);
    for (let i = 0; i < V; i++) for (let c = 0; c < 3; c++) q[i * 3 + c] = Math.round(((m.positions[i * 3 + c] - lo[c]) / Math.max(1e-9, hi[c] - lo[c])) * 65534 - 32767);
    const na = new Int8Array(V * 4);
    for (let i = 0; i < V; i++) { for (let c = 0; c < 3; c++) na[i * 4 + c] = Math.round(m.normals[i * 3 + c] * 127); na[i * 4 + 3] = m.ao[i] - 128; }
    const big = V > 65535, ind = big ? m.indices : Uint16Array.from(m.indices);
    head.parts.push({
      name: p.name, vertices: V, indices: m.indices.length, big, min: lo, max: hi, pivot: p.pivot ?? null,
      pos: add(q), nrm: add(na), mat: add(m.materials), idx: add(ind),
    });
  }
  const json = Buffer.from(JSON.stringify(head));
  const jpad = (4 - ((8 + json.length) % 4)) % 4;
  const hdr = Buffer.alloc(8); hdr.write('DDM1', 0); hdr.writeUInt32LE(json.length + jpad, 4);
  // gzipped: the browser inflates it with DecompressionStream (model.ts)
  fs.writeFileSync(file, zlib.gzipSync(Buffer.concat([hdr, json, Buffer.alloc(jpad, 0x20), ...chunks]), { level: 9 }));
  return fs.statSync(file).size;
}

/**
 * Makes a mesh fit a budget: drops triangles buried out of sight (all three corners almost fully occluded, e.g.
 * between a cloak and the chest), then simplifies with meshoptimizer (bundled with three.js) to about `maxTris`,
 * keeping every vertex on a border between two materials fixed so colours stay crisp, and weighing normals and
 * occlusion so the shading survives.
 */
export async function budget(mesh, maxTris, { hidden = 0.05, error = 0.02 } = {}) {
  const { MeshoptSimplifier } = await import('three/examples/jsm/libs/meshopt_simplifier.module.js');
  await MeshoptSimplifier.ready;
  const { positions: P, normals: Nm, materials: M, ao: A } = mesh;
  let idx = mesh.indices;
  const lim = Math.round(hidden * 255), keep = [];
  for (let t = 0; t < idx.length; t += 3) if (A[idx[t]] > lim || A[idx[t + 1]] > lim || A[idx[t + 2]] > lim) keep.push(idx[t], idx[t + 1], idx[t + 2]);
  idx = Uint32Array.from(keep);
  const V = P.length / 3;
  const lock = new Uint8Array(V);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (M[a] !== M[b] || M[b] !== M[c]) lock[a] = lock[b] = lock[c] = 1;
  }
  const attrs = new Float32Array(V * 4);
  for (let i = 0; i < V; i++) { attrs[i * 4] = Nm[i * 3]; attrs[i * 4 + 1] = Nm[i * 3 + 1]; attrs[i * 4 + 2] = Nm[i * 3 + 2]; attrs[i * 4 + 3] = A[i] / 255; }
  let out = idx;
  if (idx.length / 3 > maxTris) {
    [out] = MeshoptSimplifier.simplifyWithAttributes(idx, P, 3, attrs, 4, [0.4, 0.4, 0.4, 0.8], lock, maxTris * 3, error);
  }
  const [remap, unique] = MeshoptSimplifier.compactMesh(out);
  const P2 = new Float32Array(unique * 3), N2 = new Float32Array(unique * 3), M2 = new Uint8Array(unique), A2 = new Uint8Array(unique);
  for (let i = 0; i < remap.length; i++) {
    const j = remap[i]; if (j === 0xffffffff) continue;
    for (let c = 0; c < 3; c++) { P2[j * 3 + c] = P[i * 3 + c]; N2[j * 3 + c] = Nm[i * 3 + c]; }
    M2[j] = M[i]; A2[j] = A[i];
  }
  return { positions: P2, normals: N2, materials: M2, ao: A2, indices: out, stats: { ...mesh.stats, vertices: unique, triangles: out.length / 3 } };
}
