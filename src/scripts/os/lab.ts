/**
 * DOOM-OS prototype controller (CLAUDE.md, "Design system v4"): the gate, the boot, the home with Doom scanned in
 * and the launch clock, the target register, and a target file (scanner, lock-on, readouts typing in).
 * Hash routes: #targets, #t/<slug>. window.__start() skips the click for recordings.
 */
import { Sound } from '../sound/engine';
import { bootHum, tick, sweep, lock, decrypt } from '../sound/os';
import { createScanner, type Scanner } from './scanner';
import { timeLeft } from '../dossier/tokens';

type T = {
  slug: string; no: number; name: string; alias: string; real: string; team: string; actor: string; tile: string; photo: string; depth: string; head: [number, number];
  threat: number | null; grid: Record<string, number> | null; gridSource: string | null;
  brief: { who: string; powers: string; doomsday: string; last: string | null } | null; abilities: { name: string; detail: string }[];
  screen: { year: number; title: string; mcu: boolean }[]; first: string;
};
const DATA = JSON.parse(document.querySelector('[data-os]')!.textContent!) as { targets: T[]; home: { photo: string; depth: string; head: [number, number] } };
const $ = <E extends HTMLElement = HTMLElement>(s: string) => document.querySelector<E>(s)!;
const sound = Sound.get();
(window as any).__ddSound = sound;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad = (n: number) => String(n).padStart(2, '0');

// THE LAUNCH CLOCK
const clockTick = () => {
  const t = timeLeft();
  $('[data-clock]').textContent = `${pad(t.d)}D ${pad(t.h)}H ${pad(t.m)}M ${pad(t.s)}S`;
  $('[data-clock-mini]').textContent = `${pad(t.d)}:${pad(t.h)}:${pad(t.m)}:${pad(t.s)}`;
};
clockTick(); setInterval(clockTick, 1000);

/** Types text into an element, a relay tick every few characters. */
async function type(el: HTMLElement, text: string, cps = 90) {
  el.classList.add('os-cursor');
  for (let i = 0; i <= text.length; i += 2) { el.textContent = text.slice(0, i); if (i % 6 === 0) tick(sound); await wait(2000 / cps); }
  el.textContent = text; el.classList.remove('os-cursor');
}

