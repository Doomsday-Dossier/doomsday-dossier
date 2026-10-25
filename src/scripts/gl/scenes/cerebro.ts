import * as THREE from 'three';
import { NOISE } from '../glsl';
import { fullscreen, syncCommon, type Ctx, type HeroScene } from '../engine';

const MAX_LINKS = 420;

/**
 * Professor X: "Cerebro". A slowly turning 3D sphere of points, one for each
 * mind. Where the cursor focuses, nearby minds light up and link into a live
 * network, recomputed every frame. A scanning pulse sweeps the sphere like a
 * search in progress; scrolling pulls the camera back into the dark.
 */
export default class Cerebro implements HeroScene {
  scene = new THREE.Scene();
  cam!: THREE.PerspectiveCamera;
  bg!: THREE.ShaderMaterial;
  pts!: THREE.Points; pmat!: THREE.ShaderMaterial;
  links!: THREE.LineSegments; linkPos!: THREE.BufferAttribute; linkCol!: THREE.BufferAttribute;
  base!: Float32Array; n = 0;
  rot = new THREE.Matrix4(); tmp = new THREE.Vector3(); proj = new THREE.Vector3();
  focusAttr!: THREE.BufferAttribute;
  bgScene = new THREE.Scene(); tilt = new THREE.Matrix4().makeRotationX(0.25);

  mount(ctx: Ctx) {
    const bg = fullscreen(/* glsl */ `
      uniform float uTime; uniform vec2 uRes; uniform float uIntro; uniform float uScroll; varying vec2 vUv;
      ${NOISE}
      void main(){
        vec2 p = (vUv-0.5)*vec2(uRes.x/uRes.y,1.0);
        float r = length(p);
        vec3 col = mix(vec3(0.03,0.06,0.13), vec3(0.005,0.01,0.03), smoothstep(0.0, 0.9, r));
        float ribs = smoothstep(0.985, 1.0, cos(atan(p.y,p.x)*24.0)) * smoothstep(0.3, 0.9, r) * 0.06;
        col += vec3(0.4,0.6,1.0) * ribs;
        col += vec3(0.05,0.08,0.16) * fbm3(p*2.0 + uTime*0.03);
        col *= smoothstep(0.0,1.0,uIntro*1.3) * (1.0 - uScroll*0.5);
        gl_FragColor = vec4(col,1.0);
      }`);
    this.bg = bg.mat; bg.mesh.renderOrder = -1;
    this.bgScene.add(bg.mesh);
    this.cam = new THREE.PerspectiveCamera(42, ctx.width / ctx.height, 0.1, 50);
    this.cam.position.set(0, 0, 4.2);
    this.build(ctx);
  }

