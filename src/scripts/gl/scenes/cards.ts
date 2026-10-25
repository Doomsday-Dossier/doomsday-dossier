import * as THREE from 'three';
import { NOISE } from '../glsl';
import { fullscreen, syncCommon, type Ctx, type HeroScene } from '../engine';

const BURST = 48;

/**
 * Gambit: "Charged Deck". A slow 3D swirl of playing cards, each one an
 * instanced quad with a procedural face and back. Cards that drift near the
 * cursor build up a pink kinetic charge until they detonate into sparks and
 * rejoin the deck. A click or tap charges the nearest card at once.
 */
export default class Cards implements HeroScene {
  scene = new THREE.Scene();
  cam!: THREE.PerspectiveCamera;
  bgScene = new THREE.Scene(); bg!: THREE.ShaderMaterial;
  mesh!: THREE.Mesh; mat!: THREE.ShaderMaterial;
  n = 0;
  cards: { r: number; a: number; y: number; speed: number; spin: THREE.Vector3; rot: THREE.Euler; charge: number; out: number }[] = [];
  aMat!: THREE.InstancedBufferAttribute; aCharge!: THREE.InstancedBufferAttribute;
  sparks!: THREE.Points; sparkPos!: THREE.BufferAttribute; sparkVel!: Float32Array; sparkLife!: THREE.BufferAttribute; sparkHead = 0;
  m4 = new THREE.Matrix4(); q = new THREE.Quaternion(); v = new THREE.Vector3(); s = new THREE.Vector3(1, 1, 1); proj = new THREE.Vector3();
  wasDown = false;

  mount(ctx: Ctx) {
    const bg = fullscreen(/* glsl */ `
      uniform float uTime; uniform vec2 uRes; uniform float uIntro; uniform float uScroll; varying vec2 vUv;
      ${NOISE}
      void main(){
        float asp = uRes.x/uRes.y; vec2 p = (vUv-0.5)*vec2(asp,1.0);
        vec3 col = mix(vec3(0.03,0.008,0.02), vec3(0.08,0.02,0.06), smoothstep(1.2, 0.0, length(p)));
        col += vec3(0.08,0.02,0.05) * fbm3(p*1.5 + uTime*0.02);
        col *= smoothstep(0.0,1.0,uIntro*1.3) * (1.0 - uScroll*0.5);
        gl_FragColor = vec4(col,1.0);
      }`);
    this.bg = bg.mat; this.bgScene.add(bg.mesh);
    this.cam = new THREE.PerspectiveCamera(45, ctx.width / ctx.height, 0.1, 60);
    this.cam.position.set(0, 0.3, 7);
    this.build(ctx);
  }

