/**
 * Cloth posters for the arena (Peculiar Atelier). Each fighter is a printed poster hanging from a row of
 * clips: a verlet cloth (a grid of points tied by distance constraints, plus skip-one constraints that
 * resist folding, like heavy paper) that sways in a slow draught.
 * Grab any point and drag; fling a poster toward the other and it tears free of its clips, flies across
 * and hits, which fires the arena's slam ('dd:fling'), then it is pulled back onto its clips.
 */
import * as THREE from 'three';
import type { Ctx, HeroScene } from '../gl/engine';

const COLS = 16, ROWS = 21;

class Poster {
  n = COLS * ROWS;
  pos = new Float32Array(this.n * 3);
  prev = new Float32Array(this.n * 3);
  rest: number; restY: number;
  pins: number[] = [0, 3, 6, 9, 12, COLS - 1];
  anchors: [number, number, number][] = [];
  pinned = 1; // 1 clipped on, 0 torn free (blends back in as it re-pins)
  mesh: THREE.Mesh;
  geo: THREE.PlaneGeometry;
  mat: THREE.ShaderMaterial;
  constructor(public cx: number, public cy: number, public w: number, public h: number, accent: string) {
    this.rest = w / (COLS - 1); this.restY = h / (ROWS - 1);
    this.geo = new THREE.PlaneGeometry(w, h, COLS - 1, ROWS - 1);
    this.mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { map: { value: null as THREE.Texture | null }, uAccent: { value: new THREE.Color(accent) }, uReady: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; uniform vec3 uAccent; uniform float uReady;
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){
          vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
          vec3 L = normalize(vec3(-0.4, 0.6, 0.9));
          float diff = 0.62 + 0.45 * max(dot(n, L), 0.0);
          // satin sheen, tinted with the fighter's colour, rolling across the folds
          float spec = pow(max(dot(reflect(-L, n), normalize(vV)), 0.0), 18.0);
          vec4 t = texture2D(map, gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y));
          vec3 c = mix(vec3(0.08, 0.09, 0.1), t.rgb, uReady) * diff + mix(vec3(1.0), uAccent, 0.55) * spec * 0.45;
          if (!gl_FrontFacing) c *= 0.45;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.layout(cx, cy, w, h);
  }
  layout(cx: number, cy: number, w: number, h: number) {
    this.cx = cx; this.cy = cy; this.w = w; this.h = h;
    this.rest = w / (COLS - 1); this.restY = h / (ROWS - 1);
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
      const k = (j * COLS + i) * 3;
      this.pos[k] = this.prev[k] = cx - w / 2 + i * this.rest;
      this.pos[k + 1] = this.prev[k + 1] = cy + h / 2 - j * this.restY;
      this.pos[k + 2] = this.prev[k + 2] = 0;
    }
    this.anchors = this.pins.map((i) => [this.pos[i * 3], this.pos[i * 3 + 1], 0]);
  }
  center() {
    let x = 0, y = 0;
    for (let k = 0; k < this.n; k++) { x += this.pos[k * 3]; y += this.pos[k * 3 + 1]; }
    return [x / this.n, y / this.n];
  }
  step(dt: number, t: number, grab: { i: number; x: number; y: number } | null) {
    const g = -6.5 * dt * dt, damp = 0.985;
    const wind = Math.sin(t * 0.7 + this.cx) * 0.22 + Math.sin(t * 1.9) * 0.08;
    for (let k = 0; k < this.n; k++) {
      const a = k * 3, row = Math.floor(k / COLS) / (ROWS - 1);
      for (let c = 0; c < 3; c++) {
        const p = this.pos[a + c], v = (p - this.prev[a + c]) * damp;
        this.prev[a + c] = p;
        this.pos[a + c] = p + v + (c === 1 ? g : c === 2 ? wind * row * 0.9 * dt * dt : 0);
      }
    }
    for (let it = 0; it < 5; it++) {
      for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
        const k = j * COLS + i;
        if (i < COLS - 1) this.solve(k, k + 1, this.rest);
        if (j < ROWS - 1) this.solve(k, k + COLS, this.restY);
        // skip-one links resist folding, so the print bends like paper instead of crumpling
        if (i < COLS - 2) this.solve(k, k + 2, this.rest * 2, 0.25);
        if (j < ROWS - 2) this.solve(k, k + COLS * 2, this.restY * 2, 0.25);
      }
      // clips: blend toward the anchors by how pinned the poster is
      if (this.pinned > 0) this.pins.forEach((i, q) => { const a = i * 3; for (let c = 0; c < 3; c++) this.pos[a + c] += (this.anchors[q][c] - this.pos[a + c]) * this.pinned; });
      if (grab) { const a = grab.i * 3; this.pos[a] = grab.x; this.pos[a + 1] = grab.y; this.pos[a + 2] = 0.35; }
    }
    const attr = this.geo.attributes.position as THREE.BufferAttribute;
    (attr.array as Float32Array).set(this.pos);
    attr.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
  private solve(a: number, b: number, rest: number, k = 1) {
    const A = a * 3, B = b * 3, P = this.pos;
    const dx = P[B] - P[A], dy = P[B + 1] - P[A + 1], dz = P[B + 2] - P[A + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, f = ((d - rest) / d) * 0.5 * k;
    P[A] += dx * f; P[A + 1] += dy * f; P[A + 2] += dz * f;
    P[B] -= dx * f; P[B + 1] -= dy * f; P[B + 2] -= dz * f;
  }
  nearest(x: number, y: number) {
    let best = -1, bd = 0.45 * 0.45;
    for (let k = 0; k < this.n; k++) { const dx = this.pos[k * 3] - x, dy = this.pos[k * 3 + 1] - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = k; } }
    return best;
  }
  push(vx: number, vy: number) { for (let k = 0; k < this.n; k++) { this.prev[k * 3] -= vx; this.prev[k * 3 + 1] -= vy; } }
}

