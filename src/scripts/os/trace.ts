/**
 * The heroes trace you back (a game, labelled so; nothing here is about the film). Every target file His Majesty
 * opens in a session lets the heroes trace the access a little further: a six-step meter climbs in the bar (a line
 * across the dock on phones) and a short message slides in, then out of the way.
 *
 * At six files one of the heroes he examined breaks in, and the breach is a fight:
 * 1. The takeover: klaxon and static, the screen turns red, and the hero comes through in their own way, drawn
 *    from their comics powers: Loki fakes the all-clear (Journey into Mystery #85, the god of lies), Professor X
 *    types into Doom's command line from inside his head (telepathy, X-Men #1), Nightcrawler teleports the
 *    panels about (Giant-Size X-Men #1), Ghost phases through them (Iron Man #219), Shuri floods the screen with
 *    Wakandan code (her tech, Black Panther: Wakanda Forever). Anyone else tears in on a glitch in their colour.
 * 2. Eight seconds to cut them off: five intrusion nodes on screen, the trace climbing to 100%.
 * 3. Win: Doom's countermeasure. His mask fills the screen, the red burns back to green and Battleworld's shards
 *    slam shut over the intruder. Lose: the hero gets away with a file, which stays redacted until he takes it back.
 * Then the trace starts again. Reduced motion: the alert and the log only.
 */
import { Sound } from '../sound/engine';
import { alarm, staticBurst, lock, sever, slam, tick, decrypt } from '../sound/os';
import { breached, stole, reclaim, reign } from './reign';

const KEY = 'dd-trace', EVERY = 6, FIGHT = 8000, NODES = 5;
type T = { slug: string; name: string; accent: string; tile: string };
const read = (): { n: number; seen: string[] } => { try { return JSON.parse(sessionStorage.getItem(KEY) || ''); } catch { return { n: 0, seen: [] }; } };
const write = (v: { n: number; seen: string[] }) => { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };
const MASK = `<svg viewBox="0 0 40 50" aria-hidden="true"><path d="M6 5 Q20 0 34 5 L36 30 Q34 44 20 49 Q6 44 4 30 Z"/><path d="M20 9 L20 31" fill="none"/><rect class="slit" x="8.5" y="17" width="9.5" height="2.6"/><rect class="slit" x="22" y="17" width="9.5" height="2.6"/><path d="M13 36 L27 36 M14 39 L26 39 M15.5 42 L24.5 42" fill="none"/></svg>`;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const hex = () => Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');

export function trace(index: T[]) {
  const meter = document.querySelector<HTMLElement>('[data-trace-meter]'), toast = document.querySelector<HTMLElement>('[data-trace-toast]');
  if (!meter || !toast) return;
  const by = new Map(index.map((t) => [t.slug, t]));
  const html = document.documentElement, segs = [...meter.querySelectorAll('i')];
  const show = (n: number) => {
    const step = n % EVERY, k = step / EVERY;
    meter.hidden = n === 0;
    segs.forEach((g, i) => g.classList.toggle('on', i < step));
    document.querySelectorAll('[data-trace-pct]').forEach((p) => { p.textContent = `${Math.round(k * 100)}%`; });
    html.style.setProperty('--trace', String(k));
    html.dataset.trace = n === 0 ? '' : k >= 0.66 ? 'hot' : 'on';
  };
  show(read().n);
  // the message slides in for a few seconds each time the trace climbs, then gets out of the way
  let t = 0;
  const say = (msg: string) => {
    toast.querySelector('[data-trace-msg]')!.textContent = msg;
    toast.hidden = false; toast.classList.remove('out');
    clearTimeout(t); t = window.setTimeout(() => { toast.classList.add('out'); t = window.setTimeout(() => { toast.hidden = true; }, 400); }, 4200);
  };
  document.addEventListener('astro:page-load', () => {
    if (document.body.dataset.page !== 'file') return;
    const slug = location.pathname.split('/').filter(Boolean).pop() ?? '';
    stolenFile(slug, by);
    const st = read();
    st.n++; if (slug !== 'victor-von-doom' && !st.seen.includes(slug)) st.seen.push(slug);
    write(st); show(st.n);
    const left = EVERY - (st.n % EVERY);
    say(left === EVERY ? 'They are in. Countermeasures standing by.' : `The heroes are tracing Your Majesty's access. ${left} more file${left > 1 ? 's' : ''} and they break in.`);
    if (st.n % EVERY === 0 && st.seen.length) {
      const who = by.get(st.seen[Math.floor(Math.random() * st.seen.length)]);
      // the file they go for: one he examined, never the one on screen
      const others = st.seen.filter((x) => x !== slug), prize = by.get(others.length ? others[Math.floor(Math.random() * others.length)] : slug);
      if (who && prize) setTimeout(() => breach(who, prize, say), 2600);
    }
  });
  // a quick way to see a breach on a local build: __breach('loki')
  if (/^(localhost|127\.)/.test(location.hostname)) (window as any).__breach = (slug: string, prize = 'thor') => breach(by.get(slug)!, by.get(prize)!, say);
}

