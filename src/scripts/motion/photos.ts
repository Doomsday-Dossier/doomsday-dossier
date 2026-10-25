/**
 * Photo motion. Hero portrait: develops in, drifts against the pointer, sinks on scroll.
 * Gallery prints: develop like darkroom prints when they enter, and carry the Halftone
 * Lens (pointer on desktop, press and hold on touch). Transforms and opacity only, except
 * the one-off develop filter and the lens clip, which repaint a single print.
 */
import { gsap } from './grammar';

type Opts = { ease: string; pace: number; reduced: boolean };

export function heroPortrait(root: ParentNode, o: Opts): () => void {
  const fig = root.querySelector<HTMLElement>('[data-portrait]');
  if (!fig || o.reduced) return () => {};
  const move = fig.querySelector<HTMLElement>('.ch-portrait-move')!;
  gsap.fromTo(move, { opacity: 0, scale: 1.12, filter: 'blur(16px) brightness(0.4)' },
    { opacity: 1, scale: 1, filter: 'blur(0px) brightness(1)', duration: 2 * o.pace, ease: 'power3.out', delay: 0.15, clearProps: 'filter' });
  gsap.to(fig, { yPercent: 16, opacity: 0.25, ease: 'none', scrollTrigger: { trigger: fig.parentElement!, start: 'top top', end: 'bottom top', scrub: true } });
  if (!matchMedia('(hover: hover)').matches) return () => {};
  const qx = gsap.quickTo(move, 'x', { duration: 1.2, ease: 'power3.out' });
  const qy = gsap.quickTo(move, 'y', { duration: 1.2, ease: 'power3.out' });
  const onMove = (e: PointerEvent) => { qx((0.5 - e.clientX / innerWidth) * 22); qy((0.5 - e.clientY / innerHeight) * 14); };
  addEventListener('pointermove', onMove, { passive: true });
  return () => removeEventListener('pointermove', onMove);
}

export function gallery(root: ParentNode, o: Opts): () => void {
  const prints = [...root.querySelectorAll<HTMLElement>('[data-print]')];
  if (!prints.length) return () => {};
  if (!o.reduced) {
    // develop: blown-out sepia print settling into the photograph
    gsap.fromTo(prints.map((p) => p.querySelector('.photo')), { opacity: 0.25, filter: 'brightness(2.6) sepia(0.9) contrast(0.55) blur(6px)' },
      { opacity: 1, filter: 'brightness(1) sepia(0) contrast(1) blur(0px)', duration: 2.2 * o.pace, ease: 'power2.out', stagger: 0.3, clearProps: 'filter',
        scrollTrigger: { trigger: prints[0].parentElement!, start: 'top 78%', once: true } });
    gsap.from(prints, { y: 60, opacity: 0, duration: 1.2 * o.pace, ease: o.ease.startsWith('steps') ? 'power3.out' : o.ease, stagger: 0.12,
      scrollTrigger: { trigger: prints[0].parentElement!, start: 'top 85%', once: true } });
  }
  const offs: (() => void)[] = [];
  const hover = matchMedia('(hover: hover)').matches;
  for (const p of prints) {
    const frame = p.querySelector<HTMLElement>('.print-frame')!;
    const lens = p.querySelector<HTMLElement>('.lens')!;
    const ring = p.querySelector<HTMLElement>('.lens-ring')!;
    const st = { r: 0 };
    let raf = 0, x = 0, y = 0;
    const paint = () => { raf = 0; lens.style.setProperty('--x', `${x}px`); lens.style.setProperty('--y', `${y}px`); lens.style.setProperty('--r', `${st.r}px`); };
    const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const at = (e: PointerEvent) => { const r = frame.getBoundingClientRect(); x = e.clientX - r.left; y = e.clientY - r.top; gsap.set(ring, { x, y }); queue(); };
    const open = () => { gsap.to(st, { r: 90, duration: o.reduced ? 0 : 0.5, ease: 'power3.out', onUpdate: queue }); gsap.to(ring, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' }); };
    const close = () => { gsap.to(st, { r: 0, duration: o.reduced ? 0 : 0.4, ease: 'power3.in', onUpdate: queue }); gsap.to(ring, { opacity: 0, scale: 0.4, duration: 0.4 }); };
    if (hover) {
      const enter = (e: PointerEvent) => { at(e); open(); };
      frame.addEventListener('pointerenter', enter);
      frame.addEventListener('pointermove', at);
      frame.addEventListener('pointerleave', close);
      offs.push(() => { frame.removeEventListener('pointerenter', enter); frame.removeEventListener('pointermove', at); frame.removeEventListener('pointerleave', close); });
    } else {
      // press and hold: the lens opens where the finger rests; moving cancels so swipes still scroll
      let timer = 0, sx = 0, sy = 0, shown = false;
      const down = (e: PointerEvent) => { sx = e.clientX; sy = e.clientY; at(e); timer = window.setTimeout(() => { shown = true; open(); }, 280); };
      const moveT = (e: PointerEvent) => { if (!shown && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) clearTimeout(timer); else if (shown) at(e); };
      const up = () => { clearTimeout(timer); if (shown) { shown = false; close(); } };
      const noMenu = (e: Event) => e.preventDefault();
      frame.addEventListener('pointerdown', down);
      frame.addEventListener('pointermove', moveT);
      frame.addEventListener('pointerup', up); frame.addEventListener('pointercancel', up); frame.addEventListener('pointerleave', up);
      frame.addEventListener('contextmenu', noMenu);
      offs.push(() => { clearTimeout(timer); frame.removeEventListener('pointerdown', down); frame.removeEventListener('pointermove', moveT); frame.removeEventListener('pointerup', up); frame.removeEventListener('pointercancel', up); frame.removeEventListener('pointerleave', up); frame.removeEventListener('contextmenu', noMenu); });
    }
    offs.push(() => cancelAnimationFrame(raf));
  }
  return () => offs.forEach((f) => f());
}
