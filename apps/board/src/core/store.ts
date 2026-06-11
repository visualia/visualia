import { Emitter } from './emitter';
import type { BNode, BoardDoc, NodeId } from './types';
import { emptyDoc } from './types';

export interface StoreEvents {
  /** Any document mutation. `structural` = nodes added/removed/reordered. */
  change: { ids: NodeId[]; structural: boolean };
  /** Whole document replaced (load). */
  reset: undefined;
}

/**
 * Holds the document. All mutations go through these methods so listeners
 * (renderer, content layer, persistence) stay in sync. Undo/redo is layered
 * on top in history.ts — these methods themselves record nothing.
 */
export class Store extends Emitter<StoreEvents> {
  doc: BoardDoc = emptyDoc();

  node(id: NodeId): BNode | undefined {
    return this.doc.nodes[id];
  }

  /** Back-to-front iteration following z-order. */
  orderedNodes(): BNode[] {
    const out: BNode[] = [];
    for (const id of this.doc.nodeOrder) {
      const n = this.doc.nodes[id];
      if (n) out.push(n);
    }
    return out;
  }

  replaceDoc(doc: BoardDoc): void {
    this.doc = doc;
    this.emit('reset', undefined);
    this.emit('change', { ids: doc.nodeOrder.slice(), structural: true });
  }

  addNode(node: BNode, index?: number): void {
    this.doc.nodes[node.id] = node;
    const i = index === undefined ? this.doc.nodeOrder.length : index;
    this.doc.nodeOrder.splice(i, 0, node.id);
    this.emit('change', { ids: [node.id], structural: true });
  }

  removeNode(id: NodeId): void {
    delete this.doc.nodes[id];
    const i = this.doc.nodeOrder.indexOf(id);
    if (i >= 0) this.doc.nodeOrder.splice(i, 1);
    this.emit('change', { ids: [id], structural: true });
  }

  patchNode(id: NodeId, patch: Partial<BNode>): void {
    const n = this.doc.nodes[id];
    if (!n) return;
    Object.assign(n, patch);
    this.emit('change', { ids: [id], structural: false });
  }

  patchNodes(patches: ReadonlyMap<NodeId, Partial<BNode>>): void {
    const ids: NodeId[] = [];
    for (const [id, patch] of patches) {
      const n = this.doc.nodes[id];
      if (!n) continue;
      Object.assign(n, patch);
      ids.push(id);
    }
    if (ids.length) this.emit('change', { ids, structural: false });
  }

  bringToFront(id: NodeId): void {
    const i = this.doc.nodeOrder.indexOf(id);
    if (i < 0 || i === this.doc.nodeOrder.length - 1) return;
    this.doc.nodeOrder.splice(i, 1);
    this.doc.nodeOrder.push(id);
    this.emit('change', { ids: [id], structural: true });
  }
}
