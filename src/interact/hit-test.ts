import type { Camera } from '../camera/camera';
import type { Store } from '../core/store';
import type { BNode, Point, Rect } from '../core/types';
import { nodeRect, rectsIntersect } from '../core/types';

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLE_HIT_PX = 6;

/** Topmost node containing the world point. */
export function hitNode(store: Store, p: Point): BNode | null {
  const order = store.doc.nodeOrder;
  for (let i = order.length - 1; i >= 0; i--) {
    const n = store.doc.nodes[order[i]!];
    if (!n) continue;
    if (p.x >= n.x && p.x <= n.x + n.w && p.y >= n.y && p.y <= n.y + n.h) return n;
  }
  return null;
}

export function nodesInRect(store: Store, r: Rect): BNode[] {
  return store.orderedNodes().filter((n) => rectsIntersect(nodeRect(n), r));
}

export function handlePositions(n: BNode): { handle: Handle; x: number; y: number }[] {
  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;
  return [
    { handle: 'nw', x: n.x, y: n.y },
    { handle: 'n', x: cx, y: n.y },
    { handle: 'ne', x: n.x + n.w, y: n.y },
    { handle: 'e', x: n.x + n.w, y: cy },
    { handle: 'se', x: n.x + n.w, y: n.y + n.h },
    { handle: 's', x: cx, y: n.y + n.h },
    { handle: 'sw', x: n.x, y: n.y + n.h },
    { handle: 'w', x: n.x, y: cy },
  ];
}

/**
 * Resize affordance under a screen point for the single-selected node.
 * The whole border is grabbable: anywhere within tolerance of an edge
 * resizes that edge; near a corner resizes both axes.
 */
export function handleAt(camera: Camera, n: BNode, screen: Point): Handle | null {
  const tol = HANDLE_HIT_PX;
  const tl = camera.worldToScreen({ x: n.x, y: n.y });
  const br = camera.worldToScreen({ x: n.x + n.w, y: n.y + n.h });
  if (screen.x < tl.x - tol || screen.x > br.x + tol || screen.y < tl.y - tol || screen.y > br.y + tol) {
    return null;
  }
  const nearL = Math.abs(screen.x - tl.x) <= tol;
  const nearR = Math.abs(screen.x - br.x) <= tol;
  const nearT = Math.abs(screen.y - tl.y) <= tol;
  const nearB = Math.abs(screen.y - br.y) <= tol;
  if (nearT && nearL) return 'nw';
  if (nearT && nearR) return 'ne';
  if (nearB && nearL) return 'sw';
  if (nearB && nearR) return 'se';
  if (nearT) return 'n';
  if (nearB) return 's';
  if (nearL) return 'w';
  if (nearR) return 'e';
  return null;
}

export const HANDLE_CURSORS: Record<Handle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
};

export const MIN_W = 40;
export const MIN_H = 24;

/** New rect when dragging `handle` of `start` by a world-space delta. */
export function resizeRect(start: Rect, handle: Handle, dx: number, dy: number): Rect {
  let { x, y, w, h } = start;
  if (handle.includes('w')) {
    const nw = Math.max(MIN_W, w - dx);
    x += w - nw;
    w = nw;
  }
  if (handle.includes('e')) w = Math.max(MIN_W, w + dx);
  if (handle.includes('n')) {
    const nh = Math.max(MIN_H, h - dy);
    y += h - nh;
    h = nh;
  }
  if (handle.includes('s')) h = Math.max(MIN_H, h + dy);
  return { x, y, w, h };
}
