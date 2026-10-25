import { NOISE, COMMON_UNIFORMS } from '../glsl';
import { Trail, type Ctx } from '../engine';
import { ShaderScene } from './base';

/**
 * Steve Rogers: "The Ice". A sheet of frost made of Voronoi crystals. The cursor
 * thaws it to a warm, grainy 1940s glow underneath, and the frost slowly creeps
 * back. Scrolling shatters the sheet cell by cell.
 */
export default class Ice extends ShaderScene {
  trail!: Trail;
  uniforms(ctx: Ctx) {
    this.trail = new Trail(ctx.renderer, ctx.mobile ? 96 : 160, 0.993, 0.075);
    return { uThaw: { value: this.trail.texture } };
  }
  frag() {
    return /* glsl */ `
      ${COMMON_UNIFORMS}
      uniform sampler2D uThaw;
      ${NOISE}
      // returns (F1 distance, edge distance, cell id hash)
      vec3 voronoi(vec2 x){
        vec2 n = floor(x), f = fract(x); vec2 mg, mr; float md = 8.0; vec2 id;
        for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
          vec2 g = vec2(float(i),float(j)); vec2 o = hash22(n+g);
          vec2 r = g + o - f; float d = dot(r,r);
          if(d<md){ md=d; mr=r; mg=g; id=n+g; }
        }
        md = 8.0;
        for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
          vec2 g = mg + vec2(float(i),float(j)); vec2 o = hash22(n+g);
          vec2 r = g + o - f;
          if(dot(mr-r,mr-r)>0.00001) md = min(md, dot(0.5*(mr+r), normalize(r-mr)));
        }
        return vec3(length(mr), md, hash12(id));
      }
      void main(){
        float asp = uRes.x/uRes.y;
        vec2 p = (vUv-0.5)*vec2(asp,1.0);
        // warm layer beneath: amber film glow with grain and light leaks
        float g = hash12(vUv*uRes + fract(uTime)*100.0);
        vec3 warm = mix(vec3(0.09,0.06,0.04), vec3(0.95,0.82,0.6), smoothstep(1.2, -0.2, length(p - vec2(0.25,-0.1))));
        warm *= 0.55 + 0.25*fbm3(p*2.0 + uTime*0.05);
        warm += (g-0.5)*0.08;
        // frost sheet
        vec2 vp = p*5.0;
        vec3 v = voronoi(vp);
        vec3 v2 = voronoi(vp*3.1 + 7.0);
        float shatter = uScroll*1.25;
        float gone = step(v.z, shatter - 0.15);
        float edge = smoothstep(0.05, 0.0, v.y);
        float fine = smoothstep(0.04, 0.0, v2.y) * 0.35;
        float crystal = fbm(p*9.0 + v.z*10.0)*0.5+0.5;
        vec3 frost = vec3(0.62,0.78,0.9) * (0.35 + 0.35*crystal) + vec3(0.85,0.95,1.0)*(edge*0.6 + fine);
        frost = mix(frost, vec3(0.05,0.08,0.13), 0.35 + 0.25*v.x);
        float thaw = clamp(texture2D(uThaw, vUv).r * 1.4, 0.0, 1.0);
        thaw = smoothstep(0.1, 0.9, thaw + (fbm3(p*12.0)*0.25));
        vec3 col = mix(frost, warm, thaw);
        // shattered cells fall away to the void, with a bright rim as they go
        float rim = smoothstep(0.1, 0.0, abs(v.z - (shatter - 0.15))) * (1.0-gone) * step(0.01, uScroll);
        col = mix(col, vec3(0.02,0.03,0.05), gone);
        col += vec3(0.7,0.9,1.0) * rim * 0.6;
        col *= smoothstep(0.0, 1.0, uIntro*1.3);
        col *= smoothstep(1.45, 0.3, length(p*vec2(0.8,1.0)));
        gl_FragColor = vec4(col, 1.0);
      }`;
  }
  beforeRender(ctx: Ctx) { this.trail.update(ctx.renderer, ctx); this.mat.uniforms.uThaw.value = this.trail.texture; }
  dispose() { super.dispose(); this.trail.dispose(); }
}
