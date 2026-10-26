/**
 * The Assembled ring (home). The heroes stand in a circle facing outward, each a relief built from their
 * photo and depth map; Doom looms on a dais at the centre, behind whoever the camera faces. The page drives
 * two numbers: `gather` (the intro: the dais lights and the ring rises from the floor) and `p` (0 is Doom,
 * 1..n-1 the heroes in roster order). Between 0 and 1 the camera cranes up from Doom's face to the whole
 * ring and comes down in front of the first hero; after that it orbits from hero to hero. The hero in front
 * steps forward in full light with an accent rim; the rest fall into shadow, tinted toward their colour.
 */
import * as THREE from 'three';
import type { Ctx, HeroScene } from '../gl/engine';
import { loadTex, reliefMaterial } from './depth';

/**
 * Textures for the ring are decoded off the main thread (createImageBitmap) and sent to the GPU as soon as they
 * arrive, rather than the first time a figure swings into view mid-orbit, which cost frames of 50 to 100 ms.
 */
async function bitmapTex(src: string) {
  if (typeof createImageBitmap === 'undefined') return loadTex(src);
  const blob = await fetch(src).then((r) => r.blob());
  const bmp = await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
  const t = new THREE.Texture(bmp as unknown as HTMLImageElement);
  t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
import { C } from './tokens';

export type RingFig = { cut: string; depth: string; aspect: number; bbox: [number, number, number, number]; head: [number, number] };
type Fig = { group: THREE.Group; mesh: THREE.Mesh; mat: THREE.ShaderMaterial; angle: number; lit: number; rise: number; ready: boolean };

const R = 5.8;          // ring radius
const TALL = 2.2;       // every hero stands this tall, from the top of their outline to the floor
const DOOM_TALL = 3.5;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

const FLOOR = /* glsl */ `
  uniform vec3 uAcc, uDoom; uniform vec2 uFocus; uniform float uR, uK;
  varying vec2 vP;
  void main(){
    float r = length(vP);
    vec3 c = vec3(0.035, 0.043, 0.05);
    // the ring the heroes stand on, and fine radial lines like a war-room floor
    c += uAcc * 0.5 * smoothstep(0.05, 0.0, abs(r - uR)) * uK;
    float a = atan(vP.y, vP.x);
    c += vec3(0.04) * smoothstep(0.985, 1.0, cos(a * 28.0)) * smoothstep(uR + 2.0, uR - 1.0, r) * smoothstep(0.8, 2.5, r);
    // Doom's green pool at the centre, and a pool of the hero's colour where the camera is looking
    c += uDoom * 0.55 * exp(-r * r * 0.35) * uK;
    float f = length(vP - uFocus);
    c += uAcc * 0.6 * exp(-f * f * 1.2) * uK;
    // fades into the dark at the edge
    gl_FragColor = vec4(c * smoothstep(uR + 5.0, uR + 1.0, r), 1.0);
  }`;

export class Ring implements HeroScene {
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  figs: (Fig | null)[] = [];
  doom: Fig | null = null;
  // driven by the page
  gather = 0; p = 0; glow = 0;
  accent = new THREE.Color(C.emerald);
  private acc = new THREE.Color(C.emerald);
  private floorMat: THREE.ShaderMaterial;
  private halo: THREE.Mesh;
  private dust: THREE.Points;
  private phone = false;
  private look = new THREE.Vector3(); private pos = new THREE.Vector3();
  private seg: [number, number];
  private renderer: THREE.WebGLRenderer | null = null;

  constructor(public n: number, phone: boolean) {
    this.phone = phone;
    this.seg = phone ? [36, 56] : [64, 96];
    this.scene.background = new THREE.Color(C.gunmetal);
    this.scene.fog = new THREE.Fog(C.gunmetal, 9, 22);
    this.floorMat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: FLOOR,
      uniforms: { uAcc: { value: new THREE.Color(C.emerald) }, uDoom: { value: new THREE.Color(C.emerald) }, uFocus: { value: new THREE.Vector2(0, R) }, uR: { value: R }, uK: { value: 0 } },
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 6, 96), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    // a green halo behind Doom, always turned to the camera
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uC: { value: new THREE.Color(C.emerald) }, uA: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(uC * smoothstep(1.0, 0.0, r) * uA, 1.0); }',
    }));
    this.halo.scale.set(5.5, 5.5, 1); this.halo.position.set(0, 2.9, -0.8);
    this.scene.add(this.halo);
    // embers drifting up through the hall
    const m = phone ? 500 : 1400, pos = new Float32Array(m * 3);
    for (let i = 0; i < m; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (R + 3); pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * 5; pos[i * 3 + 2] = Math.sin(a) * r; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uPx: { value: 1 }, uA: { value: 0 }, uC: { value: new THREE.Color(C.emeraldHot) } },
      vertexShader: 'uniform float uT, uPx; varying float vF; void main(){ vec3 p = position; p.y = mod(p.y + uT * 0.12, 5.0); p.x += sin(uT * 0.4 + p.z) * 0.08; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * 3.0 / -mv.z; vF = smoothstep(0.0, 1.0, p.y) * smoothstep(5.0, 3.5, p.y); }',
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying float vF; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uC * smoothstep(0.5, 0.0, d) * vF * uA * 0.6, 1.0); }',
    }));
    this.scene.add(this.dust);
    this.figs = new Array(n).fill(null);
  }

  /** Builds one figure from its textures: index 0 is Doom at the centre, the rest stand on the ring. */
  async addFigure(i: number, f: RingFig, accent: string) {
    const [map, depth] = await Promise.all([bitmapTex(f.cut), bitmapTex(f.depth)]);
    this.renderer?.initTexture(map); this.renderer?.initTexture(depth);
    const doom = i === 0;
    const mat = reliefMaterial(map, depth, new THREE.Color(accent), { amp: doom ? 0.5 : 0.32, dim: 1, rim: 0.4, spec: 0.25, tintK: 0, tint: new THREE.Color(accent).multiplyScalar(0.35), edge: 0.3 });
    const geo = new THREE.PlaneGeometry(f.aspect, 1, Math.round(this.seg[0] * Math.min(1.6, f.aspect)), this.seg[1]);
    const mesh = new THREE.Mesh(geo, mat);
    // sized by the outline: the top of the subject to the floor is TALL; very wide subjects are capped
    const [x0, y0, x1] = f.bbox;
    const tall = doom ? DOOM_TALL : TALL;
    const k = Math.min(tall / Math.max(0.2, 1 - y0), (doom ? 6 : 1.7) / Math.max(0.1, f.aspect * (x1 - x0)));
    mesh.scale.setScalar(k);
    mesh.position.set(-(f.head[0] - 0.5) * f.aspect * k, 0.5 * k, 0);
    const group = new THREE.Group();
    group.add(mesh);
    const angle = doom ? 0 : ((i - 1) / (this.n - 1)) * Math.PI * 2;
    if (doom) group.position.set(0, 0.3, 0);
    else { group.position.set(Math.sin(angle) * R, 0, Math.cos(angle) * R); group.rotation.y = angle; }
    mesh.renderOrder = doom ? 1 : 2;
    this.scene.add(group);
    const fig: Fig = { group, mesh, mat, angle, lit: 0, rise: 0, ready: true };
    this.figs[i] = fig;
    if (doom) this.doom = fig;
  }

  mount(ctx: Ctx) {
    this.renderer = ctx.renderer;
    // figures that loaded before the scene was mounted go to the GPU now
    for (const f of this.figs) if (f) { ctx.renderer.initTexture(f.mat.uniforms.uMap.value); ctx.renderer.initTexture(f.mat.uniforms.uDepth.value); }
    this.resize(ctx);
  }

  resize(ctx: Ctx) {
    this.phone = ctx.width < 760;
    this.cam.aspect = ctx.width / ctx.height;
    this.cam.fov = this.phone ? 42 : 35;
    this.cam.updateProjectionMatrix();
    (this.dust.material as THREE.ShaderMaterial).uniforms.uPx.value = ctx.bufH / ctx.height * (this.phone ? 1.4 : 1);
  }

  /** The camera for a point on the orbit (angle a), framing the hero standing there. */
  private frame(a: number, pull: number, out: THREE.Vector3, at: THREE.Vector3) {
    const d = (this.phone ? 5.4 : 4.6) + pull;
    const ex = Math.sin(a), ez = Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a);
    // wide screens: the hero stands right of centre, the words left; phones: the hero high, the words low
    const side = this.phone ? 0 : -1.0;
    out.set(ex * (R + d) + tx * side, this.phone ? 1.35 : 1.45, ez * (R + d) + tz * side);
    at.set(ex * (R - 0.6) + tx * side * 0.55, this.phone ? 0.55 : 1.25, ez * (R - 0.6) + tz * side * 0.55);
  }

  update(ctx: Ctx, dt: number) {
    const t = ctx.time, last = this.n - 1, p = Math.min(Math.max(this.p, 0), last);
    const step = (Math.PI * 2) / Math.max(1, last);
    // the camera path
    let camA = 0;
    const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
    if (p < 1) {
      // crane: Doom's face, up over the whole ring, down in front of the first hero
      const doomP = new THREE.Vector3(0, 2.8, this.phone ? 6.6 : 5.8), doomL = new THREE.Vector3(0, this.phone ? 1.7 : 2.3, 0);
      const highP = new THREE.Vector3(0, 10.5, R + 9.5), highL = new THREE.Vector3(0, 0, 0);
      this.frame(0, 0, tmpP, tmpL);
      if (p < 0.5) { const e = smooth(p / 0.5); this.pos.lerpVectors(doomP, highP, e); this.look.lerpVectors(doomL, highL, e); }
      else { const e = smooth((p - 0.5) / 0.5); this.pos.lerpVectors(highP, tmpP, e); this.look.lerpVectors(highL, tmpL, e); }
    } else {
      const k = Math.min(Math.floor(p), last - 1 < 1 ? 1 : last - 1), f = p - k;
      const m = k >= last ? 0 : smooth(clamp01((f - 0.3) / 0.6));
      camA = (k - 1) * step + m * step;
      // a slight dolly back mid-move, so the neighbours pass through the frame
      this.frame(camA, Math.sin(Math.PI * m) * 0.9, this.pos, this.look);
    }
    // a little parallax from the pointer
    const px = (ctx.pointer.x - 0.5) * (ctx.pointer.active ? 1 : 0.3), py = (ctx.pointer.y - 0.5) * (ctx.pointer.active ? 1 : 0.3);
    this.cam.position.copy(this.pos).add(new THREE.Vector3(Math.cos(camA) * px * 0.35, py * 0.2, -Math.sin(camA) * px * 0.35));
    this.cam.lookAt(this.look);
    // the heroes: rise with the intro, the one in front steps forward into the light
    const g = this.gather;
    this.figs.forEach((fig, i) => {
      if (!fig || i === 0) return;
      let diff = Math.abs(((fig.angle - camA + Math.PI * 3) % (Math.PI * 2)) - Math.PI) / step;
      if (p < 1) diff = i === 1 ? 2 * (1 - smooth(clamp01((p - 0.5) / 0.5))) + 0.0001 : 9;
      const target = smooth(clamp01(1 - diff * 1.4));
      fig.lit += (target - fig.lit) * (1 - Math.exp(-dt * 5));
      fig.rise = smooth(clamp01(g * 1.7 - (i / this.n) * 0.7));
      const r = R + 0.55 * fig.lit;
      fig.group.position.set(Math.sin(fig.angle) * r, -2.6 * (1 - fig.rise), Math.cos(fig.angle) * r);
      const u = fig.mat.uniforms, l = fig.lit;
      u.uTime.value = t; u.uIntro.value = fig.rise;
      u.uDim.value = 0.28 + 0.8 * l; u.uRim.value = 0.12 + 0.6 * l; u.uSpec.value = 0.05 + 0.3 * l; u.uTintK.value = 0.55 * (1 - l);
      u.uAlpha.value = clamp01(fig.rise * 1.5);
      u.uLight.value.set(Math.cos(t * 0.5) * 0.7, 0.45, 0.8);
    });
    // Doom: full light in the intro and the crane, then a backlit shape behind every hero, turned to the camera
    if (this.doom) {
      const u = this.doom.mat.uniforms, front = 1 - smooth(clamp01((p - 0.35) / 0.65));
      this.doom.group.rotation.y = Math.atan2(this.cam.position.x, this.cam.position.z);
      u.uTime.value = t; u.uIntro.value = g; u.uAlpha.value = clamp01(g * 1.4);
      u.uDim.value = 0.6 + 0.45 * front; u.uRim.value = 0.9 - 0.5 * front; u.uTintK.value = 0.35 * (1 - front); u.uSpec.value = 0.2;
      u.uLight.value.set(Math.sin(t * 0.4) * 0.6, 0.5, 0.8);
    }
    this.halo.rotation.y = Math.atan2(this.cam.position.x, this.cam.position.z);
    (this.halo.material as THREE.ShaderMaterial).uniforms.uA.value = (this.phone ? 0.26 : 0.34) * this.glow;
    // the floor: the ring glows in the hero's colour, a pool of it where the camera looks
    this.acc.lerp(this.accent, 1 - Math.exp(-dt * 2.5));
    const fu = this.floorMat.uniforms;
    fu.uAcc.value.copy(this.acc); fu.uK.value = this.glow;
    // (the floor lies flat with its local y along world -z)
    fu.uFocus.value.set(Math.sin(camA) * R, -Math.cos(camA) * R);
    if (p < 1) fu.uFocus.value.set(0, -(R * smooth(clamp01((p - 0.5) / 0.5)) + 40 * (1 - smooth(clamp01((p - 0.5) / 0.5)))));
    const du = (this.dust.material as THREE.ShaderMaterial).uniforms; du.uT.value = t; du.uA.value = this.glow;
    ctx.renderer.render(this.scene, this.cam);
  }

  dispose() {
    this.scene.traverse((o: any) => { o.geometry?.dispose?.(); const m = o.material; if (m) { m.uniforms?.uMap?.value?.dispose?.(); m.uniforms?.uDepth?.value?.dispose?.(); m.dispose?.(); } });
  }
}
