import type { Point } from '../core/types';
import { Camera, clampZ } from './camera';

const TAU_S = 0.04; // smoothing time constant — short enough to feel direct, long enough to not stutter
const Z_EPS = 1e-4; // logZ snap threshold
const POS_EPS = 0.05; // CSS px snap threshold

// Van Wijk fly defaults
const RHO = Math.SQRT2; // curvature; ρ²≈2 is the perceptual optimum (Van Wijk & Nuij 2003)
const FLY_V = 320; // ms per unit of path length S — tunes overall speed
const FLY_MIN = 280; // ms floor (adjacent frames feel snappy)
const FLY_MAX = 1500; // ms ceiling (whole-board jumps stay bounded)

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

type FlyInterp = (t: number) => [number, number, number]; // → [centerX, centerY, viewportWorldWidth]

/**
 * Van Wijk & Nuij (2003) "Smooth and Efficient Zooming and Panning": the
 * fly-to path between two camera views (center c, viewport world-width w) that
 * zooms out, pans, and zooms back in — arcing more the farther apart the
 * views are. Returns the interpolator plus S, the path length, which doubles
 * as the natural duration measure. (Same math as d3-interpolateZoom.)
 */
function vanWijk(
  c0x: number, c0y: number, w0: number,
  c1x: number, c1y: number, w1: number,
  rho: number,
): { interp: FlyInterp; S: number } {
  const dx = c1x - c0x;
  const dy = c1y - c0y;
  const d2 = dx * dx + dy * dy;
  const rho2 = rho * rho;

  if (d2 < 1e-12) {
    // essentially same center: pure geometric zoom
    const S = Math.abs(Math.log(w1 / w0)) / rho;
    const interp: FlyInterp = (t) => [c0x + t * dx, c0y + t * dy, w0 * Math.exp(rho * t * S)];
    return { interp, S };
  }

  const d1 = Math.sqrt(d2);
  const rho4 = rho2 * rho2;
  const b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1);
  const b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;
  const coshr0 = Math.cosh(r0);
  const interp: FlyInterp = (t) => {
    const s = t * S;
    const u = (w0 / (rho2 * d1)) * (coshr0 * Math.tanh(rho * s + r0) - Math.sinh(r0));
    return [c0x + u * dx, c0y + u * dy, (w0 * coshr0) / Math.cosh(rho * s + r0)];
  };
  return { interp, S };
}

/**
 * Camera animation with two modes:
 *
 * - **smooth** — exponential approach toward a target (direct manipulation,
 *   inertia, zoom-to-fit). Anchored (wheel) smooths only logZ; free smooths
 *   x/y/logZ.
 * - **fly** — a timed Van Wijk zoom-out-then-in glide for presentation
 *   transitions, eased and with duration scaled to the path length.
 */
export class CameraAnim {
  private active = false;
  private mode: 'smooth' | 'fly' = 'smooth';

  // smooth-mode targets
  private targetX = 0;
  private targetY = 0;
  private targetLogZ = 0;
  private anchor: { screen: Point; world: Point } | null = null;

  // fly-mode state
  private flyInterp: FlyInterp | null = null;
  private flyElapsed = 0;
  private flyDur = 0;
  private flyTargetZ = 1;
  private flyViewW = 1;
  private flyViewH = 1;

  constructor(private camera: Camera) {}

  get isActive(): boolean {
    return this.active;
  }

  get targetZ(): number {
    if (!this.active) return this.camera.z;
    return this.mode === 'fly' ? this.flyTargetZ : Math.exp(this.targetLogZ);
  }

  /** Anchored zoom toward z1 keeping the world point under `screen` pinned. */
  zoomTo(z1: number, screen: Point): void {
    z1 = clampZ(z1);
    this.mode = 'smooth';
    if (this.anchor) {
      // Gesture continues: re-pin to whatever world point is under the cursor now.
      const dx = Math.abs(this.anchor.screen.x - screen.x);
      const dy = Math.abs(this.anchor.screen.y - screen.y);
      if (dx > 1 || dy > 1) this.anchor = { screen, world: this.camera.screenToWorld(screen) };
    } else {
      this.anchor = { screen, world: this.camera.screenToWorld(screen) };
    }
    this.targetLogZ = Math.log(z1);
    this.active = true;
  }

