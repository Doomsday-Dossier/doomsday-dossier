import * as THREE from 'three';
import { NOISE, COMMON_UNIFORMS } from '../glsl';
import type { Ctx } from '../engine';
import { ShaderScene } from './base';

const BLOBS = 12;

/**
 * Bob Reynolds: "Sun and Void". A radiant golden core throws rays outward while
 * blobs of absolute darkness drift in from the edges. The darkness is a field
 * of signed-distance metaballs joined with a smooth union, so the blobs merge
 * and pull apart like ink. The cursor is light: it pushes the darkness back.
 * Scrolling lets the void win.
 */
export default class SunVoid extends ShaderScene {
  blobs = Array.from({ length: BLOBS }, (_, i) => {
    const a = (i / BLOBS) * Math.PI * 2;
    return { x: Math.cos(a) * 1.6, y: Math.sin(a) * 1.0, vx: 0, vy: 0, r: 0.16 + Math.random() * 0.14, ph: Math.random() * 6.28 };
  });
  uniforms() { return { uBlobs: { value: Array.from({ length: BLOBS }, () => new THREE.Vector4()) } }; }
  frag() {
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      uniform vec4 uBlobs[${BLOBS}];
      ${NOISE}
      float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0-h); }
      void main(){
        float asp = uRes.x/uRes.y;
        vec2 p = (vUv-0.5)*vec2(asp,1.0);
        // the sun: core glow plus noisy rays
        float r = length(p);
        float ang = atan(p.y, p.x);
        float rays = pow(max(0.0, snoise(vec2(ang*3.0, uTime*0.4))*0.5+0.5), 3.0) * smoothstep(1.4, 0.1, r);
        float core = exp(-r*6.0) + 0.5*exp(-r*2.2);
        vec3 gold = vec3(1.0,0.78,0.35);
        vec3 col = vec3(0.02,0.015,0.01) + gold * (core*1.2 + rays*0.5) * (1.0 - uScroll*0.8);
        // the void: smooth-union metaballs
        float d = 9.0;
        for (int i = 0; i < ${BLOBS}; i++) {
          vec4 b = uBlobs[i];
          d = smin(d, length(p - b.xy) - b.z, 0.25);
        }
        float voidMask = smoothstep(0.01, -0.01, d);
        float edge = smoothstep(0.05, 0.0, abs(d)) * (1.0 - voidMask);
        col = mix(col, vec3(0.0), voidMask);
        col += vec3(0.45,0.3,0.9) * edge * 0.35;                       // a faint violet rim on the dark
        col += vec3(0.08,0.04,0.12) * voidMask * (0.5+0.5*snoise(p*6.0 + uTime*0.3)) * 0.4;
        col *= smoothstep(0.0,1.0,uIntro*1.3);
        gl_FragColor = vec4(col, 1.0);
      }`;
  }
  beforeRender(ctx: Ctx, dt: number) {
    const asp = ctx.width / ctx.height;
    const mx = (ctx.pointer.x - 0.5) * asp, my = ctx.pointer.y - 0.5;
    const grow = 1 + ctx.scroll * 2.4;
    const arr = this.mat.uniforms.uBlobs.value as THREE.Vector4[];
    this.blobs.forEach((b, i) => {
      // drift toward the light at the centre, swirl, and flee the cursor
      const dx = -b.x, dy = -b.y, dist = Math.hypot(dx, dy) + 1e-3;
      let fx = (dx / dist) * 0.08 + (-dy / dist) * 0.05;
      let fy = (dy / dist) * 0.08 + (dx / dist) * 0.05;
      if (dist < 0.32 / grow) { fx -= (dx / dist) * 0.25; fy -= (dy / dist) * 0.25; } // the core holds them off
      const cx = b.x - mx, cy = b.y - my, cd = Math.hypot(cx, cy) + 1e-3;
      if (cd < 0.45) { fx += (cx / cd) * (0.45 - cd) * 3; fy += (cy / cd) * (0.45 - cd) * 3; }
      b.vx = (b.vx + fx * dt) * 0.97; b.vy = (b.vy + fy * dt) * 0.97;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.x = Math.max(-asp * 0.75, Math.min(asp * 0.75, b.x)); b.y = Math.max(-0.65, Math.min(0.65, b.y));
      const breathe = 1 + 0.12 * Math.sin(ctx.time * 0.8 + b.ph);
      arr[i].set(b.x, b.y, b.r * breathe * grow * (0.4 + 0.6 * ctx.intro), 0);
    });
    ctx.signal = ctx.scroll;
  }
}
