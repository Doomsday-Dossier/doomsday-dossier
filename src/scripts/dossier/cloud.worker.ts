// Builds roll-call point clouds off the page's main thread (see cloud.ts).
import { sample, type Cloud } from './cloud';

self.onmessage = async (e: MessageEvent<{ id: number; c: Cloud; n: number }>) => {
  const { id, c, n } = e.data;
  try {
    const { pos, col } = await sample(c, n);
    (self as unknown as Worker).postMessage({ id, pos, col }, [pos.buffer, col.buffer]);
  } catch {
    (self as unknown as Worker).postMessage({ id, error: true });
  }
};
