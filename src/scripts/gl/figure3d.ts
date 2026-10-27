/**
 * A character's 3D action figure (CLAUDE.md, "3D action figures"): a full 3D model generated from their photo
 * (scripts/figure3d), painted from that same photo. The photo is projected straight onto every surface facing the
 * front; as a surface turns to the side and back it takes the photo's colour at that spot, blurred and spread (so
 * colours wrap round the body without front details such as a chest emblem appearing on the back), and where the
 * photo reaches nothing, the figure's own colour at that height.
 */
import * as THREE from 'three';

export type Figure3D = { mesh: THREE.Mesh; meta: { slug: string; bbox: [number, number, number, number]; min: number[]; max: number[] }; dispose(): void };

async function inflate(buf: ArrayBuffer) {
  const b = new Uint8Array(buf);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf;
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

export async function loadFigure3D(base: string, slug: string, opts: { metal?: number; rough?: number } = {}): Promise<Figure3D> {
  const loader = new THREE.TextureLoader();
  const [raw, paint, wrap] = await Promise.all([
    fetch(`${base}/figures3d/${slug}.d3f`).then((r) => r.arrayBuffer()).then(inflate),
    loader.loadAsync(`${base}/figures3d/${slug}-paint.webp`),
    loader.loadAsync(`${base}/figures3d/${slug}-wrap.webp`),
  ]);
  const dv = new DataView(raw), jl = dv.getUint32(4, true);
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(raw, 8, jl)));
  const b = 8 + jl, o = meta.offsets, V = meta.vertices;
  const q = new Int16Array(raw, b + o.pos, V * 3), pos = new Float32Array(V * 3);
  for (let i = 0; i < V * 3; i++) { const c = i % 3; pos[i] = meta.min[c] + ((q[i] + 32767) / 65534) * (meta.max[c] - meta.min[c]); }
  const nn = new Int8Array(raw, b + o.nrm, V * 4), nrm = new Float32Array(V * 3);
  for (let i = 0; i < V; i++) for (let c = 0; c < 3; c++) nrm[i * 3 + c] = nn[i * 4 + c] / 127;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setIndex(new THREE.BufferAttribute(meta.big ? new Uint32Array(raw, b + o.idx, meta.indices) : new Uint16Array(raw, b + o.idx, meta.indices), 1));
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  for (const t of [paint, wrap]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
  const bands = new THREE.DataTexture(new Uint8Array(meta.bands.flatMap((c: number[]) => [...c, 255])), 1, meta.bands.length);
  bands.colorSpace = THREE.SRGBColorSpace; bands.magFilter = THREE.LinearFilter; bands.needsUpdate = true;
  const bb = geo.boundingBox!;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: opts.metal ?? 0.3, roughness: opts.rough ?? 0.52 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uPaint: { value: paint }, uWrap: { value: wrap }, uBands: { value: bands },
      uMin: { value: new THREE.Vector2(bb.min.x, bb.min.y) }, uMax: { value: new THREE.Vector2(bb.max.x, bb.max.y) }, uBox: { value: new THREE.Vector4(...meta.bbox) },
    });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vObjP; varying vec3 vObjN;`).replace('#include <begin_vertex>', `#include <begin_vertex>
vObjP = position; vObjN = normal;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D uPaint, uWrap, uBands; uniform vec2 uMin, uMax; uniform vec4 uBox; varying vec3 vObjP; varying vec3 vObjN;`)
      .replace('#include <map_fragment>', `
        // where this point falls in the photo, seen straight from the front
        vec2 q = (vObjP.xy - uMin) / (uMax - uMin);
        vec2 puv = vec2(mix(uBox.x, uBox.z, q.x), 1.0 - mix(uBox.y, uBox.w, 1.0 - q.y));
        vec4 photo = texture2D(uPaint, puv);
        vec3 wrapC = texture2D(uWrap, puv).rgb;
        vec3 band = texture2D(uBands, vec2(0.5, 1.0 - q.y)).rgb;
        float facing = normalize(vObjN).z;
        // the sharp photo on what faces the front; its spread colour round the sides and back
        vec3 around = mix(band, wrapC, 0.8);
        float w = smoothstep(0.0, 0.55, facing) * photo.a;
        vec3 col = mix(around, photo.rgb, w);
        // the back a touch darker, as a painted figure's back is in its own shade
        col *= mix(0.78, 1.0, smoothstep(-0.6, 0.2, facing));
        diffuseColor.rgb *= col;`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, meta, dispose() { geo.dispose(); mat.dispose(); paint.dispose(); wrap.dispose(); bands.dispose(); } };
}
