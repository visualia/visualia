import { baseNodeValid, type BaseNode, type NodeKind } from './kinds';

/** A bitmap image; GL mode uploads it directly as a texture (no DOM capture). */
export interface ImageNode extends BaseNode {
  type: 'image';
  src: string;
}

/** A muted looping video; GL mode re-uploads frames while it plays. */
export interface VideoNode extends BaseNode {
  type: 'video';
  src: string;
}

/**
 * Media kinds take the direct texImage2D path in GL mode (ContentSpec.source):
 * standard WebGL media-upload CORS semantics instead of html-to-canvas capture
 * restrictions, native-resolution pixels with mips, and failures stay per-node
 * (a tainted source logs a warning and the node renders without content; in
 * DOM fallback mode the element is plain visible DOM either way).
 * Hosts must allow CORS (`crossorigin=anonymous`) for the GL path.
 */
export function imageKind(): NodeKind<ImageNode> {
  return {
    type: 'image',
    content: {
      mode: 'texture',
      height: 'fixed',
      minPx: 4,
      mount(el, node, ctx) {
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.draggable = false;
        img.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;';
        img.onload = () => ctx.invalidate?.(); // texture upload retries once decodable
        img.src = node.src;
        el.appendChild(img);
      },
      update(el, node) {
        const img = el.querySelector('img');
        if (img && img.getAttribute('src') !== node.src) img.src = node.src;
      },
      contentKey: (n) => n.src,
      source(_n, el) {
        const img = el.querySelector('img');
        return img && img.complete && img.naturalWidth > 0 ? img : null;
      },
    },
    defaults: { w: 320, h: 240 },
    deserialize(raw) {
      if (!baseNodeValid(raw) || raw.type !== 'image') return null;
      const o = raw as ImageNode;
      return typeof o.src === 'string' ? o : null;
    },
  };
}

export function videoKind(): NodeKind<VideoNode> {
  return {
    type: 'video',
    content: {
      mode: 'texture',
      height: 'fixed',
      minPx: 4,
      mount(el, node, ctx) {
        const v = document.createElement('video');
        v.crossOrigin = 'anonymous';
        v.muted = true;
        v.loop = true;
        v.autoplay = true;
        v.playsInline = true;
        v.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;';
        v.addEventListener('loadeddata', () => ctx.invalidate?.());
        v.src = node.src;
        el.appendChild(v);
      },
      update(el, node) {
        const v = el.querySelector('video');
        if (v && v.getAttribute('src') !== node.src) v.src = node.src;
      },
      contentKey: (n) => n.src,
      // playing ⇒ re-upload every frame (el === null is the capture-policy query)
      live(_n, el) {
        if (!el) return true;
        const v = el.querySelector('video');
        return !!v && v.readyState >= 2 && !v.paused;
      },
      source(_n, el) {
        const v = el.querySelector('video');
        return v && v.readyState >= 2 ? v : null;
      },
    },
    defaults: { w: 320, h: 180 },
    deserialize(raw) {
      if (!baseNodeValid(raw) || raw.type !== 'video') return null;
      const o = raw as VideoNode;
      return typeof o.src === 'string' ? o : null;
    },
  };
}
