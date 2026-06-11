import { Emitter } from '../core/emitter';
import type { NodeId } from '../core/types';

export class Selection extends Emitter<{ change: ReadonlySet<NodeId> }> {
  readonly ids = new Set<NodeId>();

  has(id: NodeId): boolean {
    return this.ids.has(id);
  }

  get size(): number {
    return this.ids.size;
  }

  set(ids: Iterable<NodeId>): void {
    this.ids.clear();
    for (const id of ids) this.ids.add(id);
    this.emit('change', this.ids);
  }

  toggle(id: NodeId): void {
    if (this.ids.has(id)) this.ids.delete(id);
    else this.ids.add(id);
    this.emit('change', this.ids);
  }

  clear(): void {
    if (!this.ids.size) return;
    this.ids.clear();
    this.emit('change', this.ids);
  }

  /** Drop ids that no longer exist. */
  prune(exists: (id: NodeId) => boolean): void {
    let changed = false;
    for (const id of [...this.ids]) {
      if (!exists(id)) {
        this.ids.delete(id);
        changed = true;
      }
    }
    if (changed) this.emit('change', this.ids);
  }
}
