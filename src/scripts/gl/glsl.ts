// Shared GLSL chunks. Kept small so phones compile fast.

export const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0); m=m*m; m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0; vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float fbm(vec2 p){float v=0.0;float a=0.5;mat2 r=mat2(0.8,-0.6,0.6,0.8);for(int i=0;i<5;i++){v+=a*snoise(p);p=r*p*2.02;a*=0.5;}return v;}
float fbm3(vec2 p){float v=0.0;float a=0.5;mat2 r=mat2(0.8,-0.6,0.6,0.8);for(int i=0;i<3;i++){v+=a*snoise(p);p=r*p*2.02;a*=0.5;}return v;}
`;

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** Common uniforms every hero shader receives. */
export const COMMON_UNIFORMS = /* glsl */ `
uniform float uTime;
uniform vec2 uRes;       // drawing buffer size in px
uniform vec2 uMouse;     // 0..1, y up
uniform vec2 uMouseVel;  // smoothed velocity
uniform float uScroll;   // 0..1 progress through the hero region
uniform float uIntro;    // 0..1 entrance
uniform float uQuality;  // 0.5..1
varying vec2 vUv;
`;
