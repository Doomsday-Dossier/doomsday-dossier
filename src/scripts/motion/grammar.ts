import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { glideTo } from './scroller';

gsap.registerPlugin(ScrollTrigger, SplitText);

type Opts = { ease: string; pace: number; reduced: boolean };

const splits: SplitText[] = [];
const mms: gsap.MatchMedia[] = [];

/** Split-text reveals. data-split="chars|words|lines", data-split-on="load|scroll". */
export function splitReveals(root: ParentNode, o: Opts) {
  root.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
    if (o.reduced) return;
    const mode = (el.dataset.split || 'lines') as 'chars' | 'words' | 'lines';
    const split = SplitText.create(el, {
      type: mode === 'lines' ? 'lines' : mode === 'words' ? 'lines,words' : 'lines,words,chars',
      linesClass: 'split-line', wordsClass: 'split-word', charsClass: 'split-char',
      mask: 'lines', autoSplit: true,
      onSplit(self) {
        const targets = mode === 'chars' ? self.chars : mode === 'words' ? self.words : self.lines;
        const onLoad = el.dataset.splitOn === 'load';
        const delay = parseFloat(el.dataset.delay || '0');
        const style = el.dataset.splitStyle || 'rise';
        const from: gsap.TweenVars =
          style === 'stamp' ? { scale: 1.6, opacity: 0, filter: 'blur(12px)' } :
          style === 'drop' ? { yPercent: -120, opacity: 0 } :
          style === 'slide' ? { xPercent: -40, opacity: 0 } :
          style === 'glitch' ? { opacity: 0, xPercent: () => gsap.utils.random(-60, 60) } :
          style === 'scale' ? { scale: 0.1, opacity: 0, transformOrigin: '50% 100%' } :
          { yPercent: 115 };
        return gsap.from(targets, {
          ...from,
          duration: (mode === 'chars' ? 1.1 : 1.0) * o.pace,
          ease: style === 'glitch' ? 'steps(6)' : o.ease,
          stagger: mode === 'chars' ? 0.035 * o.pace : mode === 'words' ? 0.05 * o.pace : 0.09 * o.pace,
          delay,
          scrollTrigger: onLoad ? undefined : { trigger: el, start: 'top 85%', once: true },
        });
      },
    });
    splits.push(split);
  });
}

/** Simple fade-up for blocks marked data-reveal. */
export function blockReveals(root: ParentNode, o: Opts) {
  if (o.reduced) return;
  root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 40, opacity: 0, duration: 1.1 * o.pace, ease: o.ease.startsWith('steps') ? 'power3.out' : o.ease,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
}