/** Puts a reticle on a face: it flies in from wide and locks. */
function lockOn(ret: HTMLElement, at: { x: number; y: number }) {
  ret.hidden = false; ret.classList.remove('locked');
  ret.animate([{ left: `${at.x}px`, top: `${at.y}px`, transform: 'scale(2.6)', opacity: 0 }, { left: `${at.x}px`, top: `${at.y}px`, transform: 'scale(1)', opacity: 1 }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
  setTimeout(() => { ret.classList.add('locked'); lock(sound); }, 700);
}

// THE GATE AND THE BOOT
let homeScan: Scanner | null = null;
const BOOT = [
  'LATVERIAN SOVEREIGN NETWORK',
  'DOOM-OS 9.66 · AUTHORISED: V. VON DOOM',
  'LINKING ORBITAL ARRAY ............ OK',
  `LOADING TARGET REGISTER ........... ${DATA.targets.length} TARGETS`,
  'TEMPORAL LOCK ..................... 18 DECEMBER 2026',
  'DOOMSDAY PROTOCOL ................. ARMED',
];
async function boot() {
  $('[data-gate]').remove();
  bootHum(sound);
  const pre = $('[data-boot]');
  for (const line of BOOT) { const span = document.createElement('div'); pre.append(span); await type(span, line, 140); await wait(90); }
  await wait(250);
  pre.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' });
  show('home');
}
async function start() { await sound.unlock(); boot(); }
$('[data-auth]').addEventListener('click', start);
(window as any).__start = start;

// THE VIEWS
let fileScan: Scanner | null = null;
async function show(view: 'home' | 'targets' | 'file', slug?: string) {
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((v) => { v.hidden = v.dataset.view !== view; });
  scrollTo(0, 0);
  if (view === 'home') {
    if (!homeScan) {
      homeScan = await createScanner($<HTMLCanvasElement>('[data-home-scan]'), DATA.home.photo, DATA.home.depth, DATA.home.head, 3.6);
      sweep(sound, 2.6);
      await homeScan.scan(2.6);
      homeScan.colour(0.8, 2);
      // the feed rolls on: the oldest line slides out, back in at the end
      const feed = $('[data-feed]');
      setInterval(() => { const first = feed.firstElementChild as HTMLElement; first.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished.then(() => { feed.append(first); first.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 }); tick(sound); }); }, 3200);
      lockOn($('[data-home-ret]'), homeScan.head());
    }
    document.querySelectorAll<HTMLElement>('.mod').forEach((m, i) => m.animate([{ opacity: 0, transform: 'translateX(16px)' }, { opacity: getComputedStyle(m).opacity, transform: 'none' }], { duration: 500, delay: i * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  }
  if (view === 'targets') {
    document.querySelectorAll<HTMLElement>('[data-card]').forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: Math.min(i, 24) * 35, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
    for (let i = 0; i < 6; i++) setTimeout(() => tick(sound), i * 60);
  }
  if (view === 'file' && slug) openFile(slug);
}

async function openFile(slug: string) {
  const t = DATA.targets.find((x) => x.slug === slug); if (!t) return;
  fileScan?.dispose(); fileScan = null;
  const old = $<HTMLCanvasElement>('[data-file-scan]'), canvas = old.cloneNode() as HTMLCanvasElement; old.replaceWith(canvas);
  $('[data-file-ret]').hidden = true;
  $('[data-f-code]').textContent = `File T-${pad(t.no)} · ${t.slug.toUpperCase()}`;
  $('[data-f-no]').textContent = `Target ${pad(t.no)} of ${DATA.targets.length} · ${t.team}`;
  $('[data-f-status]').textContent = 'Scanning';
  ['[data-f-id]', '[data-f-threat]', '[data-f-brief]', '[data-f-abil]', '[data-f-tx]'].forEach((s) => { $(s).innerHTML = ''; });
  const nameEl = $('[data-f-name]'); nameEl.textContent = '';
  fileScan = await createScanner(canvas, t.photo, t.depth, t.head);
  sweep(sound, 2.2);
  type(nameEl, t.name.toUpperCase(), 60);
  // identity
  const id = $('[data-f-id]');
  for (const [k, v] of [['Real name', t.real], ['Codename', t.alias], ['Affiliation', t.team], ['In Doomsday', t.actor], ['First seen', t.first]] as [string, string][]) {
    const row = document.createElement('div'); row.className = 'os-row'; row.innerHTML = `<span>${k}</span><span></span>`; id.append(row);
    type(row.lastElementChild as HTMLElement, v, 160); await wait(120);
  }
  await fileScan.scan(2.2);
  fileScan.colour(1, 1.8);
  lockOn($('[data-file-ret]'), fileScan.head());
  $('[data-f-status]').textContent = 'Target locked · scan complete';
  // threat: Marvel's power grid, summed (6 to 42)
  const th = $('[data-f-threat]');
  if (t.grid && t.threat !== null) {
    const level = t.threat >= 30 ? ['Extreme', 'os-red'] : t.threat >= 22 ? ['High', 'os-amber'] : ['Elevated', 'os-hi'];
    th.innerHTML = `<div class="threat-big"><b class="${level[1]}">${t.threat}</b><span class="os-label">/ 42 · ${level[0]}</span></div>`;
    const labels: Record<string, string> = { intelligence: 'Intelligence', strength: 'Strength', speed: 'Speed', durability: 'Durability', energyProjection: 'Energy', fightingSkills: 'Fighting' };
    for (const [k, v] of Object.entries(t.grid)) {
      const r = document.createElement('div'); r.className = 'grid-row';
      r.innerHTML = `<span>${labels[k] ?? k}</span><span class="os-bar"><i style="transform:scaleX(0)"></i></span><span class="os-hi">${v}</span>`;
      th.append(r);
      r.querySelector('i')!.animate([{ transform: 'scaleX(0)' }, { transform: `scaleX(${v / 7})` }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      tick(sound); await wait(90);
    }
    $('[data-f-tsrc]').textContent = 'Marvel power grid';
  } else th.innerHTML = '<span class="os-label">No power grid on record</span>';
  // the brief, decrypted line by line
  decrypt(sound);
  const br = $('[data-f-brief]');
  if (t.brief) for (const [k, v] of [['Who', t.brief.who], ['Abilities', t.brief.powers], ['In Doomsday', t.brief.doomsday], ['Last seen', t.brief.last ?? 'First live-action appearance']] as [string, string][]) {
    const row = document.createElement('div'); row.className = 'os-row'; row.innerHTML = `<span>${k}</span><span></span>`; br.append(row);
    await type(row.lastElementChild as HTMLElement, v, 520);
  }
  // capabilities and transmissions
  const ab = $('[data-f-abil]');
  for (const a of t.abilities) { const d = document.createElement('div'); d.className = 'abil'; d.innerHTML = `<b>${a.name}</b>${a.detail}`; ab.append(d); d.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 }); }
  const tx = $('[data-f-tx]');
  $('[data-f-tx-n]').textContent = `${t.screen.length} on record`;
  t.screen.forEach((s, i) => { const li = document.createElement('li'); li.innerHTML = `<i>${s.year}</i><span>${s.title}</span><em>${s.mcu ? 'MCU' : 'OTHER'}</em>`; tx.append(li); li.animate([{ opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: i * 40, fill: 'backwards' }); });
}

// routing
const route = () => {
  const h = location.hash;
  if (document.querySelector('[data-gate]')) return;
  if (h.startsWith('#t/')) show('file', h.slice(3));
  else if (h === '#targets') show('targets');
  else show('home');
};
addEventListener('hashchange', route);

// the register's team filter
document.querySelectorAll<HTMLButtonElement>('[data-team]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-team]').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll<HTMLElement>('[data-card]').forEach((c) => { c.hidden = !!b.dataset.team && c.dataset.teamOf !== b.dataset.team; });
  tick(sound);
}));
