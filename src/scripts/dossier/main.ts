/**
 * Design system v2 entry. Smooth scroll (Lenis, synced to ScrollTrigger), one WebGL renderer for the
 * page (the v1 Engine: DPR caps, quality governor, a still frame for reduced motion), then the page's
 * own choreography: the archive (intro and fly-through) or a file.
 */
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { reducedMotion, isPhone } from './tokens';

gsap.registerPlugin(ScrollTrigger);

const reduced = reducedMotion();
const phone = isPhone();

let lenis: Lenis | null = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  if (/^(localhost|127\.)/.test(location.hostname)) (window as any).__ddLenis = lenis;
}
const onScroll = () => document.documentElement.classList.toggle('scrolled', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

async function boot() {
  const canvas = document.getElementById('dx-gl') as HTMLCanvasElement | null;
  let engine: any = null;
  try {
    if (canvas && !!document.createElement('canvas').getContext('webgl2')) {
      const { Engine } = await import('../gl/engine');
      engine = new Engine(canvas);
      let last = performance.now();
      const loop = (now: number) => { engine.tick((now - last) / 1000); last = now; requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  } catch { engine = null; }
  if (!engine) document.documentElement.classList.add('no-gl');

  const env = { engine, lenis, reduced, phone };
  const page = document.body.dataset.page;
  if (page === 'archive') (await import('./archive')).archive(env);
  if (page === 'file') (await import('./file')).filePage(env);
  requestAnimationFrame(() => ScrollTrigger.refresh());
  document.fonts.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
}
boot();
