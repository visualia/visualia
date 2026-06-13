import type { BaseNode, NodeId } from './types';

export type { BaseNode } from './types';

/** Context handed to content hooks. */
export interface KindCtx {
  /** an edit session is active on this node — do NOT rewrite its DOM */
  editing: boolean;
  /** capture scale (CSS zoom) applied to the content element; 1 in DOM mode */
  scale: number;
  mode: 'gl' | 'dom';
  /** request a re-render/re-upload (async content became ready); GL mode only */
  invalidate?(): void;
}

export interface ChromeStyle {
  fill: string;
  radius?: number;
}

/** A snap-guide segment in world coords (mirrors interact/snap's GuideSeg, kept
    local so core doesn't depend on the interact layer). */
export interface ResizeGuide {
  pos: number;
  start: number;
  end: number;
}

/** What a kind returns to reinterpret an edge/corner drag. */
export interface ResizeConstraint<T extends BaseNode = BaseNode> {
  /** the rect to actually apply */
  rect: { x: number; y: number; w: number; h: number };
  /** extra fields to patch alongside the rect (e.g. a crop window) */
  patch?: Partial<T>;
  /** alignment guides to display while dragging (world coords) */
  guides?: { v: ResizeGuide[]; h: ResizeGuide[] } | null;
}

/** Per-node interaction capabilities, intersected with the board's. */
export interface NodeCaps {
  selectable: boolean;
  movable: boolean;
  resizable: boolean;
}

export interface ContentSpec<T extends BaseNode = BaseNode> {
  /** 'overlay' renders as visible DOM above the canvas (media that
      texElementImage2D can't rasterize); 'texture' goes through capture. */
  mode: 'texture' | 'overlay' | ((node: T) => 'texture' | 'overlay');
  /** content element height policy: 'fixed' = node.h, 'min' = min-height
      node.h (content may overflow-hide), 'auto' = follows content (enables
      auto-grow measurement) */
  height: 'fixed' | 'min' | 'auto';
  mount?(el: HTMLElement, node: T, ctx: KindCtx): void;
  /** runs on every store sync — must be idempotent and respect ctx.editing */
  update(el: HTMLElement, node: T, ctx: KindCtx): void;
  unmount?(el: HTMLElement, id: NodeId): void;
  /** fingerprint of everything visually rendered; drives texture recapture */
  contentKey(node: T): string;
  /** GL mode: skip drawing the content texture when the node is narrower than
      this on screen (CSS px), fading out as it approaches — sub-pixel text
      minifies to mush, the chrome rect alone reads better */
  minPx?: number;
  /** GL mode: bypass DOM capture — upload this source directly via standard
      texImage2D (media path: images/video/canvases; per-node CORS semantics
      instead of html-to-canvas capture restrictions). Return null while the
      media isn't decodable yet, and call ctx.invalidate() once it is. */
  source?(node: T, el: HTMLElement): TexImageSource | null;
  /** live content (e.g. playing video): el=null asks "can this be live?"
      (capture policy: live ⇒ scale 1, no mips); el given asks "recapture
      this frame?" */
  live?(node: T, el: HTMLElement | null): boolean;
}

export interface HtmlEditSpec<T extends BaseNode = BaseNode> {
  kind: 'html';
  get(node: T): string;
  /** Build the store patch for committed html (+measured height for
      height:'auto' kinds; null otherwise). */
  set(node: T, html: string, measuredH: number | null): Partial<T>;
  autoHeight?: boolean;
  minHeight?: number;
  /** shrink the box width to the text's natural width (capped at maxWidth) */
  autoWidth?: boolean;
  maxWidth?: number;
  minWidth?: number;
  deleteWhenEmpty?: boolean;
  selectAllOnBegin?: boolean;
}

export interface ActivateEditSpec {
  kind: 'activate';
  /** focus the right control when entering; default: engine heuristic */
  focus?(contentEl: HTMLElement): void;
}

export type EditSpec<T extends BaseNode = BaseNode> = HtmlEditSpec<T> | ActivateEditSpec;

/**
 * A node kind plugs one node type into the engine: how it draws (GL chrome
 * and/or DOM content), how it edits, and how it round-trips persistence.
 */
export interface NodeKind<T extends BaseNode = BaseNode> {
  type: string;
  /** background rect — GL instanced rect in canvas mode, CSS background in DOM fallback */
  chrome?(node: T): ChromeStyle | null;
  content?: ContentSpec<T>;
  edit?: EditSpec<T>;
  /** per-node interaction caps (absent field/result ⇒ allowed); a non-selectable
      node is click-through — presses fall to the node behind it */
  capabilities?(node: T): Partial<NodeCaps> | null;
  /** Reinterpret a live edge/corner resize (e.g. crop a screenshot window
      instead of scaling it). Given the gesture-start node and the proposed
      rect, return the rect to apply, any extra patch, and snap guides. Absent
      ⇒ edges scale normally. `handle` is the dragged handle ('nw','n','ne','e',
      'se','s','sw','w' — corners are length 2, edges length 1). `pxPerWorld` is
      the current camera zoom (for screen-space snap thresholds). */
  resizeConstrain?(
    start: T,
    rect: { x: number; y: number; w: number; h: number },
    handle: string,
    pxPerWorld: number,
    /** world-space sibling anchor lines, so an edge drag snaps to other nodes */
    snap?: { xs: number[]; ys: number[] },
  ): ResizeConstraint<T> | null;
  /** Intrinsic tile sizing for layout (plans/layout.md): given a target width
      (and optional aspect), return the height this kind wants + an optional
      patch to fit it (e.g. a crop window). Absent ⇒ the strategy decides. */
  fitTile?(node: T, w: number, aspect?: number): { h: number; patch?: Partial<T> } | null;
  /** may sanitize/migrate; null ⇒ node dropped on load */
  deserialize(raw: unknown): T | null;
  defaults?: { w: number; h: number };
  /** extra wrapper class beyond `node-${type}` */
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyKind = NodeKind<any>;

export class KindRegistry {
  private kinds = new Map<string, AnyKind>();

