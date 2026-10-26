/**
 * The quiz, after Particle Self: the v1 quiz (ten questions, shareable result, Dossier-file cards) with the
 * archive's cloud of points. While the visitor answers, an anonymous cloud swirls beside the title; when the
 * result arrives the cloud moves into the result frame and gathers into the match, built in 3D from their
 * photo, with the name beside it, never behind it. Taking it again sends the cloud back to the nebula.
 * Reduced motion and no WebGL keep the cut-out photo in the frame.
 */
import * as THREE from 'three';
import { gsap } from 'gsap';
import type Lenis from 'lenis';
import type { Ctx, HeroScene } from '../gl/engine';
import { quizPage } from '../motion/quiz';
import { reveals } from './reveal';
import type { Cloud } from './cloud';
import { Swarm, cloudLoader } from './swarm';
import { C } from './tokens';

type Env = { engine: { ctx: Ctx; mount(s: HeroScene): Promise<void>; renderer: THREE.WebGLRenderer } | null; lenis: Lenis | null; reduced: boolean; phone: boolean };
type Entry = { slug: string; href: string; accent: string; cloud: Cloud | null };

export async function quizPageV2(env: Env) {
  reveals(document, env.reduced);
  quizPage(document, { ease: 'power3.out', pace: 1, reduced: env.reduced });
  const result = document.querySelector<HTMLElement>('[data-result]');
  const link = document.querySelector<HTMLAnchorElement>('[data-r-link]');
  const heroSlot = document.querySelector<HTMLElement>('[data-swarm-hero]');
  const frame = document.querySelector<HTMLElement>('[data-swarm-result]');
  const raw = document.getElementById('qz-data');
  if (!result || !link || !heroSlot || !frame || !raw || !env.engine || env.reduced) return;
  const roster = (JSON.parse(raw.textContent || '{}').roster ?? []) as Entry[];

  const N = env.phone ? 14000 : 30000;
  const sc = new Swarm(N);
  const ensure = cloudLoader(sc, N, roster.map((r) => r.cloud), 0.42, true);
  sc.anchor = heroSlot; sc.target = -1; sc.glow = 0.35; sc.accent.set(C.emerald);
  document.documentElement.classList.add('swarm-on');
  await env.engine.mount(sc);
  env.engine.renderer.setClearColor(new THREE.Color(C.gunmetal), 1);
  gsap.fromTo(sc, { glow: 0 }, { glow: 0.35, duration: 1.4, ease: 'sine.inOut' });

  // the result: move the cloud into the frame and gather it into the match
  let shownFor = '';
  const sync = async () => {
    if (result.hidden) {
      if (!shownFor) return;
      shownFor = '';
      sc.anchor = heroSlot; sc.target = -1; sc.accent.set(C.emerald);
      gsap.to(sc, { gather: 0, duration: 0.6, ease: 'power2.in', overwrite: true });
      return;
    }
    const i = roster.findIndex((r) => link.href.endsWith(r.href) || link.getAttribute('href') === r.href);
    if (i < 0 || roster[i].slug === shownFor) return;
    shownFor = roster[i].slug;
    sc.gather = 0; sc.anchor = frame; sc.target = -1; sc.accent.set(roster[i].accent);
    await ensure(i);
    if (shownFor !== roster[i].slug) return;
    sc.target = i;
    gsap.fromTo(sc, { gather: 0 }, { gather: 1, duration: 2.6, ease: 'power3.inOut', delay: 0.2, overwrite: true });
  };
  new MutationObserver(() => { sync(); }).observe(result, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(() => { sync(); }).observe(link, { attributes: true, attributeFilter: ['href'] });
  sync();
}
