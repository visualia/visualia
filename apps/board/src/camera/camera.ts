import type { Point, Rect } from '../core/types';

export const MIN_Z = 0.02;
export const MAX_Z = 8;

export function clampZ(z: number): number {
  return Math.min(MAX_Z, Math.max(MIN_Z, z));
}

/**
 * Single source of truth for the viewport. All math in CSS pixels;
 * devicePixelRatio only exists at the GL backing-store boundary.
 *
 *   screen = (world - cam) * z
 *   world  = screen / z + cam
 */
export class Camera {
  x = 0;
  y = 0;
  z = 1;
  /** viewport size in CSS px */
  viewW = 1;
  viewH = 1;

  worldToScreen(p: Point): Point {
    return { x: (p.x - this.x) * this.z, y: (p.y - this.y) * this.z };
  }

  screenToWorld(p: Point): Point {
    return { x: p.x / this.z + this.x, y: p.y / this.z + this.y };
  }

  /** Visible world rect. */
  viewportWorldRect(): Rect {
    return { x: this.x, y: this.y, w: this.viewW / this.z, h: this.viewH / this.z };
  }

  /** Pan by a screen-space delta (e.g. pointer movement). */
  panByScreen(dx: number, dy: number): void {
    this.x -= dx / this.z;
    this.y -= dy / this.z;
  }

  /** Zoom to z1, keeping the world point under screen point `s` fixed. */
  zoomAbout(s: Point, z1: number): void {
    z1 = clampZ(z1);
    const z0 = this.z;
    this.x += s.x * (1 / z0 - 1 / z1);
    this.y += s.y * (1 / z0 - 1 / z1);
    this.z = z1;
  }

  /** Camera that fits `rect` with padding, centered. */
  fitTarget(rect: Rect, pad = 0.08): { x: number; y: number; z: number } {
    const pw = rect.w * (1 + pad * 2);
    const ph = rect.h * (1 + pad * 2);
    const z = clampZ(Math.min(this.viewW / Math.max(pw, 1e-6), this.viewH / Math.max(ph, 1e-6)));
    return {
      x: rect.x + rect.w / 2 - this.viewW / z / 2,
      y: rect.y + rect.h / 2 - this.viewH / z / 2,
      z,
    };
  }
}
