import * as THREE from 'three';
import { NOISE, COMMON_UNIFORMS } from '../glsl';
import { fullscreen, type Ctx } from '../engine';
import { ShaderScene } from './base';

/**
 * Mystique: "Shapeshift". A Gray-Scott reaction-diffusion simulation runs in a
 * ping-pong buffer. Its feed and kill rates drift over time, so the pattern
 * keeps changing form, from spots to stripes to maze, like skin that will not
 * settle. The cursor seeds new growth wherever it moves.
 */
export default class Reaction extends ShaderScene {
  a!: THREE.WebGLRenderTarget; b!: THREE.WebGLRenderTarget;
  simScene = new THREE.Scene(); simMat!: THREE.ShaderMaterial; seedMat!: THREE.ShaderMaterial; seedScene = new THREE.Scene();
  size = 256; iters = 8; seeded = false;

  uniforms(ctx: Ctx) {
    this.size = ctx.mobile ? 180 : 256;
    this.iters = ctx.mobile ? 6 : 10;
    const type = ctx.renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const opt = { type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping } as const;
    this.a = new THREE.WebGLRenderTarget(this.size, this.size, opt);
    this.b = new THREE.WebGLRenderTarget(this.size, this.size, opt);
    const seed = fullscreen(/* glsl */ `
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        float v = step(0.985, h(floor(vUv*64.0)));
        gl_FragColor = vec4(1.0, v, 0.0, 1.0);
      }`);
    this.seedMat = seed.mat; this.seedScene.add(seed.mesh);
    const sim = fullscreen(/* glsl */ `
      uniform sampler2D uPrev; uniform vec2 uTexel; uniform float uF; uniform float uK; uniform vec2 uP; uniform float uOn; uniform float uAsp;
      varying vec2 vUv;
      void main(){
        vec2 c = texture2D(uPrev, vUv).rg;
        vec2 lap = -c
          + 0.2*(texture2D(uPrev, vUv+vec2(uTexel.x,0.0)).rg + texture2D(uPrev, vUv-vec2(uTexel.x,0.0)).rg
               + texture2D(uPrev, vUv+vec2(0.0,uTexel.y)).rg + texture2D(uPrev, vUv-vec2(0.0,uTexel.y)).rg)
          + 0.05*(texture2D(uPrev, vUv+uTexel).rg + texture2D(uPrev, vUv-uTexel).rg
               + texture2D(uPrev, vUv+vec2(uTexel.x,-uTexel.y)).rg + texture2D(uPrev, vUv+vec2(-uTexel.x,uTexel.y)).rg);
        float A = c.r, B = c.g;
        float abb = A*B*B;
        float nA = A + (1.0*lap.r - abb + uF*(1.0-A));
        float nB = B + (0.5*lap.g + abb - (uK+uF)*B);
        float d = length((vUv - uP)*vec2(uAsp,1.0));
        nB += smoothstep(0.03, 0.0, d) * 0.5 * uOn;
        gl_FragColor = vec4(clamp(nA,0.0,1.0), clamp(nB,0.0,1.0), 0.0, 1.0);
      }`, {
      uPrev: { value: null }, uTexel: { value: new THREE.Vector2(1 / this.size, 1 / this.size) }, uF: { value: 0.037 }, uK: { value: 0.06 },
      uP: { value: new THREE.Vector2(-1, -1) }, uOn: { value: 0 }, uAsp: { value: 1 },
    });
    this.simMat = sim.mat; this.simScene.add(sim.mesh);
    return { uRD: { value: this.a.texture }, uTexel: { value: new THREE.Vector2(1 / this.size, 1 / this.size) } };
  }

  frag() {
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      uniform sampler2D uRD; uniform vec2 uTexel;
      ${NOISE}
      void main(){
        float asp = uRes.x/uRes.y;
        vec2 uv = vec2(vUv.x*asp*1.15, vUv.y*1.15) + vec2(0.0, uScroll*0.3);
        float b = texture2D(uRD, uv).g;
        float bx = texture2D(uRD, uv+vec2(uTexel.x,0.0)).g - texture2D(uRD, uv-vec2(uTexel.x,0.0)).g;
        float by = texture2D(uRD, uv+vec2(0.0,uTexel.y)).g - texture2D(uRD, uv-vec2(0.0,uTexel.y)).g;
        vec3 n = normalize(vec3(-bx*6.0, -by*6.0, 1.0));
        float light = clamp(dot(n, normalize(vec3(-0.4,0.6,0.8))), 0.0, 1.0);
        float s = smoothstep(0.12, 0.32, b);
        vec3 deep = vec3(0.02,0.04,0.12), blue = vec3(0.12,0.3,0.85), gold = vec3(1.0,0.75,0.3);
        vec3 col = mix(deep, blue*(0.4+0.8*light), s);
        col += gold * pow(light, 24.0) * s * 0.6;                   // scale sheen
        col += gold * smoothstep(0.02, 0.0, abs(b-0.2)) * 0.12;     // edges catch the light
        col *= smoothstep(0.0,1.0,uIntro*1.3) * (1.0 - uScroll*0.5);
        col *= smoothstep(1.5, 0.35, length((vUv-0.5)*vec2(asp,1.0)));
        gl_FragColor = vec4(col,1.0);
      }`;
  }

  beforeRender(ctx: Ctx) {
    const r = ctx.renderer;
    if (!this.seeded) { r.setRenderTarget(this.a); r.render(this.seedScene, this.cam); r.setRenderTarget(null); this.seeded = true; }
    const u = this.simMat.uniforms;
    // drift through the parameter space so the pattern keeps shifting shape
    const t = ctx.time * 0.05;
    u.uF.value = 0.03 + 0.015 * (0.5 + 0.5 * Math.sin(t));
    u.uK.value = 0.058 + 0.006 * (0.5 + 0.5 * Math.sin(t * 1.7 + 1.0));
    const asp = ctx.width / ctx.height;
    // the sim texture repeats across the screen at 1.15 scale; map the pointer into it
    u.uP.value.set(((ctx.pointer.x * asp * 1.15) % 1 + 1) % 1, ((ctx.pointer.y * 1.15 + ctx.scroll * 0.3) % 1 + 1) % 1);
    u.uOn.value = ctx.pointer.active ? 1 : 0.4;
    u.uAsp.value = 1;
    const iters = ctx.reduced ? 400 : this.iters;
    for (let i = 0; i < iters; i++) {
      u.uPrev.value = this.a.texture;
      r.setRenderTarget(this.b); r.render(this.simScene, this.cam); r.setRenderTarget(null);
      const tmp = this.a; this.a = this.b; this.b = tmp;
    }
    this.mat.uniforms.uRD.value = this.a.texture;
  }

  dispose() { super.dispose(); this.a.dispose(); this.b.dispose(); this.simMat.dispose(); this.seedMat.dispose(); }
}
