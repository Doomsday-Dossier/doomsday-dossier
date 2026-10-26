/**
 * The archive (v2 home), after Particle Self and Anchor AI. One cloud of points runs the whole page.
 *
 * Intro (first visit, under five seconds, skippable): a loading count runs while a loose nebula gathers
 * into Doom, built in real 3D from his photo and its depth map; DOOMSDAY DOSSIER types in and the
 * countdown arrives on its own panel. Return visits gather in about a second.
 *
 * Roll call: scrolling the pinned stage morphs the same cloud from character to character through all
 * 29 files. Between two figures the points swirl out and the cloud makes half a turn; the backdrop glow
 * takes the next character's colour and their name types in bottom-left, in front of the cloud. The
 * points scatter away from the cursor or a finger, and the cloud turns slowly toward the pointer.
 */
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Ctx, HeroScene } from '../gl/engine';
import { fitText } from '../motion/grammar';
import { C, EASE, INTRO_KEY, timeLeft } from './tokens';
import type { Cloud } from './cloud';
import { Swarm, cloudLoader } from './swarm';
import type Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

type FileInfo = { slug: string; no: number; total: number; name: string; team: string; accent: string; href: string; cloud: Cloud | null };

type Env = { engine: { ctx: Ctx; mount(s: HeroScene): Promise<void>; renderer: THREE.WebGLRenderer } | null; lenis: Lenis | null; reduced: boolean; phone: boolean };

