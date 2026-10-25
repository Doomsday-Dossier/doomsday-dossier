import * as THREE from 'three';
import { NOISE } from '../glsl';
import { fullscreen, syncCommon, type Ctx, type HeroScene } from '../engine';

/**
 * Red Guardian: "Rack Focus". A 3D snowfall shot like film with a shallow depth
 * of field. Every flake is a point whose size and softness come from its
 * distance to the focal plane, drawn as a lens-shaped bokeh disc with a bright
 * rim. Moving the pointer up and down pulls focus through the storm; left and
 * right changes the wind. A sodium floodlight burns somewhere behind.
 */
export default class Bokeh implements HeroScene {
  scene = new THREE.Scene();
  cam!: THREE.PerspectiveCamera;
  bgScene = new THREE.Scene(); bg!: THREE.ShaderMaterial;
  pts!: THREE.Points; mat!: THREE.ShaderMaterial;
  focus = 6; wind = 0;

  mount(ctx: Ctx) {
    const bg = fullscreen(/* glsl */ `
      uniform float uTime; uniform vec2 uRes; uniform float uIntro; uniform float uScroll; varying vec2 vUv;
      ${NOISE}
      void main(){
        float asp = uRes.x/uRes.y; vec2 p = (vUv-0.5)*vec2(asp,1.0);
        vec3 col = mix(vec3(0.02,0.025,0.04), vec3(0.06,0.07,0.1), vUv.y);
        vec2 lamp = vec2(asp*0.32, 0.28);
        float g = exp(-length(p - lamp)*3.0);
        col += vec3(1.0,0.55,0.2) * g * (0.35 + 0.05*sin(uTime*7.0)*step(0.97, fract(uTime*0.13)));
        col += vec3(0.04,0.05,0.07) * fbm3(p*2.0 + vec2(uTime*0.05, 0.0));
        col *= smoothstep(0.0,1.0,uIntro*1.3) * (1.0 - uScroll*0.4);
        gl_FragColor = vec4(col,1.0);
      }`);
    this.bg = bg.mat; this.bgScene.add(bg.mesh);
    this.cam = new THREE.PerspectiveCamera(50, ctx.width / ctx.height, 0.1, 60);
    this.cam.position.set(0, 0, 0);
    this.build(ctx);
  }

  build(ctx: Ctx) {
    const n = Math.round((ctx.mobile ? 1100 : 2200) * ctx.quality);
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 22; pos[i * 3 + 1] = Math.random() * 14 - 7; pos[i * 3 + 2] = -(1 + Math.random() * 20);
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uFocus: { value: 6 }, uWind: { value: 0 }, uPx: { value: 1 }, uIntro: { value: 0 }, uFall: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime; uniform float uFocus; uniform float uWind; uniform float uPx; uniform float uIntro; uniform float uFall;
        varying float vCoc; varying float vSeed;
        void main(){
          vec3 p = position;
          float fall = uTime * (0.6 + aSeed*0.6) * uFall;
          p.y = mod(p.y - fall + 7.0, 14.0) - 7.0;
          p.x += sin(uTime*0.6 + aSeed*20.0)*0.25;
          p.x = mod(p.x + uWind*uTime*1.5 + 11.0, 22.0) - 11.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float depth = -mv.z;
          float coc = abs(depth - uFocus) / depth;           // circle of confusion
          vCoc = clamp(coc*1.6, 0.0, 1.0);
          float base = (0.05 + 0.03*aSeed) / depth * 900.0;  // in-focus flake size
          gl_PointSize = uPx * min(base + vCoc * 60.0, 90.0) * (0.6 + 0.4*uIntro);
          vSeed = aSeed;
        }`,
      fragmentShader: /* glsl */ `
        varying float vCoc; varying float vSeed; uniform float uIntro;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          // sharp flakes are small soft dots; defocused ones become discs with a brighter rim
          float disc = smoothstep(0.5, 0.46 - vCoc*0.1, r);
          float rim = smoothstep(0.3, 0.48, r) * disc;
          float sharp = smoothstep(0.5, 0.0, r);
          float shape = mix(sharp, disc*0.55 + rim*0.6, vCoc);
          float energy = mix(0.8, 0.05, vCoc);                 // light spreads over a larger disc
          vec3 col = mix(vec3(0.85,0.92,1.0), vec3(1.0,0.75,0.5), step(0.93, vSeed));
          gl_FragColor = vec4(col * shape * energy * 0.75 * uIntro, 1.0);
        }`,
    });
    this.pts = new THREE.Points(geo, this.mat);
    this.pts.frustumCulled = false;
    this.scene.add(this.pts);
  }

  resize(ctx: Ctx) { if (this.cam) { this.cam.aspect = ctx.width / ctx.height; this.cam.updateProjectionMatrix(); } }
  setQuality(ctx: Ctx) { this.scene.remove(this.pts); this.pts.geometry.dispose(); this.mat.dispose(); this.build(ctx); }

  update(ctx: Ctx, dt: number) {
    syncCommon(this.bg, ctx);
    const targetFocus = 2 + (1 - ctx.pointer.y) * 14;
    this.focus += (targetFocus - this.focus) * Math.min(1, dt * 2.5);
    this.wind += ((ctx.pointer.x - 0.5) * 2 - this.wind) * Math.min(1, dt * 1.5);
    ctx.signal = Math.abs(this.focus - targetFocus) / 14;   // how far from focus, for the title blur
    const u = this.mat.uniforms;
    u.uTime.value = ctx.time; u.uFocus.value = this.focus; u.uWind.value = this.wind;
    u.uPx.value = ctx.bufW / ctx.width; u.uIntro.value = ctx.intro; u.uFall.value = 1 + ctx.scroll * 3;
    const r = ctx.renderer;
    r.autoClear = false; r.clear();
    r.render(this.bgScene, this.cam);
    r.render(this.scene, this.cam);
    r.autoClear = true;
  }

  dispose() { this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); this.bg.dispose(); }
}
