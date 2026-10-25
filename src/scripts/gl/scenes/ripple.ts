import * as THREE from 'three';
import { NOISE, COMMON_UNIFORMS } from '../glsl';
import { fullscreen, type Ctx } from '../engine';
import { ShaderScene } from './base';

/**
 * Sue Storm: "Force Field". A real-time 2D wave equation runs in a small
 * ping-pong buffer. The cursor drops ripples as it moves; each wave bends light
 * across a halftone dot field. Inside a soft sphere around the cursor the dots
 * turn invisible and only the refraction and a fresnel rim remain.
 */
export default class Ripple extends ShaderScene {
  a!: THREE.WebGLRenderTarget; b!: THREE.WebGLRenderTarget;
  simScene = new THREE.Scene(); simMat!: THREE.ShaderMaterial;
  size = 256; autoT = 0; drop = new THREE.Vector3(-1, -1, 0);

  uniforms(ctx: Ctx) {
    this.size = ctx.mobile ? 160 : 256;
    const type = ctx.renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const opt = { type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false } as const;
    this.a = new THREE.WebGLRenderTarget(this.size, this.size, opt);
    this.b = new THREE.WebGLRenderTarget(this.size, this.size, opt);
    const sim = fullscreen(/* glsl */ `
      uniform sampler2D uPrev; uniform vec2 uTexel; uniform vec3 uDrop; uniform vec2 uP; uniform float uMove; uniform float uAsp;
      varying vec2 vUv;
      void main(){
        vec4 c = texture2D(uPrev, vUv);
        float n = texture2D(uPrev, vUv + vec2(0.0, uTexel.y)).r;
        float s = texture2D(uPrev, vUv - vec2(0.0, uTexel.y)).r;
        float e = texture2D(uPrev, vUv + vec2(uTexel.x, 0.0)).r;
        float w = texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)).r;
        float h = (n + s + e + w) * 0.5 - c.g;     // wave equation step
        h *= 0.975;                                 // damping
        vec2 asp = vec2(uAsp, 1.0);
        float dp = length((vUv - uP) * asp);
        h += smoothstep(0.03, 0.0, dp) * 0.1 * uMove;      // cursor wake
        float dd = length((vUv - uDrop.xy) * asp);
        h += smoothstep(0.04, 0.0, dd) * uDrop.z * 0.35;             // automatic drops
        gl_FragColor = vec4(h, c.r, 0.0, 1.0);
      }`, {
      uPrev: { value: null }, uTexel: { value: new THREE.Vector2(1 / this.size, 1 / this.size) }, uDrop: { value: this.drop },
      uP: { value: new THREE.Vector2(-1, -1) }, uMove: { value: 0 }, uAsp: { value: 1 },
    });
    this.simMat = sim.mat; this.simScene.add(sim.mesh);
    return { uWave: { value: this.a.texture }, uTexel: { value: new THREE.Vector2(1 / this.size, 1 / this.size) } };
  }

  frag() {
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      uniform sampler2D uWave; uniform vec2 uTexel;
      ${NOISE}
      float dots(vec2 p, float scale){
        vec2 g = p*scale; vec2 c = fract(g)-0.5;
        float tone = 0.35 + 0.35*fbm3(floor(g)*0.05 + uTime*0.03);
        return smoothstep(tone*0.5, tone*0.5 - 0.06, length(c));
      }
      void main(){
        float asp = uRes.x/uRes.y;
        float h = texture2D(uWave, vUv).r;
        float hx = texture2D(uWave, vUv + vec2(uTexel.x,0.0)).r - texture2D(uWave, vUv - vec2(uTexel.x,0.0)).r;
        float hy = texture2D(uWave, vUv + vec2(0.0,uTexel.y)).r - texture2D(uWave, vUv - vec2(0.0,uTexel.y)).r;
        vec2 nrm = vec2(hx, hy);
        vec2 uv = vUv + nrm*0.05;
        vec2 p = (uv-0.5)*vec2(asp,1.0);
        // invisibility sphere around the pointer
        vec2 m = (uMouse-0.5)*vec2(asp,1.0);
        float r = length(p - m);
        float sphere = smoothstep(0.24, 0.16, r);
        float rim = smoothstep(0.03, 0.0, abs(r - 0.2)) * 0.7;
        float field = dots(p, 34.0) * (1.0 - sphere);
        vec3 bg = mix(vec3(0.02,0.022,0.05), vec3(0.05,0.06,0.12), vUv.y);
        vec3 col = bg + vec3(0.55,0.62,1.0) * field * 0.42;
        // caustic glints where the surface curves
        float caustic = pow(clamp(length(nrm)*10.0, 0.0, 1.0), 2.0);
        col += vec3(0.6,0.95,1.0) * caustic * 0.3;
        col += vec3(0.75,0.82,1.0) * rim * (0.6 + 0.4*sin(uTime*2.0));
        col += vec3(0.4,0.5,1.0) * clamp(h, -0.5, 0.5) * 0.2;
        col *= smoothstep(0.0, 1.0, uIntro*1.3) * (1.0 - uScroll*0.55);
        col *= smoothstep(1.5, 0.35, length((vUv-0.5)*vec2(asp,1.0)));
        gl_FragColor = vec4(col, 1.0);
      }`;
  }

  beforeRender(ctx: Ctx, dt: number) {
    const u = this.simMat.uniforms;
    // automatic drops so the surface is never still, including on phones
    this.autoT -= dt; this.drop.z = 0;
    if (this.autoT <= 0) { this.drop.set(0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.7, ctx.scroll > 0.05 ? 0.9 : 0.6); this.autoT = 0.9 + Math.random() * 1.4; }
    const speed = Math.hypot(ctx.pointer.vx, ctx.pointer.vy);
    u.uP.value.set(ctx.pointer.x, ctx.pointer.y);
    u.uMove.value = Math.min(1, speed * 1.5);
    u.uAsp.value = ctx.width / ctx.height;
    for (let i = 0; i < 2; i++) {
      u.uPrev.value = this.a.texture;
      ctx.renderer.setRenderTarget(this.b);
      ctx.renderer.render(this.simScene, this.cam);
      ctx.renderer.setRenderTarget(null);
      const t = this.a; this.a = this.b; this.b = t;
      this.drop.z = 0;
    }
    this.mat.uniforms.uWave.value = this.a.texture;
  }

  dispose() { super.dispose(); this.a.dispose(); this.b.dispose(); this.simMat.dispose(); }
}
