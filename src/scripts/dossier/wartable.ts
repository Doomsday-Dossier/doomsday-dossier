/**
 * Doom's war table (prediction board). A holographic table of the multiverse, cut into ten sectors, one per
 * question, with Doom's citadel at the centre and a radar sweep turning over it. Each answer drops a glowing
 * token with a beam of light into its question's sector (the answer sets how far out it stands); changing an
 * answer slides the token across. Locking in launches every token in an arc to the citadel, which flares and
 * sends a shockwave over the table. Phones: the table has the top of the page and scrolls away with it.
 */
import * as THREE from 'three';
import type { Ctx, HeroScene } from '../gl/engine';
import { C } from './tokens';

const R = 2.6;            // table radius
const PALETTE = [C.emerald, '#7fc8ff', '#ffb648', '#ff6fae'];

const TABLE = /* glsl */ `
  uniform sampler2D uMap; uniform float uT, uSweep, uFlash, uWave, uA;
  varying vec2 vUv;
  void main(){
    vec2 p = (vUv - 0.5) * 2.0; float r = length(p), a = atan(p.y, p.x);
    vec4 tex = texture2D(uMap, vUv);
    vec3 c = vec3(0.02, 0.05, 0.04) + tex.rgb * tex.a; // the canvas is not premultiplied: faint lines must stay faint
    // the radar sweep: a bright edge and a fading tail
    float d = mod(uSweep - a, 6.28318);
    c += vec3(0.12, 0.83, 0.48) * (smoothstep(1.2, 0.0, d) * 0.16 + smoothstep(0.04, 0.0, d) * 0.35) * step(r, 1.0);
    // the shockwave from the citadel after locking in
    c += vec3(0.36, 1.0, 0.66) * smoothstep(0.06, 0.0, abs(r - uWave)) * (1.0 - uWave) * 1.4;
    c += vec3(0.12, 0.83, 0.48) * uFlash * 0.35 * (1.0 - r);
    float edge = smoothstep(1.0, 0.985, r);
    gl_FragColor = vec4(c * edge, edge * uA);
  }`;

/** The table top drawn once: a grid, ten sector lines, rings, and the question numbers at the rim. */
function tableTexture() {
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d')!, c = S / 2;
  g.clearRect(0, 0, S, S);
  g.strokeStyle = 'rgba(31,212,122,0.10)'; g.lineWidth = 1;
  for (let x = 0; x <= S; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(S, x); g.stroke(); }
  g.strokeStyle = 'rgba(31,212,122,0.35)'; g.lineWidth = 2;
  for (const rr of [0.18, 0.4, 0.64, 0.88, 0.995]) { g.beginPath(); g.arc(c, c, rr * c, 0, Math.PI * 2); g.stroke(); }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.beginPath(); g.moveTo(c + Math.cos(a) * c * 0.18, c + Math.sin(a) * c * 0.18); g.lineTo(c + Math.cos(a) * c, c + Math.sin(a) * c); g.stroke();
    const m = a + Math.PI / 10;
    g.fillStyle = 'rgba(231,228,220,0.7)'; g.font = '700 34px "Courier Prime", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.translate(c + Math.cos(m) * c * 0.94, c + Math.sin(m) * c * 0.94); g.rotate(m + Math.PI / 2); g.fillText(String(i + 1).padStart(2, '0'), 0, 0); g.restore();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace;
  return t;
}

type Token = { group: THREE.Group; head: THREE.Mesh; beam: THREE.Mesh; ripple: THREE.Mesh; x: number; z: number; tx: number; tz: number; y: number; vy: number; ripT: number; color: THREE.Color; flight: number; on: boolean };

export class WarTable implements HeroScene {
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  alpha = 1;
  scrollPx = 0;
  private table = new THREE.Group();
  private tableMat: THREE.ShaderMaterial;
  private citadel: THREE.Mesh;
  private tokens: Token[] = [];
  private arcs: THREE.Line[] = [];
  private flash = 0; private wave = 2; private launching = -1;
  private narrow = false; private visH = 1; private offsetX = 0;

