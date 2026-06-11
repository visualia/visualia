import type { Point } from '../core/types';
import { Camera, clampZ } from './camera';

const TAU_S = 0.04; // smoothing time constant — short enough to feel direct, long enough to not stutter
const Z_EPS = 1e-4; // logZ snap threshold
const POS_EPS = 0.05; // CSS px snap threshold

/**
 * Exponential smoothing toward a target camera. Two modes:
 *
 * - anchored (wheel zoom): only logZ is smoothed; x/y are *derived* each tick
 *   from the anchor so the world point under the cursor never drifts.
 * - free (zoom-to-fit, Cmd+0, inertia): x, y and logZ all smoothed.
 */
export class CameraAnim {
  private active = false;
  private targetX = 0;
  private targetY = 0;
  private targetLogZ = 0;
  private anchor: { screen: Point; world: Point } | null = null;

  constructor(private camera: Camera) {}

  get isActive(): boolean {
    return this.active;
  }

  get targetZ(): number {
    return this.active ? Math.exp(this.targetLogZ) : this.camera.z;
  }

  /** Anchored zoom toward z1 keeping the world point under `screen` pinned. */
  zoomTo(z1: number, screen: Point): void {
    z1 = clampZ(z1);
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

  /** Free animation toward an absolute camera state. */
  animateTo(target: { x: number; y: number; z: number }): void {
    this.anchor = null;
    this.targetX = target.x;
    this.targetY = target.y;
    this.targetLogZ = Math.log(clampZ(target.z));
    this.active = true;
  }

  cancel(): void {
    this.active = false;
    this.anchor = null;
  }

  /** Advance; returns true while still animating. */
  step(dtMs: number): boolean {
    if (!this.active) return false;
    const cam = this.camera;
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
