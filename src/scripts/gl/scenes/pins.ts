import * as THREE from 'three';
import { NOISE } from '../glsl';
import { fullscreen, syncCommon, type Ctx, type HeroScene } from '../engine';

/**
 * Shuri: "Sand Table". A 3D pin-art table: thousands of instanced pins whose
 * heights are computed in the vertex shader from a set of shapes that morph
 * into one another (rings, a mound, a travelling wave). The cursor sculpts:
 * pins rise beneath it. Tops glow vibranium violet in proportion to height.
 * Scrolling lets every pin sink flat.
 */
export default class Pins implements HeroScene {
  scene = new THREE.Scene();
  cam!: THREE.PerspectiveCamera;
  bgScene = new THREE.Scene(); bg!: THREE.ShaderMaterial;
  mesh!: THREE.Mesh; mat!: THREE.ShaderMaterial;
  ray = new THREE.Raycaster(); plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); hit = new THREE.Vector3();
  cols = 0; rows = 0; spacing = 0.2;

  mount(ctx: Ctx) {
    const bg = fullscreen(/* glsl */ `
      uniform float uTime; uniform vec2 uRes; uniform float uIntro; uniform float uScroll; varying vec2 vUv;
      ${NOISE}
      void main(){
        float asp = uRes.x/uRes.y; vec2 p = (vUv-0.5)*vec2(asp,1.0);
        vec3 col = mix(vec3(0.015,0.01,0.03), vec3(0.06,0.03,0.1), smoothstep(-0.5, 0.6, p.y));
        col += vec3(0.05,0.02,0.08) * fbm3(p*2.0 + uTime*0.03);
        col *= smoothstep(0.0,1.0,uIntro*1.3) * (1.0 - uScroll*0.4);
        gl_FragColor = vec4(col,1.0);
      }`);
    this.bg = bg.mat; this.bgScene.add(bg.mesh);
    this.cam = new THREE.PerspectiveCamera(38, ctx.width / ctx.height, 0.1, 80);
    this.build(ctx);
    this.resize(ctx);
  }

  build(ctx: Ctx) {
    this.cols = Math.round((ctx.mobile ? 34 : 72) * Math.max(ctx.quality, 0.6));
    this.rows = Math.round((ctx.mobile ? 46 : 40) * Math.max(ctx.quality, 0.6));
    this.spacing = 0.2;
    const box = new THREE.BoxGeometry(0.17, 1, 0.17); box.translate(0, 0.5, 0);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = box.index; geo.setAttribute('position', box.getAttribute('position')); geo.setAttribute('normal', box.getAttribute('normal'));
    const grid = new Float32Array(this.cols * this.rows * 2);
    let k = 0;
    for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) {
      grid[k++] = (i - (this.cols - 1) / 2) * this.spacing; grid[k++] = (j - (this.rows - 1) / 2) * this.spacing;
    }
    geo.setAttribute('aGrid', new THREE.InstancedBufferAttribute(grid, 2));
    geo.instanceCount = this.cols * this.rows;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(99, 99) }, uIntro: { value: 0 }, uScroll: { value: 0 }, uMorph: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute vec2 aGrid;
        uniform float uTime; uniform vec2 uMouse; uniform float uIntro; uniform float uScroll; uniform float uMorph;
        varying vec3 vN; varying float vH; varying float vTop; varying vec3 vW;
        float shapeA(vec2 p){ float r = length(p); return 0.5 + 0.5*sin(r*2.6 - uTime*1.6); }              // rings
        float shapeB(vec2 p){ return clamp(1.6 - length(p*vec2(0.55,0.75)), 0.0, 1.6); }                  // a mound
        float shapeC(vec2 p){ return 0.5 + 0.5*sin(p.x*1.4 + uTime*1.2) * cos(p.y*1.1 - uTime*0.8); }    // a wave
        void main(){
          vec2 g = aGrid;
          float m = uMorph;                                  // 0..3 cycles through the shapes
          float a = shapeA(g), b = shapeB(g), c = shapeC(g);
          float h = m < 1.0 ? mix(a, b, smoothstep(0.0,1.0,m)) : m < 2.0 ? mix(b, c, smoothstep(0.0,1.0,m-1.0)) : mix(c, a, smoothstep(0.0,1.0,m-2.0));
          float d = length(g - uMouse);
          h += 1.6 * exp(-d*d*0.9);                          // the cursor sculpts
          h = (0.08 + h * 0.9) * uIntro * (1.0 - uScroll*0.95);
          vec3 p = position; p.y *= max(h, 0.02);
          p.xz += g;
          vec4 w = modelMatrix * vec4(p, 1.0);
          vW = w.xyz; vN = normal; vH = h; vTop = position.y;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vN; varying float vH; varying float vTop; varying vec3 vW;
        void main(){
          vec3 L = normalize(vec3(-0.5, 1.0, 0.6));
          float diff = max(dot(vN, L), 0.0);
          vec3 base = vec3(0.12,0.1,0.16);
          vec3 col = base * (0.35 + 0.65*diff);
          float glow = smoothstep(0.85, 1.0, vTop) * smoothstep(0.15, 1.6, vH);
          col += vec3(0.62,0.38,1.0) * glow * 1.2;
          col += vec3(0.95,0.78,0.42) * smoothstep(1.4, 2.0, vH) * smoothstep(0.85, 1.0, vTop) * 0.6;
          col *= smoothstep(14.0, 4.0, length(vW.xz));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  resize(ctx: Ctx) {
    if (!this.cam) return;
    this.cam.aspect = ctx.width / ctx.height; this.cam.updateProjectionMatrix();
    const portrait = ctx.width < ctx.height;
    this.cam.position.set(0, portrait ? 9.5 : 6.2, portrait ? 6.5 : 7.2);
    this.cam.lookAt(0, 0, portrait ? -0.5 : 0.3);
  }
  setQuality(ctx: Ctx) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); this.build(ctx); }

  update(ctx: Ctx, _dt: number) {
    syncCommon(this.bg, ctx);
    this.ray.setFromCamera(new THREE.Vector2(ctx.pointer.x * 2 - 1, ctx.pointer.y * 2 - 1), this.cam);
    const u = this.mat.uniforms;
    if (this.ray.ray.intersectPlane(this.plane, this.hit)) u.uMouse.value.set(this.hit.x, this.hit.z);
    u.uTime.value = ctx.time; u.uIntro.value = ctx.intro; u.uScroll.value = ctx.scroll;
    u.uMorph.value = ((ctx.time * 0.18) % 3);
    const r = ctx.renderer;
    r.autoClear = false; r.clear();
    r.render(this.bgScene, this.cam);
    r.clearDepth();
    r.render(this.scene, this.cam);
    r.autoClear = true;
  }

  dispose() { this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); this.bg.dispose(); }
}
