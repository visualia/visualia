import type { Store } from '../core/store';
import type { BNode, NodeId } from '../core/types';
import { mountWidget, unmountWidget } from '../widgets/host';

export interface NodeRefs {
  wrapper: HTMLDivElement;
  content: HTMLDivElement;
}

/**
 * Owns one DOM wrapper per node and keeps it in sync with the store.
 * Two implementations: CanvasContentLayer (HTML-in-canvas; wrappers are
 * invisible-but-interactive canvas children drawn via texElementImage2D)
 * and FallbackContentLayer (classic visible transformed overlay).
 */
export abstract class ContentLayer {
  abstract readonly mode: 'gl' | 'dom';
  protected refs = new Map<NodeId, NodeRefs>();
  private lastContent = new Map<NodeId, string>();
  editingId: NodeId | null = null;

  constructor(protected store: Store) {}

  /** Parent that node wrappers must be appended to. */
  protected abstract container(): HTMLElement;

  /** Per-node parent override (e.g. overlay-rendered media in GL mode). */
  protected containerFor(_node: BNode): HTMLElement {
    return this.container();
  }

  /** Per-frame: position visible wrappers; park the rest. */
  abstract sync(visible: BNode[]): void;

  /** Capture scale for the node (1 in DOM mode). */
  contentScale(_id: NodeId): number {
    return 1;
  }

  elementFor(id: NodeId): NodeRefs | null {
    return this.refs.get(id) ?? null;
  }

  /** Reconcile wrappers with the document (creation, removal, content/size). */
  syncFromStore(ids?: NodeId[]): void {
    const doc = this.store.doc;
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

  /** Content height in world units (for text auto-height), or null. */
  measureContentHeight(id: NodeId): number | null {
    const r = this.refs.get(id);
    if (!r) return null;
    const h = r.content.offsetHeight; // CSS zoom keeps offset* in pre-zoom units = world units
    return h > 0 ? h : null;
  }

  dispose(): void {
    for (const id of [...this.refs.keys()]) this.removeWrapper(id);
  }

  protected createWrapper(node: BNode): NodeRefs {
    const wrapper = document.createElement('div');
    wrapper.className = `node node-${node.type}`;
    wrapper.dataset.id = node.id;
    const content = document.createElement('div');
    content.className = 'node-content';
    wrapper.appendChild(content);
    return { wrapper, content };
  }

  protected removeWrapper(id: NodeId): void {
    const r = this.refs.get(id);
    if (!r) return;
    unmountWidget(id);
    r.wrapper.remove();
    this.refs.delete(id);
    this.lastContent.delete(id);
    if (this.editingId === id) this.editingId = null;
  }

  /** Size + typography + content. Subclasses extend for capture scale. */
  protected applyNodeStyle(node: BNode, r: NodeRefs): void {
    const s = this.contentScale(node.id);
    // DOM stacking must mirror nodeOrder (matters in fallback mode).
    r.wrapper.style.zIndex = String(this.store.doc.nodeOrder.indexOf(node.id));
    r.wrapper.style.width = `${node.w * s}px`;
    r.wrapper.style.height = `${node.h * s}px`;
    r.content.style.width = `${node.w}px`;
    if (node.type === 'card') r.content.style.minHeight = `${node.h}px`;
    r.content.style.zoom = s === 1 ? '' : String(s);
    if (node.type === 'text') {
      r.content.style.fontSize = `${node.fontSize}px`;
      r.content.style.fontWeight = node.bold ? '700' : '';
      r.content.style.lineHeight = node.bold ? '1.15' : '';
    }
    if (node.type === 'widget') {
      r.content.style.height = `${node.h}px`;
      mountWidget(r.content, node); // React owns this subtree; never innerHTML it
      return;
    }
    // Never rewrite the DOM under an active edit session — it would kill the caret.
    if (this.editingId !== node.id && this.lastContent.get(node.id) !== node.content) {
      r.content.innerHTML = node.content;
      this.lastContent.set(node.id, node.content);
    }
  }

  /** Called by the edit controller after reading edited DOM back into the store. */
  noteContentSynced(id: NodeId, content: string): void {
    this.lastContent.set(id, content);
  }
}
