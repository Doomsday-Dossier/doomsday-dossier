/**
 * Page transition: a noise-dissolve wipe drawn on its own tiny WebGL context on
 * top of everything. It only runs during navigation, so it costs nothing else.
 * Cover: dark void eats the page from a glowing accent edge. Reveal: it burns away.
 */
const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }`;
const FRAG = `precision mediump float;
varying vec2 v; uniform float uP; uniform float uT; uniform vec2 uR; uniform vec3 uC; uniform float uDir;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
void main(){
  vec2 q = v*vec2(uR.x/uR.y,1.0);
  float f = fbm(q*3.0 + uT*0.2) * 0.7 + (uDir > 0.5 ? (1.0 - v.y) : v.y) * 0.3;
  float edge = uP*1.25 - 0.12;
  float cover = smoothstep(edge, edge - 0.02, f);
  float rim = smoothstep(0.07, 0.0, abs(f - edge)) * step(0.001, uP) * step(uP, 0.999);
  vec3 col = vec3(0.02,0.024,0.026) + uC*rim*1.6;
  gl_FragColor = vec4(col, max(cover, rim));
}`;

export class Wipe {
  gl: WebGLRenderingContext | null;
  prog: WebGLProgram | null = null;
  u: Record<string, WebGLUniformLocation | null> = {};
  color = [0.24, 1, 0.54];
  constructor(public canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: false });
    if (!this.gl) return;
    const gl = this.gl;
    const sh = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p); gl.useProgram(p); this.prog = p;
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const k of ['uP', 'uT', 'uR', 'uC', 'uDir']) this.u[k] = gl.getUniformLocation(p, k);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  setColor(hex: string) {
    const m = hex.replace('#', '').match(/.{2}/g);
    if (m) this.color = m.map((x) => parseInt(x, 16) / 255);
  }
  private draw(p: number, dir: number) {
    const gl = this.gl; if (!gl) return;
    const dpr = Math.min(devicePixelRatio, 1); // the wipe is soft; low res is fine
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(this.u.uP, p); gl.uniform1f(this.u.uT, performance.now() / 1000);
    gl.uniform2f(this.u.uR, w, h); gl.uniform3f(this.u.uC, this.color[0], this.color[1], this.color[2]);
    gl.uniform1f(this.u.uDir, dir);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  private run(from: number, to: number, ms: number, dir: number) {
    return new Promise<void>((res) => {
      if (!this.gl) { res(); return; }
      this.canvas.style.opacity = '1';
      const t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        this.draw(from + (to - from) * e, dir);
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }
  cover() { return this.run(0, 1, 750, 0); }
  async reveal() { await this.run(1, 0, 900, 1); this.canvas.style.opacity = '0'; }
}
