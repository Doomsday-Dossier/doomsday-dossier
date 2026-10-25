import * as THREE from 'three';
import { NOISE, COMMON_UNIFORMS } from '../glsl';
import { Trail, type Ctx } from '../engine';
import { ShaderScene } from './base';

/**
 * Victor von Doom: "The Forge". Domain-warped molten iron. The cursor is heat:
 * it melts the crust to doom-green, and the metal cools back to iron behind it.
 * Embers rise through the frame.
 */
export default class Forge extends ShaderScene {
  trail!: Trail;
  embers!: THREE.Points;
  emat!: THREE.ShaderMaterial;

  uniforms(ctx: Ctx) {
    this.trail = new Trail(ctx.renderer, ctx.mobile ? 96 : 160, 0.965, 0.065);
    return { uHeat: { value: this.trail.texture } };
  }

  frag() {
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      uniform sampler2D uHeat;
      ${NOISE}
      vec2 warp(vec2 p, float t){
        vec2 q = vec2(fbm3(p + vec2(0.0, t*0.05)), fbm3(p + vec2(5.2, 1.3) - t*0.04));
        vec2 r = vec2(fbm3(p + 3.0*q + vec2(1.7, 9.2) + t*0.03), fbm3(p + 3.0*q + vec2(8.3, 2.8)));
        return r;
      }
      void main(){
        float asp = uRes.x/uRes.y;
        vec2 p = (vUv - 0.5) * vec2(asp, 1.0) * 2.2;
        p.y += uScroll * 0.8;
        vec2 r = warp(p, uTime);
        float f = fbm(p + 3.5*r);
        float heat = texture2D(uHeat, vUv).r;
        // crust: cracks glow where the warped field folds
        float veins = smoothstep(0.03, 0.0, abs(f - 0.05)) + smoothstep(0.02, 0.0, abs(r.x - 0.1)) * 0.5;
        float pulse = 0.75 + 0.25*sin(uTime*0.8 + f*6.0);
        // heat makes veins blaze and lightly warms the crust; it never floods the frame
        float molten = clamp(veins * (0.35 + 0.65*uIntro) * pulse * (0.7 + heat*1.6) + heat*0.22*smoothstep(-0.2,0.6,f), 0.0, 1.6);
        vec3 iron = mix(vec3(0.02,0.025,0.024), vec3(0.11,0.12,0.12), smoothstep(-0.6, 0.8, f));
        // brushed-metal sheen
        iron += vec3(0.05) * pow(max(0.0, snoise(vec2(p.x*0.6, p.y*18.0))), 3.0) * (1.0 - molten);
        vec3 green = vec3(0.24, 1.0, 0.54);
        vec3 white = vec3(0.85, 1.0, 0.9);
        vec3 col = iron;
        col = mix(col, green * 0.55, smoothstep(0.15, 0.6, molten));
        col = mix(col, green, smoothstep(0.55, 1.0, molten));
        col = mix(col, white, smoothstep(1.05, 1.5, molten));
        // vignette and scroll fade
        float v = smoothstep(1.35, 0.25, length((vUv-0.5)*vec2(asp*0.8,1.0)));
        col *= v * (1.0 - uScroll*0.65);
        col *= smoothstep(0.0, 1.0, uIntro*1.4);
        gl_FragColor = vec4(col, 1.0);
      }`;
  }

  extras(ctx: Ctx) { this.buildEmbers(ctx); }

  buildEmbers(ctx: Ctx) {
    const n = Math.round((ctx.mobile ? 900 : 2600) * ctx.quality);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = Math.random() * 2 - 1; pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.emat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uMouse: { value: new THREE.Vector2() }, uIntro: { value: 0 } },
      vertexShader: /* glsl */ `
        uniform float uTime, uPx, uIntro; uniform vec2 uMouse; varying float vA;
        ${NOISE}
        void main(){
          float s = position.z;
          float y = fract(position.y + uTime*(0.04 + s*0.08));
          float x = position.x + snoise(vec2(s*10.0, uTime*0.3 + y*2.0))*0.08;
          vec2 m = uMouse*2.0-1.0;
          x += (x - m.x) * exp(-pow(length(vec2(x, y*2.0-1.0) - m), 2.0)*8.0) * 0.3;
          gl_Position = vec4(x, y*2.2-1.1, 0.0, 1.0);
          gl_PointSize = uPx * (1.0 + s*2.5);
          vA = sin(y*3.14159) * (0.3 + s*0.7) * uIntro;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d)*vA; gl_FragColor = vec4(vec3(0.5,1.0,0.7)*a, 1.0); }`,
    });
    this.embers = new THREE.Points(geo, this.emat);
    this.embers.frustumCulled = false;
    this.scene.add(this.embers);
  }

  setQuality(ctx: Ctx) { this.scene.remove(this.embers); this.embers.geometry.dispose(); this.emat.dispose(); this.buildEmbers(ctx); }

  beforeRender(ctx: Ctx) {
    this.trail.update(ctx.renderer, ctx);
    this.mat.uniforms.uHeat.value = this.trail.texture;
    const u = this.emat.uniforms;
    u.uTime.value = ctx.time; u.uPx.value = 1.6 * (ctx.bufW / ctx.width);
    u.uMouse.value.set(ctx.pointer.x, ctx.pointer.y); u.uIntro.value = ctx.intro;
  }

  dispose() { super.dispose(); this.trail.dispose(); }
}
