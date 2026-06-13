import type { ResizeConstraint } from '@visualia/engine';

const SNAP_PX = 7; // screen-space snap radius for crop edges
const MIN_SRC = 16; // smallest croppable window, in source px

export type Rect4 = [number, number, number, number];
export interface SnapRect {
  rect: Rect4;
}

/** Centered crop of a srcW×srcH image that fills a w×h box (object-fit: cover). */
export function coverCrop(srcW: number, srcH: number, w: number, h: number): Rect4 {
  const want = w / h;
  const have = srcW / srcH;
  if (have > want) {
    const cw = srcH * want;
    return [(srcW - cw) / 2, 0, cw, srcH];
  }
  const ch = srcW / want;
  return [0, (srcH - ch) / 2, srcW, ch];
}

interface CropArgs {
  start: { x: number; y: number; w: number; h: number };
  rect: { x: number; y: number; w: number; h: number };
  handle: string;
  pxPerWorld: number;
  srcW: number;
  srcH: number;
  /** visible source rect at gesture start */
  startCrop: Rect4;
  /** source-px rects to snap crop edges to (e.g. captured elements) */
  snapRects: readonly SnapRect[];
  /** extra world-space anchor lines (e.g. sibling nodes) — snap edges to these too */
  snap?: { xs: number[]; ys: number[] };
}

/**
 * The shared crop logic behind a croppable image-document (website, image,
 * later pdf): dragging an edge or corner **crops** those sides — the pixels stay
 * pinned, the window moves, snapping to the source rects / image bounds with red
 * guides, clamped to the image. (A corner crops its two sides at once.)
 */
export function cropConstrain(a: CropArgs): ResizeConstraint<never> {
  const { start, rect, handle, pxPerWorld, srcW, srcH, startCrop } = a;
  const s = start.w / startCrop[2]; // world px per source px — fixed throughout

  const imgLeft = start.x - startCrop[0] * s;
  const imgTop = start.y - startCrop[1] * s;
  const imgRight = imgLeft + srcW * s;
  const imgBottom = imgTop + srcH * s;

  const xs: number[] = [imgLeft, imgRight, ...(a.snap?.xs ?? [])];
  const ys: number[] = [imgTop, imgBottom, ...(a.snap?.ys ?? [])];
  for (const e of a.snapRects) {
    const [ex, ey, ew, eh] = e.rect;
    xs.push(imgLeft + ex * s, imgLeft + (ex + ew) * s);
    ys.push(imgTop + ey * s, imgTop + (ey + eh) * s);
  }

  let left = start.x;
  let right = start.x + start.w;
  let top = start.y;
  let bottom = start.y + start.h;
  if (handle.includes('w')) left = rect.x;
  if (handle.includes('e')) right = rect.x + rect.w;
  if (handle.includes('n')) top = rect.y;
  if (handle.includes('s')) bottom = rect.y + rect.h;

  const thr = SNAP_PX / pxPerWorld;
  const snapL = handle.includes('w') ? nearest(left, xs, thr) : null;
  const snapR = handle.includes('e') ? nearest(right, xs, thr) : null;
  const snapT = handle.includes('n') ? nearest(top, ys, thr) : null;
  const snapB = handle.includes('s') ? nearest(bottom, ys, thr) : null;
  if (snapL !== null) left = snapL;
  if (snapR !== null) right = snapR;
  if (snapT !== null) top = snapT;
  if (snapB !== null) bottom = snapB;

  left = clamp(left, imgLeft, imgRight);
  right = clamp(right, imgLeft, imgRight);
  top = clamp(top, imgTop, imgBottom);
  bottom = clamp(bottom, imgTop, imgBottom);
  const minW = MIN_SRC * s;
  const minH = MIN_SRC * s;
  if (right - left < minW) handle.includes('w') ? (left = right - minW) : (right = left + minW);
  if (bottom - top < minH) handle.includes('n') ? (top = bottom - minH) : (bottom = top + minH);

  const v: { pos: number; start: number; end: number }[] = [];
  const h: { pos: number; start: number; end: number }[] = [];
  if (snapL !== null) v.push({ pos: left, start: top, end: bottom });
  if (snapR !== null) v.push({ pos: right, start: top, end: bottom });
  if (snapT !== null) h.push({ pos: top, start: left, end: right });
  if (snapB !== null) h.push({ pos: bottom, start: left, end: right });

  const crop: Rect4 = [
    Math.round((left - imgLeft) / s),
    Math.round((top - imgTop) / s),
    Math.round((right - left) / s),
    Math.round((bottom - top) / s),
  ];
  return {
    rect: { x: left, y: top, w: right - left, h: bottom - top },
    patch: { crop } as never,
    guides: v.length || h.length ? { v, h } : null,
  };
}

/** Draw a source-rect window of `img` to fill `canvas` (native-res backing). */
export function drawWindow(canvas: HTMLCanvasElement, img: HTMLImageElement, crop: Rect4): void {
  const [sx, sy, sw, sh] = crop;
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
}

function nearest(value: number, candidates: number[], thr: number): number | null {
  let best: number | null = null;
  let bestD = thr;
  for (const c of candidates) {
    const d = Math.abs(c - value);
    if (d <= bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
