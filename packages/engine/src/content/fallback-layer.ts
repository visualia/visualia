import type { Camera } from '../camera/camera';
import type { KindRegistry } from '../core/kinds';
import type { Store } from '../core/store';
import type { BaseNode } from '../core/types';
import { ContentLayer, type NodeRefs } from './content-layer';

/**
 * Classic DOM overlay for browsers without HTML-in-canvas: one container div
 * carries the camera transform, node wrappers are statically positioned in
 * world coordinates. The transparent WebGL canvas above draws selection
 * chrome; node chrome (kind.chrome) renders as CSS background here.
 */
export class FallbackContentLayer extends ContentLayer {
  readonly mode = 'dom' as const;

  constructor(
    layer: HTMLElement,
    private inner: HTMLElement,
    store: Store,
    registry: KindRegistry,
    private camera: Camera,
  ) {
    super(store, registry);
    layer.hidden = false;
  }

  protected container(): HTMLElement {
    return this.inner;
  }

  sync(_visible: BaseNode[]): void {
    const cam = this.camera;
    this.inner.style.transform = `translate(${-cam.x * cam.z}px, ${-cam.y * cam.z}px) scale(${cam.z})`;
  }

  protected override applyNodeStyle(node: BaseNode, r: NodeRefs): void {
    super.applyNodeStyle(node, r);
    r.wrapper.style.transform = `translate(${node.x}px, ${node.y}px)`;
    // chrome as DOM so it stacks correctly with other nodes via z-index
    const chrome = this.registry.of(node)?.chrome?.(node) ?? null;
    r.wrapper.style.background = chrome?.fill ?? '';
    r.wrapper.style.borderRadius = chrome?.radius ? `${chrome.radius}px` : '';
  }
}
