/**
 * DOOM-OS's heads-up layer (CLAUDE.md, "Design system v4"): a view arriving like a signal tearing in, the power
 * grid as a radar, callouts pinned to a scanned figure, tracking rings, the crosshair cursor and the columns of
 * Latverian glyphs at the edges. The glyphs are invented for the site (a stroke alphabet on a 3 by 4 grid), not
 * any real or Marvel script. Everything animates transform, opacity or clip-path only.
 */
const NS = 'http://www.w3.org/2000/svg';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A view tears in: horizontal slices jump into place over a third of a second, a burst of static over it. */
export function glitchIn(el: HTMLElement) {
  if (reduced()) return;
  const frames: Keyframe[] = [];
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * 80, b = a + 6 + Math.random() * 18;
    frames.push({ clipPath: `inset(${a}% 0 ${100 - b}% 0)`, transform: `translateX(${(Math.random() - 0.5) * 40}px)`, filter: 'hue-rotate(90deg) saturate(2)' });
  }
  frames.push({ clipPath: 'inset(0 0 0 0)', transform: 'none', filter: 'none' });
  el.animate(frames, { duration: 380, easing: 'steps(8, end)' });
  const st = document.querySelector<HTMLElement>('[data-static]');
  st?.animate([{ opacity: 0.55 }, { opacity: 0.2 }, { opacity: 0.4 }, { opacity: 0 }], { duration: 360, easing: 'steps(4, end)' });
}

