/**
 * DOOM-OS's entry (CLAUDE.md, "Design system v4"). Pages change without a reload (Astro's client router), so:
 * - the session, set up once: the sound engine and the machine drone (from the visitor's first click or key), the
 *   bar's launch clock and sound switch, the command line, the crosshair and glyph columns, and the change of
 *   screen: the old screen tears out in a burst of static while the next loads, the new one tears in;
 * - the page, booted on every `astro:page-load` and taken down before the next swaps in (`page-scope.ts`).
 * No smooth scroll and no shared WebGL renderer: each screen owns its small scanners and frees them on leaving.
 */
import { installPageScope, asGlobal, leavePage, onLeave } from '../page-scope';
import { Sound } from '../sound/engine';
import { staticBurst, drone, shatter, burst } from '../sound/os';
import { shatterCover, shatterReveal, setShardTiles } from './shatter';
import { glitchIn, crosshair, glyphColumns } from './hud';
import { commandLine } from './command';
import { timeLeft } from '../dossier/tokens';
import { pad, reduced } from './fx';
import { keepTime } from './reign';
import { trace } from './trace';
import { previews } from './preview';

installPageScope();
const html = document.documentElement;
const local = /^(localhost|127\.)/.test(location.hostname);

// THE SESSION -----------------------------------------------------------------------------------------------
asGlobal(() => {
  const sound = Sound.get();
  if (local) (window as any).__ddSound = sound;
  if (reduced()) html.classList.add('rm');

  // the machine underneath everything, from the first click or key (browsers allow sound only after one)
  let droning = false;
  const startDrone = () => { if (droning) return; sound.unlock().then(() => { if (sound.ctx.state === 'running' && !droning) { droning = true; drone(sound); } }); };
  (window as any).__osDrone = startDrone;
  addEventListener('pointerdown', startDrone); addEventListener('keydown', startDrone);

  // the bar: sound switch and launch clock
  const soundBtn = document.querySelector<HTMLButtonElement>('[data-sound]');
  if (soundBtn) {
    const show = (m: boolean) => { soundBtn.setAttribute('aria-pressed', String(!m)); soundBtn.classList.toggle('off', m); soundBtn.querySelector('.sr')!.textContent = m ? 'Sound off' : 'Sound on'; };
    show(sound.muted); sound.onMute(show);
    soundBtn.addEventListener('click', (e) => { e.stopPropagation(); sound.unlock(); sound.setMuted(!sound.muted); startDrone(); });
  }
  const mini = document.querySelector('[data-clock-mini]');
  const clock = () => {
    const t = timeLeft();
    if (mini) mini.textContent = `${pad(t.d)}:${pad(t.h)}:${pad(t.m)}:${pad(t.s)}`;
    document.querySelectorAll('[data-clock]').forEach((c) => { c.textContent = `${pad(t.d)}D ${pad(t.h)}H ${pad(t.m)}M ${pad(t.s)}S`; });
  };
  clock(); setInterval(clock, 1000);

  commandLine();
  keepTime();
  const hud = document.querySelector<HTMLElement>('[data-hud]')!;
  crosshair(document.querySelector<HTMLElement>('[data-aim]') ?? hud); glyphColumns(hud);

  // changing screen (Battleworld): the glass cracks from where the visitor clicked, shards close the screen while the
  // next page loads, then burst apart to show it
  let strike: [number, number] = [innerWidth / 2, innerHeight / 2], covered = false, dived = false;
  addEventListener('pointerdown', (e) => { strike = [e.clientX, e.clientY]; }, { capture: true, passive: true });
  try {
    const idx = JSON.parse(document.querySelector('[data-cmd-index]')!.textContent!).targets;
    setShardTiles((idx as { tile: string }[]).map((t) => t.tile));
    trace(idx);
    previews(idx, document.querySelector<HTMLElement>('[data-aim]') ?? document.body);
  } catch { /* no index */ }
  document.addEventListener('astro:before-preparation', (e: any) => {
    const load = e.loader;
    e.loader = async () => {
      if (reduced()) return load();
      html.classList.add('os-leaving');
      // diving into a Battleworld domain is its own page change: the camera is already inside the shard
      if ((window as any).__osDive) { (window as any).__osDive = false; dived = true; return load(); }
      shatter(sound);
      covered = true;
      await Promise.all([load(), shatterCover(strike)]);
    };
  });
  document.addEventListener('astro:after-swap', () => {
    html.classList.remove('os-leaving');
    if (reduced()) html.classList.add('rm');
    scrollTo(0, 0);
    if (covered) { covered = false; requestAnimationFrame(() => { shatterReveal(); burst(sound); }); }
    if (dived) { dived = false; glitchIn(document.querySelector<HTMLElement>('[data-screen]')!); staticBurst(sound); }
  });
  document.addEventListener('astro:before-swap', () => { leavePage(); });

  document.addEventListener('astro:page-load', () => { boot(); });
});

// THE PAGE --------------------------------------------------------------------------------------------------
let stReady = false;
async function sessionScrollTrigger() {
  if (stReady) return;
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  asGlobal(() => {
    gsap.registerPlugin(ScrollTrigger); ScrollTrigger.create({ start: 0, end: 1 }).kill();
    document.addEventListener('astro:before-swap', () => ScrollTrigger.getAll().forEach((t) => t.kill()));
  });
  stReady = true;
}
let first = true;
async function boot() {
  const page = document.body.dataset.page ?? '';
  const mod = document.body.dataset.module ?? page;
  document.querySelectorAll<HTMLAnchorElement>('[data-mod]').forEach((a) => { if (a.dataset.mod === mod) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const screen = document.querySelector<HTMLElement>('[data-screen]')!;
  // a first load tears in like a signal (page changes arrive through the shattered glass instead); the home page
  // has its own boot
  if (first && page !== 'home') { glitchIn(screen); staticBurst(Sound.get()); }
  first = false;
  const { settleIn } = await import('./fx');
  settleIn(screen);
  acquire(screen);
  // the screen's title decodes itself as it arrives
  if (!(first && page === 'home')) { const { decryptIn } = await import('./fx'); screen.querySelectorAll<HTMLElement>('.mod-title').forEach((el) => { if (!el.children.length) decryptIn(el, el.textContent ?? '', 650); }); }
  if (page === 'home') (await import('./pages/home')).home();
  if (page === 'targets') (await import('./pages/register')).register();
  if (page === 'file') (await import('./pages/file')).file();
  if (page === 'timeline') (await import('./pages/timeline')).timeline();
  // the v1 logic of these modules uses GSAP's ScrollTrigger: its window listeners must belong to the session, or the
  // first page change would take them down and a second visit would find it deaf
  if (page === 'versus' || page === 'quiz' || page === 'predictions' || page === 'catchup') await sessionScrollTrigger();
  if (page === 'versus') (await import('./pages/combat')).combat();
  if (page === 'quiz') (await import('./pages/profiler')).profiler();
  if (page === 'predictions') (await import('./pages/probability')).probability();
  if (page === 'catchup') (await import('./pages/briefing')).briefing();
  if (page === 'chamber') (await import('./pages/chamber')).chamber();
  onLeave(() => {});
}

/** Images still on their way: their frame shows a scan sweeping ("acquiring"), and the image fades in when it lands. */
function acquire(root: HTMLElement) {
  root.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    if (img.complete && img.naturalWidth) return;
    const box = img.parentElement;
    img.classList.add('ld'); box?.classList.add('acq-box');
    const done = () => { img.classList.remove('ld'); img.classList.add('ldd'); box?.classList.remove('acq-box'); };
    img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true });
  });
}
