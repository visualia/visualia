import type { Store } from './store';
import type { BaseNode, NodeId } from './types';

export interface Command<N extends BaseNode = BaseNode> {
  label: string;
  redo(store: Store<N>): void;
  undo(store: Store<N>): void;
  /** Return true if `next` was absorbed into this command. */
  tryMerge?(next: Command<N>): boolean;
}

const MERGE_WINDOW_MS = 500;
const HISTORY_CAP = 100;

export class History<N extends BaseNode = BaseNode> {
  private undoStack: Command<N>[] = [];
  private redoStack: Command<N>[] = [];
  private lastPushAt = 0;

  /**
   * Record a command. Gestures mutate the store live and pass
   * `alreadyApplied: true`; one-shot commands let push() apply them.
   */
  push(store: Store<N>, cmd: Command<N>, alreadyApplied = false): void {
    if (!alreadyApplied) cmd.redo(store);
    this.redoStack.length = 0;
    const now = performance.now();
    const top = this.undoStack[this.undoStack.length - 1];
    if (top && now - this.lastPushAt < MERGE_WINDOW_MS && top.tryMerge?.(cmd)) {
      this.lastPushAt = now;
      return;
    }
    this.undoStack.push(cmd);
    if (this.undoStack.length > HISTORY_CAP) this.undoStack.shift();
    this.lastPushAt = now;
  }

  undo(store: Store<N>): Command<N> | undefined {
    const cmd = this.undoStack.pop();
    if (!cmd) return undefined;
    cmd.undo(store);
    this.redoStack.push(cmd);
    this.lastPushAt = 0;
    return cmd;
  }

  redo(store: Store<N>): Command<N> | undefined {
    const cmd = this.redoStack.pop();
    if (!cmd) return undefined;
    cmd.redo(store);
    this.undoStack.push(cmd);
    this.lastPushAt = 0;
    return cmd;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Concrete commands

export class AddNodes<N extends BaseNode = BaseNode> implements Command<N> {
  label = 'add';
  constructor(private nodes: { node: N; index: number }[]) {}

  redo(store: Store<N>): void {
    for (const { node, index } of this.nodes) store.addNode(structuredClone(node), index);
  }

  undo(store: Store<N>): void {
    for (const { node } of [...this.nodes].reverse()) store.removeNode(node.id);
  }
}

export class DeleteNodes<N extends BaseNode = BaseNode> implements Command<N> {
  label = 'delete';
  private snapshots: { node: N; index: number }[];

  constructor(store: Store<N>, ids: NodeId[]) {
    this.snapshots = ids
      .map((id) => ({ node: store.node(id), index: store.doc.nodeOrder.indexOf(id) }))
      .filter((s): s is { node: N; index: number } => !!s.node && s.index >= 0)
      .sort((a, b) => a.index - b.index)
      .map((s) => ({ node: structuredClone(s.node), index: s.index }));
  }

  get ids(): NodeId[] {
    return this.snapshots.map((s) => s.node.id);
  }

  redo(store: Store<N>): void {
    for (const { node } of this.snapshots) store.removeNode(node.id);
  }

  undo(store: Store<N>): void {
    for (const { node, index } of this.snapshots) store.addNode(structuredClone(node), index);
  }
}

export type NodePatch<N extends BaseNode = BaseNode> = { before: Partial<N>; after: Partial<N> };

/** Move / resize / content / style changes; used by gestures and nudges. */
export class PatchNodes<N extends BaseNode = BaseNode> implements Command<N> {
  constructor(
    public label: string,
    private patches: Map<NodeId, NodePatch<N>>,
  ) {}

  redo(store: Store<N>): void {
    const m = new Map<NodeId, Partial<N>>();
    for (const [id, p] of this.patches) m.set(id, p.after);
    store.patchNodes(m);
  }

  undo(store: Store<N>): void {
    const m = new Map<NodeId, Partial<N>>();
    for (const [id, p] of this.patches) m.set(id, p.before);
    store.patchNodes(m);
  }

  tryMerge(next: Command<N>): boolean {
    if (!(next instanceof PatchNodes) || next.label !== this.label) return false;
    if (this.label !== 'nudge') return false;
    for (const [id, p] of (next as PatchNodes<N>).patches) {
      const mine = this.patches.get(id);
      if (mine) mine.after = { ...mine.after, ...p.after };
      else this.patches.set(id, p);
    }
    return true;
  }
}
