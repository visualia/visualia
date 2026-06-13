import { baseNodeValid, type BaseNode, type NodeKind, type ResizeConstraint } from '@visualia/engine';
import { cropConstrain, drawWindow } from './croppable';

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
 * drawn at scale `w/crop.w`. Dragging an edge/corner **crops** (see
 * cropConstrain) — it pins the pixels and moves the window, snapping to the
 * captured element bounds (`rects`). Self-contained, so crop survives reload and the
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
  const img = bitmaps.get(canvas);
  if (img && img.complete && img.naturalWidth) {
    drawWindow(canvas, img, node.crop);
    return;
  }
  // placeholder: an empty frame (just a thin outline) while it renders
  const [, , sw, sh] = node.crop;
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const lw = Math.max(1, canvas.width * 0.0015);
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = lw;
  ctx.strokeRect(lw / 2, lw / 2, canvas.width - lw, canvas.height - lw);
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
    capabilities: () => ({ selectable: true, movable: true, resizable: true }),
    // edges/corners crop the screenshot window (content pinned)
    resizeConstrain(start, rect, handle, pxPerWorld): ResizeConstraint<WebsiteNode> {
      return cropConstrain({
        start,
        rect,
        handle,
        pxPerWorld,
        srcW: start.pageW,
        srcH: start.pageH,
        startCrop: start.crop,
        snapRects: start.rects,
      }) as ResizeConstraint<WebsiteNode>;
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
