import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { NOISE } from '../glsl';
import { fullscreen, syncCommon, type Ctx, type HeroScene } from '../engine';

/**
 * John Walker: "Dog Tags". Two physically based metal tags on a ball chain,
 * lit by a studio environment so the steel actually reflects. They hang from
 * the top of the frame and swing on a damped pendulum toward the cursor, the
 * second tag lagging the first. The stamped name is a bump map drawn on a
 * canvas. Scrolling lets them drop out of frame.
 */
export default class Tags implements HeroScene {
  scene = new THREE.Scene();
  cam!: THREE.PerspectiveCamera;
  bgScene = new THREE.Scene(); bg!: THREE.ShaderMaterial;
  rig = new THREE.Group(); tagA!: THREE.Mesh; tagB!: THREE.Mesh; chain!: THREE.InstancedMesh;
  env!: THREE.Texture; key!: THREE.PointLight;
  a1 = 0; v1 = 0; a2 = 0; v2 = 0;
  dummy = new THREE.Object3D();
  tex!: THREE.CanvasTexture;

  mount(ctx: Ctx) {
    const bg = fullscreen(/* glsl */ `
      uniform float uTime; uniform vec2 uRes; uniform float uIntro; uniform float uScroll; varying vec2 vUv;
      ${NOISE}
      void main(){
        float asp = uRes.x/uRes.y; vec2 p = (vUv-0.5)*vec2(asp,1.0);
        vec3 col = mix(vec3(0.03,0.035,0.025), vec3(0.09,0.1,0.075), smoothstep(1.2, 0.0, length(p - vec2(0.2, 0.2))));
        col += vec3(0.03,0.035,0.02) * fbm3(p*3.0);
        col *= smoothstep(0.0,1.0,uIntro*1.3) * (1.0 - uScroll*0.4);
        gl_FragColor = vec4(col,1.0);
      }`);
    this.bg = bg.mat; this.bgScene.add(bg.mesh);
    this.cam = new THREE.PerspectiveCamera(35, ctx.width / ctx.height, 0.1, 50);
    this.cam.position.set(0, 0, 9);
    const pm = new THREE.PMREMGenerator(ctx.renderer);
    this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.scene.environment = this.env;
    this.key = new THREE.PointLight(0xfff1d6, 40, 20, 1.5); this.key.position.set(2, 2, 5); this.scene.add(this.key);
    this.scene.add(new THREE.AmbientLight(0x40442f, 0.6));

    this.tex = this.stamp();
    const shape = new THREE.Shape();
    const w = 1.1, h = 1.9, r = 0.32;
    shape.moveTo(-w / 2 + r, -h / 2); shape.lineTo(w / 2 - r, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); shape.lineTo(-w / 2, -h / 2 + r); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const hole = new THREE.Path(); hole.absarc(0, h / 2 - 0.22, 0.08, 0, Math.PI * 2, true); shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.03, bevelSegments: 3, curveSegments: 10 });
    geo.center();
    // map UVs of the front face to the tag rectangle for the stamped text
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute, pos = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
    const mat = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 1, roughness: 0.28, bumpMap: this.tex, bumpScale: 2.2, envMapIntensity: 1.2 });
    this.tagA = new THREE.Mesh(geo, mat);
    this.tagB = new THREE.Mesh(geo, mat.clone());
    (this.tagB.material as THREE.MeshStandardMaterial).roughness = 0.38;
    const beadGeo = new THREE.SphereGeometry(0.035, 10, 8);
    this.chain = new THREE.InstancedMesh(beadGeo, new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 1, roughness: 0.3 }), 120);
    this.scene.add(this.chain, this.rig);
    this.rig.add(this.tagA, this.tagB);
  }

  private stamp() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 880;
    const g = c.getContext('2d')!;
    g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#ffffff'; g.font = '700 74px "Graduate", "Courier New", monospace'; g.textAlign = 'left';
    const lines = ['WALKER', 'JOHN', '', 'U.S. AGENT'];
    lines.forEach((l, i) => g.fillText(l, 70, 330 + i * 96));
    g.strokeStyle = '#a0a0a0'; g.lineWidth = 6; g.strokeRect(36, 230, c.width - 72, 430);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
    return t;
  }

  resize(ctx: Ctx) { if (this.cam) { this.cam.aspect = ctx.width / ctx.height; this.cam.updateProjectionMatrix(); this.cam.position.z = ctx.width < ctx.height ? 13 : 9; } }

  update(ctx: Ctx, dt: number) {
    syncCommon(this.bg, ctx);
    dt = Math.min(dt, 1 / 30);
    // damped pendulums: the first leans toward the cursor, the second follows the first
    const target = (ctx.pointer.x - 0.5) * 0.9;
    const k = 14, c = 2.2;
    this.v1 += (-(this.a1 - target) * k - this.v1 * c) * dt; this.a1 += this.v1 * dt;
    this.v2 += (-(this.a2 - this.a1) * (k * 0.7) - this.v2 * c * 0.8) * dt; this.a2 += this.v2 * dt;
    const drop = ctx.scroll * ctx.scroll * 9;
    const wide = ctx.width > ctx.height;
    const pivot = new THREE.Vector3(wide ? 2.3 : 0.6, 3.6 - drop, 0);
    const len1 = 3.6, len2 = 3.9;
    const p1 = new THREE.Vector3(pivot.x + Math.sin(this.a1) * len1, pivot.y - Math.cos(this.a1) * len1, 0.06);
    const p2 = new THREE.Vector3(pivot.x + Math.sin(this.a2) * len2 + 0.35, pivot.y - Math.cos(this.a2) * len2 - 0.2, -0.06);
    const intro = Math.min(1, ctx.intro * 1.2);
    this.tagA.position.copy(p1).add(new THREE.Vector3(0, -0.95 + (1 - intro) * 4, 0));
    this.tagA.rotation.set(Math.sin(ctx.time * 0.9) * 0.08, Math.sin(ctx.time * 0.7) * 0.5 + (ctx.pointer.y - 0.5) * 0.6, -this.a1);
    this.tagB.position.copy(p2).add(new THREE.Vector3(0, -0.95 + (1 - intro) * 4, 0));
    this.tagB.rotation.set(0.05, Math.sin(ctx.time * 0.6 + 1) * 0.6 + (ctx.pointer.y - 0.5) * 0.5, -this.a2 + 0.12);
    // the ball chain: two strands from above the frame to each tag's hole
    let n = 0;
    const strand = (to: THREE.Vector3) => {
      for (let i = 0; i < 60; i++) {
        const t = i / 59;
        const x = THREE.MathUtils.lerp(pivot.x - 0.1, to.x, t), y = THREE.MathUtils.lerp(pivot.y + 4, to.y + 0.73, t) - Math.sin(t * Math.PI) * 0.15;
        this.dummy.position.set(x, y, to.z); this.dummy.updateMatrix(); this.chain.setMatrixAt(n++, this.dummy.matrix);
      }
    };
    strand(this.tagA.position); strand(this.tagB.position);
    this.chain.instanceMatrix.needsUpdate = true;
    this.key.position.set((ctx.pointer.x - 0.5) * 8, (ctx.pointer.y - 0.5) * 6, 5);
    ctx.signal = this.a1;
    const r = ctx.renderer;
    r.autoClear = false; r.clear();
    r.render(this.bgScene, this.cam);
    r.clearDepth();
    r.render(this.scene, this.cam);
    r.autoClear = true;
  }

  dispose() {
    this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    this.env.dispose(); this.tex.dispose(); this.bg.dispose();
    this.scene.environment = null;
  }
}
