import type { BaseNode, NodeId } from './types';

export type { BaseNode } from './types';

/** Context handed to content hooks. */
export interface KindCtx {
  /** an edit session is active on this node — do NOT rewrite its DOM */
  editing: boolean;
  /** capture scale (CSS zoom) applied to the content element; 1 in DOM mode */
  scale: number;
  mode: 'gl' | 'dom';
}

export interface ChromeStyle {
  fill: string;
  radius?: number;
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
