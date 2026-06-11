import { createRoot, type Root } from 'react-dom/client';
import type { WidgetNode } from './registry';
import { WIDGETS } from './registry';

interface Mounted {
  root: Root;
  key: string;
}

const mounted = new Map<string, Mounted>();

/** Mount (or re-render) a widget node's React tree into its content element. */
export function mountWidget(el: HTMLElement, node: WidgetNode): void {
  const key = `${node.component}|${JSON.stringify(node.props ?? {})}`;
  let m = mounted.get(node.id);
  if (m && m.key === key) return;
  if (!m) {
    m = { root: createRoot(el), key: '' };
    mounted.set(node.id, m);
  }
  m.key = key;
  const Component = WIDGETS[node.component]?.Component;
  m.root.render(
    Component ? (
      <Component nodeId={node.id} props={node.props ?? {}} />
    ) : (
      <div style={{ padding: 12, fontSize: 13, color: '#999' }}>Unknown widget “{node.component}”</div>
    ),
  );
}

export function unmountWidget(id: string): void {
  const m = mounted.get(id);
  if (!m) return;
  mounted.delete(id);
  // defer: React forbids unmounting from inside its own event/render cycle
  queueMicrotask(() => m.root.unmount());
}
