import * as THREE from 'three';
import { NOISE } from '../glsl';
import { fullscreen, syncCommon, type Ctx, type HeroScene } from '../engine';

/**
 * Reed Richards: "Elastic Lattice". A blueprint grid simulated as a spring mesh
 * on the CPU. The cursor drags the fabric with its velocity, so the lattice
 * stretches, bulges and snaps back. Scrolling pulls the whole sheet long.
 */
export default class Elastic implements HeroScene {
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  bg!: THREE.ShaderMaterial;
  lines!: THREE.LineSegments; lmat!: THREE.ShaderMaterial;
  cols = 0; rows = 0;
  rest!: Float32Array; pos!: Float32Array; vel!: Float32Array; stretch!: Float32Array;
  posAttr!: THREE.BufferAttribute; strAttr!: THREE.BufferAttribute;
  asp = 1;

  mount(ctx: Ctx) {
    const bg = fullscreen(/* glsl */ `
      uniform float uTime; uniform vec2 uRes; uniform float uIntro; uniform float uScroll; varying vec2 vUv;
      ${NOISE}
      void main(){
        vec2 p = vUv*uRes/80.0;
        vec2 g = abs(fract(p)-0.5);
        float fine = smoothstep(0.49, 0.5, max(g.x, g.y)) * 0.05;
        vec3 col = mix(vec3(0.015,0.025,0.06), vec3(0.03,0.06,0.13), vUv.y);
        col += vec3(0.25,0.5,1.0) * fine;
        col += vec3(0.02,0.04,0.08) * fbm3(vUv*3.0 + uTime*0.02);
        col *= smoothstep(0.0, 1.0, uIntro*1.4) * (1.0 - uScroll*0.5);
        gl_FragColor = vec4(col, 1.0);
      }`);
    this.bg = bg.mat; bg.mesh.renderOrder = -1; this.scene.add(bg.mesh);
    this.build(ctx);
  }

  build(ctx: Ctx) {
    this.asp = ctx.width / ctx.height;
    const spacing = (ctx.mobile ? 0.11 : 0.075) / Math.max(ctx.quality, 0.6);
    this.cols = Math.ceil((this.asp * 2.3) / spacing) + 1;
    this.rows = Math.ceil(2.3 / spacing) + 1;
    const n = this.cols * this.rows;
    this.rest = new Float32Array(n * 2); this.pos = new Float32Array(n * 2); this.vel = new Float32Array(n * 2); this.stretch = new Float32Array(n);
    for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) {
      const k = j * this.cols + i;
      this.rest[k * 2] = -this.asp * 1.15 + i * spacing;
      this.rest[k * 2 + 1] = -1.15 + j * spacing;
    }
    this.pos.set(this.rest);
    const idx: number[] = [];
    for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) {
      const k = j * this.cols + i;
      if (i < this.cols - 1) idx.push(k, k + 1);
      if (j < this.rows - 1) idx.push(k, k + this.cols);
    }
    const p3 = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(p3, 3); this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.strAttr = new THREE.BufferAttribute(this.stretch, 1); this.strAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aStretch', this.strAttr);
    geo.setIndex(idx);
    this.lmat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uAsp: { value: this.asp }, uIntro: { value: 0 } },
      vertexShader: `attribute float aStretch; uniform float uAsp; varying float vS;
        void main(){ vS = aStretch; gl_Position = vec4(position.x/uAsp, position.y, 0.0, 1.0); }`,
      fragmentShader: `varying float vS; uniform float uIntro;
        void main(){ vec3 c = mix(vec3(0.18,0.42,0.9), vec3(0.85,0.95,1.0), clamp(vS*6.0,0.0,1.0)); gl_FragColor = vec4(c*(0.28+clamp(vS*8.0,0.0,1.4))*uIntro, 1.0); }`,
    });
    this.lines = new THREE.LineSegments(geo, this.lmat);
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
  }

  resize(ctx: Ctx) {
    if (!this.lines) return;
    if (Math.abs(ctx.width / ctx.height - this.asp) > 0.02) { this.teardown(); this.build(ctx); }
  }
  setQuality(ctx: Ctx) { this.teardown(); this.build(ctx); }
  private teardown() { this.scene.remove(this.lines); this.lines.geometry.dispose(); this.lmat.dispose(); }

  update(ctx: Ctx, dt: number) {
    syncCommon(this.bg, ctx);
    const { cols, rows, rest, pos, vel, stretch } = this;
    const asp = this.asp;
    const mx = (ctx.pointer.x * 2 - 1) * asp, my = ctx.pointer.y * 2 - 1;
    const pvx = ctx.pointer.vx * 2 * asp, pvy = ctx.pointer.vy * 2;
    const R = 0.42, R2 = R * R;
    const sy = 1 + ctx.scroll * 0.9; // scroll stretches the sheet vertically
    const t = ctx.time;
    const steps = 2, h = Math.min(dt, 1 / 30) / steps;
    for (let s = 0; s < steps; s++) {
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const k = j * cols + i, kx = k * 2, ky = kx + 1;
        const rx = rest[kx], ry = rest[ky] * sy + Math.sin(rest[kx] * 2.0 + t * 0.6) * 0.012;
        let fx = (rx - pos[kx]) * 28, fy = (ry - pos[ky]) * 28;
        // neighbour coupling makes the sheet behave like one fabric
        let ax = 0, ay = 0, c = 0;
        if (i > 0) { ax += pos[kx - 2]; ay += pos[ky - 2]; c++; }
        if (i < cols - 1) { ax += pos[kx + 2]; ay += pos[ky + 2]; c++; }
        if (j > 0) { ax += pos[kx - cols * 2]; ay += pos[ky - cols * 2]; c++; }
        if (j < rows - 1) { ax += pos[kx + cols * 2]; ay += pos[ky + cols * 2]; c++; }
        if (c) { fx += (ax / c - pos[kx]) * 40; fy += (ay / c - pos[ky]) * 40; }
        const dx = pos[kx] - mx, dy = pos[ky] - my, d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const w = 1 - d2 / R2;
          fx += pvx * w * w * 60; fy += pvy * w * w * 60;     // drag with the cursor
          fx -= dx * w * 6; fy -= dy * w * 6;                 // slight pull toward it
        }
        vel[kx] = (vel[kx] + fx * h) * 0.94; vel[ky] = (vel[ky] + fy * h) * 0.94;
      }
      for (let k = 0; k < cols * rows * 2; k++) pos[k] += vel[k] * h;
    }
    const p3 = this.posAttr.array as Float32Array;
    for (let k = 0; k < cols * rows; k++) {
      p3[k * 3] = pos[k * 2]; p3[k * 3 + 1] = pos[k * 2 + 1];
      const ex = pos[k * 2] - rest[k * 2], ey = pos[k * 2 + 1] - rest[k * 2 + 1] * sy;
      stretch[k] = Math.sqrt(ex * ex + ey * ey);
    }
    this.posAttr.needsUpdate = true; this.strAttr.needsUpdate = true;
    this.lmat.uniforms.uIntro.value = ctx.intro;
    ctx.renderer.render(this.scene, this.cam);
  }

  dispose() { this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
}
