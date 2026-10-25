import Lenis from 'lenis';
import type { Engine } from './gl/engine';
import { Wipe } from './gl/wipe';
import {
  gsap, ScrollTrigger, splitReveals, blockReveals, driftType, comicsTimeline, screenStrip,
  countdowns, magnets, tiltCards, killAll,
} from './motion/grammar';
import { homeMotion } from './motion/home';
import { characterExtras } from './motion/characters';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.toggle('rm', reduced);

let engine: Engine | null = null;
let wipe: Wipe | null = null;
let lenis: Lenis | null = null;
let pageCleanups: (() => void)[] = [];

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// Three.js loads in parallel with first paint; text and scroll motion do not wait for it.
let engineReady: Promise<void> = Promise.resolve();
function startEngine() {
  const glCanvas = document.getElementById('gl') as HTMLCanvasElement | null;
  if (!glCanvas || !hasWebGL()) return;
  engineReady = import('./gl/engine').then(({ Engine }) => {
    try { engine = new Engine(glCanvas); } catch { engine = null; }
    if (location.hostname === 'localhost') (window as any).__ddEngine = engine; // local debugging only
  });
}

function bootOnce() {
  startEngine();
  const wipeCanvas = document.getElementById('wipe') as HTMLCanvasElement | null;
  if (wipeCanvas && !reduced) wipe = new Wipe(wipeCanvas);

  if (!reduced) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, autoRaf: false });
    lenis.on('scroll', ScrollTrigger.update);
  }
  gsap.ticker.add((t) => {
    lenis?.raf(t * 1000);
    engine?.tick(gsap.ticker.deltaRatio(60) / 60);
  });
  gsap.ticker.lagSmoothing(0);

  // Opening or closing a source list changes page height: re-measure pins and triggers
  document.addEventListener('toggle', (e) => { if ((e.target as HTMLElement).matches?.('details')) ScrollTrigger.refresh(); }, true);

  // Header scrim once the page has scrolled
  const scrolled = () => document.documentElement.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', scrolled, { passive: true });
  document.addEventListener('astro:page-load', scrolled);
  scrolled();

  // Menu
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-menu-toggle]')) {
      const open = !document.documentElement.classList.contains('menu-open');
      document.documentElement.classList.toggle('menu-open', open);
      document.querySelector('[data-menu-toggle]')?.setAttribute('aria-expanded', String(open));
      open ? lenis?.stop() : lenis?.start();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.documentElement.classList.contains('menu-open')) {
      document.documentElement.classList.remove('menu-open'); lenis?.start();
    }
  });

  // Page transitions with Astro's client router: cover, load, swap, reveal.
  document.addEventListener('astro:before-preparation', (ev: any) => {
    const link = (ev.sourceElement as HTMLElement | undefined)?.closest?.('a');
    const accent = link?.getAttribute('data-accent') || getComputedStyle(document.body).getPropertyValue('--c-accent').trim() || '#3dff8a';
    wipe?.setColor(accent);
    const original = ev.loader;
    ev.loader = async () => { await Promise.all([wipe ? wipe.cover() : Promise.resolve(), original()]); };
  });
  document.addEventListener('astro:before-swap', () => {
    document.documentElement.classList.remove('menu-open');
    teardownPage();
  });
  document.addEventListener('astro:after-swap', () => {
    window.scrollTo(0, 0);
    lenis?.scrollTo(0, { immediate: true, force: true });
    lenis?.start();
  });
}

function teardownPage() {
  pageCleanups.splice(0).forEach((f) => { try { f(); } catch { /* ignore */ } });
  killAll();
  engine?.unmount();
}

async function initPage() {
  const body = document.body;
  const ease = body.dataset.ease || 'power3.out';
  const pace = parseFloat(body.dataset.pace || '1');
  const opts = { ease, pace, reduced };

  const sceneId = body.dataset.scene;

  // Uncover the new page straight away; never hold the wipe for fonts or WebGL.
  const revealing = wipe && wipe.canvas.style.opacity === '1' ? wipe.reveal() : Promise.resolve();
  // DOM motion next. Wait briefly for fonts; SplitText re-splits if a face lands later.
  await Promise.race([document.fonts.ready.catch(() => {}), new Promise((r) => setTimeout(r, 500))]);
  splitReveals(document, opts);
  blockReveals(document, opts);
  driftType(document, opts);
  comicsTimeline(document, opts);
  screenStrip(document, opts);
  magnets(document, opts);
  tiltCards(document, opts);
  pageCleanups.push(countdowns(document, body.dataset.release || '2026-12-18'));
  if (body.dataset.page === 'home') homeMotion(reduced);
  if (!reduced) gsap.from('[data-hero-in]', { opacity: 0, y: 20, duration: 1.2 * pace, stagger: 0.1, ease, delay: 0.6 });
  requestAnimationFrame(() => ScrollTrigger.refresh());
  document.fonts.ready.then(() => ScrollTrigger.refresh()).catch(() => {});

  // Hero scene: mount when the engine arrives, drive scroll progress, pause out of view.
  await engineReady;
  if (engine && sceneId) {
    const { loadScene } = await import('./gl/registry');
    const scene = await loadScene(sceneId);
    if (scene && document.body === body) {
      await engine.mount(scene);
      const region = document.querySelector<HTMLElement>('[data-gl-region]') || document.querySelector<HTMLElement>('.hero');
      if (region) {
        ScrollTrigger.create({
          trigger: region, start: 'top top', end: 'bottom top',
          onUpdate: (st) => { if (engine) engine.ctx.scroll = st.progress; },
          onLeave: () => engine?.setActive(false),
          onEnterBack: () => engine?.setActive(true),
        });
      }
    }
  } else {
    document.documentElement.classList.add('no-gl');
  }
  if (body.dataset.page === 'character' && sceneId) pageCleanups.push(characterExtras(sceneId, engine?.ctx || null, reduced));
  await revealing;
}

let booted = false;
document.addEventListener('astro:page-load', () => {
  if (!booted) { bootOnce(); booted = true; }
  initPage();
});
