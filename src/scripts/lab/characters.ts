/**
 * The 3D character prototypes (CLAUDE.md, "3D characters"): Doom, Steve Rogers and Thor, built by
 * scripts/sculpt, shown two ways for the visitor to choose between.
 * - Studio (the statue, after Quantum Human): the bust on black under a warm key and two cool rims, the name huge
 *   and faint behind it; a slow orbit, a macro push to the face, the prop moving (Doom's mask lifts away to show
 *   only shadow, the shield swings round, Mjolnir rises and turns), thin-line callouts naming each, with sources.
 * - Field (the collectible, after Lena Varga): the figure floats on a field of its own colour with a soft contact
 *   shadow, turning gently; its name types in, large, bottom left; the next figure flies in as the colour wipes.
 * `?play` runs each character in turn (for recordings); otherwise the buttons choose.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { loadModel, type Model } from '../gl/model';
import { Sound } from '../sound/engine';
import { playSignature } from '../sound/signatures';
import { fileArrive } from '../sound/home';

type Style = 'statue' | 'collectible';
type Info = { slug: string; name: string; font: string; weight: number; field: string; notes: { at: 'face' | 'prop' | 'chest'; k: string; t: string; src: string }[] };

const CHARS: Info[] = [
  { slug: 'victor-von-doom', name: 'Victor von Doom', font: "'Cormorant Garamond Variable', serif", weight: 600, field: '#0f5230', notes: [
    { at: 'face', k: 'The mask', t: 'Forged by the monks who trained him, and put on before it had cooled.', src: 'Fantastic Four Annual #2, 1964' },
    { at: 'prop', k: 'Beneath it', t: 'Never shown. What the mask hides is his own business.', src: 'Fantastic Four Annual #2, 1964' },
    { at: 'chest', k: 'Hood, tunic and cloak', t: 'Green over iron since his first appearance.', src: 'Fantastic Four #5, 1962' },
  ] },
  { slug: 'steve-rogers', name: 'Steve Rogers', font: "'Big Shoulders Stencil Display Variable', sans-serif", weight: 800, field: '#173b8c', notes: [
    { at: 'face', k: 'The cowl', t: 'The A, and the wings at the temples.', src: 'Captain America Comics #1, 1941' },
    { at: 'prop', k: 'The shield', t: 'Concentric rings round a star; the round shield replaced the first, badge-shaped one.', src: 'Captain America Comics #2, 1941' },
    { at: 'chest', k: 'The star', t: 'Centre of the chest, stripes below it.', src: 'Captain America Comics #1, 1941' },
  ] },
  { slug: 'thor', name: 'Thor', font: "'Grenze Gotisch Variable', serif", weight: 800, field: '#1d3557', notes: [
    { at: 'face', k: 'The winged helmet', t: 'Steel, with swept wings at each side.', src: 'Journey into Mystery #83, 1962' },
    { at: 'prop', k: 'Mjolnir', t: 'Whosoever holds this hammer, if he be worthy, shall possess the power of Thor.', src: 'Journey into Mystery #83, 1962' },
    { at: 'chest', k: 'The six discs', t: 'Down the chest of his armour, under a red cape.', src: 'Journey into Mystery #83, 1962' },
  ] },
];

const qs = new URLSearchParams(location.search);
let style: Style = qs.get('s') === 'collectible' ? 'collectible' : 'statue';
const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

const canvas = document.querySelector<HTMLCanvasElement>('[data-stage]')!;
const ui = { name: document.querySelector<HTMLElement>('[data-name]')!, back: document.querySelector<HTMLElement>('[data-backname]')!, notes: document.querySelector<HTMLElement>('[data-notes]')!, wipe: document.querySelector<HTMLElement>('[data-wipe]')!, shadow: document.querySelector<HTMLElement>('[data-shadow]')! };

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 20);
const key = new THREE.DirectionalLight(0xfff1e0, 2.4), rimA = new THREE.DirectionalLight(0xbfd5ff, 4), rimB = new THREE.DirectionalLight(0xbfd5ff, 2.4), fill = new THREE.HemisphereLight(0xffffff, 0x222222, 0.25);
scene.add(key, rimA, rimB, fill, key.target, rimA.target, rimB.target);

const resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

const sound = Sound.get();
(window as any).__ddSound = sound;
const cache = new Map<string, Promise<Model>>();
const get = (slug: string, s: Style) => { const k = `${slug}-${s}`; if (!cache.has(k)) cache.set(k, loadModel(`${base}/models/${k}.ddm`, s === 'statue' ? 0.12 : 0.7)); return cache.get(k)!; };

let current: { info: Info; model: Model; root: THREE.Group } | null = null;
let tl: gsap.core.Timeline | null = null;
const cam = { az: -30, el: 6, dist: 1.6, fx: 0, fy: 1.43, fz: 0 }; // the camera, orbiting its focus point
const fig = { bob: 1, turn: 0, y: 0 };

function lightsFor(s: Style, focus: THREE.Vector3, rim: number[]) {
  const at = (l: THREE.DirectionalLight, x: number, y: number, z: number) => { l.position.set(focus.x + x, focus.y + y, focus.z + z); l.target.position.copy(focus); };
  const rc = new THREE.Color().setRGB(rim[0], rim[1], rim[2]);
  if (s === 'statue') {
    at(key, -1.1, 1.0, 1.4); key.intensity = 1.5;
    at(rimA, 1.3, 0.8, -1.5); rimA.intensity = 3.2; rimA.color.copy(rc);
    at(rimB, -1.4, 0.4, -1.4); rimB.intensity = 2.0; rimB.color.copy(rc);
    fill.intensity = 0.04;
  } else {
    at(key, -0.9, 1.2, 1.3); key.intensity = 2.0;
    at(rimA, 1.2, 0.8, -1.2); rimA.intensity = 2.2; rimA.color.set(0xffffff);
    at(rimB, -1.2, 0.4, -1.0); rimB.intensity = 1.0; rimB.color.set(0xffffff);
    fill.intensity = 0.9;
  }
}

/** A callout: a thin line from a point on the model to its label. */
function callout(note: Info['notes'][number], anchor: THREE.Vector3, side: 1 | -1) {
  const el = document.createElement('div');
  el.className = `note ${side > 0 ? 'r' : 'l'}`;
  el.innerHTML = `<i class="dot"></i><svg class="line"><line /></svg><div class="txt"><b>${note.k}</b><span>${note.t}</span><em>${note.src}</em></div>`;
  ui.notes.append(el);
  const line = el.querySelector('line')!, txt = el.querySelector<HTMLElement>('.txt')!, dot = el.querySelector<HTMLElement>('.dot')!;
  const v = new THREE.Vector3();
  const place = () => {
    v.copy(anchor).project(camera);
    const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
    // on a phone the label sits low, clear of the figure, with its line reaching up to the point
    const narrow = innerWidth < 640;
    const tx = narrow ? 16 : side > 0 ? Math.min(innerWidth - 300, x + innerWidth * 0.16) : Math.max(24, x - innerWidth * 0.16 - 260);
    const ty = narrow ? innerHeight * 0.74 : y - innerHeight * 0.08;
    dot.style.transform = `translate(${x}px, ${y}px)`;
    txt.style.transform = `translate(${tx}px, ${ty}px)`;
    const lx = narrow ? Math.min(x, innerWidth - 40) : side > 0 ? tx : tx + 260;
    line.setAttribute('x1', String(x)); line.setAttribute('y1', String(y)); line.setAttribute('x2', String(lx)); line.setAttribute('y2', String(narrow ? ty - 8 : ty + 10));
  };
  return { el, place };
}
let notes: ReturnType<typeof callout>[] = [];

