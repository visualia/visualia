/// <reference path="./canvas-api.d.ts" />

// facade
export { Board, createBoard, type BoardOptions } from './board';

// node kinds
export {
  KindRegistry,
  baseNodeValid,
  htmlBehavior,
  sanitizeHtml,
  type ActivateEditSpec,
  type BaseNode,
  type ChromeStyle,
  type ContentSpec,
  type EditSpec,
  type HtmlBehaviorOpts,
  type HtmlEditSpec,
  type KindCtx,
  type NodeCaps,
  type NodeKind,
  type ResizeConstraint,
  type ResizeGuide,
} from './core/kinds';
export { frameKind, textKind, type CardNode, type TextNode } from './core/builtin-kinds';
export { proxyResolver, videoKind, type MediaKindOpts, type VideoNode } from './core/media-kinds';

// document / commands
export { Store, type StoreEvents } from './core/store';
export {
  AddNodes,
  DeleteNodes,
  History,
  PatchNodes,
  type Command,
  type NodePatch,
} from './core/history';
export {
  emptyDoc,
  newNodeId,
  nodeRect,
  rectsIntersect,
  type BoardDoc,
  type CameraState,
  type NodeId,
  type Point,
  type Rect,
} from './core/types';
export { Emitter } from './core/emitter';
export { Autosaver, loadCamera, loadDoc } from './core/persistence';

// camera / interaction
export { Camera, clampZ, MAX_Z, MIN_Z } from './camera/camera';
export { CameraAnim } from './camera/camera-anim';
export { Selection } from './interact/selection';
export { handleAt, hitNode, nodesInRect, type Handle } from './interact/hit-test';
export { snapBBox, type GuideSeg, type SnapResult } from './interact/snap';

// input / editing
export { PointerController, type InputHost, type Tool, type ToolEvent } from './input/input';
export { builtinLayouts, type Layout, type LayoutCtx, type LayoutParams } from './layout/layout';
export { groupOf, type GroupOpts } from './interact/group';
export { resolveInteraction, type InteractionCaps, type InteractionOption } from './input/interaction';
export { HandTool, SelectTool } from './input/tools';
export { KeyboardController, defaultKeymap, type KeyBinding, type KeyboardOptions } from './input/keyboard';
export { EditController } from './content/edit';
export type { ContentLayer, NodeRefs } from './content/content-layer';
