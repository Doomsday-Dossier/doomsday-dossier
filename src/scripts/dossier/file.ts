/**
 * A classified file (design system v2). Scrolling opens it: the iron cover lifts on its hinge, the
 * redaction bars peel off the typed facts, the prints slide out of the folder and the stamp slams
 * down while the page warms to the file's own colour. The subject chapter is a specimen (Feathers
 * Atlas): the subject as a turning point cloud (Particle Self) with callouts pinned to points on the
 * figure, key traits and a close-up lens. The character's signature WebGL scene stays live behind.
 * Before the file, the hero (Obsidian, Lena Varga): the subject cut out in front of their name while
 * their colour floods the page; scrolling pushes the camera in. After the subject, the exhibits zoom
 * toward you (Oyla), and the next file opens as a window into the next world (Space Voyage).
 */
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import type { Ctx, HeroScene } from '../gl/engine';
import { fitText } from '../motion/grammar';
import { Figure } from './figure';
import { Diorama, type DioOpts } from './depth';
import { C, EASE, FIGURES, timeLeft } from './tokens';

type Fig = { src: string; alphaCut: boolean; photoAspect: number; crop: [number, number, number, number]; focus: [number, number]; height: number; depth: number; cut: number };
import type Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

// the page's figure framing (data-fig, from src/data/v2.ts figureFor); Doom's showcase values until it is read
let FIG: Fig = { src: '', alphaCut: false, photoAspect: 16 / 9, ...FIGURES['victor-von-doom'] };
let [CX0, CY0, CX1, CY1] = FIG.crop;
const setFig = (f: Fig) => { FIG = f; [CX0, CY0, CX1, CY1] = f.crop; };
/** photo coordinates (u, v of the whole photo) to the sampled window */
const toCrop = (u: number, v: number): [number, number] => [(u - CX0) / (CX1 - CX0), (v - CY0) / (CY1 - CY0)];
const X_AXIS = new THREE.Vector3(1, 0, 0), Y_AXIS = new THREE.Vector3(0, 1, 0);

/** The character's own scene behind, the particle figure in front. */
class FileScene implements HeroScene {
  back: HeroScene;
  figScene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
  figure = new Figure();
  ready = false;
  alpha = 0; yaw = 0; pitch = -0.03;
  mouse = new THREE.Vector2(9, 9);
  constructor(back: HeroScene) { this.back = back; }
  mount(ctx: Ctx) { this.back.mount(ctx); this.resize(ctx); }
  async load(ctx: Ctx, src: string) {
    await this.figure.build({ ...FIG, src, cols: ctx.mobile ? 140 : 230 });
    this.figure.mat.uniforms.uAssemble.value = 1;
    this.figure.mat.uniforms.uSize.value = ctx.mobile ? 2.6 : 2.1;
    this.figScene.add(this.figure.points);
    this.ready = true;
  }
  dio: Diorama | null = null;
  resize(ctx: Ctx) {
    this.back.resize?.(ctx);
    this.dio?.resize(ctx);
    this.cam.aspect = ctx.width / ctx.height;
    this.cam.fov = ctx.width < 900 ? 52 : 40;
    // phones: the figure sits in the top of the screen, above the callouts that scroll up under it
    this.cam.position.set(0, ctx.width < 900 ? -0.45 : 0, 6.1);
    this.cam.updateProjectionMatrix();
  }
  setQuality(ctx: Ctx) { this.back.setQuality?.(ctx); }
  update(ctx: Ctx, dt: number) {
    this.back.update(ctx, dt);
    this.dio?.render(ctx, dt);
    if (!this.ready || this.alpha <= 0.002) return;
    const u = this.figure.mat.uniforms;
    u.uTime.value = ctx.time; u.uYaw.value = this.yaw; u.uPitch.value = this.pitch; u.uAlpha.value = this.alpha;
    u.uPx.value = ctx.bufW / ctx.width; u.uMouse.value.copy(this.mouse); u.uLift.value = ctx.mobile ? 0 : 1;
    const r = ctx.renderer;
    r.autoClear = false; r.clearDepth(); r.render(this.figScene, this.cam); r.autoClear = true;
  }
  dispose() { this.back.dispose(); this.figure.dispose?.(); this.dio?.dispose(); }

