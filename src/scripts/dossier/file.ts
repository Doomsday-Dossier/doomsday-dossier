/**
 * A classified file (design system v3, clearance levels). The hero: the subject in front of their name while
 * their colour floods the page and their signature sound plays; scrolling pushes the camera in. Level 1, the
 * 30-second briefing: the iron cover lifts, the redaction bars tear off the facts one by one (each with a rip),
 * the prints slide out and the stamp lands. Levels 2 and 3 stay redacted until the reader requests clearance;
 * the bars tear away and the level opens (remembered across files, `localStorage` `dd-clearance`). In Level 2
 * the subject is one big graded print, pushed in slowly, its callouts lighting up pin by pin. The character's
 * signature WebGL scene stays live behind, with the hero photo as a depth diorama.
 *
 * On a page change the file builds under the cover (CLAUDE.md, "Page changes"): `filePage` returns once its
 * type is fitted, its scene is built and its shaders and photos are on the GPU, and its entrance waits for the
 * reveal. At the foot of the file, the next one is fetched ahead: its page, its scene's code, its face, its photos.
 */
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Ctx, HeroScene } from '../gl/engine';
import { fitText } from '../motion/grammar';
import { Diorama, preloadImage, type DioOpts } from './depth';
import { revealed, arrivedBy } from './cover';
import { rise, settle } from './reveal';
import { onLeave, pageEpoch, alive } from '../page-scope';
import { prefetch } from 'astro:prefetch';
import { C, EASE, timeLeft } from './tokens';
import { Sound } from '../sound/engine';
import { tear, stamp as stampSound } from '../sound/actions';
import { playSignature } from '../sound/signatures';
import type Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const CLEARANCE = 'dd-clearance';
const cleared = () => { try { return Number(localStorage.getItem(CLEARANCE)) || 1; } catch { return 1; } };
const grant = (n: number) => { try { if (n > cleared()) localStorage.setItem(CLEARANCE, String(n)); } catch { /* private mode */ } };

/** The character's own scene behind, with the hero diorama on top. */
class FileScene implements HeroScene {
  back: HeroScene;
  dio: Diorama | null = null;
  constructor(back: HeroScene) { this.back = back; }
  mount(ctx: Ctx) { this.back.mount(ctx); this.resize(ctx); }
  resize(ctx: Ctx) { this.back.resize?.(ctx); this.dio?.resize(ctx); }
  setQuality(ctx: Ctx) { this.back.setQuality?.(ctx); }
  update(ctx: Ctx, dt: number) { this.back.update(ctx, dt); this.dio?.render(ctx, dt); }
  dispose() { this.back.dispose(); this.dio?.dispose(); }
}

type Env = { engine: { ctx: Ctx; mount(s: HeroScene): Promise<void>; setActive(on: boolean): void; prime(): void; compile(o: object): Promise<void>; renderer: THREE.WebGLRenderer } | null; lenis: Lenis | null; reduced: boolean; phone: boolean };

/** The faces the page uses, loaded: laid out first so the browser asks for every one, with a time limit. */
const fontsLoaded = () => {
  void document.body.offsetHeight;
  return Promise.race([document.fonts.ready.then(() => {}), new Promise<void>((res) => setTimeout(res, 1500))]);
};

