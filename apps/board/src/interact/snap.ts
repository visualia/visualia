import type { BNode, Rect } from '../core/types';

/** A guide line segment spanning only the objects involved in the snap. */
export interface GuideSeg {
  pos: number;
  start: number;
  end: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  /** vertical guides (pos = world-x, start/end = world-y extent) and horizontal */
  v: GuideSeg[];
  h: GuideSeg[];
}

const NONE: SnapResult = { dx: 0, dy: 0, v: [], h: [] };

/** Candidate anchor lines per element: edges plus 1/4, 1/3, 1/2, 2/3, 3/4. */
const FRACTIONS = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1];

function anchorsX(n: BNode): number[] {
  return FRACTIONS.map((f) => n.x + n.w * f);
}

function anchorsY(n: BNode): number[] {
  return FRACTIONS.map((f) => n.y + n.h * f);
}

/**
 * Figma-style object snapping: the dragged selection's bbox edges/center
 * snap to other nodes' fractional anchor lines when within `thresh` world
 * units. No grid snapping here — objects only.
 */
export function snapBBox(bbox: Rect, candidates: readonly BNode[], thresh: number): SnapResult {
  if (!candidates.length) return NONE;
  const valsX = [bbox.x, bbox.x + bbox.w / 2, bbox.x + bbox.w];
  const valsY = [bbox.y, bbox.y + bbox.h / 2, bbox.y + bbox.h];
  let bestX: { d: number; line: number; off: number } | null = null;
  let bestY: { d: number; line: number; off: number } | null = null;

  for (const n of candidates) {
    for (const c of anchorsX(n)) {
      for (const v of valsX) {
        const d = Math.abs(c - v);
        if (d <= thresh && (!bestX || d < bestX.d)) bestX = { d, line: c, off: c - v };
      }
    }
    for (const c of anchorsY(n)) {
      for (const v of valsY) {
        const d = Math.abs(c - v);
        if (d <= thresh && (!bestY || d < bestY.d)) bestY = { d, line: c, off: c - v };
      }
    }
  }

  // Guides span only the snapped selection plus the objects that share the line.
  const fy = bbox.y + (bestY?.off ?? 0);
  const fx = bbox.x + (bestX?.off ?? 0);
  let v: GuideSeg[] = [];
  if (bestX) {
    const line = bestX.line;
    let start = fy;
    let end = fy + bbox.h;
    for (const n of candidates) {
      if (anchorsX(n).some((c) => Math.abs(c - line) < 0.5)) {
        start = Math.min(start, n.y);
        end = Math.max(end, n.y + n.h);
      }
    }
    v = [{ pos: line, start, end }];
  }
  let h: GuideSeg[] = [];
  if (bestY) {
    const line = bestY.line;
    let start = fx;
    let end = fx + bbox.w;
    for (const n of candidates) {
      if (anchorsY(n).some((c) => Math.abs(c - line) < 0.5)) {
        start = Math.min(start, n.x);
        end = Math.max(end, n.x + n.w);
      }
    }
    h = [{ pos: line, start, end }];
  }

  return { dx: bestX?.off ?? 0, dy: bestY?.off ?? 0, v, h };
}
