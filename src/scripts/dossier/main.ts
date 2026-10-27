/**
 * The site's entry (design system v3). Pages change without a reload (Astro's client router, CLAUDE.md fifth
 * interview: "seamless"), so this splits in two:
 * - the session, set up once and kept: smooth scroll (Lenis, synced to ScrollTrigger), one WebGL renderer
 *   (the v1 Engine: DPR caps, quality governor, a still frame for reduced motion) on a canvas that persists,
 *   the sound engine, the score and the header's sound switch, the index menu, and the page-change cover;
 * - the page, booted on every `astro:page-load` and taken down before the next swaps in (`page-scope.ts`):
 *   its own choreography (the home page's forge and hall, a file, a team, the arena...).
 * On a page change the next page boots under the cover (the handoff or the redaction wipe, chrome.ts); the cover
 * lifts once the page says it is ready, or after a time limit, so its entrance plays on a free main thread.
 */
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { reducedMotion, isPhone } from './tokens';
import { setScroller } from '../motion/scroller';
import { cursor, transitions, menu } from './chrome';
import { Sound } from '../sound/engine';
import { startScore } from '../sound/score';
import { installPageScope, asGlobal, leavePage } from '../page-scope';
import { tear, redact } from '../sound/actions';
import { fileArrive } from '../sound/home';
import { isCovered, coverDown } from './cover';

installPageScope();
gsap.registerPlugin(ScrollTrigger);

const reduced = reducedMotion();
const phone = isPhone();
const html = document.documentElement;

let lenis: Lenis | null = null;
let engine: any = null;
let engineTried = false;
let pageChange: { lift(): Promise<void> } = { lift: () => Promise.resolve() };
/** How long a page may build under its cover before it is revealed anyway. */
const READY_LIMIT = phone ? 1800 : 1200;

// THE SESSION -----------------------------------------------------------------------------------------------
asGlobal(() => {
  if (!reduced) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis!.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    if (/^(localhost|127\.)/.test(location.hostname)) (window as any).__ddLenis = lenis;
    setScroller(lenis); // the v1 modules (arena, timeline, planner) glide through Lenis too
  }
  // QA scripts (scripts/seamless-check.mjs) read the sound and the triggers on a local server
  if (/^(localhost|127\.)/.test(location.hostname)) Object.assign(window as any, { __ddSound: Sound.get(), ScrollTrigger });
  // ScrollTrigger's own window listeners belong to the session, not to the first page that makes a trigger
  ScrollTrigger.create({ start: 0, end: 1 }).kill();
  const onScroll = () => html.classList.toggle('scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // the sound switch in the header (which persists): one click mutes everything, and the choice is remembered
  const soundBtn = document.querySelector<HTMLButtonElement>('[data-sound]');
  if (soundBtn) {
    const sound = Sound.get();
    const show = (m: boolean) => { soundBtn.setAttribute('aria-pressed', String(m)); soundBtn.querySelector('span')!.textContent = m ? 'Sound off' : 'Sound on'; };
    show(sound.muted); sound.onMute(show);
    soundBtn.addEventListener('click', (e) => { e.stopPropagation(); sound.unlock(); sound.setMuted(!sound.muted); });
  }
  // the score under every page from the visitor's first click or key (browsers allow sound only after one);
  // on the home page the forge starts it instead, and once started it plays on through every page change
  const first = () => {
    if (document.body.dataset.page === 'archive') return;
    const s = Sound.get();
    s.unlock().then(() => { if (s.ctx.state === 'running') startScore(s, 4); });
  };
  addEventListener('pointerdown', first); addEventListener('keydown', first);

  // Astro's router saves the scroll position to history on every scrollend, which smooth scroll fires every
  // frame; save it once the scroll has come to rest instead
  if (lenis) {
    let rest = 0;
    addEventListener('scrollend', (e) => {
      e.stopImmediatePropagation();
      clearTimeout(rest);
      rest = window.setTimeout(() => { if (history.state) history.replaceState({ ...history.state, scrollX, scrollY }, ''); }, 250);
    }, { capture: true });
  }

  menu(reduced, lenis);
  const live = () => Sound.get().ctx.state === 'running';
  pageChange = transitions(reduced, {
    slide: () => { if (live()) fileArrive(Sound.get()); },
    redact: () => redact(Sound.get()),
    tear: () => tear(Sound.get(), undefined, 0.16),
  });

  // page changes: take the old page down before the new one swaps in, then reset for it
  document.addEventListener('astro:before-swap', () => {
    leavePage();
    ScrollTrigger.getAll().forEach((t) => t.kill());
    gsap.globalTimeline.getChildren(true, true, false).forEach((t) => { if (t.data !== 'keep') t.kill(); });
    if (engine) { engine.hold(); engine.unmount(); engine.canvas.style.opacity = '0'; }
    lenis?.stop();
  });
  document.addEventListener('astro:after-swap', () => {
    if (reduced) html.classList.add('rm');
    html.style.overflow = '';
    lenis?.scrollTo(0, { immediate: true, force: true });
    lenis?.resize(); lenis?.start();
    onScroll();
  });
  document.addEventListener('astro:page-load', () => { boot(); });
});

/** The renderer, made once for the whole session on the persistent canvas. */
async function ensureEngine() {
  if (engine || engineTried) return engine;
  engineTried = true;
  const canvas = document.getElementById('dx-gl') as HTMLCanvasElement | null;
  try {
    if (canvas && !!document.createElement('canvas').getContext('webgl2')) {
      const { Engine } = await import('../gl/engine');
      engine = asGlobal(() => new Engine(canvas));
      if (/^(localhost|127\.)/.test(location.hostname)) (window as any).__ddEngine = engine;
      let last = performance.now();
      const loop = (now: number) => { engine.tick((now - last) / 1000); last = now; requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  } catch { engine = null; }
  return engine;
}

// THE PAGE --------------------------------------------------------------------------------------------------
async function boot() {
  const gl = document.body.dataset.gl === 'on';
  const eng = gl ? await ensureEngine() : null;
  if (gl && !eng) html.classList.add('no-gl');
  const env = { engine: eng, lenis, reduced, phone };
  cursor(reduced);
  const page = document.body.dataset.page;
  let ready: Promise<void> | void = undefined;
  if (page === 'archive') (await import('../home/page')).forgeHome(env);
  if (page === 'file') ready = (await import('./file')).filePage(env);
  if (page === 'team') (await import('./team')).teamPage(env);
  if (page === 'arena') (await import('./arenapage')).arenaPage(env);
  if (page === 'timeline') (await import('./timeline')).timelinePage(env);
  if (page === 'predictions') (await import('./predictpage')).predictPage(env);
  if (page === 'quiz') (await import('./quizpage')).quizPageV2(env);
  if (page === 'catchup' || page === 'about' || page === 'credits') (await import('./editorial')).editorialPage(env, page);
  if (isCovered()) {
    // under the cover: let the page finish building, measure it once, paint it once, then reveal it
    await Promise.race([Promise.resolve(ready).catch(() => {}), new Promise((res) => setTimeout(res, READY_LIMIT))]);
    ScrollTrigger.refresh();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    eng?.release();
    coverDown();
    pageChange.lift();
  } else {
    eng?.release();
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }
  document.fonts.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
}
