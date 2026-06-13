import type { GuideSeg, InputHost, Point, Rect, Tool, ToolEvent } from '@visualia/engine';

const DRAG_THRESHOLD_PX = 4;
const SNAP_THRESHOLD_PX = 7;

/** a captured element's bounds in page px (mirrors the /capture sidecar shape) */
export interface WebRect {
  id: string;
  tag: string;
  rect: [number, number, number, number];
  text: string;
}

export interface CropTarget {
  nodeId: string;
  rects: WebRect[];
  pageW: number;
  pageH: number;
}

/** page px ↔ world mapping for a captured node at its current rect */
interface CropMap {
  node: Rect;
  p2wx: (px: number) => number;
  p2wy: (py: number) => number;
  w2px: (wx: number) => number;
  w2py: (wy: number) => number;
}

/**
 * Crop a captured website node in place. The node stays put while a blue
 * rectangle marks the region to lift out; its edges snap to the captured
 * element bounds and draw red alignment lines as they catch. Drag for a
 * freeform region, or click a single element to grab it whole. On release the
 * page-space rect goes to `onCommit` (→ app.agentCrop) and the tool hands back
 * to select.
 */
export class CropTool implements Tool {
  readonly id = 'crop';
  private target: CropTarget | null = null;
  private down: { startW: Point; pid: number; dragging: boolean } | null = null;
  private rect: Rect | null = null;

  constructor(
    /** current world rect of a captured node, or null if it's gone */
    private getNodeRect: (nodeId: string) => Rect | null,
    /** perform the crop for a page-space rect */
    private onCommit: (nodeId: string, pageRect: [number, number, number, number]) => void,
    /** leave crop mode (clears the app flag, back to select) */
    private onExit: () => void,
  ) {}

  /** arm the tool for a captured node (called on crop entry). */
  begin(target: CropTarget): void {
    this.target = target;
    this.rect = null;
    this.down = null;
  }

  get active(): boolean {
    return this.down !== null;
  }

  cursor(): string {
    return 'crosshair';
  }

  onDown(ev: ToolEvent): void {
    if (!this.target || !this.map()) return;
    this.down = { startW: ev.world, pid: ev.e.pointerId, dragging: false };
  }

  onMove(ev: ToolEvent, host: InputHost): void {
    const st = this.down;
    if (!st || ev.e.pointerId !== st.pid) return;
    const m = this.map();
    if (!m) return;

    if (!st.dragging) {
      const d = Math.hypot(ev.world.x - st.startW.x, ev.world.y - st.startW.y) * host.camera.z;
      if (d < DRAG_THRESHOLD_PX) return;
      st.dragging = true;
    }

    const raw = clampRect(normRect(st.startW, ev.world), m.node);
    const { snapped, guides } = this.snapEdges(raw, m, host.camera.z);
    this.rect = snapped;
    host.setMarquee(snapped);
    host.setGuides(guides.v.length || guides.h.length ? guides : null);
    host.invalidate();
  }

  onUp(ev: ToolEvent, host: InputHost): void {
    const st = this.down;
    if (!st || ev.e.pointerId !== st.pid) return;
    this.down = null;
    host.setMarquee(null);
    host.setGuides(null);

    const m = this.map();
    const target = this.target;
    let pageRect: [number, number, number, number] | null = null;
    if (m && target) {
      if (st.dragging && this.rect && this.rect.w > 2 && this.rect.h > 2) {
        pageRect = this.worldRectToPage(this.rect, m, target);
      } else {
        // a plain click grabs whichever captured element sits under the point
        const el = this.elementAt(ev.world, m, target.rects);
        if (el) pageRect = el.rect;
      }
    }
    this.rect = null;
    host.invalidate();
    if (pageRect && target) this.onCommit(target.nodeId, pageRect);
    this.onExit();
  }

  onCancel(host: InputHost): void {
    this.down = null;
    this.rect = null;
    host.setMarquee(null);
    host.setGuides(null);
  }

  // -- geometry --------------------------------------------------------------

