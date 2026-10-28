/**
 * DOOM-OS home: the visitor is Doom. On the first visit of a session the gate asks for his hand ("I am Doom") and the
 * system boots; then Battleworld is made in front of him: the shards fly in from the dark and lock together round
 * the green core. Pointing at a domain lifts it into colour with its name; choosing one turns it to face him and
 * dives into it, straight into that target's file. Beside it, the royal log of his reign and Doom's will.
 */
import { navigate } from 'astro:transitions/client';
import { onLeave } from '../../page-scope';
import { bootHum, tick, sweep, lock } from '../../sound/os';
import { typeIn, wait, reduced, sound } from '../fx';
import { reign, log, logLine, will, daysBefore } from '../reign';

type W = { slug: string; no: number; name: string; team: string; teamId: string; href: string; face: { src: string; head: [number, number]; aspect: number } };
const BOOTED = 'dd-os-booted';
const LINES = (n: number) => [
  'LATVERIAN SOVEREIGN NETWORK',
  'DOOM-OS 9.66',
  'HAND ON THE SCANNER .............. IDENTITY CONFIRMED',
  'WELCOME, VICTOR VON DOOM. WELCOME, YOUR MAJESTY.',
  'LINKING ORBITAL ARRAY ............ OK',
  `GATHERING THE FRAGMENTS ........... ${n} DOMAINS`,
  'TEMPORAL LOCK ..................... 18 DECEMBER 2026',
];

