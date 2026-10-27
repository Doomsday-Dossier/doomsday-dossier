/**
 * A small sculpting kit: signed distance fields (CLAUDE.md, "3D characters"). A shape is a node with `d(x, y, z)`,
 * its distance to the surface (negative inside), and `m(x, y, z)`, the material at that point. Shapes blend with
 * smooth unions the way clay presses together; shells make cloth, hoods and helmets; small displacements add
 * rivets and grooves. The meshes are built from these at build time (mesh.mjs), so the site only draws meshes.
 * Units are metres, Y up, the figure facing +Z. Most primitives are Inigo Quilez's distance functions.
 */

const { abs, sqrt, min, max, hypot, cos, sin, atan2, PI } = Math;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const len3 = (x, y, z) => sqrt(x * x + y * y + z * z);

/** A node from its two functions. */
export const node = (d, m) => ({ d, m });
const solid = (d, mat) => node(d, () => mat);

// PRIMITIVES (centred at the origin) --------------------------------------------------------------------

export const sphere = (r, mat = 0) => solid((x, y, z) => len3(x, y, z) - r, mat);

/** An ellipsoid with radii rx, ry, rz (a close bound, good enough to sculpt with). */
export const ellipsoid = (rx, ry, rz, mat = 0) => solid((x, y, z) => {
  const k0 = len3(x / rx, y / ry, z / rz), k1 = len3(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k1 === 0 ? -min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}, mat);

/** A box with half-sizes bx, by, bz and rounded edges of radius r. */
export const box = (bx, by, bz, r = 0, mat = 0) => solid((x, y, z) => {
  const qx = abs(x) - bx + r, qy = abs(y) - by + r, qz = abs(z) - bz + r;
  return len3(max(qx, 0), max(qy, 0), max(qz, 0)) + min(max(qx, max(qy, qz)), 0) - r;
}, mat);

/** A capsule from point a to point b. */
export const capsule = (a, b, r, mat = 0) => {
  const [ax, ay, az] = a, bax = b[0] - ax, bay = b[1] - ay, baz = b[2] - az, bb = bax * bax + bay * bay + baz * baz;
  return solid((x, y, z) => {
    const px = x - ax, py = y - ay, pz = z - az;
    const h = clamp((px * bax + py * bay + pz * baz) / bb, 0, 1);
    return len3(px - bax * h, py - bay * h, pz - baz * h) - r;
  }, mat);
};

/** A cone with round ends from point a (radius r1) to point b (radius r2): limbs, fingers, horns, hair locks. */
export const roundCone = (a, b, r1, r2, mat = 0) => {
  const [ax, ay, az] = a, bax = b[0] - ax, bay = b[1] - ay, baz = b[2] - az;
  const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  return solid((x, y, z) => {
    const px = x - ax, py = y - ay, pz = z - az;
    const yv = px * bax + py * bay + pz * baz, zv = yv - l2;
    const cx = px * l2 - bax * yv, cy = py * l2 - bay * yv, cz = pz * l2 - baz * yv;
    const x2 = cx * cx + cy * cy + cz * cz, y2 = yv * yv * l2, z2 = zv * zv * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zv) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yv) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
    return (sqrt(x2 * a2 * il2) + yv * rr) * il2 - r1;
  }, mat);
};

/** A torus lying in the XZ plane: ring radius R, tube radius r. */
export const torus = (R, r, mat = 0) => solid((x, y, z) => hypot(hypot(x, z) - R, y) - r, mat);

/** A cylinder along Y: half-height h, radius r, edges rounded by e. */
export const cylinder = (h, r, e = 0, mat = 0) => solid((x, y, z) => {
  const dx = hypot(x, z) - r + e, dy = abs(y) - h + e;
  return min(max(dx, dy), 0) + hypot(max(dx, 0), max(dy, 0)) - e;
}, mat);

