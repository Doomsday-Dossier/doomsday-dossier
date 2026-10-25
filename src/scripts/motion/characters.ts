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

  if (scene === 'elastic' && ctx) {
    // the name stretches: width axis follows the pointer, weight follows its speed
    let w = 100, wt = 800;
    const tick = () => {
      const tw = 60 + ctx.pointer.x * 90;
      const speed = Math.min(1, Math.hypot(ctx.pointer.vx, ctx.pointer.vy));
      w += (tw - w) * 0.08; wt += (500 + (1 - speed) * 400 - wt) * 0.1;
      title.style.fontVariationSettings = `"wdth" ${w.toFixed(1)}, "wght" ${wt.toFixed(0)}`;
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }

  if (scene === 'ripple' && ctx) {
    // letters near the pointer turn invisible, like Sue's power
    let chars: { el: HTMLElement; x: number; y: number }[] = [];
    const measure = () => {
      chars = [...title.querySelectorAll<HTMLElement>('.split-char')].map((el) => {
        const r = el.getBoundingClientRect();
        return { el, x: r.left + r.width / 2, y: r.top + r.height / 2 + window.scrollY };
      });
    };
    const t0 = setTimeout(measure, 2200);
    addEventListener('resize', measure);
    const tick = () => {
      if (!chars.length) return;
      const px = ctx.pointer.x * innerWidth, py = (1 - ctx.pointer.y) * innerHeight + window.scrollY;
      for (const c of chars) {
        const d = Math.hypot(c.x - px, c.y - py);
        const o = Math.min(1, Math.max(0.04, (d - 60) / 140));
        c.el.style.opacity = o.toFixed(2);
      }
    };
    gsap.ticker.add(tick);
    cleanups.push(() => { gsap.ticker.remove(tick); clearTimeout(t0); removeEventListener('resize', measure); });
  }

  if (scene === 'flame') {
    // weight and glow flicker like a flame
    const tick = () => {
      const t = performance.now() / 1000;
      const f = 0.5 + 0.3 * Math.sin(t * 7.3) + 0.2 * Math.sin(t * 13.1 + 1.7);
      title.style.fontVariationSettings = `"wght" ${(620 + f * 180).toFixed(0)}`;
      title.style.textShadow = `0 0 ${18 + f * 30}px rgba(255,120,40,${0.35 + f * 0.35}), 0 -4px ${30 + f * 40}px rgba(255,190,90,${0.15 + f * 0.2})`;
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }

  if (scene === 'rock' && ctx) {
    // the name takes the hit when the wall is clobbered
    const tick = () => {
      const s = ctx.signal;
      title.style.transform = s > 0.01 ? `translate(${((Math.random() - 0.5) * 14 * s).toFixed(1)}px, ${((Math.random() - 0.5) * 10 * s).toFixed(1)}px)` : '';
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }

  return () => cleanups.forEach((c) => c());
}
