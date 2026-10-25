import * as THREE from 'three';
import type { Ctx, HeroScene } from '../engine';

/**
 * Ben Grimm: "Clobber". A real 3D wall of faceted rock shards, flat-shaded and
 * lit by a warm key light that follows the cursor. Rocks lean away from the
 * pointer; a click or tap lands a punch that sends a shockwave through the wall.
 * Scrolling crumbles it, shard by shard, into the dark.
 */
export default class Rock implements HeroScene {
  scene = new THREE.Scene();
  cam!: THREE.PerspectiveCamera;
  mesh!: THREE.InstancedMesh;
  lamp!: THREE.PointLight;
  n = 0; cols = 0; rows = 0;
  base: { x: number; y: number; z: number; s: number; rx: number; ry: number; rz: number; fall: number; spin: number }[] = [];
  push!: Float32Array;
  hits: { x: number; y: number; t: number }[] = [];
  wasDown = false; autoT = 1.4;
  dummy = new THREE.Object3D();
  halfW = 1; halfH = 1;

  mount(ctx: Ctx) {
    this.scene.background = new THREE.Color(0x080605);
    this.scene.fog = new THREE.Fog(0x080605, 6, 13);
    this.cam = new THREE.PerspectiveCamera(40, ctx.width / ctx.height, 0.1, 50);
    this.cam.position.set(0, 0, 9);
    this.scene.add(new THREE.AmbientLight(0x3a2a20, 1.4));
    const key = new THREE.DirectionalLight(0xffb37a, 1.6); key.position.set(-4, 5, 6); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6a8cff, 0.6); rim.position.set(5, -2, -3); this.scene.add(rim);
    this.lamp = new THREE.PointLight(0xff8a3a, 30, 9, 1.6); this.lamp.position.set(0, 0, 3); this.scene.add(this.lamp);
    this.build(ctx);
  }

  build(ctx: Ctx) {
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * 9;
    this.halfH = vh / 2 * 1.1; this.halfW = this.halfH * (ctx.width / ctx.height);
    const size = (ctx.mobile ? 0.62 : 0.5) / Math.max(ctx.quality, 0.7);
    this.cols = Math.ceil((this.halfW * 2) / size) + 1;
    this.rows = Math.ceil((this.halfH * 2) / size) + 1;
    this.n = this.cols * this.rows;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.85, metalness: 0.05 });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.base = []; this.push = new Float32Array(this.n);
    const c = new THREE.Color();
    for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) {
      const k = j * this.cols + i;
      const jitter = (Math.random() - 0.5) * size * 0.5;
      this.base.push({
        x: -this.halfW + i * size + (j % 2 ? size / 2 : 0) + jitter, y: -this.halfH + j * size + (Math.random() - 0.5) * size * 0.4,
        z: (Math.random() - 0.5) * 0.5, s: size * (0.55 + Math.random() * 0.35),
        rx: Math.random() * 6.28, ry: Math.random() * 6.28, rz: Math.random() * 6.28,
        fall: Math.random(), spin: (Math.random() - 0.5) * 4,
      });
      c.setHSL(0.06 + Math.random() * 0.03, 0.55 + Math.random() * 0.2, 0.32 + Math.random() * 0.14);
      this.mesh.setColorAt(k, c);
    }
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  resize(ctx: Ctx) {
    if (!this.cam) return;
    this.cam.aspect = ctx.width / ctx.height; this.cam.updateProjectionMatrix();
    this.scene.remove(this.mesh); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose();
    this.build(ctx);
  }
  setQuality(ctx: Ctx) { this.resize(ctx); }

  update(ctx: Ctx, dt: number) {
    const t = ctx.time;
    const mx = (ctx.pointer.x * 2 - 1) * this.halfW / 1.1, my = (ctx.pointer.y * 2 - 1) * this.halfH / 1.1;
    // clobber: rising edge of a press, plus one opening punch and idle punches
    const down = ctx.pointer.down;
    if (down && !this.wasDown) this.hits.push({ x: mx, y: my, t });
    this.wasDown = down;
    this.autoT -= dt;
    if (this.autoT <= 0 && !ctx.reduced) { this.hits.push({ x: mx, y: my, t }); this.autoT = ctx.pointer.active ? 9 : 5; }
    this.hits = this.hits.filter((h) => t - h.t < 2.5);
    let shake = 0;
    for (const h of this.hits) shake = Math.max(shake, Math.max(0, 1 - (t - h.t) * 2.5));
    ctx.signal = shake;

    this.lamp.position.set(mx, my, 2.6);
    this.lamp.intensity = 30 + shake * 80;
    const crumble = ctx.scroll;
    for (let k = 0; k < this.n; k++) {
      const b = this.base[k];
      const dx = b.x - mx, dy = b.y - my, d = Math.hypot(dx, dy);
      const target = Math.max(0, 1 - d / 2.2) * 0.9;                       // lean away from the pointer
      this.push[k] += (target - this.push[k]) * Math.min(1, dt * 6);
      let wave = 0;
      for (const h of this.hits) {
        const r = (t - h.t) * 7.5, dist = Math.hypot(b.x - h.x, b.y - h.y);
        wave += Math.exp(-((dist - r) ** 2) * 3) * Math.max(0, 1 - (t - h.t) / 2.5) * 1.6;
      }
      const f = Math.max(0, crumble * 1.6 - b.fall * 0.9);               // crumble order
      const intro = Math.min(1, Math.max(0, ctx.intro * 1.6 - (b.y + this.halfH) / (this.halfH * 2) * 0.6));
      this.dummy.position.set(
        b.x + dx * wave * 0.05,
        b.y - f * f * 6 + (1 - intro) * -1.5,
        b.z - this.push[k] - wave * 0.9 - f * 2 + Math.sin(t * 0.7 + k) * 0.03,
      );
      this.dummy.rotation.set(b.rx + wave * 0.6 + f * b.spin, b.ry + t * 0.02, b.rz + f * b.spin);
      this.dummy.scale.setScalar(b.s * intro * (1 - Math.min(1, f) * 0.5));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(k, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.cam.position.x = (Math.random() - 0.5) * shake * 0.12;
    this.cam.position.y = (Math.random() - 0.5) * shake * 0.12;
    ctx.renderer.render(this.scene, this.cam);
  }

  dispose() {
    this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  }
}
