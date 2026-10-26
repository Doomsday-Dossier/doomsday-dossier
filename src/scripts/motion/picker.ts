/**
 * Home team picker. Chips filter the roster and every card flies to its new place (Flip).
 * Magnetic Team Chain (fine pointers only): drag a card and its teammates peel out of the
 * grid on springs, fanning into formation behind it; let go and they snap home.
 * The chosen team is kept in the URL hash (#team=x-men) so a filtered roster can be shared.
 */
import { gsap, ScrollTrigger } from './grammar';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(Flip);

type Opts = { ease: string; pace: number; reduced: boolean };

export function teamPicker(root: ParentNode, o: Opts): () => void {
  const picker = root.querySelector<HTMLElement>('[data-picker]');
  if (!picker) return () => {};
  const chips = [...picker.querySelectorAll<HTMLButtonElement>('.pk-chips button')];
  const cards = [...picker.querySelectorAll<HTMLElement>('.pk-grid .card')];
  const blurbs = [...picker.querySelectorAll<HTMLElement>('.pk-blurb')];
  const grid = picker.querySelector<HTMLElement>('.pk-grid')!;
  const offs: (() => void)[] = [];

  const show = (team: string, animate = true) => {
    if (!chips.some((c) => c.dataset.team === team)) team = 'all';
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.team === team)));
    blurbs.forEach((b) => (b.hidden = b.dataset.for !== team));
    const state = animate && !o.reduced ? Flip.getState(cards) : null;
    // cards leave the layout while they fly: hold the grid's height so the page does not jump
    if (state) grid.style.minHeight = `${grid.offsetHeight}px`;
    cards.forEach((c) => c.classList.toggle('pk-out', team !== 'all' && c.dataset.team !== team));
    if (state) {
      Flip.from(state, {
        duration: 0.75, ease: 'power3.inOut', stagger: 0.015, absolute: true, scale: true, prune: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.85, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.03 }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.35, ease: 'power2.in' }),
        // the refresh re-measures every trigger on the page: run it once the cards have landed and the browser is idle
        onComplete: () => { grid.style.minHeight = ''; (window.requestIdleCallback || setTimeout)(() => ScrollTrigger.refresh()); },
      });
    } else ScrollTrigger.refresh();
  };
  chips.forEach((c) => {
    const on = () => {
      show(c.dataset.team!);
      history.replaceState(null, '', c.dataset.team === 'all' ? location.pathname + location.search : `#team=${c.dataset.team}`);
    };
    c.addEventListener('click', on);
    offs.push(() => c.removeEventListener('click', on));
  });
  const fromHash = location.hash.match(/team=([\w-]+)/)?.[1];
  if (fromHash) show(fromHash, false);

  // Magnetic Team Chain
  if (!o.reduced && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let lead: HTMLElement | null = null, crew: HTMLElement[] = [], movers: { x: (v: number) => void; y: (v: number) => void; r: (v: number) => void }[] = [];
    let sx = 0, sy = 0, dragging = false, justDragged = false, origin: DOMRect | null = null;
    const down = (e: PointerEvent) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.card.live');
      if (!card || e.button !== 0) return;
      lead = card; sx = e.clientX; sy = e.clientY; dragging = false;
    };
    const begin = () => {
      dragging = true;
      origin = lead!.getBoundingClientRect();
      crew = cards.filter((c) => c !== lead && c.dataset.team === lead!.dataset.team && !c.classList.contains('pk-out'));
      document.documentElement.classList.add('pk-dragging');
      lead!.classList.add('pk-lead', 'pk-team');
      crew.forEach((c) => c.classList.add('pk-team'));
      // stack order: the lead on top, each teammate one step below the one ahead of it
      gsap.set(lead!, { zIndex: 60 });
      crew.forEach((c, i) => gsap.set(c, { zIndex: 50 - i }));
      gsap.to([lead, ...crew], { rotateX: 0, rotateY: 0, duration: 0.3 });
      // each teammate is a little slower than the one before it: a chain on springs
      movers = crew.map((c, i) => ({
        x: gsap.quickTo(c, 'x', { duration: 0.35 + i * 0.12, ease: 'power3.out' }),
        y: gsap.quickTo(c, 'y', { duration: 0.35 + i * 0.12, ease: 'power3.out' }),
        r: gsap.quickTo(c, 'rotation', { duration: 0.5 + i * 0.1, ease: 'power3.out' }),
      }));
    };
    const move = (e: PointerEvent) => {
      if (!lead) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!dragging) { if (Math.hypot(dx, dy) < 8) return; begin(); }
      gsap.set(lead, { x: dx, y: dy, rotation: gsap.utils.clamp(-8, 8, (e.movementX || 0) * 0.6), scale: 1.04 });
      // formation: teammates fan out behind the lead, down and to the left like a dealt hand
      const lx = origin!.left + dx, ly = origin!.top + dy;
      crew.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const curX = Number(gsap.getProperty(c, 'x')), curY = Number(gsap.getProperty(c, 'y'));
        const homeX = r.left - curX, homeY = r.top - curY;
        const k = i + 1;
        movers[i].x(lx - homeX - k * 34);
        movers[i].y(ly - homeY + k * 22);
        movers[i].r(-k * 4);
      });
    };
    const up = () => {
      if (!lead) return;
      if (dragging) {
        justDragged = true; setTimeout(() => (justDragged = false), 0);
        const group = [lead, ...crew];
        gsap.to(group, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.55)', stagger: 0.04, overwrite: 'auto',
          onComplete: () => group.forEach((c) => { c.classList.remove('pk-lead', 'pk-team'); c.style.zIndex = ''; }) });
        document.documentElement.classList.remove('pk-dragging');
      }
      lead = null; dragging = false;
    };
    const click = (e: Event) => { if (justDragged) { e.preventDefault(); e.stopPropagation(); } };
    grid.addEventListener('pointerdown', down);
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    grid.addEventListener('click', click, true);
    grid.addEventListener('dragstart', (e) => e.preventDefault());
    offs.push(() => { grid.removeEventListener('pointerdown', down); removeEventListener('pointermove', move); removeEventListener('pointerup', up); grid.removeEventListener('click', click, true); document.documentElement.classList.remove('pk-dragging'); });
  }
  return () => offs.forEach((f) => f());
}
