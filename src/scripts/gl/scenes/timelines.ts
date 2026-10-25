import * as THREE from 'three';
import { NOISE } from '../glsl';
import { fullscreen, syncCommon, type Ctx, type HeroScene } from '../engine';

const MAX_SEG = 4000;

/**
 * Loki: "Branching Timelines". Timelines grow upward from the bottom of the
 * frame as glowing strands. Every so often a strand forks, and near the cursor
 * (a nexus event) forks happen far more often. Segments are generated on the
 * CPU into a ring buffer and fade by age in the shader. Scrolling prunes:
 * the youngest branches fade first.
 */
export default class Timelines implements HeroScene {
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  bg!: THREE.ShaderMaterial;
  lines!: THREE.LineSegments; mat!: THREE.ShaderMaterial;
  pos!: Float32Array; meta!: Float32Array; posAttr!: THREE.BufferAttribute; metaAttr!: THREE.BufferAttribute;
  head = 0; count = 0;
  tips: { x: number; y: number; a: number; gen: number }[] = [];
  asp = 1; acc = 0;

  mount(ctx: Ctx) {
    const bg = fullscreen(/* glsl */ `
      uniform float uTime; uniform vec2 uRes; uniform float uIntro; uniform float uScroll; varying vec2 vUv;
      ${NOISE}
      void main(){
        float asp = uRes.x/uRes.y; vec2 p = (vUv-0.5)*vec2(asp,1.0);
        vec3 col = mix(vec3(0.01,0.02,0.012), vec3(0.03,0.05,0.03), vUv.y);
        col += vec3(0.08,0.12,0.05) * exp(-length(p - vec2(0.0,-0.6))*2.5) * 0.6;
        col *= smoothstep(0.0,1.0,uIntro*1.3) * (1.0 - uScroll*0.4);
        gl_FragColor = vec4(col,1.0);
      }`);
    this.bg = bg.mat; bg.mesh.renderOrder = -1; this.scene.add(bg.mesh);
    this.pos = new Float32Array(MAX_SEG * 2 * 3);
    this.meta = new Float32Array(MAX_SEG * 2 * 2);   // birth time, generation
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3); this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.metaAttr = new THREE.BufferAttribute(this.meta, 2); this.metaAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr); geo.setAttribute('aMeta', this.metaAttr);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAsp: { value: 1 }, uIntro: { value: 0 }, uPrune: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec2 aMeta; uniform float uTime; uniform float uAsp;
        varying float vAge; varying float vGen;
        void main(){ vAge = uTime - aMeta.x; vGen = aMeta.y; gl_Position = vec4(position.x/uAsp, position.y, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying float vAge; varying float vGen; uniform float uIntro; uniform float uPrune;
        void main(){
          float grow = smoothstep(0.0, 0.25, vAge);
          float fade = exp(-vAge*0.06);
          float pruned = 1.0 - smoothstep(0.0, 0.1, uPrune - (1.0 - min(vGen/8.0, 1.0)));
          vec3 green = vec3(0.37,0.83,0.44), gold = vec3(0.91,0.76,0.35);
          vec3 c = mix(green, gold, step(0.5, fract(vGen*0.5)) * 0.35);
          c += vec3(0.9,1.0,0.8) * exp(-vAge*6.0);              // the growing tip burns bright
          gl_FragColor = vec4(c * grow * fade * (0.9 + 0.6/(1.0+vGen*0.3)) * pruned * uIntro, 1.0);
        }`,
    });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
    this.resize(ctx);
  }

  resize(ctx: Ctx) {
    this.asp = ctx.width / ctx.height;
    // a fresh "sacred timeline" at the bottom centre, plus a few others
    this.tips = [{ x: 0, y: -1.05, a: Math.PI / 2, gen: 0 }, { x: -this.asp * 0.5, y: -1.05, a: Math.PI / 2 + 0.1, gen: 1 }, { x: this.asp * 0.5, y: -1.05, a: Math.PI / 2 - 0.1, gen: 1 }];
  }

  private seg(x0: number, y0: number, x1: number, y1: number, t: number, gen: number) {
    const k = this.head; this.head = (this.head + 1) % MAX_SEG; this.count = Math.min(MAX_SEG, this.count + 1);
    this.pos.set([x0, y0, 0, x1, y1, 0], k * 6);
    this.meta.set([t, gen, t, gen], k * 4);
  }

  update(ctx: Ctx, dt: number) {
    syncCommon(this.bg, ctx);
    const t = ctx.time;
    const mx = (ctx.pointer.x * 2 - 1) * this.asp, my = ctx.pointer.y * 2 - 1;
    this.acc += dt;
    const step = 0.03;
    while (this.acc > 1 / 60) {
      this.acc -= 1 / 60;
      const next: typeof this.tips = [];
      for (const tip of this.tips) {
        tip.a += (Math.random() - 0.5) * 0.25 + (Math.PI / 2 - tip.a) * 0.04;     // wander, but keep heading up
        const nx = tip.x + Math.cos(tip.a) * step, ny = tip.y + Math.sin(tip.a) * step;
        this.seg(tip.x, tip.y, nx, ny, t, tip.gen);
        tip.x = nx; tip.y = ny;
        if (ny > 1.1 || Math.abs(nx) > this.asp * 1.1) continue;                // left the frame
        const near = Math.exp(-((nx - mx) ** 2 + (ny - my) ** 2) * 6);
        const pBranch = 0.006 + near * 0.12;
        if (Math.random() < pBranch && this.tips.length + next.length < 90) {
          const spread = 0.5 + Math.random() * 0.4;
          next.push({ x: nx, y: ny, a: tip.a + spread, gen: tip.gen + 1 });
          tip.a -= spread * 0.5;
        }
        next.push(tip);
      }
      this.tips = next;
      if (this.tips.length < 2) this.resize(ctx);
    }
    ctx.signal = this.tips.length;
    this.posAttr.needsUpdate = true; this.metaAttr.needsUpdate = true;
    this.lines.geometry.setDrawRange(0, this.count * 2);
    const u = this.mat.uniforms;
    u.uTime.value = t; u.uAsp.value = this.asp; u.uIntro.value = ctx.intro; u.uPrune.value = ctx.scroll * 1.2;
    ctx.renderer.render(this.scene, this.cam);
  }

  dispose() { this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
}
