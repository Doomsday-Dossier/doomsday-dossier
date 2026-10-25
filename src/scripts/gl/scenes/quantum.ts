import { NOISE, COMMON_UNIFORMS } from '../glsl';
import type { Ctx } from '../engine';
import { ShaderScene } from './base';

/**
 * Scott Lang: "Quantum Scale". An endless zoom through self-similar layers,
 * built in log-polar space so every ring hides a smaller world. The cursor is a
 * lens that magnifies what it touches; scrolling dives deeper, faster.
 */
export default class Quantum extends ShaderScene {
  depth = 0;
  uniforms() { return { uDepth: { value: 0 } }; }
  frag() {
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      uniform float uDepth;
      ${NOISE}
      vec3 layer(vec2 p, float z){
        float r = length(p); float a = atan(p.y, p.x);
        float lr = log(r + 1e-4) - z;
        float k = 2.2; // scale factor between layers
        float band = lr / log(k);
        float id = floor(band); float f = fract(band);
        float seg = 6.0 + mod(id, 3.0)*3.0;
        float ang = a/6.28318*seg + id*0.37 + uTime*0.05*(mod(id,2.0)*2.0-1.0);
        float cellA = fract(ang);
        // hex-ish cells and ring edges
        float ring = smoothstep(0.06, 0.0, abs(f - 0.5) - 0.42);
        float spoke = smoothstep(0.05, 0.0, abs(cellA - 0.5) - 0.44) * smoothstep(0.1, 0.4, f) * smoothstep(0.9, 0.6, f);
        float dots = smoothstep(0.12, 0.0, length(vec2(cellA-0.5, f-0.5)*vec2(1.0,1.6)) - 0.05);
        float h = hash12(vec2(id, floor(ang)));
        vec3 c1 = vec3(1.0,0.31,0.85); vec3 c2 = vec3(0.49,0.42,1.0);
        vec3 col = mix(c1, c2, h);
        float e = ring*0.55 + spoke*0.12 + dots*h*0.7;
        return col * e;
      }
      void main(){
        float asp = uRes.x/uRes.y;
        vec2 p = (vUv-0.5)*vec2(asp,1.0);
        vec2 m = (uMouse-0.5)*vec2(asp,1.0);
        // lens: magnify around the cursor with chromatic fringe
        vec2 d = p - m; float l = length(d);
        float lens = smoothstep(0.28, 0.0, l);
        vec2 pl = m + d * mix(1.0, 0.45, lens);
        float z = uDepth;
        vec3 col;
        col.r = layer(pl*(1.0+lens*0.02), z).r;
        col.g = layer(pl, z).g;
        col.b = layer(pl*(1.0-lens*0.02), z).b;
        // quantum haze
        float n = fbm3(p*2.0 + vec2(uTime*0.05));
        col += vec3(0.35,0.1,0.45) * (n*0.5+0.5) * 0.07;
        col *= (smoothstep(0.0, 0.25, length(p)) * 0.8 + 0.2) * smoothstep(1.3, 0.2, length(p)) * 0.8;
        col += vec3(1.0,0.6,0.95) * smoothstep(0.29, 0.27, l) * smoothstep(0.25, 0.28, l) * 0.6; // lens rim
        col *= smoothstep(0.0, 1.0, uIntro*1.3) * (1.0 - uScroll*0.5);
        gl_FragColor = vec4(col, 1.0);
      }`;
  }
  beforeRender(ctx: Ctx, dt: number) {
    this.depth += dt * (0.18 + ctx.scroll * 1.6);
    this.mat.uniforms.uDepth.value = ctx.reduced ? 0.4 : this.depth;
  }
}
