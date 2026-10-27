/**
 * DOOM-OS's photo scanner (CLAUDE.md, "Design system v4"): a target's real photo, swept in by Doom's sensors. Its
 * depth map (Depth Anything V2, made locally) draws a glowing topographic mesh of the actual face and body, contour
 * lines and raised scan rows; a bright scan line travels down and leaves the photo behind it in phosphor green,
 * which then settles into full colour under a faint mesh. The pointer tilts it a little by its depth. One quad, one
 * shader: cheap on a phone.
 */
import * as THREE from 'three';

const FRAG = /* glsl */ `
  uniform sampler2D uPhoto, uDepth; uniform vec2 uRes, uImg; uniform float uScan, uColor, uTime, uMesh, uGain; uniform vec2 uMouse; uniform vec4 uFit;
  varying vec2 vUv;
  void main() {
    // the photo fitted inside the canvas (uFit: offset and size in canvas units)
    vec2 uv = (vUv - uFit.xy) / uFit.zw;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0); return; }
    float d = texture2D(uDepth, uv).r;
    vec2 puv = uv + uMouse * (d - 0.5) * 0.012;
    vec4 ph = texture2D(uPhoto, puv);
    // dark film stills are lifted (a soft exposure curve), so the scan reads on a dark screen
    ph.rgb = 1.0 - exp(-ph.rgb * uGain);
    float a = smoothstep(0.35, 0.6, ph.a);
    if (a < 0.01) { gl_FragColor = vec4(0.0); return; }
    // the mesh: contour lines of depth, and rows lifted by depth, both anti-aliased by their own derivatives
    float k = d * 34.0 + uTime * 0.04;
    float c = 1.0 - clamp(min(fract(k), 1.0 - fract(k)) / (fwidth(k) * 1.2), 0.0, 1.0);
    float r = (uv.y + d * 0.035) * 110.0;
    float row = 1.0 - clamp(min(fract(r), 1.0 - fract(r)) / (fwidth(r) * 1.1), 0.0, 1.0);
    float mesh = max(c, row * 0.55);
    vec3 green = vec3(0.24, 1.0, 0.56);
    // the scan line, top to bottom: behind it the photo, ahead of it only the mesh
    float y = 1.0 - uv.y, s = uScan;
    float behind = smoothstep(s + 0.004, s - 0.004, y);
    float band = exp(-abs(y - s) * 90.0) * step(0.001, s) * step(s, 1.0);
    float lum = dot(ph.rgb, vec3(0.3, 0.59, 0.11));
    vec3 mono = green * (0.1 + lum * 1.35);
    vec3 photo = mix(mono, ph.rgb * 1.05, uColor) + green * mesh * uMesh * 0.22;
    vec3 col = mix(green * mesh * 0.85 * (0.4 + d * 0.8), photo, behind) + green * band * 1.6;
    // fine scan rows of the display itself
    col *= 0.88 + 0.12 * step(0.5, fract(gl_FragCoord.y / 3.0));
    gl_FragColor = vec4(col, a * max(behind, mesh * 0.95 + band));
  }`;

export type Scanner = { scan(seconds?: number): Promise<void>; colour(to: number, seconds?: number): void; head(): { x: number; y: number }; at(u: number, v: number): { x: number; y: number }; dispose(): void; el: HTMLCanvasElement };

export async function createScanner(canvas: HTMLCanvasElement, photo: string, depth: string, headUV: [number, number] = [0.5, 0.2], gain = 2.4): Promise<Scanner> {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0, 0);
  const loader = new THREE.TextureLoader();
  const [tp, td] = await Promise.all([loader.loadAsync(photo), loader.loadAsync(depth)]);
  tp.colorSpace = THREE.SRGBColorSpace;
  const u = {
    uPhoto: { value: tp }, uDepth: { value: td }, uRes: { value: new THREE.Vector2() }, uImg: { value: new THREE.Vector2(tp.image.width, tp.image.height) },
    uScan: { value: 0 }, uColor: { value: 0 }, uTime: { value: 0 }, uMesh: { value: 1 }, uGain: { value: gain }, uMouse: { value: new THREE.Vector2() }, uFit: { value: new THREE.Vector4(0, 0, 1, 1) },
  };
  const mat = new THREE.ShaderMaterial({ uniforms: u, transparent: true, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FRAG });
  const scene = new THREE.Scene(), cam = new THREE.Camera();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); u.uRes.value.set(w, h);
    // contain: the whole photo inside the canvas, centred
    const ia = tp.image.width / tp.image.height, ca = w / h;
    const sw = ia > ca ? 1 : ia / ca, sh = ia > ca ? ca / ia : 1;
    u.uFit.value.set((1 - sw) / 2, (1 - sh) / 2, sw, sh);
  };
  const ro = new ResizeObserver(fit); ro.observe(canvas); fit();
  const onMove = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); u.uMouse.value.set((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5); };
  addEventListener('pointermove', onMove, { passive: true });
  let alive = true; const t0 = performance.now();
  const loop = () => { if (!alive) return; u.uTime.value = (performance.now() - t0) / 1000; renderer.render(scene, cam); requestAnimationFrame(loop); };
  loop();
  const at = (pu: number, pv: number) => { const f = u.uFit.value, w = canvas.clientWidth, h = canvas.clientHeight; return { x: (f.x + pu * f.z) * w, y: (1 - (f.y + (1 - pv) * f.w)) * h }; };
  const tween = (key: 'uScan' | 'uColor', to: number, secs: number) => new Promise<void>((res) => {
    const from = u[key].value, s = performance.now();
    const step = () => { const k = Math.min(1, (performance.now() - s) / (secs * 1000)); u[key].value = from + (to - from) * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2); if (k < 1 && alive) requestAnimationFrame(step); else res(); };
    step();
  });
  return {
    el: canvas,
    scan: (secs = 2.2) => tween('uScan', 1.02, secs),
    colour: (to, secs = 1.6) => { tween('uColor', to, secs); },
    // where the face is on the canvas, in pixels, for the reticle
    head: () => at(headUV[0], headUV[1]),
    // any point of the photo (u from the left, v from the top) on the canvas, in pixels
    at,
    dispose: () => { alive = false; ro.disconnect(); removeEventListener('pointermove', onMove); renderer.dispose(); tp.dispose(); td.dispose(); mat.dispose(); },
  };
}
