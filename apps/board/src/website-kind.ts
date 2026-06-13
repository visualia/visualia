import { baseNodeValid, type BaseNode, type NodeKind, type ResizeConstraint } from '@visualia/engine';

const SNAP_PX = 7; // screen-space snap radius for crop edges
const MIN_SRC = 16; // smallest croppable window, in source px

/** a captured element's bounds in source (screenshot) px */
export interface WebRect {
  id: string;
  tag: string;
  rect: [number, number, number, number];
  text: string;
}

/**
 * A captured website: the full screenshot (`src`) shown through a movable
 * window. `crop` is the visible source-px rect; the node's w/h is that window
 * drawn at scale `w/crop.w`. Resizing an edge **crops** (see resizeConstrain) —
 * the pixels stay pinned, only the window changes — snapping to the captured
 * element bounds (`rects`). Self-contained, so crop survives reload and the
 * canvas source textures in GL just like a plain image.
 */
export interface WebsiteNode extends BaseNode {
  type: 'website';
  src: string;
  crop: [number, number, number, number]; // visible source rect (px)
  pageW: number;
  pageH: number;
  rects: WebRect[];
  sourceUrl?: string;
  title?: string;
}

/** loaded screenshot bitmap per content canvas (keyed weakly, GC-friendly) */
const bitmaps = new WeakMap<HTMLCanvasElement, HTMLImageElement>();

function draw(canvas: HTMLCanvasElement, node: WebsiteNode): void {
  const [sx, sy, sw, sh] = node.crop;
  // backing store at native source resolution → crisp at any zoom / GL upload
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = bitmaps.get(canvas);
  if (!img || !img.complete || !img.naturalWidth) {
    // placeholder: an empty frame (no fill) with a faint label, while the
    // screenshot still renders
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const lw = Math.max(1, canvas.width * 0.0015);
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = lw;
    ctx.strokeRect(lw / 2, lw / 2, canvas.width - lw, canvas.height - lw);
    const label = node.title || node.sourceUrl || 'Loading…';
    const fs = Math.min(40, Math.max(16, canvas.width * 0.02));
    ctx.fillStyle = '#b4b4bb';
    ctx.font = `${fs}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(label.slice(0, 64), fs, fs);
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
}

export function websiteKind(): NodeKind<WebsiteNode> {
  return {
    type: 'website',
    className: 'node-website',
    content: {
      mode: 'texture', // the canvas is a valid texImage2D source → GL uploads it
      height: 'fixed',
      minPx: 4,
      mount(el, node, ctx) {
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'display:block;width:100%;height:100%;';
        el.appendChild(canvas);
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          draw(canvas, node);
          ctx.invalidate?.(); // GL re-uploads once decodable
        };
        img.src = node.src; // same-origin /capture-img — no proxy, canvas stays clean
        bitmaps.set(canvas, img);
        draw(canvas, node);
      },
      update(el, node) {
        const canvas = el.querySelector('canvas');
        if (canvas) draw(canvas, node);
      },
      contentKey: (n) => `${n.src}|${n.crop.join(',')}`,
      source(_n, el) {
        const canvas = el.querySelector('canvas');
        return canvas && canvas.width > 0 ? canvas : null;
      },
    },
    // edges crop, never scale; moving relocates without touching the window
    capabilities: () => ({ selectable: true, movable: true, resizable: true }),
    resizeConstrain(start, rect, pxPerWorld): ResizeConstraint<WebsiteNode> {
      const s = start.w / start.crop[2]; // world px per source px — fixed while cropping
      // world position of source-px (0,0), i.e. the pinned screenshot origin
      const imgLeft = start.x - start.crop[0] * s;
      const imgTop = start.y - start.crop[1] * s;
      const imgRight = imgLeft + start.pageW * s;
      const imgBottom = imgTop + start.pageH * s;

      // candidate snap lines: every element edge (+ the image bounds), in world
      const xs: number[] = [imgLeft, imgRight];
      const ys: number[] = [imgTop, imgBottom];
      for (const e of start.rects) {
        const [ex, ey, ew, eh] = e.rect;
        xs.push(imgLeft + ex * s, imgLeft + (ex + ew) * s);
        ys.push(imgTop + ey * s, imgTop + (ey + eh) * s);
      }

      let left = rect.x;
      let right = rect.x + rect.w;
      let top = rect.y;
      let bottom = rect.y + rect.h;
      const eps = 1e-3;
      const movedL = Math.abs(left - start.x) > eps;
      const movedR = Math.abs(right - (start.x + start.w)) > eps;
      const movedT = Math.abs(top - start.y) > eps;
      const movedB = Math.abs(bottom - (start.y + start.h)) > eps;
      const thr = SNAP_PX / pxPerWorld;

      const guides: { v: { pos: number; start: number; end: number }[]; h: { pos: number; start: number; end: number }[] } = { v: [], h: [] };
      let snapL: number | null = null, snapR: number | null = null, snapT: number | null = null, snapB: number | null = null;
      if (movedL) snapL = nearest(left, xs, thr);
      if (movedR) snapR = nearest(right, xs, thr);
      if (movedT) snapT = nearest(top, ys, thr);
      if (movedB) snapB = nearest(bottom, ys, thr);
      if (snapL !== null) left = snapL;
      if (snapR !== null) right = snapR;
      if (snapT !== null) top = snapT;
      if (snapB !== null) bottom = snapB;

      // never crop outside the screenshot
      left = clamp(left, imgLeft, imgRight);
      right = clamp(right, imgLeft, imgRight);
      top = clamp(top, imgTop, imgBottom);
      bottom = clamp(bottom, imgTop, imgBottom);
      // keep a minimum window (in world units), pushing the moved edge back
      const minW = MIN_SRC * s;
      const minH = MIN_SRC * s;
      if (right - left < minW) {
        if (movedL && !movedR) left = right - minW;
        else right = left + minW;
      }
      if (bottom - top < minH) {
        if (movedT && !movedB) top = bottom - minH;
        else bottom = top + minH;
      }

      // red alignment lines along the edges that caught
      if (snapL !== null) guides.v.push({ pos: left, start: top, end: bottom });
      if (snapR !== null) guides.v.push({ pos: right, start: top, end: bottom });
      if (snapT !== null) guides.h.push({ pos: top, start: left, end: right });
      if (snapB !== null) guides.h.push({ pos: bottom, start: left, end: right });

      const crop: [number, number, number, number] = [
        Math.round((left - imgLeft) / s),
        Math.round((top - imgTop) / s),
        Math.round((right - left) / s),
        Math.round((bottom - top) / s),
      ];
      return {
        rect: { x: left, y: top, w: right - left, h: bottom - top },
        patch: { crop },
        guides: guides.v.length || guides.h.length ? guides : null,
      };
    },
    defaults: { w: 400, h: 300 },
    deserialize(raw) {
      if (!baseNodeValid(raw) || raw.type !== 'website') return null;
      const o = raw as WebsiteNode;
      if (typeof o.src !== 'string') return null;
      if (!Array.isArray(o.crop) || o.crop.length !== 4 || o.crop.some((n) => typeof n !== 'number')) return null;
      if (typeof o.pageW !== 'number' || typeof o.pageH !== 'number') return null;
      if (!Array.isArray(o.rects)) o.rects = [];
      return o;
    },
  };
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
