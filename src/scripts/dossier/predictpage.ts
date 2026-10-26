/**
 * The prediction board, design system v2: the v1 board (ten questions, Turnstile lock-in, the fan split,
 * the seal countdown) over Doom's war table: each answer drops a token into its question's sector, and
 * locking in launches them all at Doom's citadel.
 */
import * as THREE from 'three';
import type { Ctx, HeroScene } from '../gl/engine';
import { predictionBoard } from '../motion/predict';
import { WarTable } from './wartable';
import { reveals } from './reveal';
import { C } from './tokens';

type Env = { engine: { ctx: Ctx; mount(s: HeroScene): Promise<void>; renderer: THREE.WebGLRenderer } | null; reduced: boolean };
type Q = { id: string; options: { id: string }[] };

export async function predictPage(env: Env) {
  const raw = document.getElementById('pr-data');
  if (!raw) return;
  const questions = JSON.parse(raw.textContent || '{}').questions as Q[];
  reveals(document, env.reduced);
  let table: WarTable | null = null;
  if (env.engine) {
    table = new WarTable();
    await env.engine.mount(table);
    env.engine.renderer.setClearColor(new THREE.Color(C.gunmetal), 1);
    // phones: the table stands at the top of the page and scrolls away with it; wide screens keep it beside the questions
    const follow = () => { if (!table) return; const narrow = innerWidth < 900; table.scrollPx = narrow ? scrollY : 0; table.alpha = narrow ? Math.max(0, 1 - scrollY / (innerHeight * 0.9)) : 1; };
    addEventListener('scroll', follow, { passive: true }); follow();
  }
  document.addEventListener('dd:picks', (e) => {
    const picks = (e as CustomEvent).detail.picks as Record<string, string>;
    table?.setPicks(questions.map((q) => (picks[q.id] ? q.options.findIndex((o) => o.id === picks[q.id]) : -1)), questions.map((q) => q.options.length));
  });
  document.addEventListener('dd:locked', () => table?.lockIn());
  predictionBoard(document, { ease: 'power3.out', pace: 1, reduced: env.reduced });
}
