import * as THREE from 'three';
import { NOISE } from '../glsl';
import { fullscreen, syncCommon, type Ctx, type HeroScene } from '../engine';

/**
 * Home: "The Void". Particles drift as a cold starfield, then condense into the
 * word DOOMSDAY. The cursor parts them like a hand through smoke. Scrolling
 * scatters the word back into the dark.
 */
export default class VoidScene implements HeroScene {
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  bg!: THREE.ShaderMaterial;
  pts!: THREE.Points;
  pmat!: THREE.ShaderMaterial;

  mount(ctx: Ctx) {
    const bg = fullscreen(/* glsl */ `
      uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uScroll; uniform float uIntro;
      varying vec2 vUv;
      ${NOISE}
      void main(){
        vec2 p = vUv; float asp = uRes.x/uRes.y;
        vec2 q = (p-0.5)*vec2(asp,1.0);
        float n = fbm3(q*1.4 + vec2(uTime*0.02, -uTime*0.015));
        float glow = smoothstep(1.1, 0.0, length(q - vec2(0.0,-0.75))) * 0.35;
        glow += smoothstep(0.55, 0.0, length((p-uMouse)*vec2(asp,1.0))) * 0.06;
        vec3 col = vec3(0.012,0.016,0.018) + vec3(0.06,0.25,0.14)*glow*(0.7+0.3*n) * uIntro;
        col += vec3(0.02,0.05,0.035) * (n*0.5+0.5) * 0.25;
        col *= 1.0 - uScroll*0.5;
        gl_FragColor = vec4(col,1.0);
      }`);
    this.bg = bg.mat; bg.mesh.renderOrder = -1; this.scene.add(bg.mesh);
    this.buildPoints(ctx);
  }

  private sampleText(count: number, ctx: Ctx) {
    const c = document.createElement('canvas');
    const W = 1200, H = 300; c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 240;
    g.font = `400 ${size}px "Instrument Serif", serif`;
    const w0 = g.measureText('DOOMSDAY').width;
    size = Math.floor(size * Math.min(1, (W * 0.94) / w0));
    g.font = `400 ${size}px "Instrument Serif", serif`;
    g.fillText('DOOMSDAY', W / 2, H / 2 + 10);
    const data = g.getImageData(0, 0, W, H).data;
    const hits: number[] = [];
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4] > 128) hits.push(x, y);
    const out = new Float32Array(count * 3);
    const asp = ctx.width / ctx.height;
    const span = Math.min(1.6, asp * 0.9); // half-width in clip-ish units
    const lift = ctx.mobile || asp < 1 ? 0.42 : 0.36; // keep the word above the countdown
    for (let i = 0; i < count; i++) {
      const k = (Math.floor(Math.random() * (hits.length / 2))) * 2;
      out[i * 3] = ((hits[k] / W) - 0.5) * 2 * span;
      out[i * 3 + 1] = -((hits[k + 1] / H) - 0.5) * 2 * span * (H / W) + lift;
      out[i * 3 + 2] = 0;
    }
    return out;
  }

  private buildPoints(ctx: Ctx) {
    const count = Math.round((ctx.mobile ? 8000 : 24000) * ctx.quality);
    const target = this.sampleText(count, ctx);
    const start = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      start[i * 3] = (Math.random() * 2 - 1) * 2.4;
      start[i * 3 + 1] = (Math.random() * 2 - 1) * 1.4;
      start[i * 3 + 2] = Math.random();
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(start, 3));
    geo.setAttribute('aTarget', new THREE.BufferAttribute(target, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.pmat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uAsm: { value: 0 }, uScatter: { value: 0 }, uMouse: { value: new THREE.Vector2() },
        uAsp: { value: 1 }, uSize: { value: 1 }, uIntro: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aTarget; attribute float aSeed;
        uniform float uTime, uAsm, uScatter, uAsp, uSize, uIntro; uniform vec2 uMouse;
        varying float vA; varying float vG;
        ${NOISE}
        void main(){
          vec3 p = position;
          vec2 drift = vec2(snoise(p.xy*0.6+uTime*0.05+aSeed), snoise(p.yx*0.6-uTime*0.05+aSeed*3.0))*0.12;
          vec2 a = p.xy + drift;
          float delay = aSeed*0.35;
          float t = clamp((uAsm - delay)/(1.0-0.35), 0.0, 1.0);
          t = t*t*(3.0-2.0*t);
          vec2 tp = aTarget.xy + vec2(snoise(aTarget.xy*3.0+uTime*0.3), snoise(aTarget.yx*3.0-uTime*0.3))*0.008;
          vec2 pos = mix(a, tp, t);
          // scatter outward on scroll
          vec2 dir = normalize(aTarget.xy + vec2(aSeed-0.5, fract(aSeed*7.13)-0.5)*0.6 + 1e-4);
          pos += dir * uScatter * (0.6 + aSeed*2.2) + vec2(0.0, uScatter*uScatter*(aSeed-0.3)*1.2);
          // cursor parts the particles
          vec2 m = (uMouse*2.0-1.0) * vec2(uAsp, 1.0);
          vec2 sp = pos;
          vec2 d = sp - m; float l = length(d);
          pos += normalize(d+1e-4) * exp(-l*l*14.0/min(uAsp,1.0)) * 0.18 * min(uAsp, 1.0);
          gl_Position = vec4(pos.x/uAsp, pos.y, 0.0, 1.0);
          float tw = 0.6 + 0.4*sin(uTime*2.0 + aSeed*40.0);
          gl_PointSize = uSize * (1.0 + t*0.6) * (0.6 + p.z) ;
          vA = (0.25 + 0.75*t) * tw * uIntro * (1.0 - uScatter*0.6);
          vG = step(0.86, aSeed);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying float vG;
        void main(){
          vec2 c = gl_PointCoord - 0.5; float d = length(c);
          float a = smoothstep(0.5, 0.0, d);
          vec3 col = mix(vec3(0.91,0.90,0.88), vec3(0.24,1.0,0.54), vG);
          gl_FragColor = vec4(col * a * vA, 1.0);
        }`,
    });
    this.pts = new THREE.Points(geo, this.pmat);
    this.pts.frustumCulled = false;
    this.scene.add(this.pts);
  }

  resize(ctx: Ctx) {
    if (!this.pmat) return;
    this.pmat.uniforms.uAsp.value = ctx.width / ctx.height;
    this.pmat.uniforms.uSize.value = (ctx.mobile ? 2.2 : 2.0) * (ctx.bufW / ctx.width);
  }

  setQuality(ctx: Ctx) {
    this.scene.remove(this.pts); this.pts.geometry.dispose(); this.pmat.dispose();
    this.buildPoints(ctx); this.resize(ctx);
  }

  update(ctx: Ctx, _dt: number) {
    syncCommon(this.bg, ctx);
    const u = this.pmat.uniforms;
    u.uTime.value = ctx.time;
    u.uMouse.value.set(ctx.pointer.x, ctx.pointer.y);
    u.uIntro.value = ctx.intro;
    u.uAsm.value = Math.min(1, Math.max(0, (ctx.time - 0.6) / 2.6)) * (ctx.reduced ? 0 : 1) + (ctx.reduced ? 1 : 0);
    u.uScatter.value = ctx.scroll;
    ctx.renderer.render(this.scene, this.cam);
  }

  dispose() {
    this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  }
}