export async function home() {
  const raw = document.querySelector('[data-home-data]'); if (!raw) return;
  const D = JSON.parse(raw.textContent!) as { world: W[]; count: number };
  const html = document.documentElement, s = sound();
  let gone = false; onLeave(() => { gone = true; });

  // the greeting knows how long His Majesty has reigned
  const r = reign();
  const greet = document.querySelector<HTMLElement>('[data-greet]')!;
  if (!r.log.length) log('His Majesty took the throne.');
  else greet.textContent = 'Welcome back, Your Majesty.';
  renderLog(); renderWill();
  addEventListener('dd:reign', () => { renderLog(); renderWill(); });

  const booted = (() => { try { return sessionStorage.getItem(BOOTED) === '1'; } catch { return false; } })();
  let bwP: Promise<any> | null = null;
  if (!booted && !reduced()) {
    html.classList.add('os-booting');
    const gate = document.querySelector<HTMLElement>('[data-gate]')!;
    gate.hidden = false;
    // start building the world behind the gate, so it is ready to form after the boot
    bwP = makeWorld();
    const go = await new Promise<boolean>((res) => {
      gate.querySelector('[data-auth]')!.addEventListener('click', () => res(true), { once: true });
      gate.querySelector('[data-auth-quiet]')!.addEventListener('click', () => res(false), { once: true });
      (window as any).__start = () => res(true);
    });
    if (go) { await s.unlock(); (window as any).__osDrone?.(); }
    gate.remove();
    try { sessionStorage.setItem(BOOTED, '1'); } catch { /* private mode */ }
    if (go) bootHum(s);
    const pre = document.querySelector<HTMLElement>('[data-boot]')!;
    for (const line of LINES(D.count)) { if (gone) return; const div = document.createElement('div'); pre.append(div); await typeIn(div, line, 150); await wait(70); }
    await wait(200);
    await pre.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished;
    pre.remove();
  } else {
    try { sessionStorage.setItem(BOOTED, '1'); } catch { /* private mode */ }
    document.querySelector('[data-gate]')?.remove(); document.querySelector('[data-boot]')?.remove();
  }
  if (gone) return;
  const bw = await (bwP ?? makeWorld());
  document.querySelector('[data-acq]')?.classList.add('gone');
  html.classList.remove('os-booting');
  if (gone) { bw?.dispose(); return; }
  if (!reduced()) {
    const { glitchIn } = await import('../hud');
    document.querySelectorAll<HTMLElement>('.sys, .modules, .h-clock').forEach((el) => glitchIn(el));
    document.querySelectorAll<HTMLElement>('.mod').forEach((m, i) => m.animate([{ opacity: 0, transform: 'translateX(16px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 300 + i * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  }
  // the world being made
  if (bw) {
    sweep(s, 3);
    await bw.form(3.2);
    if (!gone) lock(s);
  }

  // the intercepted feed rolls on
  const feed = document.querySelector<HTMLElement>('[data-feed]')!;
  if (!reduced()) setInterval(() => {
    if (document.hidden) return;
    const f = feed.firstElementChild as HTMLElement;
    f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished.then(() => { feed.append(f); f.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 }); });
  }, 3600);

  async function makeWorld() {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-bw]')!;
    if (!document.createElement('canvas').getContext('webgl2')) { html.classList.add('no-gl'); return null; }
    const tag = document.querySelector<HTMLElement>('[data-bw-tag]')!, stage = document.querySelector<HTMLElement>('[data-bw-stage]')!;
    // touch screens (and narrow ones) get the card docked under the planet with an Enter button, and the strip of faces
    const dock = () => !matchMedia('(pointer: fine)').matches || innerWidth < 1100;
    const strip = document.querySelector<HTMLElement>('[data-bw-strip]');
    try {
      const { createBattleworld } = await import('../battleworld');
      let shown: number | null = null;
      const mark = (i: number | null) => strip?.querySelectorAll<HTMLButtonElement>('button').forEach((b, k) => {
        const on = k === i; b.setAttribute('aria-pressed', String(on));
        if (on) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced() ? 'auto' : 'smooth' });
      });
      const world = await createBattleworld(canvas, D.world, {
        reduced: reduced(),
        onHover: (i, at) => {
          const docked = dock();
          tag.classList.toggle('dock', docked);
          if (i === null || !at || (!at.front && !docked)) { if (!docked || i === null) { tag.hidden = true; if (shown !== null) mark(null); shown = null; } return; }
          if (shown !== i) {
            shown = i; tick(s); mark(i);
            const w = D.world[i];
            tag.querySelector('[data-bw-no]')!.textContent = `T-${String(w.no).padStart(2, '0')} // ${w.teamId === 'adversary' ? 'Capital' : 'Domain'}`;
            tag.querySelector('[data-bw-name]')!.textContent = w.name;
            tag.querySelector('[data-bw-team]')!.textContent = w.teamId === 'adversary' ? 'Doomstadt · seat of His Majesty' : `${w.team} continent`;
            tag.querySelector('[data-bw-go]')!.textContent = docked ? 'Enter the domain' : 'Click to enter the domain';
            if (!reduced()) tag.animate([{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
          }
          tag.hidden = false;
          if (docked) { tag.style.left = ''; tag.style.top = ''; return; }
          tag.classList.toggle('left', at.x > stage.clientWidth * 0.62);
          tag.style.left = `${at.x}px`; tag.style.top = `${at.y}px`;
        },
        onPick: (i) => {
          const w = D.world[i];
          tag.hidden = true; sweep(s, 1.2);
          (window as any).__osDive = true; // the dive is the page change: no shatter after it
          setTimeout(() => { if (!gone) navigate(w.href); }, reduced() ? 0 : 1150);
        },
      });
      // the docked card's Enter button, and the faces
      tag.querySelector('[data-bw-go]')!.addEventListener('click', () => { if (shown !== null) world.pick(shown); });
      strip?.querySelectorAll<HTMLButtonElement>('button').forEach((b, k) => b.addEventListener('click', () => {
        if (shown === k) world.pick(k); else world.select(k);
      }));
      world.setWill(will());
      // recordings (scripts/promo) steer the world on a local server
      if (/^(localhost|127\.)/.test(location.hostname)) (window as any).__bw = world;
      onLeave(() => world.dispose());
      return world;
    } catch { html.classList.add('no-gl'); return null; }
  }
}

function renderLog() {
  const ol = document.querySelector<HTMLElement>('[data-rlog]'); if (!ol) return;
  const r = reign();
  if (!r.log.length) return;
  ol.innerHTML = '';
  for (const l of r.log.slice(0, 4)) {
    const li = document.createElement('li');
    const i = document.createElement('i'); i.textContent = `${daysBefore(l.t)} days before Doomsday`;
    li.append(i, document.createTextNode(l.text));
    ol.append(li);
  }
  void logLine;
}
function renderWill() {
  const w = will(), bar = document.querySelector<HTMLElement>('[data-will]'), n = document.querySelector('[data-will-n]');
  if (bar) bar.style.width = `${Math.round(w * 100)}%`;
  if (n) n.textContent = `${Math.round(w * 100)}%`;
}
