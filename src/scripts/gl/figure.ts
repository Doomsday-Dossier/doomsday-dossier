/**
 * A 3D figure built from one of the supplied photos (scripts/figure/build.mjs; CLAUDE.md, "3D figures from the
 * photos"): a closed solid, its front the photo raised by its depth map, its back grown from the silhouette.
 * The photo already carries its own light, so the shader keeps it and only adds what a real figure under studio
 * lights would show as it turns: the side facing a moving key light lifts, a hard rim in the character's colour
 * catches the edges, and the back falls away into shadow.
 */
import * as THREE from 'three';

export type Figure = { mesh: THREE.Mesh; material: THREE.ShaderMaterial; meta: { slug: string; aspect: number; texture: string; bbox: [number, number, number, number]; face: [number, number] }; dispose(): void };

async function inflate(buf: ArrayBuffer) {
  const b = new Uint8Array(buf);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf;
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

const VERT = /* glsl */ `
  varying vec2 vUv; varying vec3 vN; varying vec3 vObjN; varying vec3 vWorld;
  void main() {
    vUv = uv; vObjN = normal;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const FRAG = /* glsl */ `
  uniform sampler2D map; uniform vec3 uKey; uniform vec3 uRimA; uniform vec3 uRimB; uniform vec3 uRimColor;
  uniform float uRim; uniform float uLift; uniform float uFade;
  varying vec2 vUv; varying vec3 vN; varying vec3 vObjN; varying vec3 vWorld;
  void main() {
    vec4 tex = texture2D(map, vUv);
    if (tex.a < 0.5) discard;
    vec3 N = normalize(vN), V = normalize(cameraPosition - vWorld);
    if (!gl_FrontFacing) N = -N;
    // the photo, lifted where its surface turns to the key light and dropped where it turns away
    float key = dot(N, normalize(uKey));
    vec3 col = tex.rgb * (1.0 - uLift * 0.45 + uLift * 0.75 * max(key, 0.0));
    // hard rims at the grazing edges from two back lights, in the character's colour
    float graze = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    float rim = graze * (max(dot(N, normalize(uRimA)), 0.0) + 0.6 * max(dot(N, normalize(uRimB)), 0.0));
    col += uRimColor * rim * uRim;
    // the back of the figure (grown from the silhouette, not photographed) falls away into shadow
    float backness = smoothstep(0.15, -0.5, vObjN.z);
    col = mix(col, col * 0.05 + uRimColor * rim * uRim * 0.6, backness);
    // the figure rises out of the dark at its cut edge, low in the frame
    col *= smoothstep(0.0, uFade, vUv.y);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export async function loadFigure(base: string, slug: string, photo: number, rimColor: THREE.ColorRepresentation): Promise<Figure> {
  const raw = await inflate(await (await fetch(`${base}/figures/${slug}-${photo}.dfig`)).arrayBuffer());
  const dv = new DataView(raw), jl = dv.getUint32(4, true);
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(raw, 8, jl)));
  const b = 8 + jl, o = meta.offsets;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(raw, b + o.pos, meta.vertices * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(raw, b + o.nrm, meta.vertices * 3), 3, true));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Uint16Array(raw, b + o.uv, meta.vertices * 2), 2, true));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(raw, b + o.idx, meta.indices), 1));
  geo.computeBoundingSphere();
  const map = await new THREE.TextureLoader().loadAsync(`${base}/figures/${meta.texture}`);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
    uniforms: {
      map: { value: map }, uKey: { value: new THREE.Vector3(-0.6, 0.5, 0.7) }, uRimA: { value: new THREE.Vector3(0.9, 0.3, -0.5) }, uRimB: { value: new THREE.Vector3(-0.9, 0.2, -0.4) },
      uRimColor: { value: new THREE.Color(rimColor) }, uRim: { value: 1.6 }, uLift: { value: 0.6 }, uFade: { value: 0.12 },
    },
  });
  const mesh = new THREE.Mesh(geo, material);
  return { mesh, material, meta, dispose() { geo.dispose(); material.dispose(); map.dispose(); } };
}
