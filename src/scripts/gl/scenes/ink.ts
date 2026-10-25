import * as THREE from 'three';
import { NOISE, COMMON_UNIFORMS } from '../glsl';
import { fullscreen, type Ctx } from '../engine';
import { ShaderScene } from './base';

/**
 * Shang-Chi: "Ink and Rings". Ink blooms and curls in still water. The dye is
 * advected through a curl-noise current in a small ping-pong buffer, and the
 * cursor stirs it with its own velocity. Ten thin rings of light hold their orbit.
 */
export default class Ink extends ShaderScene {
  a!: THREE.WebGLRenderTarget; b!: THREE.WebGLRenderTarget;
  simScene = new THREE.Scene(); simMat!: THREE.ShaderMaterial;
  last = new THREE.Vector2(0.5, 0.5);

  uniforms(ctx: Ctx) {
    const size = ctx.mobile ? 160 : 256;
    const type = ctx.renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const opt = { type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping } as const;
    this.a = new THREE.WebGLRenderTarget(size, size, opt);
    this.b = new THREE.WebGLRenderTarget(size, size, opt);
    const sim = fullscreen(/* glsl */ `
      uniform sampler2D uPrev; uniform float uTime; uniform vec2 uP; uniform vec2 uV; uniform float uAsp; uniform float uDt; uniform float uSeedDrop;
      varying vec2 vUv;
      ${NOISE}
      vec2 curl(vec2 p){
        float e = 0.01;
        float n = snoise(p), nx = snoise(p+vec2(e,0.0)), ny = snoise(p+vec2(0.0,e));
        return vec2((ny-n)/e, -(nx-n)/e);
      }
      void main(){
        vec2 asp = vec2(uAsp, 1.0);
        vec2 vel = curl(vUv*asp*1.6 + uTime*0.04) * 0.035;
        // cursor stirring: push dye along the pointer's velocity near the pointer
        vec2 d = (vUv - uP)*asp; float fall = exp(-dot(d,d)*55.0);
        vel += uV * fall * 0.9;
        vec2 src = vUv - vel * uDt;
        vec4 prev = texture2D(uPrev, src);
        // fresh ink where the pointer moves, plus slow drops
        float speed = length(uV);
        float inkIn = fall * clamp(speed*2.5, 0.0, 1.0);
        vec2 drop = vec2(0.5 + 0.3*sin(uTime*0.21), 0.5 + 0.25*cos(uTime*0.17));
        vec2 dd = (vUv - drop)*asp; inkIn += exp(-dot(dd,dd)*400.0) * 0.08 * uSeedDrop;
        float hue = fract(uTime*0.03);
        vec3 add = vec3(inkIn, inkIn*hue, inkIn*(1.0-hue));
        gl_FragColor = vec4(prev.rgb*0.992 + add, 1.0);
      }`, {
      uPrev: { value: null }, uP: { value: new THREE.Vector2() }, uV: { value: new THREE.Vector2() },
      uAsp: { value: 1 }, uDt: { value: 1 }, uSeedDrop: { value: 1 },
    });
    this.simMat = sim.mat;
    this.simScene.add(sim.mesh);
    return { uInk: { value: this.a.texture } };
  }

  frag() {
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      uniform sampler2D uInk;
      ${NOISE}
      float ring(vec2 p, float i, float t){
        // ellipse tilted in 3D: rotate around x and z, project
        float ang = t*0.25 + i*0.6283;
        float tilt = 1.1 + 0.15*sin(t*0.3 + i);
        float c = cos(ang), s = sin(ang);
        vec2 q = mat2(c,-s,s,c) * p;
        q.y /= cos(tilt)*0.9 + 0.1;
        float r = 0.36 + i*0.018;
        return 0.0016 / (abs(length(q) - r) + 0.0016);
      }
      void main(){
        float asp = uRes.x/uRes.y;
        vec2 p = (vUv-0.5)*vec2(asp,1.0);
        vec3 ink = texture2D(uInk, vUv).rgb;
        float amt = clamp(ink.r, 0.0, 1.2);
        vec3 water = vec3(0.015,0.02,0.018) + vec3(0.02,0.03,0.025)*fbm3(p*3.0 + uTime*0.02);
        vec3 jade = vec3(0.31,0.82,0.65); vec3 gold = vec3(0.91,0.77,0.42);
        vec3 inkCol = mix(jade, gold, clamp(ink.g/(amt+1e-3), 0.0, 1.0));
        vec3 col = mix(water, inkCol*0.85, smoothstep(0.02, 0.9, amt));
        col += inkCol * smoothstep(0.6, 1.2, amt) * 0.3;
        float rings = 0.0;
        for (int i = 0; i < 10; i++) rings += ring(p, float(i), uTime);
        col += gold * rings * 0.22 * (1.0 - uScroll*0.7);
        col *= smoothstep(0.0, 1.0, uIntro*1.2) * (1.0 - uScroll*0.5);
        col *= smoothstep(1.5, 0.35, length(p));
        gl_FragColor = vec4(col, 1.0);
      }`;
  }

  beforeRender(ctx: Ctx, dt: number) {
    const u = this.simMat.uniforms;
    u.uPrev.value = this.a.texture;
    u.uTime.value = ctx.time;
    u.uP.value.set(ctx.pointer.x, ctx.pointer.y);
    const vx = (ctx.pointer.x - this.last.x) / Math.max(dt, 1e-3), vy = (ctx.pointer.y - this.last.y) / Math.max(dt, 1e-3);
    this.last.set(ctx.pointer.x, ctx.pointer.y);
    u.uV.value.set(vx * 0.02, vy * 0.02).clampLength(0, 0.08);
    u.uAsp.value = ctx.width / ctx.height;
    u.uDt.value = Math.min(dt * 60, 2);
    u.uSeedDrop.value = ctx.pointer.active ? 0.3 : 1;
    ctx.renderer.setRenderTarget(this.b);
    ctx.renderer.render(this.simScene, this.cam);
    ctx.renderer.setRenderTarget(null);
    const t = this.a; this.a = this.b; this.b = t;
    this.mat.uniforms.uInk.value = this.a.texture;
  }

  dispose() { super.dispose(); this.a.dispose(); this.b.dispose(); this.simMat.dispose(); }
}