export class ClothScene implements HeroScene {
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  posters: Poster[] = [];
  grab: { p: number; i: number; x: number; y: number; vx: number; vy: number; lx: number; ly: number } | null = null;
  flying: { p: number; t: number; hit: boolean } | null = null;
  acc = 0;
  onHit: () => void = () => {};
  constructor(private accents: [string, string]) {}
  mount(ctx: Ctx) {
    this.cam.position.set(0, 0, 7);
    this.posters = [new Poster(-1.4, 0.1, 2, 2.62, this.accents[0]), new Poster(1.4, 0.1, 2, 2.62, this.accents[1])];
    this.posters.forEach((p) => this.scene.add(p.mesh));
    this.resize(ctx);
  }
  resize(ctx: Ctx) {
    this.cam.aspect = ctx.width / ctx.height; this.cam.updateProjectionMatrix();
    // size the posters to what the camera sees at z = 0, so they always fit side by side
    const visH = 2 * this.cam.position.z * Math.tan((this.cam.fov * Math.PI) / 360), visW = visH * this.cam.aspect;
    const w = Math.min(2, visW * 0.4, visH * 0.42), h = w * 1.31, x = w * 0.72, y = ctx.width < 760 ? -0.15 : 0.05;
    this.posters.forEach((p, i) => p.layout(i ? x : -x, y, w, h));
  }
  setTexture(i: number, tex: THREE.Texture, accent: string) {
    const p = this.posters[i];
    p.mat.uniforms.map.value?.dispose?.();
    p.mat.uniforms.map.value = tex; p.mat.uniforms.uAccent.value.set(accent); p.mat.uniforms.uReady.value = 1;
  }
  /** pointer (NDC) to the z = 0 plane in world units */
  world(nx: number, ny: number) {
    const v = new THREE.Vector3(nx, ny, 0.5).unproject(this.cam).sub(this.cam.position).normalize();
    const t = -this.cam.position.z / v.z;
    return [this.cam.position.x + v.x * t, this.cam.position.y + v.y * t];
  }
  down(nx: number, ny: number) {
    const [x, y] = this.world(nx, ny);
    for (let p = 0; p < this.posters.length; p++) {
      const i = this.posters[p].nearest(x, y);
      if (i >= 0) { this.grab = { p, i, x, y, vx: 0, vy: 0, lx: x, ly: y }; return true; }
    }
    return false;
  }
  move(nx: number, ny: number) {
    if (!this.grab) return;
    const [x, y] = this.world(nx, ny);
    this.grab.x = x; this.grab.y = y;
  }
  up() {
    const g = this.grab; this.grab = null;
    if (!g || this.flying) return;
    const toward = g.p === 0 ? 1 : -1;
    // a hard throw toward the other poster tears it free of its clips
    if (g.vx * toward > 5.5) {
      const p = this.posters[g.p];
      p.pinned = 0;
      p.push(toward * 0.11, 0.02);
      this.flying = { p: g.p, t: 0, hit: false };
    }
  }
  update(ctx: Ctx, dt: number) {
    if (this.grab) {
      const g = this.grab, k = 1 / Math.max(dt, 1 / 120);
      g.vx += ((g.x - g.lx) * k - g.vx) * 0.35; g.vy += ((g.y - g.ly) * k - g.vy) * 0.35; g.lx = g.x; g.ly = g.y;
    }
    this.acc = Math.min(this.acc + dt, 0.05);
    const h = 1 / 60;
    while (this.acc >= h) {
      this.acc -= h;
      this.posters.forEach((p, i) => p.step(h, ctx.time, this.grab && this.grab.p === i ? this.grab : null));
      if (this.flying) {
        const f = this.flying; f.t += h;
        const p = this.posters[f.p], other = this.posters[1 - f.p];
        const [cx] = p.center(), [ox] = other.center();
        if (!f.hit && Math.abs(cx - ox) < p.w * 0.7) {
          f.hit = true;
          other.push((f.p === 0 ? 1 : -1) * 0.06, 0.01);
          p.push((f.p === 0 ? -1 : 1) * 0.05, 0.02);
          this.onHit();
        }
        // pulled back onto its clips
        if (f.t > 0.45) p.pinned = Math.min(1, p.pinned + h * 1.8);
        if (p.pinned >= 1) this.flying = null;
      }
    }
    ctx.renderer.render(this.scene, this.cam);
  }
  dispose() { this.posters.forEach((p) => { p.geo.dispose(); p.mat.uniforms.map.value?.dispose?.(); p.mat.dispose(); }); }
}