/** Big outlined year that drifts sideways as you scroll past (origin act). */
export function driftType(root: ParentNode, o: Opts) {
  if (o.reduced) return;
  root.querySelectorAll<HTMLElement>('[data-drift]').forEach((el) => {
    const amt = parseFloat(el.dataset.drift || '-20');
    gsap.fromTo(el, { xPercent: 0 }, { xPercent: amt, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}

/**
 * Comics act. Wide screens: Panel Flythrough, a pinned corridor of comic panels that
 * scroll flies through; the panel in front is always flat and full size, panels ahead
 * wait in depth on alternating sides, passed ones fly past the camera. It only runs when
 * the tallest panel fits the screen; otherwise, and on phones, the eras stack with a
 * scrubbed progress line.
 */
export function comicsTimeline(root: ParentNode, o: Opts) {
  const sec = root.querySelector<HTMLElement>('[data-timeline]');
  if (!sec) return;
  const track = sec.querySelector<HTMLElement>('.tl-track')!;
  const bar = sec.querySelector<HTMLElement>('.tl-progress i');
  const mm = gsap.matchMedia(); mms.push(mm);
  mm.add({ wide: '(min-width: 900px)', reduced: '(prefers-reduced-motion: reduce)' }, (c) => {
    sec.classList.remove('tl-fly');
    const { wide, reduced } = c.conditions as { wide: boolean; reduced: boolean };
    if (reduced || o.reduced) return;
    const cards = gsap.utils.toArray<HTMLElement>('.tl-card', track);
    let fly = false;
    let undo = () => {};
    if (wide) {
      sec.classList.add('tl-fly');
      // the front panel must fit on screen while pinned, or text would be cut off
      const tallest = Math.max(...cards.map((c) => c.getBoundingClientRect().height));
      const top = track.getBoundingClientRect().top - sec.getBoundingClientRect().top;
      fly = top + tallest + 40 <= window.innerHeight;
      if (fly) track.style.height = `${tallest}px`;
      else sec.classList.remove('tl-fly');
    }
    if (fly) {
      const n = cards.length;
      const depth = 560, side = Math.min(innerWidth * 0.2, 300);
      const place = (t: number) => {
        cards.forEach((card, i) => {
          const d = i - t; // how far ahead of the front this panel is
          const ahead = Math.max(0, d), passed = Math.min(0, d);
          const dir = i % 2 ? 1 : -1;
          // ahead: waits in depth on alternating sides; passed: peels away to its side and fades fast
          gsap.set(card, {
            x: dir * (Math.min(ahead, 3) * side * 1.7 - passed * side * 1.6), y: -Math.min(ahead, 3) * 40 + passed * 40,
            z: -ahead * depth - passed * 260, rotationY: -dir * (Math.min(ahead, 1) * 14 - passed * 30),
            opacity: d < 0 ? Math.max(0, 1 + d * 3.2) : Math.max(0, 1 - Math.max(0, d - 0.15) * 0.3),
          });
          // depth sorts the panels (z-index is ignored in 3D); touch pointer-events only when it changes
          const live = Math.abs(d) < 0.5;
          if (card.dataset.live !== String(live)) { card.dataset.live = String(live); card.style.pointerEvents = live ? 'auto' : 'none'; }
        });
      };
      place(0);
      let rest = 0;
      ScrollTrigger.create({
        trigger: sec, start: 'top top', end: () => `+=${(n - 1) * innerHeight * 0.85}`, pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (st) => {
          place(st.progress * (n - 1));
          // always come to rest with one panel squarely in front: when scrolling pauses, glide there
          clearTimeout(rest);
          rest = window.setTimeout(() => {
            if (!st.isActive) return;
            const target = st.start + (Math.round(st.progress * (n - 1)) / (n - 1)) * (st.end - st.start);
            if (Math.abs(target - st.scroll()) > 2) glideTo(target, 0.5);
          }, 160); if (bar) bar.style.transform = `scaleX(${st.progress})`; },
      });
      undo = () => { track.style.height = ''; gsap.set(cards, { clearProps: 'all' }); };
    } else {
      if (bar && !wide) gsap.fromTo(bar, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: track, start: 'top 70%', end: 'bottom 70%', scrub: true } });
      cards.forEach((card) => gsap.from(card, { x: 30, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: card, start: 'top 85%', once: true } }));
    }
    return () => undo();
  });
}

/** Screen act: the film list scrubs a year counter and lights the active entry. */
export function screenStrip(root: ParentNode, o: Opts) {
  const sec = root.querySelector<HTMLElement>('[data-screens]');
  if (!sec) return;
  const items = gsap.utils.toArray<HTMLElement>('.scr-item', sec);
  const yearEl = sec.querySelector<HTMLElement>('.scr-year');
  const contEl = sec.querySelector<HTMLElement>('.scr-cont');
  items.forEach((it) => {
    ScrollTrigger.create({
      trigger: it, start: 'top 60%', end: 'bottom 60%',
      onToggle: (st) => {
        it.classList.toggle('on', st.isActive);
        if (st.isActive) {
          if (yearEl) yearEl.textContent = it.dataset.year || '';
          if (contEl) { contEl.textContent = it.dataset.cont || ''; contEl.dataset.cont = it.dataset.cont || ''; }
        }
      },
    });
    if (!o.reduced) gsap.from(it.querySelector('.scr-body'), { y: 30, opacity: 0, duration: 0.9 * o.pace, ease: o.ease.startsWith('steps') ? 'power3.out' : o.ease, scrollTrigger: { trigger: it, start: 'top 85%', once: true } });
  });
  // filters
  sec.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter!;
      sec.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      items.forEach((it) => { it.hidden = f !== 'ALL' && it.dataset.cont !== f; });
      ScrollTrigger.refresh();
    });
  });
}

/** Live countdown to release, in the viewer's local time at midnight on the date. */
export function countdowns(root: ParentNode, iso: string) {
  const els = root.querySelectorAll<HTMLElement>('[data-countdown]');
  if (!els.length) return () => {};
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d, 0, 0, 0).getTime();
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  const tick = () => {
    const ms = Math.max(0, target - Date.now());
    const days = Math.floor(ms / 864e5), hrs = Math.floor(ms / 36e5) % 24, min = Math.floor(ms / 6e4) % 60, sec = Math.floor(ms / 1e3) % 60;
    els.forEach((el) => {
      const set = (k: string, v: string) => { const n = el.querySelector(`[data-k="${k}"]`); if (n && n.textContent !== v) n.textContent = v; };
      set('d', pad(days, 3)); set('h', pad(hrs)); set('m', pad(min)); set('s', pad(sec));
      if (ms === 0) el.classList.add('arrived');
    });
  };
  tick();
  const id = window.setInterval(tick, 1000);
  return () => clearInterval(id);
}

/** Magnetic hover for elements marked data-magnet (desktop pointers only). */
export function magnets(root: ParentNode, o: Opts) {
  if (o.reduced || !matchMedia('(hover: hover)').matches) return;
  root.querySelectorAll<HTMLElement>('[data-magnet]').forEach((el) => {
    const s = parseFloat(el.dataset.magnet || '0.3');
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * s); yTo((e.clientY - r.top - r.height / 2) * s);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/** Cards that tilt toward the cursor and track a glow position (roster). */
export function tiltCards(root: ParentNode, o: Opts) {
  if (o.reduced || !matchMedia('(hover: hover)').matches) return;
  root.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
    const rx = gsap.quickTo(el, 'rotateX', { duration: 0.5, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotateY', { duration: 0.5, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      ry((px - 0.5) * 10); rx(-(py - 0.5) * 10);
      el.style.setProperty('--gx', `${px * 100}%`); el.style.setProperty('--gy', `${py * 100}%`);
    });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });
}

export function killAll() {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  splits.splice(0).forEach((s) => s.revert());
  gsap.globalTimeline.getChildren(true, true, false).forEach((t) => t.kill());
  mms.splice(0).forEach((m) => m.revert());
}

export { gsap, ScrollTrigger };
