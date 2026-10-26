/**
 * Timeline film strip (Film-Burn Scrubber). The strip scrolls natively (touch, trackpad,
 * shift-wheel); a mouse can also drag it with momentum, a vertical wheel over it scrolls
 * sideways, and the year scrubber below jumps through it. The frame nearest the centre is
 * lit and its details fill the panel. Speed drives the burn: fling it and the edges
 * scorch. Only opacity and transforms change per frame.
 */
type Opts = { ease: string; pace: number; reduced: boolean };

export function filmStrip(root: ParentNode, o: Opts): () => void {
  const page = root.querySelector<HTMLElement>('[data-timeline-page]');
  if (!page) return () => {};
  const strip = page.querySelector<HTMLElement>('[data-strip]')!;
  const all = [...page.querySelectorAll<HTMLElement>('[data-frame]')];
  const yearEl = page.querySelector<HTMLElement>('[data-year-out]')!;
  const out = page.querySelector<HTMLElement>('[data-detail-out]')!;
  const track = page.querySelector<HTMLElement>('[data-track]')!;
  const head = page.querySelector<HTMLElement>('[data-playhead]')!;
  const ticks = [...page.querySelectorAll<HTMLElement>('.tick')];
  const burn = page.querySelector<HTMLElement>('.burn')!;
  const chips = [...page.querySelectorAll<HTMLButtonElement>('.tlx-chips button')];
  const follow = page.querySelector<HTMLSelectElement>('[data-follow]')!;
  const offs: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(el: EventTarget, ev: K, fn: (e: HTMLElementEventMap[K]) => void, opt?: AddEventListenerOptions) => {
    el.addEventListener(ev, fn as EventListener, opt); offs.push(() => el.removeEventListener(ev, fn as EventListener, opt));
  };

  let shown: HTMLElement[] = [];
  let current: HTMLElement | null = null;
  const centreOf = (f: HTMLElement) => f.offsetLeft + f.offsetWidth / 2 - strip.clientWidth / 2;
  // frame centres are cached: they only change when the filters or the window size change
  let centres: number[] = [], half = 0;
  const measure = () => { centres = shown.map((f) => f.offsetLeft + f.offsetWidth / 2); half = strip.clientWidth / 2; };
  const nearest = () => {
    const mid = strip.scrollLeft + half;
    let best = 0, d = Infinity;
    for (let i = 0; i < centres.length; i++) { const dd = Math.abs(centres[i] - mid); if (dd < d) { d = dd; best = i; } }
    return shown[best];
  };
  const go = (f: HTMLElement | undefined, smooth = true) => { if (f) strip.scrollTo({ left: centreOf(f), behavior: smooth && !o.reduced ? 'smooth' : 'auto' }); };

  const update = () => {
    const f = nearest();
    if (!f) return;
    if (f !== current) {
      current?.classList.remove('on'); f.classList.add('on'); current = f;
      yearEl.textContent = f.dataset.year!;
      const t = f.querySelector<HTMLElement>('[data-detail]');
      out.replaceChildren(...(t ? [...t.cloneNode(true).childNodes] : []));
    }
    const i = shown.indexOf(f);
    head.style.transform = `translateX(${(shown.length > 1 ? i / (shown.length - 1) : 0) * track.clientWidth}px)`;
  };

  const layoutTicks = () => {
    const firstByDecade = new Map<string, number>();
    shown.forEach((f, i) => { const d = String(Math.floor(Number(f.dataset.year) / 10) * 10); if (!firstByDecade.has(d)) firstByDecade.set(d, i); });
    // decades with few frames sit close together: hide a label that would collide with the previous one
    const minGap = (innerWidth < 600 ? 64 : 58) / Math.max(1, track.clientWidth) * 100;
    let lastLeft = -Infinity;
    for (const t of ticks) {
      const i = firstByDecade.get(t.dataset.decade!);
      const left = i === undefined ? 0 : (shown.length > 1 ? i / (shown.length - 1) : 0) * 100;
      t.hidden = i === undefined || left - lastLeft < minGap;
      if (!t.hidden) { t.style.left = `${left}%`; lastLeft = left; }
    }
  };

  const apply = () => {
    const kind = chips.find((c) => c.getAttribute('aria-pressed') === 'true')?.dataset.kind || 'all';
    const who = follow.value;
    const keepYear = current ? Number(current.dataset.year) : 0;
    for (const f of all) {
      const isEra = f.dataset.kind === 'era';
      const people = (f.dataset.who || '').split(' ');
      let show = isEra ? who !== '' && f.dataset.eraOf === who && (kind === 'all' || kind === 'debut') : kind === 'all' || f.dataset.kind === kind;
      if (who && !isEra && f.dataset.kind !== 'news' && !people.includes(who)) show = false;
      f.hidden = !show;
    }
    shown = all.filter((f) => !f.hidden);
    measure();
    layoutTicks();
    current?.classList.remove('on'); current = null;
    const target = shown.find((f) => Number(f.dataset.year) >= keepYear) || shown[0];
    go(target, false); update();
  };
  chips.forEach((c) => on(c, 'click', () => { chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c))); apply(); }));
  on(follow, 'change', apply);

  // speed and burn
  let last = strip.scrollLeft, v = 0, raf = 0, heat = 0;
  const loop = () => {
    raf = 0;
    const now = strip.scrollLeft;
    v = v * 0.6 + (now - last) * 0.4; last = now;
    if (!o.reduced) {
      heat = Math.max(heat * 0.9, Math.min(1, Math.abs(v) / 90));
      burn.style.opacity = heat > 0.02 ? String(heat * (0.85 + Math.random() * 0.15)) : '0';
    }
    if (Math.abs(v) > 0.3 || heat > 0.02) raf = requestAnimationFrame(loop);
  };
  on(strip, 'scroll', () => { update(); if (!raf) raf = requestAnimationFrame(loop); }, { passive: true });

  // mouse drag with momentum (touch scrolls natively)
  let dragging = false, sx = 0, sl = 0, lastX = 0, lastT = 0, vx = 0, coast = 0;
  on(strip, 'pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    cancelAnimationFrame(coast); dragging = true; sx = lastX = e.clientX; sl = strip.scrollLeft; lastT = performance.now(); vx = 0;
    strip.classList.add('dragging'); strip.setPointerCapture(e.pointerId);
  });
  on(strip, 'pointermove', (e) => {
    if (!dragging) return;
    const t = performance.now(); vx = (e.clientX - lastX) / Math.max(1, t - lastT); lastX = e.clientX; lastT = t;
    strip.scrollLeft = sl - (e.clientX - sx);
  });
  const release = () => {
    if (!dragging) return;
    dragging = false; strip.classList.remove('dragging');
    let speed = -vx * 16;
    const step = () => {
      if (Math.abs(speed) < 0.6) { go(nearest()); return; }
      strip.scrollLeft += speed; speed *= 0.94; coast = requestAnimationFrame(step);
    };
    if (o.reduced) go(nearest()); else coast = requestAnimationFrame(step);
  };
  on(strip, 'pointerup', release); on(strip, 'pointercancel', release);
  on(strip, 'click', (e) => { if (Math.abs(lastX - sx) > 6) { e.preventDefault(); e.stopPropagation(); } }, { capture: true });

  // vertical wheel over the strip scrolls it sideways, until it reaches an end
  on(strip, 'wheel', (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const max = strip.scrollWidth - strip.clientWidth;
    if ((e.deltaY < 0 && strip.scrollLeft <= 0) || (e.deltaY > 0 && strip.scrollLeft >= max - 1)) return;
    e.preventDefault(); strip.scrollLeft += e.deltaY * 1.4;
  }, { passive: false });

  // keyboard and step buttons
  const step = (d: number) => { const i = current ? shown.indexOf(current) : 0; go(shown[Math.max(0, Math.min(shown.length - 1, i + d))]); };
  on(strip, 'keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); step(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); } });
  page.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) => on(b, 'click', () => step(Number(b.dataset.step))));

  // the year scrubber
  let scrubbing = false;
  const scrubTo = (x: number) => {
    const r = track.getBoundingClientRect();
    const i = Math.round(Math.max(0, Math.min(1, (x - r.left) / r.width)) * (shown.length - 1));
    go(shown[i], false);
  };
  on(track, 'pointerdown', (e) => { scrubbing = true; track.setPointerCapture(e.pointerId); scrubTo(e.clientX); });
  on(track, 'pointermove', (e) => { if (scrubbing) scrubTo(e.clientX); });
  on(track, 'pointerup', () => { scrubbing = false; });
  on(window, 'resize', () => { measure(); go(current || shown[0], false); update(); });

  const fromHash = location.hash.match(/follow=([\w-]+)/)?.[1];
  if (fromHash && [...follow.options].some((x) => x.value === fromHash)) follow.value = fromHash;
  on(follow, 'change', () => history.replaceState(null, '', follow.value ? `#follow=${follow.value}` : location.pathname));
  apply();
  return () => { offs.forEach((f) => f()); cancelAnimationFrame(raf); cancelAnimationFrame(coast); };
}
