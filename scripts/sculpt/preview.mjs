// A quick look at a sculpt without a browser or the graphics card: ray-marches the distance field on the CPU,
// across all cores, and writes a PNG of a few views side by side, lit like the site's studio.
// Usage: node scripts/sculpt/preview.mjs <character> <statue|collectible> <out.png> [views] [width]
//   views: comma-separated from front, three (three-quarter), side, back, close (the face), low
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const VIEWS = {
  front: { az: 0, el: 4, dist: 1.0 }, three: { az: 32, el: 6, dist: 1.0 }, side: { az: 90, el: 4, dist: 1.0 },
  back: { az: 180, el: 6, dist: 1.0 }, close: { az: 18, el: 4, dist: 0.5 }, low: { az: -24, el: -14, dist: 0.9 },
};

async function load(name, style) {
  const mod = await import(pathToFileURL(path.join(here, 'characters', `${name}.mjs`)).href);
  return mod.default[style].build();
}

if (isMainThread) {
  const [name, style = 'statue', out = `screenshots/sculpt/${name}-${style}.png`, views = 'front,three,side', width = '380'] = process.argv.slice(2);
  const W = Number(width), H = Math.round(W * 1.3), list = views.split(',');
  const sharp = (await import('sharp')).default;
  const t0 = Date.now();
  const cores = Math.max(1, os.cpus().length - 2);
  const tiles = [];
  for (const view of list) {
    const rows = await Promise.all(Array.from({ length: cores }, (_, c) => new Promise((res, rej) => {
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: { name, style, view, W, H, y0: Math.floor((H * c) / cores), y1: Math.floor((H * (c + 1)) / cores) } });
      w.on('message', res); w.on('error', rej);
    })));
    const img = Buffer.alloc(W * H * 3);
    for (const r of rows) Buffer.from(r.buf).copy(img, r.y0 * W * 3);
    tiles.push(await sharp(img, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer());
  }
  const fs = await import('node:fs'); fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp({ create: { width: W * tiles.length + 6 * (tiles.length - 1), height: H, channels: 3, background: '#111' } })
    .composite(tiles.map((t, i) => ({ input: t, left: i * (W + 6), top: 0 }))).png().toFile(out);
  console.log(out, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
} else {
  const { name, style, view, W, H, y0, y1 } = workerData;
  const model = await load(name, style);
  const { union } = await import(pathToFileURL(path.join(here, 'sdf.mjs')).href);
  const sdf = model.parts.length > 1 ? union(...model.parts.map((p) => p.sdf)) : model.parts[0].sdf;
  const mats = model.materials, look = model.look ?? {};
  const v = VIEWS[view], [fx, fy, fz] = model.focus, R = (model.frame ?? 1.2) * v.dist;
  const az = (v.az * Math.PI) / 180, el = (v.el * Math.PI) / 180;
  const fyv = view === 'close' ? (model.face ?? model.focus)[1] : fy, fzv = view === 'close' ? (model.face ?? model.focus)[2] : fz;
  const cam = [fx + R * Math.sin(az) * Math.cos(el), fyv + R * Math.sin(el), fzv + R * Math.cos(az) * Math.cos(el)];
  const fwd = norm([fx - cam[0], fyv - cam[1], fzv - cam[2]]), right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
  const fov = Math.tan((30 * Math.PI) / 360);
  const key = norm(look.key ?? [-0.55, 0.6, 0.6]), rim = norm(look.rim ?? [0.7, 0.35, -0.65]);
  const bg = look.bg ?? [0.04, 0.045, 0.05];
  const buf = Buffer.alloc((y1 - y0) * W * 3);
  const e = 0.0008;
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    const u = ((x + 0.5) / W - 0.5) * 2 * fov * (W / H), vv = (0.5 - (y + 0.5) / H) * 2 * fov;
    const d = norm([fwd[0] + right[0] * u + up[0] * vv, fwd[1] + right[1] * u + up[1] * vv, fwd[2] + right[2] * u + up[2] * vv]);
    let t = 0.05, hit = false;
    for (let i = 0; i < 220 && t < 4; i++) { const s = sdf.d(cam[0] + d[0] * t, cam[1] + d[1] * t, cam[2] + d[2] * t); if (s < 0.0004 * t) { hit = true; break; } t += s * 0.9; }
    let col = bg.slice();
    if (hit) {
      const p = [cam[0] + d[0] * t, cam[1] + d[1] * t, cam[2] + d[2] * t];
      const n = norm([sdf.d(p[0] + e, p[1], p[2]) - sdf.d(p[0] - e, p[1], p[2]), sdf.d(p[0], p[1] + e, p[2]) - sdf.d(p[0], p[1] - e, p[2]), sdf.d(p[0], p[1], p[2] + e) - sdf.d(p[0], p[1], p[2] - e)]);
      const m = mats[sdf.m(p[0] - n[0] * 0.0005, p[1] - n[1] * 0.0005, p[2] - n[2] * 0.0005)] ?? mats[0];
      let occ = 0, w = 1;
      for (let s = 1; s <= 6; s++) { const dist = 0.006 * s * s; occ += w * Math.max(0, dist - sdf.d(p[0] + n[0] * dist, p[1] + n[1] * dist, p[2] + n[2] * dist)) / dist; w *= 0.62; }
      const ao = Math.max(0, Math.min(1, 1 - occ * 0.55));
      const lam = Math.max(0, dot(n, key)), rl = Math.pow(Math.max(0, dot(n, rim)), 2), fres = Math.pow(1 - Math.max(0, -dot(n, d)), 3);
      const hv = norm([key[0] - d[0], key[1] - d[1], key[2] - d[2]]), spec = Math.pow(Math.max(0, dot(n, hv)), 2 / Math.max(0.02, m.rough * m.rough) ) * (1 - m.rough) * (m.metal ? 1.6 : 0.5);
      const base = m.color, amb = look.ambient ?? 0.22, keyI = look.keyI ?? 1.1, rimI = look.rimI ?? 0.9, rimC = look.rimColor ?? [0.75, 0.85, 1];
      const glow = m.glow ?? 0;
      col = [0, 1, 2].map((c) => {
        const diffuse = base[c] * (amb + keyI * lam * (m.metal ? 0.45 : 1)) * ao;
        return diffuse + spec * (m.metal ? base[c] : 1) * ao + rimC[c] * rl * rimI * (0.25 + fres) * ao + glow * base[c];
      });
    }
    const o = ((y - y0) * W + x) * 3;
    for (let c = 0; c < 3; c++) buf[o + c] = Math.round(255 * Math.pow(Math.max(0, Math.min(1, aces(col[c]))), 1 / 2.2));
  }
  parentPort.postMessage({ y0, buf });
}

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function aces(x) { return (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14); }
