/**
 * The home page after the forge (CLAUDE.md, fifth interview: "through the mask"). One continuous camera:
 *
 * 1. As the title settles, Doom's masked face (the user's photo 1, graded into iron and green, given real depth
 *    from its depth map) emerges from the dark behind it: Doom watching.
 * 2. Scrolling pulls back to show the mask looming over the title, then pushes into its left eye slit until
 *    green floods the screen (FF Annual #2: the mask; his green sorcery).
 * 3. Out of the green: the archive, the 29 files under his gaze. Two versions to choose between:
 *    1, the hall: the files hang in a long dark hall, the camera walking slowly down it, each print turning to
 *       face you as you reach it, Doom's green eyes at the far end;
 *    2, the drawer: one file at a time, full screen, each pulled up from below like a print from a drawer and
 *       pushed in on slowly; faster.
 * Photos are full high-resolution prints graded into the palette, never particles.
 */
import * as THREE from 'three';
import { gsap } from 'gsap';
import type { ForgeExtension, ForgeKit } from '../forge/run';
import { fileArrive, floodRise } from '../sound/home';

export type HomeFile = { slug: string; no: number; name: string; team: string; accent: string; href: string; photo: string; aspect: number };
export type HomeOpts = { version: 1 | 2; files: HomeFile[]; mask: { photo: string; depth: string; eye: [number, number] }; ui: HomeUi; scrollY: () => number; vh: () => number };
export type HomeUi = { file: HTMLElement; no: HTMLElement; name: HTMLAnchorElement; team: HTMLElement; open: HTMLAnchorElement; cue: HTMLElement; flood: HTMLElement };

/** Scroll lengths, in screen heights: the mask passage, then each file. */
export const LENGTHS = { mask: 2.2, perFile: { 1: 0.75, 2: 0.48 } as Record<number, number> };

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const span = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(0.0001, b - a));

/** Grading into iron and green: shadows to gunmetal, a green cast through the mids, highlights to bone, a
 *  quarter of the original colour kept. Done on display values, returned linear for the renderer. */
const GRADE = /* glsl */ `
  vec3 grade(vec3 c, float keep){
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 lo = vec3(0.03, 0.04, 0.045), mid = vec3(0.17, 0.25, 0.21), hi = vec3(0.92, 0.9, 0.84);
    vec3 g = mix(mix(lo, mid, smoothstep(0.0, 0.5, l)), hi, smoothstep(0.42, 1.0, l));
    return pow(mix(g, c, keep), vec3(2.2));
  }`;