  /** Screen position of a point on the photo (u, v from its top-left), after the figure turns. */
  project(u: number, v: number, aspect: number, out: THREE.Vector3, w: number, h: number) {
    const H = FIG.height, W = H * aspect, [fx, fy] = FIG.focus;
    const d2 = ((u - fx) / 0.32) ** 2 + ((v - fy) / 0.42) ** 2;
    out.set((u - fx) * W, -(v - fy) * H, Math.exp(-d2) * FIG.depth * 0.9 + 0.1 * FIG.depth * 0.6);
    // same order as the shader: turn about Y, then tilt about X
    out.applyAxisAngle(Y_AXIS, this.yaw).applyAxisAngle(X_AXIS, this.pitch);
    out.project(this.cam);
    out.set((out.x * 0.5 + 0.5) * w, (-out.y * 0.5 + 0.5) * h, 0);
    return out;
  }
}

type Env = { engine: { ctx: Ctx; mount(s: HeroScene): Promise<void>; setActive(on: boolean): void; renderer: THREE.WebGLRenderer } | null; lenis: Lenis | null; reduced: boolean; phone: boolean };

export async function filePage(env: Env) {
  const file = document.querySelector<HTMLElement>('[data-file]');
  if (!file) return;
  const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = file) => r.querySelector<T>(s)!;
  const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = file) => [...r.querySelectorAll<T>(s)];
  const R = env.reduced;
  const figData = JSON.parse(file.dataset.fig || 'null') as Fig | null;
  if (figData) setFig(figData);

  // display text measured to its box, then split for reveals
  fitText(document);
  document.fonts.ready.then(() => { if (fitText(document)) ScrollTrigger.refresh(); }).catch(() => {});
  addEventListener('resize', () => { if (fitText(document)) ScrollTrigger.refresh(); });

  // 0. the hero: colour floods in, the name rises behind, the subject bursts through; scroll pushes in
  const hero = file.querySelector<HTMLElement>('[data-hero]');
  if (hero && !R) {
    const flood = $('[data-flood]', hero), nameEl = $('[data-hero-name]', hero), cut = hero.querySelector<HTMLElement>('[data-hero-cut]'), hin = $$('[data-hin]', hero);
    gsap.set(nameEl, { y: 0, yPercent: -58 });
    const intro = gsap.timeline({ delay: 0.1 })
      .fromTo(flood, { scale: 0 }, { scale: 1, duration: 1.3, ease: EASE.file })
      .fromTo(nameEl.querySelectorAll('.hw'), { yPercent: 70, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.08, ease: EASE.reveal }, 0.25)
      .fromTo(hin, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: EASE.reveal }, 0.9);
    if (cut) intro.fromTo(cut, { yPercent: 14, scale: 0.86, opacity: 0 }, { yPercent: 0, scale: 1, opacity: 1, duration: 1.1, ease: 'back.out(1.4)' }, 0.45);
    const push = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.5 } });
    if (cut) push.to(cut, { scale: 1.55, yPercent: 10, ease: 'none' }, 0);
    push.to(nameEl, { scale: 1.08, opacity: 0, ease: 'none' }, 0)
      .to(flood, { scale: 1.6, opacity: 0.25, ease: 'none' }, 0)
      .to(hin, { opacity: 0, ease: 'none', duration: 0.3 }, 0);
    // depth: the backdrop drifts and the glow swells as the camera pushes in
    const back = hero.querySelector('.hero-back'), glow = hero.querySelector('.hero-glow');
    if (back) push.to(back, { yPercent: -6, scale: 1.12, ease: 'none' }, 0);
    if (glow) push.to(glow, { scale: 1.5, opacity: 0.35, ease: 'none' }, 0);
    // the layers follow a fine pointer at different depths, so the hero reads as space, not a picture
    if (matchMedia('(pointer: fine)').matches) {
      const layers = [...hero.querySelectorAll<HTMLElement>('[data-depth]')].map((el) => ({ d: +el.dataset.depth!, x: gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3.out' }), y: gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3.out' }) }));
      hero.addEventListener('pointermove', (e) => {
        const dx = e.clientX / innerWidth - 0.5, dy = e.clientY / innerHeight - 0.5;
        layers.forEach((l) => { l.x(-dx * l.d * 46); l.y(-dy * l.d * 26); });
      }, { passive: true });
    }
  }

  // THE RECORD: origin, comics eras, sightings and Doomsday as one pinned horizontal journey
  const rec = file.querySelector<HTMLElement>('[data-record]');
  if (rec && !R) {
    document.documentElement.classList.add('rec-on');
    // the chapters now live in the drawer: their own scroll reveals would never fire there
    file.querySelectorAll('[data-rec-chapters] [data-reveal], [data-rec-chapters] [data-report], [data-rec-chapters] [data-rise]').forEach((el) => { el.removeAttribute('data-reveal'); el.removeAttribute('data-report'); el.removeAttribute('data-rise'); });
    const track = $('[data-rec-track]', rec);
    const stops = $$('[data-stop]', rec);
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    const progs = $$('[data-prog]', rec);
    const chapters = ['origin', 'comics', 'screen', 'doom'];
    const ranges = chapters.map((k) => { const idx = stops.map((st, i) => (st.dataset.chapter === k ? i : -1)).filter((i) => i >= 0); return [idx[0] ?? 0, idx[idx.length - 1] ?? 0]; });
    const slide = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: rec, start: 'top top', end: 'bottom bottom', scrub: 0.7, invalidateOnRefresh: true,
        onUpdate: (st) => {
          const pos = st.progress * Math.max(1, stops.length - 1);
          progs.forEach((li, k) => {
            const [a, b] = ranges[k];
            const p = gsap.utils.clamp(0, 1, (pos - a + 0.5) / (b - a + 1));
            li.style.setProperty('--p', String(p));
            li.classList.toggle('on', pos >= a - 0.5 && pos <= b + 0.5);
          });
        },
      },
    });
    stops.forEach((st) => {
      const big = st.querySelector('[data-stop-big]'), body = st.querySelector('[data-stop-body]');
      // each stop swells into focus as it reaches the middle and recedes as it leaves
      gsap.timeline({ scrollTrigger: { trigger: st, containerAnimation: slide, start: 'left right', end: 'right left', scrub: true } })
        .fromTo(st, { scale: 0.88, opacity: 0.45 }, { scale: 1, opacity: 1, ease: 'power1.out', duration: 1 })
        .to(st, { scale: 0.9, opacity: 0.5, ease: 'power1.in', duration: 1 });
      // the giant year drifts the other way behind the words
      if (big) gsap.fromTo(big, { xPercent: 16 }, { xPercent: -16, ease: 'none', scrollTrigger: { trigger: st, containerAnimation: slide, start: 'left right', end: 'right left', scrub: true } });
      if (body) gsap.from(body.children, { y: 34, opacity: 0, duration: 0.7, stagger: 0.06, ease: EASE.reveal, scrollTrigger: { trigger: st, containerAnimation: slide, start: 'left 72%', toggleActions: 'play none none reverse' } });
    });

    // the drawer: a stop opens its whole chapter, scrolled to that report or sighting
    const drawer = $('[data-drawer]'), dbody = $('[data-drawer-body]', drawer), closeBtn = $('[data-drawer-close]', drawer);
    let open: { sec: HTMLElement; mark: Comment } | null = null;
    const close = () => {
      if (!open) return;
      drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true');
      const o = open; open = null;
      setTimeout(() => { o.mark.replaceWith(o.sec); }, 600);
      env.lenis?.start();
    };
    rec.querySelectorAll<HTMLButtonElement>('[data-read]').forEach((b) => b.addEventListener('click', () => {
      const sec = document.getElementById(b.dataset.read!);
      if (!sec) return;
      if (open) { open.mark.replaceWith(open.sec); open = null; }
      const mark = document.createComment('chapter');
      sec.replaceWith(mark);
      dbody.replaceChildren(sec);
      open = { sec, mark };
      drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false');
      env.lenis?.stop();
      closeBtn.focus({ preventScroll: true });
      const at = b.dataset.at ? document.getElementById(b.dataset.at) : null;
      dbody.scrollTop = at ? at.offsetTop - 24 : 0;
      if (at) gsap.fromTo(at, { backgroundColor: 'rgba(31, 212, 122, 0.14)' }, { backgroundColor: 'rgba(31, 212, 122, 0)', duration: 1.6, delay: 0.5 });
    }));
    closeBtn.addEventListener('click', close);
    addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    document.addEventListener('pointerdown', (e) => { if (open && !drawer.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-read]')) close(); });
  }

  // mini countdown
  const mini = $('[data-mini-count]');
  const tick = () => { const t = timeLeft(); mini.textContent = `${String(t.d).padStart(2, '0')}d ${String(t.h).padStart(2, '0')}h ${String(t.m).padStart(2, '0')}m ${String(t.s).padStart(2, '0')}s`; };
  tick(); setInterval(tick, 1000);

  // WebGL: the signature scene behind, the figure for the subject chapter
  let sc: FileScene | null = null;
  if (env.engine) {
    const { loadScene } = await import('../gl/registry');
    const back = await loadScene(file.dataset.scene || 'forge');
    if (back) {
      sc = new FileScene(back);
      await env.engine.mount(sc);
      env.engine.renderer.setClearColor(new THREE.Color(C.gunmetal), 1);
      if (FIG.src) sc.load(env.engine.ctx, FIG.src);
      // the hero in 3D: the photo becomes a depth diorama; the flat layers step aside once it is drawn
      const heroEl = file.querySelector<HTMLElement>('[data-hero]');
      const dioOpts = heroEl && !R ? (JSON.parse(heroEl.dataset.dio || 'null') as DioOpts | null) : null;
      if (heroEl && dioOpts) {
        const dio = new Diorama();
        const scn = sc;
        dio.load(dioOpts, env.engine.ctx).then(() => {
          scn.dio = dio;
          document.documentElement.classList.add('dio-on');
          gsap.fromTo(dio, { intro: 0 }, { intro: 1, duration: 1.8, ease: EASE.file });
          heroEl.addEventListener('pointermove', (e) => dio.pointer.set(e.clientX / innerWidth - 0.5, -(e.clientY / innerHeight - 0.5)), { passive: true });
          ScrollTrigger.create({ trigger: heroEl, start: 'top top', end: 'bottom top', onUpdate: (st) => { dio.scroll = st.progress; dio.alpha = 1 - gsap.utils.clamp(0, 1, (st.progress - 0.72) / 0.28); } });
        }).catch(() => { /* the flat hero stays */ });
      }
    }
  }

  const cover = $('[data-cover]'), bars = $$('[data-bar]'), prints = $$('[data-print]'), stamp = $('[data-stamp]'), hint = $('[data-hint]'), tint = document.querySelector<HTMLElement>('[data-tint]')!;
  const folder = $('[data-folder]');

  if (R) {
    gsap.set(tint, { opacity: 0.6 });
    gsap.set(prints, { rotate: (i) => (i ? -5 : 4) });
    gsap.set(stamp, { opacity: 0.92 });
    hint.hidden = true;
  } else {
    // arrival: a fly-in from the archive starts close up on the cover (Feathers), otherwise it rises in
    const flew = (() => { try { const s = sessionStorage.getItem('dd-fly-in'); sessionStorage.removeItem('dd-fly-in'); return !!s; } catch { return false; } })();
    if (flew) gsap.fromTo(folder, { scale: 1.55, opacity: 0.4 }, { scale: 1, opacity: 1, duration: 1.1, ease: EASE.file });
    else gsap.fromTo(folder, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: EASE.reveal, delay: 0.15 });
    gsap.fromTo(hint, { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 1 });

    // I. opening, scrubbed by scroll
    gsap.set(stamp, { opacity: 0, scale: 1.8 });
    gsap.set(prints, { x: (i) => (i ? -70 : -110), y: (i) => (i ? 30 : 50), rotate: 0, opacity: 0 });
    const open = gsap.timeline({ defaults: { ease: EASE.scrub }, scrollTrigger: { trigger: '[data-open]', start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
    open.to(hint, { opacity: 0, duration: 0.05 }, 0)
      .to(cover, { rotateX: -118, y: -12, duration: 0.3, ease: 'power2.in' }, 0.02)
      .to(cover, { opacity: 0, duration: 0.06 }, 0.3)
      .to(tint, { opacity: 0.6, duration: 0.45 }, 0)
      .to(bars, { scaleX: 0, duration: 0.07, stagger: 0.05, ease: 'power2.inOut' }, 0.28)
      .to(prints, { x: 0, y: 0, opacity: 1, rotate: (i) => (i ? -5 : 4), duration: 0.22, stagger: 0.08, ease: 'power3.out' }, 0.55)
      .to({}, { duration: 0.12 });
    // the stamp slams on time, not on scroll: a slam can't be scrubbed
    const slam = gsap.timeline({ paused: true })
      .to(stamp, { opacity: 0.92, scale: 1, duration: 0.2, ease: EASE.stampIn })
      .to(folder, { x: 3, duration: 0.05, yoyo: true, repeat: 3, ease: 'none' })
      .set(folder, { x: 0 });
    ScrollTrigger.create({ trigger: '[data-open]', start: () => `top+=${((file.querySelector('[data-open]') as HTMLElement).offsetHeight - innerHeight) * 0.8} top`, onEnter: () => slam.restart(), onLeaveBack: () => { slam.pause(0); gsap.set(stamp, { opacity: 0, scale: 1.8 }); } });
  }

  // II. the subject
  const subject = $('[data-subject]');
  const pin = $('[data-sub-pin]', subject);
  const figSpace = $('[data-fig-space]', subject);
  const callouts = $$('[data-callout]');
  const stage = $('.sub-stage', subject);
  const dots = callouts.map(() => { const d = document.createElement('i'); d.className = 'cdot'; d.setAttribute('aria-hidden', 'true'); stage.append(d); return d; });
  // the sampled window's shape: the photo is 16:9, the window a portrait slice of it
  const aspect = FIG.photoAspect * ((CX1 - CX0) / (CY1 - CY0));
  let subQ = 0;
  const reveal = callouts.map(() => ({ v: R ? 1 : 0 }));
  ScrollTrigger.create({
    trigger: pin, start: 'top bottom', end: 'bottom top',
    onUpdate: (st) => {
      subQ = st.progress;
      if (sc) {
        const q = subQ;
        sc.alpha = gsap.utils.clamp(0, 1, (q - 0.12) / 0.2) * (1 - gsap.utils.clamp(0, 1, (q - 0.8) / 0.12));
        sc.yaw = R ? 0 : (q - 0.5) * 1.3;
        if (env.engine) env.engine.ctx.scroll = Math.min(1, q * 1.4);
      }
    },
    onLeave: () => env.engine?.setActive(false),
    onEnterBack: () => env.engine?.setActive(true),
  });
  if (!R) {
    callouts.forEach((cl, i) => {
      gsap.set(cl, { opacity: 0, x: -16 });
      if (innerWidth < 900) {
        ScrollTrigger.create({ trigger: cl, start: 'top 88%', once: true, onEnter: () => { gsap.to(cl, { opacity: 1, x: 0, duration: 0.6, ease: EASE.reveal }); reveal[i].v = 1; } });
        return;
      }
      ScrollTrigger.create({
        trigger: pin, start: () => `top+=${pin.offsetHeight * (0.12 + i * 0.1)} top`,
        onEnter: () => { gsap.to(cl, { opacity: 1, x: 0, duration: 0.5, ease: EASE.reveal }); gsap.to(reveal[i], { v: 1, duration: 0.7, ease: EASE.reveal }); },
        onLeaveBack: () => { gsap.to(cl, { opacity: 0, x: -16, duration: 0.3 }); gsap.to(reveal[i], { v: 0, duration: 0.3 }); },
      });
    });
    gsap.from('[data-bar-w]', { scaleX: 0, duration: 0.9, stagger: 0.06, ease: EASE.reveal, scrollTrigger: { trigger: '[data-key]', start: 'top 80%', once: true } });
  }
  // leader lines from each callout to its point on the figure, redrawn every frame while visible
  const tmp = new THREE.Vector3();
  const wide = () => innerWidth >= 900;
  gsap.ticker.add(() => {
    if (!sc || subQ <= 0 || subQ >= 1) return;
    const sr = stage.getBoundingClientRect();
    if (!wide()) {
      // phones: the stage is not pinned, so the figure shows only while its space at the top is on screen
      const vh = innerHeight, fr = figSpace.getBoundingClientRect();
      sc.alpha = gsap.utils.clamp(0, 1, (fr.bottom - vh * 0.15) / (vh * 0.3)) * gsap.utils.clamp(0, 1, (vh * 0.9 - fr.top) / (vh * 0.3));
    }
    callouts.forEach((cl, i) => {
      const lead = cl.querySelector<HTMLElement>('[data-lead]')!;
      const [cu, cv] = toCrop(+cl.dataset.u!, +cl.dataset.v!);
      const a = sc!.project(cu, cv, aspect, tmp, innerWidth, innerHeight);
      const k = reveal[i].v * sc!.alpha;
      dots[i].style.transform = `translate3d(${a.x - sr.left - 5}px, ${a.y - sr.top - 5}px, 0) scale(${k})`;
      if (!wide()) return;
      const r = cl.getBoundingClientRect();
      const x0 = r.right + 10, y0 = r.top + 8;
      const dx = a.x - x0, dy = a.y - y0, len = Math.hypot(dx, dy);
      lead.style.transform = `translate3d(${x0 - r.left}px, 8px, 0) rotate(${Math.atan2(dy, dx)}rad) scaleX(${(len / 100) * k})`;
    });
  });
  // close-up lens: follows fine pointers over the figure, rests on the mask on touch screens
  const lensEl = $('[data-lens-el]', subject), lensImg = lensEl.querySelector('i')!;
  const lensSrc = file.dataset.lens!;
  const Z = 2.6;
  const placeLens = (px: number, py: number, show: boolean) => {
    if (!sc) return;
    const tl = sc.project(0, 0, aspect, new THREE.Vector3(), innerWidth, innerHeight), br = sc.project(1, 1, aspect, new THREE.Vector3(), innerWidth, innerHeight);
    const bw = br.x - tl.x, bh = br.y - tl.y;
    if (bw <= 0 || bh <= 0) return;
    const u = gsap.utils.clamp(0, 1, (px - tl.x) / bw), v = gsap.utils.clamp(0, 1, (py - tl.y) / bh);
    const sr = stage.getBoundingClientRect();
    const L = lensEl.offsetWidth;
    // the lens shows the whole photo magnified; the window maps back to photo coordinates
    const fw = (bw / (CX1 - CX0)) * Z, fh = (bh / (CY1 - CY0)) * Z;
    const pu = CX0 + u * (CX1 - CX0), pv = CY0 + v * (CY1 - CY0);
    lensImg.style.width = `${fw}px`; lensImg.style.height = `${fh}px`;
    lensImg.style.backgroundImage = `url(${lensSrc})`; lensImg.style.backgroundSize = '100% 100%';
    lensImg.style.transform = `translate3d(${L / 2 - pu * fw}px, ${L / 2 - pv * fh}px, 0)`;
    lensEl.style.transform = `translate3d(${px - sr.left - L / 2}px, ${py - sr.top - L / 2}px, 0)`;
    lensEl.style.opacity = show ? String(sc.alpha) : '0';
  };
  if (matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (e) => {
      if (sc) sc.mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      const over = subQ > 0.2 && subQ < 0.8 && Math.abs(e.clientX - innerWidth / 2) < innerWidth * 0.17 && e.clientY > innerHeight * 0.2;
      placeLens(e.clientX, e.clientY, over);
    }, { passive: true });
  } else {
    gsap.ticker.add(() => { if (sc && subQ > 0 && subQ < 1) { const [mu, mv] = toCrop(0.5, 0.5); const m = sc.project(mu, mv, aspect, tmp, innerWidth, innerHeight); placeLens(m.x + 70, m.y + 90, true); } });
  }

  // III to VI: titles rise, blocks settle, reports are filed in
  if (!R) {
    // exhibits: each print comes toward you as it passes, the photo settling inside its frame (Oyla)
    $$('[data-ex]').forEach((ex) => {
      const frame = ex.querySelector('.ex-frame'), img = ex.querySelector('img');
      gsap.fromTo(frame, { scale: 0.86, opacity: 0.4 }, { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: ex, start: 'top bottom', end: 'center center', scrub: 0.4 } });
      gsap.fromTo(img, { scale: 1.28 }, { scale: 1.04, ease: 'none', scrollTrigger: { trigger: ex, start: 'top bottom', end: 'bottom top', scrub: 0.4 } });
    });
    // the next file: the world behind drifts, the window rises toward you
    const voy = file.querySelector<HTMLElement>('[data-voyage]');
    if (voy) {
      const bg = voy.querySelector('[data-voy-bg]'), win = voy.querySelector('[data-voy-window]');
      if (bg) gsap.fromTo(bg, { yPercent: -6, scale: 1.14 }, { yPercent: 6, scale: 1.04, ease: 'none', scrollTrigger: { trigger: voy, start: 'top bottom', end: 'bottom top', scrub: true } });
      if (win) gsap.fromTo(win, { scale: 0.82, y: 60, opacity: 0 }, { scale: 1, y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: voy, start: 'top bottom', end: 'top 25%', scrub: 0.5 } });
    }
    $$('[data-rise]', document).forEach((el) => {
      SplitText.create(el, { type: 'lines,words', mask: 'lines', linesClass: 'split-line', autoSplit: true, onSplit: (s) => gsap.from(s.words, { yPercent: 110, duration: 0.9, stagger: 0.05, ease: EASE.reveal, scrollTrigger: { trigger: el, start: 'top 85%', once: true } }) });
    });
    $$('[data-reveal]', document).forEach((el) => gsap.from(el, { y: 26, opacity: 0, duration: 0.8, ease: EASE.reveal, scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));
    $$('[data-report]').forEach((el, i) => gsap.from(el, { x: i % 2 ? -50 : 50, rotate: i % 2 ? -1.2 : 1.2, opacity: 0, duration: 0.9, ease: EASE.reveal, scrollTrigger: { trigger: el, start: 'top 86%', once: true } }));
  }
}
