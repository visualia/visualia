import { baseNodeValid, type BaseNode, type NodeKind } from '@visualia/engine';
import { getThreeFarm } from './farm';

/** A 3D glTF/GLB model rendered by the shared three.js farm. */
export interface ThreeNode extends BaseNode {
  type: 'three';
  /** glTF/GLB url */
  src: string;
  /** slow turntable rotation (default true) */
  spin?: boolean;
}

/**
 * Texture-path 3D: the farm renders the model into a 2D canvas inside the
 * node's content element. In GL mode the engine captures that canvas like
 * any live content (one texture per node, recaptured while visible); in DOM
 * fallback mode the canvas is simply visible. Scales to many models on one
 * shared WebGL context — unlike overlay-mode (model-viewer) nodes, these
 * respect z-order and content LOD.
 */
export function threeKind(): NodeKind<ThreeNode> {
  const farm = getThreeFarm();
  return {
    type: 'three',
    content: {
      mode: 'texture',
      height: 'fixed',
      minPx: 24, // far zoom: skip the texture; nothing draws (no chrome) — fine for a floating model
      mount(el, node, ctx) {
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        el.appendChild(canvas);
        farm.register(node.id, node.src, canvas, ctx.mode, node.spin !== false);
      },
      update(_el, node) {
        farm.setSrc(node.id, node.src);
        farm.setSpin(node.id, node.spin !== false);
      },
      unmount(_el, id) {
        farm.unregister(id);
      },
      contentKey: (n) => n.src,
      // always live: el === null is the policy query (⇒ capture at scale 1,
      // no mips); with el it doubles as the farm's visibility heartbeat
      live(node, el) {
        if (el) farm.seen(node.id);
        return true;
      },
    },
    defaults: { w: 320, h: 320 },
    deserialize(raw) {
      if (!baseNodeValid(raw) || raw.type !== 'three') return null;
      const o = raw as ThreeNode;
      return typeof o.src === 'string' ? o : null;
    },
  };
}
