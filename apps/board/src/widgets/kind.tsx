import { baseNodeValid, type NodeKind } from '@visualia/engine';
import type { WidgetNode } from './registry';
import { mountWidget, unmountWidget } from './host';
import { WIDGETS } from './registry';

/** App node kind: a React component from the widget registry. */
export const widgetKind: NodeKind<WidgetNode> = {
  type: 'widget',
  content: {
    mode: (n) => (WIDGETS[n.component]?.overlay ? 'overlay' : 'texture'),
    height: 'fixed',
    update(el, node) {
      mountWidget(el, node); // props-keyed: re-renders only when component/props change
    },
    unmount(_el, id) {
      unmountWidget(id);
    },
    contentKey: (n) => `${n.component}|${JSON.stringify(n.props ?? {})}`,
    live(n, el) {
      if (!WIDGETS[n.component]?.live) return false;
      if (!el) return true; // policy question: capture at scale 1, no mips
      const media = el.querySelector('video');
      return !!media && !media.paused && media.readyState >= 2;
    },
  },
  edit: { kind: 'activate' },
  deserialize(raw) {
    if (!baseNodeValid(raw) || raw.type !== 'widget') return null;
    const o = raw as WidgetNode;
    return typeof o.component === 'string' ? o : null;
  },
};
