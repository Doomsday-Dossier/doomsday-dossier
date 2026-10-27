/**
 * The figure lab (CLAUDE.md, "3D figures from the photos"): each character as a 3D figure built from their own
 * photo, lit like a premium collectible in a dark studio. A slow orbit inside the angles the photo can show, a push
 * in to the face, hard rims in the character's colour, embers rising, smoke rolling over the base where the photo
 * is cropped, bloom, grain and a vignette. `?play` (window.__play) runs each in turn for recordings.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { gsap } from 'gsap';
import { loadFigure, type Figure } from '../gl/figure';
import { Sound } from '../sound/engine';
import { playSignature } from '../sound/signatures';
import { fileArrive } from '../sound/home';

type Info = { slug: string; photo: number; name: string; kicker: string; font: string; weight: number; rim: string; ember: string; storm?: boolean };
const CHARS: Info[] = [
  { slug: 'victor-von-doom', photo: 3, name: 'Victor von Doom', kicker: 'File 01 · The adversary', font: "'Cormorant Garamond Variable', serif", weight: 600, rim: '#3dff9a', ember: '#5dffa8' },
  { slug: 'steve-rogers', photo: 1, name: 'Steve Rogers', kicker: 'File 02 · Avengers', font: "'Big Shoulders Stencil Display Variable', sans-serif", weight: 800, rim: '#7fb4ff', ember: '#ffb070' },
  { slug: 'thor', photo: 1, name: 'Thor', kicker: 'File 03 · Avengers', font: "'Grenze Gotisch Variable', serif", weight: 800, rim: '#a9d4ff', ember: '#cfe6ff', storm: true },
];

const qs = new URLSearchParams(location.search);
const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
const canvas = document.querySelector<HTMLCanvasElement>('[data-stage]')!;
const ui = { back: document.querySelector<HTMLElement>('[data-backname]')!, name: document.querySelector<HTMLElement>('[data-name]')!, kicker: document.querySelector<HTMLElement>('[data-kicker]')! };

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);

// POST: bloom for the hot rims and embers, then grain, a vignette and a touch of lens fringing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.75, 0.55, 0.72);
composer.addPass(bloom);
const film = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.07 }, uVig: { value: 1.15 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVig; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5; float r = dot(c, c);
      vec3 col = vec3(texture2D(tDiffuse, vUv - c * 0.004 * r).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + c * 0.004 * r).b);
      col *= 1.0 - uVig * r;
      col += (h(vUv * 917.0 + uTime) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(film);
composer.addPass(new OutputPass());

const resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

// EMBERS: points rising and drifting, hottest when young
const EMBERS = innerWidth < 640 ? 260 : 600;
const eg = new THREE.BufferGeometry();
const ep = new Float32Array(EMBERS * 3), es = new Float32Array(EMBERS);
// gathered round the figure, thinning away from it
for (let i = 0; i < EMBERS; i++) { const r = Math.pow(Math.random(), 1.6); ep[i * 3] = (Math.random() < 0.5 ? -1 : 1) * r * 0.75; ep[i * 3 + 1] = Math.random() * 1.4; ep[i * 3 + 2] = (Math.random() - 0.5) * 0.6; es[i] = Math.random(); }
eg.setAttribute('position', new THREE.BufferAttribute(ep, 3)); eg.setAttribute('seed', new THREE.BufferAttribute(es, 1));
const emberMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color('#ffaa60') }, uPx: { value: renderer.getPixelRatio() } },
  vertexShader: `attribute float seed; uniform float uT, uPx; varying float vA;
    void main(){ vec3 p = position; float life = fract(seed + uT * (0.05 + seed * 0.06));
      p.y = mod(p.y + life * 1.6, 1.6) - 0.1; p.x += sin(uT * 0.7 + seed * 40.0 + p.y * 3.0) * 0.06; p.z += cos(uT * 0.5 + seed * 20.0) * 0.04;
      vA = smoothstep(0.0, 0.15, life) * (1.0 - life);
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (1.5 + seed * 2.5) * 2.2 / -mv.z; }`,
  fragmentShader: `uniform vec3 uC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uC * 2.4 * smoothstep(0.5, 0.0, d) * vA, 1.0); }`,
});
const embers = new THREE.Points(eg, emberMat);
scene.add(embers);

// SMOKE: soft billboards rolling low over the base, lit faintly in the character's colour
const smokeTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
  for (let i = 0; i < 40; i++) {
    const x = 128 + (Math.random() - 0.5) * 120, y = 128 + (Math.random() - 0.5) * 80, r = 30 + Math.random() * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const smoke = new THREE.Group();
for (let i = 0; i < 9; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.7), new THREE.MeshBasicMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0.2, color: 0x6a7276 }));
  m.position.set((Math.random() - 0.5) * 2.2, -0.04 + Math.random() * 0.1, -0.2 + Math.random() * 0.8);
  m.userData.v = 0.02 + Math.random() * 0.03; m.userData.s = Math.random() * 10;
  smoke.add(m);
}
scene.add(smoke);
// a soft pool of the character's light on the floor, fading to nothing (a hard disc read as a planet's horizon)
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!; const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x3dff9a, opacity: 0.12 }));
floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.y = -0.02;
scene.add(floorGlow);

const sound = Sound.get();
(window as any).__ddSound = sound;
const cache = new Map<string, Promise<Figure>>();
const get = (c: Info) => { if (!cache.has(c.slug)) cache.set(c.slug, loadFigure(base, c.slug, c.photo, c.rim)); return cache.get(c.slug)!; };

const cam = { az: -26, el: 4, dist: 2.6, fx: 0, fy: 0.55, fz: 0 };
let current: { info: Info; fig: Figure } | null = null;
let tl: gsap.core.Timeline | null = null;
let storm = 0;

async function show(info: Info) {
  const fig = await get(info);
  if (current) scene.remove(current.fig.mesh);
  tl?.kill();
  scene.add(fig.mesh);
  current = { info, fig };
  (window as any).__lab = { scene, current };
  const a = fig.meta.aspect, [x0, y0, x1, y1] = fig.meta.bbox, [hx, hy] = fig.meta.face;
  // frame the subject (not the whole photo): far enough back for its height or its width, whichever needs more
  const sx = ((x0 + x1) / 2 - 0.5) * a, sy = 1 - (y0 + y1) / 2, sh = y1 - y0, sw = (x1 - x0) * a;
  // the photo data marks the top of the head; the face is a little below it
  const head = new THREE.Vector3((hx - 0.5) * a, 1 - hy - sh * 0.07, 0.12);
  const tanH = Math.tan((camera.fov * Math.PI) / 360);
  // a tall screen frames by height and lets a wide scene (Doom's throne) run off the sides
  const fit = Math.max((sh * 1.12) / (2 * tanH), ((sw * 1.1) / (2 * tanH * camera.aspect)) * (camera.aspect < 1 ? 0.45 : 1));
  embers.position.x = sx; floorGlow.position.x = sx;
  emberMat.uniforms.uC.value.set(info.ember);
  (floorGlow.material as THREE.MeshBasicMaterial).color.set(info.rim);
  smoke.children.forEach((m) => ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(new THREE.Color(info.rim).lerp(new THREE.Color(0x5a6266), 0.8)));
  ui.back.textContent = info.name; ui.back.style.fontFamily = info.font; ui.back.style.fontWeight = String(info.weight);
  ui.name.textContent = info.name; ui.name.style.fontFamily = info.font; ui.name.style.fontWeight = String(info.weight);
  ui.kicker.textContent = info.kicker;
  if (sound.ctx.state === 'running') fileArrive(sound);
  Object.assign(cam, { az: -30, el: 6, dist: fit * 1.25, fx: sx, fy: sy + sh * 0.04, fz: 0 });
  storm = info.storm ? 1 : 0;
  gsap.fromTo(fig.material.uniforms.uRim, { value: 0 }, { value: 1.6, duration: 2.4, ease: 'power2.out' });
  gsap.fromTo([ui.back, ui.name, ui.kicker], { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.4, stagger: 0.12, ease: 'expo.out' });
  tl = gsap.timeline({ defaults: { ease: 'sine.inOut' } })
    .call(() => playSignature(sound, info.slug), [], 0.5)
    // a slow orbit across the angles the photo can show, closing in
    .to(cam, { az: 18, el: 2, dist: fit * 1.02, duration: 5.2 }, 0)
    // then a push to the face, from a little below
    .to(cam, { az: 8, el: -3, dist: 0.62, fx: head.x, fy: head.y - 0.02, fz: 0.05, duration: 3.2, ease: 'power3.inOut' }, 5.0)
    .to(cam, { az: -10, dist: 0.7, duration: 2.4 }, 8.2)
    // and back out, low, heroic
    .to(cam, { az: -4, el: -6, dist: fit * 1.08, fx: sx, fy: sy, fz: 0, duration: 2.6, ease: 'power3.inOut' }, 10.2);
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  const az = (cam.az * Math.PI) / 180, el = (cam.el * Math.PI) / 180;
  const dist = cam.dist;
  camera.position.set(cam.fx + dist * Math.sin(az) * Math.cos(el), cam.fy + dist * Math.sin(el), cam.fz + dist * Math.cos(az) * Math.cos(el));
  camera.lookAt(cam.fx, cam.fy, cam.fz);
  emberMat.uniforms.uT.value = t;
  film.uniforms.uTime.value = t % 100;
  smoke.children.forEach((m) => { m.position.x += (m.userData.v as number) * 0.016; if (m.position.x > 1.4) m.position.x = -1.4; m.quaternion.copy(camera.quaternion); });
  if (current) {
    const u = current.fig.material.uniforms;
    // the key light drifts round, so the figure's form turns in the light
    u.uKey.value.set(Math.sin(t * 0.35) * 0.9 - 0.3, 0.5, 0.7);
    // Thor: lightning, a hard flicker in the rims now and then
    if (storm) { const f = Math.max(0, Math.sin(t * 13.0) * Math.sin(t * 2.3) - 0.6) * 9; u.uRim.value = 1.6 + f; bloom.strength = 0.75 + f * 0.25; }
  }
  composer.render();
});

let at = 0;
document.querySelectorAll<HTMLButtonElement>('[data-char]').forEach((b) => b.addEventListener('click', () => { sound.unlock(); at = CHARS.findIndex((c) => c.slug === b.dataset.char); show(CHARS[at]); }));
(window as any).__play = async () => {
  await sound.unlock();
  for (let i = 0; i < CHARS.length; i++) { at = i; await show(CHARS[i]); await new Promise((r) => setTimeout(r, 13200)); }
};
if (qs.has('rec')) {
  Promise.all(CHARS.map(async (c) => { const f = await get(c); scene.add(f.mesh); await renderer.compileAsync(scene, camera); scene.remove(f.mesh); })).then(() => { (window as any).__ready = true; });
} else show(CHARS[Math.max(0, CHARS.findIndex((c) => c.slug === qs.get('c')))]);
