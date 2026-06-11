export {
  WIDGETS,
  widgetKind,
  type WidgetDef,
  type WidgetNode,
  type WidgetProps,
} from './registry';

// UI components consumers commonly need around a board (palette, dialogs)
export * from './components/ui/button';
export * from './components/ui/command';
export * from './components/ui/dialog';
