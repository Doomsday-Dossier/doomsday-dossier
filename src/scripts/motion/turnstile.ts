/**
 * Cloudflare Turnstile, loaded only when someone first votes or predicts.
 * `humanToken` renders the widget into `box` (it stays invisible unless Cloudflare wants a
 * tick) and resolves with a one-time token for the arena worker to verify.
 */
declare global { interface Window { turnstile?: any } }

let load: Promise<void> | null = null;
const loadTurnstile = () => load ??= new Promise<void>((res, rej) => {
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  s.async = true; s.onload = () => res(); s.onerror = () => { load = null; rej(new Error('turnstile')); };
  document.head.append(s);
});

const widgets = new WeakMap<HTMLElement, string>();

export async function humanToken(box: HTMLElement, sitekey: string, action: string) {
  await loadTurnstile();
  return new Promise<string>((res, rej) => {
    const ts = window.turnstile;
    const old = widgets.get(box);
    if (old) ts.remove(old);
    widgets.set(box, ts.render(box, {
      sitekey, appearance: 'interaction-only', execution: 'render', action,
      callback: (t: string) => res(t), 'error-callback': () => rej(new Error('bot check')), 'timeout-callback': () => rej(new Error('bot check')),
    }));
  });
}

export function dropWidget(box: HTMLElement) {
  const id = widgets.get(box);
  if (id) window.turnstile?.remove(id);
  widgets.delete(box);
}
