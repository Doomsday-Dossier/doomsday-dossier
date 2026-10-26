/**
 * Runs the forge on a page: the renderer (filmic tone mapping, bloom for the heat), the gate ("Enter the forge"
 * over one ember), the click that starts sound and picture on the same clock, skipping with any key, click or
 * tap, the mute button, and the countdown. Full length once; return visits get the two-second version.
 * `record` captures the canvas and the sound mix together, for the screen recordings sent to the user.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Forge, setPointScale } from './scene';
import { titleField } from './sdf';
import { SLOW, STRIKE, RETURN } from './timing';
import { Sound } from '../sound/engine';
import { playForge, clockTick } from '../sound/forge';
import { startScore } from '../sound/score';
import { timeLeft } from '../dossier/tokens';
import { pageEpoch, alive, onLeave } from '../page-scope';

const SEEN = 'dd-forge-seen';

/** What a page built on the forge (the home page) gets: the scene and camera to add to and take over each frame. */
export type ForgeKit = { forge: Forge; renderer: THREE.WebGLRenderer; sound: Sound; timing: typeof SLOW; phone: boolean; reduced: boolean };
export type ForgeExtension = { update(t: number, dt: number): void; resize?(w: number, h: number): void; /** true while nothing of the canvas is on screen */ idle?(): boolean };

