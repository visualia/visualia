import '@visualia/engine/styles.css';
import './styles.css';
import {
  builtinLayouts,
  createBoard,
  KeyboardController,
  newNodeId,
  textKind,
  type BaseNode,
  type BoardDoc,
  type KeyBinding,
  type LayoutCtx,
  type TextNode,
} from '@visualia/engine';
import { pageKind, type PageNode } from './page-kind';

type Node = PageNode | TextNode;

interface RawPage {
  url: string;
  title: string;
  depth: number;
  orphan?: boolean;
  meta?: { description?: string };
}

interface Sitemap {
  meta: { totalPages: number; crawlDate: string };
  pages: RawPage[];
}

// -- layout constants ---------------------------------------------------------
// Square-card grid in the spirit of eka-web-structure: 66px white squares,
// sections as backgroundless clusters under a plain header, shelf-packed
// into a viewport-shaped board.

const CARD = 66;
const GAP = 8;
const PAD = 12;
const HEADER_H = 26;
const FRAME_GAP = 40;

const pathOf = (url: string): string => {
  try {
    return decodeURIComponent(new URL(url).pathname).replace(/\/$/, '') || '/';
  } catch {
    return url;
  }
};

const displayTitle = (t: string): string => t.replace(/\s*[—–-]\s*Eesti Kunstiakadeemia\s*$/u, '').trim() || t;

function pageNode(p: RawPage, x: number, y: number): PageNode {
  return {
    id: newNodeId(),
    type: 'page',
    x,
    y,
    w: CARD,
    h: CARD,
    title: displayTitle(p.title),
    url: p.url,
    path: pathOf(p.url),
    desc: p.meta?.description?.trim() ?? '',
    depth: p.depth,
    orphan: p.depth === -1 || p.orphan,
  };
}

/** Sections as square-ish card grids, shelf-packed left→right, top→bottom. */
function buildDoc(sitemap: Sitemap): BoardDoc<Node> {
  const pages = sitemap.pages.filter((p) => p.url && p.title);
  const home = pages.find((p) => p.depth === 0);
  const sections = pages.filter((p) => p.depth === 1).sort((a, b) => pathOf(a.url).localeCompare(pathOf(b.url)));
  const rest = pages
    .filter((p) => p.depth >= 2 || p.depth === -1)
    .sort((a, b) => pathOf(a.url).localeCompare(pathOf(b.url)));

  // assign deeper pages to the section owning the longest matching path prefix
  const bySection = new Map<string, RawPage[]>();
  const other: RawPage[] = [];
  const orphans: RawPage[] = [];
  const sectionPaths = sections.map((s) => ({ s, path: pathOf(s.url) }));
  for (const p of rest) {
    if (p.depth === -1) {
      orphans.push(p);
      continue;
    }
    const pp = pathOf(p.url);
    let bestKey = '';
    let bestLen = -1;
    for (const { s, path } of sectionPaths) {
      if (pp.startsWith(path + '/') && path.length > bestLen) {
        bestKey = s.url;
        bestLen = path.length;
      }
    }
    if (bestKey) {
      const list = bySection.get(bestKey) ?? [];
      list.push(p);
      bySection.set(bestKey, list);
    } else {
      other.push(p);
    }
  }

  const frames: { title: string; items: RawPage[] }[] = sections.map((s) => ({
    title: displayTitle(s.title),
    items: [s, ...(bySection.get(s.url) ?? [])],
  }));
  if (other.length) frames.push({ title: 'Mujal', items: other });
  if (orphans.length) frames.push({ title: 'Orvud', items: orphans });

  const nodes: Node[] = [];
  const headerNodes: Node[] = [];

  if (home) nodes.push(pageNode(home, 0, -CARD - 24));

  // pre-measure: square-ish grid per section, then shelf-pack the frames
  const measured = frames.map((f) => {
    const cols = Math.max(1, Math.ceil(Math.sqrt(f.items.length)));
    const rows = Math.ceil(f.items.length / cols);
    return {
      f,
      cols,
      rows,
      w: PAD * 2 + cols * (CARD + GAP) - GAP,
      h: HEADER_H + PAD + rows * (CARD + GAP) - GAP + PAD,
    };
  });
  const area = measured.reduce((a, m) => a + (m.w + FRAME_GAP) * (m.h + FRAME_GAP), 0);
  const targetW = Math.max(CARD * 30, Math.sqrt(area) * 1.5);

  // Layout through the engine seam (plans/layout.md): shelf-`pack` the section
  // frames, then `grid` the square cards inside each. Fixed-size tiles, so no
  // intrinsic sizing is needed.
  const ctx: LayoutCtx = { fitTile: () => null };
  const layouts = builtinLayouts();
  const pack = layouts.find((l) => l.id === 'pack')!;
  const grid = layouts.find((l) => l.id === 'grid')!;

  const frameBoxes: BaseNode[] = measured.map((m, i) => ({ id: `f${i}`, type: 'frame', x: 0, y: 0, w: m.w, h: m.h }));
  const framePos = pack.apply(frameBoxes, { gap: FRAME_GAP, rowWidth: targetW }, ctx);

  measured.forEach((m, i) => {
    const fp = framePos.get(`f${i}`);
    const fx = fp?.x ?? 0;
    const fy = fp?.y ?? 0;
    const cards = m.f.items.map((it) => pageNode(it, 0, 0));
    const cardPos = grid.apply(cards, { cols: m.cols, tileWidth: CARD, gap: GAP, aspect: 1, origin: { x: fx + PAD, y: fy + HEADER_H + PAD } }, ctx);
    for (const cn of cards) {
      const p = cardPos.get(cn.id);
      cn.x = p?.x ?? cn.x;
      cn.y = p?.y ?? cn.y;
      nodes.push(cn);
    }
    // plain header above the cluster — no background, no count
    headerNodes.push({ id: newNodeId(), type: 'text', x: fx + 8, y: fy + 5, w: m.w - 16, h: 18, content: m.f.title, fontSize: 12 });
  });

  const all = [...headerNodes, ...nodes];
  const doc: BoardDoc<Node> = { version: 1, nodes: {}, nodeOrder: [] };
  for (const n of all) {
    doc.nodes[n.id] = n;
    doc.nodeOrder.push(n.id);
  }
  return doc;
}