/** A five-pointed star in the XY plane, extruded to half-depth t along Z (iq's sdStar5). */
export const star = (r, rf, t, mat = 0) => {
  const k1x = 0.809016994375, k1y = -0.587785252292, k2x = -k1x, k2y = k1y;
  return solid((x, y, z) => {
    let px = abs(x), py = y;
    let dd = max(k1x * px + k1y * py, 0) * 2; px -= dd * k1x; py -= dd * k1y;
    dd = max(k2x * px + k2y * py, 0) * 2; px -= dd * k2x; py -= dd * k2y;
    px = abs(px); py -= r;
    const bax = rf * -k1y, bay = rf * k1x - 1;
    const h = clamp((px * bax + py * bay) / (bax * bax + bay * bay), 0, r);
    const d2 = hypot(px - bax * h, py - bay * h) * Math.sign(py * bax - px * bay);
    return hypot(max(d2, 0), max(abs(z) - t, 0)) + min(max(d2, abs(z) - t), 0);
  }, mat);
};

/** The half-space below a plane through the origin with normal n (the sculptor's flat cut). */
export const halfSpace = (nx, ny, nz, mat = 0) => {
  const l = len3(nx, ny, nz); nx /= l; ny /= l; nz /= l;
  return solid((x, y, z) => x * nx + y * ny + z * nz, mat);
};

// COMBINING -----------------------------------------------------------------------------------------------

/** Hard union: the material of whichever shape is nearer. */
export const union = (...ns) => node(
  (x, y, z) => { let d = Infinity; for (const n of ns) d = min(d, n.d(x, y, z)); return d; },
  (x, y, z) => { let d = Infinity, m = 0; for (const n of ns) { const v = n.d(x, y, z); if (v < d) { d = v; m = n.m(x, y, z); } } return m; },
);

/** Smooth union: shapes melt into each other over a radius k, like clay pressed together. */
export const smooth = (k, ...ns) => node(
  (x, y, z) => {
    let d = ns[0].d(x, y, z);
    for (let i = 1; i < ns.length; i++) { const b = ns[i].d(x, y, z), h = clamp(0.5 + (0.5 * (b - d)) / k, 0, 1); d = mix(b, d, h) - k * h * (1 - h); }
    return d;
  },
  (x, y, z) => { let d = Infinity, m = 0; for (const n of ns) { const v = n.d(x, y, z); if (v < d) { d = v; m = n.m(x, y, z); } } return m; },
);

/** Cut b out of a; with k > 0 the cut's edge is softened. The cut face takes `cutMat` if given. */
export const cut = (a, b, k = 0, cutMat = null) => node(
  (x, y, z) => {
    const da = a.d(x, y, z), db = -b.d(x, y, z);
    if (k <= 0) return max(da, db);
    const h = clamp(0.5 - (0.5 * (db - da)) / k, 0, 1);
    return mix(db, da, h) + k * h * (1 - h);
  },
  (x, y, z) => (cutMat !== null && -b.d(x, y, z) > a.d(x, y, z) ? cutMat : a.m(x, y, z)),
);

/** Only where both are solid. */
export const intersect = (a, b, k = 0) => node(
  (x, y, z) => {
    const da = a.d(x, y, z), db = b.d(x, y, z);
    if (k <= 0) return max(da, db);
    const h = clamp(0.5 - (0.5 * (db - da)) / k, 0, 1);
    return mix(db, da, h) + k * h * (1 - h);
  },
  (x, y, z) => a.m(x, y, z),
);

/** A hollow skin of thickness 2t around a shape's surface: cloth, hoods, helmets, cloaks. */
export const shell = (n, t) => node((x, y, z) => abs(n.d(x, y, z)) - t, n.m);

/** Grows (r > 0) or shrinks a shape; also rounds its edges. */
export const inflate = (n, r) => node((x, y, z) => n.d(x, y, z) - r, n.m);

/** Adds a small surface relief (grooves, rivets, weave). Keep it small: it bends the distance field. */
export const relief = (n, f) => node((x, y, z) => n.d(x, y, z) + f(x, y, z), n.m);

/** Repaints a shape: a fixed material, or `f(x, y, z, old)` for stripes, panels and trims. */
export const paint = (n, f) => node(n.d, typeof f === 'number' ? () => f : (x, y, z) => f(x, y, z, n.m(x, y, z)));

/** Skips a costly part far from the point (a bounding sphere), for speed. */
export const bound = (n, cx, cy, cz, r) => node(
  (x, y, z) => { const o = len3(x - cx, y - cy, z - cz) - r; return o > 0.02 ? o : n.d(x, y, z); },
  n.m,
);