export async function archive(env: Env) {
  const root = document.querySelector<HTMLElement>('[data-archive]');
  const raw = document.getElementById('dx-files');
  if (!root || !raw) return;
  const files = JSON.parse(raw.textContent || '[]') as FileInfo[];
  const roll = root.querySelector<HTMLElement>('[data-roll]')!;
  const intro = root.querySelector<HTMLElement>('[data-intro]')!;
  const chars = [...intro.querySelectorAll<HTMLElement>('[data-title] .ch')];
  const after = [...intro.querySelectorAll<HTMLElement>('[data-after]')];
  const skip = intro.querySelector<HTMLButtonElement>('[data-skip]')!;
  const count = intro.querySelector<HTMLElement>('[data-count]')!;
  const loader = intro.querySelector<HTMLElement>('[data-loader]')!;
  const pct = intro.querySelector<HTMLElement>('[data-pct]')!;
  const call = root.querySelector<HTMLElement>('[data-call]')!;
  fitText(root);

  // countdown, the same maths as everywhere else
  const tick = () => {
    const t = timeLeft();
    const set = (k: string, v: number) => { const el = count.querySelector(`[data-k="${k}"]`); const s = String(v).padStart(2, '0'); if (el && el.textContent !== s) el.textContent = s; };
    set('d', t.d); set('h', t.h); set('m', t.m); set('s', t.s);
  };
  tick(); setInterval(tick, 1000);

  if (!env.engine) { gsap.set([...chars, ...after], { opacity: 1 }); return; }

  const N = env.phone ? 20000 : 42000;
  const sc = new Swarm(N);
  sc.n0 = files.length;
  const ensure = cloudLoader(sc, N, files.map((f) => f.cloud));
  await ensure(0);
  ensure(1); ensure(2);

  const seen = (() => { try { return localStorage.getItem(INTRO_KEY) === '1'; } catch { return false; } })();
  if (env.reduced) {
    sc.gather = 1; sc.glow = 1; sc.setPair(0, 0);
    await env.engine.mount(sc);
    gsap.set([...chars, ...after], { opacity: 1 });
    return;
  }
  await env.engine.mount(sc);
  env.engine.renderer.setClearColor(new THREE.Color(C.gunmetal), 1);

  // intro
  env.lenis?.stop();
  const done = () => {
    try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* private mode */ }
    env.lenis?.start(); skip.hidden = true;
    gsap.to(loader, { opacity: 0, duration: 0.4 });
  };
  const tl = gsap.timeline({ onComplete: done });
  if (!seen) {
    skip.hidden = false;
    const n = { v: 0 };
    tl.to(loader, { opacity: 1, duration: 0.3 }, 0)
      .to(n, { v: 100, duration: 2.6, ease: 'power2.inOut', onUpdate: () => { pct.textContent = String(Math.round(n.v)).padStart(3, '0'); } }, 0)
      .to(sc, { glow: 1, duration: 2, ease: EASE.glow }, 0.2)
      .to(sc, { gather: 1, duration: 3.1, ease: 'power3.inOut' }, 0.1)
      .fromTo(chars, { opacity: 0, yPercent: 60 }, { opacity: 1, yPercent: 0, duration: 0.5, stagger: 0.045, ease: EASE.reveal }, 2.6)
      .fromTo(after, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: EASE.reveal }, 3.2);
  } else {
    tl.to(sc, { glow: 1, duration: 0.8, ease: EASE.glow }, 0)
      .to(sc, { gather: 1, duration: 1.3, ease: 'power3.out' }, 0)
      .fromTo(chars, { opacity: 0, yPercent: 60 }, { opacity: 1, yPercent: 0, duration: 0.45, stagger: 0.025, ease: EASE.reveal }, 0.15)
      .fromTo(after, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: EASE.reveal }, 0.4);
  }
  const skipNow = () => { if (tl.progress() < 1) tl.progress(1); };
  addEventListener('keydown', (e) => { if (!['Tab', 'Shift'].includes(e.key)) skipNow(); }, { once: true });
  addEventListener('wheel', skipNow, { once: true, passive: true });
  addEventListener('touchstart', skipNow, { once: true, passive: true });
  addEventListener('pointerdown', skipNow, { once: true });
  skip.addEventListener('click', skipNow);

  // the roll call
  const nameEl = call.querySelector<HTMLAnchorElement>('[data-c-name]')!;
  const openEl = call.querySelector<HTMLAnchorElement>('[data-c-open]')!;
  const bar = call.querySelector<HTMLElement>('[data-c-bar]')!;
  const slots = {
    no: call.querySelector<HTMLElement>('[data-c-no]')!, file: call.querySelector<HTMLElement>('[data-c-file]')!,
    team: call.querySelector<HTMLElement>('[data-c-team]')!, team2: call.querySelector<HTMLElement>('[data-c-team2]')!,
  };
  const copy = call.querySelector<HTMLElement>('.call-copy')!;
  let shown = -1;
  const showName = (i: number) => {
    if (i === shown) return;
    const dir = i > shown ? 1 : -1;
    shown = i;
    const f = files[i];
    sc.accent.set(f.accent);
    call.style.setProperty('--a', f.accent);
    const nn = String(f.no).padStart(2, '0');
    slots.no.textContent = nn; slots.file.textContent = nn; slots.team.textContent = f.team; slots.team2.textContent = f.team;
    nameEl.href = f.href; openEl.href = f.href; nameEl.dataset.ptLabel = f.name;
    // letters inside whole words, so a long name wraps between words, never inside one
    nameEl.innerHTML = f.name.split(' ').map((w) => `<span class="cw" style="display:inline-block;white-space:nowrap">${[...w].map((ch) => `<span class="cc" style="display:inline-block">${ch}</span>`).join('')}</span>`).join(' ');
    nameEl.style.fontSize = ''; delete nameEl.dataset.fitted;
    fitText(copy);
    gsap.fromTo(nameEl.querySelectorAll('.cc'), { yPercent: 90 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.55, stagger: 0.025, ease: EASE.reveal, overwrite: true });
    gsap.fromTo(call.querySelectorAll('[data-c-in]'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: EASE.reveal, delay: 0.15, overwrite: true });
  };
  nameEl.classList.add('t-title');
  nameEl.setAttribute('data-fit', '');

  ScrollTrigger.create({
    trigger: roll, start: 'top top', end: 'bottom bottom',
    onUpdate: (st) => {
      // one unit to hand over from the intro, then one per file
      const u = st.progress * (files.length + 1) - 1;
      const fade = gsap.utils.clamp(0, 1, (u + 0.85) / 0.45);
      gsap.set(intro, { opacity: 1 - fade, y: -40 * fade });
      intro.style.visibility = fade >= 1 ? 'hidden' : '';
      const p = gsap.utils.clamp(0, files.length - 1, u);
      sc.p = p;
      const on = u > -0.45;
      call.style.visibility = on ? 'visible' : 'hidden';
      if (on) {
        const k = Math.floor(p), f = p - k;
        showName(Math.min(files.length - 1, k + (f > 0.55 ? 1 : 0)));
        gsap.set(bar, { scaleX: p / (files.length - 1) });
      }
      const near = Math.round(p);
      ensure(near + 1); ensure(near + 2); ensure(near - 1);
    },
  });
}
