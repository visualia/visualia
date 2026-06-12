import type { Camera } from '../camera/camera';
import type { KindRegistry } from '../core/kinds';
import type { Store } from '../core/store';
import type { BaseNode, NodeId } from '../core/types';
import { ContentLayer, type NodeRefs } from './content-layer';

/**
 * Classic DOM overlay for browsers without HTML-in-canvas: one container div
 * carries the camera transform, node wrappers are statically positioned in
 * world coordinates. The transparent WebGL canvas above draws selection
 * chrome; node chrome (kind.chrome) renders as CSS background here.
 */
const SETTLE_MS = 150;

export class FallbackContentLayer extends ContentLayer {
  readonly mode = 'dom' as const;
  private hidden = new Set<NodeId>();
  private lastCamSig = '';
  private settleTimer: number | undefined;

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

  sync(visible: BaseNode[]): void {
    const cam = this.camera;
    // will-change only while the camera moves: composited (fast) pans, then a
    // demotion on settle so the browser re-rasterizes crisply at the new scale
    const camSig = `${cam.x}|${cam.y}|${cam.z}`;
    if (camSig !== this.lastCamSig) {
      this.lastCamSig = camSig;
      if (this.inner.style.willChange !== 'transform') this.inner.style.willChange = 'transform';
      clearTimeout(this.settleTimer);
      this.settleTimer = window.setTimeout(() => {
        // demote for one painted frame — the raster refreshes at the new
        // scale (crisp) — then re-promote so the next pan composites cheaply
        this.inner.style.willChange = '';
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (this.inner.style.willChange === '') this.inner.style.willChange = 'transform';
          }),
        );
      }, SETTLE_MS);
    }
    this.inner.style.transform = `translate(${-cam.x * cam.z}px, ${-cam.y * cam.z}px) scale(${cam.z})`;
    // cull: offscreen wrappers cost layout/paint even under the layer transform
    const want = new Set<NodeId>();
    for (const n of visible) want.add(n.id);
    if (this.editingId) want.add(this.editingId);
    for (const [id, r] of this.refs) {
      if (want.has(id)) {
        if (this.hidden.delete(id)) r.wrapper.style.display = '';
      } else if (!this.hidden.has(id)) {
        this.hidden.add(id);
        r.wrapper.style.display = 'none';
      }
    }
  }

  protected override removeWrapper(id: NodeId): void {
    this.hidden.delete(id); // a re-added id must not inherit stale cull state
    super.removeWrapper(id);
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