/** A stolen file: the record sits under a red seal with the thief's name until His Majesty takes it back. */
function stolenFile(slug: string, by: Map<string, T>) {
  const thief = reign().stolen[slug];
  const top = document.querySelector<HTMLElement>('.f-main');
  if (!thief || !top) return;
  const name = by.get(slug)?.name ?? slug;
  document.body.classList.add('f-stolen');
  const el = document.createElement('div');
  el.className = 'stolen os-panel'; el.setAttribute('role', 'alert');
  el.innerHTML = `<p class="os-label">File compromised // a game: not part of the film</p><p class="st-h">Stolen by <b></b></p><p class="st-p">This file left the network during a breach. Its record is sealed until Your Majesty takes it back.</p><button class="os-btn" type="button">Take it back</button>`;
  el.querySelector('b')!.textContent = thief;
  top.before(el);
  el.querySelector('button')!.addEventListener('click', () => {
    const s = Sound.get(); decrypt(s); setTimeout(() => lock(s), 420);
    reclaim(slug, name);
    el.classList.add('back'); document.body.classList.remove('f-stolen');
    setTimeout(() => el.remove(), 700);
  });
}

async function breach(t: T, prize: T, say: (m: string) => void) {
  const s = Sound.get(), name = t.name.toUpperCase(), html = document.documentElement;
  alarm(s); dispatchEvent(new CustomEvent('dd:breach'));
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { breached(t.name); say(`${name} breached the network. Repelled.`); return; }
  if (document.querySelector('.breach')) return;
  const el = document.createElement('div');
  el.className = 'breach'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-label', `${t.name} has breached the network`);
  el.style.setProperty('--acc', t.accent);
  el.dataset.hero = t.slug;
  el.innerHTML = `<div class="br-flood"></div><div class="br-fx"></div><img class="br-face" src="${t.tile}" alt="" /><div class="br-text"><p class="br-k">Breach // counter-intrusion</p><p class="br-n"></p><p class="br-say"></p><p class="br-game">A game: not part of the film</p></div><div class="br-fight" hidden><p class="br-cmd">Sever the connection</p><div class="br-timer"><i></i></div><p class="br-pct">Trace <b>0%</b></p></div><div class="br-end"></div>`;
  el.querySelector('.br-n')!.textContent = name;
  document.body.append(el); html.classList.add('breaching');
  staticBurst(s);
  const flood = el.querySelector<HTMLElement>('.br-flood')!, face = el.querySelector<HTMLElement>('.br-face')!, txt = el.querySelector<HTMLElement>('.br-text')!, fx = el.querySelector<HTMLElement>('.br-fx')!;
  flood.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.1 }, { opacity: 0.5, offset: 0.2 }, { opacity: 0.9, offset: 0.3 }, { opacity: 0.8 }], { duration: 1700, fill: 'forwards', easing: 'steps(10, end)' });
  const sayIt = (line: string) => typeOut(el.querySelector<HTMLElement>('.br-say')!, line, s);
  const faceIn = (o = 0.55) => {
    const frames: Keyframe[] = [];
    for (let i = 0; i < 9; i++) { const a = Math.random() * 80; frames.push({ clipPath: `inset(${a}% 0 ${100 - a - 8 - Math.random() * 20}% 0)`, transform: `translate(-50%, -50%) translateX(${(Math.random() - 0.5) * 60}px)`, opacity: 0.9 }); }
    frames.push({ clipPath: 'inset(0 0 0 0)', transform: 'translate(-50%, -50%)', opacity: o });
    face.animate(frames, { duration: 900, easing: 'steps(10, end)', fill: 'forwards' });
  };
  const textIn = () => txt.animate([{ opacity: 0, transform: 'translateX(-30px) skewX(-12deg)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'steps(5, end)', fill: 'both' });

  // 1. THE TAKEOVER, in the hero's own way
  await (STYLES[t.slug] ?? STYLES.default)({ el, fx, face, s, sayIt, faceIn, textIn, t });

  // 2. EIGHT SECONDS TO CUT THEM OFF
  const won = await fight(el, s);

  // 3. THE ENDING
  el.classList.add('ending');
  if (won) await countermeasure(el, t, s);
  else await getaway(el, t, prize, s);
  html.classList.remove('breaching');
  if (won) breached(t.name); else stole(prize.slug, prize.name, t.name);
  await el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' }).finished;
  el.remove();
  say(won ? `${t.name} is out. The network is Your Majesty's again.` : `${t.name} got away with the file on ${prize.name}. Open it to take it back.`);
}

/** Types a line in, a relay tick on every few letters. */
async function typeOut(p: HTMLElement, line: string, s: Sound, ms = 26) {
  p.textContent = '';
  for (let i = 0; i < line.length; i++) { p.textContent = line.slice(0, i + 1); if (i % 3 === 0) tick(s); await wait(ms); }
}

type Ctx = { el: HTMLElement; fx: HTMLElement; face: HTMLElement; s: Sound; sayIt: (l: string) => Promise<void>; faceIn: (o?: number) => void; textIn: () => void; t: T };
const panels = () => [...document.querySelectorAll<HTMLElement>('.screen .os-panel')].filter((p) => { const r = p.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).slice(0, 6);

const STYLES: Record<string, (c: Ctx) => Promise<void>> = {
  // the god of lies fakes the all-clear, then lets it crack
  async loki({ el, fx, s, sayIt, faceIn, textIn }) {
    el.classList.add('fake');
    fx.innerHTML = '<div class="br-fake"><p>Countermeasure deployed<br/><b>DOOM-OS restored</b></p></div>';
    lock(s);
    await wait(1300);
    staticBurst(s);
    fx.querySelector('.br-fake')!.animate([{ transform: 'none', filter: 'none' }, { transform: 'skewX(-14deg) translateX(20px)', filter: 'hue-rotate(-60deg)' }, { transform: 'none', opacity: 0 }], { duration: 500, easing: 'steps(6, end)', fill: 'forwards' });
    el.classList.remove('fake');
    faceIn(0.7); textIn();
    await sayIt('Restored? How very trusting of you, Victor.');
    await wait(500);
  },
  // telepathy: he types into Doom's own command line, from inside his head
  async 'professor-x'({ fx, s, sayIt, faceIn, textIn }) {
    fx.innerHTML = '<div class="br-rings"><i></i><i></i><i></i></div><div class="br-term"><span>DOOM-OS:\\&gt;</span> <b></b><em>_</em></div>';
    const term = fx.querySelector<HTMLElement>('.br-term b')!;
    await typeOut(term, 'every file you open, I already know', s, 45);
    faceIn(0.45); textIn();
    await sayIt('Your mind is louder than your machines, Victor.');
    await wait(400);
  },
  // teleporting: the panels of the screen jump about in puffs of smoke
  async nightcrawler({ fx, s, sayIt, faceIn, textIn }) {
    const ps = panels();
    faceIn(0.5); textIn();
    const talk = sayIt('Your walls have doors now, Herr Doktor.');
    for (let j = 0; j < 4; j++) {
      ps.forEach((p) => {
        const r = p.getBoundingClientRect(), dx = (Math.random() - 0.5) * 160, dy = (Math.random() - 0.5) * 120;
        puff(fx, r.left + r.width / 2, r.top + r.height / 2);
        p.animate([{ transform: `translate(${dx}px, ${dy}px)`, opacity: 0.85 }, { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.85 }], { duration: 420, fill: 'none' });
      });
      staticBurst(s);
      await wait(430);
    }
    await talk; await wait(200);
  },
  // phasing: the panels and the face slip in and out of being
  async ghost({ el, s, sayIt, faceIn, textIn }) {
    el.classList.add('phase');
    const ps = panels();
    ps.forEach((p, i) => p.animate([{ opacity: 1 }, { opacity: 0.15 }, { opacity: 0.9 }, { opacity: 0.05 }, { opacity: 1 }], { duration: 900, delay: i * 80, iterations: 2, easing: 'steps(4, end)' }));
    faceIn(0.6); textIn(); staticBurst(s);
    await sayIt("You can't firewall what isn't there.");
    await wait(500);
  },
  // Wakandan code pours down the screen
  async shuri({ fx, s, sayIt, faceIn, textIn }) {
    const c = document.createElement('canvas'); c.className = 'br-rain'; fx.append(c);
    const stop = rain(c);
    faceIn(0.5); textIn(); decrypt(s);
    await sayIt('Your encryption is from the last century, Victor.');
    await wait(600);
    stop();
  },
  async default({ s, sayIt, faceIn, textIn, t }) {
    faceIn(); textIn(); staticBurst(s);
    await sayIt(`${t.name} is inside the network. Every file you open, they see.`);
    await wait(500);
  },
};

/** A puff of indigo smoke where a panel was. */
function puff(host: HTMLElement, x: number, y: number) {
  const p = document.createElement('i'); p.className = 'br-puff'; p.style.left = `${x}px`; p.style.top = `${y}px`; host.append(p);
  p.animate([{ transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0.9 }, { transform: 'translate(-50%, -50%) scale(1.6)', opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished.then(() => p.remove());
}

/** Columns of falling glyphs in Shuri's purple. Returns a stop. */
function rain(c: HTMLCanvasElement) {
  const dpr = Math.min(1.5, devicePixelRatio || 1), W = innerWidth, H = innerHeight, size = 16;
  c.width = W * dpr; c.height = H * dpr; const g = c.getContext('2d')!; g.scale(dpr, dpr);
  const cols = Math.ceil(W / size), y = Array.from({ length: cols }, () => Math.random() * -H);
  const glyphs = '01ABCDEF+=<>/\\|#%&';
  let on = true, last = 0;
  const frame = (now: number) => {
    if (!on) return;
    requestAnimationFrame(frame);
    if (now - last < 45) return; last = now;
    g.fillStyle = 'rgba(10, 0, 20, 0.18)'; g.fillRect(0, 0, W, H);
    g.font = `${size}px "JetBrains Mono", monospace`;
    for (let i = 0; i < cols; i++) {
      g.fillStyle = Math.random() < 0.08 ? '#f0d8ff' : '#b26bff';
      g.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], i * size, y[i]);
      y[i] = y[i] > H + Math.random() * 400 ? 0 : y[i] + size;
    }
  };
  requestAnimationFrame(frame);
  return () => { on = false; c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }); };
}

/** Five nodes, eight seconds. Resolves true if every node is cut in time. Escape lets the Doombots finish it. */
function fight(el: HTMLElement, s: Sound) {
  return new Promise<boolean>((done) => {
    const box = el.querySelector<HTMLElement>('.br-fight')!, bar = box.querySelector<HTMLElement>('.br-timer i')!, pct = box.querySelector('.br-pct b')!;
    box.hidden = false; el.classList.add('fighting');
    const dock = innerWidth < 768 ? 96 : 30, spots: [number, number][] = [];
    const W = innerWidth, H = innerHeight, gap = Math.min(W, H) * 0.2;
    for (let i = 0; i < NODES; i++) {
      let p: [number, number] = [0, 0];
      for (let k = 0; k < 40; k++) { p = [W * (0.12 + Math.random() * 0.76), 90 + Math.random() * (H - 90 - dock - 120)]; if (spots.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > gap)) break; }
      spots.push(p);
    }
    let left = NODES, over = false;
    const end = (won: boolean) => { if (over) return; over = true; clearInterval(iv); removeEventListener('keydown', esc); el.classList.remove('fighting'); box.hidden = true; nodes.forEach((n) => n.remove()); done(won); };
    const nodes = spots.map(([x, y], i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'br-node'; b.style.left = `${x}px`; b.style.top = `${y}px`; b.style.setProperty('--d', `${i * 0.07}s`);
      b.innerHTML = `<i></i><span>${hex()}:${hex()}</span>`; b.setAttribute('aria-label', `Intrusion node ${i + 1}: cut it`);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); cut(b); });
      b.addEventListener('click', () => cut(b));
      el.append(b);
      return b;
    });
    const cut = (b: HTMLButtonElement) => {
      if (over || b.classList.contains('cut')) return;
      b.classList.add('cut'); sever(s); left--;
      if (left === 0) { lock(s); setTimeout(() => end(true), 260); }
      else nodes.find((n) => !n.classList.contains('cut'))?.focus({ preventScroll: true });
    };
    nodes[0].focus({ preventScroll: true });
    const t0 = performance.now();
    const iv = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / FIGHT);
      bar.style.transform = `scaleX(${1 - k})`; pct.textContent = `${Math.round(k * 100)}%`;
      el.style.setProperty('--heat', String(k));
      if (k > 0.6 && Math.random() < 0.18) tick(s);
      if (k >= 1) end(false);
    }, 50);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') end(true); };
    addEventListener('keydown', esc);
  });
}

