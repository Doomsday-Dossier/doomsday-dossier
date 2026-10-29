/**
 * The royal chamber: the order of conquest (pointer drag with the rows sliding aside, or the arrow buttons), the
 * verdicts gathered, the decree under Doom's seal (this site's own seal: a ring of text round the mask we drew for
 * Doom's will), the full royal log, and two saveable cards drawn on a canvas. All of it from reign.ts, on this
 * device only.
 */
import { tick } from '../../sound/os';
import { stamp } from '../../sound/actions';
import { reign, setOrder, setDecree, log, eraseReign, will, daysBefore, VERDICTS, type Verdict } from '../reign';
import { reduced, sound } from '../fx';

type T = { slug: string; no: number; name: string; team: string; teamId: string; href: string; tile: string };

export const SEAL = `<svg viewBox="0 0 100 100"><defs><path id="sealp" d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0"/></defs><circle cx="50" cy="50" r="47" fill="none" stroke="#3dff8f" stroke-width="2"/><circle cx="50" cy="50" r="30" fill="rgba(61,255,143,0.12)" stroke="#3dff8f" stroke-width="1.2"/><text font-family="JetBrains Mono, monospace" font-size="8.4" font-weight="700" letter-spacing="2.2" fill="#3dff8f"><textPath href="#sealp">LATVERIA · BY ORDER OF DOOM · LATVERIA ·</textPath></text><g transform="translate(38 34) scale(0.6)" fill="rgba(2,16,9,0.6)" stroke="#3dff8f" stroke-width="1.6"><path d="M6 5 Q20 0 34 5 L36 30 Q34 44 20 49 Q6 44 4 30 Z"/><path d="M20 9 L20 31" fill="none"/><rect x="8.5" y="17" width="9.5" height="2.6" fill="#3dff8f" stroke="none"/><rect x="22" y="17" width="9.5" height="2.6" fill="#3dff8f" stroke="none"/><path d="M13 36 L27 36 M14 39 L26 39 M15.5 42 L24.5 42" fill="none"/></g></svg>`;

