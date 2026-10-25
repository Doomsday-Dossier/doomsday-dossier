import { NOISE, COMMON_UNIFORMS } from '../glsl';

import { ShaderScene } from './base';

/**
 * Joaquin Torres: "Drone Sweep". A top-down drone feed. A radar arm sweeps the
 * frame and leaves glowing topographic contour lines behind it that fade until
 * the next pass. The cursor is a targeting reticle that resolves the terrain
 * under it in sharper detail.
 */
export default class Radar extends ShaderScene {
  frag() {
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      ${NOISE}
      void main(){
        float asp = uRes.x/uRes.y;
        vec2 p = (vUv-0.5)*vec2(asp,1.0);
        vec2 ground = p*2.2 + vec2(0.0, uTime*0.025 + uScroll*0.8);
        float h = fbm(ground);
        // contour lines
        float lines = 18.0;
        float c = abs(fract(h*lines) - 0.5);
        float w = fwidth(h*lines);
        float contour = smoothstep(w*1.5, 0.0, c - 0.0);
        float major = smoothstep(w*2.0, 0.0, abs(fract(h*lines/5.0) - 0.5)*5.0 - 0.0);
        // sweep: angle behind the arm fades over one revolution
        vec2 center = vec2(0.0, -0.05);
        vec2 d = p - center;
        float a = atan(d.y, d.x);
        float arm = mod(uTime*1.2, 6.28318);
        float behind = mod(arm - a, 6.28318) / 6.28318;
        float trail = pow(1.0 - behind, 6.0);
        float beam = smoothstep(0.012, 0.0, behind) + smoothstep(0.003, 0.0, abs(behind - 0.999));
        float r = length(d);
        float rings = smoothstep(0.004, 0.0, abs(fract(r*5.0) - 0.5) - 0.495) * 0.25;
        // reticle zone resolves detail
        vec2 m = (uMouse-0.5)*vec2(asp,1.0);
        float lm = length(p - m);
        float focus = smoothstep(0.22, 0.12, lm);
        float hiDetail = abs(fract(fbm(ground*2.0)*30.0) - 0.5);
        float fine = smoothstep(fwidth(fbm(ground*2.0)*30.0)*1.5, 0.0, hiDetail) * focus;
        vec3 orange = vec3(1.0,0.54,0.24); vec3 teal = vec3(0.24,0.88,0.82);
        vec3 col = vec3(0.02,0.022,0.03);
        col += teal * contour * (0.06 + trail*0.55);
        col += teal * major * (0.05 + trail*0.4);
        col += orange * fine * 0.7;
        col += teal * rings * 0.6;
        col += mix(teal, vec3(1.0), 0.4) * beam * 0.5 * smoothstep(1.2, 0.0, r);
        // blips: hash cells lit only just behind the arm
        vec2 cell = floor(ground*6.0);
        float blip = step(0.965, hash12(cell));
        vec2 bc = (cell + 0.5)/6.0;
        float bd = length(ground - bc);
        col += orange * blip * smoothstep(0.05, 0.0, bd) * trail * 2.0;
        col += orange * smoothstep(0.004, 0.0, abs(lm - 0.2)) * 0.6; // reticle ring
        col *= smoothstep(0.0, 1.0, uIntro*1.3) * (1.0 - uScroll*0.5);
        col *= smoothstep(1.4, 0.4, length(p));
        gl_FragColor = vec4(col, 1.0);
      }`;
  }
}

