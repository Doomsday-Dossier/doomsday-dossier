/**
 * A target file: the target scanned in and locked (with their signature sound), callouts pinned to the figure, the
 * threat radar, His Majesty's verdict stamped on the scan, the brief decrypting, clearance levels opening on
 * request (remembered, localStorage `dd-clearance`), the signal history rising and the associates wired in. The
 * crosshair locks on the target's face (hud.ts `lockPoints`). Every visit is entered in the royal log.
 */
import { onLeave } from '../../page-scope';
import { sweep, tick, decrypt, lock as lockTone } from '../../sound/os';
import { stamp as stampSound, tear } from '../../sound/actions';
import { playSignature } from '../../sound/signatures';
import { callouts, radar, setLockPoints } from '../hud';
import { createScanner, canScan, type Scanner } from '../scanner';
import { lockOn, decryptIn, wait, reduced, sound, whenSeen } from '../fx';
import { reign, setVerdict, examined, VERDICTS, type Verdict } from '../reign';

type F = { slug: string; no: number; name: string; alias: string; photo: string; depth: string; head: [number, number]; bbox: [number, number, number, number]; grid: Record<string, number> | null; threat: number | null; abilities: string[]; isDoom: boolean };
const CLEAR = 'dd-clearance';

export async function file() {
  const raw = document.querySelector('[data-file]'); if (!raw) return;
  const F = JSON.parse(raw.textContent!) as F;
  const s = sound(), html = document.documentElement;
  let gone = false; onLeave(() => { gone = true; setLockPoints(null); });
  examined(F.slug, F.name);

  // the verdict
  const stampEl = document.querySelector<HTMLElement>('[data-stamp]')!;
  const showVerdict = (v: Verdict | undefined, slam = false) => {
    document.querySelectorAll<HTMLButtonElement>('[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    stampEl.hidden = !v;
    if (!v) return;
    stampEl.textContent = VERDICTS[v].name; stampEl.className = `f-stamp ${VERDICTS[v].cls}`;
    if (slam && !reduced()) stampEl.animate([{ transform: 'rotate(-8deg) scale(2.2)', opacity: 0 }, { transform: 'rotate(-8deg) scale(0.94)', opacity: 1, offset: 0.7 }, { transform: 'rotate(-8deg) scale(1)' }], { duration: 380, easing: 'cubic-bezier(.5,0,.75,0)' });
  };
  document.querySelectorAll<HTMLButtonElement>('[data-v]').forEach((b) => b.addEventListener('click', () => {
    const v = b.dataset.v as Verdict, cur = reign().verdicts[F.slug];
    if (cur === v) { setVerdict(F.slug, null, F.name); showVerdict(undefined); tick(s); return; }
    setVerdict(F.slug, v, F.name); showVerdict(v, true); stampSound(s);
  }));

  // clearance levels: once granted, granted on every file
  const cleared = () => { try { return Number(localStorage.getItem(CLEAR) || 0); } catch { return 0; } };
  const open = (lvl: number, animate: boolean) => {
    for (let l = 2; l <= lvl; l++) {
      const sec = document.querySelector<HTMLElement>(`[data-level="${l}"]`); if (!sec || !sec.classList.contains('locked')) continue;
      sec.classList.remove('locked');
      const body = sec.querySelector<HTMLElement>('.lv-body')!; body.inert = false;
      if (animate) {
        tear(s, undefined, 0.18); decrypt(s);
        body.querySelectorAll<HTMLElement>('[data-head]').forEach((h, i) => { if (i < 24) decryptIn(h, h.textContent ?? '', 500 + i * 30); });
      }
    }
  };
  open(cleared(), false);
  document.querySelectorAll<HTMLButtonElement>('[data-clear]').forEach((b) => b.addEventListener('click', () => {
    const lvl = Number(b.dataset.clear);
    try { localStorage.setItem(CLEAR, String(Math.max(cleared(), lvl))); } catch { /* private mode */ }
    open(lvl, true);
  }));

  // the brief decrypts as it comes on screen
  const briefRows = [...document.querySelectorAll<HTMLElement>('[data-decrypt]')];
  const bp = briefRows[0]?.closest('section');
  if (bp) whenSeen(bp, () => { decrypt(s); briefRows.forEach((el, i) => setTimeout(() => decryptIn(el, el.textContent ?? '', 700), i * 160)); });

  // the signal history rises as it comes on screen
  const sig = document.querySelector<HTMLElement>('[data-sig]');
  if (sig && !reduced()) { sig.style.setProperty('--grow', '0'); whenSeen(sig, () => { sig.querySelectorAll<HTMLElement>('.sg i').forEach((b, i) => { b.style.transitionDelay = `${i * 8}ms`; }); requestAnimationFrame(() => sig.style.setProperty('--grow', '1')); }); }

  // the associates: lines from the target to each, as thick as the titles they shared
  const as = document.querySelector<HTMLElement>('[data-assoc]');
  const wire = () => {
    if (!as) return;
    const svg = as.querySelector<SVGSVGElement>('[data-assoc-lines]')!, box = as.getBoundingClientRect(), me = as.querySelector<HTMLElement>('.assoc-me img')!.getBoundingClientRect();
    const cx = me.left + me.width / 2 - box.left, cy = me.top + me.height / 2 - box.top;
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    svg.innerHTML = [...as.querySelectorAll<HTMLElement>('.assoc-n')].map((n) => { const r = n.querySelector('img')!.getBoundingClientRect(); return `<line x1="${cx}" y1="${cy}" x2="${r.left + r.width / 2 - box.left}" y2="${r.top + r.height / 2 - box.top}" stroke-width="${Math.min(4, 0.6 + Number(n.dataset.w) * 0.6)}"/>`; }).join('');
    if (!reduced()) svg.querySelectorAll('line').forEach((l, i) => { const len = Math.hypot(+l.getAttribute('x2')! - cx, +l.getAttribute('y2')! - cy); l.style.strokeDasharray = `${len}`; l.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 700, delay: i * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }); });
  };
  if (as) whenSeen(as, wire);

  // the scan
  const host = document.querySelector<HTMLElement>('[data-f-scan]')!, status = document.querySelector<HTMLElement>('[data-status]')!;
  if (F.grid) { const rh = document.querySelector<HTMLElement>('[data-radar]'); if (rh) whenSeen(rh, () => { radar(rh, F.grid!); for (let i = 0; i < 6; i++) setTimeout(() => tick(s), i * 110); }); }
  showVerdict(reign().verdicts[F.slug]);
  if (!canScan()) { html.classList.add('no-scan'); status.textContent = 'Target on file'; return; }
  let sc: Scanner;
  try { sc = await createScanner(host.querySelector<HTMLCanvasElement>('[data-scan]')!, F.photo, F.depth, F.head); }
  catch (e) { if (/^(localhost|127\.)/.test(location.hostname)) console.warn('scanner', e); html.classList.add('no-scan'); status.textContent = 'Target on file'; return; }
  if (gone) { sc.dispose(); return; }
  onLeave(() => sc.dispose());
  status.textContent = 'Scanning';
  sweep(s, 2.2);
  await sc.scan(reduced() ? 0 : 2.2);
  if (gone) return;
  sc.colour(1, 1.8);
  const ret = host.querySelector<HTMLElement>('[data-ret]')!;
  lockOn(ret, sc.head(), () => { if (!gone) playSignature(s, F.slug); });
  status.textContent = F.isDoom ? 'Identity: Your Majesty' : 'Target locked · scan complete';
  // callouts pinned to the figure: codename at the face, the first two abilities at the chest and a hand
  const [x0, y0, x1, y1] = F.bbox, [hx, hy] = F.head, sh = y1 - y0, sw = x1 - x0;
  const place = () => {
    const pts = [
      { ...sc.at(hx, hy + sh * 0.07), k: F.isDoom ? 'Sovereign' : 'Codename', t: F.alias },
      F.abilities[0] && { ...sc.at(hx + sw * 0.04, hy + sh * 0.3), k: 'Capability', t: F.abilities[0] },
      F.abilities[1] && { ...sc.at(x0 + sw * 0.22, hy + sh * 0.5), k: 'Capability', t: F.abilities[1] },
    ].filter(Boolean) as { x: number; y: number; k: string; t: string }[];
    callouts(host.querySelector<SVGSVGElement>('[data-co]')!, pts, host.clientWidth);
  };
  setTimeout(() => { if (!gone) place(); }, reduced() ? 0 : 800);
  // the crosshair locks on this face
  setLockPoints(() => { const r = host.getBoundingClientRect(), h = sc.head(); return [{ x: r.left + h.x, y: r.top + h.y, label: `LOCKED // ${F.name.toUpperCase()}` }]; });
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(() => { if (gone) return; place(); wire(); const h = sc.head(); ret.style.left = `${h.x}px`; ret.style.top = `${h.y}px`; }, 200); });
  void wait; void lockTone;
}
