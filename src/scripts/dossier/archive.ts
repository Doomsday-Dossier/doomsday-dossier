/**
 * The archive (v2 home): intro, then a camera fly-through past the 29 floating files.
 *
 * Intro (first visit, at most 5 s, skippable): darkness, the emerald glow builds, Doom assembles out
 * of green particles, DOOMSDAY DOSSIER burns in, the countdown appears. Return visits get a short
 * glow-in. Scrolling the hero turns the figure (Particle Self) and the camera dives through it as it
 * scatters into dust; the fly-through then travels down a corridor of files (Loops). The file ahead
 * gets a typed label beside it, team chapters announce themselves, and opening a file flies the
 * camera into it before the page changes (Feathers).
 */
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Ctx, HeroScene } from '../gl/engine';
import { Figure } from './figure';
import { drawCover, fontsReady, type FileInfo } from './filecover';
import { C, EASE, FIGURES, INTRO_KEY, rgb, timeLeft } from './tokens';
import type Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const SPACING = 3.1;

/**
 * File cover material: the drawn cover, a band of light that sweeps across it as the camera passes
 * (so each file reads as a physical object), an accent rim when hovered, and the corridor fog.
 */
function fileMaterial(accent: string) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { map: { value: null as THREE.Texture | null }, uOpacity: { value: 0 }, uLift: { value: 0 }, uPass: { value: 0 }, uAccent: { value: new THREE.Color(accent) }, uFog: { value: new THREE.Color(C.gunmetal) }, uFogNear: { value: 3.5 }, uFogFar: { value: 15 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vDepth;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float uOpacity, uLift, uPass, uFogNear, uFogFar; uniform vec3 uAccent, uFog;
      varying vec2 vUv; varying float vDepth;
      void main(){
        vec4 t = texture2D(map, vUv);
        // a soft diagonal band of light crossing the cover as the camera goes by
        float d = (vUv.x * 0.8 + (1.0 - vUv.y)) * 0.6;
        float sheen = smoothstep(0.16, 0.0, abs(d - uPass)) * 0.22;
        vec3 c = t.rgb + vec3(sheen);
        // accent rim on hover
        vec2 e = min(vUv, 1.0 - vUv);
        float rim = smoothstep(0.035, 0.0, min(e.x, e.y * 0.8)) * uLift;
        c = mix(c, uAccent, rim * 0.9);
        float fog = smoothstep(uFogNear, uFogFar, vDepth);
        c = mix(c, uFog, fog * 0.35);
        gl_FragColor = vec4(c, t.a * uOpacity * (1.0 - fog));
      }`,
  });
}

class ArchiveScene implements HeroScene {
  scene = new THREE.Scene();
  bgScene = new THREE.Scene();
  bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  cam = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
  bgMat!: THREE.ShaderMaterial;
  figure = new Figure();
  figureReady = false;
  fig: Record<string, unknown> = {};
  files: { mesh: THREE.Mesh; info: FileInfo; base: THREE.Vector3; rot: number; seed: number }[] = [];
  dust!: THREE.Points;
  dustMat!: THREE.ShaderMaterial;
  // driven from the DOM side
  glow = 0; assemble = 0; yaw = 0; dive = 0; fly = 0; hover = -1; flyTo: THREE.Vector3 | null = null; flyLook: THREE.Vector3 | null = null; flyK = 0;
  mouse = new THREE.Vector2(9, 9);
  camZ0 = 6.2;
  get zEnd() { return -2 - (this.files.length || 29) * SPACING - 1.5; }

  mount(ctx: Ctx) {
    this.scene.fog = new THREE.Fog(new THREE.Color(C.gunmetal), 3.5, 15);
    const [r, g, b] = rgb(C.emerald);
    this.bgMat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { uGlow: { value: 0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uEm: { value: new THREE.Vector3(r, g, b) }, uFly: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uGlow, uTime, uFly; uniform vec2 uRes; uniform vec3 uEm; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
        void main(){
          vec2 p = (vUv - vec2(0.5, 0.52)) * vec2(uRes.x/uRes.y, 1.0);
          float r = length(p);
          // the glow builds from the centre, then thins into a far corridor light as we fly
          float core = exp(-r*r*mix(5.5, 14.0, uFly)) * uGlow;
          float breath = 0.92 + 0.08*sin(uTime*0.9);
          vec3 base = vec3(0.051, 0.063, 0.071);
          vec3 col = base * (0.35 + 0.65*uGlow) + uEm * core * 0.42 * breath;
          col += uEm * 0.05 * smoothstep(0.9, 0.0, abs(p.y + 0.35)) * uFly; // floor sheen in the corridor
          col *= smoothstep(1.25, 0.2, r);
          col += (hash(vUv*uRes + uTime) - 0.5) * 0.012;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bgMat);
    this.bgScene.add(q);
    this.buildDust(ctx);
    this.resize(ctx);
  }

  async loadFigure(ctx: Ctx, src: string) {
    await this.figure.build({ src, cols: ctx.mobile ? 140 : 230, ...FIGURES['victor-von-doom'], ...this.fig });
    this.figure.mat.uniforms.uSize.value = ctx.mobile ? 2.6 : 2.1;
    this.scene.add(this.figure.points);
    this.figureReady = true;
  }

  async loadFiles(ctx: Ctx, infos: FileInfo[]) {
    await fontsReady();
    const w = ctx.mobile ? 320 : 512;
    const geo = new THREE.PlaneGeometry(1.2, 1.5);
    let i = 0;
    for (const info of infos) {
      const side = i % 2 ? 1 : -1;
      const seed = Math.random();
      const z = -2 - i * SPACING;
      const base = new THREE.Vector3(side * (ctx.mobile ? 0.95 : 1.55 + seed * 0.35) + this.swayX(z), (seed - 0.5) * 0.7 + this.swayY(z), z);
      const mat = fileMaterial(info.accent);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(base);
      const rot = -side * (0.32 + seed * 0.12);
      mesh.rotation.set(0, rot, (seed - 0.5) * 0.12);
      mesh.userData.i = i;
      this.scene.add(mesh);
      this.files.push({ mesh, info, base, rot, seed });
      i++;
    }
    // draw covers in order of distance, a few at a time, so the first files arrive quickly
    for (const f of this.files) {
      const canvas = await drawCover(f.info, w);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.NoColorSpace; // the cover shader writes the drawn sRGB values straight out
      tex.anisotropy = 4;
      (f.mesh.material as THREE.ShaderMaterial).uniforms.map.value = tex;
    }
  }

  swayX(z: number) { return Math.sin(z * 0.13) * 0.7; }
  swayY(z: number) { return Math.cos(z * 0.09) * 0.25; }

  buildDust(ctx: Ctx) {
    const n = ctx.mobile ? 1400 : 4200;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 9; pos[i * 3 + 1] = (Math.random() - 0.5) * 5; pos[i * 3 + 2] = 4 - Math.random() * (29 * SPACING + 12);
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dustMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uAlpha: { value: 0 }, uEm: { value: new THREE.Vector3(...rgb(C.emeraldHot)) } },
      vertexShader: /* glsl */ `
        uniform float uTime, uPx; attribute float aSeed; varying float vA;
        void main(){
          vec3 p = position;
          p.y += sin(uTime*0.2 + aSeed*30.0) * 0.15; p.x += cos(uTime*0.17 + aSeed*20.0) * 0.12;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * (1.0 + aSeed*2.0) * (4.0 / -mv.z);
          vA = smoothstep(14.0, 2.0, -mv.z) * (0.25 + aSeed*0.6);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAlpha; uniform vec3 uEm; varying float vA;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d)*vA*uAlpha; gl_FragColor = vec4(uEm*a, 1.0); }`,
    });
    this.dust = new THREE.Points(geo, this.dustMat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  resize(ctx: Ctx) {
    this.cam.aspect = ctx.width / ctx.height;
    // keep the figure's head comfortably in frame on tall phones
    this.cam.fov = ctx.width < ctx.height ? 58 : 42;
    this.cam.updateProjectionMatrix();
    this.bgMat.uniforms.uRes.value.set(ctx.bufW, ctx.bufH);
  }

  /** Camera position for the hero dive (0..1) and the fly-through (0..1). */
  camAt(out: THREE.Vector3, look: THREE.Vector3) {
    const zDive = this.camZ0 - this.dive * 5.2; // through the figure to z = 1
    const zFly = 1 + this.fly * (this.zEnd - 1);
    const z = this.fly > 0 ? zFly : zDive;
    out.set(this.swayX(z) * Math.min(1, this.fly * 6), this.swayY(z) * Math.min(1, this.fly * 6) + (1 - this.dive) * 0.05, z);
    look.set(this.swayX(z - 4) * Math.min(1, this.fly * 6), this.swayY(z - 4) * 0.8 * Math.min(1, this.fly * 6), z - 4);
  }

  private tmp = new THREE.Vector3(); private tmpL = new THREE.Vector3(); private curL = new THREE.Vector3(0, 0, 0);

  update(ctx: Ctx, dt: number) {
    const t = ctx.time;
    this.bgMat.uniforms.uGlow.value = this.glow;
    this.bgMat.uniforms.uTime.value = t;
    this.bgMat.uniforms.uFly.value = Math.min(1, this.fly * 4 + this.dive * 0.4);
    // camera: scroll-driven path, or a fly-in toward an opened file
    this.camAt(this.tmp, this.tmpL);
    if (this.flyTo && this.flyLook) { this.tmp.lerp(this.flyTo, this.flyK); this.tmpL.lerp(this.flyLook, this.flyK); }
    this.cam.position.copy(this.tmp);
    this.curL.lerp(this.tmpL, 1 - Math.exp(-dt * 8));
    this.cam.lookAt(this.curL);

    if (this.figureReady) {
      const u = this.figure.mat.uniforms;
      u.uAssemble.value = this.assemble; u.uTime.value = t;
      u.uYaw.value = this.yaw + Math.sin(t * 0.35) * 0.05 * this.assemble;
      u.uPitch.value = -0.04 + this.dive * 0.12;
      u.uDisperse.value = Math.max(0, (this.dive - 0.45) / 0.55);
      u.uPx.value = ctx.bufW / ctx.width;
      u.uMouse.value.copy(this.mouse); u.uLift.value = ctx.mobile ? 0 : 1;
      this.figure.points.visible = this.fly < 0.08;
      this.figure.points.position.set(ctx.width > ctx.height ? 1.55 * (1 - this.dive) : 0, ctx.width > ctx.height ? 0 : 0.6, 0);
    }
    this.dustMat.uniforms.uTime.value = t;
    this.dustMat.uniforms.uPx.value = ctx.bufW / ctx.width;
    this.dustMat.uniforms.uAlpha.value = Math.min(1, this.glow * 0.5 + this.dive);

    for (const f of this.files) {
      const i = f.mesh.userData.i as number;
      const lift = this.hover === i ? 1 : 0;
      f.mesh.userData.l = (f.mesh.userData.l || 0) + (lift - (f.mesh.userData.l || 0)) * (1 - Math.exp(-dt * 10));
      const l = f.mesh.userData.l as number;
      f.mesh.position.set(f.base.x * (1 - l * 0.12), f.base.y + Math.sin(t * 0.6 + f.seed * 9) * 0.06 + l * 0.06, f.base.z + l * 0.35);
      f.mesh.rotation.y = f.rot * (1 - l * 0.45) + Math.sin(t * 0.4 + f.seed * 5) * 0.03;
      const u = (f.mesh.material as THREE.ShaderMaterial).uniforms;
      u.uOpacity.value = u.map.value ? Math.min(1, this.dive * 2.5 + this.fly * 20) : 0;
      u.uLift.value = l;
      // the light band travels across the cover as the camera closes in on it
      u.uPass.value = 1.4 - Math.min(1.6, Math.max(0, (this.cam.position.z - f.base.z) / 6)) * 1.0;
      f.mesh.visible = u.uOpacity.value > 0.01;
    }

    const r = ctx.renderer;
    r.autoClear = false;
    r.clear();
    r.render(this.bgScene, this.bgCam);
    r.render(this.scene, this.cam);
    r.autoClear = true;
  }

  dispose() {
    this.scene.traverse((o: any) => { o.geometry?.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.uniforms?.map?.value?.dispose?.(); o.material.dispose?.(); } });
    this.bgMat.dispose();
  }
}

type Env = { engine: { ctx: Ctx; mount(s: HeroScene): Promise<void>; renderer: THREE.WebGLRenderer } | null; lenis: Lenis | null; reduced: boolean; phone: boolean };

export async function archive(env: Env) {
  const root = document.querySelector<HTMLElement>('[data-archive]');
  const raw = document.getElementById('dx-files');
  if (!root || !raw) return;
  const infos = JSON.parse(raw.textContent || '[]') as FileInfo[];
  const intro = root.querySelector<HTMLElement>('[data-intro]')!;
  const title = intro.querySelector<HTMLElement>('[data-title]')!;
  const after = [...intro.querySelectorAll<HTMLElement>('[data-after]')];
  const skip = intro.querySelector<HTMLButtonElement>('[data-skip]')!;
  const count = intro.querySelector<HTMLElement>('[data-count]')!;
  const fly = root.querySelector<HTMLElement>('[data-fly]');
  const label = root.querySelector<HTMLAnchorElement>('[data-label]');
  const chapter = root.querySelector<HTMLElement>('[data-chapter]');
  const rail = root.querySelector<HTMLElement>('[data-rail]');

  // countdown, the same maths as everywhere else
  const tickCount = () => {
    const t = timeLeft();
    const set = (k: string, v: number, l = 2) => { const n = count.querySelector(`[data-k="${k}"]`); const s = String(v).padStart(l, '0'); if (n && n.textContent !== s) n.textContent = s; };
    set('d', t.d, 2); set('h', t.h); set('m', t.m); set('s', t.s);
  };
  tickCount(); setInterval(tickCount, 1000);

  // title: two stacked copies per letter, an emerald burn and the bone ink, so the burn-in is opacity only
  const letters = (layer: string) => [...title.querySelectorAll<HTMLElement>(`.${layer} .ch`)];
  const burn = letters('burn'), ink = letters('ink');

  const sc = env.engine ? new ArchiveScene() : null;
  if (env.engine && sc) {
    await env.engine.mount(sc);
    env.engine.renderer.setClearColor(new THREE.Color(C.gunmetal), 1);
  }
  const figData = JSON.parse(root.dataset.fig || 'null');
  if (sc && figData) sc.fig = figData;
  const photo = figData?.src || root.dataset.figure!;
  const figureLoad = sc && env.engine ? sc.loadFigure(env.engine.ctx, photo) : Promise.resolve();

  const seen = (() => { try { return localStorage.getItem(INTRO_KEY) === '1'; } catch { return false; } })();
  const done = () => {
    try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* private mode */ }
    root.classList.add('intro-done');
    env.lenis?.start();
    skip.hidden = true;
    if (sc && env.engine) sc.loadFiles(env.engine.ctx, infos);
  };

  if (env.reduced || !sc) {
    // still: everything in place, no camera moves
    if (sc) { await figureLoad; sc.glow = 1; sc.assemble = 1; }
    gsap.set([...ink, ...after], { opacity: 1 }); gsap.set(burn, { opacity: 0 });
    done();
    return;
  }

  env.lenis?.stop();
  await figureLoad;
  const full = !seen;
  const tl = gsap.timeline({ onComplete: done });
  if (full) {
    skip.hidden = false;
    tl.to(sc, { glow: 1, duration: 1.4, ease: EASE.glow }, 0)
      .to(sc, { assemble: 1, duration: 3.0, ease: 'power2.out' }, 0.5)
      .fromTo(burn, { opacity: 0 }, { opacity: 1, duration: 0.35, stagger: { each: 0.05, from: 'random' }, ease: 'power2.in' }, 2.8)
      .to(ink, { opacity: 1, duration: 0.5, stagger: { each: 0.05, from: 'random' } }, 3.05)
      .to(burn, { opacity: 0, duration: 0.6, stagger: { each: 0.05, from: 'random' } }, 3.25)
      .fromTo(after, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: EASE.reveal }, 3.7);
  } else {
    tl.to(sc, { glow: 1, duration: 0.8, ease: EASE.glow }, 0)
      .to(sc, { assemble: 1, duration: 0.9, ease: 'power3.out' }, 0)
      .to(ink, { opacity: 1, duration: 0.6, stagger: 0.02 }, 0.1)
      .fromTo(after, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: EASE.reveal }, 0.3);
  }
  const skipNow = () => { if (tl.progress() < 1) { tl.progress(1); } };
  const onKey = (e: KeyboardEvent) => { if (!['Tab', 'Shift'].includes(e.key)) skipNow(); };
  addEventListener('keydown', onKey, { once: true });
  addEventListener('wheel', skipNow, { once: true, passive: true });
  addEventListener('touchstart', skipNow, { once: true, passive: true });
  addEventListener('pointerdown', skipNow, { once: true });
  skip.addEventListener('click', skipNow);

  // hero scroll: the figure turns, then the camera dives through it as it scatters
  ScrollTrigger.create({ trigger: intro, start: 'top top', end: 'bottom top', onUpdate: (st) => { sc.yaw = st.progress * 0.9; sc.dive = st.progress; } });
  gsap.to(intro.querySelectorAll('.intro-foot, .intro-top'), { opacity: 0, y: -40, ease: 'none', scrollTrigger: { trigger: intro, start: 'top top', end: '60% top', scrub: true } });

  if (!fly) return;
  // the fly-through: progress along the corridor, labels for the file ahead, team chapters
  let lastNear = -2, lastTeam = '';
  const v = new THREE.Vector3();
  ScrollTrigger.create({
    trigger: fly, start: 'top top', end: 'bottom bottom',
    onUpdate: (st) => { sc.fly = st.progress; },
  });
  const placeLabel = () => {
    if (!label || !sc.files.length) return;
    const camZ = sc.cam.position.z;
    let near = -1;
    for (let i = 0; i < sc.files.length; i++) { const z = sc.files[i].base.z; if (z < camZ - 0.9 && z > camZ - 7.5) { near = i; break; } }
    if (near !== lastNear) {
      lastNear = near;
      if (near >= 0) {
        const f = sc.files[near].info;
        label.href = f.href;
        label.querySelector('[data-l-no]')!.textContent = `FILE ${String(f.no).padStart(2, '0')} / ${f.total}`;
        label.querySelector('[data-l-name]')!.textContent = f.name;
        label.querySelector('[data-l-team]')!.textContent = f.team;
        label.style.setProperty('--a', f.accent);
        gsap.fromTo(label.querySelectorAll('[data-l-in]'), { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.35, stagger: 0.05, ease: EASE.reveal, overwrite: true });
        if (rail) rail.textContent = `FILE ${String(f.no).padStart(2, '0')} / ${f.total}`;
        if (chapter && f.team !== lastTeam) {
          lastTeam = f.team;
          const name = chapter.querySelector<HTMLElement>('[data-c-name]')!;
          name.textContent = f.team;
          gsap.fromTo(name, { yPercent: 105 }, { yPercent: 0, duration: 0.7, ease: EASE.reveal, overwrite: true });
        }
      }
      label.classList.toggle('on', near >= 0);
    }
    if (near >= 0) {
      const m = sc.files[near].mesh;
      const side = sc.files[near].base.x - sc.cam.position.x > 0 ? 1 : -1;
      v.set(side > 0 ? -0.66 : 0.66, 0.55, 0).applyMatrix4(m.matrixWorld).project(sc.cam);
      const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
      label.style.transform = `translate3d(${Math.round(side > 0 ? x - label.offsetWidth - 26 : x + 26)}px, ${Math.round(Math.max(90, Math.min(innerHeight - 120, y)))}px, 0)`;
    }
  };
  gsap.ticker.add(placeLabel);

  // hover and open (fine pointers lift the file; any click opens it)
  const ray = new THREE.Raycaster();
  const pick = (e: PointerEvent) => {
    if (!sc.files.length || sc.fly <= 0) return -1;
    const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, sc.cam);
    const hit = ray.intersectObjects(sc.files.map((f) => f.mesh))[0];
    return hit ? (hit.object.userData.i as number) : -1;
  };
  addEventListener('pointermove', (e) => {
    sc.mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (e.pointerType !== 'mouse') return;
    const i = pick(e);
    if (i !== sc.hover) { sc.hover = i; document.body.style.cursor = i >= 0 ? 'pointer' : ''; }
  }, { passive: true });
  const open = (i: number) => {
    const f = sc.files[i];
    env.lenis?.stop();
    const n = new THREE.Vector3(0, 0, 1).applyEuler(f.mesh.rotation);
    sc.flyTo = f.mesh.position.clone().addScaledVector(n, 1.05);
    sc.flyLook = f.mesh.position.clone();
    sessionStorage.setItem('dd-fly-in', f.info.slug);
    gsap.to(sc, { flyK: 1, duration: 0.95, ease: EASE.file, onComplete: () => { location.href = f.info.href; } });
    gsap.to('[data-veil]', { opacity: 1, duration: 0.35, delay: 0.7 });
  };
  addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    const i = pick(e as PointerEvent);
    if (i >= 0) open(i);
  });
  label?.addEventListener('click', (e) => {
    if (lastNear < 0 || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); open(lastNear);
  });
}
