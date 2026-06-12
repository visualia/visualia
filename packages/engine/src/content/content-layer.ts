import type { KindCtx, KindRegistry } from '../core/kinds';
import type { Store } from '../core/store';
import type { BaseNode, NodeId } from '../core/types';

export interface NodeRefs {
  wrapper: HTMLDivElement;
  content: HTMLDivElement;
}

/**
 * Owns one DOM wrapper per node and keeps it in sync with the store; all
 * per-kind behavior (content rendering, sizing policy) is dispatched through
 * the injected KindRegistry. Two implementations: CanvasContentLayer
 * (HTML-in-canvas: invisible-but-interactive canvas children drawn via
 * texElementImage2D) and FallbackContentLayer (visible transformed overlay).
 */
export abstract class ContentLayer {
  abstract readonly mode: 'gl' | 'dom';
  /** handed to kinds via ctx.invalidate (GL layer wires it to Board.invalidate) */
  protected ctxInvalidate: (() => void) | undefined;
  protected refs = new Map<NodeId, NodeRefs>();
  /** nodeOrder positions, rebuilt on structural sync — avoids O(n²) indexOf */
  protected orderIndex = new Map<NodeId, number>();
  editingId: NodeId | null = null;

  constructor(
    protected store: Store,
    protected registry: KindRegistry,
  ) {}

  /** Parent that node wrappers must be appended to. */
  protected abstract container(): HTMLElement;

  /** Per-node parent override (e.g. overlay-rendered media in GL mode). */
  protected containerFor(_node: BaseNode): HTMLElement {
    return this.container();
  }

  /** Per-frame: position visible wrappers; park the rest. */
  abstract sync(visible: BaseNode[]): void;

  /** Capture scale for the node (1 in DOM mode). */
  contentScale(_id: NodeId): number {
    return 1;
  }

  protected ctx(id: NodeId): KindCtx {
    return { editing: this.editingId === id, scale: this.contentScale(id), mode: this.mode, invalidate: this.ctxInvalidate };
  }

  elementFor(id: NodeId): NodeRefs | null {
    return this.refs.get(id) ?? null;
  }

  /** Reconcile wrappers with the document (creation, removal, content/size). */
  syncFromStore(ids?: NodeId[]): void {
    const doc = this.store.doc;
    if (!ids) {
      this.orderIndex.clear();
      doc.nodeOrder.forEach((id, i) => this.orderIndex.set(id, i));
    }
    for (const [id] of this.refs) {
      if (!doc.nodes[id]) this.removeWrapper(id);
    }
    const target = ids ?? doc.nodeOrder;
    for (const id of target) {
      const node = doc.nodes[id];
      if (!node) continue;
      let r = this.refs.get(id);
      if (!r) {
        r = this.createWrapper(node);
        this.refs.set(id, r);
        this.containerFor(node).appendChild(r.wrapper);
        this.registry.of(node)?.content?.mount?.(r.content, node, this.ctx(id));
      }
      this.applyNodeStyle(node, r);
    }
  }

  setEditing(id: NodeId | null): void {
    if (this.editingId && this.editingId !== id) {
      const prev = this.refs.get(this.editingId);
      if (prev) {
        prev.wrapper.style.pointerEvents = 'none';
        prev.content.contentEditable = 'false';
      }
    }
    this.editingId = id;
    if (id) {
      const r = this.refs.get(id);
      if (r) r.wrapper.style.pointerEvents = 'auto';
    }
  }

  /** Content height in world units (for auto-height kinds), or null. */
  measureContentHeight(id: NodeId): number | null {
    const r = this.refs.get(id);
    if (!r) return null;
    const h = r.content.offsetHeight; // CSS zoom keeps offset* in pre-zoom units = world units
    return h > 0 ? h : null;
  }

  dispose(): void {
    for (const id of [...this.refs.keys()]) this.removeWrapper(id);
  }

  protected createWrapper(node: BaseNode): NodeRefs {
    const kind = this.registry.of(node);
    const wrapper = document.createElement('div');
    wrapper.className = `node node-${node.type}${kind?.className ? ` ${kind.className}` : ''}`;
    wrapper.dataset.id = node.id;
    wrapper.dataset.type = node.type; // survives node removal for unmount dispatch
    const content = document.createElement('div');
    content.className = 'node-content';
    wrapper.appendChild(content);
    return { wrapper, content };
  }

  protected removeWrapper(id: NodeId): void {
    const r = this.refs.get(id);
    if (!r) return;
    const node = this.store.node(id);
    const type = node?.type ?? r.wrapper.dataset.type;
    const kind = type ? this.registry.get(type) : undefined;
    kind?.content?.unmount?.(r.content, id);
    r.wrapper.remove();
    this.refs.delete(id);
    if (this.editingId === id) this.editingId = null;
  }

  /** Size + per-kind content update. Subclasses extend for capture scale. */
  protected applyNodeStyle(node: BaseNode, r: NodeRefs): void {
    const s = this.contentScale(node.id);
    // DOM stacking must mirror nodeOrder (matters in fallback mode).
    r.wrapper.style.zIndex = String(this.orderIndex.get(node.id) ?? this.store.doc.nodeOrder.indexOf(node.id));
    r.wrapper.style.width = `${node.w * s}px`;
    r.wrapper.style.height = `${node.h * s}px`;
    r.content.style.width = `${node.w}px`;
    r.content.style.zoom = s === 1 ? '' : String(s);

    const spec = this.registry.of(node)?.content;
    if (!spec) return;
    if (spec.height === 'fixed') {
      r.content.style.height = `${node.h}px`;
      r.content.style.minHeight = '';
    } else if (spec.height === 'min') {
      r.content.style.height = '';
      r.content.style.minHeight = `${node.h}px`;
    } else {
      r.content.style.height = '';
      r.content.style.minHeight = '';
    }
    spec.update(r.content, node, this.ctx(node.id));
  }
}