  /** Free animation toward an absolute camera state (exponential smoothing). */
  animateTo(target: { x: number; y: number; z: number }): void {
    this.mode = 'smooth';
    this.anchor = null;
    this.targetX = target.x;
    this.targetY = target.y;
    this.targetLogZ = Math.log(clampZ(target.z));
    this.active = true;
  }

  /**
   * Timed Van Wijk glide to an absolute camera state — the presentation
   * transition. Duration scales with the path length so adjacent frames feel
   * snappy and far jumps get a longer cinematic arc, no per-call tuning.
   */
  flyTo(target: { x: number; y: number; z: number }, opts?: { rho?: number; v?: number; min?: number; max?: number }): void {
    const cam = this.camera;
    const rho = opts?.rho ?? RHO;
    const z0 = cam.z;
    const z1 = clampZ(target.z);
    const w0 = cam.viewW / z0;
    const w1 = cam.viewW / z1;
    const c0x = cam.x + cam.viewW / (2 * z0);
    const c0y = cam.y + cam.viewH / (2 * z0);
    const c1x = target.x + cam.viewW / (2 * z1);
    const c1y = target.y + cam.viewH / (2 * z1);

    const { interp, S } = vanWijk(c0x, c0y, w0, c1x, c1y, w1, rho);
    this.flyInterp = interp;
    this.flyElapsed = 0;
    this.flyDur = Math.max(opts?.min ?? FLY_MIN, Math.min(opts?.max ?? FLY_MAX, S * (opts?.v ?? FLY_V) + 200));
    this.flyTargetZ = z1;
    this.flyViewW = cam.viewW;
    this.flyViewH = cam.viewH;
    this.mode = 'fly';
    this.anchor = null;
    this.active = true;
  }

  cancel(): void {
    this.active = false;
    this.mode = 'smooth';
    this.anchor = null;
    this.flyInterp = null;
  }

  /** Advance; returns true while still animating. */
  step(dtMs: number): boolean {
    if (!this.active) return false;
    const cam = this.camera;

    if (this.mode === 'fly') {
      this.flyElapsed += Math.min(dtMs, 50);
      const t = this.flyDur > 0 ? Math.min(1, this.flyElapsed / this.flyDur) : 1;
      const [cx, cy, w] = this.flyInterp!(smoothstep(t));
      const z = clampZ(this.flyViewW / w);
      cam.z = z;
      cam.x = cx - this.flyViewW / (2 * z);
      cam.y = cy - this.flyViewH / (2 * z);
      if (t >= 1) this.cancel();
      return this.active;
    }

    const dt = Math.min(dtMs, 50) / 1000;
    const alpha = 1 - Math.exp(-dt / TAU_S);

    let logZ = Math.log(cam.z);
    logZ += (this.targetLogZ - logZ) * alpha;
    const zDone = Math.abs(this.targetLogZ - logZ) < Z_EPS;
    if (zDone) logZ = this.targetLogZ;
    const z = Math.exp(logZ);

    if (this.anchor) {
      cam.z = z;
      cam.x = this.anchor.world.x - this.anchor.screen.x / z;
      cam.y = this.anchor.world.y - this.anchor.screen.y / z;
      if (zDone) this.cancel();
    } else {
      cam.z = z;
      cam.x += (this.targetX - cam.x) * alpha;
      cam.y += (this.targetY - cam.y) * alpha;
      const posDone =
        Math.abs(this.targetX - cam.x) * z < POS_EPS && Math.abs(this.targetY - cam.y) * z < POS_EPS;
      if (zDone && posDone) {
        cam.x = this.targetX;
        cam.y = this.targetY;
        this.cancel();
      }
    }
    return this.active;
  }
}
