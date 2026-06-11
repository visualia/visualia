export type NodeId = string;

/** Minimal shape every node shares; kinds extend it with their own fields. */
export interface BaseNode {
  id: NodeId;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardDoc<N extends BaseNode = BaseNode> {
  version: 1;
  nodes: Record<NodeId, N>;
  /** z-order, back-to-front */
  nodeOrder: NodeId[];
}

export interface CameraState {
  /** world coords of the viewport's top-left corner */
  x: number;
  y: number;
  /** zoom: screen CSS px per world unit */
  z: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function newNodeId(): NodeId {
  return crypto.randomUUID().slice(0, 8);
}

export function emptyDoc<N extends BaseNode = BaseNode>(): BoardDoc<N> {
  return { version: 1, nodes: {}, nodeOrder: [] };
}

export function nodeRect(n: BaseNode): Rect {
  return { x: n.x, y: n.y, w: n.w, h: n.h };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
