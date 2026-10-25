import { NOISE, COMMON_UNIFORMS } from '../glsl';
import type { Ctx } from '../engine';
import { ShaderScene } from './base';

/**
 * Yelena Belova: "Red Room". Volumetric light shafts. A light sits at the cursor
 * behind a wall of slatted blinds; each pixel marches toward the light and adds
 * up how much of the path passes through the open slats, so beams of red light
 * fan across the room. Dust drifts in the beams. The slats tilt over time, and
 * scrolling closes them.
 */
export default class Shafts extends ShaderScene {
  frag(ctx: Ctx) {
    const steps = ctx.mobile ? 22 : 36;
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      ${NOISE}
      float blinds(vec2 p){
        // horizontal slats whose opening depends on a slow tilt
        float tilt = 0.32 + 0.18*sin(uTime*0.35) - uScroll*0.3;
        float y = fract(p.y*9.0 + 0.15*sin(p.x*1.3 + uTime*0.2));
        float open = smoothstep(0.5 - tilt, 0.5 - tilt + 0.04, y) * smoothstep(0.5 + tilt, 0.5 + tilt - 0.04, y);
        float frame = step(abs(p.x), 0.95) * step(abs(p.y), 0.75);   // the window
        return open * frame;
      }
      void main(){
        float asp = uRes.x/uRes.y;
        vec2 p = (vUv-0.5)*vec2(asp,1.0);
        vec2 light = (uMouse-0.5)*vec2(asp,1.0) * 0.6;
        vec2 d = (light - p) / float(${steps});
        vec2 q = p;
        float acc = 0.0, w = 1.0;
        for (int i = 0; i < ${steps}; i++) {
          acc += blinds(q*1.0) * w;
          w *= 0.965;
          q += d;
        }
        acc /= float(${steps});
        float direct = blinds(p) * 0.06;
        float dist = length(p - light);
        float beams = acc * 0.85 * pow(smoothstep(1.6, 0.0, dist), 1.6);
        float dust = pow(max(0.0, snoise(p*40.0 + vec2(uTime*0.4, -uTime*0.25))), 12.0) * beams * 6.0;
        vec3 col = vec3(0.015,0.006,0.008);
        col += vec3(0.95,0.22,0.25) * beams;
        col += vec3(1.0,0.75,0.72) * dust;
        col += vec3(0.6,0.12,0.14) * direct * smoothstep(1.2, 0.0, dist);
        col += vec3(1.0,0.4,0.4) * exp(-dist*14.0) * 0.6;
        col *= smoothstep(0.0,1.0,uIntro*1.3) * (1.0 - uScroll*0.4);
        col *= smoothstep(1.5, 0.3, length(p));
        gl_FragColor = vec4(col, 1.0);
      }`;
  }
}
