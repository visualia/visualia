import { baseNodeValid, htmlBehavior, sanitizeHtml, type NodeKind } from './kinds';
import type { CardNode, TextNode } from './types';

/** Free text block: auto-height, bold preset, deletes itself when emptied. */
export function textKind(): NodeKind<TextNode> {
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
    minHeight: 28,
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
