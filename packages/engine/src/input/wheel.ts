export interface WheelIntent {
  kind: 'zoom' | 'pan';
  /** normalized pixels, clamped */
  dx: number;
  dy: number;
}

const MAX_DELTA = 100;

function clamp(v: number): number {
  return Math.max(-MAX_DELTA, Math.min(MAX_DELTA, v));
}

/**
 * Chrome reports trackpad pinch as wheel events with ctrlKey=true, so
 * ctrl/cmd+wheel means zoom; everything else (two-finger scroll, mouse
 * wheel) pans. Shift swaps axes for horizontal mouse-wheel scrolling.
 */
export function classifyWheel(e: WheelEvent, viewportH: number): WheelIntent {
  let scale = 1;
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) scale = 16;
  else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) scale = viewportH;
  let dx = clamp(e.deltaX * scale);
  let dy = clamp(e.deltaY * scale);
  if (e.ctrlKey || e.metaKey) return { kind: 'zoom', dx, dy };
  if (e.shiftKey && dx === 0) [dx, dy] = [dy, 0];
  return { kind: 'pan', dx, dy };
}

/**
 * Per-event zoom factor. Trackpad pinch (small, high-rate deltas) maps ~1:1 to
 * the physical gesture like Figma; discrete mouse-wheel notches (large deltas)
 * use a lower coefficient so one notch is ~1.4x instead of ~2.7x.
 */
export function wheelZoomFactor(dy: number): number {
  const k = Math.abs(dy) >= 60 ? 0.0035 : 0.01;
  return Math.exp(-dy * k);
}
