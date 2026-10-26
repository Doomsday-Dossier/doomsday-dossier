/**
 * The arena, design system v2: the v1 arena (matchups, radar, sourced feats, the fan vote and the
 * most-wanted board) under a cloth-poster hero. The posters follow the current pair; throwing one into
 * the other slams the cards below as well.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Ctx, HeroScene } from '../gl/engine';
import { versusPage } from '../motion/versus';
import { ClothScene, posterTexture } from './cloth';
import { reveals } from './reveal';
import { C } from './tokens';
import * as THREE from 'three';

gsap.registerPlugin(ScrollTrigger);

type Char = { slug: string; name: string; accent: string; no: number; photo: { big: string; focus: string } | null };
type Env = { engine: { ctx: Ctx; mount(s: HeroScene): Promise<void>; setActive(on: boolean): void; renderer: THREE.WebGLRenderer } | null; reduced: boolean };

export async function arenaPage(env: Env) {
  const hero = document.querySelector<HTMLElement>('[data-cloth]');
  const raw = document.getElementById('vs-data');
  if (!hero || !raw) return;
  const all = JSON.parse(raw.textContent || '[]') as Char[];
  const by = new Map(all.map((c) => [c.slug, c]));
  const flash = hero.querySelector<HTMLElement>('[data-cloth-flash]')!;
  reveals(document, env.reduced);

  let sc: ClothScene | null = null;
  const dress = async (side: 0 | 1, slug: string) => {
    const c = by.get(slug); if (!c) return;
    const img = hero.querySelector<HTMLImageElement>(`[data-static="${side ? 'b' : 'a'}"]`);
    if (img && c.photo) { img.src = c.photo.big; img.style.objectPosition = c.photo.focus; }
    if (!sc) return;
    const tex = await posterTexture(c.photo?.big ?? null, c.photo?.focus ?? '50% 30%', c.name, c.no, c.accent);
    sc.setTexture(side, tex, c.accent);
  };
  // the v1 arena announces each pair; the posters follow it
  document.addEventListener('dd:pair', (e) => {
    const d = (e as CustomEvent).detail as { a: string; b: string; changed: ('a' | 'b')[] };
    for (const s of d.changed) dress(s === 'a' ? 0 : 1, s === 'a' ? d.a : d.b);
  });

  if (env.engine && !env.reduced) {
    const first = [all[0]?.accent ?? C.emerald, all[1]?.accent ?? C.emerald] as [string, string];
    sc = new ClothScene(first);
    await env.engine.mount(sc);
    env.engine.renderer.setClearColor(new THREE.Color(C.gunmetal), 1);
    // a hit: the poster smacks the other, the stage flashes and the cards below slam too
    sc.onHit = () => {
      gsap.fromTo(flash, { opacity: 0.9 }, { opacity: 0, duration: 0.7, ease: 'power2.out' });
      gsap.fromTo(hero, { x: -10 }, { x: 0, duration: 0.45, ease: 'elastic.out(1, 0.3)' });
      document.dispatchEvent(new CustomEvent('dd:fling'));
    };
    const ndc = (e: PointerEvent) => [(e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1] as const;
    hero.addEventListener('pointerdown', (e) => { if (sc!.down(...ndc(e))) { hero.setPointerCapture(e.pointerId); e.preventDefault(); } });
    hero.addEventListener('pointermove', (e) => sc!.move(...ndc(e)));
    const up = () => sc!.up();
    hero.addEventListener('pointerup', up); hero.addEventListener('pointercancel', up);
    // only draw while the hero is on screen
    ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', onUpdate: (st) => { sc!.scrollPx = st.progress * hero.offsetHeight; }, onLeave: () => env.engine!.setActive(false), onEnterBack: () => env.engine!.setActive(true) });
  }

  versusPage(document, { ease: 'power3.out', pace: 1, reduced: env.reduced });
}
