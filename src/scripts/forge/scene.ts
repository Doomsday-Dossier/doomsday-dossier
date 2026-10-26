/**
 * The forge (opening), from Fantastic Four Annual #2 (1964): the monks forge Doom's armour and he presses the
 * mask on while it is still hot. Here the iron goes into an engraved mould of the title.
 *
 * A dark floor and a cast-iron mould with DOOMSDAY DOSSIER engraved in it (real geometry from the title's
 * distance field). Molten iron pours into the letters from above, glowing by temperature and lighting the iron
 * around it; it cools from white through orange to dark iron, a crust forming over veins that stay hot
 * longest. Green light then seeps through cracks spreading out from the letters; the mould splits along a
 * jagged seam and its halves fall away; the cast title rises to stand, its edges burning green, and the
 * countdown to 18 December etches into an iron bar beneath it. Sparks, embers and smoke move through it all,
 * and bloom lets the heat glow. The page drives it with one clock (`t`, seconds from the click).
 */
import * as THREE from 'three';
import { COMMON, LIGHT } from './glsl';
import type { TitleField } from './sdf';
import type { Timing } from './timing';

const GREEN = new THREE.Color(0.12, 1.0, 0.48);
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const span = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(0.0001, b - a));

const TITLE_W = 8;
const DEPTH = 0.22;

export class Forge {
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
  t = -1;             // seconds since the click (negative: the gate)
  timing: Timing;
  private titleH: number;
  private mouldW: number; private mouldD: number;
  private uniforms: Record<string, THREE.IUniform>;
  private halves: THREE.Group[] = [];
  private letters = new THREE.Group();
  private stream: THREE.Mesh;
  private sparks: Sparks; private embers: Sparks; private smoke: Smoke;
  private ember: THREE.Mesh;
  private bar: THREE.Mesh; private barCanvas: HTMLCanvasElement; private barTex: THREE.CanvasTexture; private lastBar = '';
  private phone: boolean;
  private shake = 0;
  private barH = 1;
  private static readonly STAND_Y = 0.66; // how high the standing title's foot sits

