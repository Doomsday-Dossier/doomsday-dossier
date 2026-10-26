/**
 * Site-wide finish, design system v2. A custom cursor on fine pointers (a dot and a trailing ring that
 * swells over anything you can use and names it: Open, Read, Drag), and page changes that close like a
 * file drawer and open on the next page instead of a bare reload. Reduced motion keeps the system
 * cursor and plain navigation.
 */
import { gsap } from 'gsap';
import { EASE } from './tokens';

export function cursor(reduced: boolean) {
  if (reduced || !matchMedia('(pointer: fine)').matches) return;
  const el = document.createElement('div');
  el.className = 'cur';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i class="cur-dot"></i><i class="cur-ring"><b class="cur-lbl"></b></i>';
  document.body.append(el);
  document.documentElement.classList.add('has-cur');
  const dot = el.querySelector<HTMLElement>('.cur-dot')!, ring = el.querySelector<HTMLElement>('.cur-ring')!, lbl = el.querySelector<HTMLElement>('.cur-lbl')!;
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08 }), dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.42, ease: 'power3.out' }), ry = gsap.quickTo(ring, 'y', { duration: 0.42, ease: 'power3.out' });
  let label = '';
  addEventListener('pointermove', (e) => {
    dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cursor], a, button, [role="radio"], summary, select, label');
    const next = t ? (t.dataset.cursor ?? (t.tagName === 'A' ? 'Open' : '')) : '';
    const active = !!t;
    if (next !== label || el.classList.contains('on') !== active) {
      label = next; lbl.textContent = next;
      el.classList.toggle('on', active); el.classList.toggle('lbl', !!next);
    }
  }, { passive: true });
  addEventListener('pointerdown', () => gsap.to(ring, { scale: 0.8, duration: 0.15, yoyo: true, repeat: 1 }));
  document.addEventListener('pointerleave', () => el.classList.add('out'));
  document.addEventListener('pointerenter', () => el.classList.remove('out'));
}

/** The index: slides down like a drawer, its links rising in; Escape or the button closes it. */
export function menu(reduced: boolean, lenis: { stop(): void; start(): void } | null) {
  const btn = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const panel = document.querySelector<HTMLElement>('[data-menu]');
  if (!btn || !panel) return;
  let open = false;
  const set = (on: boolean) => {
    if (on === open) return;
    open = on;
    btn.setAttribute('aria-expanded', String(on));
    document.documentElement.classList.toggle('menu-open', on);
    if (on) {
      panel.hidden = false; lenis?.stop();
      if (!reduced) {
        gsap.fromTo(panel, { yPercent: -100 }, { yPercent: 0, duration: 0.7, ease: EASE.file, overwrite: true });
        gsap.fromTo(panel.querySelectorAll('[data-menu-in]'), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.03, ease: EASE.reveal, delay: 0.25, overwrite: true });
      }
      panel.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
    } else {
      lenis?.start();
      const done = () => { panel.hidden = true; };
      if (reduced) done(); else gsap.to(panel, { yPercent: -100, duration: 0.55, ease: EASE.file, overwrite: true, onComplete: done });
      btn.focus({ preventScroll: true });
    }
  };
  btn.addEventListener('click', () => set(!open));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) set(false); });
}

const KEY = 'dd-pt';
/**
 * Page changes (seamless, through Astro's client router): the drawer closes over this page while the next one
 * loads, the new page swaps in under it, and the drawer lifts. The cover persists across swaps; its tweens
 * carry `data: 'keep'` so the page teardown in main.ts leaves them running.
 */
export function transitions(reduced: boolean) {
  const pt = document.querySelector<HTMLElement>('[data-pt]');
  if (!pt) return;
  const html = document.documentElement;
  // GSAP owns the cover's transform from here (it would otherwise read the CSS offset as extra pixels)
  gsap.set(pt, { y: 0, yPercent: html.classList.contains('pt-in') ? 0 : 101 });
  let up = html.classList.contains('pt-in');
  const lift = () => {
    if (!up) return;
    up = false;
    gsap.fromTo(pt, { yPercent: 0 }, { yPercent: -101, duration: reduced ? 0 : 0.75, ease: EASE.file, delay: 0.08, data: 'keep', onComplete: () => { html.classList.remove('pt-in'); gsap.set(pt, { yPercent: 101 }); } });
  };
  lift(); // arriving from a full page load that put the cover up
  try { sessionStorage.removeItem(KEY); } catch { /* private mode */ }
  document.addEventListener('astro:after-swap', lift);
  if (reduced) return;
  document.addEventListener('astro:before-preparation', (ev) => {
    const e = ev as Event & { sourceElement?: Element; loader: () => Promise<void> };
    const a = e.sourceElement?.closest?.('a');
    const name = pt.querySelector<HTMLElement>('[data-pt-name]');
    if (name) name.textContent = a ? ((a as HTMLElement).dataset.ptLabel || a.querySelector('b')?.textContent || a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    const load = e.loader;
    e.loader = async () => {
      up = true;
      const cover = new Promise<void>((res) => { gsap.fromTo(pt, { yPercent: 101 }, { yPercent: 0, duration: 0.6, ease: EASE.file, data: 'keep', onComplete: res }); });
      await Promise.all([cover, load()]);
    };
  });
}
