import * as THREE from 'three';
import { NOISE } from '../glsl';
import { fullscreen, syncCommon, type Ctx, type HeroScene } from '../engine';

/**
 * M'Baku: "Jabari Ridge". Stacked mountain ridgelines drawn from the back to
 * the front: each ridge is a filled strip in the background colour with a
 * snow-white stroke on top, so nearer ridges hide farther ones (painter's
 * hidden-line removal). A drumbeat rolls from the front ridge to the back; the
 * cursor is the drummer: it sets where the peaks rise and a press hits the drum.
 */
export default class Ridges implements HeroScene {
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  bg!: THREE.ShaderMaterial;
  fillMat!: THREE.ShaderMaterial; lineMat!: THREE.ShaderMaterial;
  group = new THREE.Group();
  beats: number[] = []; beatT = 0.4; wasDown = false;

  mount(ctx: Ctx) {
    const bg = fullscreen(/* glsl */ `
      uniform float uTime; uniform vec2 uRes; uniform float uIntro; uniform float uScroll; varying vec2 vUv;
      ${NOISE}
      void main(){
        vec3 col = mix(vec3(0.03,0.028,0.026), vec3(0.08,0.075,0.07), vUv.y);
        col += vec3(0.25,0.24,0.22) * pow(max(0.0, snoise(vUv*vec2(60.0,90.0) + vec2(0.0, -uTime*0.6))), 18.0) * 0.6;   // falling snow
        col *= smoothstep(0.0,1.0,uIntro*1.3) * (1.0 - uScroll*0.4);
        gl_FragColor = vec4(col,1.0);
      }`);
    this.bg = bg.mat; bg.mesh.renderOrder = -1; this.scene.add(bg.mesh);
    this.build(ctx);
    this.scene.add(this.group);
  }

