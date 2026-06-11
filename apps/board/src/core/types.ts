export type NodeId = string;

export interface BaseNode {
  id: NodeId;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Free-floating text block; `content` is sanitized HTML. Height follows content. */
export interface TextNode extends BaseNode {
  type: 'text';
  content: string;
  fontSize: number;
  /** heading preset: bold with tight line-height */
  bold?: boolean;
}

/** Rich HTML card with a visible body. `content` is sanitized HTML. */
export interface CardNode extends BaseNode {
  type: 'card';
  content: string;
  fill: string;
}

/** Live React component from the widget registry; state lives in React, props in the doc. */
export interface WidgetNode extends BaseNode {
  type: 'widget';
  component: string;
  props?: Record<string, unknown>;
}

export type BNode = TextNode | CardNode | WidgetNode;

export interface BoardDoc {
  version: 1;
  nodes: Record<NodeId, BNode>;
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

export function emptyDoc(): BoardDoc {
  return { version: 1, nodes: {}, nodeOrder: [] };
}

export function nodeRect(n: BNode): Rect {
  return { x: n.x, y: n.y, w: n.w, h: n.h };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
