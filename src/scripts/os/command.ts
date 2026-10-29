/**
 * DOOM-OS's command line: press / (or Ctrl+K, or the bar's button) and type. It knows every target by name, alias,
 * codename or actor, every module, and a few commands: `combat <a> <b>` opens the combat simulation on that pair,
 * `mute` and `unmute`, `help`. On phones the same panel is the menu. Arrow keys choose, Enter goes.
 */
import { navigate } from 'astro:transitions/client';
import { Sound } from '../sound/engine';
import { tick, decrypt } from '../sound/os';

type T = { slug: string; no: number; name: string; alias: string; team: string; actor: string; href: string; tile: string };
type M = { id: string; no: string; name: string; short: string; href: string; line: string };
type Item = { k: string; t: string; s: string; href?: string; run?: () => void; img?: string };

export function commandLine() {
  const root = document.querySelector<HTMLElement>('[data-cmd]');
  const raw = document.querySelector('[data-cmd-index]');
  if (!root || !raw || root.dataset.wired) return;
  root.dataset.wired = '1';
  const idx = JSON.parse(raw.textContent!) as { targets: T[]; modules: M[]; base: string };
  const input = root.querySelector<HTMLInputElement>('[data-cmd-input]')!;
  const list = root.querySelector<HTMLElement>('[data-cmd-list]')!;
  const help = root.querySelector<HTMLElement>('[data-cmd-help]')!;
  const sound = Sound.get();
  let items: Item[] = [], sel = 0, back: HTMLElement | null = null;

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, '');
  const findTarget = (q: string) => {
    const n = norm(q); if (!n) return null;
    return idx.targets.find((t) => [t.name, t.alias, t.slug].some((x) => norm(x) === n))
      ?? idx.targets.find((t) => [t.name, t.alias, t.actor, t.slug.replace(/-/g, ' ')].some((x) => norm(x).startsWith(n)))
      ?? idx.targets.find((t) => [t.name, t.alias, t.actor].some((x) => norm(x).includes(n))) ?? null;
  };
  const score = (q: string, ...fields: string[]) => {
    const n = norm(q); let best = 0;
    for (const f of fields) { const x = norm(f); if (x === n) best = Math.max(best, 100); else if (x.startsWith(n)) best = Math.max(best, 60); else if (x.split(' ').some((w) => w.startsWith(n))) best = Math.max(best, 40); else if (x.includes(n)) best = Math.max(best, 20); }
    return best;
  };

  const build = () => {
    const q = input.value.trim();
    const n = norm(q);
    const out: Item[] = [];
    // commands first
    const combat = n.match(/^(?:combat|versus|vs|fight|arena)\s+(.+)$/);
    if (combat) {
      const words = combat[1].split(/\s+(?:v|vs|and|versus)?\s*/).filter(Boolean);
      // try every split of the words into two names
      let pair: [T, T] | null = null;
      for (let i = 1; i < words.length && !pair; i++) { const a = findTarget(words.slice(0, i).join(' ')), b = findTarget(words.slice(i).join(' ')); if (a && b && a !== b) pair = [a, b]; }
      if (pair) out.push({ k: 'RUN', t: `Combat simulation: ${pair[0].name} vs ${pair[1].name}`, s: 'Module 03', href: `${idx.base}versus/?a=${pair[0].slug}&b=${pair[1].slug}` });
      else out.push({ k: 'RUN', t: 'Combat simulation', s: 'Name two targets: combat thor magneto', href: `${idx.base}versus/` });
    }
    if (/^(mute|sound off|silence)$/.test(n)) out.push({ k: 'RUN', t: 'Mute all sound', s: 'Remembered on this device', run: () => sound.setMuted(true) });
    if (/^(unmute|sound on|sound)$/.test(n)) out.push({ k: 'RUN', t: 'Sound on', s: 'Remembered on this device', run: () => { sound.unlock(); sound.setMuted(false); } });
    if (/^(help|\?)$/.test(n)) help.innerHTML = 'Type a name, codename or actor to open a target. <b>combat thor magneto</b> compares two. Module names open modules. <b>mute</b>, <b>unmute</b>.';
    // modules, then targets
    const mods = idx.modules.map((m) => ({ m, s: q ? score(q, m.name, m.short, m.id, m.line) : 1 })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    const tgs = idx.targets.map((t) => ({ t, s: q ? score(q, t.name, t.alias, t.actor, t.team) : 1 })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.t.no - b.t.no);
    const modItems = mods.map(({ m }) => ({ k: m.no === '--' ? 'DOC' : `M${m.no}`, t: m.name, s: m.line, href: m.href }));
    const tgItems = tgs.map(({ t }) => ({ k: `T-${String(t.no).padStart(2, '0')}`, t: t.name, s: `${t.alias !== t.name ? t.alias + ' · ' : ''}${t.team} · ${t.actor}`, href: t.href, img: t.tile }));
    // a target match beats a module match once a name is typed
    if (q && tgs[0] && (!mods[0] || tgs[0].s > mods[0].s)) out.push(...tgItems.slice(0, 8), ...modItems.slice(0, 3));
    else out.push(...modItems.slice(0, q ? 4 : 9), ...tgItems.slice(0, q ? 8 : 29));
    items = out; sel = 0; render();
  };

  const render = () => {
    list.innerHTML = '';
    items.forEach((it, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option'); li.id = `cmd-${i}`; li.setAttribute('aria-selected', String(i === sel));
      li.innerHTML = `${it.img ? `<img src="${it.img}" alt="" loading="lazy" />` : '<span class="ci"></span>'}<i>${it.k}</i><b></b><span></span>`;
      li.querySelector('b')!.textContent = it.t; li.querySelector('span:last-child')!.textContent = it.s;
      li.addEventListener('pointerenter', () => { sel = i; mark(); });
      li.addEventListener('click', () => go(i));
      list.append(li);
    });
    input.setAttribute('aria-activedescendant', items.length ? `cmd-${sel}` : '');
    if (!items.length) list.innerHTML = '<li class="none">No match on file.</li>';
  };
  const mark = () => {
    list.querySelectorAll('li').forEach((li, i) => li.setAttribute('aria-selected', String(i === sel)));
    input.setAttribute('aria-activedescendant', `cmd-${sel}`);
    list.children[sel]?.scrollIntoView({ block: 'nearest' });
  };
  const go = (i: number) => {
    const it = items[i]; if (!it) return;
    close();
    if (it.run) it.run();
    if (it.href) navigate(it.href);
  };

  const open = (prefill = '') => {
    if (!root.hidden) return;
    back = document.activeElement as HTMLElement | null;
    root.hidden = false; document.documentElement.classList.add('cmd-on');
    input.value = prefill; build(); input.focus();
    decrypt(sound);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) root.querySelector('.cmd-box')!.animate([{ opacity: 0, transform: 'translateY(-10px) scaleY(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
  };
  const close = () => { if (root.hidden) return; root.hidden = true; document.documentElement.classList.remove('cmd-on'); back?.focus?.(); };

  input.addEventListener('input', () => { tick(sound); build(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); const it = items[sel]; if (it && it.href && !it.run) { input.value = it.t; build(); } }
  });
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  // the bar's Menu button and the phone dock's All button
  document.querySelectorAll('[data-cmd-open]').forEach((b) => b.addEventListener('click', () => open()));
  addEventListener('keydown', (e) => {
    const typing = (e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable]');
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); open(); }
  });
  document.addEventListener('astro:before-swap', close);
  return { open, close };
}
