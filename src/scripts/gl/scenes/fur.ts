import * as THREE from 'three';
import { NOISE } from '../glsl';
import type { Ctx, HeroScene } from '../engine';

/**
 * Beast: "Blue Fur". Real-time fur by shell texturing: a stack of transparent
 * layers, each one a little higher above a tilted surface, cut into strands by
 * a hash in the fragment shader. The cursor is a hand brushing through it:
 * strands near the pointer bend away, and a slow breeze moves the rest.
 */
export default class Fur implements HeroScene {
  scene = new THREE.Scene();
  cam!: THREE.PerspectiveCamera;
  group = new THREE.Group();
  mats: THREE.ShaderMaterial[] = [];
  shells = 16;
  plane!: THREE.PlaneGeometry;
  hit = new THREE.Vector3(); ray = new THREE.Raycaster(); ground = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  brush = new THREE.Vector2(); brushVel = new THREE.Vector2();

  mount(ctx: Ctx) {
    this.scene.background = new THREE.Color(0x03050c);
    this.cam = new THREE.PerspectiveCamera(45, ctx.width / ctx.height, 0.1, 50);
    this.cam.position.set(0, -2.6, 4.2);
    this.cam.lookAt(0, 0.4, 0);
    this.build(ctx);
    this.scene.add(this.group);
  }

  build(ctx: Ctx) {
    this.shells = Math.round((ctx.mobile ? 10 : 18) * ctx.quality);
    this.plane = new THREE.PlaneGeometry(12, 8, 1, 1);
    for (let i = 0; i < this.shells; i++) {
      const h = (i + 1) / this.shells;
      const mat = new THREE.ShaderMaterial({
        transparent: false, depthWrite: true,
        uniforms: { uH: { value: h }, uTime: { value: 0 }, uBrush: { value: new THREE.Vector2(9, 9) }, uBrushVel: { value: new THREE.Vector2() }, uIntro: { value: 0 }, uScroll: { value: 0 } },
        vertexShader: /* glsl */ `
          uniform float uH, uTime, uIntro, uScroll; uniform vec2 uBrush, uBrushVel;
          varying vec2 vUv; varying vec2 vW;
          ${NOISE}
          void main(){
            vec3 p = position;
            vec2 w = p.xy;
            float len = 0.22 * uIntro * (1.0 - uScroll*0.6);
            vec2 d = w - uBrush; float r = length(d);
            float brush = exp(-r*r*3.0);
            vec2 bend = vec2(snoise(w*0.5 + uTime*0.3), snoise(w*0.5 - uTime*0.27)) * 0.06
                      + normalize(d + 1e-4) * brush * 0.25 + uBrushVel * brush * 0.08;
            p.z += uH * len;
            p.xy += bend * uH * uH;                 // tips bend more than roots
            vUv = uv; vW = w;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uH; uniform vec2 uBrush;
          varying vec2 vUv; varying vec2 vW;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
          void main(){
            vec2 g = vUv * vec2(260.0, 175.0);
            vec2 cell = floor(g); vec2 f = fract(g) - 0.5;
            float strand = hash(cell);                       // each strand has its own height
            if (strand < uH) discard;
            float radius = 0.5 * (1.0 - uH / max(strand, 1e-3));
            if (length(f) > radius + 0.05) discard;
            float shade = mix(0.25, 1.0, uH) * (0.75 + 0.25*hash(cell + 7.0));
            vec3 base = vec3(0.08,0.16,0.55), tip = vec3(0.45,0.62,1.0);
            vec3 col = mix(base, tip, uH) * shade;
            col += vec3(0.35,0.45,0.8) * smoothstep(0.8, 0.0, length(vW - uBrush)) * uH * 0.4;
            gl_FragColor = vec4(col, 1.0);
          }`,
      });
      this.mats.push(mat);
      const m = new THREE.Mesh(this.plane, mat);
      m.renderOrder = i;
      this.group.add(m);
    }
    // the skin under the fur
    const skin = new THREE.Mesh(this.plane, new THREE.MeshBasicMaterial({ color: 0x050a22 }));
    skin.renderOrder = -1; this.group.add(skin);
  }

  resize(ctx: Ctx) { if (this.cam) { this.cam.aspect = ctx.width / ctx.height; this.cam.updateProjectionMatrix(); } }
  setQuality(ctx: Ctx) {
    this.group.clear(); this.mats.forEach((m) => m.dispose()); this.mats = []; this.plane.dispose();
    this.build(ctx);
  }

  update(ctx: Ctx, dt: number) {
    // project the pointer onto the fur surface
    this.ray.setFromCamera(new THREE.Vector2(ctx.pointer.x * 2 - 1, ctx.pointer.y * 2 - 1), this.cam);
    if (this.ray.ray.intersectPlane(this.ground, this.hit)) {
      const px = this.brush.x, py = this.brush.y;
      this.brush.set(this.hit.x, this.hit.y);
      this.brushVel.set((this.brush.x - px) / Math.max(dt, 1e-3), (this.brush.y - py) / Math.max(dt, 1e-3)).clampLength(0, 4);
    }
    this.group.rotation.z = Math.sin(ctx.time * 0.1) * 0.04;
    for (const m of this.mats) {
      const u = m.uniforms;
      u.uTime.value = ctx.time; u.uBrush.value.copy(this.brush); u.uBrushVel.value.copy(this.brushVel);
      u.uIntro.value = ctx.intro; u.uScroll.value = ctx.scroll;
    }
    ctx.renderer.render(this.scene, this.cam);
  }

  dispose() { this.mats.forEach((m) => m.dispose()); this.plane?.dispose(); this.group.clear(); }
}
