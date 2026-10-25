import * as THREE from 'three';
import { FULLSCREEN_VERT } from './glsl';

export type Ctx = {
  renderer: THREE.WebGLRenderer;
  width: number; height: number;   // CSS px
  bufW: number; bufH: number;      // drawing buffer px
  pointer: { x: number; y: number; vx: number; vy: number; active: boolean; down: boolean };
  scroll: number;
  intro: number;
  quality: number;                 // 0.5..1, lowered by the governor
  mobile: boolean;
  reduced: boolean;
  time: number;
  signal: number;                  // scene-to-DOM channel, e.g. lightning strength
};

export interface HeroScene {
  mount(ctx: Ctx): void;
  update(ctx: Ctx, dt: number): void;
  resize?(ctx: Ctx): void;
  setQuality?(ctx: Ctx): void;
  dispose(): void;
}

/** Fullscreen shader helper: a quad in clip space with shared uniforms wired up. */
export function fullscreen(frag: string, uniforms: Record<string, THREE.IUniform> = {}, opts: Partial<THREE.ShaderMaterialParameters> = {}) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: frag,
    uniforms: {
      uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uMouseVel: { value: new THREE.Vector2() }, uScroll: { value: 0 }, uIntro: { value: 0 }, uQuality: { value: 1 },
      ...uniforms,
    },
    depthTest: false, depthWrite: false, ...opts,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  return { mesh, mat };
}

export function syncCommon(mat: THREE.ShaderMaterial, ctx: Ctx) {
  const u = mat.uniforms;
  u.uTime.value = ctx.time;
  u.uRes.value.set(ctx.bufW, ctx.bufH);
  u.uMouse.value.set(ctx.pointer.x, ctx.pointer.y);
  u.uMouseVel.value.set(ctx.pointer.vx, ctx.pointer.vy);
  u.uScroll.value = ctx.scroll;
  u.uIntro.value = ctx.intro;
  u.uQuality.value = ctx.quality;
}

/**
 * Ping-pong "trail" buffer: a small float texture where the pointer paints and
 * the paint decays. Used for heat (Doom), thaw (Steve), glitch (Bucky), stirring (Shang-Chi).
 */
export class Trail {
  a: THREE.WebGLRenderTarget; b: THREE.WebGLRenderTarget;
  scene = new THREE.Scene(); cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mat: THREE.ShaderMaterial;
  constructor(renderer: THREE.WebGLRenderer, size: number, public decay = 0.96, public radius = 0.08, frag?: string) {
    const half = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const opt = { type: half, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false } as const;
    this.a = new THREE.WebGLRenderTarget(size, size, opt);
    this.b = new THREE.WebGLRenderTarget(size, size, opt);
    const q = fullscreen(frag || /* glsl */ `
      uniform sampler2D uPrev; uniform vec2 uP; uniform vec2 uPPrev; uniform float uDecay; uniform float uRad; uniform float uOn; uniform float uAspect;
      varying vec2 vUv;
      float seg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-5),0.,1.); return length(pa-ba*h); }
      void main(){
        vec4 prev = texture2D(uPrev, vUv);
        vec2 asp = vec2(uAspect,1.0);
        float d = seg(vUv*asp, uPPrev*asp, uP*asp);
        float s = exp(-d*d/(uRad*uRad)) * uOn;
        gl_FragColor = vec4(min(prev.r*uDecay + s, 1.5), prev.g*0.9 + s*0.5, 0.0, 1.0);
      }`, {
      uPrev: { value: null }, uP: { value: new THREE.Vector2(-1, -1) }, uPPrev: { value: new THREE.Vector2(-1, -1) },
      uDecay: { value: decay }, uRad: { value: radius }, uOn: { value: 0 }, uAspect: { value: 1 },
    });
    this.mat = q.mat;
    this.scene.add(q.mesh);
  }
  get texture() { return this.a.texture; }
  update(renderer: THREE.WebGLRenderer, ctx: Ctx) {
    const u = this.mat.uniforms;
    u.uPrev.value = this.a.texture;
    u.uPPrev.value.copy(u.uP.value);
    u.uP.value.set(ctx.pointer.x, ctx.pointer.y);
    if (u.uPPrev.value.x < 0) u.uPPrev.value.copy(u.uP.value);
    u.uOn.value = ctx.pointer.active ? 1 : 0;
    u.uDecay.value = this.decay;
    u.uRad.value = this.radius;
    u.uAspect.value = ctx.width / Math.max(ctx.height, 1);
    renderer.setRenderTarget(this.b);
    renderer.render(this.scene, this.cam);
    renderer.setRenderTarget(null);
    const t = this.a; this.a = this.b; this.b = t;
  }
  dispose() { this.a.dispose(); this.b.dispose(); this.mat.dispose(); }
}

