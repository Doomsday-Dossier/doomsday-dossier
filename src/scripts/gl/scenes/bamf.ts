import * as THREE from 'three';
import { NOISE } from '../glsl';
import { fullscreen, syncCommon, type Ctx, type HeroScene } from '../engine';

const POOL = 28;

/**
 * Nightcrawler: "Bamf". An unseen acrobat teleports around the frame, chasing
 * the cursor in jumps. Each jump leaves a burst of soft indigo smoke where it
 * left and another where it lands. Smoke puffs are billboards shaded with noise
 * in the fragment shader. Two circus spotlights sweep the dark behind them.
 */
export default class Bamf implements HeroScene {
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  bg!: THREE.ShaderMaterial;
  mesh!: THREE.Mesh; mat!: THREE.ShaderMaterial;
  puffs = Array.from({ length: POOL }, () => ({ x: 0, y: 0, born: -99, size: 0.2, seed: Math.random() }));
  head = 0; at = { x: 0, y: 0 }; jumpT = 0.6; wasDown = false;
  attrPos!: THREE.InstancedBufferAttribute; attrLife!: THREE.InstancedBufferAttribute;

  mount(ctx: Ctx) {
    const bg = fullscreen(/* glsl */ `
      uniform float uTime; uniform vec2 uRes; uniform float uIntro; uniform float uScroll; varying vec2 vUv;
      ${NOISE}
      float cone(vec2 p, vec2 o, float ang, float w){
        vec2 d = p - o; float a = atan(d.x, d.y) - ang;
        return smoothstep(w, 0.0, abs(a)) * smoothstep(2.4, 0.2, length(d));
      }
      void main(){
        float asp = uRes.x/uRes.y; vec2 p = (vUv-0.5)*vec2(asp,1.0);
        vec3 col = mix(vec3(0.012,0.01,0.035), vec3(0.05,0.03,0.1), vUv.y);
        float l = cone(p, vec2(-asp*0.6, 0.7), 3.14159 + 0.5*sin(uTime*0.4), 0.16) + cone(p, vec2(asp*0.6, 0.7), 3.14159 + 0.5*sin(uTime*0.33+2.0), 0.16);
        col += vec3(0.35,0.3,0.6) * l * (0.35 + 0.15*fbm3(p*3.0 + uTime*0.1));
        col *= smoothstep(0.0,1.0,uIntro*1.3) * (1.0 - uScroll*0.5);
        gl_FragColor = vec4(col,1.0);
      }`);
    this.bg = bg.mat; bg.mesh.renderOrder = -1; this.scene.add(bg.mesh);

    const quad = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index; geo.setAttribute('position', quad.getAttribute('position')); geo.setAttribute('uv', quad.getAttribute('uv'));
    this.attrPos = new THREE.InstancedBufferAttribute(new Float32Array(POOL * 4), 4); this.attrPos.setUsage(THREE.DynamicDrawUsage);
    this.attrLife = new THREE.InstancedBufferAttribute(new Float32Array(POOL), 1); this.attrLife.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPuff', this.attrPos); geo.setAttribute('aLife', this.attrLife);
    geo.instanceCount = POOL;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { uAsp: { value: 1 }, uTime: { value: 0 }, uIntro: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec4 aPuff; attribute float aLife; uniform float uAsp;
        varying vec2 vUv; varying float vLife; varying float vSeed;
        void main(){
          float grow = 0.4 + 0.9 * sqrt(aLife);
          vec2 p = aPuff.xy + position.xy * aPuff.z * grow;
          p.y += aLife * 0.12;
          gl_Position = vec4(p.x/uAsp, p.y, 0.0, 1.0);
          vUv = uv; vLife = aLife; vSeed = aPuff.w;
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying float vLife; varying float vSeed; uniform float uTime; uniform float uIntro;
        ${NOISE}
        void main(){
          if (vLife >= 1.0) discard;
          vec2 c = vUv - 0.5;
          float n = fbm3(c*4.0 + vSeed*20.0 + vec2(0.0, -vLife*1.5));
          float r = length(c) + n*0.18;
          float a = smoothstep(0.5, 0.15, r) * (1.0 - vLife) * smoothstep(0.0, 0.06, vLife);
          vec3 smoke = mix(vec3(0.25,0.2,0.55), vec3(0.08,0.06,0.2), smoothstep(0.0,0.6,vLife));
          smoke += vec3(0.55,0.45,0.9) * smoothstep(0.3, 0.0, r) * (1.0 - vLife) * 0.6;   // flash at the core
          smoke += vec3(0.6,0.5,0.15) * smoothstep(0.2, 0.0, abs(n)) * 0.12;            // a sulphur tinge
          gl_FragColor = vec4(smoke, a * 0.85 * uIntro);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  private puff(x: number, y: number, t: number, size: number) {
    const p = this.puffs[this.head]; this.head = (this.head + 1) % POOL;
    p.x = x; p.y = y; p.born = t; p.size = size; p.seed = Math.random();
  }

  update(ctx: Ctx, dt: number) {
    syncCommon(this.bg, ctx);
    const t = ctx.time, asp = ctx.width / ctx.height;
    const mx = (ctx.pointer.x * 2 - 1) * asp, my = ctx.pointer.y * 2 - 1;
    this.jumpT -= dt;
    const tapped = ctx.pointer.down && !this.wasDown; this.wasDown = ctx.pointer.down;
    if ((this.jumpT <= 0 || tapped) && ctx.intro > 0.3) {
      // jump to somewhere near the cursor (or exactly there on a tap), puffs at both ends
      const nx = tapped ? mx : mx + (Math.random() - 0.5) * 0.9, ny = tapped ? my : my + (Math.random() - 0.5) * 0.7;
      this.puff(this.at.x, this.at.y, t, 0.16 + Math.random() * 0.06);
      this.puff(nx, ny, t + 0.04, 0.18 + Math.random() * 0.08);
      this.puff(nx + (Math.random() - 0.5) * 0.1, ny + (Math.random() - 0.5) * 0.1, t + 0.08, 0.1);
      this.at = { x: nx, y: ny };
      this.jumpT = 0.7 + Math.random() * 0.8;
      ctx.signal = 1;
    } else ctx.signal *= Math.exp(-dt * 6);
    const pos = this.attrPos.array as Float32Array, life = this.attrLife.array as Float32Array;
    this.puffs.forEach((p, i) => {
      pos[i * 4] = p.x; pos[i * 4 + 1] = p.y; pos[i * 4 + 2] = p.size; pos[i * 4 + 3] = p.seed;
      life[i] = Math.min(1, Math.max(0, (t - p.born) / 1.8));
    });
    this.attrPos.needsUpdate = true; this.attrLife.needsUpdate = true;
    const u = this.mat.uniforms; u.uAsp.value = asp; u.uTime.value = t; u.uIntro.value = ctx.intro;
    ctx.renderer.render(this.scene, this.cam);
  }

  dispose() { this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
}
