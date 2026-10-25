import * as THREE from 'three';
import { NOISE, COMMON_UNIFORMS } from '../glsl';
import type { Ctx } from '../engine';
import { ShaderScene } from './base';

const TRAIL = 40;

/**
 * Johnny Storm: "Flame On". A buoyant particle fire computed entirely in the
 * vertex shader. Most particles rise from a bed of flame along the bottom;
 * the rest spawn from the cursor's recent path, so wherever you move catches
 * fire. Scrolling flares the whole frame before it burns out.
 */
export default class Flame extends ShaderScene {
  pts!: THREE.Points; pmat!: THREE.ShaderMaterial;
  trail = new Float32Array(TRAIL * 3); head = 0; acc = 0;

  frag() {
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      ${NOISE}
      void main(){
        float asp = uRes.x/uRes.y;
        vec2 p = (vUv-0.5)*vec2(asp,1.0);
        float glow = smoothstep(0.9, 0.0, vUv.y) * (0.55 + 0.25*fbm3(vec2(p.x*3.0, uTime*0.6)));
        vec3 col = vec3(0.02,0.012,0.01) + vec3(0.7,0.2,0.05) * glow * 0.55;
        col += vec3(0.6,0.25,0.05) * smoothstep(0.35, 0.0, length(p - (uMouse-0.5)*vec2(asp,1.0))) * 0.12;
        col += vec3(1.0,0.5,0.15) * uScroll * uScroll * 0.25;
        col *= smoothstep(0.0, 1.0, uIntro*1.3);
        gl_FragColor = vec4(col, 1.0);
      }`;
  }

  extras(ctx: Ctx) { this.build(ctx); }

  build(ctx: Ctx) {
    const n = Math.round((ctx.mobile ? 6000 : 16000) * ctx.quality);
    const seed = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) seed[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(seed, 3));
    this.pmat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uAsp: { value: 1 }, uPx: { value: 1 }, uIntro: { value: 0 }, uScroll: { value: 0 },
        uTrail: { value: Array.from({ length: TRAIL }, () => new THREE.Vector3(-9, -9, 9)) },
      },
      vertexShader: /* glsl */ `
        uniform float uTime, uAsp, uPx, uIntro, uScroll;
        uniform vec3 uTrail[${TRAIL}];
        varying float vLife; varying float vHeat;
        ${NOISE}
        void main(){
          vec3 s = position;
          float rate = 0.55 + s.z*0.6;
          float life = fract(uTime*rate + s.x*7.31);
          vec2 origin; float spread;
          if (s.y < 0.32) {
            int idx = int(floor(s.y/0.32 * ${TRAIL}.0));
            vec3 tp = uTrail[idx];
            origin = tp.xy; spread = 0.03;
            life = clamp(life + tp.z*0.8, 0.0, 1.0);   // older trail points burn out sooner
          } else {
            origin = vec2((s.x*2.0-1.0)*uAsp*1.1, -1.08);
            spread = 0.06;
          }
          float rise = life * (0.5 + s.z*0.9) * (1.0 + uScroll*1.6);
          vec2 pos = origin + vec2((s.z-0.5)*spread, rise);
          float sway = snoise(vec2(pos.x*2.0 + s.x*10.0, pos.y*1.5 - uTime*1.2));
          pos.x += sway * 0.12 * life;
          pos.x += snoise(vec2(s.y*20.0, uTime*0.4)) * 0.02;
          gl_Position = vec4(pos.x/uAsp, pos.y, 0.0, 1.0);
          float size = mix(18.0, 4.0, life) * (0.6 + s.z);
          gl_PointSize = size * uPx;
          vLife = life;
          vHeat = 1.0 - life;
          if (origin.x < -8.0) gl_PointSize = 0.0;
        }`,
      fragmentShader: /* glsl */ `
        varying float vLife; varying float vHeat; uniform float uIntro;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          vec3 white = vec3(1.0,0.95,0.8), yellow = vec3(1.0,0.75,0.25), orange = vec3(1.0,0.38,0.08), red = vec3(0.55,0.08,0.03);
          vec3 c = mix(white, yellow, smoothstep(0.0,0.15,vLife));
          c = mix(c, orange, smoothstep(0.15,0.45,vLife));
          c = mix(c, red, smoothstep(0.45,0.85,vLife));
          float fade = (1.0 - smoothstep(0.6, 1.0, vLife)) * smoothstep(0.0, 0.05, vLife);
          gl_FragColor = vec4(c * a * fade * 0.42 * uIntro, 1.0);
        }`,
    });
    this.pts = new THREE.Points(geo, this.pmat);
    this.pts.frustumCulled = false;
    this.scene.add(this.pts);
  }

  setQuality(ctx: Ctx) { this.scene.remove(this.pts); this.pts.geometry.dispose(); this.pmat.dispose(); this.build(ctx); }

  beforeRender(ctx: Ctx, dt: number) {
    const asp = ctx.width / ctx.height;
    // sample the pointer path into a ring buffer; z holds age
    this.acc += dt;
    if (this.acc > 0.03) {
      this.acc = 0;
      this.trail[this.head * 3] = (ctx.pointer.x * 2 - 1) * asp;
      this.trail[this.head * 3 + 1] = ctx.pointer.y * 2 - 1;
      this.trail[this.head * 3 + 2] = 0;
      this.head = (this.head + 1) % TRAIL;
    }
    const arr = this.pmat.uniforms.uTrail.value as THREE.Vector3[];
    for (let i = 0; i < TRAIL; i++) {
      this.trail[i * 3 + 2] = Math.min(1, this.trail[i * 3 + 2] + dt * 0.8);
      arr[i].set(this.trail[i * 3], this.trail[i * 3 + 1], this.trail[i * 3 + 2]);
    }
    const u = this.pmat.uniforms;
    u.uTime.value = ctx.time; u.uAsp.value = asp; u.uPx.value = ctx.bufW / ctx.width;
    u.uIntro.value = ctx.intro; u.uScroll.value = ctx.scroll;
  }
}
