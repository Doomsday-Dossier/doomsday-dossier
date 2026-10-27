/**
 * Site-wide finish, design system v2. A custom cursor on fine pointers (a dot and a trailing ring that
 * swells over anything you can use and names it: Open, Read, Drag), and page changes that close like a
 * file drawer and open on the next page instead of a bare reload. Reduced motion keeps the system
 * cursor and plain navigation.
 */
import { gsap } from 'gsap';
import { EASE } from './tokens';
import { coverUp } from './cover';

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
  // a link in the index changes the page under the cover: the index is closed when the next page arrives
  document.addEventListener('astro:after-swap', () => set(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) set(false); });
}

/** Where an image is actually drawn inside its box (object-fit cover or contain, object-position), on screen. */
function drawnRect(img: HTMLImageElement) {
  const box = img.getBoundingClientRect(), cs = getComputedStyle(img);
  const a = (img.naturalWidth || 1) / (img.naturalHeight || 1);
  const fit = cs.objectFit === 'contain' ? Math.min : Math.max;
  const k = fit(box.width / a, box.height);
  const w = k * a, h = k;
  const [px, py] = cs.objectPosition.split(' ').map((v) => (v.endsWith('%') ? parseFloat(v) / 100 : 0.5));
  return { left: box.left + (box.width - w) * px, top: box.top + (box.height - h) * (py ?? 0.5), width: w, height: h };
}

/**
 * Page changes (seamless, through Astro's client router; CLAUDE.md, "Page changes"). Two covers:
 * - the handoff, for the next-file link at the foot of a file: the next subject's window opens out to fill the
 *   screen (a file sliding out of the drawer, with its sound), and the next file's hero appears beneath it;
 * - the redaction wipe, for every other link: black bars are drawn across the page like a censor's marker and
 *   tear away from the next page.
 * The cover goes up while the next page loads and stays while it builds; its waiting motion is CSS, which the
 * compositor runs smoothly even while the main thread is busy. main.ts calls `lift()` once the page is ready.
 * Both covers persist across swaps; their tweens carry `data: 'keep'` so the page teardown leaves them running.
 */
