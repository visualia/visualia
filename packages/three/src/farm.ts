import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MAX_DPR = 2;
/** GL mode: a node counts as visible while the engine's live() heartbeat
    keeps pinging it; after this silence it stops rendering. */
const SEEN_TTL_MS = 250;

interface Entry {
  src: string;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group | null;
  mixer: THREE.AnimationMixer | null;
  canvas: HTMLCanvasElement;
  ctx2d: CanvasRenderingContext2D;
  mode: 'gl' | 'dom';
  lastSeen: number;
  spin: boolean;
  loadGen: number; // src changes invalidate in-flight loads
}

/**
 * Shared three.js renderer for all 3D nodes on a board: ONE WebGL context
 * total. Each registered node gets its own Scene + framed camera; every
 * animation frame the farm renders visible entries into a scissored viewport
 * of its offscreen canvas and blits the pixels into the node's 2D canvas.
 * From there the engine treats it like any other content: texture-captured
 * (live) in GL mode, plain DOM in fallback mode — culling, z-order and
 * content LOD all apply.
 */
export class ThreeFarm {
  private renderer: THREE.WebGLRenderer | null = null;
  private loader = new GLTFLoader();
  private entries = new Map<string, Entry>();
  private clock = new THREE.Clock();
  private raf = 0;
  /** frames blitted — exposed for debugging/perf checks */
  framesRendered = 0;

  get size(): number {
    return this.entries.size;
  }

  register(id: string, src: string, canvas: HTMLCanvasElement, mode: 'gl' | 'dom', spin: boolean): void {
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(3, 5, 4);
    scene.add(key);
    const entry: Entry = {
      src,
      scene,
      camera: new THREE.PerspectiveCamera(30, 1, 0.01, 1000),
      root: null,
      mixer: null,
      canvas,
      ctx2d: canvas.getContext('2d')!,
      mode,
      lastSeen: performance.now(),
      spin,
      loadGen: 0,
    };
    this.entries.set(id, entry);
    this.load(entry);
    this.start();
  }

  setSrc(id: string, src: string): void {
    const e = this.entries.get(id);
    if (!e || e.src === src) return;
    e.src = src;
    this.load(e);
  }

  setSpin(id: string, spin: boolean): void {
    const e = this.entries.get(id);
    if (e) e.spin = spin;
  }

  /** visibility heartbeat from the kind's live() hook (GL mode) */
  seen(id: string): void {
    const e = this.entries.get(id);
    if (e) e.lastSeen = performance.now();
  }

  unregister(id: string): void {
    const e = this.entries.get(id);
    if (!e) return;
    this.entries.delete(id);
    e.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of mats) m.dispose();
    });
    if (!this.entries.size) this.stop();
  }

  // -- loading -----------------------------------------------------------------

  private load(e: Entry): void {
    const gen = ++e.loadGen;
    this.loader.load(e.src, (gltf) => {
      if (gen !== e.loadGen) return; // src changed while loading
      if (e.root) e.scene.remove(e.root);
      e.root = gltf.scene;
      e.scene.add(e.root);
      if (gltf.animations.length) {
        e.mixer = new THREE.AnimationMixer(e.root);
        e.mixer.clipAction(gltf.animations[0]!).play();
      } else {
        e.mixer = null;
      }
      this.frameCamera(e);
    });
  }

  /** model-viewer-style framing: fit the scene bounds into the view cone */
  private frameCamera(e: Entry): void {
    if (!e.root) return;
    const box = new THREE.Box3().setFromObject(e.root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const dist = (maxDim / (2 * Math.tan((e.camera.fov * Math.PI) / 360))) * 1.25;
    e.camera.position.set(center.x, center.y + size.y * 0.1, center.z + dist);
    e.camera.near = dist / 100;
    e.camera.far = dist * 100;
    e.camera.lookAt(center);
    e.camera.updateProjectionMatrix();
    // spin around the model's own center
    if (e.spin && e.root) {
      const pivot = new THREE.Group();
      e.scene.remove(e.root);
      e.root.position.sub(center);
      pivot.position.copy(center);
      pivot.add(e.root);
      e.scene.add(pivot);
      e.root = pivot;
    }
  }

  // -- render loop --------------------------------------------------------------

  private start(): void {
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  private stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = this.clock.getDelta();
    const now = performance.now();
    for (const e of this.entries.values()) {
      if (!e.root) continue;
      if (!e.canvas.isConnected || e.canvas.clientWidth === 0) continue; // dom-mode cull (display:none)
      if (e.mode === 'gl' && now - e.lastSeen > SEEN_TTL_MS) continue; // gl-mode cull (no heartbeat)
      if (e.spin) e.root.rotation.y += dt * 0.6;
      e.mixer?.update(dt);
      this.renderEntry(e);
    }
  };

  private renderEntry(e: Entry): void {
    const dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
    const w = Math.max(1, Math.round(e.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(e.canvas.clientHeight * dpr));
    if (e.canvas.width !== w || e.canvas.height !== h) {
      e.canvas.width = w;
      e.canvas.height = h;
    }

    const r = this.ensureRenderer();
    // grow-only shared buffer; each entry renders into a scissored corner
    const need = { w: Math.max(r.domElement.width, w), h: Math.max(r.domElement.height, h) };
    if (r.domElement.width < w || r.domElement.height < h) r.setSize(need.w, need.h, false);
    r.setViewport(0, 0, w, h);
    r.setScissor(0, 0, w, h);
    r.setScissorTest(true);
    e.camera.aspect = w / h;
    e.camera.updateProjectionMatrix();
    r.clear();
    r.render(e.scene, e.camera);

    // blit synchronously (WebGL buffers are cleared after the task ends);
    // GL viewport (0,0) is bottom-left → that's image-space row H-h
    const H = r.domElement.height;
    e.ctx2d.clearRect(0, 0, w, h);
    e.ctx2d.drawImage(r.domElement, 0, H - h, w, h, 0, 0, w, h);
    this.framesRendered++;
  }

  private ensureRenderer(): THREE.WebGLRenderer {
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.autoClear = false; // we clear per scissored viewport
    }
    return this.renderer;
  }
}

let shared: ThreeFarm | null = null;

/** The module-wide farm — every threeKind() node shares one GL context. */
export function getThreeFarm(): ThreeFarm {
  return (shared ??= new ThreeFarm());
}
