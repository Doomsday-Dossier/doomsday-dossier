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

  // Letters that move after the intro must not be clipped by the reveal masks.
  if (scene === 'magnet' || scene === 'bamf') {
    const t = setTimeout(() => title.querySelectorAll<HTMLElement>('.split-line').forEach((l) => { l.style.overflow = 'visible'; }), 2000);
    cleanups.push(() => clearTimeout(t));
  }

  // Shared helper: cached centres of the split title characters.
  const charBox = () => [...title.querySelectorAll<HTMLElement>('.split-char')].map((el) => {
    const r = el.getBoundingClientRect();
    return { el, x: r.left + r.width / 2, y: r.top + r.height / 2 + window.scrollY };
  });

  if (scene === 'cerebro') {
    // a scanning beam passes across the name, lighting each letter as it goes
    let chars: ReturnType<typeof charBox> = [];
    const t0 = setTimeout(() => { chars = charBox(); }, 2200);
    const tick = () => {
      if (!chars.length) return;
      const sweep = ((performance.now() / 1000) * 0.35 % 1.6 - 0.3) * innerWidth;
      for (const c of chars) {
        const g = Math.max(0, 1 - Math.abs(c.x - sweep) / 120);
        c.el.style.textShadow = g > 0.01 ? `0 0 ${10 + g * 30}px rgba(140,190,255,${(g * 0.9).toFixed(2)})` : '';
      }
    };
    gsap.ticker.add(tick);
    cleanups.push(() => { gsap.ticker.remove(tick); clearTimeout(t0); });
  }

  if (scene === 'magnet' && ctx) {
    // letters are drawn toward the pointer like iron to a pole
    let chars: { el: HTMLElement; x: number; y: number; xTo: gsap.QuickToFunc; yTo: gsap.QuickToFunc }[] = [];
    const t0 = setTimeout(() => {
      chars = charBox().map((c) => ({ ...c, xTo: gsap.quickTo(c.el, 'x', { duration: 0.7, ease: 'power3.out' }), yTo: gsap.quickTo(c.el, 'y', { duration: 0.7, ease: 'power3.out' }) }));
    }, 2200);
    const tick = () => {
      if (!chars.length) return;
      const px = ctx.pointer.x * innerWidth, py = (1 - ctx.pointer.y) * innerHeight + window.scrollY;
      const pol = window.scrollY > innerHeight * 0.35 ? -1 : 1;
      for (const c of chars) {
        const dx = px - c.x, dy = py - c.y, d = Math.hypot(dx, dy) + 1;
        const f = Math.min(18, 4000 / (d * 1.2)) * pol;
        c.xTo((dx / d) * f); c.yTo((dy / d) * f);
      }
    };
    gsap.ticker.add(tick);
    cleanups.push(() => { gsap.ticker.remove(tick); clearTimeout(t0); });
  }

  if (scene === 'optic' && ctx) {
    // the name flares red when the beam fires
    const tick = () => {
      const f = ctx.signal;
      title.style.textShadow = `0 0 ${12 + f * 50}px rgba(255,40,60,${(0.2 + f * 0.75).toFixed(2)})`;
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }

  if (scene === 'bamf' && ctx) {
    // on every jump, one letter vanishes in a puff and reappears
    let last = 0;
    const tick = () => {
      if (ctx.signal > 0.9 && performance.now() - last > 500) {
        last = performance.now();
        const chars = title.querySelectorAll<HTMLElement>('.split-char');
        const el = chars[Math.floor(Math.random() * chars.length)];
        if (el) gsap.timeline()
          .to(el, { scale: 0, opacity: 0, filter: 'blur(8px)', duration: 0.12, ease: 'power2.in' })
          .set(el, { y: gsap.utils.random(-30, 30) })
          .to(el, { scale: 1, opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.5, ease: 'back.out(2)' }, '+=0.25');
      }
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }

  if (scene === 'reaction') {
    // the name keeps shifting between typefaces
    const faces = ["'DM Serif Display', serif", "'Unbounded Variable', sans-serif", "'Italiana', serif", "'Teko Variable', sans-serif", "'Gloock', serif", "'Rye', serif"];
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % faces.length;
      gsap.timeline()
        .to(title, { filter: 'blur(10px)', opacity: 0.3, duration: 0.25, ease: 'power2.in' })
        .add(() => { title.style.fontFamily = faces[i]; })
        .to(title, { filter: 'blur(0px)', opacity: 1, duration: 0.45, ease: 'power2.out' });
    }, 2600);
    cleanups.push(() => clearInterval(id));
  }

  if (scene === 'fur' && ctx) {
    // a soft halo that leans away from the pointer, like fur being brushed
    const tick = () => {
      const dx = (0.5 - ctx.pointer.x) * 10, dy = (ctx.pointer.y - 0.5) * 10;
      title.style.textShadow = `${dx.toFixed(1)}px ${dy.toFixed(1)}px 18px rgba(90,130,255,0.45), ${(dx * 2).toFixed(1)}px ${(dy * 2).toFixed(1)}px 36px rgba(40,70,200,0.3)`;
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }

  if (scene === 'cards' && ctx) {
    // the name kicks with each detonation
    const tick = () => {
      const s = ctx.signal;
      title.style.textShadow = `0 0 ${10 + s * 40}px rgba(255,70,190,${(0.15 + s * 0.8).toFixed(2)})`;
      title.style.transform = s > 0.05 ? `rotate(${((Math.random() - 0.5) * 2 * s).toFixed(2)}deg)` : '';
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }

  if (scene === 'shafts' && ctx) {
    // letters nearest the light are lit; the rest sit in shadow
    let chars: ReturnType<typeof charBox> = [];
    const t0 = setTimeout(() => { chars = charBox(); }, 2200);
    const tick = () => {
      if (!chars.length) return;
      const lx = ctx.pointer.x * innerWidth;
      for (const c of chars) {
        const g = Math.max(0, 1 - Math.abs(c.x - lx) / (innerWidth * 0.35));
        c.el.style.opacity = (0.35 + 0.65 * g).toFixed(2);
        c.el.style.textShadow = g > 0.4 ? `0 0 ${(g * 28).toFixed(0)}px rgba(255,70,80,${(g * 0.6).toFixed(2)})` : '';
      }
    };
    gsap.ticker.add(tick);
    cleanups.push(() => { gsap.ticker.remove(tick); clearTimeout(t0); });
  }

  if (scene === 'bokeh' && ctx) {
    // the name racks focus with the snow
    const tick = () => { title.style.filter = `blur(${Math.min(6, ctx.signal * 30).toFixed(1)}px)`; };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }

  if (scene === 'tags' && ctx) {
    // the name swings with the tags
    title.style.transformOrigin = '50% -40%';
    const tick = () => { title.style.transform = `perspective(900px) rotateZ(${(-ctx.signal * 4).toFixed(2)}deg) rotateY(${((ctx.pointer.x - 0.5) * 14).toFixed(1)}deg)`; };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }

  if (scene === 'phase' && ctx) {
    // letters slip out of phase for a frame at a time
    const tick = () => {
      if (ctx.signal < 1) return;
      const chars = title.querySelectorAll<HTMLElement>('.split-char');
      const el = chars[Math.floor(Math.random() * chars.length)];
      if (!el) return;
      gsap.timeline().set(el, { x: gsap.utils.random(-14, 14), opacity: 0.35, color: 'var(--c-accent)' }).set(el, { x: 0, opacity: 1, color: '' }, 0.09);
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }

  if (scene === 'sunvoid' && ctx) {
    // a golden name that the void eats from the right as you scroll
    const tick = () => {
      const edge = 110 - ctx.signal * 130;
      title.style.webkitMaskImage = title.style.maskImage = `linear-gradient(90deg, #000 ${edge - 20}%, transparent ${edge}%)`;
      title.style.textShadow = `0 0 ${24 + 10 * Math.sin(performance.now() / 600)}px rgba(255,200,90,0.45)`;
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));
  }

  return () => cleanups.forEach((c) => c());
}