  build(ctx: Ctx) {
    this.n = Math.round((ctx.mobile ? 34 : 64) * ctx.quality);
    this.cards = Array.from({ length: this.n }, () => ({
      r: 1.2 + Math.random() * 3.2, a: Math.random() * Math.PI * 2, y: (Math.random() - 0.5) * 4.2, speed: 0.12 + Math.random() * 0.2,
      spin: new THREE.Vector3((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.8),
      rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6), charge: 0, out: 0,
    }));
    const quad = new THREE.PlaneGeometry(0.5, 0.72);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index; geo.setAttribute('position', quad.getAttribute('position')); geo.setAttribute('uv', quad.getAttribute('uv'));
    this.aMat = new THREE.InstancedBufferAttribute(new Float32Array(this.n * 16), 16); this.aMat.setUsage(THREE.DynamicDrawUsage);
    this.aCharge = new THREE.InstancedBufferAttribute(new Float32Array(this.n * 2), 2); this.aCharge.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aM', this.aMat); geo.setAttribute('aCharge', this.aCharge);
    geo.instanceCount = this.n;
    this.mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, transparent: true, depthWrite: true,
      uniforms: { uTime: { value: 0 }, uIntro: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute mat4 aM; attribute vec2 aCharge;
        varying vec2 vUv; varying float vCharge; varying float vSuit; varying float vNdotV;
        void main(){
          vec4 w = aM * vec4(position, 1.0);
          vec4 mv = modelViewMatrix * w;
          vec3 n = normalize(mat3(modelViewMatrix) * mat3(aM) * vec3(0.0,0.0,1.0));
          vNdotV = abs(dot(n, normalize(-mv.xyz)));
          gl_Position = projectionMatrix * mv;
          vUv = uv; vCharge = aCharge.x; vSuit = aCharge.y;
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying float vCharge; varying float vSuit; varying float vNdotV; uniform float uTime; uniform float uIntro;
        float diamond(vec2 p, float s){ return abs(p.x)/0.7 + abs(p.y) - s; }
        float heart(vec2 p, float s){ p.y -= s*0.2; p.x = abs(p.x); float a = length(p - vec2(s*0.35, 0.0)) - s*0.4; return min(a, diamond(p*vec2(1.0,1.2)+vec2(0.0,s*0.35), s*0.75)); }
        void main(){
          vec2 c = vUv - 0.5;
          vec2 q = abs(c) - vec2(0.42, 0.44);
          float corner = length(max(q, 0.0)) - 0.04;
          if (corner > 0.0) discard;
          vec3 col;
          if (gl_FrontFacing) {
            col = vec3(0.93,0.9,0.84);
            float pip = vSuit < 0.5 ? diamond(c*vec2(1.0,0.8), 0.14) : heart(c*vec2(1.0,0.85), 0.16);
            col = mix(col, vec3(0.72,0.08,0.15), smoothstep(0.01, 0.0, pip));
            float small = vSuit < 0.5 ? diamond((c - vec2(-0.3,0.36))*vec2(1.0,0.8), 0.05) : heart((c - vec2(-0.3,0.36))*vec2(1.0,0.85), 0.06);
            col = mix(col, vec3(0.72,0.08,0.15), smoothstep(0.01, 0.0, small));
          } else {
            vec2 g = abs(fract(c*vec2(9.0,12.0) + vec2(c.y*9.0, 0.0)) - 0.5);
            col = mix(vec3(0.28,0.04,0.1), vec3(0.45,0.08,0.16), step(0.25, min(g.x, g.y)));
            col *= smoothstep(0.0, -0.03, max(abs(c.x)-0.38, abs(c.y)-0.4)) * 0.6 + 0.4;
          }
          col *= 0.35 + 0.65*vNdotV;
          vec3 pink = vec3(1.0,0.25,0.75);
          float edge = smoothstep(-0.06, 0.0, corner);
          col = mix(col, pink*1.6, vCharge * (0.35 + 0.65*edge));
          col += pink * vCharge * vCharge * (0.6 + 0.4*sin(uTime*40.0));
          gl_FragColor = vec4(col, uIntro);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    // spark pool
    const sp = new THREE.BufferGeometry();
    const total = BURST * 8;
    this.sparkPos = new THREE.BufferAttribute(new Float32Array(total * 3), 3); this.sparkPos.setUsage(THREE.DynamicDrawUsage);
    this.sparkLife = new THREE.BufferAttribute(new Float32Array(total).fill(1), 1); this.sparkLife.setUsage(THREE.DynamicDrawUsage);
    this.sparkVel = new Float32Array(total * 3);
    sp.setAttribute('position', this.sparkPos); sp.setAttribute('aLife', this.sparkLife);
    this.sparks = new THREE.Points(sp, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPx: { value: 1 } },
      vertexShader: `attribute float aLife; uniform float uPx; varying float vL; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = uPx*(1.0-aLife)*14.0*(7.0/-mv.z); vL = aLife; }`,
      fragmentShader: `varying float vL; void main(){ if (vL >= 1.0) discard; float d = length(gl_PointCoord-0.5); gl_FragColor = vec4(vec3(1.0,0.35,0.8)*smoothstep(0.5,0.0,d)*(1.0-vL), 1.0); }`,
    }));
    this.sparks.frustumCulled = false;
    this.scene.add(this.sparks);
  }

  private explode(p: THREE.Vector3) {
    const pos = this.sparkPos.array as Float32Array, life = this.sparkLife.array as Float32Array;
    for (let i = 0; i < BURST; i++) {
      const k = this.sparkHead; this.sparkHead = (this.sparkHead + 1) % (pos.length / 3);
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(1.5 + Math.random() * 3);
      this.sparkVel[k * 3] = dir.x; this.sparkVel[k * 3 + 1] = dir.y; this.sparkVel[k * 3 + 2] = dir.z;
      life[k] = 0;
    }
  }