/** A poster print: the photo full bleed, file number and the fighter's name. */
export async function posterTexture(photo: string | null, focus: string, name: string, no: number, accent: string) {
  const W = 512, H = 672;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#121618'; g.fillRect(0, 0, W, H);
  if (photo) {
    const img = await new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = photo; });
    if (img) {
      const [fx, fy] = focus.split(/\s+/).map((v) => parseFloat(v) / 100);
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight), sw = W / s, sh = H / s;
      g.drawImage(img, (img.naturalWidth - sw) * (isNaN(fx) ? 0.5 : fx), (img.naturalHeight - sh) * (isNaN(fy) ? 0.3 : fy), sw, sh, 0, 0, W, H);
    }
  }
  const fade = g.createLinearGradient(0, H * 0.55, 0, H); fade.addColorStop(0, 'rgba(13,16,18,0)'); fade.addColorStop(1, 'rgba(13,16,18,0.95)');
  g.fillStyle = fade; g.fillRect(0, 0, W, H);
  g.fillStyle = accent; g.fillRect(0, H - 10, W, 10);
  await document.fonts.load("900 80px 'Big Shoulders Display Variable'", name).catch(() => {});
  let size = 92; g.font = `900 ${size}px 'Big Shoulders Display Variable', sans-serif`;
  const tw = g.measureText(name.toUpperCase()).width; if (tw > W - 48) { size *= (W - 48) / tw; g.font = `900 ${size}px 'Big Shoulders Display Variable', sans-serif`; }
  g.fillStyle = '#e7e4dc'; g.fillText(name.toUpperCase(), 24, H - 34);
  g.font = "700 18px 'Courier Prime', monospace"; g.fillStyle = accent; g.fillText(`FILE ${String(no).padStart(2, '0')}`, 24, 40);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4;
  return tex;
}
