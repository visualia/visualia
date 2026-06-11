import type { CardNode, TextNode } from './core/builtin-kinds';
import type { WidgetNode } from './widgets/registry';

export type { CardNode, TextNode } from './core/builtin-kinds';
export type { WidgetNode } from './widgets/registry';

/** This app's node union — the engine itself only knows BaseNode. */
export type BNode = TextNode | CardNode | WidgetNode;
