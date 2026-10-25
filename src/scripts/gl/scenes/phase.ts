import * as THREE from 'three';
import { NOISE } from '../glsl';
import { fullscreen, syncCommon, type Ctx, type HeroScene } from '../engine';

/**
 * Ghost: "Phase Echo". A frame-feedback loop. Each frame takes the previous
 * frame, nudges it a little out of phase (a slow zoom, a drift and random
 * horizontal tears) and fades it, then draws fresh light on top. Anything that
 * moves leaves a trail of fading echoes. The cursor is a phasing ring whose
 * echoes stack up behind it.
 */
export default class Phase implements HeroScene {
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  a!: THREE.WebGLRenderTarget; b!: THREE.WebGLRenderTarget;
  stepScene = new THREE.Scene(); stepMat!: THREE.ShaderMaterial;
  showScene = new THREE.Scene(); showMat!: THREE.ShaderMaterial;
  scale = 0.5;

  mount(ctx: Ctx) {
    this.scale = ctx.mobile ? 0.45 : 0.6;
    const opt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false } as const;
    this.a = new THREE.WebGLRenderTarget(4, 4, opt); this.b = new THREE.WebGLRenderTarget(4, 4, opt);
    const step = fullscreen(/* glsl */ `
      uniform sampler2D uPrev; uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uIntro; uniform float uScroll;
      varying vec2 vUv;
      ${NOISE}
      float ring(vec2 p, vec2 c, float r, float w){ return smoothstep(w, 0.0, abs(length(p - c) - r)); }
      void main(){
        float asp = uRes.x/uRes.y;
        // phase the previous frame: slight zoom toward centre, drift, and torn rows
        vec2 uv = (vUv - 0.5) * 0.992 + 0.5 + vec2(0.0008*sin(uTime), 0.0012);
        float row = floor(vUv.y * 60.0);
        float tear = step(0.93, fract(sin(row*91.7 + floor(uTime*14.0))*43758.5)) * (fract(sin(row*13.1)*9187.3) - 0.5) * 0.03;
        uv.x += tear;
        vec3 prev = texture2D(uPrev, uv).rgb * (0.9 - uScroll*0.15);
        // fresh light: a phasing ring at the pointer and slow vertical scan bars
        vec2 p = (vUv-0.5)*vec2(asp,1.0);
        vec2 m = (uMouse-0.5)*vec2(asp,1.0);
        float r = 0.12 + 0.03*sin(uTime*3.0);
        float l = ring(p, m, r, 0.006) + ring(p, m, r*0.55, 0.004)*0.6;
        float bars = smoothstep(0.004, 0.0, abs(fract(p.x*1.4 + uTime*0.07) - 0.5) - 0.495) * 0.25;
        float grain = step(0.996, fract(sin(dot(floor(vUv*uRes*0.5), vec2(12.9898,78.233)) + uTime)*43758.5));
        vec3 fresh = vec3(0.85,0.95,1.0) * l * 0.35 + vec3(0.6,0.7,0.8) * bars * 0.12 + vec3(0.8) * grain * 0.2;
        // occasional full phase-out: the fresh layer drops out for a few frames
        float out_ = step(0.985, fract(sin(floor(uTime*8.0))*43758.5));
        gl_FragColor = vec4(prev + fresh * (1.0 - out_) * uIntro, 1.0);
      }`, { uPrev: { value: null } });
    this.stepMat = step.mat; this.stepScene.add(step.mesh);
    const show = fullscreen(/* glsl */ `
      uniform sampler2D uBuf; uniform float uIntro; uniform float uScroll; uniform vec2 uRes;
      varying vec2 vUv;
      void main(){
        float split = 0.003;
        float r = texture2D(uBuf, vUv + vec2(split, 0.0)).r;
        float g = texture2D(uBuf, vUv).g;
        float b = texture2D(uBuf, vUv - vec2(split, 0.0)).b;
        vec3 col = vec3(r, g, b);
        col = col / (1.0 + col);                                  // soft tone map
        col *= vec3(0.85, 0.95, 1.05);
        col += vec3(0.015,0.017,0.02);
        float asp = uRes.x/uRes.y;
        col *= smoothstep(1.4, 0.3, length((vUv-0.5)*vec2(asp,1.0)));
        gl_FragColor = vec4(col, 1.0);
      }`, { uBuf: { value: null } });
    this.showMat = show.mat; this.showScene.add(show.mesh);
    this.resize(ctx);
  }

  resize(ctx: Ctx) {
    if (!this.a) return;
    const w = Math.max(64, Math.round(ctx.bufW * this.scale)), h = Math.max(64, Math.round(ctx.bufH * this.scale));
    this.a.setSize(w, h); this.b.setSize(w, h);
  }

  update(ctx: Ctx, _dt: number) {
    syncCommon(this.stepMat, ctx);
    const r = ctx.renderer;
    this.stepMat.uniforms.uPrev.value = this.a.texture;
    r.setRenderTarget(this.b); r.render(this.stepScene, this.cam);
    r.setRenderTarget(null);
    const t = this.a; this.a = this.b; this.b = t;
    syncCommon(this.showMat, ctx);
    this.showMat.uniforms.uBuf.value = this.a.texture;
    r.render(this.showScene, this.cam);
    ctx.signal = Math.random() < 0.06 ? 1 : 0;
  }

  dispose() { this.a.dispose(); this.b.dispose(); this.stepMat.dispose(); this.showMat.dispose(); }
}
