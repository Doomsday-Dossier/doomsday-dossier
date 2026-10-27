/**
 * Loads a character built by scripts/sculpt (CLAUDE.md, "3D characters"): a gzipped `.ddm` file of parts (the
 * body, and props such as Doom's mask, Steve Rogers's shield, Mjolnir), each a mesh with its materials and the
 * ambient occlusion baked into every vertex. The occlusion goes into three.js's own lighting (indirect light, and
 * part of the direct), so creases stay deep under any light without an occlusion pass at run time.
 */
import * as THREE from 'three';

export type ModelMaterial = { name: string; color: [number, number, number]; metal?: number; rough?: number; clearcoat?: number; sheen?: number; glow?: number };
export type ModelPart = { name: string; mesh: THREE.Mesh; pivot: THREE.Vector3 | null };
export type Model = { meta: { slug: string; style: string; materials: ModelMaterial[]; focus: number[]; face: number[]; frame: number; look: Record<string, unknown> }; parts: ModelPart[]; group: THREE.Group; dispose(): void };

async function inflate(buf: ArrayBuffer) {
  const b = new Uint8Array(buf);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf;
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

/** One physically based material per sculpt material, with the baked occlusion wired in. */
export function makeMaterial(m: ModelMaterial, envIntensity = 1) {
  const color = new THREE.Color().setRGB(m.color[0], m.color[1], m.color[2], THREE.LinearSRGBColorSpace);
  const mat = new THREE.MeshPhysicalMaterial({
    color, metalness: m.metal ?? 0, roughness: m.rough ?? 0.5, clearcoat: m.clearcoat ?? 0, clearcoatRoughness: 0.25,
    // cloth catches the rim lights at grazing angles, as velvet and wool do, rather than lighting up all over
    sheen: (m.sheen ?? 0) * 0.6, sheenColor: color.clone().lerp(new THREE.Color(1, 1, 1), 0.1).multiplyScalar(1.6), sheenRoughness: 0.35,
    // cloth and thin shells are seen from both sides where a fold turns over
    side: (m.rough ?? 0.5) > 0.7 ? THREE.DoubleSide : THREE.FrontSide,
    emissive: m.glow ? color.clone().multiplyScalar(m.glow) : new THREE.Color(0, 0, 0), envMapIntensity: envIntensity,
  });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float ao;\nvarying float vAO;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAO = ao;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAO;')
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        float bakedAO = vAO * vAO;
        reflectedLight.indirectDiffuse *= bakedAO;
        reflectedLight.indirectSpecular *= mix(1.0, bakedAO, 0.8);
        reflectedLight.directDiffuse *= mix(1.0, vAO, 0.55);
        reflectedLight.directSpecular *= mix(1.0, vAO, 0.4);`);
  };
  mat.name = m.name;
  return mat;
}

export async function loadModel(url: string, envIntensity = 1): Promise<Model> {
  const raw = await inflate(await (await fetch(url)).arrayBuffer());
  const dv = new DataView(raw);
  const jsonLen = dv.getUint32(4, true);
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(raw, 8, jsonLen)));
  const base = 8 + jsonLen;
  const materials = (meta.materials as ModelMaterial[]).map((m) => makeMaterial(m, envIntensity));
  const group = new THREE.Group();
  const parts: ModelPart[] = [];
  for (const p of meta.parts) {
    const V = p.vertices as number;
    const q = new Int16Array(raw, base + p.pos, V * 3), na = new Int8Array(raw, base + p.nrm, V * 4), mt = new Uint8Array(raw, base + p.mat, V);
    const idx = p.big ? new Uint32Array(raw, base + p.idx, p.indices) : new Uint16Array(raw, base + p.idx, p.indices);
    const pos = new Float32Array(V * 3), nrm = new Float32Array(V * 3), ao = new Float32Array(V);
    for (let i = 0; i < V; i++) {
      for (let c = 0; c < 3; c++) { pos[i * 3 + c] = p.min[c] + ((q[i * 3 + c] + 32767) / 65534) * (p.max[c] - p.min[c]); nrm[i * 3 + c] = na[i * 4 + c] / 127; }
      ao[i] = (na[i * 4 + 3] + 128) / 255;
    }
    // triangles grouped by material (a triangle takes the material most of its corners have)
    const T = p.indices / 3, byMat = new Map<number, number[]>();
    for (let t = 0; t < T; t++) {
      const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
      const m = mt[b] === mt[c] ? mt[b] : mt[a];
      let list = byMat.get(m); if (!list) byMat.set(m, (list = [])); list.push(a, b, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('ao', new THREE.BufferAttribute(ao, 1));
    // curvature, when baked: sharp edges positive, creases negative (relic materials wear and dirty by it)
    if (p.cur !== null && p.cur !== undefined) { const cv = new Int8Array(raw, base + p.cur, V), cf = new Float32Array(V); for (let i = 0; i < V; i++) cf[i] = cv[i] / 127; geo.setAttribute('curv', new THREE.BufferAttribute(cf, 1)); }
    const all: number[] = [];
    for (const [m, list] of [...byMat.entries()].sort((x, y) => x[0] - y[0])) { geo.addGroup(all.length, list.length, m); for (const v of list) all.push(v); }
    geo.setIndex(V > 65535 ? new THREE.Uint32BufferAttribute(all, 1) : new THREE.Uint16BufferAttribute(all, 1));
    geo.computeBoundingSphere();
    const pivot = p.pivot ? new THREE.Vector3(...(p.pivot as [number, number, number])) : null;
    // props hang from their pivot, so they can turn and lift about it
    if (pivot) geo.translate(-pivot.x, -pivot.y, -pivot.z);
    const mesh = new THREE.Mesh(geo, materials);
    if (pivot) mesh.position.copy(pivot);
    mesh.name = p.name;
    group.add(mesh);
    parts.push({ name: p.name, mesh, pivot });
  }
  return {
    meta, parts, group,
    dispose() { for (const p of parts) p.mesh.geometry.dispose(); materials.forEach((m) => m.dispose()); },
  };
}
