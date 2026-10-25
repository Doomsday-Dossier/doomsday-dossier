import * as THREE from 'three';
import { NOISE, COMMON_UNIFORMS } from '../glsl';
import type { Ctx } from '../engine';
import { ShaderScene } from './base';

/**
 * Sam Wilson: "Slipstream". Thousands of air streaks rush across the frame on a
 * curl-noise flow. The cursor is a wing: the air bends around it and speeds up
 * over the top. Scrolling banks the whole stream.
 */
export default class Slipstream extends ShaderScene {
  lines!: THREE.LineSegments; lmat!: THREE.ShaderMaterial;
  frag() {
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      ${NOISE}
      void main(){
        float h = vUv.y;
        vec3 sky = mix(vec3(0.02,0.04,0.07), vec3(0.08,0.16,0.26), smoothstep(0.0, 1.0, h));
        sky += vec3(0.25,0.35,0.45) * smoothstep(0.35, 0.0, abs(h - 0.42 + uScroll*0.2)) * 0.25; // horizon haze
        sky += vec3(0.03) * fbm3(vec2(vUv.x*3.0 - uTime*0.4, h*8.0));
        sky *= smoothstep(0.0, 1.0, uIntro*1.3) * (1.0 - uScroll*0.5);
        gl_FragColor = vec4(sky, 1.0);
      }`;
  }
  extras(ctx: Ctx) { this.build(ctx); }
  build(ctx: Ctx) {
    const n = Math.round((ctx.mobile ? 2200 : 6000) * ctx.quality);
    const pos = new Float32Array(n * 2 * 3);
    const seed = new Float32Array(n * 2 * 2);
    const end = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const sx = Math.random(), sy = Math.random() * 2 - 1, sp = Math.random();
      for (let k = 0; k < 2; k++) {
        const j = i * 2 + k;
        pos[j * 3] = sx; pos[j * 3 + 1] = sy; pos[j * 3 + 2] = sp;
        seed[j * 2] = Math.random(); seed[j * 2 + 1] = Math.random() < 0.035 ? 1 : 0;
        end[j] = k;
      }
      // keep both vertices of a segment on the same seed
      seed[(i * 2 + 1) * 2] = seed[i * 2 * 2]; seed[(i * 2 + 1) * 2 + 1] = seed[i * 2 * 2 + 1];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.lmat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uMouse: { value: new THREE.Vector2() }, uAsp: { value: 1 }, uScroll: { value: 0 }, uIntro: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec2 aSeed; attribute float aEnd;
        uniform float uTime, uAsp, uScroll, uIntro; uniform vec2 uMouse;
        varying float vA; varying float vRed;
        ${NOISE}
        vec2 flow(vec2 p, float t){
          float e = 0.05;
          float n1 = snoise(vec2(p.x*0.8 - t*0.3, p.y*1.2));
          float a = snoise(vec2(p.x*0.8 - t*0.3, p.y*1.2 + e));
          float b = snoise(vec2(p.x*0.8 - t*0.3 + e, p.y*1.2));
          return vec2((a-n1)/e, -(b-n1)/e) * 0.012;
        }
        void main(){
          float speed = 0.18 + position.z*0.5;
          float x = fract(position.x + uTime*speed) * 2.6 - 1.3;
          float len = 0.03 + position.z*0.14;
          x -= aEnd * len;
          vec2 p = vec2(x*uAsp, position.y);
          p += flow(p, uTime) * (1.0 + aEnd);
          // bank with scroll
          p.y += (p.x/uAsp) * uScroll * 0.6;
          // wing: deflect around cursor, lift over the top
          vec2 m = (uMouse*2.0-1.0) * vec2(uAsp,1.0);
          vec2 d = p - m; float r = length(d*vec2(0.6,1.0));
          float infl = exp(-r*r*6.0);
          p.y += sign(d.y + 1e-4) * infl * 0.22;
          p.x += infl * 0.05;
          gl_Position = vec4(p.x/uAsp, p.y, 0.0, 1.0);
          vA = (0.15 + position.z*0.6) * (1.0 - aEnd*0.9) * uIntro * (1.0 + infl*1.5);
          vRed = aSeed.y;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying float vRed;
        void main(){ vec3 c = mix(vec3(0.8,0.9,1.0), vec3(1.0,0.35,0.3), vRed); gl_FragColor = vec4(c*vA, 1.0); }`,
    });
    this.lines = new THREE.LineSegments(geo, this.lmat);
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
  }
  setQuality(ctx: Ctx) { this.scene.remove(this.lines); this.lines.geometry.dispose(); this.lmat.dispose(); this.build(ctx); }
  beforeRender(ctx: Ctx) {
    const u = this.lmat.uniforms;
    u.uTime.value = ctx.time; u.uMouse.value.set(ctx.pointer.x, ctx.pointer.y);
    u.uAsp.value = ctx.width / ctx.height; u.uScroll.value = ctx.scroll; u.uIntro.value = ctx.intro;
  }
}