async function bitmapTex(src: string) {
  const blob = await fetch(src).then((r) => r.blob());
  const bmp = await createImageBitmap(blob, { imageOrientation: 'flipY' });
  const t = new THREE.Texture(bmp as unknown as HTMLImageElement);
  t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

/** A graded print: the photo on a plane, lit, faded at its edges into the dark, dimmed until it is the one in front. */
function printMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: null }, uLit: { value: 0 }, uAlpha: { value: 0 }, uKeep: { value: 0.2 } },
    transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${GRADE}
      uniform sampler2D uMap; uniform float uLit, uAlpha, uKeep; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(uMap, vUv).rgb;
        vec3 g = grade(c, uKeep);
        // a soft print edge and a falloff toward the corners, like a photo under one light
        vec2 e = min(vUv, 1.0 - vUv);
        float edge = smoothstep(0.0, 0.02, min(e.x, e.y));
        float vig = 1.0 - 0.45 * pow(length((vUv - 0.5) * vec2(1.1, 1.3)), 2.0);
        gl_FragColor = vec4(g * vig * (0.14 + 0.86 * uLit), uAlpha * edge);
      }`,
  });
}

export function homeExtension(opts: HomeOpts) {
  return async (kit: ForgeKit): Promise<ForgeExtension> => {
    const { forge, sound, timing, phone } = kit;
    const scene = forge.scene, cam = forge.cam;
    const N = opts.files.length;

    // the mask: the photo as a relief, far behind the title
    const [maskTex, maskDepth] = await Promise.all([bitmapTex(opts.mask.photo), bitmapTex(opts.mask.depth)]);
    const W = 19, H = W * 9 / 16, MZ = -12, MY = 6.0, AMP = 2.4;
    const maskMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: maskTex }, uDepth: { value: maskDepth }, uVis: { value: 0 }, uAmp: { value: AMP }, uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 576) }, uEye: { value: new THREE.Vector2(opts.mask.eye[0], 1 - opts.mask.eye[1]) }, uGlow: { value: 0 } },
      vertexShader: `uniform sampler2D uDepth; uniform float uAmp; varying vec2 vUv;
        void main(){ vUv = uv; vec3 p = position; p.z += (texture2D(uDepth, uv).r - 0.35) * uAmp; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `${GRADE}
        uniform sampler2D uMap, uDepth; uniform float uVis, uGlow; uniform vec2 uTexel, uEye; varying vec2 vUv;
        void main(){
          vec3 c = grade(texture2D(uMap, vUv).rgb, 0.35);
          float dx = texture2D(uDepth, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uDepth, vUv - vec2(uTexel.x, 0.0)).r;
          float dy = texture2D(uDepth, vUv + vec2(0.0, uTexel.y)).r - texture2D(uDepth, vUv - vec2(0.0, uTexel.y)).r;
          vec3 n = normalize(vec3(-dx * 14.0, -dy * 14.0, 1.0));
          float lam = 0.6 + 0.6 * max(dot(n, normalize(vec3(-0.4, 0.6, 0.7))), 0.0);
          float vig = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
          // green burning in the eye slits, stronger as the camera nears them
          // slits, wider than tall, with a soft halo; the bloom does the rest
          vec2 d = (vUv - uEye) * vec2(1.78, 1.0), d2 = d - vec2(0.117, 0.0);
          vec2 k = vec2(2600.0, 16000.0);
          float eyes = exp(-dot(d * d, k)) + exp(-dot(d2 * d2, k));
          float halo = exp(-dot(d * d, k * 0.08)) + exp(-dot(d2 * d2, k * 0.08));
          vec3 col = c * lam * vig * uVis + vec3(0.12, 1.0, 0.48) * (eyes * (0.6 + 1.4 * uGlow) + halo * 0.12 * uGlow) * uVis;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const mask = new THREE.Mesh(new THREE.PlaneGeometry(W, H, phone ? 110 : 190, phone ? 62 : 107), maskMat);
    mask.position.set(0, MY, MZ);
    mask.renderOrder = -1;
    scene.add(mask);
    // where the left eye slit is in the world, including the relief there
    const dcv = document.createElement('canvas'); dcv.width = (maskDepth.image as ImageBitmap).width; dcv.height = (maskDepth.image as ImageBitmap).height;
    const dg = dcv.getContext('2d')!; dg.drawImage(maskDepth.image as ImageBitmap, 0, 0);
    const [ex, ey] = opts.mask.eye;
    const dEye = dg.getImageData(Math.round(ex * dcv.width), Math.round((1 - ey) * dcv.height), 1, 1).data[0] / 255;
    const eye = new THREE.Vector3((ex - 0.5) * W, MY + (0.5 - ey) * H, MZ + (dEye - 0.35) * AMP);

    // the green flood: a full-screen layer over the canvas (the bitmap is flipped, so rows run bottom-up)
    const flood = (v: number) => { opts.ui.flood.style.opacity = v.toFixed(3); };

    // the archive, far from the forge
    const X0 = 400;
    const prints: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; tex: THREE.Texture | null; loading: boolean; base: THREE.Vector3; side: number }[] = [];
    const hallStep = 6.2;
    const eyesGlow = new THREE.Group();
    if (opts.version === 1) {
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, N * hallStep + 60).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: `varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `varying vec3 vP; void main(){ float lines = smoothstep(0.02, 0.0, abs(fract(vP.z * 0.25) - 0.5) - 0.48); float side = smoothstep(4.0, 0.5, abs(vP.x - ${X0.toFixed(1)}));
          gl_FragColor = vec4(vec3(0.012, 0.016, 0.016) * side + vec3(0.05, 0.4, 0.2) * lines * 0.05 * side, 1.0); }`,
      }));
      floor.position.set(X0, 0, -(N * hallStep) / 2 + 10);
      scene.add(floor);
      // Doom's eyes at the end of the hall, watching
      for (const sx of [-0.42, 0.42]) {
        const e = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 4, 1.8), transparent: true, opacity: 0.9, toneMapped: false }));
        e.position.set(X0 + sx, 3.2, -N * hallStep - 14); eyesGlow.add(e);
      }
      scene.add(eyesGlow);
    }
    opts.files.forEach((f, i) => {
      const mat = printMaterial();
      const h = opts.version === 1 ? 2.5 : 3.2, w = h * f.aspect;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      const side = i % 2 === 0 ? -1 : 1;
      const base = opts.version === 1 ? new THREE.Vector3(X0 + side * 2.2, 1.75, -i * hallStep) : new THREE.Vector3(X0 + 100, 0, 0);
      mesh.position.copy(base);
      if (opts.version === 1) mesh.rotation.y = -side * 0.55;
      mesh.visible = false;
      scene.add(mesh);
      prints.push({ mesh, mat, tex: null, loading: false, base, side });
    });
    // textures load near the file in front and are let go far from it, so the GPU never holds all 29
    const keep = (i: number) => {
      prints.forEach((p, k) => {
        const near = Math.abs(k - i) <= 3;
        if (near && !p.tex && !p.loading) {
          p.loading = true;
          bitmapTex(opts.files[k].photo).then((t) => { p.tex = t; p.mat.uniforms.uMap.value = t; kit.renderer.initTexture(t); p.loading = false; }).catch(() => { p.loading = false; });
        } else if (!near && Math.abs(k - i) > 6 && p.tex) { p.tex.dispose(); (p.tex.image as ImageBitmap).close?.(); p.tex = null; p.mat.uniforms.uMap.value = null; }
      });
    };
    keep(0);

    // the file's words, bottom-left in front: number, name typed in, team, the way in
    let shown = -1;
    const showFile = (i: number) => {
      if (i === shown) return;
      const dir = i > shown ? 1 : -1;
      shown = i;
      const ui = opts.ui;
      if (i < 0) { gsap.to(ui.file, { autoAlpha: 0, duration: 0.4, overwrite: true }); return; }
      const f = opts.files[i];
      ui.file.style.setProperty('--a', f.accent);
      ui.no.textContent = `File ${String(f.no).padStart(2, '0')} / ${N}`;
      ui.team.textContent = f.team;
      ui.name.href = f.href; ui.open.href = f.href;
      ui.name.innerHTML = f.name.split(' ').map((w) => `<span class="w">${[...w].map((ch) => `<span class="c">${ch}</span>`).join('')}</span>`).join(' ');
      gsap.to(ui.file, { autoAlpha: 1, duration: 0.3, overwrite: true });
      gsap.fromTo(ui.name.querySelectorAll('.c'), { yPercent: 100 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, stagger: 0.028, ease: 'expo.out', overwrite: true });
      gsap.fromTo([ui.no, ui.team, ui.open], { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.06, ease: 'expo.out', delay: 0.12, overwrite: true });
      if (sound.ctx.state === 'running') fileArrive(sound);
      keep(i);
      if (opts.version === 2) {
        // the drawer: the new print rises from below and settles; the last one sinks back and dims
        prints.forEach((p, k) => { if (k !== i && k !== i - dir) p.mesh.visible = false; });
        const n = prints[i], o = prints[i - dir];
        n.mesh.visible = true;
        gsap.fromTo(n.mesh.position, { y: -3.6 * dir }, { y: 0, duration: 1.0, ease: 'power4.out', overwrite: true });
        gsap.fromTo(n.mat.uniforms.uAlpha, { value: 0 }, { value: 1, duration: 0.5, overwrite: true });
        if (o) {
          gsap.to(o.mesh.position, { y: 1.2 * dir, duration: 0.9, ease: 'power3.inOut', overwrite: true });
          gsap.to(o.mat.uniforms.uAlpha, { value: 0, duration: 0.7, ease: 'power2.in', overwrite: true, onComplete: () => { if (shown !== i - dir) o.mesh.visible = false; } });
        }
      }
    };

    // the camera's resting pose at the end of the forge, read once scrolling starts
    let restPos: THREE.Vector3 | null = null, restLook: THREE.Vector3 | null = null;
    let flooded = false, lookSide = 1;
    const look = new THREE.Vector3(), tmp = new THREE.Vector3();
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);

    return {
      resize() { /* the forge resizes the camera */ },
      update(t, dt) {
        const vh = opts.vh(), y = opts.scrollY();
        const m = clamp01(y / (LENGTHS.mask * vh));
        const per = LENGTHS.perFile[opts.version] * vh;
        const a = Math.max(0, (y - LENGTHS.mask * vh) / per); // files passed in the archive
        // Doom watching: the mask emerges behind the settling title
        const watch = smooth(span(t, timing.total - 0.6, timing.total + 2.2));
        maskMat.uniforms.uVis.value = 0.42 * watch + 0.58 * smooth(span(m, 0.05, 0.45));
        maskMat.uniforms.uGlow.value = smooth(span(m, 0.45, 0.85));
        opts.ui.cue.style.opacity = String(t > timing.total + 0.6 && y < vh * 0.05 ? 1 : 0);

        if (y <= 1) { restPos = null; showFile(-1); flood(0); flooded = false; mask.visible = maskMat.uniforms.uVis.value > 0.002; if (cam.fov !== 32) { cam.fov = 32; cam.updateProjectionMatrix(); } return; }
        if (!restPos) { restPos = cam.position.clone(); restLook = cam.getWorldDirection(tmp).multiplyScalar(10).add(cam.position.clone()); }
        if (a <= 0) {
          // the passage: pull back to show the mask over the title, then into the left eye slit
          curve.points[0].copy(restPos);
          curve.points[1].set(0, 6.6, 13.5);
          curve.points[2].copy(eye).add(new THREE.Vector3(0.6, 0.25, 4.5));
          curve.points[3].copy(eye).add(new THREE.Vector3(0, 0, 0.12));
          const e = smooth(m);
          cam.position.copy(curve.getPointAt(e));
          const l1 = new THREE.Vector3(0, 4.4, -8);
          if (m < 0.35) look.lerpVectors(restLook!, l1, smooth(m / 0.35));
          else look.lerpVectors(l1, eye.clone().add(new THREE.Vector3(0, 0, -3)), smooth((m - 0.35) / 0.65));
          cam.lookAt(look);
          cam.fov = 32 - 10 * smooth(span(m, 0.4, 1)); cam.updateProjectionMatrix();
          // green floods in through the slit
          flood(smooth(span(m, 0.8, 1.0)));
          if (m > 0.72 && !flooded) { flooded = true; if (sound.ctx.state === 'running') floodRise(sound, 1.6); }
          if (m < 0.6) flooded = false;
          mask.visible = true; prints.forEach((p) => { if (opts.version === 1) p.mesh.visible = false; });
          showFile(-1);
          return;
        }
        // the archive: out of the green
        mask.visible = false;
        flood(1 - smooth(span(a, 0, 0.45)));
        cam.fov = 34; cam.updateProjectionMatrix();
        const k = Math.min(N - 1, Math.floor(a)), f = a - k;
        const at = Math.min(N - 1, Math.round(a));
        showFile(at);
        if (opts.version === 1) {
          // the hall: walk on, the camera turning toward the print you are reaching; it turns to face you
          const z = -a * hallStep + 6;
          // turn toward the side of the print you are reaching, eased so the head never snaps
          lookSide += (prints[at].side - lookSide) * (1 - Math.exp(-dt * 2.5));
          cam.position.set(X0 + Math.sin(t * 0.3) * 0.05, 1.75 + Math.sin(t * 0.4) * 0.03, z);
          look.set(X0 + lookSide * 1.1, 1.75, z - 5);
          cam.lookAt(look);
          prints.forEach((p, i) => {
            const d = Math.abs(i - a);
            p.mesh.visible = d < 4.5;
            const lit = smooth(clamp01(1 - d * 1.1));
            p.mat.uniforms.uLit.value += (lit - p.mat.uniforms.uLit.value) * (1 - Math.exp(-dt * 6));
            p.mat.uniforms.uAlpha.value = smooth(clamp01(1.2 - d * 0.25));
            p.mesh.rotation.y = -p.side * 0.55 * (1 - lit * 0.75);
            p.mesh.position.x = p.base.x - p.side * lit * 0.5;
          });
          eyesGlow.children.forEach((e, i) => { ((e as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.65 + 0.3 * Math.sin(t * 1.3 + i); });
        } else {
          // the drawer: a fixed view; the print in front pushes in slowly through its stretch of scroll
          const cur = prints[shown] ?? prints[0];
          const asp = cam.aspect, hh = 3.2, ww = hh * opts.files[shown >= 0 ? shown : 0].aspect;
          const dist = Math.max(hh / (2 * Math.tan((cam.fov * Math.PI) / 360)), ww / (2 * Math.tan((cam.fov * Math.PI) / 360) * asp)) * (phone ? 0.62 : 0.9);
          cam.position.set(X0 + 100, phone ? 0.25 : 0, dist);
          cam.lookAt(X0 + 100, phone ? 0.25 : 0, 0);
          cur.mesh.scale.setScalar(1 + 0.07 * smooth(f));
          cur.mat.uniforms.uLit.value = 1;
        }
      },
    };
  };
}

