// Step 3 of a character's 3D action figure: the generated model (about 475,000 triangles, 8 to 10 MB) is cut to
// the site's budget with meshoptimizer (bundled with three.js), its normals rebuilt, positions quantised, and
// written gzipped as public/figures3d/<slug>.d3f with the paint notes from prepare.mjs (src/scripts/gl/figure3d.ts).
// Usage: node scripts/figure3d/pack.mjs <slug> [triangles]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [slug, trisArg] = process.argv.slice(2);
const target = Number(trisArg) || 90000;
const glb = fs.readFileSync(path.join('photo-originals', 'to3d', 'out', `${slug}.glb`));
const jl = glb.readUInt32LE(12), j = JSON.parse(glb.subarray(20, 20 + jl).toString());
const binStart = 20 + jl + 8, bin = glb.subarray(binStart);
const acc = (k) => { const a = j.accessors[k], v = j.bufferViews[a.bufferView], off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0); return { a, off }; };
const prim = j.meshes[0].primitives[0];
const pa = acc(prim.attributes.POSITION), ia = acc(prim.indices);
const P = new Float32Array(bin.buffer.slice(bin.byteOffset + pa.off, bin.byteOffset + pa.off + pa.a.count * 12));
const I = ia.a.componentType === 5125 ? new Uint32Array(bin.buffer.slice(bin.byteOffset + ia.off, bin.byteOffset + ia.off + ia.a.count * 4)) : Uint32Array.from(new Uint16Array(bin.buffer.slice(bin.byteOffset + ia.off, bin.byteOffset + ia.off + ia.a.count * 2)));

const { MeshoptSimplifier } = await import('three/examples/jsm/libs/meshopt_simplifier.module.js');
await MeshoptSimplifier.ready;
const [simp] = MeshoptSimplifier.simplify(I, P, 3, Math.min(I.length, target * 3), 0.004);
const [remap, V] = MeshoptSimplifier.compactMesh(simp);
const P2 = new Float32Array(V * 3);
for (let i = 0; i < remap.length; i++) { const k = remap[i]; if (k !== 0xffffffff) for (let c = 0; c < 3; c++) P2[k * 3 + c] = P[i * 3 + c]; }
// smooth normals from the faces
const N = new Float32Array(V * 3);
for (let t = 0; t < simp.length; t += 3) {
  const [a, b, c] = [simp[t], simp[t + 1], simp[t + 2]];
  const ux = P2[b * 3] - P2[a * 3], uy = P2[b * 3 + 1] - P2[a * 3 + 1], uz = P2[b * 3 + 2] - P2[a * 3 + 2];
  const vx = P2[c * 3] - P2[a * 3], vy = P2[c * 3 + 1] - P2[a * 3 + 1], vz = P2[c * 3 + 2] - P2[a * 3 + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  for (const k of [a, b, c]) { N[k * 3] += nx; N[k * 3 + 1] += ny; N[k * 3 + 2] += nz; }
}
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < V; i++) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], P2[i * 3 + c]); hi[c] = Math.max(hi[c], P2[i * 3 + c]); }
const q = new Int16Array(V * 3), nn = new Int8Array(V * 4);
for (let i = 0; i < V; i++) {
  for (let c = 0; c < 3; c++) q[i * 3 + c] = Math.round(((P2[i * 3 + c] - lo[c]) / (hi[c] - lo[c])) * 65534 - 32767);
  const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1;
  for (let c = 0; c < 3; c++) nn[i * 4 + c] = Math.round((N[i * 3 + c] / l) * 127);
}
const big = V > 65535, ind = big ? simp : Uint16Array.from(simp);
const paint = JSON.parse(fs.readFileSync(path.join('photo-originals', 'to3d', `${slug}.json`), 'utf8'));
const pad = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
const Q = pad(Buffer.from(q.buffer)), NN = Buffer.from(nn.buffer), ID = Buffer.from(ind.buffer);
const head = { ...paint, vertices: V, indices: simp.length, big, min: lo, max: hi, offsets: { pos: 0, nrm: Q.length, idx: Q.length + NN.length } };
const json = Buffer.from(JSON.stringify(head)), jp = (4 - ((8 + json.length) % 4)) % 4;
const hdr = Buffer.alloc(8); hdr.write('D3F1', 0); hdr.writeUInt32LE(json.length + jp, 4);
const file = path.join('public', 'figures3d', `${slug}.d3f`);
fs.writeFileSync(file, zlib.gzipSync(Buffer.concat([hdr, json, Buffer.alloc(jp, 0x20), Q, NN, ID]), { level: 9 }));
console.log(slug, `${I.length / 3} -> ${simp.length / 3} triangles, ${V} vertices,`, (fs.statSync(file).size / 1048576).toFixed(2), 'MB');