  constructor(field: TitleField, timing: Timing, phone: boolean) {
    this.timing = timing; this.phone = phone;
    this.titleH = TITLE_W * field.aspect;
    this.mouldW = TITLE_W + 1.6; this.mouldD = this.titleH + 1.5;
    const sdf = new THREE.DataTexture(field.data, field.w, field.h, THREE.RedFormat, THREE.UnsignedByteType);
    sdf.minFilter = THREE.LinearFilter; sdf.magFilter = THREE.LinearFilter; sdf.wrapS = sdf.wrapT = THREE.ClampToEdgeWrapping; sdf.needsUpdate = true;
    this.uniforms = {
      uSDF: { value: sdf }, uNoise: { value: noiseTexture() }, uTR: { value: new THREE.Vector4(-TITLE_W / 2, -this.titleH / 2, TITLE_W, this.titleH) },
      uTime: { value: -1 }, uPour0: { value: timing.pour[0] }, uPour1: { value: timing.pour[1] }, uCool: { value: timing.coolDur },
      uSeep0: { value: timing.seep[0] }, uSeep1: { value: timing.seep[1] }, uCrack: { value: timing.crack }, uSplit: { value: 0 },
      uKeyDir: { value: new THREE.Vector3(-0.45, 0.85, -0.35) }, uKeyCol: { value: new THREE.Color(0.1, 0.115, 0.14) },
      uFurnPos: { value: new THREE.Vector3(-9, 3, 2) }, uFurnCol: { value: new THREE.Color(0, 0, 0) },
      uGlowPos: { value: new THREE.Vector3(0, 1.2, 0) }, uGlowCol: { value: new THREE.Color(0, 0, 0) },
      uGreenPos: { value: new THREE.Vector3(0, 1.0, 0) }, uGreenCol: { value: new THREE.Color(0, 0, 0) },
      uExposure: { value: 0 }, uGreenEmit: { value: GREEN.clone().multiplyScalar(2.2) }, uEdge: { value: 0 }, uSeamGlow: { value: 0 },
    };
    if (timing.id === 'return') { this.uniforms.uPour0.value = -9; this.uniforms.uPour1.value = -8.5; }

    this.scene.background = new THREE.Color(0x050607);
    this.buildFloor();
    for (const side of [1, -1]) this.halves.push(this.buildHalf(side));
    this.buildLetters();
    this.stream = this.buildStream();
    this.sparks = new Sparks(phone ? 220 : 520, 0.05, true); this.scene.add(this.sparks.points);
    this.embers = new Sparks(phone ? 70 : 160, 0.03, false); this.scene.add(this.embers.points);
    this.smoke = new Smoke(phone ? 14 : 26); this.scene.add(this.smoke.points);
    this.ember = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.1, 0.2) }));
    this.ember.position.set(-TITLE_W * 0.36, 0.03, -this.titleH * 0.22);
    this.scene.add(this.ember);
    const bar = countdownBar(); this.barCanvas = bar.canvas; this.barTex = bar.tex;
    this.bar = this.buildBar();
  }

  private mat(vert: string, frag: string, extra: Record<string, THREE.IUniform> = {}, opts: Partial<THREE.ShaderMaterialParameters> = {}) {
    return new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: { ...this.uniforms, ...extra }, ...opts });
  }

  private buildFloor() {
    const m = this.mat(
      `varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      `${COMMON}${LIGHT}
       varying vec3 vP;
       void main(){
         float g = fbm(vP.xz * 1.3), f = fbm(vP.xz * 7.0);
         vec3 albedo = vec3(0.035, 0.034, 0.033) * (0.6 + 0.8 * g) * (0.85 + 0.3 * f);
         vec3 N = normalize(vec3((f - 0.5) * 0.3, 1.0, (g - 0.5) * 0.3));
         vec3 col = ironLight(vP, N, normalize(cameraPosition - vP), albedo, 0.9);
         col *= smoothstep(26.0, 8.0, length(vP.xz));
         gl_FragColor = vec4(col, 1.0);
       }`);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70).rotateX(-Math.PI / 2), m);
    floor.position.y = -0.92;
    this.scene.add(floor);
  }

  /** One half of the mould: the engraved top (the other half discarded along a jagged seam) and its block. */
  private buildHalf(side: number) {
    const seg = this.phone ? [260, 110] : [420, 180];
    const top = new THREE.PlaneGeometry(this.mouldW, this.mouldD, seg[0], seg[1]).rotateX(-Math.PI / 2);
    const m = this.mat(
      `${COMMON}
       uniform float uDepth; varying vec3 vP; varying vec2 vXZ;
       void main(){ vec3 p = position; float d = titleDist(p.xz); p.y -= uDepth * smoothstep(0.016, -0.016, d);
         vXZ = position.xz; vec4 w = modelMatrix * vec4(p, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      `${COMMON}${LIGHT}
       uniform float uDepth, uSide, uSeamGlow; uniform vec3 uGreenEmit;
       varying vec3 vP; varying vec2 vXZ;
       float seam(float x){ return 0.11 * sin(x * 2.7) + 0.05 * sin(x * 7.9 + 1.3) + 0.025 * sin(x * 19.0); }
       float height(vec2 p){ return -uDepth * smoothstep(0.016, -0.016, titleDist(p)) + (vnoise(p * 3.0) - 0.5) * 0.006 + (vnoise(p * 60.0) - 0.5) * 0.0018; }
       void main(){
         float sd = vXZ.y - seam(vXZ.x);
         if (sd * uSide < 0.0) discard;
         float d = titleDist(vXZ), e = 0.008, h0 = height(vXZ);
         vec3 nL = normalize(vec3(-(height(vXZ + vec2(e, 0.0)) - h0) / e, 1.0, -(height(vXZ + vec2(0.0, e)) - h0) / e));
         vec3 N = normalize(mat3(modelMatrix) * nL), V = normalize(cameraPosition - vP);
         float grain = fbm(vXZ * 4.0);
         vec3 albedo = vec3(0.03, 0.031, 0.034) * (0.7 + 0.6 * grain);
         vec3 col = ironLight(vP, N, V, albedo, 0.32 + 0.25 * grain);
         // the molten metal lights the iron around it, warm, falling away from the letters
         float hb = heat(vXZ);
         if (hb >= 0.0) col += blackbody(hb) * (0.15 + 2.2 * hb * hb) * exp(-max(d, 0.0) * 7.0) * 0.32 * uExposure;
         // green cracks spreading out from the letters through the seep
         float g = seepReach();
         if (g > 0.0) {
           vec2 wp = vXZ + (vec2(fbm(vXZ * 1.4), fbm(vXZ * 1.4 + 9.0)) - 0.5) * 0.9;
           vec2 v1 = voro(wp * 2.6), v2 = voro(wp * 6.1 + 4.0);
           float crack = max(1.0 - smoothstep(0.0, 0.028, v1.y), (1.0 - smoothstep(0.0, 0.02, v2.y)) * 0.45);
           float reach = g * 0.95 - max(d, 0.0) * 1.7 - fbm(vXZ * 1.7) * 0.45;
           col += uGreenEmit * crack * smoothstep(0.0, 0.25, reach) * (0.25 + 0.65 * g);
           col += uGreenEmit * 0.025 * exp(-max(d, 0.0) * 6.0) * g;
         }
         col += uGreenEmit * exp(-abs(sd) * 90.0) * uSeamGlow * 1.1;
         gl_FragColor = vec4(col, 1.0);
       }`,
      { uDepth: { value: DEPTH }, uSide: { value: side } });
    const block = this.mat(
      `varying vec3 vP; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      `${COMMON}${LIGHT}
       varying vec3 vP; varying vec3 vN;
       void main(){ float g = fbm(vP.xy * 5.0 + vP.zz * 3.0); vec3 albedo = vec3(0.045, 0.047, 0.05) * (0.7 + 0.6 * g);
         gl_FragColor = vec4(ironLight(vP, normalize(vN), normalize(cameraPosition - vP), albedo, 0.65), 1.0); }`);
    const group = new THREE.Group();
    // the half pivots on its outer edge as it falls away
    const pivotZ = side * this.mouldD / 2;
    group.position.set(0, 0, pivotZ);
    const topMesh = new THREE.Mesh(top, m); topMesh.position.z = -pivotZ;
    const box = new THREE.Mesh(new THREE.BoxGeometry(this.mouldW, 0.9, this.mouldD / 2), block);
    box.position.set(0, -0.46, -pivotZ + side * this.mouldD / 4);
    group.add(topMesh, box);
    this.scene.add(group);
    return group;
  }

  /** The cast letters: the molten surface while it pours and cools, then the iron title that rises to stand. */
  private buildLetters() {
    const geo = new THREE.PlaneGeometry(TITLE_W, this.titleH, 1, 1).rotateX(-Math.PI / 2);
    const vert = `varying vec3 vP; varying vec2 vXZ; void main(){ vXZ = position.xz; vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
    const frag = `${COMMON}${LIGHT}
      uniform float uLayer, uEdge; uniform vec3 uGreenEmit;
      varying vec3 vP; varying vec2 vXZ;
      void main(){
        float d = titleDist(vXZ);
        float aa = fwidth(d) + 0.002;
        float inside = smoothstep(aa, -aa, d);
        if (inside < 0.02) discard;
        float h = heat(vXZ);
        if (h < 0.0 && uSplit < 0.5) discard;
        h = max(h, 0.0);
        if (uLayer > 0.5) {
          // the sides of the cast letters: dark iron, a little of the heat, the green edge
          float side = exp(-abs(d) * 150.0);
          gl_FragColor = vec4(vec3(0.012, 0.013, 0.014) + blackbody(h * 0.8) * h * h * 1.5 * uExposure + uGreenEmit * side * uEdge * 0.5, 1.0);
          return;
        }
        vec3 V = normalize(cameraPosition - vP);
        // a rounded edge: the normal leans outward near the rim so the bevel catches the light
        vec2 g2 = vec2(titleDist(vXZ + vec2(0.004, 0.0)) - d, titleDist(vXZ + vec2(0.0, 0.004)) - d) / 0.004;
        float bev = smoothstep(-0.05, 0.0, d);
        vec3 nL = vec3(g2.x * bev * 1.2, 1.0, g2.y * bev * 1.2);
        nL.xz += (vec2(fbm(vXZ * 6.0), fbm(vXZ * 6.0 + 7.0)) - 0.5) * 0.09 * (1.0 - h);
        vec3 N = normalize(mat3(modelMatrix) * normalize(nL));
        // while hot the surface flows; as it cools a crust closes over veins that stay hot longest
        vec2 fp = vXZ * 5.0 + vec2(-uTime * 1.5, 0.0);
        float fl = fbm(fp + fbm(fp * 0.5) * 1.5);
        vec2 cr = voro(vXZ * 20.0);
        float crust = smoothstep(0.85, 0.3, h), vein = 1.0 - smoothstep(0.0, 0.07, cr.y);
        float hl = h * mix(1.0, mix(0.2, 1.2, vein), crust);
        vec3 emit = blackbody(hl * 0.86) * (0.15 + 5.5 * hl * hl) * (0.75 + 0.5 * fl * step(0.55, h));
        float lead = exp(-max(uTime - fillTime(vXZ), 0.0) * 6.0);
        emit += vec3(1.0, 0.7, 0.35) * lead * 1.8 * step(-0.5, heat(vXZ));
        vec3 albedo = vec3(0.07, 0.072, 0.078);
        vec3 col = ironLight(vP, N, V, albedo, mix(0.32, 0.6, h)) * (1.0 - smoothstep(0.1, 0.5, h));
        col += emit * uExposure;
        float edge = exp(-abs(d) * 150.0) * smoothstep(0.004, -0.004, d);
        col += uGreenEmit * edge * uEdge;
        gl_FragColor = vec4(col, 1.0);
      }`;
    // the top surface and layers beneath it give the letters real thickness once they stand
    const layers = this.phone ? 14 : 26; // close enough together that the sides read as solid, not stripes
    for (let i = 0; i <= layers; i++) {
      const m = this.mat(vert, frag, { uLayer: { value: i > 0 ? 1 : 0 } });
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(0, -i * (this.phone ? 0.017 : 0.0095), -this.titleH / 2);
      mesh.renderOrder = layers - i;
      this.letters.add(mesh);
    }
    // the group's origin is the title's front edge (the pivot it stands up on)
    this.letters.position.set(0, -DEPTH * 0.2, this.titleH / 2);
    this.scene.add(this.letters);
  }

  /** The pour: a column of white-orange iron from above, wobbling and streaked as it flows. */
  private buildStream() {
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uThin: { value: 0 } },
      vertexShader: `uniform float uTime, uThin; varying vec2 vUv; varying float vF;
        void main(){ vUv = uv; vec3 p = position; float w = (0.75 + 0.25 * sin(uv.y * 30.0 - uTime * 20.0)) * uThin;
          p.xz *= w; p.x += sin(uv.y * 6.0 + uTime * 3.0) * 0.015;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz)));
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; varying float vF;
        void main(){ float s = 0.75 + 0.25 * sin(vUv.x * 40.0 + vUv.y * 80.0 - uTime * 30.0);
          vec3 c = mix(vec3(1.0, 0.42, 0.06), vec3(1.0, 0.82, 0.55), vF) * (1.5 + 1.6 * vF) * s;
          gl_FragColor = vec4(c * smoothstep(0.0, 0.08, vUv.y), 1.0); }`,
    });
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 9, 14, 40, true), m);
    s.visible = false;
    this.scene.add(s);
    return s;
  }

  /** The bar the countdown etches into: iron, its digits revealed left to right, glowing green then settling. */
  private buildBar() {
    const m = this.mat(
      `varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      `${COMMON}${LIGHT}
       uniform sampler2D uText; uniform float uEtch; uniform vec3 uGreenEmit;
       varying vec2 vUv; varying vec3 vP;
       void main(){
         float txt = texture2D(uText, vUv).r;
         float front = uEtch * 1.15 - (vnoise(vUv * vec2(40.0, 6.0)) * 0.1);
         float cut = step(vUv.x, front) * txt;
         float fresh = exp(-max(front - vUv.x, 0.0) * 14.0);
         vec3 albedo = vec3(0.022, 0.023, 0.025) * (0.7 + 0.6 * fbm(vUv * vec2(30.0, 4.0)));
         vec3 col = ironLight(vP, vec3(0.0, 0.25, 1.0), normalize(cameraPosition - vP), albedo, 0.95) * 0.6;
         float edgeFade = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x) * smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
         col *= edgeFade;
         col = mix(col, vec3(0.86, 0.84, 0.78) * 0.42 + uGreenEmit * 0.06, cut);
         col += uGreenEmit * cut * fresh * 1.6;
         gl_FragColor = vec4(col, 1.0);
       }`,
      { uText: { value: this.barTex }, uEtch: { value: 0 } });
    const w = TITLE_W * 0.62, h = w * (this.barCanvas.height / this.barCanvas.width);
    this.barH = h;
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    // just under the standing title, a little in front of it
    bar.position.set(0, Forge.STAND_Y - 0.16 - h / 2, this.titleH / 2 + 0.05);
    bar.visible = false;
    this.scene.add(bar);
    return bar;
  }

  /** Compiles every shader before the click, so nothing stalls the first time it appears (the pour, the bar). */
  prepare(renderer: THREE.WebGLRenderer) {
    const hidden = [this.stream, this.bar].filter((o) => !o.visible);
    hidden.forEach((o) => { o.visible = true; });
    renderer.compile(this.scene, this.cam);
    hidden.forEach((o) => { o.visible = false; });
  }

  /** Redraws the countdown when its numbers change. */
  setCountdown(text: string[]) {
    const key = text.join('|');
    if (key === this.lastBar) return;
    this.lastBar = key;
    drawCountdown(this.barCanvas, text);
    this.barTex.needsUpdate = true;
  }

  resize(w: number, h: number) {
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  /** The camera for this moment. A: a slow push from above; B: a low angle that rises; return: high and near. */
  private camera(t: number) {
    const T = this.timing, asp = this.cam.aspect;
    // the finished framing: square on to the standing title and the bar, fitted to the screen width
    const top = Forge.STAND_Y + this.titleH, bottom = Forge.STAND_Y - 0.16 - this.barH;
    const tan = Math.tan((this.cam.fov * Math.PI) / 360);
    const fit = Math.max((top - bottom + 1.0) / (2 * tan), (TITLE_W * 1.12) / (2 * tan * asp));
    const cy = (top + bottom) / 2, cz = this.titleH / 2;
    const endP = new THREE.Vector3(0, cy + fit * 0.08, cz + fit), endL = new THREE.Vector3(0, cy, cz);
    let p = new THREE.Vector3(), l = new THREE.Vector3();
    const pourS = span(t, T.pour[0], T.pour[1]), streamX = -TITLE_W / 2 + (pourS < 0.5 ? pourS * 2 : (pourS - 0.5) * 2) * TITLE_W;
    // tall screens cannot hold the whole mould up close: follow the pour across the letters, then pull back
    // until the whole mould fits for the seep and the crack
    if (asp < 1 && T.id !== 'return') {
      const dFit = (this.mouldW * 0.98) / (2 * Math.tan((this.cam.fov * Math.PI) / 360) * asp);
      const back = smooth(span(t, T.pour[1] - 0.2, T.seep[0] + 0.5));
      const fx = streamX * (1 - smooth(span(t, T.pour[1], T.pour[1] + 0.8))) * (t > T.pour[0] ? 1 : 0.4);
      if (T.id === 'b') {
        const near = dFit * 0.5;
        p.set(fx - 2.0 * (1 - back), 1.8 + (1 - back) * near * 0.35 + back * dFit * 0.72, 3.6 + (1 - back) * near * 0.55 + back * dFit * 0.55);
        l.set(fx * (1 - back) + 0.6 * (1 - back), -0.25, -0.1);
      } else {
        const near = dFit * 0.55;
        p.set(fx * 0.85, near + back * (dFit - near), near * 0.42 + back * 1.4); // tilted a little, so an overhead view never rolls
        l.set(fx, 0, 0.1);
      }
    } else if (T.id === 'b') {
      p.set(-6.2 + span(t, 0, T.seep[1]) * 7.5, 2.1 + span(t, 0, T.seep[1]) * 0.8, 6.4 - span(t, 0, T.seep[1]) * 1.2);
      l.set(-1.6 + span(t, 0, T.seep[1]) * 2.4, -0.2, -0.2);
    } else if (T.id === 'return') {
      p.set(0, 7.2, 6.4); l.set(0, -0.2, 0);
    } else {
      const k = smooth(span(t, -0.5, T.seep[1]));
      p.set(streamX * 0.12 * span(t, T.pour[0], T.pour[1] + 1), 10.5 - k * 3.3, 4.2 - k * 0.9);
      l.set(streamX * 0.08 * span(t, T.pour[0], T.pour[1] + 1), 0, 0.25);
    }
    // from the crack, rise and swing square on to the title
    const m = smooth(span(t, T.crack, T.stand[1] + 0.25));
    p.lerp(endP, m); l.lerp(endL, m);
    // after it settles, a very slow push, so it is never quite still
    const after = Math.max(0, t - T.total);
    p.z -= Math.min(after * 0.05, 0.6); p.y += Math.sin(after * 0.35) * 0.04;
    return { p, l };
  }

  update(t: number, dt: number) {
    const T = this.timing, u = this.uniforms;
    this.t = t;
    u.uTime.value = t;
    // light: the furnace comes up with the rumble and flickers; the scene stays dark at the gate
    const live = t < 0 ? 0 : smooth(span(t, 0, T.rumble[1]));
    u.uExposure.value = 0.04 + 0.96 * live;
    const flick = 0.82 + 0.18 * Math.sin(t * 9.1) * Math.sin(t * 4.3 + 1.0);
    u.uFurnCol.value.setRGB(1.15, 0.38, 0.1).multiplyScalar(live * flick * (1 - 0.6 * span(t, T.crack, T.total)));
    // the molten glow: how much hot metal there is, and how hot
    let heat = 0, filled = 0;
    for (let i = 0; i < 24; i++) {
      const s = (i + 0.5) / 24, tf = T.pour[0] + s * (T.pour[1] - T.pour[0]);
      if (t >= tf) { filled++; heat += clamp01(1 - (t - tf - 0.12) / T.coolDur); }
    }
    heat = filled ? heat / 24 : 0;
    const bb = new THREE.Color().setRGB(1, 0.3 + 0.45 * heat, 0.05 + 0.2 * heat);
    u.uGlowCol.value.copy(bb).multiplyScalar(heat * 9);
    // the green: through the seep, a flash at the crack, then a steady glow on the title
    const seep = span(t, T.seep[0], T.seep[1]), after = span(t, T.crack, T.total);
    u.uGreenCol.value.copy(GREEN).multiplyScalar(seep * 0.9 + Math.exp(-Math.max(0, t - T.crack) * 3) * 2.4 * (t > T.crack ? 1 : 0) + after * 0.4);
    u.uSeamGlow.value = t < T.crack ? span(t, T.seep[1] - 0.3, T.crack) : Math.exp(-(t - T.crack) * 5);
    u.uEdge.value = (seep * 0.5 + after * 0.45) * (t > T.total ? 0.85 + 0.15 * Math.sin(t * 1.4) : 1);
    u.uSplit.value = t >= T.crack ? 1 : 0;
    // the split: each half tips away on its outer edge and drops into the dark
    const sp = span(t, T.crack, T.crack + 1.1), fall = sp * sp;
    this.halves.forEach((g, i) => {
      const side = i === 0 ? 1 : -1;
      g.rotation.x = side * fall * 1.25;
      g.position.y = -fall * 2.4;
      g.position.z = side * (this.mouldD / 2 + fall * 1.6);
      g.visible = sp < 1;
    });
    // the title rises to stand on its front edge, lifted clear of the floor
    const st = smooth(span(t, T.stand[0], T.stand[1]));
    // as the title stands the cool key swings round to its face, and the green drops low in front of it
    const toFront = smooth(span(t, T.crack, T.stand[1]));
    u.uKeyDir.value.set(-0.45 - 0.15 * toFront, 0.85 - 0.4 * toFront, -0.35 + 1.1 * toFront);
    u.uKeyCol.value.setRGB(0.1 + 0.12 * toFront, 0.115 + 0.13 * toFront, 0.14 + 0.15 * toFront);
    u.uGreenPos.value.set(0, 1.0 + 0.6 * toFront, this.titleH / 2 * toFront - 0.8 * toFront); // behind and below the standing title: a rim, not a spotlight
    this.letters.rotation.x = st * Math.PI / 2;
    this.letters.position.y = -DEPTH * 0.2 + st * (Forge.STAND_Y + DEPTH * 0.2);
    // the countdown bar etches in under it
    this.bar.visible = t >= T.etch[0] - 0.05;
    (this.bar.material as THREE.ShaderMaterial).uniforms.uEtch.value = span(t, T.etch[0], T.etch[1]);
    // the pour column follows the fill along each line, lifting between them
    const pourS = span(t, T.pour[0], T.pour[1]), pouring = t > T.pour[0] && t < T.pour[1];
    const lineGap = Math.abs(pourS - 0.5) < 0.025;
    const sx = -TITLE_W / 2 + (pourS < 0.5 ? pourS * 2 : (pourS - 0.5) * 2) * TITLE_W, sz = -this.titleH / 2 + this.titleH * (pourS < 0.5 ? 0.28 : 0.74);
    this.stream.visible = pouring && !lineGap;
    this.stream.position.set(sx, 4.5 - DEPTH * 0.3, sz);
    const sm = this.stream.material as THREE.ShaderMaterial;
    sm.uniforms.uTime.value = t; sm.uniforms.uThin.value = Math.min(1, span(t, T.pour[0], T.pour[0] + 0.15) * 4) * (1 - span(t, T.pour[1] - 0.12, T.pour[1]));
    // sparks where the iron lands; embers drifting up; smoke off the cooling metal
    if (this.stream.visible) this.sparks.emit(dt * (this.phone ? 90 : 170), sx, 0, sz, 1);
    if (t >= T.crack && t < T.crack + 0.12) this.sparks.emit(dt * 900, 0, 0, 0, 2.2);
    this.sparks.update(dt, -9.8);
    this.embers.emit(dt * (t < 0 ? 2 : 10), (Math.random() - 0.5) * 9, -0.5, (Math.random() - 0.5) * 4, 0.25);
    this.embers.update(dt, 0.6);
    this.smoke.update(dt, heat > 0.05 ? heat : 0, t);
    // the gate's single ember
    const em = this.ember.material as THREE.MeshBasicMaterial;
    const gateFade = t < 0 ? 1 : 1 - span(t, 0, 1.2);
    em.color.setRGB(4, 1.1, 0.2).multiplyScalar((0.55 + 0.45 * Math.sin(performance.now() * 0.004) * Math.sin(performance.now() * 0.0017 + 1)) * gateFade);
    this.ember.visible = gateFade > 0.01;
    // camera, with a jolt at the crack
    const { p, l } = this.camera(Math.max(t, 0));
    if (t >= T.crack && t < T.crack + 0.05) this.shake = T.id === 'b' ? 0.22 : 0.1;
    this.shake *= Math.exp(-dt * 7);
    p.x += (Math.random() - 0.5) * this.shake; p.y += (Math.random() - 0.5) * this.shake;
    this.cam.position.copy(p); this.cam.lookAt(l);
  }
}

/** Four octaves of periodic value noise, 16 cells across, tiling: the forge's fbm in one texture lookup. */
function noiseTexture() {
  const N = 256, CELLS = 16, data = new Uint8Array(N * N);
  const lattice = (period: number) => { const v = new Float32Array(period * period); for (let i = 0; i < v.length; i++) v[i] = Math.random(); return v; };
  const octaves = [0, 1, 2, 3].map((k) => ({ period: CELLS << k, v: lattice(CELLS << k), amp: 0.5 / (1 << k) }));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let sum = 0;
    for (const o of octaves) {
      const fx = (x / N) * o.period, fy = (y / N) * o.period, ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy, ux = tx * tx * (3 - 2 * tx), uy = ty * ty * (3 - 2 * ty);
      const at = (i: number, j: number) => o.v[((j % o.period) * o.period) + (i % o.period)];
      const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
      sum += o.amp * (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy);
    }
    data[y * N + x] = Math.round(Math.min(1, sum) * 255);
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

/** Points that live and die: sparks (fast, falling, cooling from white to red) or embers (slow, rising). */
class Sparks {
  points: THREE.Points;
  private pos: Float32Array; private vel: Float32Array; private life: Float32Array; private heat: Float32Array;
  private next = 0; private acc = 0;
  constructor(private n: number, size: number, private fast: boolean) {
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.heat = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aHeat', new THREE.BufferAttribute(this.heat, 1));
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uSize: { value: size }, uPx: { value: 800 } },
      vertexShader: `attribute float aHeat; uniform float uSize, uPx; varying float vH;
        void main(){ vH = aHeat; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * uSize * (0.4 + aHeat) / -mv.z; }`,
      fragmentShader: `varying float vH;
        void main(){ float d = length(gl_PointCoord - 0.5); if (vH <= 0.0) discard;
          vec3 c = mix(vec3(0.9, 0.12, 0.02), vec3(1.0, 0.85, 0.5), vH) * (1.0 + 5.0 * vH);
          gl_FragColor = vec4(c * smoothstep(0.5, 0.0, d), 1.0); }`,
    }));
    this.points.frustumCulled = false;
  }
  emit(count: number, x: number, y: number, z: number, power: number) {
    this.acc += count;
    while (this.acc >= 1) {
      this.acc--;
      const i = this.next; this.next = (this.next + 1) % this.n;
      this.pos[i * 3] = x + (Math.random() - 0.5) * 0.1; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.1;
      const a = Math.random() * Math.PI * 2, r = Math.random();
      if (this.fast) { this.vel[i * 3] = Math.cos(a) * r * 2.4 * power; this.vel[i * 3 + 1] = (1.5 + Math.random() * 3.5) * power; this.vel[i * 3 + 2] = Math.sin(a) * r * 2.4 * power; }
      else { this.vel[i * 3] = (Math.random() - 0.5) * 0.2; this.vel[i * 3 + 1] = 0.3 + Math.random() * 0.5; this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.2; }
      this.life[i] = this.fast ? 0.5 + Math.random() * 0.8 : 3 + Math.random() * 4;
      this.heat[i] = 1;
    }
  }
  update(dt: number, gravity: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.heat[i] <= 0) continue;
      this.vel[i * 3 + 1] += gravity * dt * (this.fast ? 1 : 0.05);
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.fast && this.pos[i * 3 + 1] < -0.9) { this.pos[i * 3 + 1] = -0.9; this.vel[i * 3 + 1] *= -0.3; this.vel[i * 3] *= 0.5; this.vel[i * 3 + 2] *= 0.5; }
      if (!this.fast) this.pos[i * 3] += Math.sin(this.pos[i * 3 + 1] * 2 + i) * 0.003;
      this.life[i] -= dt;
      this.heat[i] = this.life[i] <= 0 ? 0 : Math.min(1, this.life[i] / (this.fast ? 0.9 : 3)) * (this.fast ? 1 : 0.35);
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.aHeat as THREE.BufferAttribute).needsUpdate = true;
  }
  setPx(px: number) { (this.points.material as THREE.ShaderMaterial).uniforms.uPx.value = px; }
}

/** Smoke off the hot metal: large soft puffs rising and spreading, lit warm from below. */
class Smoke {
  points: THREE.Points;
  private pos: Float32Array; private age: Float32Array; private alpha: Float32Array;
  constructor(private n: number) {
    this.pos = new Float32Array(n * 3); this.age = new Float32Array(n); this.alpha = new Float32Array(n);
    for (let i = 0; i < n; i++) this.respawn(i, Math.random() * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aA', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aAge', new THREE.BufferAttribute(this.age, 1));
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uPx: { value: 800 }, uT: { value: 0 } },
      vertexShader: `attribute float aA, aAge; uniform float uPx; varying float vA; varying float vAge;
        void main(){ vA = aA; vAge = aAge; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (0.6 + aAge * 0.5) / -mv.z; }`,
      fragmentShader: `uniform float uT; varying float vA; varying float vAge;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
        void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); float w = n(q * 5.0 + vAge * 0.7 + uT * 0.2);
          float a = smoothstep(0.5, 0.1, d) * (0.55 + 0.45 * w) * vA;
          vec3 c = mix(vec3(0.16, 0.08, 0.05), vec3(0.06, 0.06, 0.07), clamp(vAge * 0.35, 0.0, 1.0));
          gl_FragColor = vec4(c, a * 0.32); }`,
    }));
    this.points.frustumCulled = false;
  }
  private respawn(i: number, age = 0) {
    this.pos[i * 3] = (Math.random() - 0.5) * TITLE_W * 0.9; this.pos[i * 3 + 1] = 0.05; this.pos[i * 3 + 2] = (Math.random() - 0.5) * 2.5; this.age[i] = age;
  }
  update(dt: number, strength: number, t: number) {
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      this.pos[i * 3 + 1] += dt * 0.55; this.pos[i * 3] += Math.sin(this.age[i] + i) * dt * 0.08;
      if (this.age[i] > 4) this.respawn(i);
      this.alpha[i] += ((strength > 0 ? Math.min(1, strength * 2) * Math.sin(Math.min(1, this.age[i] / 4) * Math.PI) : 0) - this.alpha[i]) * (1 - Math.exp(-dt * 2));
    }
    const g = this.points.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true; (g.attributes.aA as THREE.BufferAttribute).needsUpdate = true; (g.attributes.aAge as THREE.BufferAttribute).needsUpdate = true;
    (this.points.material as THREE.ShaderMaterial).uniforms.uT.value = t;
  }
  setPx(px: number) { (this.points.material as THREE.ShaderMaterial).uniforms.uPx.value = px; }
}

/** The countdown's canvas: four groups of Courier Prime digits with their labels, white on black (a mask). */
function countdownBar() {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 220;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.NoColorSpace;
  return { canvas, tex };
}
function drawCountdown(cv: HTMLCanvasElement, text: string[]) {
  const g = cv.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#fff'; g.textAlign = 'center';
  const labels = ['DAYS', 'HRS', 'MIN', 'SEC'];
  text.forEach((v, i) => {
    const x = (cv.width / 4) * (i + 0.5);
    g.font = "700 118px 'Courier Prime', monospace"; g.textBaseline = 'alphabetic'; g.fillText(v, x, 128);
    g.font = "400 30px 'Courier Prime', monospace"; g.fillText(labels[i].split('').join(String.fromCharCode(8202)), x, 186);
  });
}

export function setPointScale(f: Forge, px: number) {
  (f as any).sparks.setPx(px); (f as any).embers.setPx(px); (f as any).smoke.setPx(px * 2.2);
}