export function chamber() {
  const raw = document.querySelector('[data-chamber]'); if (!raw) return;
  const D = JSON.parse(raw.textContent!) as { all: T[]; site: string };
  const by = new Map(D.all.map((t) => [t.slug, t]));
  const s = sound();
  const list = document.querySelector<HTMLOListElement>('[data-cq]')!;

  // THE ORDER OF CONQUEST
  const items = () => [...list.querySelectorAll<HTMLLIElement>('.cq-i')];
  const number = () => items().forEach((li, i) => { li.querySelector('.cq-n')!.textContent = String(i + 1).padStart(2, '0'); });
  const saved = reign().order.filter((x) => by.has(x));
  if (saved.length) { for (const slug of saved) { const li = list.querySelector(`[data-slug="${slug}"]`); if (li) list.append(li); } }
  const store = () => { number(); setOrder(items().map((li) => li.dataset.slug!)); };
  number();
  // the rows slide to their new places (FLIP)
  const flip = (fn: () => void) => {
    const before = new Map(items().map((li) => [li, li.getBoundingClientRect().top]));
    fn();
    if (reduced()) return;
    for (const li of items()) { const d = before.get(li)! - li.getBoundingClientRect().top; if (d && !li.classList.contains('drag')) li.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
  };
  list.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button'); if (!b) return;
    const li = b.closest<HTMLLIElement>('.cq-i')!;
    flip(() => { if (b.dataset.up !== undefined && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling); if (b.dataset.down !== undefined && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li); });
    tick(s); store(); b.focus();
  });
  // dragging: the row follows the pointer; passing a neighbour's middle swaps them
  let drag: { li: HTMLLIElement; grab: number; ty: number } | null = null;
  const follow = (y: number) => {
    if (!drag) return;
    const natural = drag.li.getBoundingClientRect().top - drag.ty;
    drag.ty = y - drag.grab - natural; drag.li.style.transform = `translateY(${drag.ty}px)`;
  };
  list.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('button, a')) return;
    const li = t.closest<HTMLLIElement>('.cq-i'); if (!li) return;
    drag = { li, grab: e.clientY - li.getBoundingClientRect().top, ty: 0 };
    li.classList.add('drag'); li.setPointerCapture(e.pointerId); tick(s);
  });
  list.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const { li } = drag, mid = e.clientY - drag.grab + li.offsetHeight / 2;
    const prev = li.previousElementSibling as HTMLElement | null, next = li.nextElementSibling as HTMLElement | null;
    if (prev && mid < prev.getBoundingClientRect().top + prev.offsetHeight / 2) { flip(() => list.insertBefore(li, prev)); tick(s); }
    else if (next && mid > next.getBoundingClientRect().top + next.offsetHeight / 2) { flip(() => list.insertBefore(next, li)); tick(s); }
    follow(e.clientY);
  });
  const drop = () => {
    if (!drag) return;
    const li = drag.li, ty = drag.ty; drag = null;
    li.classList.remove('drag'); li.style.transform = '';
    if (!reduced() && ty) li.animate([{ transform: `translateY(${ty}px)` }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
    store(); stamp(s);
  };
  list.addEventListener('pointerup', drop); list.addEventListener('pointercancel', drop);
  document.querySelector('[data-cq-reset]')!.addEventListener('click', () => {
    flip(() => [...items()].sort((a, b) => by.get(a.dataset.slug!)!.no - by.get(b.dataset.slug!)!.no).forEach((li) => list.append(li)));
    store(); tick(s);
  });
  document.querySelector('[data-cq-card]')!.addEventListener('click', () => conquestCard(items().map((li) => by.get(li.dataset.slug!)!), D.site));

  // VERDICTS, LOG, STATS
  const render = () => {
    const r = reign();
    for (const li of items()) { const v = r.verdicts[li.dataset.slug!], el = li.querySelector<HTMLElement>('[data-v]')!; el.textContent = v ? VERDICTS[v].name : ''; el.className = `cq-v ${v ? VERDICTS[v].cls : ''}`; }
    const vd = document.querySelector<HTMLElement>('[data-vd]')!; vd.innerHTML = '';
    const n = Object.keys(r.verdicts).length;
    document.querySelector('[data-v-count]')!.textContent = `${n} of ${D.all.length - 1} judged`;
    (Object.keys(VERDICTS) as Verdict[]).forEach((k) => {
      const who = Object.entries(r.verdicts).filter(([, v]) => v === k).map(([slug]) => by.get(slug)).filter(Boolean) as T[];
      const g = document.createElement('div'); g.className = 'vd-g';
      g.innerHTML = `<b class="${VERDICTS[k].cls}">${VERDICTS[k].name} · ${who.length}</b><div></div>`;
      for (const t of who) { const a = document.createElement('a'); a.href = t.href; a.title = t.name; a.innerHTML = `<img src="${t.tile}" alt="${t.name}" loading="lazy">`; g.lastElementChild!.append(a); }
      vd.append(g);
    });
    const ol = document.querySelector<HTMLElement>('[data-rlog-full]')!; ol.innerHTML = '';
    for (const l of r.log) { const li = document.createElement('li'); const i = document.createElement('i'); i.textContent = `${daysBefore(l.t)} days before Doomsday`; li.append(i, document.createTextNode(l.text)); ol.append(li); }
    if (!r.log.length) ol.innerHTML = '<li class="os-label">The log is empty.</li>';
    document.querySelector('[data-reign-days]')!.textContent = String(Math.max(0, Math.floor((Date.now() - r.since) / 86400000)));
    document.querySelector('[data-will-n]')!.textContent = `${Math.round(will() * 100)}%`;
    document.querySelector('[data-breaches]')!.textContent = String(r.breaches);
  };
  render();
  addEventListener('dd:reign', render);

  // THE DECREE
  const to = document.querySelector<HTMLSelectElement>('[data-dc-to]')!, text = document.querySelector<HTMLTextAreaElement>('[data-dc-text]')!;
  const seal = document.querySelector<HTMLElement>('[data-seal]')!; seal.innerHTML = SEAL;
  const cardBtn = document.querySelector<HTMLButtonElement>('[data-dc-card]')!;
  const prev = () => {
    document.querySelector('[data-dc-to-prev]')!.textContent = `To ${to.value}:`;
    document.querySelector('[data-dc-body]')!.textContent = text.value || text.placeholder;
    document.querySelector('[data-dc-left]')!.textContent = String(200 - text.value.length);
  };
  const dec = reign().decree || '', cut = dec.indexOf('\n'), dTo = dec.slice(0, cut), dBody = cut > 0 ? dec.slice(cut + 1) : '';
  if (dBody) { to.value = dTo; text.value = dBody; seal.classList.add('on'); cardBtn.disabled = false; }
  prev();
  to.addEventListener('change', () => { prev(); seal.classList.remove('on'); cardBtn.disabled = true; });
  text.addEventListener('input', () => { prev(); seal.classList.remove('on'); cardBtn.disabled = true; });
  document.querySelector('[data-dc-seal]')!.addEventListener('click', () => {
    if (!text.value.trim()) text.value = text.placeholder;
    prev(); setDecree(`${to.value}\n${text.value.trim()}`); log(`His Majesty decreed to ${to.value}.`);
    seal.classList.add('on'); stamp(s); cardBtn.disabled = false;
    if (!reduced()) seal.animate([{ transform: 'scale(2.4) rotate(-20deg)', opacity: 0 }, { transform: 'scale(0.92) rotate(4deg)', opacity: 1, offset: 0.7 }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.5,0,.75,0)' });
  });
  cardBtn.addEventListener('click', () => decreeCard(to.value, text.value.trim(), D.site));

  // ENDING THE REIGN (two clicks)
  const erase = document.querySelector<HTMLButtonElement>('[data-erase]')!;
  let armed = 0;
  erase.addEventListener('click', () => {
    if (Date.now() - armed > 3000) { armed = Date.now(); erase.textContent = 'Click again to erase everything'; return; }
    eraseReign(); erase.textContent = 'Erase the reign'; text.value = ''; prev(); seal.classList.remove('on');
    flip(() => [...items()].sort((a, b) => by.get(a.dataset.slug!)!.no - by.get(b.dataset.slug!)!.no).forEach((li) => list.append(li))); number();
  });
}

// THE CARDS ------------------------------------------------------------------------------------------------
const G = '#3dff8f', BG = '#020504', DIM = '#5f8f74', TXT = '#cdf5df';
async function canvasFor(w: number, h: number) {
  await Promise.all(['700 40px "Tektur Variable"', '400 20px "JetBrains Mono"', '700 20px "JetBrains Mono"'].map((f) => document.fonts.load(f).catch(() => {})));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = BG; g.fillRect(0, 0, w, h);
  // the lattice and scan rows of the screen
  g.fillStyle = 'rgba(61,255,143,0.08)'; for (let y = 0; y < h; y += 22) for (let x = 0; x < w; x += 22) g.fillRect(x, y, 1.5, 1.5);
  g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  g.strokeStyle = G; g.lineWidth = 3; const k = 34;
  g.beginPath(); g.moveTo(24, 24 + k); g.lineTo(24, 24); g.lineTo(24 + k, 24); g.moveTo(w - 24 - k, h - 24); g.lineTo(w - 24, h - 24); g.lineTo(w - 24, h - 24 - k); g.stroke();
  return { c, g };
}
const img = (src: string) => new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
const foot = (g: CanvasRenderingContext2D, w: number, h: number, site: string, what: string) => {
  g.font = '400 17px "JetBrains Mono"'; g.fillStyle = DIM; g.textAlign = 'left';
  g.fillText(`${what} · Unofficial fan site, not affiliated with Marvel or Disney`, 48, h - 64);
  g.fillText(`Images belong to their respective owners. · ${site}`, 48, h - 40);
};
const wrap = (g: CanvasRenderingContext2D, text: string, width: number) => {
  const lines: string[] = []; let line = '';
  for (const w of text.split(/\s+/)) { const t = line ? line + ' ' + w : w; if (line && g.measureText(t).width > width) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
};
const save = (c: HTMLCanvasElement, name: string) => c.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');

async function conquestCard(order: T[], site: string) {
  const W = 1080, H = 1350, { c, g } = await canvasFor(W, H);
  g.fillStyle = DIM; g.font = '700 20px "JetBrains Mono"'; g.fillText('DOOM-OS // ROYAL CHAMBER', 48, 86);
  g.fillStyle = G; g.font = '700 74px "Tektur Variable"'; g.shadowColor = G; g.shadowBlur = 18; g.fillText('ORDER OF', 48, 172); g.fillText('CONQUEST', 48, 246); g.shadowBlur = 0;
  const top = order.slice(0, 10), pics = await Promise.all(top.map((t) => img(t.tile)));
  top.forEach((t, i) => {
    const y = 300 + i * 92, p = pics[i];
    g.fillStyle = i < 3 ? '#ff4040' : G; g.font = '700 30px "JetBrains Mono"'; g.fillText(String(i + 1).padStart(2, '0'), 48, y + 52);
    if (p) { const s = Math.min(p.naturalWidth, p.naturalHeight * 0.75); g.save(); g.filter = 'grayscale(1) sepia(1) hue-rotate(80deg) saturate(2.2)'; g.drawImage(p, (p.naturalWidth - s) / 2, 0, s, s, 120, y, 76, 76); g.restore(); g.strokeStyle = 'rgba(61,255,143,0.4)'; g.lineWidth = 1; g.strokeRect(120, y, 76, 76); }
    g.fillStyle = TXT; g.font = '700 38px "Tektur Variable"'; g.fillText(t.name.toUpperCase(), 222, y + 44);
    g.fillStyle = DIM; g.font = '400 18px "JetBrains Mono"'; g.fillText(t.team.toUpperCase(), 222, y + 70);
  });
  foot(g, W, H, site, 'Fan opinion');
  save(c, 'doom-order-of-conquest.png');
}

async function decreeCard(to: string, body: string, site: string) {
  const W = 1200, H = 630, { c, g } = await canvasFor(W, H);
  const sealImg = await img('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SEAL.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')));
  if (sealImg) g.drawImage(sealImg, W - 300, 70, 220, 220);
  g.fillStyle = DIM; g.font = '700 18px "JetBrains Mono"'; g.fillText('BY ORDER OF VICTOR VON DOOM, MONARCH OF LATVERIA', 56, 92);
  // the heading shrinks to fit beside the seal, then takes a second line, so no recipient is ever cut
  const head = `TO ${to.toUpperCase()}`, room = W - 56 - 340;
  let size = 46; g.font = `700 ${size}px "Tektur Variable"`;
  while (size > 34 && g.measureText(head).width > room) { size -= 2; g.font = `700 ${size}px "Tektur Variable"`; }
  const heads = wrap(g, head, room);
  g.fillStyle = G; g.shadowColor = G; g.shadowBlur = 14;
  heads.forEach((l, i) => g.fillText(l, 56, 160 + i * size * 1.1)); g.shadowBlur = 0;
  // the decree, wrapped
  g.fillStyle = TXT; g.font = '400 30px "JetBrains Mono"';
  const top = 230 + (heads.length - 1) * size * 1.1;
  wrap(g, body, W - 420).slice(0, heads.length > 1 ? 6 : 7).forEach((l, i) => g.fillText(l, 56, top + i * 44));
  foot(g, W, H, site, 'A fan decree');
  save(c, 'doom-decree.png');
}
