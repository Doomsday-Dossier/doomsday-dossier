/**
 * The change of screen as Battleworld (Secret Wars, 2015: Doom pieces a world together from the shards of dead
 * universes). On a page change cracks run out from where the visitor clicked, dark glass shards slam in to close
 * the screen, the next page loads underneath, and the shards burst outward to show it. A few shards carry a faint
 * target trapped in the glass. SVG polygons moved by transform and opacity only, so the compositor keeps them
 * smooth however busy the page change is.
 */
const NS = 'http://www.w3.org/2000/svg';

type Pt = [number, number];
/** Voronoi cells of `seeds` inside the w by h screen: each cell clipped by every perpendicular bisector. */
function cells(seeds: Pt[], w: number, h: number) {
  return seeds.map((s, i) => {
    let poly: Pt[] = [[0, 0], [w, 0], [w, h], [0, h]];
    for (let j = 0; j < seeds.length && poly.length; j++) {
      if (j === i) continue;
      const o = seeds[j], mx = (s[0] + o[0]) / 2, my = (s[1] + o[1]) / 2, nx = o[0] - s[0], ny = o[1] - s[1];
      const side = (p: Pt) => (p[0] - mx) * nx + (p[1] - my) * ny; // <= 0 keeps the side of s
      const out: Pt[] = [];
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], b = poly[(k + 1) % poly.length], da = side(a), db = side(b);
        if (da <= 0) out.push(a);
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      poly = out;
    }
    return { seed: s, poly };
  }).filter((c) => c.poly.length > 2);
}

let svg: SVGSVGElement | null = null;
let shards: { g: SVGGElement; c: Pt; d: Pt }[] = [];
let tiles: string[] = [];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function setShardTiles(list: string[]) { tiles = list.filter(Boolean); }

/** Cracks from `origin`, then shards close the screen. Resolves once it is covered. */
export async function shatterCover(origin: Pt): Promise<void> {
  svg = document.querySelector<SVGSVGElement>('[data-shatter]');
  if (!svg || reduced()) return;
  const w = innerWidth, h = innerHeight, phone = w < 768;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = '';
  svg.classList.add('on');
  // seeds gather near the click so the glass breaks finer where it was struck
  const n = phone ? 14 : 26, seeds: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const near = i < n * 0.45, r = near ? Math.random() * Math.min(w, h) * 0.35 : 0, a = Math.random() * Math.PI * 2;
    seeds.push(near ? [Math.min(w, Math.max(0, origin[0] + Math.cos(a) * r)), Math.min(h, Math.max(0, origin[1] + Math.sin(a) * r))] : [Math.random() * w, Math.random() * h]);
  }
  const cs = cells(seeds, w, h);
  // the cracks: every cell edge, drawn out from the strike
  const cracks = document.createElementNS(NS, 'g'); cracks.setAttribute('class', 'sh-cracks');
  let d = '';
  for (const c of cs) d += 'M' + c.poly.map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L') + 'Z';
  const path = document.createElementNS(NS, 'path'); path.setAttribute('d', d); cracks.append(path);
  const defs = document.createElementNS(NS, 'defs');
  svg.append(defs);
  shards = cs.map((c, i) => {
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'sh');
    const pts = c.poly.map((p) => p.join(',')).join(' ');
    const cx = c.poly.reduce((a, p) => a + p[0], 0) / c.poly.length, cy = c.poly.reduce((a, p) => a + p[1], 0) / c.poly.length;
    let inner = `<polygon points="${pts}" class="sh-glass" style="--l:${(0.5 + Math.random() * 0.5).toFixed(2)}"/>`;
    // a target trapped in a few of the shards
    if (tiles.length && i % 4 === 1) {
      const id = `shc${i}`, size = Math.max(...c.poly.map((p) => Math.hypot(p[0] - cx, p[1] - cy))) * 1.6;
      defs.insertAdjacentHTML('beforeend', `<clipPath id="${id}"><polygon points="${pts}"/></clipPath>`);
      inner += `<image href="${tiles[(Math.random() * tiles.length) | 0]}" x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})" class="sh-img"/>`;
    }
    inner += `<polygon points="${pts}" class="sh-edge"/>`;
    g.innerHTML = inner;
    g.style.transformOrigin = `${cx}px ${cy}px`;
    svg!.append(g);
    const dx = cx - origin[0], dy = cy - origin[1], len = Math.hypot(dx, dy) || 1;
    return { g, c: [cx, cy] as Pt, d: [dx / len, dy / len] as Pt };
  });
  svg.append(cracks);
  const maxR = Math.max(...shards.map((s) => Math.hypot(s.c[0] - origin[0], s.c[1] - origin[1])));
  path.style.strokeDasharray = '1 0';
  cracks.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0.9 }], { duration: 260, fill: 'forwards' });
  const anims = shards.map((s) => {
    const k = Math.hypot(s.c[0] - origin[0], s.c[1] - origin[1]) / maxR;
    const rot = (Math.random() - 0.5) * 30;
    return s.g.animate([
      { opacity: 0, transform: `translate(${s.d[0] * -60}px, ${s.d[1] * -60}px) rotate(${rot}deg) scale(1.15)` },
      { opacity: 1, transform: 'none' },
    ], { duration: 240, delay: 60 + k * 140, easing: 'cubic-bezier(.6,0,.9,.4)', fill: 'both' });
  });
  await Promise.all(anims.map((a) => a.finished.catch(() => {})));
}

/** The shards burst outward to show the new screen. */
export function shatterReveal() {
  if (!svg || !shards.length) return;
  const own = svg, list = shards; shards = [];
  own.querySelector('.sh-cracks')?.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
  const anims = list.map((s, i) => {
    const dist = 120 + Math.random() * 260, rot = (Math.random() - 0.5) * 70;
    return s.g.animate([
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: `translate(${s.d[0] * dist}px, ${s.d[1] * dist + 40}px) rotate(${rot}deg) scale(0.86)` },
    ], { duration: 520 + Math.random() * 200, delay: (i % 5) * 18, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
  });
  Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => { if (!shards.length) { own.innerHTML = ''; own.classList.remove('on'); } });
}