// -- boot ----------------------------------------------------------------------

const FORCE_DOM_KEY = 'eka-force-dom';

const board = createBoard<Node>({
  root: document.getElementById('board-root')!,
  canvas: document.getElementById('gl') as HTMLCanvasElement,
  domLayer: document.getElementById('dom-layer')!,
  domLayerInner: document.getElementById('dom-layer-inner')!,
  // headers lose their edit spec: dblclick must never start text editing here
  kinds: [pageKind, { ...textKind({ minHeight: 12 }), edit: undefined }],
  persist: false, // pure data viewer — rebuilt from sitemap.json every load
  interaction: 'viewer', // pan-first, no select/move/resize; dblclick still activates
  background: '#c0c0c0',
  forceFallback: localStorage.getItem(FORCE_DOM_KEY) === '1',
});

// ripple easter egg doubles as a renderer check: the effect distorts the GL
// scene, so ripples appear in HTML-in-canvas (gl) mode and not in dom mode
let ripple = false;
const toggleRipple = (): void => {
  ripple = !ripple;
  board.setLiquidMode(ripple);
};

// view-only keymap: zoom/fit + ripple, no select/delete/undo/nudge
const viewKeymap: KeyBinding[] = [
  { key: '0', mod: true, run: () => board.zoomTo100() },
  { key: '1', mod: true, run: () => board.zoomToFit() },
  { key: '=', mod: true, run: () => board.zoomStep(1) },
  { key: '+', mod: true, run: () => board.zoomStep(1) },
  { key: '-', mod: true, run: () => board.zoomStep(-1) },
  { key: '+', run: () => board.zoomStep(1) },
  { key: '=', run: () => board.zoomStep(1) },
  { key: '-', run: () => board.zoomStep(-1) },
  { key: '!', shift: true, run: () => board.zoomToFit() },
  { key: 'r', run: toggleRipple },
];
new KeyboardController(board.edit, board.flags, () => board.pointer.updateCursor(), {
  bindings: viewKeymap,
});
board.pointer.updateCursor(); // grab cursor from the start (panDefault)

const hud = document.getElementById('hud')!;

// -- fps meter + zoom LOD --------------------------------------------------
// One persistent rAF loop: measures real main-thread frame rate and swaps
// level-of-detail classes so far-out views skip text painting entirely.
const fpsEl = document.getElementById('fps')!;
const fpsVal = document.getElementById('fps-val')!;
// the chip doubles as a renderer toggle: gl (HTML-in-canvas) ⇄ dom fallback
document.getElementById('fps-mode')!.textContent = board.mode.toUpperCase();
fpsEl.title = 'click to switch GL/DOM rendering';
fpsEl.addEventListener('click', () => {
  localStorage.setItem(FORCE_DOM_KEY, board.mode === 'gl' ? '1' : '0');
  location.reload();
});
const domInner = document.getElementById('dom-layer-inner')!;
let frames = 0;
let windowStart = performance.now();
let lodClass = '';
function frameLoop(t: number): void {
  frames++;
  if (t - windowStart >= 500) {
    fpsVal.textContent = `${Math.round((frames * 1000) / (t - windowStart))} fps`;
    frames = 0;
    windowStart = t;
  }
  const z = board.camera.z;
  const next = z < 0.22 ? 'lod-far' : z < 0.7 ? 'lod-mid' : '';
  if (next !== lodClass) {
    if (lodClass) domInner.classList.remove(lodClass);
    if (next) domInner.classList.add(next);
    lodClass = next;
    board.invalidate();
  }
  requestAnimationFrame(frameLoop);
}
requestAnimationFrame(frameLoop);

// fonts first: GL mode captures card textures once, so the custom faces
// must be live before the first rasterization (explicit load — fonts.ready
// won't fetch faces nothing on the page uses yet)
const fontsReady = Promise.all([
  document.fonts.load('400 10px ITCFranklinGothic'),
  document.fonts.load('700 10px ITCFranklinGothic'),
  document.fonts.load('400 10px EKA-Absolution'),
  document.fonts.load('600 12px Inter'),
]).catch(() => undefined);

Promise.all([fetch('/sitemap.json').then((r) => r.json()), fontsReady])
  .then(([sitemap]: [Sitemap, unknown]) => {
    const doc = buildDoc(sitemap);
    board.store.replaceDoc(doc);
    hud.textContent = `artun.ee · ${sitemap.meta.totalPages} pages · crawled ${sitemap.meta.crawlDate.slice(0, 10)} · drag to pan · dblclick a card to open · R = ripple`;
    const fitWhenMeasured = (): void => {
      if (board.camera.viewW > 10) board.zoomToFit(false);
      else requestAnimationFrame(fitWhenMeasured);
    };
    fitWhenMeasured();
  })
  .catch((err) => {
    hud.textContent = `failed to load sitemap.json: ${String(err)}`;
  });

declare global {
  interface Window {
    board: typeof board;
  }
}
window.board = board;
console.info(`eka-sitemap: mode = ${board.mode}`);
