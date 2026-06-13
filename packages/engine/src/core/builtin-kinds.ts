import { baseNodeValid, htmlBehavior, sanitizeHtml, type NodeKind } from './kinds';
import type { BaseNode } from './types';

/** Free-floating text block; `content` is sanitized HTML. Height follows content. */
export interface TextNode extends BaseNode {
  type: 'text';
  content: string;
  fontSize: number;
  /** heading preset: bold with tight line-height */
  bold?: boolean;
}

/** Filled background rect ("frame") with optional HTML content. */
export interface CardNode extends BaseNode {
  type: 'card';
  content: string;
  fill: string;
}

/** Free text block: auto-height + auto-width, bold preset, deletes itself when emptied. */
export interface TextKindOpts {
  /** auto-height floor in world px (lower it when trimming line boxes via text-box) */
  minHeight?: number;
  /** wrap cap in world px — the box shrinks to its text, but no wider than this */
  maxWidth?: number;
}

export function textKind(opts: TextKindOpts = {}): NodeKind<TextNode> {
  const behavior = htmlBehavior<TextNode>({
    getHtml: (n) => n.content,
    setHtml: (_n, html, measuredH) => (measuredH === null ? { content: html } : { content: html, h: measuredH }),
    applyStyle(el, n) {
      el.style.fontSize = `${n.fontSize}px`;
      el.style.fontWeight = n.bold ? '700' : '';
      el.style.lineHeight = n.bold ? '1.15' : '';
    },
    styleKey: (n) => `${n.fontSize}|${n.bold ? 1 : 0}`,
    height: 'auto',
    autoHeight: true,
    minHeight: opts.minHeight ?? 28,
    // shrink the box to the text; wrap (and stop widening) at maxWidth
    autoWidth: true,
    maxWidth: opts.maxWidth ?? 640,
    minWidth: 24,
    deleteWhenEmpty: true,
    selectAllOnBegin: true,
  });
  return {
    type: 'text',
    ...behavior,
    deserialize(raw) {
      if (!baseNodeValid(raw) || raw.type !== 'text') return null;
      const o = raw as TextNode;
      if (typeof o.content !== 'string' || typeof o.fontSize !== 'number') return null;
      o.content = sanitizeHtml(o.content);
      return o;
    },
  };
}

/** Frame / card: a filled background rect with optional HTML content. */
export function frameKind(): NodeKind<CardNode> {
  const behavior = htmlBehavior<CardNode>({
    getHtml: (n) => n.content,
    setHtml: (_n, html) => ({ content: html }),
    height: 'min',
    deleteWhenEmpty: false, // an empty card IS a frame
    selectAllOnBegin: true,
  });
  return {
    type: 'card',
    chrome: (n) => ({ fill: n.fill, radius: 0 }),
    ...behavior,
    deserialize(raw) {
      if (!baseNodeValid(raw) || raw.type !== 'card') return null;
      const o = raw as CardNode;
      if (typeof o.content !== 'string') return null;
      if (typeof o.fill !== 'string') o.fill = '#ffffff';
      o.content = sanitizeHtml(o.content);
      return o;
    },
  };
}
