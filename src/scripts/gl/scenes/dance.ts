import { NOISE, COMMON_UNIFORMS } from '../glsl';
import type { Ctx } from '../engine';
import { ShaderScene } from './base';

/**
 * Peggy Carter: "The Dance". A mirror ball hangs at the top of a warm 1940s
 * room. For every pixel, the direction from the ball is rotated by the ball's
 * spin and snapped to the nearest facet; if the facet centre is close, a spot
 * of light lands there, so hundreds of spots sweep across the walls in one
 * pass. The cursor turns the ball; scrolling dims the house lights.
 */
export default class Dance extends ShaderScene {
  spin = 0;
  uniforms() { return { uSpin: { value: 0 } }; }
  frag() {
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      uniform float uSpin;
      ${NOISE}
      void main(){
        float asp = uRes.x/uRes.y;
        vec2 p = (vUv-0.5)*vec2(asp,1.0);
        vec2 ball = vec2(0.0, asp < 1.0 ? 0.28 : 0.42);   // lower on portrait so it clears the header
        // room: warm wall gradient and a floor glow
        vec3 col = mix(vec3(0.06,0.03,0.025), vec3(0.16,0.09,0.06), smoothstep(-0.6, 0.6, p.y));
        col += vec3(0.25,0.14,0.08) * exp(-length((p - vec2(0.0,-0.55))*vec2(0.6,2.4))*2.0) * 0.5;
        // light spots from the facets
        vec2 d = p - ball;
        float ang = atan(d.y, d.x) + uSpin;
        float r = length(d);
        vec2 grid = vec2(ang * r * 7.5, r * 7.5);                  // roughly square facets in screen space
        vec2 cell = floor(grid); vec2 f = fract(grid) - 0.5;
        float on = step(0.55, hash12(cell));                      // not every facet catches the light
        float spot = smoothstep(0.3, 0.1, length(f)) * on;
        spot *= smoothstep(0.05, 0.25, r) * smoothstep(2.0, 0.6, r);
        vec3 spotCol = mix(vec3(1.0,0.86,0.62), vec3(1.0,0.55,0.45), hash12(cell + 3.0));
        col += spotCol * spot * 0.55 * (1.0 - uScroll*0.6);
        // the ball itself
        float b = length(d);
        if (b < 0.075) {
          vec2 fg = vec2(atan(d.y, d.x) + uSpin, b) ;
          vec2 fc = fract(vec2(fg.x*6.0, fg.y*80.0)) - 0.5;
          float facet = 0.55 + 0.45*hash12(floor(vec2(fg.x*6.0, fg.y*80.0)));
          col = vec3(0.75,0.72,0.68) * facet * smoothstep(0.075, 0.06, b) + vec3(1.0)*pow(max(0.0, 1.0 - length(d - vec2(-0.02,0.02))*25.0), 3.0);
        }
        col += vec3(0.8,0.7,0.5) * smoothstep(0.003, 0.0, abs(p.x)) * step(ball.y + 0.07, p.y) * 0.25;   // the wire it hangs from
        // film grain and vignette for the period feel
        col += (hash12(vUv*uRes + fract(uTime)*91.0) - 0.5) * 0.05;
        col *= smoothstep(1.5, 0.35, length(p*vec2(0.85,1.0)));
        col *= smoothstep(0.0,1.0,uIntro*1.3) * (1.0 - uScroll*0.35);
        gl_FragColor = vec4(col, 1.0);
      }`;
  }
  beforeRender(ctx: Ctx, dt: number) {
    const speed = 0.12 + (ctx.pointer.x - 0.5) * 0.9;
    this.spin += dt * speed;
    this.mat.uniforms.uSpin.value = this.spin;
    ctx.signal = this.spin;
  }
}
