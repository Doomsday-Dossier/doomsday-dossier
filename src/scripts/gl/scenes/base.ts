import * as THREE from 'three';
import { fullscreen, syncCommon, type Ctx, type HeroScene } from '../engine';

/** A scene made of one fullscreen fragment shader plus optional extras drawn on top. */
export abstract class ShaderScene implements HeroScene {
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  mat!: THREE.ShaderMaterial;
  abstract frag(ctx: Ctx): string;
  uniforms(_ctx: Ctx): Record<string, THREE.IUniform> { return {}; }
  extras(_ctx: Ctx) {}
  beforeRender(_ctx: Ctx, _dt: number) {}
  mount(ctx: Ctx) {
    const q = fullscreen(this.frag(ctx), this.uniforms(ctx));
    this.mat = q.mat;
    q.mesh.renderOrder = -1;
    this.scene.add(q.mesh);
    this.extras(ctx);
  }
  update(ctx: Ctx, dt: number) {
    syncCommon(this.mat, ctx);
    this.beforeRender(ctx, dt);
    ctx.renderer.render(this.scene, this.cam);
  }
  dispose() {
    this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  }
}

export function aspectCam(ctx: Ctx) {
  const cam = new THREE.PerspectiveCamera(50, ctx.width / ctx.height, 0.1, 100);
  cam.position.z = 5;
  return cam;
}
