import * as THREE from 'three';
import { NOISE } from '../glsl';
import { fullscreen, syncCommon, type Ctx, type HeroScene } from '../engine';

/**
 * Magneto: "Lines of Force". A field of iron needles, each one a point sprite
 * whose needle is drawn in the fragment shader along the magnetic field of two poles.
 * The cursor is the north pole; the south pole circles slowly. Needles near a
 * pole stand long and bright. Scrolling flips the polarity.
 */
export default class Magnet implements HeroScene {
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  bg!: THREE.ShaderMaterial;
  mesh!: THREE.Mesh; mat!: THREE.ShaderMaterial;
  asp = 1; step = 0.06;

  mount(ctx: Ctx) {
    const bg = fullscreen(/* glsl */ `
      uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uIntro; uniform float uScroll; varying vec2 vUv;
      ${NOISE}
      void main(){
        float asp = uRes.x/uRes.y; vec2 p = (vUv-0.5)*vec2(asp,1.0);
        vec2 m = (uMouse-0.5)*vec2(asp,1.0);
        vec3 col = vec3(0.025,0.015,0.03) + vec3(0.06,0.02,0.07)*fbm3(p*1.6+uTime*0.02);
        col += vec3(0.55,0.05,0.25) * exp(-length(p-m)*5.0) * 0.25;
        col *= smoothstep(0.0,1.0,uIntro*1.3) * (1.0 - uScroll*0.4);
        gl_FragColor = vec4(col,1.0);
      }`);
    this.bg = bg.mat; bg.mesh.renderOrder = -1; this.scene.add(bg.mesh);
    this.build(ctx);
  }

  build(ctx: Ctx) {
    this.asp = ctx.width / ctx.height;
    const step = (ctx.mobile ? 0.085 : 0.06) / Math.max(ctx.quality, 0.6);
    this.step = step;
    const cols = Math.ceil((this.asp * 2.1) / step), rows = Math.ceil(2.1 / step);
    const offsets: number[] = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      offsets.push(-this.asp * 1.05 + (i + 0.5) * step + (Math.random() - 0.5) * step * 0.3, -1.05 + (j + 0.5) * step + (Math.random() - 0.5) * step * 0.3, Math.random());
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(offsets), 3));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uA: { value: new THREE.Vector2() }, uB: { value: new THREE.Vector2() }, uPol: { value: 1 }, uAsp: { value: this.asp }, uSize: { value: 20 }, uIntro: { value: 0 }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        uniform vec2 uA;
        uniform vec2 uB;
        uniform float uPol;
        uniform float uAsp;
        uniform float uSize;
        uniform float uIntro;
        uniform float uTime;
        varying float vMag; varying vec2 vDir; varying float vLen;
        vec2 field(vec2 p){
          vec2 da = p - uA, db = p - uB;
          float ra = max(dot(da,da), 0.004), rb = max(dot(db,db), 0.004);
          return uPol * (da / pow(ra, 1.5) - db / pow(rb, 1.5));
        }
        void main(){
          vec2 c = position.xy;
          vec2 B = field(c);
          float mag = length(B);
          vDir = B / max(mag, 1e-4);
          float m = clamp(log(1.0 + mag) / 4.5, 0.0, 1.0);
          vLen = (0.45 + m * 0.55) * uIntro;
          vMag = m * (0.75 + 0.25*sin(uTime*2.0 + position.z*6.28));
          gl_Position = vec4(c.x / uAsp, c.y, 0.0, 1.0);
          gl_PointSize = uSize;
        }`,
      fragmentShader: /* glsl */ `
        varying float vMag; varying vec2 vDir; varying float vLen;
        void main(){
          vec2 q = gl_PointCoord - 0.5; q.y = -q.y;
          float along = dot(q, vDir), across = dot(q, vec2(-vDir.y, vDir.x));
          float hl = 0.5 * vLen;
          float d = length(vec2(max(abs(along) - hl, 0.0), across));
          float a = smoothstep(0.07, 0.025, d);
          float tipFade = smoothstep(hl, hl*0.2, abs(along));
          vec3 steel = vec3(0.5,0.47,0.56); vec3 hot = vec3(1.0,0.22,0.58);
          vec3 c = mix(steel, hot, smoothstep(0.35, 0.9, vMag));
          gl_FragColor = vec4(c * (0.5 + vMag*1.4) * a * (0.55 + 0.45*tipFade), 1.0);
        }`,
    });
    this.mesh = new THREE.Points(geo, this.mat) as unknown as THREE.Mesh;
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  resize(ctx: Ctx) { if (this.mesh && Math.abs(ctx.width / ctx.height - this.asp) > 0.02) { this.teardown(); this.build(ctx); } }
  setQuality(ctx: Ctx) { this.teardown(); this.build(ctx); }
  private teardown() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }

  update(ctx: Ctx, _dt: number) {
    syncCommon(this.bg, ctx);
    const t = ctx.time, asp = this.asp;
    const u = this.mat.uniforms;
    u.uA.value.set((ctx.pointer.x * 2 - 1) * asp, ctx.pointer.y * 2 - 1);
    u.uB.value.set(Math.cos(t * 0.25) * asp * 0.55, Math.sin(t * 0.33) * 0.5);
    u.uPol.value = Math.cos(Math.min(1, ctx.scroll * 1.5) * Math.PI);
    u.uIntro.value = ctx.intro; u.uTime.value = t;
    u.uSize.value = this.step * (ctx.bufH / 2) * 1.05;
    ctx.renderer.render(this.scene, this.cam);
  }

  dispose() { this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
}
