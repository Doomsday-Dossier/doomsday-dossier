/**
 * The swarm: a cloud of points that takes the shape of a character, built in 3D from their photo and depth
 * map (see cloud.ts), and morphs from one to the next. Shared by the archive's roll call and the quiz.
 */
import * as THREE from 'three';
import { gsap } from 'gsap';
import { fullscreen, type Ctx, type HeroScene } from '../gl/engine';
import { C } from './tokens';
import { BUST, sample, stream, type Cloud, type Points } from './cloud';

/** The loose nebula the intro gathers from: a wide, flattened swirl in Doom's emerald. */
export function nebula(n: number, spread = 1, orb = false): Points {
  const rnd = stream(11), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const e = new THREE.Color(C.emerald), d = new THREE.Color(C.emeraldDeep);
  for (let i = 0; i < n; i++) {
    if (orb) {
      // a loose orb: points on shells around a hollow core, so it reads as a shape turning in space
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = (0.8 + Math.pow(rnd(), 2) * 0.5) * spread * 2.4, q = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(th) * q * r; pos[i * 3 + 1] = u * r; pos[i * 3 + 2] = Math.sin(th) * q * r;
      const c = rnd() < 0.55 ? e : d; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      continue;
    }
    const a = rnd() * Math.PI * 2, r = (1.2 + Math.pow(rnd(), 0.6) * 3.2) * spread;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = (rnd() - 0.5) * 1.4 + Math.sin(a * 3) * 0.2; pos[i * 3 + 2] = Math.sin(a) * r - 1;
    const c = rnd() < 0.5 ? e : d; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  return { pos, col };
}

const VERT = /* glsl */ `
  attribute vec3 aP1; attribute vec3 aC0; attribute vec3 aC1; attribute float aR;
  uniform float uT, uTime, uSize, uPx, uAlpha, uPtrOn, uFlip; uniform vec3 uPtr;
  varying vec3 vC; varying float vA;
  void main(){
    // two figure buffers; uFlip says which one the cloud is leaving
    vec3 pa = uFlip < 0.5 ? position : aP1, pb = uFlip < 0.5 ? aP1 : position;
    vec3 ca = uFlip < 0.5 ? aC0 : aC1, cb = uFlip < 0.5 ? aC1 : aC0;
    // each point leaves a little later than the last, so a morph ripples through the cloud
    float d = aR * 0.45;
    float t = smoothstep(d, d + 0.55, uT);
    vec3 p = mix(pa, pb, t);
    vec3 dir = normalize(vec3(sin(aR * 91.7), cos(aR * 47.3), sin(aR * 13.1 + 1.0)));
    // between figures the points swirl outward and back
    p += dir * sin(3.14159 * t) * (0.3 + aR * 0.55);
    // a slow breath, so the cloud is never quite still
    p += dir * 0.007 * sin(uTime * 1.3 + aR * 40.0);
    vec4 wp = modelMatrix * vec4(p, 1.0);
    // the cloud parts around the pointer
    vec2 dd = wp.xy - uPtr.xy; float f = exp(-dot(dd, dd) * 7.0) * uPtrOn;
    wp.xy += normalize(dd + 1e-4) * f * 0.3; wp.z += f * 0.25;
    vec4 mv = viewMatrix * wp;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPx * (0.7 + aR * 0.6) / -mv.z;
    vC = mix(ca, cb, t); vA = uAlpha;
  }`;
const FRAG = /* glsl */ `
  varying vec3 vC; varying float vA;
  void main(){
    vec2 q = gl_PointCoord - 0.5; float r = dot(q, q);
    if (r > 0.25) discard;
    gl_FragColor = vec4(vC, vA * smoothstep(0.25, 0.08, r));
  }`;
const BG = /* glsl */ `
  uniform vec3 uAcc; uniform vec2 uCtr; uniform vec2 uRes; uniform float uK;
  varying vec2 vUv;
  void main(){
    vec2 a = vec2(uRes.x / uRes.y, 1.0);
    float d = length((vUv - uCtr) * a);
    vec3 c = vec3(0.051, 0.063, 0.071) + uAcc * (0.55 * exp(-d * d * 3.0) + 0.12 * exp(-d * d * 0.6)) * uK;
    c *= 1.0 - 0.4 * smoothstep(0.55, 1.4, length((vUv - 0.5) * a));
    gl_FragColor = vec4(c, 1.0);
  }`;

/**
 * One cloud of points that gathers from the nebula into a figure, and morphs from figure to figure. The
 * home roll call drives it by scroll (`p`); other pages anchor it to an element (`anchor`) and point it at one
 * figure (`target`): the quiz forms the visitor's match this way.
 */
export class Swarm implements HeroScene {
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  bgScene = new THREE.Scene();
  bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  bg = fullscreen(BG, { uAcc: { value: new THREE.Color(C.emerald) }, uCtr: { value: new THREE.Vector2(0.5, 0.5) }, uK: { value: 0 } });
  group = new THREE.Group();
  geo = new THREE.BufferGeometry();
  mat: THREE.ShaderMaterial;
  clouds = new Map<number, Points>();
  pair: [number, number] = [-9, -9];
  private slot: [number, number] = [-9, -9]; // which figure each buffer holds
  // driven by the page
  gather = 0;           // nebula (0) to the target figure (1)
  target = 0;           // the figure the nebula gathers into
  anchor: HTMLElement | null = null; // when set, the cloud stands inside this element on the page
  hold = 1;             // how much of the anchor's height the figure fills
  p = 0;                // roll call position, 0 .. files - 1
  glow = 0;
  accent = new THREE.Color(C.emerald);
  private acc = new THREE.Color(C.emerald);
  private ray = new THREE.Raycaster(); private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); private hit = new THREE.Vector3();
  private phone = false;

  constructor(public n: number) {
    const r = stream(3), rr = new Float32Array(n);
    for (let i = 0; i < n; i++) rr[i] = r();
    for (const k of ['position', 'aP1', 'aC0', 'aC1']) this.geo.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.geo.setAttribute('aR', new THREE.BufferAttribute(rr, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      uniforms: { uT: { value: 0 }, uTime: { value: 0 }, uSize: { value: 0.022 }, uPx: { value: 500 }, uAlpha: { value: 1 }, uPtr: { value: new THREE.Vector3(9, 9, 0) }, uPtrOn: { value: 0 }, uFlip: { value: 0 } },
    });
    const pts = new THREE.Points(this.geo, this.mat);
    pts.frustumCulled = false;
    this.group.add(pts);
    this.scene.add(this.group);
    this.bgScene.add(this.bg.mesh);
    this.cam.position.set(0, 0, 5.2);
  }

  /**
   * Points the cloud at a pair of figures (a, b); false while one of them is still loading. Moving on one
   * file keeps the figure both pairs share in its buffer and writes only the new one.
   */
  setPair(a: number, b: number) {
    if (this.pair[0] === a && this.pair[1] === b) return true;
    const A = this.clouds.get(a), B = this.clouds.get(b);
    if (!A || !B) return false;
    const at = this.geo.attributes;
    const write = (slot: 0 | 1, i: number, pts: Points) => {
      (at[slot ? 'aP1' : 'position'].array as Float32Array).set(pts.pos);
      (at[slot ? 'aC1' : 'aC0'].array as Float32Array).set(pts.col);
      at[slot ? 'aP1' : 'position'].needsUpdate = true; at[slot ? 'aC1' : 'aC0'].needsUpdate = true;
      this.slot[slot] = i;
    };
    let from = this.slot.indexOf(a) as -1 | 0 | 1;
    if (from < 0) { from = this.slot[0] === b ? 1 : 0; write(from, a, A); }
    const to = (1 - from) as 0 | 1;
    if (this.slot[to] !== b) write(to, b, B);
    this.mat.uniforms.uFlip.value = from;
    this.pair = [a, b];
    return true;
  }

  mount(ctx: Ctx) { this.phone = ctx.mobile; }

  /** Stands the cloud inside the anchor element, wherever the page has scrolled it. */
  private place(ctx: Ctx) {
    const r = this.anchor!.getBoundingClientRect();
    const viewH = 2 * this.cam.position.z * Math.tan((this.cam.fov * Math.PI) / 360), k = viewH / ctx.height;
    const s = Math.min((r.height * k * 0.9 * this.hold) / BUST, (r.width * k * 0.95) / (BUST * 0.85));
    this.group.scale.setScalar(s);
    this.group.position.set((r.left + r.width / 2 - ctx.width / 2) * k, -(r.top + r.height / 2 - ctx.height / 2) * k, 0);
    const ctr = this.group.position.clone().project(this.cam);
    this.bg.mat.uniforms.uCtr.value.set(ctr.x * 0.5 + 0.5, ctr.y * 0.5 + 0.5);
    this.mat.uniforms.uSize.value = (this.phone ? 0.026 : 0.022) * s;
  }

  resize(ctx: Ctx) {
    const asp = ctx.width / ctx.height;
    this.phone = ctx.width < 760;
    this.cam.aspect = asp; this.cam.updateProjectionMatrix();
    const viewH = 2 * this.cam.position.z * Math.tan((this.cam.fov * Math.PI) / 360), viewW = viewH * asp;
    // phones: the cloud stands in the upper part of the screen; wider screens: right of centre, the words left
    const s = this.phone ? Math.min(0.72, (viewW * 0.9) / 2.2) : Math.min(1.15, viewH * 0.86 / BUST);
    this.group.scale.setScalar(s);
    this.group.position.set(this.phone ? 0 : Math.min(viewW * 0.2, 1.3), this.phone ? viewH * 0.17 : 0.02, 0);
    const ctr = this.group.position.clone().project(this.cam);
    this.bg.mat.uniforms.uCtr.value.set(ctr.x * 0.5 + 0.5, ctr.y * 0.5 + 0.5);
    this.bg.mat.uniforms.uRes.value.set(ctx.bufW, ctx.bufH);
    this.mat.uniforms.uPx.value = ctx.bufH / (2 * Math.tan((this.cam.fov * Math.PI) / 360));
    this.mat.uniforms.uSize.value = (this.phone ? 0.026 : 0.022) * s;
  }

  update(ctx: Ctx, dt: number) {
    const u = this.mat.uniforms, t = ctx.time;
    u.uTime.value = t;
    // which two figures, and how far between them
    let k: number, m: number;
    if (this.gather < 1 || this.anchor) {
      // a single figure: the nebula alone until it has loaded
      if (!this.setPair(-1, this.target)) { this.setPair(-1, -1); }
      m = this.pair[1] === this.target ? this.gather : 0; k = 0;
    }
    else {
      const last = this.n0 - 1, p = Math.min(Math.max(this.p, 0), last);
      k = Math.min(Math.floor(p), Math.max(0, last - 1));
      const f = p - k;
      if (last === 0 || !this.setPair(k, k + 1)) { m = this.pair[0] === k ? 0 : 1; }
      else m = gsap.utils.clamp(0, 1, (f - 0.22) / 0.62);
      m = m * m * (3 - 2 * m);
    }
    u.uT.value = m;
    if (this.anchor) this.place(ctx);
    // the cloud turns slowly, leans toward the pointer and makes half a turn through each morph
    const px = ctx.pointer.x - 0.5, py = ctx.pointer.y - 0.5;
    const spin = Math.sin(Math.PI * m) * (this.gather < 1 ? 1.4 : 0.9);
    this.group.rotation.y += ((Math.sin(t * 0.22) * 0.28 + px * 0.55 + spin) - this.group.rotation.y) * (1 - Math.exp(-dt * 4));
    this.group.rotation.x += ((-py * 0.22) - this.group.rotation.x) * (1 - Math.exp(-dt * 4));
    // the pointer on the cloud's plane, in world space
    this.ray.setFromCamera(new THREE.Vector2(ctx.pointer.x * 2 - 1, ctx.pointer.y * 2 - 1), this.cam);
    this.plane.constant = -this.group.position.z;
    if (this.ray.ray.intersectPlane(this.plane, this.hit)) u.uPtr.value.copy(this.hit);
    // only a real cursor or finger parts the cloud; the engine's idle drift would leave a wandering hole
    u.uPtrOn.value += ((ctx.pointer.active ? 1 : 0) * this.gather - u.uPtrOn.value) * (1 - Math.exp(-dt * 3));
    // the glow drifts toward the current character's colour
    this.acc.lerp(this.accent, 1 - Math.exp(-dt * 2.5));
    this.bg.mat.uniforms.uAcc.value.copy(this.acc);
    this.bg.mat.uniforms.uK.value = this.glow;
    const r = ctx.renderer;
    r.autoClear = false; r.clear();
    r.render(this.bgScene, this.bgCam);
    r.render(this.scene, this.cam);
    r.autoClear = true;
  }

  n0 = 1; // how many figures the roll call has (set by the page)

  dispose() { this.geo.dispose(); this.mat.dispose(); this.bg.mat.dispose(); }
}


