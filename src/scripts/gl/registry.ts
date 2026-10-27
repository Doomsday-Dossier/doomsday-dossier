import type { HeroScene } from './engine';

// Each scene is its own chunk, so a page downloads only the shader it shows.
const loaders: Record<string, () => Promise<{ default: new () => HeroScene }>> = {
  void: () => import('./scenes/void'),
  forge: () => import('./scenes/forge'),
  ice: () => import('./scenes/ice'),
  storm: () => import('./scenes/storm'),
  slipstream: () => import('./scenes/slipstream'),
  cryo: () => import('./scenes/cryo'),
  quantum: () => import('./scenes/quantum'),
  ink: () => import('./scenes/ink'),
  radar: () => import('./scenes/radar'),
  elastic: () => import('./scenes/elastic'),
  ripple: () => import('./scenes/ripple'),
  flame: () => import('./scenes/flame'),
  rock: () => import('./scenes/rock'),
  cerebro: () => import('./scenes/cerebro'),
  magnet: () => import('./scenes/magnet'),
  optic: () => import('./scenes/optic'),
  bamf: () => import('./scenes/bamf'),
  reaction: () => import('./scenes/reaction'),
  fur: () => import('./scenes/fur'),
  cards: () => import('./scenes/cards'),
  shafts: () => import('./scenes/shafts'),
  bokeh: () => import('./scenes/bokeh'),
  tags: () => import('./scenes/tags'),
  phase: () => import('./scenes/phase'),
  sunvoid: () => import('./scenes/void2'),
  pins: () => import('./scenes/pins'),
  ridges: () => import('./scenes/ridges'),
  talokan: () => import('./scenes/talokan'),
  timelines: () => import('./scenes/timelines'),
  dance: () => import('./scenes/dance'),
};

/** Downloads a scene's code ahead of time (the next file's), without building it. */
export function preloadScene(id: string) {
  loaders[id]?.().catch(() => {});
}

export async function loadScene(id: string): Promise<HeroScene | null> {
  const l = loaders[id];
  if (!l) return null;
  const mod = await l();
  return new mod.default();
}
