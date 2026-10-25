import * as THREE from 'three';
import { NOISE, COMMON_UNIFORMS } from '../glsl';
import type { Ctx } from '../engine';
import { ShaderScene } from './base';

/**
 * Namor: "Talokan". Deep water. Procedural caustics (an iterated, warped sine
 * pattern) dance across the frame, light shafts fall from the surface, and the
 * blue deepens toward the bottom. Bubbles rise from the cursor and plankton
 * drifts through the light. Scrolling sinks you deeper and darker.
 */
export default class Talokan extends ShaderScene {
  pts!: THREE.Points; pmat!: THREE.ShaderMaterial;
  frag() {
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      ${NOISE}
      float caustic(vec2 uv, float t){
        vec2 p = mod(uv*6.28318, 6.28318) - 250.0;
        vec2 i = p; float c = 1.0; float inten = 0.005;
        for (int n = 0; n < 4; n++) {
          float tt = t * (1.0 - (3.5 / float(n+1)));
          i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
          c += 1.0/length(vec2(p.x / (sin(i.x+tt)/inten), p.y / (cos(i.y+tt)/inten)));
        }
        c /= 4.0;
        c = 1.17 - pow(c, 1.4);
        return pow(abs(c), 8.0);
      }
      void main(){
        float asp = uRes.x/uRes.y;
        vec2 p = (vUv-0.5)*vec2(asp,1.0);
        float depth = 1.0 - vUv.y + uScroll*0.8;
        vec3 shallow = vec3(0.03,0.32,0.36), deep = vec3(0.0,0.025,0.05);
        vec3 col = mix(shallow, deep, clamp(depth*0.9, 0.0, 1.0));
        float c = caustic(vec2(p.x*0.6, p.y*0.6 + uTime*0.02), uTime*0.35);
        col += vec3(0.35,0.9,0.85) * c * (1.0 - clamp(depth, 0.0, 1.0)) * 0.55;
        // light shafts from the surface
        float shaft = 0.0;
        for (int k = 0; k < 4; k++) {
          float fk = float(k);
          float x = sin(uTime*0.07 + fk*1.7) * asp * 0.6;
          shaft += smoothstep(0.18, 0.0, abs(p.x - x - (vUv.y-1.0)*0.25*sin(fk))) * 0.18;
        }
        col += vec3(0.4,0.85,0.8) * shaft * vUv.y * (1.0 - uScroll);
        col += vec3(0.9,0.75,0.4) * exp(-length(p - (uMouse-0.5)*vec2(asp,1.0))*6.0) * 0.08;   // a warm glint of vibranium near the cursor
        col *= smoothstep(0.0,1.0,uIntro*1.3);
        gl_FragColor = vec4(col, 1.0);
      }`;
  }
  extras(ctx: Ctx) { this.build(ctx); }
  build(ctx: Ctx) {
    const n = Math.round((ctx.mobile ? 500 : 1100) * ctx.quality);
    const s = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) s[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(s, 3));
    this.pmat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uMouse: { value: new THREE.Vector2() }, uAsp: { value: 1 }, uPx: { value: 1 }, uIntro: { value: 0 } },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform vec2 uMouse; uniform float uAsp; uniform float uPx; uniform float uIntro;
        varying float vB; varying float vA;
        ${NOISE}
        void main(){
          vec3 s = position;
          vB = step(0.55, s.z);                         // bubbles vs plankton
          vec2 pos;
          if (vB > 0.5) {
            float life = fract(uTime*(0.2 + s.x*0.25) + s.y);
            vec2 m = (uMouse*2.0-1.0) * vec2(uAsp, 1.0);
            pos = m + vec2((s.y-0.5)*0.12 + sin(life*12.0 + s.x*30.0)*0.025, life*2.4);
            vA = (1.0 - life) * 0.9;
            gl_PointSize = uPx * (3.0 + s.x*7.0) * (0.6 + life);
          } else {
            pos = vec2((s.x*2.0-1.0)*uAsp, s.y*2.0-1.0) + vec2(snoise(s.xy*7.0 + uTime*0.05), snoise(s.yx*7.0 - uTime*0.04))*0.15;
            vA = 0.35;
            gl_PointSize = uPx * (1.0 + s.z*2.0);
          }
          gl_Position = vec4(pos.x/uAsp, pos.y, 0.0, 1.0);
          vA *= uIntro;
        }`,
      fragmentShader: /* glsl */ `
        varying float vB; varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float ring = smoothstep(0.5, 0.42, d) * smoothstep(0.25, 0.42, d);
          float dot_ = smoothstep(0.5, 0.0, d);
          float a = mix(dot_, ring + dot_*0.15, vB) * vA;
          gl_FragColor = vec4(vec3(0.7,1.0,0.95) * a, 1.0);
        }`,
    });
    this.pts = new THREE.Points(geo, this.pmat);
    this.pts.frustumCulled = false;
    this.scene.add(this.pts);
  }
  setQuality(ctx: Ctx) { this.scene.remove(this.pts); this.pts.geometry.dispose(); this.pmat.dispose(); this.build(ctx); }
  beforeRender(ctx: Ctx) {
    const u = this.pmat.uniforms;
    u.uTime.value = ctx.time; u.uMouse.value.set(ctx.pointer.x, ctx.pointer.y);
    u.uAsp.value = ctx.width / ctx.height; u.uPx.value = ctx.bufW / ctx.width; u.uIntro.value = ctx.intro;
  }
}
