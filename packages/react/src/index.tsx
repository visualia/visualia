import type { BaseNode, ContentSpec, NodeId } from '@visualia/engine';
import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

export interface ReactContentOpts<T extends BaseNode> {
  /** Build the element for a node. Re-runs only when `key(node)` changes. */
  render(node: T): ReactElement;
  /** Re-render + recapture fingerprint — everything the element renders from. */
  key(node: T): string;
  mode?: ContentSpec<T>['mode'];
  height?: ContentSpec<T>['height'];
  live?(node: T, el: HTMLElement | null): boolean;
}

/**
 * A ContentSpec that mounts a React root into each node's content element.
 * Roots are keyed per node id; unmount is deferred a microtask because React
 * forbids unmounting from inside its own event/render cycle.
 */
export function reactContent<T extends BaseNode>(opts: ReactContentOpts<T>): ContentSpec<T> {
  const mounted = new Map<NodeId, { root: Root; key: string }>();

  const renderInto = (el: HTMLElement, node: T): void => {
    const key = opts.key(node);
    let m = mounted.get(node.id);
    if (m && m.key === key) return;
    if (!m) {
      m = { root: createRoot(el), key: '' };
      mounted.set(node.id, m);
    }
    m.key = key;
    m.root.render(opts.render(node));
  };

  return {
    mode: opts.mode ?? 'texture',
    height: opts.height ?? 'fixed',
    update(el, node) {
      renderInto(el, node);
    },
    unmount(_el, id) {
      const m = mounted.get(id);
      if (!m) return;
      mounted.delete(id);
      queueMicrotask(() => m.root.unmount());
    },
    contentKey: opts.key,
    live: opts.live,
  };
}