  /** page↔world mapping from the node's CURRENT rect (survives resize). */
  private map(): CropMap | null {
    const t = this.target;
    if (!t) return null;
    const n = this.getNodeRect(t.nodeId);
    if (!n) return null;
    const { pageW, pageH } = t;
    return {
      node: n,
      p2wx: (px) => n.x + (px / pageW) * n.w,
      p2wy: (py) => n.y + (py / pageH) * n.h,
      w2px: (wx) => ((wx - n.x) / n.w) * pageW,
      w2py: (wy) => ((wy - n.y) / n.h) * pageH,
    };
  }

  /** Snap each crop edge to the nearest captured element edge; emit red guides
      (GuideSeg) along the edges that caught. */
  private snapEdges(rect: Rect, m: CropMap, z: number): { snapped: Rect; guides: { v: GuideSeg[]; h: GuideSeg[] } } {
    const thr = SNAP_THRESHOLD_PX / z;
    const xs: number[] = [];
    const ys: number[] = [];
    for (const e of this.target!.rects) {
      const [ex, ey, ew, eh] = e.rect;
      xs.push(m.p2wx(ex), m.p2wx(ex + ew));
      ys.push(m.p2wy(ey), m.p2wy(ey + eh));
    }
    let left = rect.x;
    let right = rect.x + rect.w;
    let top = rect.y;
    let bottom = rect.y + rect.h;
    const sLeft = nearest(left, xs, thr);
    const sRight = nearest(right, xs, thr);
    const sTop = nearest(top, ys, thr);
    const sBottom = nearest(bottom, ys, thr);
    if (sLeft !== null) left = sLeft;
    if (sRight !== null) right = sRight;
    if (sTop !== null) top = sTop;
    if (sBottom !== null) bottom = sBottom;
    const v: GuideSeg[] = [];
    const h: GuideSeg[] = [];
    if (sLeft !== null) v.push({ pos: left, start: top, end: bottom });
    if (sRight !== null) v.push({ pos: right, start: top, end: bottom });
    if (sTop !== null) h.push({ pos: top, start: left, end: right });
    if (sBottom !== null) h.push({ pos: bottom, start: left, end: right });
    return { snapped: { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) }, guides: { v, h } };
  }

  private worldRectToPage(r: Rect, m: CropMap, t: CropTarget): [number, number, number, number] {
    const x0 = clamp(m.w2px(r.x), 0, t.pageW);
    const y0 = clamp(m.w2py(r.y), 0, t.pageH);
    const x1 = clamp(m.w2px(r.x + r.w), 0, t.pageW);
    const y1 = clamp(m.w2py(r.y + r.h), 0, t.pageH);
    return [Math.round(x0), Math.round(y0), Math.round(x1 - x0), Math.round(y1 - y0)];
  }

  /** smallest captured element containing the world point (page-space test). */
  private elementAt(pt: Point, m: CropMap, rects: WebRect[]): WebRect | null {
    const px = m.w2px(pt.x);
    const py = m.w2py(pt.y);
    let best: WebRect | null = null;
    let bestArea = Infinity;
    for (const e of rects) {
      const [ex, ey, ew, eh] = e.rect;
      if (px >= ex && px <= ex + ew && py >= ey && py <= ey + eh && ew * eh < bestArea) {
        bestArea = ew * eh;
        best = e;
      }
    }
    return best;
  }
}

function nearest(value: number, candidates: number[], thr: number): number | null {
  let best: number | null = null;
  let bestD = thr;
  for (const c of candidates) {
    const d = Math.abs(c - value);
    if (d <= bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function normRect(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

function clampRect(r: Rect, bounds: Rect): Rect {
  const x0 = clamp(r.x, bounds.x, bounds.x + bounds.w);
  const y0 = clamp(r.y, bounds.y, bounds.y + bounds.h);
  const x1 = clamp(r.x + r.w, bounds.x, bounds.x + bounds.w);
  const y1 = clamp(r.y + r.h, bounds.y, bounds.y + bounds.h);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