const compiled = new Set<Model>();
async function show(info: Info) {
  const model = await get(info.slug, style);
  const prev = current;
  const root = new THREE.Group(); root.add(model.group);
  // compile its shaders off the main thread before its first frame (KHR_parallel_shader_compile), so the
  // arrival never stalls on them
  if (!compiled.has(model)) { await renderer.compileAsync(root, camera, scene); compiled.add(model); }
  const m = model.meta, focus = new THREE.Vector3(...(m.focus as [number, number, number])), face = new THREE.Vector3(...(m.face as [number, number, number]));
  lightsFor(style, focus, (m.look.rimColor as number[]) ?? [0.75, 0.85, 1]);
  tl?.kill(); notes.forEach((n) => n.el.remove()); notes = [];
  const prop = model.parts.find((p) => p.pivot);
  document.body.dataset.style = style;
  ui.back.textContent = info.name.toUpperCase();
  ui.back.style.fontFamily = info.font; ui.back.style.fontWeight = String(info.weight);
  ui.name.style.fontFamily = info.font; ui.name.style.fontWeight = String(info.weight);
  if (sound.ctx.state === 'running') fileArrive(sound);

  if (style === 'statue') {
    if (prev) scene.remove(prev.root);
    scene.add(root);
    document.body.style.background = '#050606';
    Object.assign(cam, { az: -38, el: 8, dist: 1.75, fx: focus.x, fy: focus.y, fz: focus.z });
    gsap.fromTo(ui.back, { opacity: 0, letterSpacing: '0.2em' }, { opacity: 1, letterSpacing: '0.02em', duration: 2.4, ease: 'expo.out' });
    gsap.fromTo(root.scale, { x: 0.96, y: 0.96, z: 0.96 }, { x: 1, y: 1, z: 1, duration: 2, ease: 'expo.out' });
    const anchors = {
      face: face.clone().add(new THREE.Vector3(0.05, 0.03, 0.08)),
      chest: focus.clone().add(new THREE.Vector3(-0.08, -0.06, 0.1)),
      prop: prop ? prop.mesh.position.clone() : face.clone(),
    };
    notes = info.notes.map((n, i) => callout(n, anchors[n.at], i % 2 ? -1 : 1));
    notes.forEach((n) => gsap.set(n.el, { opacity: 0 }));
    const propMove = prop ? (info.slug === 'victor-von-doom'
      ? { position: { z: prop.mesh.position.z + 0.16, y: prop.mesh.position.y + 0.01 }, rotation: { x: -0.1, y: 0.18 } }
      : info.slug === 'steve-rogers'
        ? { position: { x: -0.2, z: 0.16, y: prop.mesh.position.y - 0.04 }, rotation: { y: 0.9 } }
        : { position: { y: prop.mesh.position.y + 0.12 }, rotation: { y: Math.PI * 2, z: 0.25 } }) : null;
    tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } })
      .call(() => playSignature(sound, info.slug), [], 0.4)
      .to(cam, { az: -14, el: 4, dist: 1.5, duration: 3.2, ease: 'sine.inOut' }, 0)
      .to(cam, { az: 16, el: 2, dist: 0.52, fx: face.x, fy: face.y, fz: face.z, duration: 2.6, ease: 'power3.inOut' }, 3.0)
      .to(notes[0].el, { opacity: 1, duration: 0.5 }, 4.6)
      .to(notes[0].el, { opacity: 0, duration: 0.4 }, 6.6)
      .to(cam, { az: info.slug === 'thor' ? 34 : -24, el: 4, dist: 1.05, fx: focus.x + (info.slug === 'thor' ? 0.1 : 0), fy: focus.y + 0.08, fz: focus.z, duration: 2.2 }, 6.6);
    if (prop && propMove) {
      tl.to(prop.mesh.position, { ...propMove.position, duration: 1.8, ease: 'power3.inOut' }, 7.0)
        .to(prop.mesh.rotation, { ...propMove.rotation, duration: 1.8, ease: 'power3.inOut' }, 7.0)
        .to(notes[1].el, { opacity: 1, duration: 0.5 }, 8.1)
        .to(notes[1].el, { opacity: 0, duration: 0.4 }, 10.2)
        .to(prop.mesh.position, { x: prop.pivot!.x, y: prop.pivot!.y, z: prop.pivot!.z, duration: 1.6 }, 10.4)
        .to(prop.mesh.rotation, { x: 0, y: info.slug === 'thor' ? Math.PI * 2 : 0, z: 0, duration: 1.6 }, 10.4);
    }
    tl.to(cam, { az: 0, el: 3, dist: 1.6, fx: focus.x, fy: focus.y, fz: focus.z, duration: 2.6, ease: 'power2.inOut' }, 10.4)
      .to(notes[2].el, { opacity: 1, duration: 0.5 }, 11.6)
      .to(notes[2].el, { opacity: 0, duration: 0.4 }, 13.4);
  } else {
    // THE FIELD: the colour wipes up, the old figure falls back, the new one flies in from near the camera
    ui.wipe.style.background = info.field;
    await new Promise<void>((res) => { gsap.fromTo(ui.wipe, { yPercent: 100 }, { yPercent: 0, duration: 0.7, ease: 'power3.inOut', onComplete: res }); if (prev) gsap.to(prev.root.position, { y: -0.25, z: -0.4, duration: 0.7, ease: 'power3.in' }); });
    document.body.style.background = info.field;
    gsap.set(ui.wipe, { yPercent: 100 });
    if (prev) scene.remove(prev.root);
    scene.add(root);
    // the figure a little right of centre, whole, its name bottom left (Lena Varga)
    Object.assign(cam, { az: 22, el: 7, dist: 1.85, fx: focus.x - (innerWidth < 640 ? 0 : 0.08), fy: focus.y + 0.01, fz: focus.z });
    gsap.fromTo(root.position, { z: 0.7, y: 0.12 }, { z: 0, y: 0, duration: 1.3, ease: 'expo.out' });
    gsap.fromTo(root.rotation, { y: -1.1 }, { y: 0, duration: 1.6, ease: 'expo.out' });
    const letters = info.name.toUpperCase();
    ui.name.textContent = '';
    tl = gsap.timeline().call(() => playSignature(sound, info.slug), [], 0.5);
    [...letters].forEach((ch, i) => tl!.call(() => { ui.name.textContent = letters.slice(0, i + 1); }, [], 0.6 + i * 0.055));
  }
  current = { info, model, root };
  (window as any).__lab = { scene, current, renderer };
}