export async function filePage(env: Env): Promise<void> {
  const file = document.querySelector<HTMLElement>('[data-file]');
  if (!file) return;
  const epoch = pageEpoch();
  const handoff = arrivedBy() === 'handoff';
  const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = file) => r.querySelector<T>(s)!;
  const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = file) => [...r.querySelectorAll<T>(s)];
  const R = env.reduced;
  const sound = Sound.get();
  const slug = file.dataset.slug!;

  // display text measured to its box once its faces have loaded, then split for reveals
  fitText(document);
  const fontsIn = fontsLoaded().then(() => { if (alive(epoch) && fitText(document)) ScrollTrigger.refresh(); });
  addEventListener('resize', () => { if (fitText(document)) ScrollTrigger.refresh(); });

  // the signature sound: as the hero arrives if sound is already running (the visitor came from another
  // page), otherwise at the first click or key while the hero is still in view
  let signed = false;
  const sign = () => { if (signed || scrollY > innerHeight * 1.2) return; signed = playSignature(sound, slug); };
  revealed().then(() => setTimeout(sign, handoff ? 200 : 450));
  const onGesture = () => { setTimeout(sign, 60); };
  addEventListener('pointerdown', onGesture, { once: true }); addEventListener('keydown', onGesture, { once: true });

  // 0. the hero: colour floods in, the name rises, the subject bursts through; scroll pushes in
  const hero = file.querySelector<HTMLElement>('[data-hero]');
  if (hero && !R) {
    const flood = $('[data-flood]', hero), nameEl = $('[data-hero-name]', hero), cut = hero.querySelector<HTMLElement>('[data-hero-cut]'), hin = $$('[data-hin]', hero);
    gsap.set(nameEl, { y: 0, yPercent: 0, transformOrigin: '0% 100%' });
    // the entrance plays as the page is revealed; after the handoff the colour is already on screen, so the
    // flood is there from the start and the name rises sooner
    revealed().then(() => {
      if (!alive(epoch)) return;
      const t0 = handoff ? 0 : 0.25;
      const intro = gsap.timeline({ delay: handoff ? 0 : 0.1 });
      if (!handoff) intro.fromTo(flood, { scale: 0 }, { scale: 1, duration: 1.3, ease: EASE.file }, 0);
      intro.fromTo(nameEl.querySelectorAll('.hw'), { yPercent: 70, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.08, ease: EASE.reveal }, t0)
        .fromTo(hin, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: EASE.reveal }, t0 + 0.65);
      if (cut) intro.fromTo(cut, { yPercent: 14, scale: 0.86, opacity: 0 }, { yPercent: 0, scale: 1, opacity: 1, duration: 1.1, ease: 'back.out(1.4)' }, t0 + 0.2);
    });
    const push = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.5 } });
    if (cut) push.to(cut, { scale: 1.55, yPercent: 10, ease: 'none' }, 0);
    push.to(nameEl, { y: -40, opacity: 0, ease: 'none' }, 0)
      .to(flood, { scale: 1.6, opacity: 0.25, ease: 'none' }, 0)
      .to(hin, { opacity: 0, ease: 'none', duration: 0.3 }, 0);
    const back = hero.querySelector('.hero-back'), glow = hero.querySelector('.hero-glow');
    if (back) push.to(back, { yPercent: -6, scale: 1.12, ease: 'none' }, 0);
    if (glow) push.to(glow, { scale: 1.5, opacity: 0.35, ease: 'none' }, 0);
    if (matchMedia('(pointer: fine)').matches) {
      const layers = [...hero.querySelectorAll<HTMLElement>('[data-depth]')].map((el) => ({ d: +el.dataset.depth!, x: gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3.out' }), y: gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3.out' }) }));
      hero.addEventListener('pointermove', (e) => {
        const dx = e.clientX / innerWidth - 0.5, dy = e.clientY / innerHeight - 0.5;
        layers.forEach((l) => { l.x(-dx * l.d * 46); l.y(-dy * l.d * 26); });
      }, { passive: true });
    }
  }

  // mini countdown
  const mini = file.querySelector<HTMLElement>('[data-mini-count]');
  if (mini) {
    const tick = () => { const t = timeLeft(); mini.textContent = `${String(t.d).padStart(2, '0')}d ${String(t.h).padStart(2, '0')}h ${String(t.m).padStart(2, '0')}m ${String(t.s).padStart(2, '0')}s`; };
    tick(); setInterval(tick, 1000);
  }

  // WebGL: the signature scene behind, the hero photo as a depth diorama. Built now, drawn once (`prime`) so its
  // shaders compile and its photos upload while a page change still has its cover up
  const html = document.documentElement;
  onLeave(() => html.classList.remove('dio-on'));
  const glReady = (async () => {
    const eng = env.engine;
    if (!eng) return;
    const { loadScene } = await import('../gl/registry');
    const back = await loadScene(file.dataset.scene || 'forge');
    if (!back || !alive(epoch)) { back?.dispose(); return; }
    const sc = new FileScene(back);
    await eng.mount(sc);
    eng.renderer.setClearColor(new THREE.Color(C.gunmetal), 1);
    await eng.compile(back);
    if (!alive(epoch)) return;
    eng.prime();
    // the scene rests once the briefing is behind the reader
    ScrollTrigger.create({ trigger: '[data-open]', start: 'bottom top', onEnter: () => eng.setActive(false), onLeaveBack: () => eng.setActive(true) });
    const heroEl = file.querySelector<HTMLElement>('[data-hero]');
    const dioOpts = heroEl && !R ? (JSON.parse(heroEl.dataset.dio || 'null') as DioOpts | null) : null;
    if (!heroEl || !dioOpts) return;
    const dio = new Diorama();
    try { await dio.load(dioOpts, eng.ctx); } catch { return; /* the flat hero stays */ }
    if (!alive(epoch)) { dio.dispose(); return; }
    await eng.compile(dio);
    if (!alive(epoch)) { dio.dispose(); return; }
    sc.dio = dio;
    html.classList.add('dio-on');
    eng.prime();
    revealed().then(() => { if (alive(epoch)) gsap.fromTo(dio, { intro: 0 }, { intro: 1, duration: 1.8, ease: EASE.file }); });
    heroEl.addEventListener('pointermove', (e) => dio.pointer.set(e.clientX / innerWidth - 0.5, -(e.clientY / innerHeight - 0.5)), { passive: true });
    ScrollTrigger.create({ trigger: heroEl, start: 'top top', end: 'bottom top', onUpdate: (st) => { dio.scroll = st.progress; dio.alpha = 1 - gsap.utils.clamp(0, 1, (st.progress - 0.72) / 0.28); } });
  })();

  // LEVEL 1: the folder opens, scrubbed by scroll; each bar rips as it goes
  const cover = $('[data-cover]'), bars = $$('[data-bar]'), prints = $$('[data-print]'), stampEl = $('[data-stamp]'), hint = $('[data-hint]'), tint = document.querySelector<HTMLElement>('[data-tint]')!;
  const folder = $('[data-folder]');
  if (R) {
    gsap.set(tint, { opacity: 0.6 });
    gsap.set(prints, { rotate: (i) => (i ? -5 : 4) });
    gsap.set(stampEl, { opacity: 0.92 });
    gsap.set(bars, { scaleX: 0 });
    hint.hidden = true;
  } else {
    gsap.fromTo(folder, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: EASE.reveal, delay: 0.15 });
    gsap.fromTo(hint, { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 1 });
    gsap.set(stampEl, { opacity: 0, scale: 1.8 });
    gsap.set(prints, { x: (i) => (i ? -70 : -110), y: (i) => (i ? 30 : 50), rotate: 0, opacity: 0 });
    const torn = bars.map(() => false);
    gsap.timeline({ defaults: { ease: EASE.scrub }, scrollTrigger: { trigger: '[data-open]', start: 'top top', end: 'bottom bottom', scrub: 0.6 } })
      .to(hint, { opacity: 0, duration: 0.05 }, 0)
      .to(cover, { rotateX: -118, y: -12, duration: 0.3, ease: 'power2.in' }, 0.02)
      .to(cover, { opacity: 0, duration: 0.06 }, 0.3)
      .to(tint, { opacity: 0.6, duration: 0.45 }, 0)
      .to(bars, {
        scaleX: 0, duration: 0.07, stagger: 0.06, ease: 'power2.inOut',
        // a rip as each bar passes halfway, once per pass forward
        onUpdate() { bars.forEach((b, i) => { const sx = Number(gsap.getProperty(b, 'scaleX')); if (sx < 0.5 && !torn[i]) { torn[i] = true; tear(sound); } else if (sx > 0.9) torn[i] = false; }); },
      }, 0.3)
      .to(prints, { x: 0, y: 0, opacity: 1, rotate: (i) => (i ? -5 : 4), duration: 0.2, stagger: 0.08, ease: 'power3.out' }, 0.6)
      .to({}, { duration: 0.1 });
    // the stamp lands on time, not on scroll: a slam can't be scrubbed
    const slam = gsap.timeline({ paused: true })
      .call(() => stampSound(sound))
      .to(stampEl, { opacity: 0.92, scale: 1, duration: 0.2, ease: EASE.stampIn })
      .to(folder, { x: 3, duration: 0.05, yoyo: true, repeat: 3, ease: 'none' })
      .set(folder, { x: 0 });
    ScrollTrigger.create({ trigger: '[data-open]', start: () => `top+=${($('[data-open]').offsetHeight - innerHeight) * 0.85} top`, onEnter: () => slam.restart(), onLeaveBack: () => { slam.pause(0); gsap.set(stampEl, { opacity: 0, scale: 1.8 }); } });
  }

  // LEVELS 2 AND 3: redacted until requested
  const levels = $$('[data-level]');
  const lock = (lv: HTMLElement) => {
    lv.classList.add('is-locked');
    $('[data-level-body]', lv).setAttribute('inert', '');
    $('[data-level-lock]', lv).hidden = false;
  };
  const open = (lv: HTMLElement, animate: boolean) => {
    if (!lv.classList.contains('is-locked')) return Promise.resolve();
    const body = $('[data-level-body]', lv), lk = $('[data-level-lock]', lv), lbars = $$('[data-lock-bar]', lv), ask = lk.querySelector('.lock-ask');
    const done = () => { lv.classList.remove('is-locked'); body.removeAttribute('inert'); lk.hidden = true; gsap.set(body, { clearProps: 'height,filter' }); ScrollTrigger.refresh(); };
    if (!animate || R) { done(); return Promise.resolve(); }
    return new Promise<void>((res) => {
      const h0 = body.offsetHeight;
      lv.classList.remove('is-locked'); body.style.height = 'auto';
      const h1 = body.scrollHeight;
      lv.classList.add('is-locked'); body.style.height = '';
      gsap.timeline({ onComplete: () => { done(); res(); } })
        .to(ask, { opacity: 0, y: -12, duration: 0.3, ease: 'power2.in' })
        .to(lbars, { scaleX: 0, duration: 0.32, stagger: { each: 0.07, onStart: () => tear(sound, undefined, 0.18) }, ease: 'power3.in' }, 0.1)
        .to(body, { filter: 'blur(0px) brightness(1)', duration: 0.6, ease: 'power2.out' }, 0.5)
        .fromTo(body, { height: h0 }, { height: Math.min(h1, h0 + innerHeight * 1.2), duration: 0.9, ease: EASE.file }, 0.55);
    });
  };
  const have = cleared();
  levels.forEach((lv) => { if (Number(lv.dataset.level) > have) lock(lv); });
  levels.forEach((lv) => {
    const btn = lv.querySelector<HTMLButtonElement>('[data-request]');
    btn?.addEventListener('click', async () => {
      const n = Number(btn.dataset.request);
      sound.unlock();
      // level 3 needs level 2: both open, in order
      for (const l of levels) if (Number(l.dataset.level) <= n) await open(l, true);
      grant(n);
      const target = levels.find((l) => Number(l.dataset.level) === n);
      target?.querySelector<HTMLElement>('h2')?.setAttribute('tabindex', '-1');
      target?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    });
  });

  // LEVEL 2: the subject, one graded print pushed in slowly, its pins lighting up in turn
  const photo = file.querySelector<HTMLElement>('[data-sub-photo]');
  if (photo) {
    const img = $('[data-sub-img]', photo), pins = $$('[data-pin]', photo), cals = $$('[data-callout]');
    const light = (i: number) => { pins.forEach((p, k) => p.classList.toggle('on', k === i)); cals.forEach((c, k) => c.classList.toggle('on', k === i)); };
    if (!R) {
      gsap.fromTo(img, { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: photo, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
      gsap.from(pins, { scale: 0, opacity: 0, duration: 0.6, stagger: 0.18, ease: 'back.out(2)', scrollTrigger: { trigger: photo, start: 'top 70%', once: true } });
    }
    // the callout crossing the middle of the screen lights its pin
    cals.forEach((c, i) => ScrollTrigger.create({ trigger: c, start: 'top 62%', end: 'bottom 38%', onToggle: (st) => { if (st.isActive) light(i); } }));
    cals.forEach((c, i) => { c.addEventListener('pointerenter', () => light(i)); c.addEventListener('focusin', () => light(i)); });
  }

  // reveals: titles rise, blocks settle, reports are filed in, the power grid fills
  if (!R) {
    $$('[data-ex]').forEach((ex) => {
      const frame = ex.querySelector('.ex-frame'), img = ex.querySelector('img');
      gsap.fromTo(frame, { scale: 0.86, opacity: 0.4 }, { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: ex, start: 'top bottom', end: 'center center', scrub: 0.4 } });
      gsap.fromTo(img, { scale: 1.28 }, { scale: 1.04, ease: 'none', scrollTrigger: { trigger: ex, start: 'top bottom', end: 'bottom top', scrub: 0.4 } });
    });
    const voy = file.querySelector<HTMLElement>('[data-voyage]');
    if (voy) {
      const bg = voy.querySelector('[data-voy-bg]'), win = voy.querySelector('[data-voy-window]');
      if (bg) gsap.fromTo(bg, { yPercent: -6, scale: 1.14 }, { yPercent: 6, scale: 1.04, ease: 'none', scrollTrigger: { trigger: voy, start: 'top bottom', end: 'bottom top', scrub: true } });
      if (win) gsap.fromTo(win, { scale: 0.82, y: 60, opacity: 0 }, { scale: 1, y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: voy, start: 'top bottom', end: 'top 25%', scrub: 0.5 } });
    }
    // titles split once the faces are in (and only as they come near), so a late font never splits them again;
    // blocks and reports settle in by class (reveal.ts)
    fontsIn.then(() => { if (alive(epoch)) rise($$('[data-rise]', document)); });
    settle($$('[data-reveal]', document));
    settle($$('[data-report]'), 'top 86%', (_, i) => ({ x: i % 2 ? -50 : 50, y: 0, r: i % 2 ? -1.2 : 1.2 }));
    gsap.from('[data-bar-w]', { scaleX: 0, duration: 0.9, stagger: 0.06, ease: EASE.reveal, scrollTrigger: { trigger: '[data-key]', start: 'top 80%', once: true } });
  }

  // THE NEXT FILE, fetched ahead as the reader nears the foot of this one: by the time they open it, its page,
  // its scene's code, its title face and its photos are already here
  const voy = file.querySelector<HTMLElement>('[data-voyage]');
  const nextLink = voy?.querySelector<HTMLAnchorElement>('a[data-handoff]');
  if (voy && nextLink) {
    const ahead = () => {
      const n = JSON.parse(voy.dataset.next || '{}') as { scene?: string; font?: string; weight?: number; images?: string[] };
      prefetch(nextLink.href, { ignoreSlowConnection: true });
      if (n.scene && env.engine) import('../gl/registry').then((m) => m.preloadScene(n.scene!)).catch(() => {});
      if (n.font) document.fonts.load(`${n.weight ?? 400} 1em ${n.font}`).catch(() => {});
      if (!R) (n.images ?? []).forEach((src) => preloadImage(src).catch(() => {}));
    };
    ScrollTrigger.create({ trigger: voy, start: 'top 300%', once: true, onEnter: ahead });
  }

  await Promise.all([fontsIn, glReady]);
}
