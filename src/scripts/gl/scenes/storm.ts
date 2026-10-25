import { NOISE, COMMON_UNIFORMS } from '../glsl';
import type { Ctx } from '../engine';
import { ShaderScene } from './base';

/**
 * Thor: "The Storm". Layered clouds drift with parallax. Lightning strikes from
 * the top of the frame toward the cursor at irregular intervals, branching and
 * lighting the clouds from inside.
 */
export default class Storm extends ShaderScene {
  flash = 0; next = 1.2; seed = 0; strikeX = 0.5;
  uniforms() { return { uFlash: { value: 0 }, uSeed: { value: 0 }, uStrike: { value: 0.5 } }; }
  frag() {
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      uniform float uFlash; uniform float uSeed; uniform float uStrike;
      ${NOISE}
      float bolt(vec2 p, vec2 a, vec2 b, float seed, float w){
        float t = clamp((p.y - a.y)/(b.y - a.y), 0.0, 1.0);
        float x = mix(a.x, b.x, t);
        x += fbm3(vec2(t*6.0, seed))*0.09*(1.0-t*0.3) + snoise(vec2(t*40.0, seed*3.0))*0.008;
        float inside = step(min(a.y,b.y), p.y) * step(p.y, max(a.y,b.y));
        float d = abs(p.x - x);
        return inside * (w/(d+w*0.6)) ;
      }
      void main(){
        float asp = uRes.x/uRes.y;
        vec2 uv = vUv;
        vec2 p = vec2(uv.x*asp, uv.y);
        float t = uTime;
        // three cloud layers with parallax against scroll
        float c1 = fbm(vec2(p.x*1.2 + t*0.03, p.y*2.0 - uScroll*0.6));
        float c2 = fbm(vec2(p.x*2.4 - t*0.05, p.y*3.2 + 4.0 - uScroll*1.0));
        float c3 = fbm3(vec2(p.x*5.0 + t*0.08, p.y*6.0 + 9.0 - uScroll*1.5));
        float clouds = smoothstep(-0.3, 0.9, c1*0.6 + c2*0.3 + c3*0.15 + (uv.y-0.35)*0.9);
        vec2 m = vec2(uMouse.x*asp, uMouse.y);
        vec2 top = vec2(uStrike*asp, 1.05);
        float b = bolt(p, top, m, uSeed, 0.0035) * uFlash;
        // branch toward a point beside the target
        vec2 mid = mix(top, m, 0.45);
        vec2 bend = mid + vec2(0.25*sin(uSeed*7.0), -0.25);
        b += bolt(p, mid, bend, uSeed+3.1, 0.0022) * uFlash * 0.7;
        // light inside the clouds near the strike
        float near = exp(-length(p - mix(top, m, 0.3))*2.2);
        vec3 base = mix(vec3(0.015,0.02,0.035), vec3(0.11,0.13,0.19), clouds);
        base += vec3(0.5,0.65,0.95) * clouds * near * uFlash * 1.3;
        base += vec3(0.25,0.35,0.6) * uFlash * 0.08;
        vec3 col = base + vec3(0.75,0.88,1.0) * clamp(b, 0.0, 3.0);
        // ambient glow at cursor
        col += vec3(0.2,0.4,0.8) * exp(-length(p-m)*9.0) * (0.15 + uFlash);
        col *= smoothstep(0.0, 1.0, uIntro*1.3) * (1.0 - uScroll*0.6);
        gl_FragColor = vec4(col, 1.0);
      }`;
  }
  beforeRender(ctx: Ctx, dt: number) {
    this.next -= dt;
    if (this.next <= 0) {
      this.flash = 1; this.seed = Math.random() * 100; this.strikeX = 0.2 + Math.random() * 0.6;
      this.next = 0.8 + Math.random() * 2.2;
      if (Math.random() < 0.3) this.next = 0.12; // double strike
    }
    // flicker decay
    this.flash *= Math.exp(-dt * 7);
    const flicker = this.flash > 0.05 ? (0.75 + 0.25 * Math.sin(ctx.time * 90)) : 1;
    const u = this.mat.uniforms;
    u.uFlash.value = ctx.reduced ? 0.6 : this.flash * flicker;
    u.uSeed.value = this.seed; u.uStrike.value = this.strikeX;
    ctx.signal = u.uFlash.value;
  }
}
