/**
 * Depth diorama: a character's photo turned into a small 3D scene. The cut-out subject is a mesh pushed
 * out by its depth map (Depth Anything V2, made locally); behind it, at real depth, their giant name and
 * a dimmed backdrop from their world, with dust drifting between the layers. A camera orbits with the
 * pointer, pushes in with scroll and drifts with time, and a light in the character's colour sweeps
 * across their shape, using surface normals read from the depth map (the "4D").
 */
import * as THREE from 'three';
import type { Ctx } from '../gl/engine';

export type DioOpts = {
  cut: string; depth: string; back: string | null; backDepth: string | null;
  lines: string[]; font: string; weight: number; accent: string; head: [number, number]; bbox: [number, number, number, number]; aspect: number;
};

export const loadTex = (src: string) => new Promise<THREE.Texture>((res, rej) => new THREE.TextureLoader().load(src, (t) => { t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; res(t); }, undefined, rej));

const VERT = /* glsl */ `
  uniform sampler2D uDepth; uniform float uAmp, uTime, uIntro;
  varying vec2 vUv;
  void main(){
    vUv = uv;
    float d = texture2D(uDepth, uv).r;
    vec3 p = position;
    // the photo becomes relief: near pixels come forward; it breathes very slightly with time
    p.z += (d - 0.3) * uAmp * uIntro + sin(uTime * 0.7 + uv.y * 4.0) * 0.003 * d;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const FRAG = /* glsl */ `
  uniform sampler2D uMap, uDepth; uniform vec2 uTexel; uniform vec3 uAccent, uLight, uTint;
  uniform float uAlpha, uDim, uRim, uSpec, uTintK, uEdge;
  varying vec2 vUv;
  void main(){
    vec4 c = texture2D(uMap, vUv);
    // tighten the cut-out's alpha a little: the mask edge often carries a pale halo from the old background
    c.a = smoothstep(uEdge, 1.0, c.a);
    if (c.a < 0.02) discard;
    // surface normal from the depth map, so light can move across the real shape
    float dx = texture2D(uDepth, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uDepth, vUv - vec2(uTexel.x, 0.0)).r;
    float dy = texture2D(uDepth, vUv + vec2(0.0, uTexel.y)).r - texture2D(uDepth, vUv - vec2(0.0, uTexel.y)).r;
    vec3 n = normalize(vec3(-dx * 9.0, -dy * 9.0, 1.0));
    float lam = max(dot(n, normalize(uLight)), 0.0);
    float rim = pow(1.0 - n.z, 1.6);
    vec3 col = c.rgb * (0.72 + 0.42 * lam) * uDim;
    col = mix(col, uTint * (0.25 + 0.75 * dot(c.rgb, vec3(0.3, 0.59, 0.11))), uTintK);
    col += uAccent * (rim * uRim + pow(lam, 10.0) * uSpec);
    gl_FragColor = vec4(col, c.a * uAlpha);
  }`;

export function reliefMaterial(map: THREE.Texture, depth: THREE.Texture, accent: THREE.Color, o: { amp: number; dim: number; rim: number; spec: number; tintK: number; tint: THREE.Color; edge?: number }) {
  const img = depth.image as { width: number; height: number };
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: true, vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      uMap: { value: map }, uDepth: { value: depth }, uTexel: { value: new THREE.Vector2(1.5 / img.width, 1.5 / img.height) },
      uAmp: { value: o.amp }, uTime: { value: 0 }, uIntro: { value: 0 }, uAlpha: { value: 1 }, uDim: { value: o.dim }, uRim: { value: o.rim }, uSpec: { value: o.spec },
      uAccent: { value: accent }, uLight: { value: new THREE.Vector3(-0.5, 0.4, 0.8) }, uTint: { value: o.tint }, uTintK: { value: o.tintK }, uEdge: { value: o.edge ?? 0 },
    },
  });
}

export class Diorama {
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  subject?: THREE.Mesh; back?: THREE.Mesh; name?: THREE.Mesh; glow?: THREE.Mesh; dust?: THREE.Points;
  ready = false;
  // driven from the page
  intro = 0; scroll = 0; alpha = 1; pointer = new THREE.Vector2(); private pt = new THREE.Vector2();
  private D = 4; private viewH = 1; private viewW = 1; private head = 0.5; private bbox: [number, number, number, number] = [0, 0, 1, 1];

  async load(o: DioOpts, ctx: Ctx) {
    const accent = new THREE.Color(o.accent);
    const [cut, depth, back, backDepth] = await Promise.all([loadTex(o.cut), loadTex(o.depth), o.back ? loadTex(o.back) : Promise.resolve(null), o.backDepth ? loadTex(o.backDepth) : Promise.resolve(null)]);
    const seg = ctx.mobile ? [110, 140] : [200, 260];
    // subject: one unit tall, as wide as the photo
    const sw = o.aspect, sh = 1;
    this.head = o.head[0]; this.bbox = o.bbox;
    this.subject = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh, Math.round(seg[0] * Math.min(1.8, o.aspect)), seg[1]),
      reliefMaterial(cut, depth, accent, { amp: 0.22, dim: 1, rim: 0.55, spec: 0.35, tintK: 0, tint: accent, edge: 0.3 }));
    this.subject.renderOrder = 5;
    this.scene.add(this.subject);
    // backdrop: their world, dimmed and pulled toward their colour, far behind
    if (back && backDepth) {
      const bi = back.image as { width: number; height: number };
      this.back = new THREE.Mesh(new THREE.PlaneGeometry(bi.width / bi.height, 1, 90, 60),
        reliefMaterial(back, backDepth, accent, { amp: 0.5, dim: 0.4, rim: 0.12, spec: 0.1, tintK: 0.6, tint: accent.clone().multiplyScalar(0.42) }));
      this.back.renderOrder = 0;
      this.scene.add(this.back);
    }
    // the name, set in their own face, between the backdrop and the subject
    await document.fonts.load(`${o.weight} 200px ${o.font}`, o.lines.join(' ')).catch(() => {});
    const cv = document.createElement('canvas'); cv.width = 2048; cv.height = Math.round(2048 * 0.36 * o.lines.length);
    const g = cv.getContext('2d')!;
    const longest = o.lines.reduce((a, l) => (l.length > a.length ? l : a), '');
    let size = 600; g.font = `${o.weight} ${size}px ${o.font}`;
    size *= Math.min(1, (cv.width * 0.96) / g.measureText(longest).width, (cv.height / o.lines.length) / (size * 0.95));
    g.font = `${o.weight} ${size}px ${o.font}`; g.fillStyle = '#e7e4dc'; g.textAlign = 'center'; g.textBaseline = 'middle';
    o.lines.forEach((l, i) => g.fillText(l, cv.width / 2, (cv.height / o.lines.length) * (i + 0.5)));
    const nt = new THREE.CanvasTexture(cv); nt.colorSpace = THREE.NoColorSpace;
    this.name = new THREE.Mesh(new THREE.PlaneGeometry(1, cv.height / cv.width), new THREE.MeshBasicMaterial({ map: nt, transparent: true, depthWrite: false, opacity: 0.94, toneMapped: false }));
    this.name.renderOrder = 2;
    // the name is drawn by the page, in front of the subject, so no photo ever covers it; the plane stays
    // available for a layout that wants the name in depth
    this.name.visible = false;
    this.scene.add(this.name);
    // a glow in their colour behind the subject
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uC: { value: accent }, uA: { value: 0.55 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(uC * smoothstep(1.0, 0.0, r) * uA, 1.0); }',
    }));
    this.glow.renderOrder = 3;
    this.scene.add(this.glow);
    // dust between the layers
    const n = ctx.mobile ? 260 : 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 3; pos[i * 3 + 1] = (Math.random() - 0.5) * 1.6; pos[i * 3 + 2] = -1.6 + Math.random() * 2.1; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uC: { value: accent }, uPx: { value: 1 }, uA: { value: 1 } },
      vertexShader: 'uniform float uT, uPx; varying float vA; void main(){ vec3 p = position; p.y += mod(uT * 0.02 + p.x * 3.1, 1.6) - 0.8; p.x += sin(uT * 0.3 + p.z * 4.0) * 0.03; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * 2.2 / -mv.z; vA = 0.5; }',
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(mix(uC, vec3(1.0), 0.4) * smoothstep(0.5, 0.0, d) * vA * uA, 1.0); }',
    }));
    this.dust.renderOrder = 4;
    this.scene.add(this.dust);
    this.ready = true;
    this.resize(ctx);
  }

  /** Lay the layers out like the page's hero: subject from the bottom edge, head centred, name behind. */
  resize(ctx: Ctx) {
    if (!this.subject) return;
    const asp = ctx.width / ctx.height, phone = ctx.width < 760;
    this.cam.aspect = asp; this.cam.fov = 30; this.cam.updateProjectionMatrix();
    this.viewH = 1.1; this.D = this.viewH / (2 * Math.tan((this.cam.fov * Math.PI) / 360)); this.viewW = this.viewH * asp;
    // size the subject by its measured outline, not the photo frame: the top of the subject stands at a set
    // share of the screen height and its width never covers too much of the screen (close-ups, wide poses)
    const sp = this.subject.geometry.parameters as { width: number };
    const [x0, y0, x1] = this.bbox;
    const k = Math.min(((phone ? 0.64 : 0.84) * this.viewH) / Math.max(0.2, 1 - y0), ((phone ? 2.4 : 0.62) * this.viewW) / Math.max(0.1, sp.width * (x1 - x0)));
    this.subject.scale.set(k, k, k);
    this.subject.position.set(-(this.head - 0.5) * sp.width * k + (phone ? 0 : this.viewW * 0.17), -this.viewH / 2 + 0.5 * k + (phone ? this.viewH * 0.12 : 0), 0);
    // the name sits half a unit behind; scale it so it spans the screen as the page's name did
    const zN = -0.55, kN = (this.D - zN) / this.D;
    // as wide as the page allows, but never taller than 62% of the screen (two-line names)
    const nameAsp = (this.name!.geometry.parameters as { height: number }).height;
    const nameW = Math.min(this.viewW * 0.92, this.viewH * 1.9, (this.viewH * 0.62) / nameAsp) * kN;
    this.name!.scale.set(nameW, nameW, 1);
    this.name!.position.set(0, (phone ? 0.24 : 0.04) * this.viewH * kN, zN);
    const zG = -0.35, kG = (this.D - zG) / this.D;
    this.glow!.scale.set(this.viewH * 0.9 * kG, this.viewH * 0.9 * kG, 1);
    this.glow!.position.set(0, -0.05, zG);
    if (this.back) {
      const zB = -1.8, kB = (this.D - zB) / this.D, bp = this.back.geometry.parameters as { width: number };
      const s = Math.max((this.viewW * 1.25 * kB) / bp.width, this.viewH * 1.25 * kB);
      this.back.scale.set(s, s, 1); this.back.position.set(0, 0, zB);
    }
    (this.dust!.material as THREE.ShaderMaterial).uniforms.uPx.value = ctx.bufW / ctx.width;
  }

  render(ctx: Ctx, dt: number) {
    if (!this.ready || this.alpha <= 0.002) return;
    const t = ctx.time;
    this.pt.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    // camera: pointer orbit, scroll push-in, and a slow drift so the scene is never still
    const s = this.scroll, D = this.D * (1 - 0.32 * s);
    const ox = this.pt.x * 0.16 + Math.sin(t * 0.21) * 0.035, oy = this.pt.y * 0.08 + Math.sin(t * 0.17) * 0.02;
    this.cam.position.set(ox, oy + s * 0.08, D);
    this.cam.lookAt(0, s * 0.1, -0.4);
    // the light circles the subject: the 4D sweep across their shape
    const light = new THREE.Vector3(Math.cos(t * 0.45) * 0.9 - this.pt.x * 0.6, 0.35 + Math.sin(t * 0.3) * 0.25, 0.75);
    for (const m of [this.subject!, this.back].filter(Boolean) as THREE.Mesh[]) {
      const u = (m.material as THREE.ShaderMaterial).uniforms;
      u.uTime.value = t; u.uIntro.value = this.intro; u.uLight.value.copy(light); u.uAlpha.value = this.alpha;
    }
    (this.name!.material as THREE.MeshBasicMaterial).opacity = 0.94 * this.alpha * Math.min(1, this.intro * 1.4) * (1 - s * 0.85);
    (this.glow!.material as THREE.ShaderMaterial).uniforms.uA.value = 0.55 * this.alpha * this.intro;
    const du = (this.dust!.material as THREE.ShaderMaterial).uniforms; du.uT.value = t; du.uA.value = this.alpha;
    const r = ctx.renderer;
    r.autoClear = false; r.clearDepth(); r.render(this.scene, this.cam); r.autoClear = true;
  }

  dispose() {
    this.scene.traverse((o: any) => { o.geometry?.dispose?.(); const m = o.material; if (m) { m.uniforms?.uMap?.value?.dispose?.(); m.uniforms?.uDepth?.value?.dispose?.(); m.map?.dispose?.(); m.dispose?.(); } });
  }
}
