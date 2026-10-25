import { NOISE, COMMON_UNIFORMS } from '../glsl';
import type { Ctx } from '../engine';
import { ShaderScene } from './base';

/**
 * Cyclops: "Optic Blast". A training-room tunnel of glowing grid panels seen
 * through a ruby filter, so the whole world is shades of red. A concussive beam
 * fires from below toward the cursor on a click or tap, and on its own every few
 * seconds; the impact throws a shockwave and a heat shimmer through the tunnel.
 */
export default class Optic extends ShaderScene {
  fire = 0; ring = 9; autoT = 1.2; wasDown = false;
  target = { x: 0.5, y: 0.5 };
  uniforms() { return { uFire: { value: 0 }, uRing: { value: 9 }, uTarget: { value: [0.5, 0.5] } }; }
  frag() {
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      uniform float uFire; uniform float uRing; uniform vec2 uTarget;
      ${NOISE}
      float seg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
      vec3 tunnel(vec2 p){
        // square tunnel: distance to the nearest wall gives depth
        float d = max(abs(p.x), abs(p.y));
        float z = 0.35 / max(d, 0.02) + uTime*0.6 + uScroll*3.0;
        vec2 wall = abs(p.x) > abs(p.y) ? vec2(p.y/abs(p.x), z) : vec2(p.x/abs(p.y), z);
        vec2 g = abs(fract(wall*vec2(4.0,1.0)) - 0.5);
        float lines = smoothstep(0.47, 0.5, max(g.x, g.y));
        float panel = step(0.82, hash12(floor(wall*vec2(4.0,1.0))));
        float fog = smoothstep(0.0, 0.6, d);
        return vec3(1.0) * (lines*0.55 + panel*0.08) * fog;
      }
      void main(){
        float asp = uRes.x/uRes.y;
        vec2 p = (vUv-0.5)*vec2(asp,1.0);
        vec2 tgt = (uTarget-0.5)*vec2(asp,1.0);
        // shockwave and heat shimmer distort the tunnel around the impact
        float r = length(p - tgt);
        float wave = smoothstep(0.06, 0.0, abs(r - uRing)) * smoothstep(1.2, 0.0, uRing);
        vec2 q = p + normalize(p - tgt + 1e-4) * wave * 0.04 + vec2(snoise(p*20.0+uTime*8.0), snoise(p*20.0-uTime*8.0)) * 0.004 * uFire;
        float lum = tunnel(q).r;
        // ruby filter: everything is a shade of red
        vec3 col = vec3(0.02,0.0,0.004) + vec3(0.85,0.08,0.12) * lum;
        // the beam: hot core, wide red glow
        vec2 src = vec2(0.0, -0.6);
        float b = seg(p, src, tgt);
        float core = smoothstep(0.012, 0.0, b) * uFire;
        float glow = exp(-b*18.0) * uFire;
        col += vec3(1.0,0.25,0.25) * glow * 0.9 + vec3(1.0,0.85,0.85) * core;
        col += vec3(1.0,0.2,0.2) * exp(-r*10.0) * uFire * 1.2;           // impact flare
        col += vec3(1.0,0.3,0.3) * wave * 0.5;
        col *= smoothstep(0.0,1.0,uIntro*1.3) * (1.0 - uScroll*0.5);
        col *= smoothstep(1.4, 0.3, length(p));
        gl_FragColor = vec4(col, 1.0);
      }`;
  }
  beforeRender(ctx: Ctx, dt: number) {
    const down = ctx.pointer.down;
    this.autoT -= dt;
    const shoot = (down && !this.wasDown) || (this.autoT <= 0 && !ctx.reduced);
    this.wasDown = down;
    if (shoot) { this.fire = 1; this.ring = 0; this.target = { x: ctx.pointer.x, y: ctx.pointer.y }; this.autoT = 3.5 + Math.random() * 2; }
    this.fire *= Math.exp(-dt * 3.2);
    this.ring += dt * 1.4;
    const u = this.mat.uniforms;
    u.uFire.value = ctx.reduced ? 0.8 : this.fire * (0.85 + 0.15 * Math.sin(ctx.time * 60));
    u.uRing.value = this.ring;
    u.uTarget.value = ctx.reduced ? [0.62, 0.55] : [this.target.x, this.target.y];
    ctx.signal = this.fire;
  }
}
