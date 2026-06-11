import type { Point } from '../core/types';

/** Two-finger pinch/pan tracking over Pointer Events. */
export class PinchTracker {
  private startDist = 1;
  private startZ = 1;
  private lastMid: Point = { x: 0, y: 0 };

  begin(a: Point, b: Point, currentZ: number): void {
    this.startDist = Math.max(8, dist(a, b));
    this.startZ = currentZ;
    this.lastMid = mid(a, b);
  }

  /** Returns the zoom target + midpoint movement since last update. */
  update(a: Point, b: Point): { z: number; mid: Point; midDelta: Point } {
    const m = mid(a, b);
    const out = {
      z: (this.startZ * Math.max(8, dist(a, b))) / this.startDist,
      mid: m,
      midDelta: { x: m.x - this.lastMid.x, y: m.y - this.lastMid.y },
    };
    this.lastMid = m;
    return out;
  }
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Velocity sampling for touch-pan inertia. */
export class VelocityTracker {
  private samples: { t: number; x: number; y: number }[] = [];

  add(x: number, y: number): void {
    const t = performance.now();
    this.samples.push({ t, x, y });
    while (this.samples.length > 2 && t - this.samples[0]!.t > 120) this.samples.shift();
  }

  /** px/ms over the recent window, or null if too slow/stale. */
  velocity(): Point | null {
    if (this.samples.length < 2) return null;
    const first = this.samples[0]!;
    const last = this.samples[this.samples.length - 1]!;
    const dt = last.t - first.t;
    if (dt < 20 || performance.now() - last.t > 80) return null;
    const v = { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
    return Math.hypot(v.x, v.y) > 0.3 ? v : null;
  }

  reset(): void {
    this.samples.length = 0;
  }
}
