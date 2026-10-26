/**
 * Particle figure (Particle Self): a photo sampled into a 3D point cloud. Brightness gives depth,
 * and a soft bulge around the subject makes the figure turn like a bust rather than a card.
 * Points start scattered in the dark and assemble on `uAssemble` (0..1, staggered per point);
 * `uYaw` turns the figure (scroll-driven); `uDisperse` blows it back apart into dust.
 */
import * as THREE from 'three';
import { rgb, C } from './tokens';

export type FigureOpts = {
  src: string;          // photo URL (same origin)
  cols: number;         // sample grid width; rows follow the photo's aspect
  height: number;       // world height of the figure
  depth: number;        // how far brightness pushes points toward the camera
  focus: [number, number]; // subject centre within the crop, 0..1 (x right, y down)
  crop?: [number, number, number, number]; // window of the photo to sample, 0..1: x0, y0, x1, y1
  alphaCut?: boolean;   // the source is a cut-out: sample only the subject (alpha), no backdrop to thin out
  cut?: number;         // brightness under which pixels are skipped (the dark backdrop)
};

export class Figure {
  points!: THREE.Points;
  mat!: THREE.ShaderMaterial;
  count = 0;

  async build(o: FigureOpts) {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = o.src; });
    const [x0, y0, x1, y1] = o.crop ?? [0, 0, 1, 1];
    const sw = img.naturalWidth * (x1 - x0), sh = img.naturalHeight * (y1 - y0);
    const cols = o.cols, rows = Math.round(cols * (sh / sw));
    const cv = document.createElement('canvas'); cv.width = cols; cv.height = rows;
    const g = cv.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, img.naturalWidth * x0, img.naturalHeight * y0, sw, sh, 0, 0, cols, rows);
    const px = g.getImageData(0, 0, cols, rows).data;
    const cut = o.cut ?? 0.07;
    const lums: number[] = [];
    for (let k = 0; k < px.length; k += 4) if (!o.alphaCut || px[k + 3] > 128) lums.push(0.2126 * px[k] / 255 + 0.7152 * px[k + 1] / 255 + 0.0722 * px[k + 2] / 255);
    const sorted = lums.filter((l) => l >= cut).sort((a, b) => a - b);
    const hi = Math.max(cut + 0.05, sorted[Math.floor(sorted.length * 0.97)] ?? 1);
    const pos: number[] = [], start: number[] = [], col: number[] = [], seed: number[] = [], bright: number[] = [];
    const aspect = cols / rows, H = o.height, W = H * aspect;
    const [fx, fy] = o.focus;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = (j * cols + i) * 4;
      const r = px[k] / 255, gg = px[k + 1] / 255, b = px[k + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      if (o.alphaCut ? px[k + 3] < 128 : lum < cut) continue;
      const u = i / (cols - 1), v = j / (rows - 1);
      const x = (u - fx) * W, y = -(v - fy) * H;
      // bust-like bulge around the subject plus brightness relief
      const d2 = ((u - fx) / 0.32) ** 2 + ((v - fy) / 0.42) ** 2;
      // thin out the backdrop (smoke, sky) away from the subject so the figure reads as a figure
      const keep = Math.min(1, Math.max(0, (1.75 - Math.sqrt(d2)) / 0.9));
      if (!o.alphaCut && Math.random() > keep) continue;
      const z = Math.exp(-d2) * o.depth * 0.9 + (lum - 0.25) * o.depth * 0.6;
      pos.push(x, y, z);
      // scattered start: a wide shell around the figure, deep in the dark
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1), rad = H * (1.6 + Math.random() * 2.4);
      start.push(Math.sin(ph) * Math.cos(th) * rad, Math.sin(ph) * Math.sin(th) * rad * 0.6, Math.cos(ph) * rad - H);
      // the photo's hue at a steady brightness, plus a separate 0..1 brightness stretched to the photo's range
      const n = Math.max(lum, 0.04);
      col.push(Math.min(1, r / n * 0.5), Math.min(1, gg / n * 0.5), Math.min(1, b / n * 0.5));
      const t = Math.min(1, Math.max(0, (lum - cut) / (hi - cut)));
      bright.push(t * t * (3 - 2 * t));
      seed.push(Math.random());
    }
    this.count = pos.length / 3;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aStart', new THREE.Float32BufferAttribute(start, 3));
    geo.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    geo.setAttribute('aB', new THREE.Float32BufferAttribute(bright, 1));
    const em = rgb(C.emeraldHot);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uAssemble: { value: 0 }, uDisperse: { value: 0 }, uYaw: { value: 0 }, uPitch: { value: 0 }, uTime: { value: 0 },
        uPx: { value: 1 }, uSize: { value: 2.2 }, uAlpha: { value: 1 }, uTint: { value: 0.3 }, uGain: { value: 1.25 }, uEm: { value: new THREE.Vector3(...em) },
        uMouse: { value: new THREE.Vector2(9, 9) }, uLift: { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform float uAssemble, uDisperse, uYaw, uPitch, uTime, uPx, uSize, uLift;
        uniform vec2 uMouse;
        attribute vec3 aStart; attribute vec3 aCol; attribute float aSeed; attribute float aB;
        varying vec3 vCol; varying float vA; varying float vB;
        mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
        mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
        void main(){
          // staggered arrival: brighter, central points land first
          float delay = aSeed * 0.55;
          float t = clamp((uAssemble - delay) / 0.45, 0.0, 1.0);
          t = t*t*(3.0 - 2.0*t);
          vec3 p = mix(aStart, position, t);
          // a breath of drift while assembling and in the dust state
          float drift = (1.0 - t) * 0.6 + uDisperse * 1.4 + 0.012;
          p += vec3(sin(uTime*0.7 + aSeed*40.0), cos(uTime*0.5 + aSeed*31.0), sin(uTime*0.6 + aSeed*17.0)) * drift * 0.12;
          // disperse: blow outward and toward the camera, as if the file is scattering into the archive
          p += normalize(position + vec3(0.0001, 0.0001, 1.0)) * uDisperse * (2.0 + aSeed*6.0);
          p.z += uDisperse * aSeed * 3.0;
          p = rotX(uPitch) * rotY(uYaw) * p;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          // the pointer pushes points aside a little (fine pointers)
          vec4 clip = projectionMatrix * mv;
          vec2 ndc = clip.xy / clip.w;
          vec2 dm = ndc - uMouse;
          float push = exp(-dot(dm, dm) * 30.0) * 0.06 * uLift;
          clip.xy += normalize(dm + 1e-4) * push * clip.w;
          gl_Position = clip;
          gl_PointSize = uPx * uSize * (0.75 + aB * 1.5) * (6.0 / -mv.z);
          vCol = aCol; vB = aB; vA = (0.35 + 0.65*t) * (1.0 - uDisperse*0.85);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAlpha, uTint, uGain; uniform vec3 uEm;
        varying vec3 vCol; varying float vA; varying float vB;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d) * vA * uAlpha;
          float b = 0.12 + vB * 0.95;
          vec3 c = mix(vCol, uEm * 0.6, uTint) * b * uGain;
          gl_FragColor = vec4(c * a, 1.0);
        }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    return this;
  }

  dispose() { this.points.geometry.dispose(); this.mat.dispose(); }
}
