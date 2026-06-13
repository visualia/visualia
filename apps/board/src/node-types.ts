import type { CardNode, ImageNode, TextNode, VideoNode } from '@visualia/engine';
import type { WidgetNode } from '@visualia/shadcn';
import type { ThreeNode } from '@visualia/three';
import type { WebsiteNode } from './website-kind';

export type { CardNode, ImageNode, TextNode, VideoNode } from '@visualia/engine';
export type { WidgetNode } from '@visualia/shadcn';
export type { ThreeNode } from '@visualia/three';
export type { WebsiteNode } from './website-kind';

/** This app's node union — the engine itself only knows BaseNode. */
export type BNode = TextNode | CardNode | WidgetNode | ThreeNode | ImageNode | VideoNode | WebsiteNode;
