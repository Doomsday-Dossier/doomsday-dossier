/**
 * The prediction tree (Anchor AI): a tree of particles over a disc of ground particles. It has one
 * branch per question; answering a question grows its branch out to a leafy crown and lights it in the
 * file colour of the answer's question; locking in sends rings of light out across the ground.
 */
import * as THREE from 'three';
import type { Ctx, HeroScene } from '../gl/engine';
import { C, rgb } from './tokens';

const NB = 10;

export class TreeScene implements HeroScene {
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  mat!: THREE.ShaderMaterial;
  ground!: THREE.ShaderMaterial;
  points!: THREE.Points;
  grow = new Float32Array(NB).fill(0.22);
  growTo = new Float32Array(NB).fill(0.22);
  lit = new Float32Array(NB);
  ripple = 99;
  alpha = 1;
  offsetX = 0;

  mount(ctx: Ctx) {
    const n = Math.round((ctx.mobile ? 9000 : 26000) * ctx.quality);
    const pos: number[] = [], br: number[] = [], tt: number[] = [], seed: number[] = [];
    const rnd = (a = 1) => (Math.random() * 2 - 1) * a;
    // trunk: a slightly twisting column from the ground to the fork
    const trunkN = Math.round(n * 0.12);
    for (let i = 0; i < trunkN; i++) {
      const t = Math.random(), r = 0.16 * (1 - t * 0.55) * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
      pos.push(Math.cos(a) * r + Math.sin(t * 5) * 0.04, -1.7 + t * 1.5, Math.sin(a) * r); br.push(-1); tt.push(t); seed.push(Math.random());
    }
    // ten branches fanning up from the fork, each with twigs and a crown at the tip
    const per = Math.floor((n - trunkN) / NB);
    for (let b = 0; b < NB; b++) {
      const ang = -1.15 + (b / (NB - 1)) * 2.3 + rnd(0.05), len = 1.05 + Math.random() * 0.45, lean = rnd(0.5);
      const tip = new THREE.Vector3(Math.sin(ang) * len, -0.2 + Math.cos(ang) * len * 0.95 + 0.25, lean * 0.6);
      const ctrl = new THREE.Vector3(Math.sin(ang) * len * 0.35, 0.35, lean * 0.2);
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.2, 0), ctrl, tip);
      for (let i = 0; i < per; i++) {
        const crown = Math.random() < 0.45;
        let t: number, p: THREE.Vector3;
        if (crown) {
          // the crown: a soft cloud around the tip
          t = 0.85 + Math.random() * 0.15;
          const r = 0.34 * Math.cbrt(Math.random()), a = Math.random() * Math.PI * 2, e = Math.acos(rnd());
          p = tip.clone().add(new THREE.Vector3(Math.sin(e) * Math.cos(a) * r, Math.cos(e) * r * 0.7 + 0.05, Math.sin(e) * Math.sin(a) * r));
        } else {
          t = Math.random();
          p = curve.getPoint(t);
          const thick = 0.07 * (1 - t * 0.7);
          p.add(new THREE.Vector3(rnd(thick), rnd(thick), rnd(thick)));
          // twigs splitting off along the way
          if (Math.random() < 0.3) { const s = Math.random() * 0.25; p.add(new THREE.Vector3(Math.sin(ang + rnd(1.2)) * s, s * 0.8, rnd(s))); }
        }
        pos.push(p.x, p.y, p.z); br.push(b); tt.push(t); seed.push(Math.random());
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aB', new THREE.Float32BufferAttribute(br, 1));
    geo.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    const em = rgb(C.emeraldHot), bone = rgb(C.bone);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uGrow: { value: this.grow }, uLit: { value: this.lit }, uTime: { value: 0 }, uPx: { value: 1 }, uAlpha: { value: 1 }, uRipple: { value: 99 }, uEm: { value: new THREE.Vector3(...em) }, uBone: { value: new THREE.Vector3(...bone) } },
      vertexShader: /* glsl */ `
        uniform float uGrow[${NB}]; uniform float uLit[${NB}]; uniform float uTime, uPx, uRipple;
        attribute float aB, aT, aSeed; varying float vA; varying float vLit; varying float vT;
        void main(){
          int b = int(aB + 0.5);
          float g = 1.0, l = 0.0;
          for (int i = 0; i < ${NB}; i++) { if (i == b) { g = uGrow[i]; l = uLit[i]; } }
          if (aB < -0.5) { g = 1.0; l = 0.4; }
          float shown = smoothstep(g, g - 0.05, aT);
          vec3 p = position;
          p += vec3(sin(uTime*0.9 + aSeed*30.0), cos(uTime*0.7 + aSeed*21.0), sin(uTime*0.8 + aSeed*12.0)) * 0.012 * (0.4 + aT);
          // the lock-in pulse runs up the tree
          float pulse = exp(-pow((aT + 1.0) * 1.2 - uRipple * 2.2, 2.0) * 8.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * (1.1 + aSeed * 1.6 + pulse * 2.0) * (5.0 / -mv.z);
          vA = shown * (0.25 + 0.75 * (0.35 + l * 0.65)) + pulse * shown;
          vLit = l; vT = aT;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAlpha; uniform vec3 uEm, uBone; varying float vA; varying float vLit; varying float vT;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA * uAlpha;
          vec3 c = mix(uEm * 0.55, mix(uEm, uBone, 0.35 * vT), vLit);
          gl_FragColor = vec4(c * a, 1.0);
        }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    // the ground: a disc of points carrying ripples
    const gn = ctx.mobile ? 2600 : 7000, gp: number[] = [];
    for (let i = 0; i < gn; i++) { const r = Math.sqrt(Math.random()) * 3.2, a = Math.random() * Math.PI * 2; gp.push(Math.cos(a) * r, -1.72, Math.sin(a) * r); }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    this.ground = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uAlpha: { value: 1 }, uRipple: { value: 99 }, uEm: { value: new THREE.Vector3(...em) } },
      vertexShader: /* glsl */ `
        uniform float uTime, uPx, uRipple; varying float vA;
        void main(){
          vec3 p = position; float r = length(p.xz);
          float idle = 0.5 + 0.5 * sin(r * 7.0 - uTime * 1.6);
          float wave = exp(-pow(r - uRipple * 2.6, 2.0) * 6.0) * smoothstep(2.0, 0.0, uRipple);
          p.y += wave * 0.08;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * (1.0 + wave * 3.0) * (5.0 / -mv.z);
          vA = (0.12 + idle * 0.22 + wave * 1.6) * smoothstep(3.2, 1.2, r);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAlpha; uniform vec3 uEm; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uEm * smoothstep(0.5, 0.0, d) * vA * uAlpha, 1.0); }`,
    });
    const ground = new THREE.Points(gg, this.ground);
    ground.frustumCulled = false;
    this.scene.add(ground);
    this.resize(ctx);
  }
  resize(ctx: Ctx) {
    this.cam.aspect = ctx.width / ctx.height;
    const wide = ctx.width >= 900;
    this.cam.fov = wide ? 40 : 54;
    this.offsetX = wide ? 1.25 : 0;
    this.cam.position.set(-this.offsetX, wide ? 0.1 : 0.5, wide ? 6.6 : 5.6);
    this.cam.lookAt(-this.offsetX, wide ? -0.05 : 0.1, 0);
    this.cam.updateProjectionMatrix();
  }
  /** answered questions: their branches grow to full and light up */
  setPicks(answered: boolean[]) { answered.forEach((a, i) => { this.growTo[i] = a ? 1 : 0.22; }); }
  lockIn() { this.ripple = 0; }
  update(ctx: Ctx, dt: number) {
    for (let i = 0; i < NB; i++) {
      this.grow[i] += (this.growTo[i] - this.grow[i]) * (1 - Math.exp(-dt * 2.4));
      this.lit[i] += ((this.growTo[i] > 0.5 ? 1 : 0) - this.lit[i]) * (1 - Math.exp(-dt * 3));
    }
    this.ripple += dt;
    this.points.rotation.y += dt * 0.06;
    const u = this.mat.uniforms, g = this.ground.uniforms;
    u.uTime.value = g.uTime.value = ctx.time;
    u.uPx.value = g.uPx.value = ctx.bufW / ctx.width;
    u.uAlpha.value = g.uAlpha.value = this.alpha;
    u.uRipple.value = g.uRipple.value = this.ripple;
    ctx.renderer.render(this.scene, this.cam);
  }
  dispose() { this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
}