  constructor(kinds: AnyKind[]) {
    for (const k of kinds) this.kinds.set(k.type, k);
  }

  get(type: string): AnyKind | undefined {
    return this.kinds.get(type);
  }

  of(node: BaseNode): AnyKind | undefined {
    return this.kinds.get(node.type);
  }

  contentMode(node: BaseNode): 'texture' | 'overlay' | null {
    const c = this.of(node)?.content;
    if (!c) return null;
    return typeof c.mode === 'function' ? c.mode(node) : c.mode;
  }

  isOverlay(node: BaseNode): boolean {
    return this.contentMode(node) === 'overlay';
  }

  liveHint(node: BaseNode): boolean {
    return this.of(node)?.content?.live?.(node, null) ?? false;
  }

  capsOf(node: BaseNode): NodeCaps {
    const c = this.of(node)?.capabilities?.(node);
    return {
      selectable: c?.selectable ?? true,
      movable: c?.movable ?? true,
      resizable: c?.resizable ?? true,
    };
  }
}

/** Validates the shared shape; kinds call this first in deserialize(). */
export function baseNodeValid(raw: unknown): raw is BaseNode {
  if (typeof raw !== 'object' || raw === null) return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.type === 'string' &&
    typeof o.x === 'number' &&
    typeof o.y === 'number' &&
    typeof o.w === 'number' &&
    typeof o.h === 'number'
  );
}

// ---------------------------------------------------------------------------
// htmlBehavior — shared machinery for kinds whose content is an HTML string.
// Owns the load-bearing choreography: innerHTML is only rewritten when the
// stored content actually changed AND no edit session is active (rewriting
// under an active session would destroy the caret); the edit spec records
// commits into the same closure so the post-commit sync doesn't churn the DOM.

export interface HtmlBehaviorOpts<T extends BaseNode> {
  getHtml(node: T): string;
  setHtml(node: T, html: string, measuredH: number | null): Partial<T>;
  /** per-sync inline styles (fontSize, fontWeight…); runs before content diff */
  applyStyle?(el: HTMLElement, node: T): void;
  /** extra fingerprint beyond the html (visual fields like fontSize/bold) */
  styleKey?(node: T): string;
  height: 'min' | 'auto';
  autoHeight?: boolean;
  minHeight?: number;
  autoWidth?: boolean;
  maxWidth?: number;
  minWidth?: number;
  deleteWhenEmpty?: boolean;
  selectAllOnBegin?: boolean;
}

export function htmlBehavior<T extends BaseNode>(
  opts: HtmlBehaviorOpts<T>,
): { content: ContentSpec<T>; edit: HtmlEditSpec<T> } {
  const last = new Map<NodeId, string>();
  return {
    content: {
      mode: 'texture',
      height: opts.height,
      update(el, node, ctx) {
        opts.applyStyle?.(el, node);
        const html = opts.getHtml(node);
        if (!ctx.editing && last.get(node.id) !== html) {
          el.innerHTML = html;
          last.set(node.id, html);
        }
      },
      unmount(_el, id) {
        last.delete(id);
      },
      contentKey(node) {
        return `${opts.getHtml(node)}|${opts.styleKey?.(node) ?? ''}`;
      },
    },
    edit: {
      kind: 'html',
      get: opts.getHtml,
      set(node, html, measuredH) {
        last.set(node.id, html); // committed from the live DOM — already in sync
        return opts.setHtml(node, html, measuredH);
      },
      autoHeight: opts.autoHeight,
      minHeight: opts.minHeight,
      autoWidth: opts.autoWidth,
      maxWidth: opts.maxWidth,
      minWidth: opts.minWidth,
      deleteWhenEmpty: opts.deleteWhenEmpty,
      selectAllOnBegin: opts.selectAllOnBegin,
    },
  };
}

/**
 * Strip active content from an HTML string (script/iframe/object/embed,
 * on* handlers, javascript: urls). Used by kinds on deserialize.
 */
export function sanitizeHtml(html: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_ELEMENT);
  const doomed: Element[] = [];
  for (let el = walker.nextNode() as Element | null; el; el = walker.nextNode() as Element | null) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'iframe' || tag === 'object' || tag === 'embed') {
      doomed.push(el);
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      else if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(attr.value))
        el.removeAttribute(attr.name);
    }
  }
  for (const el of doomed) el.remove();
  return tpl.innerHTML;
}