/** Doom answers: his mask fills the screen, red burns back to green, the shards slam shut over the intruder. */
async function countermeasure(el: HTMLElement, t: T, s: Sound) {
  const end = el.querySelector<HTMLElement>('.br-end')!;
  end.innerHTML = `<div class="ce-green"></div><div class="ce-mask">${MASK}</div><svg class="ce-shards" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg><div class="ce-text"><p>Countermeasure // Doombots deployed</p><b></b><span>The network belongs to Doom</span></div>`;
  end.querySelector('b')!.textContent = `${t.name} expelled`;
  end.classList.add('on');
  const green = end.querySelector<HTMLElement>('.ce-green')!, mask = end.querySelector<HTMLElement>('.ce-mask')!, txt = end.querySelector<HTMLElement>('.ce-text')!;
  green.animate([{ clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 520, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'forwards' });
  mask.animate([{ transform: 'translate(-50%, -50%) scale(0.2)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(1.08)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
  lock(s);
  await wait(650);
  // the shards of Battleworld close in from every side and slam shut
  const svg = end.querySelector<SVGSVGElement>('.ce-shards')!, ring: string[] = [];
  const pts = Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2 + Math.random() * 0.2; return [50 + Math.cos(a) * 75, 50 + Math.sin(a) * 75]; });
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; ring.push(`<polygon points="50,50 ${p[0].toFixed(1)},${p[1].toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}" />`); });
  svg.innerHTML = ring.join('');
  [...svg.querySelectorAll('polygon')].forEach((g, i) => {
    const a = (i / 14) * Math.PI * 2, dx = Math.cos(a) * 60, dy = Math.sin(a) * 60;
    g.animate([{ transform: `translate(${dx}%, ${dy}%)` }, { transform: 'none' }], { duration: 380, delay: i * 14, easing: 'cubic-bezier(.7,0,.9,.4)', fill: 'both' });
  });
  await wait(420); slam(s);
  end.animate([{ transform: 'translate(0, 0)' }, { transform: 'translate(-6px, 4px)' }, { transform: 'translate(5px, -3px)' }, { transform: 'none' }], { duration: 260 });
  txt.animate([{ opacity: 0, transform: 'scale(1.3)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
  await wait(1700);
}

/** The hero gets away: the stolen file's name burns into the red, then the screen goes dark. */
async function getaway(el: HTMLElement, t: T, prize: T, s: Sound) {
  const end = el.querySelector<HTMLElement>('.br-end')!;
  end.innerHTML = `<div class="ga-text"><p>Trace complete // connection lost</p><b></b><span></span></div>`;
  end.querySelector('b')!.textContent = `${t.name} got away`;
  end.querySelector('span')!.textContent = `with the file on ${prize.name}. Open it to take it back.`;
  end.classList.add('on', 'lost');
  alarm(s); staticBurst(s);
  end.querySelector('.ga-text')!.animate([{ opacity: 0, letterSpacing: '0.4em' }, { opacity: 1, letterSpacing: '0.02em' }], { duration: 600, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
  await wait(2600);
}
