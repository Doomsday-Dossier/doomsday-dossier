/**
 * Battleworld (Secret Wars, 2015: Doom gathers the fragments of dead universes into one patchwork world and rules
 * it as God Emperor from Doomstadt). The home page's planet: 29 glass shards, one per target, each a domain with the
 * target's photo trapped in it, grouped by team into continents, with Doomstadt (Doom's own shard) at the north
 * pole. A green core glows through the cracks. The shards fly in from space and lock together (the world being
 * made), the planet turns under the throne, a shard lifts and warms into colour under the pointer, and choosing one
 * turns it to face the visitor and dives into it.
 *
 * One merged mesh (one draw call) built at load: an icosphere split into spherical Voronoi cells, each cell shrunk
 * so the cracks show and given walls down to the core. Lift and assembly are done in the vertex shader per shard.
 */
import * as THREE from 'three';
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js';

export type World = { slug: string; name: string; team: string; teamId: string; face: { src: string; head: [number, number]; aspect: number } };
type Opts = { onHover?: (i: number | null, at: { x: number; y: number } | null) => void; onPick?: (i: number) => void; reduced: boolean };

const N = 30; // shader array size (29 targets)
const COLS = 6, CELL = 256;

/** A small seeded random, so the world is the same on every visit. */
const rand = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/**
 * Seeds on the sphere: Doomstadt at the north pole, each team a continent. A patchwork, not a ball: the seeds are
 * thrown hard round their continent, each pushes with its own strength, and they are only lightly relaxed, so the
 * domains come out in very different sizes and the continents bunch (Secret Wars, 2015: a world stitched from the
 * fragments of dead universes, never a tidy globe).
 */
function seeds(list: World[]) {
  const r = rand(66);
  const teams = [...new Set(list.map((w) => w.teamId))].filter((t) => t !== 'adversary');
  const centre: Record<string, THREE.Vector3> = { adversary: new THREE.Vector3(0, 1, 0) };
  teams.forEach((t, i) => { const lon = (i / teams.length) * Math.PI * 2 + (r() - 0.5) * 0.5, lat = (i % 2 ? -0.35 : 0.3) + (r() - 0.5) * 0.4; centre[t] = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)); });
  const pts = list.map((w) => (w.teamId === 'adversary' ? new THREE.Vector3(0, 1, 0) : centre[w.teamId].clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9)).normalize()));
  // Doomstadt pushes hardest, so the capital is the largest domain; every other domain has its own reach
  const reach = list.map((w) => (w.teamId === 'adversary' ? 2.6 : 0.45 + r() * 1.7));
  for (let it = 0; it < 26; it++) {
    const f = pts.map(() => new THREE.Vector3());
    for (let i = 0; i < pts.length; i++) for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const d = pts[i].clone().sub(pts[j]), l = d.length() + 1e-3;
      f[i].add(d.multiplyScalar((reach[j] * 0.011) / (l * l)));
    }
    pts.forEach((p, i) => {
      if (list[i].teamId === 'adversary') return;
      p.add(f[i]).add(centre[list[i].teamId].clone().sub(p).multiplyScalar(0.035)).normalize();
    });
  }
  return pts;
}

/** A repeatable 0 to 1 hash, for the jagged rims. */
const hash = (a: number, b: number, c: number) => { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return x - Math.floor(x); };

/**
 * The domains as true spherical Voronoi cells: the seeds' convex hull is their Delaunay triangulation on the sphere,
 * and each hull face's normal is a cell corner. Each cell is fanned from its centre and subdivided so it follows the
 * sphere, pulled in toward its centre so the cracks show, and given walls down to the core.
 */
