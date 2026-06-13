import type { BaseNode, NodeId } from '../core/types';

/**
 * Inferred grouping (plans/grouping.md): which nodes "go together", read live
 * from the layout — no stored group objects. A container (frame) + the nodes
 * inside it is a hard group; otherwise a scale-aware single-linkage proximity
 * component (so a tight grid, or a header sitting just above its cluster, comes
 * along). Pure geometry, peer to `snap`.
 */

const LINK_K = 0.4; // gap < k·(smaller node's mean size) links two nodes
const LINK_MIN = 28; // px floor (tiny nodes still grab close neighbours)
const LINK_MAX = 140; // px ceil (huge nodes don't swallow the board)

function gap(a: BaseNode, b: BaseNode): number {
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.max(dx, dy);
}

function linkThreshold(a: BaseNode, b: BaseNode): number {
  const s = Math.min((a.w + a.h) / 2, (b.w + b.h) / 2);
  return Math.min(LINK_MAX, Math.max(LINK_MIN, LINK_K * s));
}

function centerInside(child: BaseNode, frame: BaseNode): boolean {
  const cx = child.x + child.w / 2;
  const cy = child.y + child.h / 2;
  return cx >= frame.x && cx <= frame.x + frame.w && cy >= frame.y && cy <= frame.y + frame.h;
}

export interface GroupOpts {
  /** which nodes are containers (hard groups for their contents); default: none */
  isFrame?(n: BaseNode): boolean;
}

/** The inferred group `target` belongs to (its own id always included). */
export function groupOf(target: BaseNode, nodes: readonly BaseNode[], opts: GroupOpts = {}): NodeId[] {
  const isFrame = opts.isFrame ?? (() => false);

  // containment: a frame + the nodes centred inside it is a hard group
  const container = isFrame(target) ? target : nodes.find((f) => isFrame(f) && centerInside(target, f));
  if (container) {
    return [container.id, ...nodes.filter((n) => n.id !== container.id && centerInside(n, container)).map((n) => n.id)];
  }

  // proximity single-linkage component over the loose (non-frame) nodes
  const pool = nodes.filter((n) => !isFrame(n));
  const inComp = new Set<NodeId>([target.id]);
  const frontier: BaseNode[] = [target];
  while (frontier.length) {
    const a = frontier.pop()!;
    for (const b of pool) {
      if (inComp.has(b.id)) continue;
      if (gap(a, b) <= linkThreshold(a, b)) {
        inComp.add(b.id);
        frontier.push(b);
      }
    }
  }
  return [...inComp];
}
