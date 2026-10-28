/**
 * Hover previews (fine pointers only): pointing at any link to a target's file, anywhere in DOOM-OS (the timeline's
 * faces, the associates, the combat roster, the chamber, the command line's results), brings up a small scan card
 * beside the pointer: the target's photo with a scan line passing, their number, name, codename and continent, the
 * threat from Marvel's power grid and their first appearance. Links that already show the target large (the register's
 * cards, the next-file link, Battleworld) are left alone.
 */
type T = { slug: string; no: number; name: string; alias: string; team: string; href: string; tile: string; accent: string; threat: number | null; first: string };

export function previews(index: T[], host: HTMLElement) {
  if (!matchMedia('(pointer: fine)').matches) return;
  const bySlug = new Map(index.map((t) => [t.slug, t]));
  const card = document.createElement('div');
  card.className = 'pv'; card.setAttribute('aria-hidden', 'true'); card.hidden = true;
  card.innerHTML = '<div class="pv-img"><img alt="" /><i></i></div><div class="pv-txt"><p class="pv-no"></p><b class="pv-name"></b><p class="pv-alias"></p><p class="pv-threat"><span class="pv-bar"><i></i></span><em></em></p><p class="pv-first"></p></div>';
  host.append(card);
  const $ = (s: string) => card.querySelector<HTMLElement>(s)!;
  let over: Element | null = null, timer = 0;
  const slugOf = (a: HTMLAnchorElement) => { const m = new URL(a.href, location.href).pathname.match(/\/c\/([^/]+)\/?$/); return m ? m[1] : null; };
  const place = (x: number, y: number) => {
    const w = 300, h = card.offsetHeight || 130;
    const left = x + 22 + w > innerWidth - 8 ? x - w - 22 : x + 22, top = Math.min(innerHeight - h - 8, Math.max(56, y - h / 2));
    card.style.transform = `translate(${left}px, ${top}px)`;
  };
  const show = (t: T, x: number, y: number) => {
    $('.pv-img img').setAttribute('src', t.tile);
    $('.pv-no').textContent = `T-${String(t.no).padStart(2, '0')} // ${t.team}`;
    $('.pv-name').textContent = t.name;
    $('.pv-alias').textContent = t.alias !== t.name ? t.alias : 'Target on file';
    const k = t.threat !== null ? t.threat / 42 : 0;
    ($('.pv-bar i') as HTMLElement).style.width = `${Math.round(k * 100)}%`;
    $('.pv-threat em').textContent = t.threat !== null ? `Threat ${t.threat}/42` : 'No power grid';
    card.dataset.level = t.threat === null ? '' : t.threat >= 30 ? 'x' : t.threat >= 22 ? 'h' : 'e';
    $('.pv-first').textContent = `First seen ${t.first}`;
    card.style.setProperty('--acc', t.accent);
    card.hidden = false; place(x, y);
    card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
  };
  const hide = () => { clearTimeout(timer); over = null; card.hidden = true; };
  document.addEventListener('pointerover', (e) => {
    const a = (e.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a === over) return;
    if (a.closest('.card, .nextf, .bar, .dock, .bw-stage, .cmd, .f-top')) return;
    const slug = slugOf(a), t = slug ? bySlug.get(slug) : null;
    if (!t) { if (over) hide(); return; }
    over = a; clearTimeout(timer);
    const { clientX: x, clientY: y } = e;
    timer = window.setTimeout(() => { if (over === a) show(t, x, y); }, 220);
  });
  document.addEventListener('pointerout', (e) => { if (over && !(over as Element).contains(e.relatedTarget as Node)) hide(); });
  addEventListener('pointermove', (e) => { if (!card.hidden) place(e.clientX, e.clientY); }, { passive: true });
  addEventListener('scroll', hide, { passive: true });
  document.addEventListener('astro:before-swap', hide);
}
