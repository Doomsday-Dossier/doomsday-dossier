/**
 * DOOM-OS's photo scanner (CLAUDE.md, "Design system v4"): a target's real photo, swept in by Doom's sensors. Its
 * depth map (Depth Anything V2, made locally) draws a glowing topographic mesh of the actual face and body, contour
 * lines and raised scan rows; a bright scan line travels down and leaves the photo behind it in phosphor green,
 * which then settles into full colour under a faint mesh. The pointer tilts it a little by its depth.
 *
 * One quad, one shader, raw WebGL (no three.js: a page with two scanners costs two small contexts and about 4 kB of
 * code). It draws every frame only while something moves (the scan, the colour, the pointer); at rest it redraws
 * ten times a second for the drifting contours, and not at all off screen or in a hidden tab. `dispose()` loses the
 * context at once, so leaving a page frees the GPU memory straight away.
 */
// WebGL2 runs the shaders as GLSL ES 3.00 (fwidth is built in); WebGL1 as 1.00 with the derivatives extension
const V2 = `#version 300 es
#define attribute in
#define varying out
`, F2 = `#version 300 es
precision mediump float;
out vec4 fragOut;
#define gl_FragColor fragOut
#define texture2D texture
#define varying in
`;
const F1 = `#extension GL_OES_standard_derivatives : enable
precision mediump float;
`;
const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
  uniform sampler2D uPhoto, uDepth; uniform float uScan, uColor, uTime, uMesh, uGain; uniform vec2 uMouse; uniform vec4 uFit;
  varying vec2 vUv;
  void main() {
    // the photo fitted inside the canvas (uFit: offset and size in canvas units); textures are stored top row first
    vec2 uv = (vUv - uFit.xy) / uFit.zw;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0); return; }
    vec2 tuv = vec2(uv.x, 1.0 - uv.y);
    float d = texture2D(uDepth, tuv).r;
    vec4 ph = texture2D(uPhoto, tuv + uMouse * (d - 0.5) * 0.012);
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
    float al = a * max(behind, mesh * 0.95 + band);
    gl_FragColor = vec4(col * al, al);
  }`;

export type Scanner = {
  scan(seconds?: number): Promise<void>; colour(to: number, seconds?: number): Promise<void>; mesh(to: number, seconds?: number): Promise<void>;
  head(): { x: number; y: number }; at(u: number, v: number): { x: number; y: number }; dispose(): void; el: HTMLCanvasElement; ready: boolean;
};

const loadImage = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
  const i = new Image(); i.crossOrigin = 'anonymous'; i.decoding = 'async';
  i.onload = () => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(() => res(i)); i.onerror = rej; i.src = src;
});

/** True when the browser can draw the scanner at all; pages fall back to the plain photo otherwise. */
export const canScan = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };

/**
 * `frame`, the figure's outline in the photo (x0, y0, x1, y1 from the top left), frames the figure rather than the whole
 * photo: it fills the height of the canvas, and a wide cape or arm may run past the sides by up to a fifth.
 */
export async function createScanner(canvas: HTMLCanvasElement, photo: string, depth: string, headUV: [number, number] = [0.5, 0.2], gain = 2.4, frame?: [number, number, number, number]): Promise<Scanner> {
  const [ip, id] = await Promise.all([loadImage(photo), loadImage(depth)]);
  const opts = { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' as const };
  const gl2 = canvas.getContext('webgl2', opts) as WebGL2RenderingContext | null;
  const gl = (gl2 || canvas.getContext('webgl', opts)) as WebGLRenderingContext;
  if (!gl) throw new Error('no webgl');
  if (!gl2) gl.getExtension('OES_standard_derivatives');
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader'); return s; };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, (gl2 ? V2 : '') + VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, (gl2 ? F2 : F1) + FRAG)); gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = (img: HTMLImageElement, unit: number) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  };
  tex(ip, 0); tex(id, 1);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  gl.uniform1i(U('uPhoto'), 0); gl.uniform1i(U('uDepth'), 1); gl.uniform1f(U('uGain'), gain);
  const uScan = U('uScan'), uColor = U('uColor'), uTime = U('uTime'), uMesh = U('uMesh'), uMouse = U('uMouse'), uFit = U('uFit');
  const v = { scan: 0, color: 0, mesh: 1, mx: 0, my: 0, tx: 0, ty: 0 };
  const fit = [0, 0, 1, 1];
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, innerWidth < 768 ? 1.25 : 1.5);
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); gl.viewport(0, 0, canvas.width, canvas.height);
    const iw = ip.naturalWidth, ih = ip.naturalHeight;
    if (frame) {
      // the figure, framed: its outline fills the height, the sides may be cropped a little, centred on the figure
      const [x0, y0, x1, y1] = frame, rw = Math.max(0.05, x1 - x0) * iw, rh = Math.max(0.05, y1 - y0) * ih;
      const s = Math.min((w / rw) * 1.22, h / rh) * 0.94;
      const pw = iw * s, ph = ih * s, ox = w / 2 - ((x0 + x1) / 2) * pw, oy = h / 2 - ((y0 + y1) / 2) * ph;
      fit.splice(0, 4, ox / w, 1 - (oy + ph) / h, pw / w, ph / h);
    } else {
      // contain: the whole photo inside the canvas, centred
      const ia = iw / ih, ca = w / h;
      const sw = ia > ca ? 1 : ia / ca, shh = ia > ca ? ca / ia : 1;
      fit.splice(0, 4, (1 - sw) / 2, (1 - shh) / 2, sw, shh);
    }
    dirty = true;
  };
  let alive = true, dirty = true, visible = true, busy = 0, last = 0;
  const t0 = performance.now();
  const draw = (now: number) => {
    v.mx += (v.tx - v.mx) * 0.08; v.my += (v.ty - v.my) * 0.08;
    gl.uniform1f(uScan, v.scan); gl.uniform1f(uColor, v.color); gl.uniform1f(uMesh, v.mesh); gl.uniform1f(uTime, (now - t0) / 1000);
    gl.uniform2f(uMouse, v.mx, v.my); gl.uniform4f(uFit, fit[0], fit[1], fit[2], fit[3]);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const loop = (now: number) => {
    if (!alive) return;
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    const moving = busy > 0 || dirty || Math.abs(v.tx - v.mx) + Math.abs(v.ty - v.my) > 0.002;
    // at rest the contours still drift: ten frames a second is plenty for that
    if (!moving && now - last < 100) return;
    last = now; dirty = false; draw(now);
  };
  requestAnimationFrame(loop);
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(canvas);
  const fine = matchMedia('(pointer: fine)').matches;
  const onMove = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); v.tx = (e.clientX - r.left) / r.width - 0.5; v.ty = (e.clientY - r.top) / r.height - 0.5; };
  if (fine) addEventListener('pointermove', onMove, { passive: true });

  const at = (pu: number, pv: number) => { const w = canvas.clientWidth, h = canvas.clientHeight; return { x: (fit[0] + pu * fit[2]) * w, y: (1 - (fit[1] + (1 - pv) * fit[3])) * h }; };
  const tween = (key: 'scan' | 'color' | 'mesh', to: number, secs: number) => new Promise<void>((res) => {
    if (secs <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) { v[key] = to; dirty = true; res(); return; }
    const from = v[key], s = performance.now(); busy++;
    const step = () => {
      const k = Math.min(1, (performance.now() - s) / (secs * 1000));
      v[key] = from + (to - from) * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
      if (k < 1 && alive) requestAnimationFrame(step); else { busy--; dirty = true; res(); }
    };
    step();
  });
  const self: Scanner = {
    el: canvas, ready: true,
    scan: (secs = 2.2) => tween('scan', 1.02, secs),
    colour: (to, secs = 1.6) => tween('color', to, secs),
    mesh: (to, secs = 1) => tween('mesh', to, secs),
    // where the face is on the canvas, in pixels, for the reticle
    head: () => at(headUV[0], headUV[1]),
    // any point of the photo (u from the left, v from the top) on the canvas, in pixels
    at,
    dispose: () => {
      if (!alive) return;
      alive = false; ro.disconnect(); io.disconnect(); removeEventListener('pointermove', onMove);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
  return self;
}
