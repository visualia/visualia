import type { CardNode, TextNode } from '@visualia/engine';
import type { WidgetNode } from '@visualia/shadcn';

export type { CardNode, TextNode } from '@visualia/engine';
export type { WidgetNode } from '@visualia/shadcn';

/** This app's node union — the engine itself only knows BaseNode. */
export type BNode = TextNode | CardNode | WidgetNode;