function buildGeometry(list: World[]) {
  const S = seeds(list);
  const hull = new ConvexHull().setFromPoints(S);
  const corners: { v: THREE.Vector3; seeds: number[] }[] = [];
  for (const f of hull.faces) {
    const ids: number[] = []; let e = f.edge;
    do { ids.push(S.indexOf(e.head().point)); e = e.next; } while (e !== f.edge);
    corners.push({ v: f.normal.clone().normalize(), seeds: ids });
  }
  // each cell's corners, in order around its seed
  const poly = S.map((sd, i) => {
    const vs = corners.filter((c) => c.seeds.includes(i)).map((c) => c.v);
    const up = Math.abs(sd.y) > 0.98 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const t1 = new THREE.Vector3().crossVectors(up, sd).normalize(), t2 = new THREE.Vector3().crossVectors(sd, t1);
    return vs.sort((p, q) => Math.atan2(p.dot(t2), p.dot(t1)) - Math.atan2(q.dot(t2), q.dot(t1)));
  });
  const centre = poly.map((vs) => vs.reduce((a, v) => a.add(v), new THREE.Vector3()).normalize());
  const radius = poly.map((vs, i) => Math.max(...vs.map((v) => v.angleTo(centre[i]))));
  // heights differ, and a few domains stand well proud of the surface, so the outline breaks like broken ground
  const top = list.map((w, i) => (w.teamId === 'adversary' ? 1.08 : 1 + ((i * 37) % 9) * 0.006 + (i % 6 === 2 ? 0.05 : 0)));
  // each domain shrinks back by its own amount, so the cracks between them are of uneven width
  const shrink = list.map((_, i) => 0.9 + ((i * 53) % 7) * 0.011);
  const CORE = 0.84, K = 7;
  const frame = centre.map((cn) => {
    const up = Math.abs(cn.y) > 0.98 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const t1 = new THREE.Vector3().crossVectors(up, cn).normalize(), t2 = new THREE.Vector3().crossVectors(cn, t1).normalize();
    return { t1, t2 };
  });
  const place = (v: THREE.Vector3, s: number, r: number) => v.clone().normalize().sub(centre[s]).multiplyScalar(shrink[s]).add(centre[s]).normalize().multiplyScalar(r);
  const uvOf = (p: THREE.Vector3, s: number): [number, number] => {
    const q = p.clone().normalize(), k = 0.5 / Math.sin(radius[s] * 0.92);
    return [0.5 + q.dot(frame[s].t1) * k, 0.5 + q.dot(frame[s].t2) * k];
  };
  const P: number[] = [], Nn: number[] = [], U: number[] = [], ID: number[] = [], C: number[] = [], H: number[] = [];
  const push = (p: THREE.Vector3, n: THREE.Vector3, uv: [number, number], s: number, h: number) => { P.push(p.x, p.y, p.z); Nn.push(n.x, n.y, n.z); U.push(uv[0], uv[1]); ID.push(s); C.push(centre[s].x, centre[s].y, centre[s].z); H.push(h); };
  const slerpish = (a: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().lerp(b, t).normalize();
  poly.forEach((vs, s) => {
    const c = centre[s];
    for (let e = 0; e < vs.length; e++) {
      const a = vs[e], b = vs[(e + 1) % vs.length];
      // the wedge (centre, a, b) as a K by K triangle grid on the sphere
      // the rim is broken, not cut: points along each edge (never the corners) are bitten back toward the centre
      const rim = (j: number) => { const p = slerpish(a, b, j / K); return j === 0 || j === K ? p : slerpish(c, p, 1 - hash(s, e, j) * 0.1); };
      const pt = (i: number, j: number) => { // i steps from the centre toward the edge, j along it
        if (i === 0) return c.clone();
        if (i === K) return rim(j);
        const ea = slerpish(c, a, i / K), eb = slerpish(c, b, i / K);
        return slerpish(ea, eb, j / i);
      };
      const top3 = (p: THREE.Vector3) => { const q = place(p, s, top[s]); push(q, q.clone().normalize(), uvOf(p, s), s, 1); };
      for (let i = 0; i < K; i++) for (let j = 0; j <= i; j++) {
        top3(pt(i, j)); top3(pt(i + 1, j)); top3(pt(i + 1, j + 1));
        if (j < i) { top3(pt(i, j)); top3(pt(i + 1, j + 1)); top3(pt(i, j + 1)); }
      }
      // the wall under this edge, in K pieces so it follows the curve
      for (let j = 0; j < K; j++) {
        const p0 = rim(j), p1 = rim(j + 1);
        const at = place(p0, s, top[s]), bt = place(p1, s, top[s]), ab = place(p0, s, CORE), bb = place(p1, s, CORE);
        const n = new THREE.Vector3().subVectors(bt, at).cross(at.clone().normalize()).normalize();
        if (n.dot(at.clone().normalize().sub(c)) < 0) n.negate();
        const u0 = uvOf(p0, s), u1 = uvOf(p1, s);
        push(at, n, u0, s, 0.999); push(ab, n, u0, s, 0); push(bt, n, u1, s, 0.999);
        push(bt, n, u1, s, 0.999); push(ab, n, u0, s, 0); push(bb, n, u1, s, 0);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('aShard', new THREE.Float32BufferAttribute(ID, 1));
  g.setAttribute('aCentre', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('aTop', new THREE.Float32BufferAttribute(H, 1));
  g.computeBoundingSphere();
  return { g, centre, top };
}

const VERT = /* glsl */ `
  uniform float uLift[${N}]; uniform float uWarm[${N}]; uniform float uForm; uniform float uTime;
  attribute float aShard; attribute vec3 aCentre; attribute float aTop;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vTop; varying float vWarm; varying float vForm; varying float vId;
  void main() {
    int id = int(aShard + 0.5);
    // the world being made: each shard flies in from space along its own line, at its own moment
    float d = fract(sin(aShard * 12.9898) * 43758.5453);
    float k = clamp(uForm * 1.7 - d * 0.7, 0.0, 1.0), e = 1.0 - pow(1.0 - k, 3.0);
    vec3 swirl = vec3(sin(aShard * 7.1), cos(aShard * 3.7), sin(aShard * 5.3)) * 1.6;
    vec3 p = position + aCentre * uLift[id] + (aCentre * 4.0 + swirl) * (1.0 - e);
    vForm = e; vTop = aTop; vUv = uv; vWarm = uWarm[id]; vId = aShard;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = /* glsl */ `
  uniform sampler2D uAtlas; uniform float uWill; uniform float uTime;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vTop; varying float vWarm; varying float vForm; varying float vId;
  void main() {
    vec3 green = vec3(0.24, 1.0, 0.56);
    vec3 N = normalize(vN), V = normalize(vV), L = normalize(vec3(-0.55, 0.65, 0.55));
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    float diff = 0.22 + 0.95 * pow(max(dot(N, L), 0.0), 0.8);
    vec3 col;
    if (vTop > 0.9995) {
      // the domain: the target's photo in the glass, green until the pointer warms it
      float id = vId; vec2 cell = vec2(mod(id, ${COLS}.0), floor(id / ${COLS}.0));
      vec2 uv = clamp(vUv, 0.0, 1.0);
      // the atlas is stored top row first and flipped on upload
      vec3 ph = texture2D(uAtlas, vec2((cell.x + uv.x) / ${COLS}.0, 1.0 - (cell.y + 1.0 - uv.y) / ${Math.ceil(N / COLS)}.0)).rgb;
      ph = 1.0 - exp(-ph * 2.2);
      float lum = dot(ph, vec3(0.3, 0.59, 0.11));
      vec3 mono = green * (0.06 + lum * (1.05 - uWill * 0.25));
      col = mix(mono, ph, vWarm) * diff + green * fres * (0.55 + vWarm * 0.3);
      // the display's scan rows, and a faint vignette toward the shard's edge
      col *= 0.86 + 0.14 * step(0.5, fract(gl_FragCoord.y / 3.0));
      col *= 1.0 - smoothstep(0.35, 0.75, length(uv - 0.5)) * 0.55;
    } else {
      // the walls: dark glass, a bright seam at the rim, the core's light rising from below
      col = mix(vec3(0.0, 0.06, 0.035), green * 1.5, pow(vTop, 10.0)) + green * (1.0 - vTop) * 0.25 * (0.7 + 0.3 * sin(uTime * 2.0 + vId));
    }
    gl_FragColor = vec4(col, vForm);
  }`;
const CORE_FRAG = /* glsl */ `
  uniform float uTime; uniform float uWill; varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main() {
    float f = max(dot(normalize(vN), normalize(vV)), 0.0);
    float n = sin(vP.x * 9.0 + uTime * 1.3) * sin(vP.y * 11.0 - uTime * 0.9) * sin(vP.z * 8.0 + uTime * 0.7);
    vec3 col = mix(vec3(0.02, 0.22, 0.11), vec3(0.45, 1.0, 0.7), pow(f, 2.0)) * (0.85 + 0.25 * n) * (0.9 + uWill * 0.4);
    gl_FragColor = vec4(col, 1.0);
  }`;
const PLAIN_VERT = /* glsl */ `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;

/** The photos, cropped square around each face, in one texture. */
async function atlas(list: World[]) {
  const rows = Math.ceil(N / COLS);
  const cv = document.createElement('canvas'); cv.width = COLS * CELL; cv.height = rows * CELL;
  const g = cv.getContext('2d')!; g.fillStyle = '#031008'; g.fillRect(0, 0, cv.width, cv.height);
  await Promise.all(list.map((w, i) => new Promise<void>((res) => {
    const img = new Image(); img.decoding = 'async';
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight, side = Math.min(W, H * 0.9), [hx, hy] = w.face.head;
      const sx = Math.min(W - side, Math.max(0, hx * W - side / 2)), sy = Math.min(H - side, Math.max(0, hy * H - side * 0.3));
      g.drawImage(img, sx, sy, side, side, (i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL, CELL);
      img.src = ''; res();
    };
    img.onerror = () => res();
    img.src = w.face.src;
  })));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export async function createBattleworld(canvas: HTMLCanvasElement, list: World[], opts: Opts) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 768 ? 1.25 : 1.5));
  renderer.setClearColor(0, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  const world = new THREE.Group(); scene.add(world);
  const { g, centre, top } = buildGeometry(list);
  const lift = new Array(N).fill(0), warm = new Array(N).fill(0), liftTo = new Array(N).fill(0), warmTo = new Array(N).fill(0);
  const tex = await atlas(list);
  const u = { uAtlas: { value: tex }, uLift: { value: lift }, uWarm: { value: warm }, uForm: { value: opts.reduced ? 1 : 0 }, uTime: { value: 0 }, uWill: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat); world.add(mesh);
  const coreMat = new THREE.ShaderMaterial({ uniforms: { uTime: u.uTime, uWill: u.uWill }, vertexShader: PLAIN_VERT, fragmentShader: CORE_FRAG });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 5), coreMat); world.add(core);
  // the glow around the world: a camera-facing disc, a ring of light just past the limb, the planet hiding its middle
  const halo = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g2 = cv.getContext('2d')!, gr = g2.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(61,255,143,0)'); gr.addColorStop(0.56, 'rgba(61,255,143,0)'); gr.addColorStop(0.63, 'rgba(61,255,143,0.55)'); gr.addColorStop(0.72, 'rgba(61,255,143,0.16)'); gr.addColorStop(1, 'rgba(61,255,143,0)');
    g2.fillStyle = gr; g2.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.setScalar(3.4); scene.add(sp);
    return sp;
  })();
  // an orbit: one faint tilted ring of ticks, turning slowly (two bright ones made the planet read as a toy)
  const rings: THREE.Object3D[] = [];
  for (const [r, tilt, n] of [[1.75, 0.38, 160]] as const) {
    const pts: number[] = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, l = i % 10 ? 0.012 : 0.04; pts.push(Math.cos(a) * r, 0, Math.sin(a) * r, Math.cos(a) * (r + l), 0, Math.sin(a) * (r + l)); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const ring = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x3dff8f, transparent: true, opacity: 0.2 }));
    const circ = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, i) => new THREE.Vector3(Math.cos((i / 128) * Math.PI * 2) * r, 0, Math.sin((i / 128) * Math.PI * 2) * r))), new THREE.LineBasicMaterial({ color: 0x3dff8f, transparent: true, opacity: 0.06 }));
    const holder = new THREE.Group(); holder.add(ring, circ); holder.rotation.x = tilt; holder.rotation.z = tilt * 0.6; scene.add(holder); rings.push(ring);
  }
  // dust of dead universes, far out
  { const r = rand(9), pts: number[] = [];
    for (let i = 0; i < 500; i++) { const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(5 + r() * 8); pts.push(v.x, v.y, v.z); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x9dffc8, size: 0.025, transparent: true, opacity: 0.5, depthWrite: false }))); }

  // the planet sits a little low, seen from the throne above it
  let dist = 5.6;
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h;
    // phones pull back so the whole world fits; big monitors bring it closer
    dist = cam.aspect < 0.8 ? 5.6 / Math.max(0.55, cam.aspect) * 0.8 : w > 1700 ? 4.9 : 5.6;
    cam.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  cam.position.set(0, 1.25, dist); cam.lookAt(0, 0, 0);
  // Doomstadt tipped toward the viewer at the start
  world.rotation.set(0.38, 0.6, 0);
  await renderer.compileAsync(scene, cam).catch(() => {});

  // turning: drag with inertia, a slow drift when idle
  let vy = opts.reduced ? 0 : 0.0016, vx = 0, dragging = false, moved = 0, lx = 0, ly = 0, hover: number | null = null, picked: number | null = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), q = new THREE.Quaternion();
  const hit = (cx: number, cy: number) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const h = ray.intersectObject(mesh, false)[0];
    return h && h.face ? (g.getAttribute('aShard') as THREE.BufferAttribute).getX(h.face.a) : null;
  };
  const screenOf = (i: number) => {
    const v = centre[i].clone().multiplyScalar(top[i] + lift[i]).applyMatrix4(world.matrixWorld).project(cam);
    return { x: (v.x * 0.5 + 0.5) * canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * canvas.clientHeight, front: v.z < 1 && centre[i].clone().applyQuaternion(world.quaternion).dot(cam.position.clone().normalize()) > 0.15 };
  };
  const setHover = (i: number | null, force = false) => {
    if ((i === hover && !force) || picked !== null) return;
    hover = i;
    liftTo.fill(0); warmTo.fill(0);
    if (i !== null) { liftTo[i] = 0.09; warmTo[i] = 1; }
    canvas.style.cursor = i !== null ? 'pointer' : 'grab';
    opts.onHover?.(i, i !== null ? screenOf(i) : null);
  };
  let aimX = 0, aimY = 0;
  const down = (e: PointerEvent) => { turn = null; aimX = world.rotation.x; aimY = world.rotation.y; dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); };
  const move = (e: PointerEvent) => {
    if (dragging) {
      const dx = e.clientX - lx, dy = e.clientY - ly; moved += Math.abs(dx) + Math.abs(dy); lx = e.clientX; ly = e.clientY;
      // the drag sets where the world should be; the frame loop eases it there, so sparse pointer events still glide
      vy = dx * 0.0045; vx = dy * 0.0035; aimY += vy; aimX = Math.max(-0.6, Math.min(1.1, aimX + vx));
      if (e.pointerType !== 'mouse') return;
    }
    if (e.pointerType === 'mouse' && !dragging) setHover(hit(e.clientX, e.clientY));
  };
  const up = (e: PointerEvent) => {
    if (!dragging) return; dragging = false;
    if (moved > 8) return;
    const i = hit(e.clientX, e.clientY);
    if (i === null) { if (e.pointerType !== 'mouse') setHover(null); return; }
    // on touch the first tap chooses (and turns the domain to face the visitor), the second opens
    if (e.pointerType !== 'mouse' && hover !== i) { select(i); return; }
    pick(i);
  };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up);
  // a lifted finger also "leaves": only a mouse leaving lets the domain go
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !dragging) setHover(null); });
  canvas.addEventListener('pointercancel', () => { dragging = false; });
  canvas.style.touchAction = 'pan-y'; canvas.style.cursor = 'grab';

  // selecting a domain (a tap, or its face in the strip below): the planet stops and turns it to face the visitor
  let turn: { t0: number; from: THREE.Quaternion; to: THREE.Quaternion } | null = null;
  const facing = (i: number) => {
    const want = cam.position.clone().normalize(), have = centre[i].clone().applyQuaternion(world.quaternion);
    return new THREE.Quaternion().setFromUnitVectors(have, want).multiply(world.quaternion);
  };
  const select = (i: number) => {
    if (picked !== null) return;
    vy = 0; vx = 0;
    turn = { t0: performance.now(), from: world.quaternion.clone(), to: facing(i) };
    setHover(i, true);
  };

  // choosing a domain: the planet turns it to face the visitor, it rises, and the camera dives into it
  let dive: { t0: number; from: THREE.Quaternion; to: THREE.Quaternion; i: number } | null = null;
  const pick = (i: number) => {
    if (picked !== null) return;
    hover = i; picked = i; liftTo.fill(0); warmTo.fill(0); liftTo[i] = 0.6; warmTo[i] = 1;
    // the rotation that brings the shard's centre to face the camera
    const want = cam.position.clone().normalize(), have = centre[i].clone().applyQuaternion(world.quaternion);
    q.setFromUnitVectors(have, want);
    dive = { t0: performance.now(), from: world.quaternion.clone(), to: q.clone().multiply(world.quaternion), i };
    opts.onPick?.(i);
  };

  let alive = true, last = performance.now(), formAt = 0, formDur = 0, formDone: (() => void) | null = null;
  const camHome = new THREE.Vector3();
  const loop = (now: number) => {
    if (!alive) return;
    requestAnimationFrame(loop);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    u.uTime.value += dt;
    if (formDur) { const k = Math.min(1, (now - formAt) / formDur); u.uForm.value = k; if (k >= 1) { formDur = 0; formDone?.(); } }
    (halo.material as THREE.SpriteMaterial).opacity = u.uForm.value;
    // the core kindles as the shards gather round it
    core.scale.setScalar(0.08 + 0.92 * Math.min(1, u.uForm.value * 1.6)); core.visible = u.uForm.value > 0.01;
    if (dragging && !dive) {
      world.rotation.y += (aimY - world.rotation.y) * 0.32; world.rotation.x += (aimX - world.rotation.x) * 0.32;
    } else if (turn && !dragging && !dive) {
      const k = Math.min(1, (now - turn.t0) / (opts.reduced ? 1 : 900)), e = 1 - Math.pow(1 - k, 3);
      world.quaternion.slerpQuaternions(turn.from, turn.to, e);
      if (k >= 1) turn = null;
    } else if (!dragging && !dive) {
      world.rotation.y += vy; world.rotation.x += vx; vx *= 0.92;
      vy += ((hover !== null ? 0 : opts.reduced ? 0 : 0.0016) - vy) * 0.02;
      if (hover === null) world.rotation.x += (0.3 - world.rotation.x) * 0.01;
    }
    for (let i = 0; i < N; i++) { lift[i] += (liftTo[i] - lift[i]) * 0.12; warm[i] += (warmTo[i] - warm[i]) * 0.1; }
    for (const r of rings) r.rotation.y += dt * 0.05;
    camHome.set(0, 1.25, dist);
    if (dive) {
      const k = Math.min(1, (now - dive.t0) / 1300), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      world.quaternion.slerpQuaternions(dive.from, dive.to, Math.min(1, e * 1.6));
      const target = cam.position.clone().normalize().multiplyScalar(1.7);
      cam.position.lerpVectors(camHome, target.add(new THREE.Vector3(0, 0, 0)), Math.max(0, (e - 0.35) / 0.65));
    } else if (cam.position.distanceTo(camHome) > 0.001) cam.position.lerp(camHome, 0.1);
    cam.lookAt(0, 0, 0);
    renderer.render(scene, cam);
    if (hover !== null && !dive) opts.onHover?.(hover, screenOf(hover));
  };
  requestAnimationFrame(loop);

  return {
    /** The world being made: the shards fly in and lock together over `secs`. */
    form(secs = 3.2) { if (opts.reduced) return Promise.resolve(); return new Promise<void>((res) => { formAt = performance.now(); formDur = secs * 1000; formDone = res; }); },
    setWill(w: number) { u.uWill.value = w; },
    /** Lifts a domain from outside (the domain list beside the planet). */
    hover(i: number | null) { setHover(i); },
    /** Selects a domain from outside: it turns to face the visitor and lifts, without diving. */
    select,
    pick,
    screenOf,
    dispose() {
      alive = false; ro.disconnect();
      scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      tex.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