export function transitions(reduced: boolean, sounds: { slide(): void; redact(): void; tear(): void }) {
  const pt = document.querySelector<HTMLElement>('[data-pt]'), ho = document.querySelector<HTMLElement>('[data-ho]');
  let lift: () => Promise<void> = () => Promise.resolve();
  if (!pt || !ho || reduced) return { lift: () => lift() };
  const bars = [...pt.querySelectorAll<HTMLElement>('.pt-bar')], ptName = pt.querySelector<HTMLElement>('[data-pt-name]')!;
  const dim = ho.querySelector<HTMLElement>('.ho-dim')!, clip = ho.querySelector<HTMLElement>('.ho-clip')!, push = ho.querySelector<HTMLElement>('.ho-push')!, img = ho.querySelector<HTMLImageElement>('.ho-img')!, cap = ho.querySelector<HTMLElement>('.ho-cap')!;
  const phone = () => innerWidth < 760;

  // THE REDACTION WIPE
  const wipe = (label: string) => {
    ptName.textContent = label;
    pt.classList.add('on', 'wait');
    sounds.redact();
    const tl = gsap.timeline({ data: 'keep' })
      .fromTo(bars, { scaleX: 0, transformOrigin: (i: number) => (i % 2 ? '100% 50%' : '0% 50%') }, { scaleX: 1, duration: 0.38, stagger: 0.04, ease: 'power3.inOut' })
      .fromTo(ptName, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25, ease: EASE.reveal }, 0.3);
    lift = () => new Promise<void>((res) => {
      lift = () => Promise.resolve();
      tl.kill();
      pt.classList.remove('wait'); pt.classList.add('out');
      sounds.tear();
      gsap.timeline({ data: 'keep', onComplete: () => { pt.classList.remove('on', 'out'); gsap.set(bars, { scaleX: 0 }); res(); } })
        .to(ptName, { opacity: 0, duration: 0.15 })
        .set(bars, { transformOrigin: (i: number) => (i % 2 ? '0% 50%' : '100% 50%') })
        .to(bars, { scaleX: 0, duration: 0.42, stagger: { each: 0.045, from: 'center' }, ease: 'power3.in' }, 0.05);
      gsap.delayedCall(0.2, sounds.tear);
    });
    return tl;
  };

  // THE HANDOFF: the next subject's window opens out to the whole screen
  const handoff = (win: HTMLElement, label: string) => {
    const src = win.querySelector<HTMLImageElement>('img');
    const r = win.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    ho.style.setProperty('--na', getComputedStyle(win).getPropertyValue('--na') || getComputedStyle(document.body).getPropertyValue('--accent'));
    cap.textContent = label;
    gsap.set(push, { clearProps: 'transform' });
    let from = { x: 0, y: 0, scale: 1 };
    if (src && src.complete && src.naturalWidth) {
      // the photo keeps its proportions: placed where the next hero shows its subject, and flown there from where
      // it sits in the window now
      const a = src.naturalWidth / src.naturalHeight, cut = src.classList.contains('cut');
      const frame = (JSON.parse(win.closest<HTMLElement>('[data-voyage]')?.dataset.next || '{}') as { frame?: { head: number; bbox: [number, number, number, number]; aspect: number } }).frame;
      let w: number, h: number, x: number, y: number;
      if (cut && frame) {
        // the same layout as the diorama (depth.ts, Diorama.resize), in pixels: the scene is 1.1 units tall on
        // screen at the subject's depth, the subject's outline sized and stood on the floor the same way
        const vh = 1.1, vw = vh * (W / H), px = H / vh, ph = W < 760;
        const [x0, y0, x1] = frame.bbox;
        const k = Math.min(((ph ? 0.64 : 0.84) * vh) / Math.max(0.2, 1 - y0), ((ph ? 2.4 : 0.62) * vw) / Math.max(0.1, frame.aspect * (x1 - x0)));
        const cx = -(frame.head - 0.5) * frame.aspect * k + (ph ? 0 : vw * 0.17), cy = -vh / 2 + 0.5 * k + (ph ? vh * 0.12 : 0);
        h = k * px; w = h * a; x = W / 2 + cx * px - w / 2; y = H / 2 - cy * px - h / 2;
      } else if (cut) {
        h = H * (phone() ? 0.64 : 0.86); w = h * a;
        x = (W - w) / 2 + (phone() ? 0 : W * 0.12); y = H - h - (phone() ? H * 0.12 : 0);
      } else {
        const k = Math.max(W / a, H); w = k * a; h = k; x = (W - w) / 2; y = (H - h) * 0.3;
      }
      img.src = src.currentSrc || src.src;
      Object.assign(img.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, display: 'block' });
      const d = drawnRect(src);
      from = { x: d.left - x, y: d.top - y, scale: d.width / w };
    } else img.style.display = 'none';
    win.style.visibility = 'hidden';
    ho.classList.add('on');
    sounds.slide();
    const inset = `inset(${r.top}px ${W - r.right}px ${H - r.bottom}px ${r.left}px round 40px)`;
    const tl = gsap.timeline({ data: 'keep', onComplete: () => ho.classList.add('wait') })
      .fromTo(dim, { opacity: 0 }, { opacity: 0.75, duration: 0.6, ease: 'power2.out' }, 0)
      .fromTo(clip, { clipPath: inset, opacity: 1 }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', duration: 0.85, ease: EASE.file }, 0)
      .fromTo(img, { x: from.x, y: from.y, scale: from.scale, transformOrigin: '0 0' }, { x: 0, y: 0, scale: 1, duration: 0.85, ease: EASE.file }, 0)
      .fromTo(cap, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: EASE.reveal }, 0.55);
    lift = () => new Promise<void>((res) => {
      lift = () => Promise.resolve();
      tl.progress(1).kill();
      // hand the CSS waiting push over to GSAP where it stands, then let the photo dissolve into the hero
      gsap.set(push, { transform: getComputedStyle(push).transform });
      ho.classList.remove('wait'); ho.classList.add('out');
      gsap.timeline({ data: 'keep', onComplete: () => { ho.classList.remove('on', 'out'); gsap.set([clip, dim, cap, img, push], { clearProps: 'all' }); img.removeAttribute('src'); res(); } })
        .to(cap, { opacity: 0, duration: 0.2 }, 0)
        .to(push, { scale: 1.12, duration: 1.1, ease: 'power2.out' }, 0)
        .to(clip, { opacity: 0, duration: 0.75, ease: 'power2.inOut' }, 0.05)
        .to(dim, { opacity: 0, duration: 0.3 }, 0);
    });
    return tl;
  };

  document.addEventListener('astro:before-preparation', (ev) => {
    const e = ev as Event & { sourceElement?: Element; loader: () => Promise<void> };
    const a = e.sourceElement?.closest?.('a') as HTMLElement | null;
    const label = a ? (a.dataset.ptLabel || a.querySelector('b')?.textContent || a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    const win = a?.hasAttribute('data-handoff') ? a.closest('[data-voyage]')?.querySelector<HTMLElement>('[data-voy-window]') : null;
    const load = e.loader;
    e.loader = async () => {
      coverUp(win ? 'handoff' : 'wipe');
      const tl = win ? handoff(win, label) : wipe(label);
      await Promise.all([new Promise<void>((res) => { tl.then(() => res()); }), load()]);
    };
  });
  return { lift: () => lift() };
}
