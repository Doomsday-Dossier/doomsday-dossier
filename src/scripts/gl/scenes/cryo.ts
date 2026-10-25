import { NOISE, COMMON_UNIFORMS } from '../glsl';
import { Trail, type Ctx } from '../engine';
import { ShaderScene } from './base';

/**
 * Bucky Barnes: "Cold Storage". A failing monitor feed: scanlines, a rolling
 * sync bar and frost creeping in from the edges. Wherever the cursor passes, the
 * signal tears into displaced blocks with RGB split, then settles.
 */
export default class Cryo extends ShaderScene {
  trail!: Trail;
  uniforms(ctx: Ctx) {
    this.trail = new Trail(ctx.renderer, ctx.mobile ? 64 : 112, 0.94, 0.11);
    return { uGlitch: { value: this.trail.texture } };
  }
  frag() {
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      uniform sampler2D uGlitch;
      ${NOISE}
      vec3 feed(vec2 uv){
        float asp = uRes.x/uRes.y;
        vec2 p = (uv-0.5)*vec2(asp,1.0);
        // cold storage interior: vertical ribs of a chamber, dim and blue-grey
        float ribs = smoothstep(0.48, 0.5, abs(fract(p.x*6.0)-0.5)) * 0.15;
        float panel = step(0.5, fract(p.y*3.0 + 0.1*floor(p.x*6.0)));
        vec3 c = vec3(0.07,0.085,0.095) + vec3(0.03)*panel + ribs;
        // data columns: blinking procedural readouts
        vec2 cell = floor(uv*vec2(48.0, 28.0));
        float on = step(0.82, hash12(cell + floor(uTime*3.0)*vec2(0.0,1.0)*step(0.6,hash12(cell.xx))));
        float colMask = step(0.78, fract(cell.x/12.0)) * step(0.25, uv.y) * step(uv.y, 0.75);
        c += vec3(0.55,0.62,0.66) * on * colMask * 0.35;
        // rare red status light
        float pulse = pow(max(0.0, sin(uTime*1.3)), 30.0);
        c += vec3(1.0,0.15,0.15) * exp(-length(p - vec2(asp*0.38, 0.36))*60.0) * (0.3 + pulse);
        return c;
      }
      void main(){
        vec2 uv = vUv;
        float g = texture2D(uGlitch, uv).r;
        float rows = floor(uv.y*mix(20.0, 70.0, hash12(vec2(floor(uTime*12.0)))));
        float blk = step(0.55, hash12(vec2(rows, floor(uTime*20.0)))) * g;
        uv.x += (hash12(vec2(rows, floor(uTime*30.0))) - 0.5) * 0.15 * blk;
        // rolling sync bar
        float bar = smoothstep(0.0, 0.04, abs(fract(uv.y*0.5 - uTime*0.08) - 0.5) - 0.44);
        uv.x += (1.0 - bar) * 0.004 * sin(uTime*40.0);
        float split = 0.002 + g*0.02 + uScroll*0.01;
        vec3 col;
        col.r = feed(uv + vec2(split, 0.0)).r;
        col.g = feed(uv).g;
        col.b = feed(uv - vec2(split, 0.0)).b;
        // frost from the edges, computed once
        float asp = uRes.x/uRes.y;
        vec2 fp = (uv-0.5)*vec2(asp,1.0);
        float edge = min(min(uv.x, 1.0-uv.x)*asp, min(uv.y, 1.0-uv.y));
        float fn = fbm3(fp*7.0);
        float fr = smoothstep(0.32 + 0.08*fn, 0.0, edge - snoise(fp*18.0)*0.04);
        col = mix(col, vec3(0.75,0.85,0.9) * (0.6 + 0.4*fbm3(fp*30.0)), fr*0.85);
        // scanlines and noise
        col *= 0.82 + 0.18*sin(vUv.y*uRes.y*1.4);
        col += (hash12(vUv*uRes + uTime*60.0) - 0.5) * 0.06;
        col *= 0.9 + 0.1*bar;
        float vig = smoothstep(1.1, 0.3, length((vUv-0.5)*vec2(1.1,1.3)));
        col *= vig * smoothstep(0.0, 1.0, uIntro*1.3) * (1.0 - uScroll*0.6);
        // power-on flicker
        col *= step(0.15, uIntro) + step(uIntro, 0.15)*step(0.5, hash12(vec2(uTime*30.0)));
        gl_FragColor = vec4(col, 1.0);
      }`;
  }
  beforeRender(ctx: Ctx) { this.trail.update(ctx.renderer, ctx); this.mat.uniforms.uGlitch.value = this.trail.texture; }
  dispose() { super.dispose(); this.trail.dispose(); }
}
