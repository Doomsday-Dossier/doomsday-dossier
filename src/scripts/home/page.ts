/**
 * The home page (CLAUDE.md, "The home page: through the mask", version 1, the hall): forge A, then the
 * camera through Doom's mask into the hall of files. Scrolling waits until the title stands; the header
 * comes in with it. Without WebGL the page is the title, the countdown and the archive index.
 */
import type Lenis from 'lenis';
import { runForge } from '../forge/run';
import { homeExtension, type HomeFile } from './home';
import { timeLeft } from '../dossier/tokens';

type Env = { lenis: Lenis | null; reduced: boolean; phone: boolean };

export async function forgeHome(env: Env) {
  const root = document.querySelector<HTMLElement>('[data-forge]');
  if (!root) return;
  const html = document.documentElement;
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;

  const fallback = () => {
    html.classList.add('no-gl'); html.classList.remove('forging');
    html.style.overflow = ''; env.lenis?.start();
    const count = document.querySelector<HTMLElement>('[data-count]');
    const tick = () => { const t = timeLeft(); count?.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => { b.textContent = String(t[b.dataset.k as 'd' | 'h' | 'm' | 's']).padStart(2, '0'); }); };
    tick(); setInterval(tick, 1000);
  };
  if (!document.createElement('canvas').getContext('webgl2')) return fallback();

  // the forge always starts at the top, with the page held still until the title stands
  history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  html.classList.add('forging');
  html.style.overflow = 'hidden';
  env.lenis?.stop();
  env.lenis?.scrollTo(0, { immediate: true, force: true });

  const files = (JSON.parse(root.dataset.files!) as (HomeFile & { photoS: string })[]).map((f) => ({ ...f, photo: env.phone ? f.photoS : f.photo }));
  const m = JSON.parse(root.dataset.mask!);
  try {
    await runForge(root, {
      version: 'a',
      // ?rec on a local server records the sound mix, for the screen recordings (scripts/home-record.mjs)
      recordAudio: /^(localhost|127\.)/.test(location.hostname) && new URLSearchParams(location.search).has('rec'),
      extend: homeExtension({
        version: 1, files,
        mask: { photo: env.phone ? m.photoS : m.photo, depth: m.depth, eye: m.eye },
        ui: { file: $('[data-file]'), no: $('[data-no]'), name: $('[data-name]'), team: $('[data-team]'), open: $('[data-open]'), cue: $('[data-cue]'), flood: $('[data-flood]') },
        scrollY: () => (env.lenis ? env.lenis.scroll : scrollY), vh: () => innerHeight,
      }),
      onSettled: () => { html.classList.remove('forging'); html.style.overflow = ''; env.lenis?.start(); },
    });
  } catch {
    root.querySelector('canvas')?.remove();
    fallback();
  }
}