// PLACING ---------------------------------------------------------------------------------------------------

export const move = (n, tx, ty, tz) => node((x, y, z) => n.d(x - tx, y - ty, z - tz), (x, y, z) => n.m(x - tx, y - ty, z - tz));

/** Rotates by Euler angles in degrees (X, then Y, then Z), about the origin. */
export const rotate = (n, ax = 0, ay = 0, az = 0) => {
  const r = (v) => (v * PI) / 180;
  const [cx, sx, cy, sy, cz, sz] = [cos(r(ax)), sin(r(ax)), cos(r(ay)), sin(r(ay)), cos(r(az)), sin(r(az))];
  // inverse of R = Rz * Ry * Rx, applied to the point
  const m = [
    cy * cz, cy * sz, -sy,
    sx * sy * cz - cx * sz, sx * sy * sz + cx * cz, sx * cy,
    cx * sy * cz + sx * sz, cx * sy * sz - sx * cz, cx * cy,
  ];
  const tf = (f) => (x, y, z) => f(m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z);
  return node(tf(n.d), tf(n.m));
};

/** Rotates about a pivot point. */
export const rotateAt = (n, p, ax = 0, ay = 0, az = 0) => move(rotate(move(n, -p[0], -p[1], -p[2]), ax, ay, az), p[0], p[1], p[2]);

export const scale = (n, s) => node((x, y, z) => n.d(x / s, y / s, z / s) * s, (x, y, z) => n.m(x / s, y / s, z / s));

/** Stretches along each axis (not distance-exact: keep the factors near 1). */
export const stretch = (n, sx, sy, sz) => node((x, y, z) => n.d(x / sx, y / sy, z / sz) * min(sx, sy, sz), (x, y, z) => n.m(x / sx, y / sy, z / sz));

/** Left-right symmetry: build one side at x > 0 and it appears on both. */
export const mirrorX = (n) => node((x, y, z) => n.d(abs(x), y, z), (x, y, z) => n.m(abs(x), y, z));

export const mirrorY = (n) => node((x, y, z) => n.d(x, Math.abs(y), z), (x, y, z) => n.m(x, Math.abs(y), z));
export const mirrorZ = (n) => node((x, y, z) => n.d(x, y, Math.abs(z)), (x, y, z) => n.m(x, y, Math.abs(z)));

/** Repeats a shape n times around the Y axis (rivets round a collar, discs, studs). */
export const around = (n, count, phase = 0) => {
  const s = (2 * PI) / count;
  const fold = (f) => (x, y, z) => { const r = hypot(x, z), a = atan2(z, x) - phase, q = a - s * Math.round(a / s); return f(r * cos(q), y, r * sin(q)); };
  return node(fold(n.d), fold(n.m));
};

/** Bends a shape around the Y axis, as cloth or a mask wraps a head: x becomes the angle at radius R. */
export const wrapY = (n, R) => node(
  (x, y, z) => { const r = hypot(x, z), a = atan2(x, z); return n.d(a * R, y, r - R); },
  (x, y, z) => { const r = hypot(x, z), a = atan2(x, z); return n.m(a * R, y, r - R); },
);

export const util = { clamp, mix, len3 };

// NOISE, for natural irregularity: hammer pits, dents, rough stone ------------------------------------------

const hash3 = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const fade = (t) => t * t * (3 - 2 * t);

/** Smooth value noise in [-1, 1]; one unit per feature. */
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  const x00 = mix(c(0, 0, 0), c(1, 0, 0), xf), x10 = mix(c(0, 1, 0), c(1, 1, 0), xf), x01 = mix(c(0, 0, 1), c(1, 0, 1), xf), x11 = mix(c(0, 1, 1), c(1, 1, 1), xf);
  return mix(mix(x00, x10, yf), mix(x01, x11, yf), zf) * 2 - 1;
}

/** Fractal noise: `oct` octaves, the first at `freq` features per metre. */
export function fbm3(x, y, z, freq = 10, oct = 4) {
  let v = 0, a = 0.5, f = freq;
  for (let i = 0; i < oct; i++) { v += a * noise3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
  return v;
}