  resize(ctx: Ctx) { if (this.cam) { this.cam.aspect = ctx.width / ctx.height; this.cam.updateProjectionMatrix(); } }
  setQuality(ctx: Ctx) { this.scene.clear(); this.mesh.geometry.dispose(); this.mat.dispose(); this.sparks.geometry.dispose(); this.build(ctx); }

  update(ctx: Ctx, dt: number) {
    syncCommon(this.bg, ctx);
    const t = ctx.time;
    this.cam.position.z = 7 + ctx.scroll * 4;
    this.cam.position.x = (ctx.pointer.x - 0.5) * 0.6;
    this.cam.lookAt(0, 0, 0);
    this.cam.updateMatrixWorld();
    const mx = ctx.pointer.x * 2 - 1, my = ctx.pointer.y * 2 - 1;
    const tapped = ctx.pointer.down && !this.wasDown; this.wasDown = ctx.pointer.down;
    let nearest = -1, best = 9;
    const M = this.aMat.array as Float32Array, C = this.aCharge.array as Float32Array;
    this.cards.forEach((c, i) => {
      c.a += dt * c.speed;
      c.rot.x += c.spin.x * dt; c.rot.y += c.spin.y * dt; c.rot.z += c.spin.z * dt;
      c.out = Math.max(0, c.out - dt * 0.8);
      const pull = 1 - c.out;
      this.v.set(Math.cos(c.a) * c.r, c.y + Math.sin(t * 0.4 + i) * 0.15, Math.sin(c.a) * c.r * 0.6);
      this.q.setFromEuler(c.rot);
      const sc = (0.4 + 0.6 * ctx.intro) * pull;
      this.s.set(sc, sc, sc);
      this.m4.compose(this.v, this.q, this.s);
      this.m4.toArray(M, i * 16);
      // charge builds when the card sits near the cursor on screen
      this.proj.copy(this.v).project(this.cam);
      const d = Math.hypot((this.proj.x - mx) * (ctx.width / ctx.height), this.proj.y - my);
      if (d < best && c.out === 0) { best = d; nearest = i; }
      c.charge = Math.max(0, c.charge + (d < 0.28 ? dt * 0.7 : -dt * 0.5));
      if (c.charge >= 1) { this.explode(this.v.clone()); c.charge = 0; c.out = 1; ctx.signal = 1; }
      C[i * 2] = Math.min(1, c.charge); C[i * 2 + 1] = i % 2;
    });
    if (tapped && nearest >= 0) this.cards[nearest].charge = 0.98;
    ctx.signal *= Math.exp(-dt * 4);
    this.aMat.needsUpdate = true; this.aCharge.needsUpdate = true;
    // sparks
    const pos = this.sparkPos.array as Float32Array, life = this.sparkLife.array as Float32Array;
    for (let k = 0; k < life.length; k++) {
      if (life[k] >= 1) continue;
      life[k] = Math.min(1, life[k] + dt * 1.1);
      pos[k * 3] += this.sparkVel[k * 3] * dt; pos[k * 3 + 1] += this.sparkVel[k * 3 + 1] * dt - dt * dt * 4; pos[k * 3 + 2] += this.sparkVel[k * 3 + 2] * dt;
      this.sparkVel[k * 3] *= 0.97; this.sparkVel[k * 3 + 1] *= 0.97; this.sparkVel[k * 3 + 2] *= 0.97;
    }
    this.sparkPos.needsUpdate = true; this.sparkLife.needsUpdate = true;
    (this.sparks.material as THREE.ShaderMaterial).uniforms.uPx.value = ctx.bufW / ctx.width;
    this.mat.uniforms.uTime.value = t; this.mat.uniforms.uIntro.value = ctx.intro;
    const r = ctx.renderer;
    r.autoClear = false; r.clear();
    r.render(this.bgScene, this.cam);
    r.clearDepth();
    r.render(this.scene, this.cam);
    r.autoClear = true;
  }

  dispose() {
    this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    this.bg.dispose();
  }
}
