import { baseNodeValid, type BaseNode, type NodeKind } from '@visualia/engine';

/** One crawled page of artun.ee. */
export interface PageNode extends BaseNode {
  type: 'page';
  title: string;
  url: string;
  path: string;
  desc: string;
  depth: number;
  orphan?: boolean;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Read-only square page card: title links to the live page (dblclick to activate). */
export const pageKind: NodeKind<PageNode> = {
  type: 'page',
  chrome: (n) => ({ fill: n.orphan ? '#fdf0ec' : n.depth === 0 ? '#ffe9a8' : '#ffffff' }),
  content: {
    mode: 'texture',
    height: 'min',
    minPx: 20, // GL: drop card text below ~20px on screen — crisp rects beat texture mush
    update(el, node) {
      if (el.dataset.rendered === node.id) return;
      el.dataset.rendered = node.id;
      el.innerHTML =
        `<div class="p">${esc(node.path)}</div>` +
        `<a class="t" href="${esc(node.url)}" target="_blank" rel="noopener">${esc(node.title)}</a>` +
        (node.desc ? `<div class="d">${esc(node.desc)}</div>` : '');
    },
    contentKey: (n) => `${n.title}|${n.path}|${n.desc}`,
  },
  edit: { kind: 'activate' }, // dblclick → the link becomes clickable
  deserialize(raw) {
    if (!baseNodeValid(raw) || raw.type !== 'page') return null;
    const o = raw as PageNode;
    return typeof o.url === 'string' && typeof o.title === 'string' ? o : null;
  },
};