  build(ctx: Ctx) {
    this.n = Math.round((ctx.mobile ? 900 : 1800) * ctx.quality);
    const n = this.n;
    this.base = new Float32Array(n * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
      const shell = 1 + (Math.random() - 0.5) * 0.06;
      this.base[i * 3] = Math.cos(th) * r * shell; this.base[i * 3 + 1] = y * shell; this.base[i * 3 + 2] = Math.sin(th) * r * shell;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.base, 3));
    this.focusAttr = new THREE.BufferAttribute(new Float32Array(n), 1); this.focusAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aFocus', this.focusAttr);
    this.pmat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uRot: { value: new THREE.Matrix4() }, uTime: { value: 0 }, uPx: { value: 1 }, uIntro: { value: 0 }, uScan: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aFocus; uniform mat4 uRot; uniform float uTime, uPx, uIntro, uScan;
        varying float vA; varying float vF;
        void main(){
          vec4 w = uRot * vec4(position * (0.6 + 0.4*uIntro), 1.0);
          vec4 mv = modelViewMatrix * w;
          gl_Position = projectionMatrix * mv;
          float depth = smoothstep(-2.0, 1.2, w.z);
          float scan = smoothstep(0.08, 0.0, abs(w.y - uScan));
          gl_PointSize = uPx * (1.5 + depth*2.0 + aFocus*4.0 + scan*2.0) * (4.2 / -mv.z);
          vA = (0.15 + depth*0.55 + aFocus + scan*0.8) * uIntro;
          vF = aFocus;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying float vF;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d)*vA;
          gl_FragColor = vec4(mix(vec3(0.35,0.6,1.0), vec3(0.95,0.98,1.0), clamp(vF,0.0,1.0))*a, 1.0); }`,
    });
    this.pts = new THREE.Points(geo, this.pmat);
    this.pts.frustumCulled = false;
    this.scene.add(this.pts);
    const lg = new THREE.BufferGeometry();
    this.linkPos = new THREE.BufferAttribute(new Float32Array(MAX_LINKS * 2 * 3), 3); this.linkPos.setUsage(THREE.DynamicDrawUsage);
    this.linkCol = new THREE.BufferAttribute(new Float32Array(MAX_LINKS * 2 * 3), 3); this.linkCol.setUsage(THREE.DynamicDrawUsage);
    lg.setAttribute('position', this.linkPos); lg.setAttribute('color', this.linkCol);
    lg.setDrawRange(0, 0);
    this.links = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.links.frustumCulled = false;
    this.scene.add(this.links);
  }

  resize(ctx: Ctx) { if (this.cam) { this.cam.aspect = ctx.width / ctx.height; this.cam.updateProjectionMatrix(); } }
  setQuality(ctx: Ctx) {
    this.scene.remove(this.pts, this.links); this.pts.geometry.dispose(); this.pmat.dispose(); this.links.geometry.dispose(); (this.links.material as THREE.Material).dispose();
    this.build(ctx);
  }

  update(ctx: Ctx, _dt: number) {
    syncCommon(this.bg, ctx);
    const t = ctx.time;
    this.cam.position.z = 4.2 + ctx.scroll * 3;
    this.cam.position.x = (ctx.pointer.x - 0.5) * 0.4; this.cam.position.y = (ctx.pointer.y - 0.5) * 0.3;
    this.cam.lookAt(0, 0, 0);
    this.cam.updateMatrixWorld();
    this.rot.makeRotationY(t * 0.08).multiply(this.tilt);
    const scan = ((t * 0.35) % 2.6) - 1.3;
    // which minds sit near the cursor on screen
    const mx = ctx.pointer.x * 2 - 1, my = ctx.pointer.y * 2 - 1;
    const focus = this.focusAttr.array as Float32Array;
    const near: number[] = [];
    const sp: number[] = [];
    const s = 0.6 + 0.4 * ctx.intro;
    for (let i = 0; i < this.n; i++) {
      this.tmp.set(this.base[i * 3] * s, this.base[i * 3 + 1] * s, this.base[i * 3 + 2] * s).applyMatrix4(this.rot);
      const wz = this.tmp.z;
      this.proj.copy(this.tmp).project(this.cam);
      const dx = (this.proj.x - mx) * (ctx.width / ctx.height), dy = this.proj.y - my;
      const d = Math.hypot(dx, dy);
      const f = wz > -0.2 ? Math.max(0, 1 - d / 0.45) : 0;
      focus[i] += (f - focus[i]) * 0.15;
      if (f > 0.05 && near.length < 90) { near.push(i); sp.push(this.tmp.x, this.tmp.y, this.tmp.z); }
    }
    this.focusAttr.needsUpdate = true;
    // link nearby minds into a network
    const lp = this.linkPos.array as Float32Array, lc = this.linkCol.array as Float32Array;
    let k = 0;
    for (let a = 0; a < near.length && k < MAX_LINKS; a++) for (let b = a + 1; b < near.length && k < MAX_LINKS; b++) {
      const ax = sp[a * 3], ay = sp[a * 3 + 1], az = sp[a * 3 + 2], bx = sp[b * 3], by = sp[b * 3 + 1], bz = sp[b * 3 + 2];
      const d = Math.hypot(ax - bx, ay - by, az - bz);
      if (d < 0.32) {
        const w = (1 - d / 0.32) * Math.min(focus[near[a]], focus[near[b]]) * ctx.intro;
        lp.set([ax, ay, az, bx, by, bz], k * 6);
        lc.set([0.5 * w, 0.75 * w, 1.0 * w, 0.5 * w, 0.75 * w, 1.0 * w], k * 6);
        k++;
      }
    }
    this.links.geometry.setDrawRange(0, k * 2);
    this.linkPos.needsUpdate = true; this.linkCol.needsUpdate = true;
    const u = this.pmat.uniforms;
    u.uRot.value.copy(this.rot); u.uTime.value = t; u.uPx.value = ctx.bufW / ctx.width; u.uIntro.value = ctx.intro; u.uScan.value = scan;
    const r = ctx.renderer;
    r.autoClear = false; r.clear();
    r.render(this.bgScene, this.cam);
    r.render(this.scene, this.cam);
    r.autoClear = true;
  }

  dispose() {
    this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    this.bg.dispose();
  }
}
