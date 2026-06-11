import type { Camera } from '../camera/camera';
import type { Store } from '../core/store';
import type { BNode } from '../core/types';
import { ContentLayer, type NodeRefs } from './content-layer';

/**
 * Classic DOM overlay for browsers without HTML-in-canvas: one container div
 * carries the camera transform, node wrappers are statically positioned in
 * world coordinates. WebGL underneath still draws grid/chrome/overlay.
 */
export class FallbackContentLayer extends ContentLayer {
  readonly mode = 'dom' as const;

  constructor(
    layer: HTMLElement,
    private inner: HTMLElement,
    store: Store,
    private camera: Camera,
  ) {
    super(store);
    layer.hidden = false;
  }

  protected container(): HTMLElement {
    return this.inner;
  }

  sync(_visible: BNode[]): void {
    const cam = this.camera;
    this.inner.style.transform = `translate(${-cam.x * cam.z}px, ${-cam.y * cam.z}px) scale(${cam.z})`;
  }

  protected override applyNodeStyle(node: BNode, r: NodeRefs): void {
    super.applyNodeStyle(node, r);
    r.wrapper.style.transform = `translate(${node.x}px, ${node.y}px)`;
    // card bodies are DOM here (GL is a transparent overlay above), so they
    // stack correctly with other nodes via z-index
    r.wrapper.style.background = node.type === 'card' ? node.fill : '';
  }
}
