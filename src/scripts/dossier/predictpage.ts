/**
 * The prediction board, design system v2: the v1 board (ten questions, Turnstile lock-in, the fan
 * split, the seal countdown) beside a particle tree that grows a branch for each answered question and
 * ripples when the picks are locked in.
 */
import * as THREE from 'three';
import type { Ctx, HeroScene } from '../gl/engine';
import { predictionBoard } from '../motion/predict';
import { TreeScene } from './tree';
import { reveals } from './reveal';
import { C } from './tokens';

type Env = { engine: { ctx: Ctx; mount(s: HeroScene): Promise<void>; renderer: THREE.WebGLRenderer } | null; reduced: boolean };

export async function predictPage(env: Env) {
  const raw = document.getElementById('pr-data');
  if (!raw) return;
  const ids = (JSON.parse(raw.textContent || '{}').questions as { id: string }[]).map((q) => q.id);
  reveals(document, env.reduced);
  let tree: TreeScene | null = null;
  if (env.engine) {
    tree = new TreeScene();
    await env.engine.mount(tree);
    env.engine.renderer.setClearColor(new THREE.Color(C.gunmetal), 1);
    // phones: the tree stands at full strength at the top of the page and scrolls away with it
    const fade = () => { if (!tree) return; const narrow = innerWidth < 900; tree.scrollPx = narrow ? scrollY : 0; tree.alpha = narrow ? Math.max(0, 1 - scrollY / (innerHeight * 0.9)) : 1; };
    addEventListener('scroll', fade, { passive: true }); fade();
  }
  document.addEventListener('dd:picks', (e) => {
    const picks = (e as CustomEvent).detail.picks as Record<string, string>;
    tree?.setPicks(ids.map((id) => !!picks[id]));
  });
  document.addEventListener('dd:locked', () => tree?.lockIn());
  predictionBoard(document, { ease: 'power3.out', pace: 1, reduced: env.reduced });
}