/** One renderer for the whole session. Scenes mount and unmount on navigation. */
export class Engine {
  renderer: THREE.WebGLRenderer;
  ctx: Ctx;
  scene: HeroScene | null = null;
  running = false;
  visible = true;
  private frames = 0; private acc = 0; private sampling = true;
  private lastMove = 0;
  private target = { x: 0.5, y: 0.5 };
  private baseDpr: number;

  constructor(public canvas: HTMLCanvasElement) {
    const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 768;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.setClearColor(0x050607, 1);
    this.baseDpr = Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5);
    this.ctx = {
      renderer: this.renderer, width: 1, height: 1, bufW: 1, bufH: 1,
      pointer: { x: 0.5, y: 0.5, vx: 0, vy: 0, active: false, down: false },
      scroll: 0, intro: 0, quality: mobile ? 0.8 : 1, mobile, reduced, time: 0, signal: 0,
    };
    this.resize();
    addEventListener('resize', () => this.resize(), { passive: true });
    const move = (x: number, y: number) => {
      this.target.x = x / innerWidth; this.target.y = 1 - y / innerHeight;
      this.ctx.pointer.active = true; this.lastMove = performance.now();
    };
    addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
    addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) move(t.clientX, t.clientY); }, { passive: true });
    addEventListener('pointerdown', (e) => { this.ctx.pointer.down = true; move(e.clientX, e.clientY); }, { passive: true });
    addEventListener('pointerup', () => { this.ctx.pointer.down = false; }, { passive: true });
    document.addEventListener('visibilitychange', () => { this.visible = !document.hidden; });
  }

  resize() {
    const w = innerWidth, h = Math.max(innerHeight, document.documentElement.clientHeight);
    const dpr = this.baseDpr * (0.55 + 0.45 * this.ctx.quality);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.ctx.width = w; this.ctx.height = h;
    this.ctx.bufW = Math.round(w * dpr); this.ctx.bufH = Math.round(h * dpr);
    this.scene?.resize?.(this.ctx);
  }

  async mount(scene: HeroScene) {
    this.unmount();
    this.scene = scene;
    this.ctx.intro = 0; this.ctx.scroll = 0; this.ctx.signal = 0;
    this.frames = 0; this.acc = 0; this.sampling = !this.ctx.reduced;
    scene.mount(this.ctx);
    scene.resize?.(this.ctx);
    this.canvas.style.opacity = '1';
    if (this.ctx.reduced) {
      // One composed still frame, then stop.
      this.ctx.time = 6; this.ctx.intro = 1;
      scene.update(this.ctx, 0.016);
      this.running = false;
    } else {
      this.running = true;
    }
  }

  unmount() {
    if (this.scene) { this.scene.dispose(); this.scene = null; }
    this.running = false;
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
  }

  setActive(on: boolean) {
    if (this.ctx.reduced || !this.scene) return;
    this.running = on;
    this.canvas.style.opacity = on ? '1' : '0';
  }

  tick(dt: number) {
    if (!this.running || !this.visible || !this.scene) return;
    dt = Math.min(dt, 1 / 20);
    const c = this.ctx;
    c.time += dt;
    c.intro = Math.min(1, c.intro + dt / 1.8);
    // Idle drift when nobody is touching or moving the pointer.
    if (performance.now() - this.lastMove > 3500) {
      c.pointer.active = false;
      this.target.x = 0.5 + Math.sin(c.time * 0.31) * 0.28;
      this.target.y = 0.5 + Math.sin(c.time * 0.23 + 1.3) * 0.22;
    }
    const px = c.pointer.x, py = c.pointer.y;
    const k = 1 - Math.exp(-dt * 9);
    c.pointer.x += (this.target.x - c.pointer.x) * k;
    c.pointer.y += (this.target.y - c.pointer.y) * k;
    c.pointer.vx += ((c.pointer.x - px) / dt - c.pointer.vx) * 0.2;
    c.pointer.vy += ((c.pointer.y - py) / dt - c.pointer.vy) * 0.2;
    this.scene.update(c, dt);
    this.govern(dt);
  }

  /** Quality governor: watch the first ~2 s of frames and step down if slow. */
  private govern(dt: number) {
    if (!this.sampling) return;
    this.frames++; this.acc += dt;
    if (this.frames >= 90) {
      const avg = this.acc / this.frames;
      this.frames = 0; this.acc = 0;
      if (avg > 1 / 55 && this.ctx.quality > 0.5) {
        this.ctx.quality = Math.max(0.5, this.ctx.quality - 0.2);
        this.resize();
        this.scene?.setQuality?.(this.ctx);
      } else {
        this.sampling = false;
      }
    }
  }
}