/**
 * Loads figures into a swarm on demand, building each cloud in a worker where the browser allows it, so
 * scrolling never waits on one. Index -1 is the nebula; a character without a cut-out falls back to it.
 */
export function cloudLoader(sc: Swarm, n: number, list: (Cloud | null)[], spread = 1, orb = false) {
  sc.clouds.set(-1, nebula(n, spread, orb));
  let worker: Worker | null = null;
  try { if (typeof OffscreenCanvas !== 'undefined') worker = new Worker(new URL('./cloud.worker.ts', import.meta.url), { type: 'module' }); } catch { worker = null; }
  const waiting = new Map<number, (p: Points | null) => void>();
  worker?.addEventListener('message', (e: MessageEvent<{ id: number; pos?: Float32Array; col?: Float32Array }>) => {
    const done = waiting.get(e.data.id); waiting.delete(e.data.id);
    done?.(e.data.pos && e.data.col ? { pos: e.data.pos, col: e.data.col } : null);
  });
  const build = (i: number, c: Cloud) => worker
    ? new Promise<Points | null>((res) => { waiting.set(i, res); worker!.postMessage({ id: i, c, n }); })
    : sample(c, n);
  const loading = new Map<number, Promise<void>>();
  return (i: number) => {
    if (i < 0 || i >= list.length) return undefined;
    if (!loading.has(i)) {
      const c = list[i];
      const fallback = () => { sc.clouds.set(i, sc.clouds.get(-1)!); };
      loading.set(i, (c ? build(i, c) : Promise.resolve(null)).then((pts) => { if (pts) sc.clouds.set(i, pts); else fallback(); }, fallback));
    }
    return loading.get(i);
  };
}
