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
};

export async function loadScene(id: string): Promise<HeroScene | null> {
  const l = loaders[id];
  if (!l) return null;
  const mod = await l();
  return new mod.default();
}
