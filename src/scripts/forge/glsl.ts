/**
 * Shared GLSL for the forge: noise, cellular noise for cracks and cooling crust, a blackbody ramp for hot
 * iron, and the casting model (when each part of the title fills, and how hot it still is). The title lives in
 * a signed distance field (uSDF) over the title rectangle (uTR: x0, z0, width, depth in mould space).
 */
export const COMMON = /* glsl */ `
  uniform sampler2D uSDF; uniform vec4 uTR;
  uniform float uTime, uPour0, uPour1, uCool, uSeep0, uSeep1, uCrack, uSplit;

  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
  // four octaves of value noise, precomputed into a tiling texture (uNoise, 16 units across): one lookup
  // instead of four noise evaluations, which kept the forge at 60 fps on integrated graphics
  uniform sampler2D uNoise;
  float fbm(vec2 p){ return texture2D(uNoise, p * 0.0625).r; }
  vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
  // cellular noise: distance to the nearest cell centre, and the gap to the second (small on cell edges)
  vec2 voro(vec2 x){ vec2 n = floor(x), f = fract(x); float f1 = 8.0, f2 = 8.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){ vec2 g = vec2(float(i), float(j)); vec2 r = g + hash2(n + g) - f; float d = dot(r, r);
      if (d < f1){ f2 = f1; f1 = d; } else if (d < f2) f2 = d; }
    return vec2(sqrt(f1), sqrt(f2) - sqrt(f1)); }

  // hot iron by temperature (1 white-hot, 0 cold), linear HDR
  vec3 blackbody(float t){
    vec3 c = mix(vec3(0.0), vec3(0.55, 0.03, 0.0), smoothstep(0.02, 0.25, t));
    c = mix(c, vec3(1.0, 0.24, 0.02), smoothstep(0.2, 0.5, t));
    c = mix(c, vec3(1.0, 0.6, 0.16), smoothstep(0.45, 0.8, t));
    return mix(c, vec3(1.0, 0.9, 0.72), smoothstep(0.8, 1.0, t));
  }

  // signed distance to the title in world units (negative inside a letter); far outside the rectangle it grows
  float titleDist(vec2 xz){
    vec2 t = (xz - uTR.xy) / uTR.zw;
    float d = (texture2D(uSDF, clamp(t, 0.0, 1.0)).r - 0.5) / 8.0 * uTR.z;
    vec2 out2 = max(max(-t, t - 1.0), 0.0) * uTR.zw;
    return d + length(out2);
  }
  // when this point of the title fills: line one left to right, then line two (the crucible lifts between)
  float fillTime(vec2 xz){
    vec2 t = (xz - uTR.xy) / uTR.zw;
    float s = step(0.5, t.y) * 0.5 + clamp(t.x, 0.0, 1.0) * 0.5;
    return uPour0 + s * (uPour1 - uPour0) + (vnoise(xz * 3.0) - 0.5) * 0.1;
  }
  // how hot the cast metal is here: -1 not yet filled, 1 just poured, 0 cold
  float heat(vec2 xz){
    float tf = fillTime(xz);
    if (uTime < tf) return -1.0;
    return clamp(1.0 - (uTime - tf - 0.12) / uCool, 0.0, 1.0);
  }
  // how far the green has spread: grows out from the letters through the seep
  float seepReach(){ return clamp((uTime - uSeep0) / max(0.01, uSeep1 - uSeep0), 0.0, 1.0); }
`;

/** Light shared by every iron surface: a cool key, the furnace off to the left, the molten glow, the green. */
export const LIGHT = /* glsl */ `
  uniform mat4 modelMatrix; // three.js sets it for every material but only declares it in vertex shaders
  uniform vec3 uKeyDir, uKeyCol, uFurnPos, uFurnCol, uGlowPos, uGlowCol, uGreenPos, uGreenCol;
  uniform float uExposure;
  vec3 ironLight(vec3 P, vec3 N, vec3 V, vec3 albedo, float rough){
    vec3 col = vec3(0.0);
    float sp = mix(64.0, 10.0, rough), ks = mix(0.55, 0.12, rough);
    // key
    vec3 L = normalize(uKeyDir), H = normalize(L + V);
    col += uKeyCol * (albedo * max(dot(N, L), 0.0) + ks * pow(max(dot(N, H), 0.0), sp));
    // point lights with soft falloff
    vec3 lp[3]; vec3 lc[3]; lp[0] = uFurnPos; lc[0] = uFurnCol; lp[1] = uGlowPos; lc[1] = uGlowCol; lp[2] = uGreenPos; lc[2] = uGreenCol;
    for (int i = 0; i < 3; i++){
      vec3 d = lp[i] - P; float r2 = dot(d, d); vec3 l = d * inversesqrt(r2); vec3 h = normalize(l + V);
      float fall = 1.0 / (1.0 + r2 * 0.18);
      col += lc[i] * fall * (albedo * max(dot(N, l), 0.0) + ks * pow(max(dot(N, h), 0.0), sp));
    }
    // what polished iron reflects: a soft overhead studio gradient, and the green bouncing up from below.
    // Metal reflects strongly at grazing angles (Fresnel), less when rough; this is what makes it read solid
    vec3 R = reflect(-V, N);
    float fres = 0.5 + 0.5 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 env = mix(vec3(0.003, 0.0035, 0.004), vec3(0.06, 0.064, 0.074), smoothstep(-0.15, 0.9, R.y));
    env += uGreenCol * 0.018 * smoothstep(0.1, -0.7, R.y);
    col += env * fres * (1.0 - rough) * (1.0 - rough); // rough cast iron barely mirrors; the polished title does
    return col * uExposure;
  }
`;