// the loop: the camera orbits its focus; the collectible floats
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  const az = (cam.az * Math.PI) / 180, el = (cam.el * Math.PI) / 180;
  // a portrait screen sees less across, so the camera stands further back to keep the same framing
  const dist = cam.dist * Math.max(1, Math.min(2.1, 1.25 / camera.aspect));
  camera.position.set(cam.fx + dist * Math.sin(az) * Math.cos(el), cam.fy + dist * Math.sin(el), cam.fz + dist * Math.cos(az) * Math.cos(el));
  camera.lookAt(cam.fx, cam.fy, cam.fz);
  if (current && style === 'collectible') {
    const g = current.model.group;
    g.position.y = Math.sin(t * 1.7) * 0.012 + 0.012;
    g.rotation.y = Math.sin(t * 0.5) * 0.35;
    g.rotation.z = Math.sin(t * 0.9) * 0.025;
    ui.shadow.style.transform = `translate(-50%, 0) scale(${1 - g.position.y * 6})`;
    ui.shadow.style.opacity = String(0.55 - g.position.y * 8);
  }
  renderer.render(scene, camera);
  notes.forEach((n) => n.place());
});

// choosing: a character, a style
let at = 0;
document.querySelectorAll<HTMLButtonElement>('[data-char]').forEach((b) => b.addEventListener('click', () => { sound.unlock(); at = CHARS.findIndex((c) => c.slug === b.dataset.char); show(CHARS[at]); }));
document.querySelectorAll<HTMLButtonElement>('[data-style]').forEach((b) => b.addEventListener('click', () => { sound.unlock(); style = b.dataset.style as Style; current = null; scene.clear(); scene.add(key, rimA, rimB, fill, key.target, rimA.target, rimB.target); show(CHARS[at]); }));

/** For recordings: each character in turn, resolving when the last has played. */
(window as any).__play = async () => {
  await sound.unlock();
  for (let i = 0; i < CHARS.length; i++) {
    at = i; await show(CHARS[i]);
    await new Promise((r) => setTimeout(r, style === 'statue' ? 14500 : 5600));
  }
};
// a recording waits for every model to load and compile; a visitor sees the first at once
if (qs.has('rec')) {
  Promise.all(CHARS.map(async (c) => { const m = await get(c.slug, style); const g = new THREE.Group(); g.add(m.group); await renderer.compileAsync(g, camera, scene); g.remove(m.group); compiled.add(m); }))
    .then(() => { (window as any).__ready = true; });
} else show(CHARS[Math.max(0, CHARS.findIndex((c) => c.slug === qs.get('c')))]);
