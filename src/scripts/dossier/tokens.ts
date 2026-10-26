/** Design system v2 tokens for GSAP and WebGL. Mirrors src/styles/system.css and CLAUDE.md. */
export const C = {
  gunmetal: '#0d1012', gunmetal2: '#14181b', iron: '#23292d', iron2: '#3a4247', ironAged: '#5c5f58',
  ash: '#8d918c', bone: '#e7e4dc', emerald: '#1fd47a', emeraldHot: '#5dffa8', emeraldDeep: '#0b5e37', redact: '#050607',
} as const;

export const EASE = { file: 'power4.inOut', reveal: 'expo.out', stampIn: 'power4.in', stampSettle: 'back.out(3)', glow: 'sine.inOut', scrub: 'none' } as const;
export const DUR = { xs: 0.15, s: 0.3, m: 0.6, l: 1.0, xl: 1.6 } as const;
export const STAGGER = { letters: 0.04, lines: 0.08 } as const;

export const RELEASE = '2026-12-18';
export const INTRO_KEY = 'dd-intro-seen';

export const BUDGET = { particlesDesktop: 60000, particlesPhone: 18000, dprDesktop: 1.5, dprPhone: 1.25 } as const;

/** Hex to linear-ish 0..1 RGB for shaders. */
export const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isPhone = () => matchMedia('(pointer: coarse)').matches || innerWidth < 768;

/** Whole days to release, rounded down; the same maths as every other countdown on the site. */
export function timeLeft(iso = RELEASE) {
  const [y, m, d] = iso.split('-').map(Number);
  const ms = Math.max(0, new Date(y, m - 1, d).getTime() - Date.now());
  return { ms, d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60, s: Math.floor(ms / 1e3) % 60 };
}