/** Marvel's power grid as a hexagonal radar (each rating out of 7), drawing itself out from the centre. */
export function radar(host: HTMLElement, grid: Record<string, number>) {
  const keys = ['intelligence', 'strength', 'speed', 'durability', 'energyProjection', 'fightingSkills'];
  const names: Record<string, string> = { intelligence: 'INT', strength: 'STR', speed: 'SPD', durability: 'DUR', energyProjection: 'NRG', fightingSkills: 'FGT' };
  const R = 80, cx = 110, cy = 100;
  const pt = (i: number, r: number) => [cx + r * Math.sin((i / 6) * Math.PI * 2), cy - r * Math.cos((i / 6) * Math.PI * 2)];
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 220 200'); svg.classList.add('radar');
  let html = '';
  for (let ring = 1; ring <= 7; ring++) html += `<polygon points="${keys.map((_, i) => pt(i, (R * ring) / 7).join(',')).join(' ')}" class="rg${ring === 7 ? ' rg-out' : ''}"/>`;
  keys.forEach((k, i) => { const [x, y] = pt(i, R), [lx, ly] = pt(i, R + 14); html += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="ra"/><text x="${lx}" y="${ly}" class="rl">${names[k]} ${grid[k] ?? 0}</text>`; });
  const vals = keys.map((k, i) => pt(i, (R * Math.max(0.4, grid[k] ?? 0)) / 7).join(',')).join(' ');
  html += `<g class="rv"><polygon points="${vals}" class="rp"/>${keys.map((k, i) => { const [x, y] = pt(i, (R * Math.max(0.4, grid[k] ?? 0)) / 7); return `<circle cx="${x}" cy="${y}" r="2.6" class="rd"/>`; }).join('')}</g>`;
  svg.innerHTML = html;
  host.append(svg);
  const g = svg.querySelector<SVGGElement>('.rv')!;
  g.style.transformOrigin = `${cx}px ${cy}px`;
  if (!reduced()) g.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  svg.querySelector('.rg-out')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
}

/** Callouts pinned to points on a scanned figure: a dot, a line drawing itself out, a label typing in. */
export function callouts(layer: SVGSVGElement, items: { x: number; y: number; k: string; t: string }[], width: number) {
  layer.innerHTML = '';
  layer.setAttribute('viewBox', `0 0 ${layer.clientWidth || width} ${layer.clientHeight || 1}`);
  // labels in two lanes at the panel's edges, alternating sides, never closer than 46 px in a lane
  const lanes: Record<'l' | 'r', number[]> = { l: [], r: [] };
  // a phone has room for two
  if (width < 520) items = items.slice(0, 2);
  items.forEach((c, i) => {
    const side: 'l' | 'r' = i % 2 ? 'l' : 'r', right = side === 'r';
    let ly = c.y - 10;
    for (const y of lanes[side]) if (Math.abs(ly - y) < 46) ly = y + 46;
    lanes[side].push(ly);
    const lx = right ? width - 14 : 14, ex = right ? Math.max(c.x + 30, lx - 150) : Math.min(c.x - 30, lx + 150);
    const g = document.createElementNS(NS, 'g'); g.classList.add('co');
    const path = `M${c.x},${c.y} L${ex},${ly} L${lx},${ly}`;
    g.innerHTML = `<circle cx="${c.x}" cy="${c.y}" r="3.2" class="co-dot"/><circle cx="${c.x}" cy="${c.y}" r="9" class="co-ring"/><path d="${path}" class="co-line"/>` +
      `<text x="${lx}" y="${ly - 7}" text-anchor="${right ? 'end' : 'start'}" class="co-k">${c.k}</text><text x="${lx}" y="${ly + 15}" text-anchor="${right ? 'end' : 'start'}" class="co-t">${c.t}</text>`;
    layer.append(g);
    if (reduced()) return;
    const line = g.querySelector<SVGPathElement>('.co-line')!, len = line.getTotalLength();
    line.style.strokeDasharray = `${len}`;
    line.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 600, delay: 200 + i * 450, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    g.querySelectorAll('circle').forEach((ci) => ci.animate([{ opacity: 0, transform: 'scale(2)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 400, delay: i * 450, fill: 'backwards' }));
    g.querySelectorAll('text').forEach((tx) => tx.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 600 + i * 450, fill: 'backwards' }));
  });
}

/** Rings that orbit a target: dashed, ticked, turning at different speeds. */
export function rings(host: HTMLElement) {
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '-100 -100 200 200'); svg.classList.add('rings');
  let ticks = '';
  for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2, r1 = 92, r2 = i % 6 ? 95 : 99; ticks += `<line x1="${r1 * Math.sin(a)}" y1="${r1 * Math.cos(a)}" x2="${r2 * Math.sin(a)}" y2="${r2 * Math.cos(a)}"/>`; }
  svg.innerHTML = `<g class="r1">${ticks}</g><circle class="r2" r="84" /><circle class="r3" r="72" /><path class="r4" d="M0,-60 A60,60 0 0 1 52,30" />`;
  host.prepend(svg);
}

/** The crosshair cursor, with the pointer's coordinates, on fine pointers only. */
export function crosshair() {
  if (!matchMedia('(pointer: fine)').matches) return;
  const el = document.createElement('div'); el.className = 'xhair'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i class="xh-h"></i><i class="xh-v"></i><i class="xh-c"></i><span class="xh-t"></span>';
  document.body.append(el); document.documentElement.classList.add('has-xhair');
  const t = el.querySelector<HTMLElement>('.xh-t')!;
  addEventListener('pointermove', (e) => {
    el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    const over = (e.target as HTMLElement).closest('a, button');
    el.classList.toggle('on', !!over);
    t.textContent = over ? 'SELECT' : `X${String(e.clientX).padStart(4, '0')} Y${String(e.clientY).padStart(4, '0')}`;
  }, { passive: true });
}

/** A Latverian glyph: 3 to 5 strokes on a 3 by 4 grid, the same for the same seed. */
function glyph(g: CanvasRenderingContext2D, seed: number, x: number, y: number, s: number) {
  let h = seed * 9301 + 49297;
  const rnd = () => { h = (h * 9301 + 49297) % 233280; return h / 233280; };
  const n = 3 + Math.floor(rnd() * 3);
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const ax = Math.floor(rnd() * 3), ay = Math.floor(rnd() * 4), bx = Math.floor(rnd() * 3), by = Math.floor(rnd() * 4);
    g.moveTo(x + ax * s, y + ay * s); g.lineTo(x + bx * s, y + by * s);
  }
  g.stroke();
}

/** Columns of glyphs scrolling slowly down the left and right edges, drawn twelve times a second at most. */
export function glyphColumns() {
  if (reduced() || innerWidth < 900) return;
  for (const side of ['l', 'r']) {
    const c = document.createElement('canvas'); c.className = `glyphs glyphs-${side}`; c.width = 46; c.height = innerHeight; c.setAttribute('aria-hidden', 'true');
    document.body.append(c);
    const g = c.getContext('2d')!; g.strokeStyle = 'rgba(61,255,143,0.38)'; g.lineWidth = 1;
    let off = 0, last = 0, base = side === 'l' ? 1 : 977;
    const draw = (now: number) => {
      if (now - last > 83) {
        last = now; off += 1;
        g.clearRect(0, 0, c.width, c.height);
        for (let row = -1; row < c.height / 22 + 1; row++) {
          const y = row * 22 + (off % 22), idx = row - Math.floor(off / 22);
          if ((idx * 7 + base) % 5 === 0) continue;
          g.globalAlpha = 0.25 + 0.75 * ((Math.sin(idx * 1.7 + base) + 1) / 2);
          glyph(g, idx * 31 + base, 8, y, 4); glyph(g, idx * 17 + base + 3, 26, y, 4);
        }
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }
}