  constructor() {
    this.tableMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: TABLE,
      uniforms: { uMap: { value: tableTexture() }, uT: { value: 0 }, uSweep: { value: 0 }, uFlash: { value: 0 }, uWave: { value: 2 }, uA: { value: 1 } },
    });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R * 2), this.tableMat);
    top.rotation.x = -Math.PI / 2;
    this.table.add(top);
    // the rim: a thin glowing band around the table
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.02, 0.12, 96, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.emeraldDeep), transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    rim.position.y = -0.06;
    this.table.add(rim);
    // Doom's citadel at the centre: a hexagonal tower that pulses
    this.citadel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.9, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.emerald), transparent: true, opacity: 0.9 }));
    this.citadel.position.y = 0.45;
    this.table.add(this.citadel);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.emeraldHot) }));
    crown.position.y = 1.07; this.table.add(crown);
    this.scene.add(this.table);
    for (let i = 0; i < 10; i++) this.tokens.push(this.makeToken());
  }

  private makeToken(): Token {
    const color = new THREE.Color(C.emerald);
    const group = new THREE.Group();
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 6), new THREE.MeshBasicMaterial({ color, transparent: true }));
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.06, 1.4, 6, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.y = 0.7;
    const ripple = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ripple.rotation.x = -Math.PI / 2; ripple.position.y = 0.01;
    group.add(head, beam, ripple); group.visible = false;
    this.table.add(group);
    return { group, head, beam, ripple, x: 0, z: 0, tx: 0, tz: 0, y: 3, vy: 0, ripT: 1, color, flight: -1, on: false };
  }

  /** The answers so far: for each question the chosen option's index (or -1) and how many options it has. */
  setPicks(sel: number[], counts: number[]) {
    sel.forEach((j, i) => {
      const tk = this.tokens[i];
      if (j < 0) { tk.on = false; tk.group.visible = false; return; }
      const a = ((i + 0.5) / 10) * Math.PI * 2 - Math.PI / 2, r = R * (0.3 + 0.62 * ((j + 0.5) / Math.max(1, counts[i])));
      tk.tx = Math.cos(a) * r; tk.tz = Math.sin(a) * r;
      tk.color.set(PALETTE[j % PALETTE.length]);
      if (!tk.on) { tk.on = true; tk.group.visible = true; tk.x = tk.tx; tk.z = tk.tz; tk.y = 2.6; tk.vy = 0; tk.ripT = -1; tk.flight = -1; }
    });
  }

  /** Locked in: every token flies to the citadel in turn, then the table answers with a shockwave. */
  lockIn() {
    this.arcs.forEach((l) => { this.table.remove(l); l.geometry.dispose(); });
    this.arcs = [];
    this.tokens.forEach((tk, i) => {
      if (!tk.on) return;
      tk.flight = -i * 0.12;
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 32; s++) { const t = s / 32; pts.push(new THREE.Vector3(tk.x * (1 - t), 0.1 + Math.sin(Math.PI * t) * 1.3 + t * 0.9, tk.z * (1 - t))); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: tk.color, transparent: true, opacity: 0 }));
      line.userData.i = i;
      this.table.add(line); this.arcs.push(line);
    });
    this.launching = 0;
  }

  mount(ctx: Ctx) { this.resize(ctx); }

  resize(ctx: Ctx) {
    const wide = ctx.width >= 900;
    this.narrow = !wide;
    this.cam.aspect = ctx.width / ctx.height;
    this.cam.fov = wide ? 38 : 50;
    this.cam.updateProjectionMatrix();
    this.offsetX = wide ? 3.3 : 0;
    this.visH = 2 * 7 * Math.tan((this.cam.fov * Math.PI) / 360);
  }

  update(ctx: Ctx, dt: number) {
    const t = ctx.time;
    // the camera looks down at the table; phones put it near the top of the page and follow the scroll
    const sy = this.narrow ? this.scrollPx * (this.visH / ctx.height) : 0;
    const lookY = this.narrow ? -1.7 - sy : -0.1;
    this.cam.position.set(-this.offsetX, (this.narrow ? 4.4 : 5.2) - sy, this.narrow ? 5.6 : 6.8);
    this.cam.lookAt(-this.offsetX, lookY, 0);
    this.table.rotation.y = t * 0.05;
    const u = this.tableMat.uniforms;
    u.uT.value = t; u.uSweep.value = (t * 0.9) % (Math.PI * 2); u.uA.value = this.alpha;
    this.flash = Math.max(0, this.flash - dt * 1.5); u.uFlash.value = this.flash;
    if (this.wave < 2) this.wave += dt * 0.9; u.uWave.value = this.wave;
    (this.citadel.material as THREE.MeshBasicMaterial).opacity = (0.65 + 0.25 * Math.sin(t * 2.2) + this.flash * 0.6) * this.alpha;
    this.tokens.forEach((tk, i) => {
      if (!tk.on) return;
      // dropped onto the table with a small bounce; slides when the answer changes
      tk.vy -= 14 * dt; tk.y += tk.vy * dt;
      if (tk.y < 0.07) { if (tk.vy < -1.5 && tk.ripT < 0) tk.ripT = 0; tk.y = 0.07; tk.vy = -tk.vy * 0.28; if (Math.abs(tk.vy) < 0.4) tk.vy = 0; }
      tk.x += (tk.tx - tk.x) * (1 - Math.exp(-dt * 6)); tk.z += (tk.tz - tk.z) * (1 - Math.exp(-dt * 6));
      let x = tk.x, y = tk.y, z = tk.z, show = 1;
      if (tk.flight >= 0 || (this.launching >= 0 && tk.flight > -2)) {
        tk.flight += dt * 0.9;
        const f = Math.min(1, Math.max(0, tk.flight));
        x = tk.x * (1 - f); z = tk.z * (1 - f); y = 0.1 + Math.sin(Math.PI * f) * 1.3 + f * 0.9;
        const line = this.arcs.find((l) => l.userData.i === i);
        if (line) (line.material as THREE.LineBasicMaterial).opacity = Math.sin(Math.PI * Math.min(1, Math.max(0, tk.flight * 0.8))) * 0.9 * this.alpha;
        if (f >= 1) { show = 0; if (tk.flight < 1.05) { this.flash = 1; } }
        if (tk.flight > 1.8) { tk.flight = -2; }
      }
      if (tk.flight <= -2 && this.launching >= 0) show = 0; // landed in the citadel; back when the wave has passed
      tk.group.position.set(x, 0, z); tk.head.position.y = y;
      tk.head.rotation.y += dt * 1.2;
      (tk.head.material as THREE.MeshBasicMaterial).opacity = show * this.alpha;
      (tk.beam.material as THREE.MeshBasicMaterial).opacity = (0.22 + 0.12 * Math.sin(t * 3 + i)) * show * this.alpha * (tk.y < 0.2 ? 1 : 0.3);
      if (tk.ripT >= 0 && tk.ripT < 1) { tk.ripT += dt * 1.6; tk.ripple.scale.setScalar(1 + tk.ripT * 4); (tk.ripple.material as THREE.MeshBasicMaterial).opacity = (1 - tk.ripT) * 0.8 * this.alpha; }
    });
    // after the last token lands in the citadel, the shockwave rolls out and the tokens come back to their places
    if (this.launching >= 0) {
      this.launching += dt;
      const last = Math.max(0, ...this.tokens.map((tk, i) => (tk.on ? i : 0))) * 0.12 + 1.1;
      if (this.launching > last && this.wave >= 2) { this.wave = 0.05; this.flash = 1; }
      if (this.launching > last + 1.4) {
        this.launching = -1;
        this.tokens.forEach((tk) => { if (tk.on) { tk.flight = -1; tk.y = 2.6; tk.vy = 0; tk.ripT = -1; } });
      }
    }
    ctx.renderer.render(this.scene, this.cam);
  }

  dispose() { this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.uniforms?.uMap?.value?.dispose?.(); o.material?.dispose?.(); }); }
}
