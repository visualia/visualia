import type { BaseNode, NodeId } from '../core/types';

/**
 * Layout — a pluggable placement seam (plans/layout.md). A strategy is a pure,
 * re-runnable function of a node set + params → a position (and optional patch)
 * per node. The engine ships `freeform`/`flow`/`grid`/`pack`; apps register
 * more via BoardOptions.layouts. Board.layout() commits the result as one
 * undoable "tidy"; Board.runLayout() computes it without committing.
 */
export type LayoutParams = Record<string, unknown> & {
  /** top-left to lay out from; defaults to the set's current bounding-box corner */
  origin?: { x: number; y: number };
};

export interface LayoutCtx {
  /** intrinsic tile sizing: a node's kind picks its height for a target width
      (and optional aspect), returning the height + an optional fit patch (crop) */
  fitTile(node: BaseNode, w: number, aspect?: number): { h: number; patch?: Partial<BaseNode> } | null;
}

export interface Layout {
  readonly id: string;
  /** node geometry to apply, keyed by id — at least x/y, plus any w/h/extra */
  apply(nodes: readonly BaseNode[], params: LayoutParams, ctx: LayoutCtx): Map<NodeId, Partial<BaseNode>>;
}

const round8 = (v: number): number => Math.round(v / 8) * 8;

function originOf(nodes: readonly BaseNode[], params: LayoutParams): { x: number; y: number } {
  if (params.origin) return params.origin;
  let x = Infinity, y = Infinity;
  for (const n of nodes) {
    x = Math.min(x, n.x);
    y = Math.min(y, n.y);
  }
  return { x: x === Infinity ? 0 : x, y: y === Infinity ? 0 : y };
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && isFinite(v) ? v : d);

/** identity — the default; manual placement, no changes. */
const freeform: Layout = {
  id: 'freeform',
  apply: () => new Map(),
};

/** stack in a direction with a gap. params: { dir:'row'|'col', gap, origin } */
const flow: Layout = {
  id: 'flow',
  apply(nodes, params) {
    const gap = num(params.gap, 16);
    const row = params.dir === 'row';
    const o = originOf(nodes, params);
    let x = round8(o.x);
    let y = round8(o.y);
    const out = new Map<NodeId, Partial<BaseNode>>();
    for (const n of nodes) {
      out.set(n.id, { x, y });
      if (row) x += n.w + gap;
      else y += n.h + gap;
    }
    return out;
  },
};

/**
 * Row-major grid, top-aligned. Fixed `tileWidth` columns, filled left→right /
 * top→bottom; each tile's height is the kind's fitTile (natural aspect by
 * default, so images keep their proportions), or w/`aspect` when an explicit
 * aspect is forced (uniform tiles, kind cover-fits via a patch). Items in a row
 * share its top; the next row clears the tallest tile.
 * params: { cols?, gap?, tileWidth?, aspect?, origin? }
 */
const grid: Layout = {
  id: 'grid',
  apply(nodes, params, ctx) {
    const gap = num(params.gap, 24);
    const tileWidth = num(params.tileWidth, 240);
    const aspect = typeof params.aspect === 'number' ? params.aspect : undefined;
    const cols = Math.max(1, Math.round(num(params.cols, Math.min(6, Math.max(1, Math.ceil(Math.sqrt(nodes.length)))))));
    const o = originOf(nodes, params);
    const ox = round8(o.x);
    const sized = nodes.map((n) => {
      const fit = ctx.fitTile(n, tileWidth, aspect);
      return { n, h: Math.max(8, Math.round(fit?.h ?? (aspect ? tileWidth / aspect : tileWidth))), patch: fit?.patch };
    });
    const out = new Map<NodeId, Partial<BaseNode>>();
    let y = round8(o.y);
    for (let r = 0; r * cols < sized.length; r++) {
      const row = sized.slice(r * cols, (r + 1) * cols);
      const rowH = Math.max(...row.map((s) => s.h));
      row.forEach((s, c) => {
        out.set(s.n.id, { x: ox + c * (tileWidth + gap), y, w: tileWidth, h: s.h, ...(s.patch ?? {}) });
      });
      y += rowH + gap;
    }
    return out;
  },
};

/** Shelf-pack heterogeneous nodes at their own sizes into rows of a target
    width (√area, landscape-ish). params: { gap?, rowWidth?, origin? } */
const pack: Layout = {
  id: 'pack',
  apply(nodes, params) {
    const gap = num(params.gap, 16);
    const o = originOf(nodes, params);
    const area = nodes.reduce((s, n) => s + (n.w + gap) * (n.h + gap), 0);
    const widest = nodes.reduce((m, n) => Math.max(m, n.w), 0);
    const rowWidth = Math.max(widest, num(params.rowWidth, Math.round(Math.sqrt(area) * 1.3)));
    const x0 = round8(o.x);
    let x = x0;
    let y = round8(o.y);
    let rowH = 0;
    const out = new Map<NodeId, Partial<BaseNode>>();
    for (const n of nodes) {
      if (x > x0 && x - x0 + n.w > rowWidth) {
        x = x0;
        y += rowH + gap;
        rowH = 0;
      }
      out.set(n.id, { x, y });
      x += n.w + gap;
      rowH = Math.max(rowH, n.h);
    }
    return out;
  },
};

export function builtinLayouts(): Layout[] {
  return [freeform, flow, grid, pack];
}