export async function runForge(root: HTMLElement, opts: {
  version: 'a' | 'b'; record?: boolean; first?: boolean;
  /** record only the sound mix (the page's own video is captured by the browser), for pages with real text */
  recordAudio?: boolean;
  /** builds on the forge: called once, then its update runs after the forge's every frame */
  extend?: (kit: ForgeKit) => Promise<ForgeExtension> | ForgeExtension;
  /** called once the title has settled (or straight away for reduced motion) */
  onSettled?: () => void;
}) {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const gate = root.querySelector<HTMLButtonElement>('[data-gate]')!;
  const muteBtn = root.querySelector<HTMLButtonElement>('[data-mute]'); // the site's pages use the header's switch
  const phone = matchMedia('(pointer: coarse)').matches || innerWidth < 768;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seen = (() => { try { return localStorage.getItem(SEEN) === '1'; } catch { return false; } })();
  const timing = seen && !opts.record && !opts.first ? RETURN : opts.version === 'b' ? STRIKE : SLOW;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !phone, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.record });
  renderer.setPixelRatio(opts.record ? 1 : Math.min(devicePixelRatio || 1, phone ? 1.25 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const field = await titleField();
  const forge = new Forge(field, timing, phone);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(forge.scene, forge.cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.55, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  forge.prepare(renderer);
  const sound = Sound.get();
  const ext = opts.extend ? await opts.extend({ forge, renderer, sound, timing, phone, reduced }) : null;

  // the gate's words, drawn into the scene so they are part of the picture (and of a recording)
  const ui = new THREE.Scene(), uiCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const label = document.createElement('canvas'); label.width = 1024; label.height = 128;
  const lg = label.getContext('2d')!;
  await document.fonts.load("400 40px 'Courier Prime'").catch(() => {});
  lg.fillStyle = 'rgba(231,228,220,1)'; lg.font = "400 40px 'Courier Prime', monospace"; lg.textAlign = 'center'; lg.textBaseline = 'middle';
  lg.fillText('E N T E R   T H E   F O R G E', 512, 64);
  const labelTex = new THREE.CanvasTexture(label); labelTex.colorSpace = THREE.SRGBColorSpace;
  const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, toneMapped: false, opacity: 0 });
  const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), labelMat);
  ui.add(labelMesh);

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    forge.resize(w, h);
    ext?.resize?.(w, h);
    setPointScale(forge, renderer.domElement.height / (2 * Math.tan((forge.cam.fov * Math.PI) / 360)));
    // the label is about 620 px wide (less on narrow screens), centred a little below the middle
    const px = Math.min(780, w * 0.9);
    labelMesh.scale.set((2 * px) / w, (2 * px * (128 / 1024)) / h, 1);
    labelMesh.position.set(0, -0.3, 0);
  };
  resize(); addEventListener('resize', resize);

  // the countdown, the same maths as everywhere else
  const tick = () => { const t = timeLeft(); forge.setCountdown([String(t.d).padStart(2, '0'), String(t.h).padStart(2, '0'), String(t.m).padStart(2, '0'), String(t.s).padStart(2, '0')]); };
  tick(); setInterval(tick, 1000);

  if (muteBtn) {
    const setMuteUi = (m: boolean) => { muteBtn.setAttribute('aria-pressed', String(m)); muteBtn.querySelector('span')!.textContent = m ? 'Sound off' : 'Sound on'; };
    setMuteUi(sound.muted);
    muteBtn.addEventListener('click', (e) => { e.stopPropagation(); sound.unlock(); sound.setMuted(!sound.muted); });
    sound.onMute(setMuteUi);
  }

  // recording: the canvas and the sound mix, captured together
  let recorder: MediaRecorder | null = null; const chunks: Blob[] = [];
  if (opts.record) {
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...sound.record().getAudioTracks()]);
    const type = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m))!;
    recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 9_000_000, audioBitsPerSecond: 192_000 });
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.start(250);
    (window as any).__stopRec = () => new Promise<string>((res) => {
      recorder!.onstop = async () => { const b = new Blob(chunks, { type }); const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); };
      recorder!.stop();
    });
  }

  // sound only: the page's own video is captured by the browser and joined to this afterwards
  if (opts.recordAudio) {
    const type = ['audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m))!;
    const rec = new MediaRecorder(new MediaStream(sound.record().getAudioTracks()), { mimeType: type, audioBitsPerSecond: 192_000 });
    const parts: Blob[] = []; rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    const startedAtMs = performance.now();
    rec.start(250);
    (window as any).__stopAudio = () => new Promise<{ data: string; at: number }>((res) => {
      rec.onstop = () => { const r = new FileReader(); r.onload = () => res({ data: String(r.result), at: startedAtMs }); r.readAsDataURL(new Blob(parts, { type })); };
      rec.stop();
    });
  }

  // started is separate from startAt: skipping early in a page's life puts startAt before zero
  let settled = false;
  let started = false, startAt = 0, last = performance.now(), forgeSound: { stop(): void } | null = null, scoreStarted = false;
  const startScoreOnce = (fade: number) => { if (!scoreStarted) { scoreStarted = true; startScore(sound, fade); } };
  const begin = async () => {
    if (started) return;
    // the picture starts the instant the click lands; the sound joins it on the same clock once the browser
    // has started audio (which can take a moment), scheduled as if it had started with the click
    const clicked = performance.now();
    startAt = clicked; started = true;
    gate.hidden = true;
    await sound.unlock();
    forgeSound = playForge(sound, timing, sound.ctx.currentTime + 0.01 - (performance.now() - clicked) / 1000);
    setTimeout(() => startScoreOnce(5), Math.max(0, timing.total - 1.2) * 1000);
    try { localStorage.setItem(SEEN, '1'); } catch { /* private mode */ }
    // from now on any key, click or tap skips to the finished title
    setTimeout(() => {
      const skip = (e: Event) => {
        if ((e.target as Element | null)?.closest?.('a, button:not([data-gate])')) return; // the sound switch is not a skip
        const t = (performance.now() - startAt) / 1000;
        if (t >= timing.total - 0.3) return;
        startAt = performance.now() - timing.total * 1000;
        forgeSound?.stop();
        clockTick(sound, sound.ctx.currentTime + 0.05);
        startScoreOnce(3);
      };
      addEventListener('keydown', skip); addEventListener('pointerdown', skip);
    }, 400);
  };
  gate.addEventListener('click', begin);
  // arriving from another page with sound already playing: no gate is needed, the forge just plays
  if (sound.ctx.state === 'running' && !opts.record && !reduced) setTimeout(begin, 120);
  (window as any).__forgeBegin = begin;
  // for frame-by-frame review: jump the clock to t seconds after the click
  (window as any).__forgeSeek = (t: number) => { started = true; startAt = performance.now() - t * 1000; };

  if (reduced) { started = true; startAt = performance.now() - (timing.total + 20) * 1000; gate.hidden = true; }

  // the loop belongs to this page: it stops when the page is left, and the GPU memory goes with it
  const epoch = pageEpoch();
  onLeave(() => { forgeSound?.stop(); composer.dispose(); renderer.dispose(); renderer.forceContextLoss(); });
  const loop = (now: number) => {
    if (!alive(epoch)) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = started ? (now - startAt) / 1000 : -1;
    forge.update(t, dt);
    if (!settled && (t >= timing.total || reduced)) { settled = true; opts.onSettled?.(); }
    ext?.update(t, dt);
    if (ext?.idle?.()) { requestAnimationFrame(loop); return; }
    labelMat.opacity = t < 0 ? 0.55 + 0.25 * Math.sin(now * 0.002) : Math.max(0, 0.8 - t * 2);
    renderer.autoClear = true;
    composer.render();
    renderer.autoClear = false;
    if (labelMat.opacity > 0.01) renderer.render(ui, uiCam);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  (window as any).__forgeReady = true;
  (window as any).__forgeDebug = () => ({ startAt, now: performance.now(), t: forge.t, u: Object.fromEntries(Object.entries((forge as any).uniforms).filter(([, v]: any) => typeof v.value === 'number').map(([k, v]: any) => [k, v.value])) });
}
