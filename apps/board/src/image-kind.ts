import { baseNodeValid, type BaseNode, type NodeKind, type ResizeConstraint } from '@visualia/engine';
import { coverCrop, cropConstrain, drawWindow, type Rect4 } from './croppable';

/**
 * A bitmap image, croppable like a website: dragging an edge/corner crops.
 * `crop` is the visible source-px window (absent ⇒ object-fit-cover of the whole
 * image, computed live). `srcW/srcH` are the image's natural pixels, stamped on
 * insert so the crop interaction knows the source resolution. Rendered through a
 * canvas (same as the website kind) so the window textures in GL.
 */
export interface ImageNode extends BaseNode {
  type: 'image';
  src: string;
  crop?: Rect4;
  srcW?: number;
  srcH?: number;
}

export interface ImageKindOpts {
  resolveSrc?: (src: string) => string;
}

const bitmaps = new WeakMap<HTMLCanvasElement, HTMLImageElement>();

function draw(canvas: HTMLCanvasElement, node: ImageNode): void {
  const img = bitmaps.get(canvas);
  if (!img || !img.complete || !img.naturalWidth) return; // nothing decodable yet
  const crop = node.crop ?? coverCrop(img.naturalWidth, img.naturalHeight, node.w, node.h);
  drawWindow(canvas, img, crop);
}

export function imageKind(opts: ImageKindOpts = {}): NodeKind<ImageNode> {
  const resolve = opts.resolveSrc ?? ((s: string) => s);
  return {
    type: 'image',
    content: {
      mode: 'texture',
      height: 'fixed',
      minPx: 4,
      mount(el, node, ctx) {
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'display:block;width:100%;height:100%;';
        el.appendChild(canvas);
        const img = new Image();
        img.crossOrigin = 'anonymous'; // proxied → same-origin, canvas stays clean
        img.decoding = 'async';
        img.onload = () => {
          draw(canvas, node);
          ctx.invalidate?.();
        };
        const want = resolve(node.src);
        img.dataset.resolved = want;
        img.src = want;
        bitmaps.set(canvas, img);
        draw(canvas, node);
      },
      update(el, node) {
        const canvas = el.querySelector('canvas');
        if (!canvas) return;
        const img = bitmaps.get(canvas);
        // re-resolve when the resolved URL changes — covers a swapped src AND a
        // late `idb://` blob URL becoming available after rehydrate
        if (img) {
          const want = resolve(node.src);
          if (img.dataset.resolved !== want) {
            img.dataset.resolved = want;
            img.src = want;
          }
        }
        draw(canvas, node);
      },
      contentKey: (n) => `${n.src}|${n.crop?.join(',') ?? ''}|${n.w}x${n.h}`,
      source(_n, el) {
        const canvas = el.querySelector('canvas');
        return canvas && canvas.width > 0 ? canvas : null;
      },
    },
    capabilities: () => ({ selectable: true, movable: true, resizable: true }),
    // tile sizing for layout: natural aspect, or cover-fit to a forced aspect
    fitTile(node, w, aspect) {
      if (aspect) {
        const h = Math.round(w / aspect);
        return node.srcW && node.srcH
          ? { h, patch: { crop: coverCrop(node.srcW, node.srcH, w, h) } }
          : { h };
      }
      const sw = node.crop ? node.crop[2] : node.srcW;
      const sh = node.crop ? node.crop[3] : node.srcH;
      return { h: sw && sh ? Math.round((w * sh) / sw) : w };
    },
    // edges/corners crop (content pinned). Needs the source size (stamped on
    // insert); without it, fall back to plain resize.
    resizeConstrain(start, rect, handle, pxPerWorld): ResizeConstraint<ImageNode> | null {
      if (!start.srcW || !start.srcH) return null;
      const startCrop = start.crop ?? coverCrop(start.srcW, start.srcH, start.w, start.h);
      return cropConstrain({
        start,
        rect,
        handle,
        pxPerWorld,
        srcW: start.srcW,
        srcH: start.srcH,
        startCrop,
        snapRects: [],
      }) as ResizeConstraint<ImageNode>;
    },
    defaults: { w: 320, h: 240 },
    deserialize(raw) {
      if (!baseNodeValid(raw) || raw.type !== 'image') return null;
      const o = raw as ImageNode;
      if (typeof o.src !== 'string') return null;
      if (o.crop !== undefined && (!Array.isArray(o.crop) || o.crop.length !== 4)) return null;
      return o;
    },
  };
}

/** Load an image's natural size (for stamping srcW/srcH on insert). */
export function loadImageDims(src: string, resolve: (s: string) => string = (s) => s): Promise<{ w: number; h: number } | null> {
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => res(null);
    img.src = resolve(src);
  });
}