  build(ctx: Ctx) {
    const rowsN = Math.round((ctx.mobile ? 22 : 34) * Math.max(ctx.quality, 0.6));
    const pts = ctx.mobile ? 90 : 160;
    const common = /* glsl */ `
      attribute float aX; attribute float aRow; attribute float aTop;
      uniform float uTime; uniform float uMx; uniform float uAsp; uniform float uRows; uniform float uIntro; uniform float uScroll;
      uniform float uBeats[6];
      varying float vRow;
      ${NOISE}
      float ridge(float x, float row){
        float depth = row / uRows;                         // 0 = back, 1 = front
        float base = mix(0.55, -0.85, depth);
        float n = fbm3(vec2(x*1.4 + row*3.17, row*0.37)) * 0.22 * (0.6 + depth);
        float peak = exp(-pow((x - uMx)*1.6, 2.0)) * 0.25 * (1.0 - depth*0.4);
        float pulse = 0.0;
        for (int i = 0; i < 6; i++) {
          float age = uTime - uBeats[i];
          float front = age * 1.4;                        // the beat rolls from front to back
          pulse += exp(-pow(((1.0 - depth) - front)*6.0, 2.0)) * exp(-age*1.2) * step(0.0, age);
        }
        return base + n + peak + pulse * 0.12 * exp(-pow((x - uMx)*0.9, 2.0)) - uScroll*0.6*depth;
      }
    `;
    this.fillMat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, side: THREE.DoubleSide,   // strip winding is clockwise
      uniforms: this.uniformsObj(rowsN, ctx),
      vertexShader: common + /* glsl */ `
        void main(){
          float y = ridge(aX, aRow);
          float yy = aTop > 0.5 ? y : -1.2;
          vRow = aRow;
          gl_Position = vec4(aX / uAsp, mix(-1.2, yy, uIntro), 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vRow; uniform float uRows;
        void main(){ float d = vRow/uRows; gl_FragColor = vec4(mix(vec3(0.05,0.047,0.044), vec3(0.09,0.06,0.045), d), 1.0); }`,
    });
    this.lineMat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, transparent: false,   // must share the opaque pass so renderOrder interleaves fills and lines
      uniforms: this.fillMat.uniforms,
      vertexShader: common + /* glsl */ `
        void main(){
          float y = ridge(aX, aRow);
          vRow = aRow;
          gl_Position = vec4(aX / uAsp, mix(-1.2, y, uIntro), 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vRow; uniform float uRows;
        void main(){ float d = vRow/uRows; vec3 snow = vec3(0.93,0.95,0.97); vec3 earth = vec3(0.8,0.55,0.38);
          gl_FragColor = vec4(mix(snow*0.55, mix(snow, earth, 0.25), d), 1.0); }`,
    });
    const asp = ctx.width / ctx.height;
    for (let r = 0; r < rowsN; r++) {
      // fill strip: pairs of (top, bottom) vertices
      const fx = new Float32Array(pts * 2), frow = new Float32Array(pts * 2), ftop = new Float32Array(pts * 2);
      const lx = new Float32Array(pts), lrow = new Float32Array(pts), ltop = new Float32Array(pts);
      for (let i = 0; i < pts; i++) {
        const x = -asp * 1.05 + (i / (pts - 1)) * asp * 2.1;
        fx[i * 2] = x; fx[i * 2 + 1] = x; frow[i * 2] = r; frow[i * 2 + 1] = r; ftop[i * 2] = 1; ftop[i * 2 + 1] = 0;
        lx[i] = x; lrow[i] = r; ltop[i] = 1;
      }
      const idx: number[] = [];
      for (let i = 0; i < pts - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts * 2 * 3), 3));
      fg.setAttribute('aX', new THREE.BufferAttribute(fx, 1)); fg.setAttribute('aRow', new THREE.BufferAttribute(frow, 1)); fg.setAttribute('aTop', new THREE.BufferAttribute(ftop, 1));
      fg.setIndex(idx);
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts * 3), 3));
      lg.setAttribute('aX', new THREE.BufferAttribute(lx, 1)); lg.setAttribute('aRow', new THREE.BufferAttribute(lrow, 1)); lg.setAttribute('aTop', new THREE.BufferAttribute(ltop, 1));
      const fill = new THREE.Mesh(fg, this.fillMat); fill.frustumCulled = false; fill.renderOrder = r * 2;
      const line = new THREE.Line(lg, this.lineMat); line.frustumCulled = false; line.renderOrder = r * 2 + 1;
      this.group.add(fill, line);
    }
  }

  private uniformsObj(rows: number, ctx: Ctx) {
    return { uTime: { value: 0 }, uMx: { value: 0 }, uAsp: { value: ctx.width / ctx.height }, uRows: { value: rows }, uIntro: { value: 0 }, uScroll: { value: 0 }, uBeats: { value: [-99, -99, -99, -99, -99, -99] } };
  }

  resize(ctx: Ctx) {
    if (!this.fillMat) return;
    this.group.traverse((o: any) => o.geometry?.dispose?.()); this.group.clear(); this.fillMat.dispose(); this.lineMat.dispose();
    this.build(ctx);
  }
  setQuality(ctx: Ctx) { this.resize(ctx); }

  update(ctx: Ctx, dt: number) {
    syncCommon(this.bg, ctx);
    const t = ctx.time;
    this.beatT -= dt;
    const tapped = ctx.pointer.down && !this.wasDown; this.wasDown = ctx.pointer.down;
    if (this.beatT <= 0 || tapped) { this.beats.push(t); if (this.beats.length > 6) this.beats.shift(); this.beatT = 1.2; ctx.signal = 1; }
    else ctx.signal *= Math.exp(-dt * 8);
    const u = this.fillMat.uniforms;
    u.uTime.value = t; u.uMx.value = (ctx.pointer.x * 2 - 1) * (ctx.width / ctx.height); u.uAsp.value = ctx.width / ctx.height;
    u.uIntro.value = ctx.intro; u.uScroll.value = ctx.scroll;
    const arr = u.uBeats.value as number[];
    for (let i = 0; i < 6; i++) arr[i] = this.beats[i] ?? -99;
    ctx.renderer.render(this.scene, this.cam);
  }

  dispose() { this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
}
