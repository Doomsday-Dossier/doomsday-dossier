import { gsap } from './grammar';
import type { Ctx } from '../gl/engine';

/**
 * DOM effects that pair with each hero shader, so the title itself carries the
 * character's motion idea, not just the background.
 */
export function characterExtras(scene: string, ctx: Ctx | null, reduced: boolean) {
  const title = document.querySelector<HTMLElement>('.hero-name');
  if (!title || reduced) return () => {};
  const cleanups: (() => void)[] = [];

  if (scene === 'forge') {
    // letters glow like metal cooling from the forge
    gsap.fromTo(title, { textShadow: '0 0 40px rgba(61,255,138,0.9)', color: '#d6ffe6' },
      { textShadow: '0 0 0px rgba(61,255,138,0)', color: 'var(--c-ink)', duration: 3.2, delay: 0.8, ease: 'power2.out' });
  }

  if (scene === 'quantum') {
    // optical size and weight follow scale: scroll shrinks the name toward the quantum realm
    const st = gsap.to(title, {
      fontVariationSettings: '"opsz" 9, "wght" 900', scale: 0.55, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
    gsap.fromTo(title, { fontVariationSettings: '"opsz" 144, "wght" 300' }, { fontVariationSettings: '"opsz" 144, "wght" 700', duration: 1.6, ease: 'back.out(1.6)' });
    cleanups.push(() => st.kill());
  }

  if (scene === 'cryo') {
    // name assembles like sliding metal plates: horizontal slices offset then lock
    title.classList.add('plates');
    const slices = 6;
    const text = title.textContent || '';
    title.setAttribute('aria-label', text);
    title.innerHTML = '';
    for (let i = 0; i < slices; i++) {
      const s = document.createElement('span');
      s.className = 'plate'; s.textContent = text; s.setAttribute('aria-hidden', 'true');
      s.style.clipPath = `inset(${(i * 100) / slices}% 0 ${100 - ((i + 1) * 100) / slices}% 0)`;
      title.appendChild(s);
    }
    gsap.from(title.querySelectorAll('.plate'), { xPercent: (i) => (i % 2 ? 30 : -30), opacity: 0, duration: 1.2, ease: 'steps(10)', stagger: 0.08, delay: 0.4 });
  }

  if (scene === 'radar' && ctx) {
    // reticle readout follows the pointer
    const hud = document.querySelector<HTMLElement>('.hud');
    if (hud) {
      const lat = hud.querySelector('[data-k="lat"]'), lon = hud.querySelector('[data-k="lon"]');
      const tick = () => {
        const inHero = window.scrollY < innerHeight * 0.85;
        hud.style.opacity = inHero ? '1' : '0';
        if (!inHero) return;
        const x = ctx.pointer.x, y = ctx.pointer.y;
        hud.style.transform = `translate(${x * innerWidth}px, ${(1 - y) * innerHeight}px)`;
        if (lat) lat.textContent = (y * 180 - 90).toFixed(3);
        if (lon) lon.textContent = (x * 360 - 180).toFixed(3);
      };
      gsap.ticker.add(tick);
      cleanups.push(() => gsap.ticker.remove(tick));
    }
  }

  if (scene === 'storm') {
    // the name flashes when lightning strikes (scene writes ctx.signal)
    const tick = () => {
      const f = ctx ? ctx.signal : 0;
      title.style.textShadow = `0 0 ${20 + f * 60}px rgba(143,211,255,${0.15 + f * 0.8})`;
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }

  if (scene === 'slipstream') {
    // the name leans into the wind with pointer velocity
    const skew = gsap.quickTo(title, 'skewX', { duration: 0.6, ease: 'power3.out' });
    const tick = () => { if (ctx) skew(gsap.utils.clamp(-14, 14, -ctx.pointer.vx * 6)); };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }

  if (scene === 'ink') {
    // letters settle like ink sinking through water
    gsap.from(title, { filter: 'blur(18px)', opacity: 0, letterSpacing: '0.3em', duration: 2.4, ease: 'power2.out', delay: 0.3 });
  }

  if (scene === 'ice') {
    // frosted name thaws as you scroll
    gsap.fromTo(title, { filter: 'blur(6px)', opacity: 0.6 }, { filter: 'blur(0px)', opacity: 1, duration: 2.2, ease: 'power2.out', delay: 0.5 });
  }

  return () => cleanups.forEach((c) => c());
}
