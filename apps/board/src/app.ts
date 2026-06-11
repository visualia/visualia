import {
  AddNodes,
  Board,
  KeyboardController,
  defaultKeymap,
  frameKind,
  newNodeId,
  rectsIntersect,
  textKind,
  type Point,
} from '@visualia/engine';
import type { BNode } from './node-types';
import { CommandMenu } from './ui/command-menu';
import { widgetKind } from '@visualia/shadcn';
import { WIDGETS } from '@visualia/shadcn';

/**
 * Application layer: composes the engine Board with this app's policies —
 * which kinds exist, where inserts land (frame stacking), the command
 * palette, keyboard extensions and the liquid-mode binding.
 */
export class App {
  readonly board: Board<BNode>;
  readonly keyboard: KeyboardController;
  readonly commandMenu: CommandMenu;

  private lastSelectedId: string | null = null;

  // engine conveniences re-exposed for UI code (and devtools poking)
  get camera() { return this.board.camera; }
  get anim() { return this.board.anim; }
  get store() { return this.board.store; }
  get history() { return this.board.history; }
  get selection() { return this.board.selection; }
  get edit() { return this.board.edit; }
  get content() { return this.board.content; }
  get mode() { return this.board.mode; }
  get guides() { return this.board.guides; }

  constructor(
    root: HTMLElement,
    canvas: HTMLCanvasElement,
    domLayer: HTMLElement,
    domLayerInner: HTMLElement,
    forceFallback: boolean,
  ) {
    this.board = new Board<BNode>({
      root,
      canvas,
      domLayer,
      domLayerInner,
      // low floor: text boxes are cap-trimmed (text-box: trim-both cap alphabetic)
      kinds: [textKind({ minHeight: 10 }), frameKind(), widgetKind],
      forceFallback,
    });

    this.board.selection.on('change', () => {
      if (this.board.selection.size) this.lastSelectedId = [...this.board.selection.ids].pop() ?? null;
    });

    this.commandMenu = new CommandMenu(this);
    this.keyboard = new KeyboardController(
      this.board.edit,
      this.board.flags,
      () => this.board.pointer.updateCursor(),
      {
        bindings: [
          // app bindings first — the ⌘K/⌘/ palette works even mid-edit
          { key: '/', mod: true, worksInEdit: true, run: () => this.openCommandMenu() },
          { key: 'k', mod: true, worksInEdit: true, run: () => this.openCommandMenu() },
          // bare "/" too — but only outside editing, where it should type
          { key: '/', run: () => this.openCommandMenu() },
          ...defaultKeymap(this.board),
        ],
        // looooong space press summons the liquid cursor 🌊
        spaceHold: {
          ms: 1200,
          begin: () => this.board.setLiquidMode(true),
          end: () => this.board.setLiquidMode(false),
        },
      },
    );
  }

  loadOrSeed(): void {
    this.board.loadFromStorage();
    const seed = new URLSearchParams(location.search).get('seed');
    if (seed) this.seedCards(parseInt(seed, 10) || 100);
  }

  flushSave(): void {
    this.board.flushSave();
  }

  invalidate(): void {
    this.board.invalidate();
  }

  // delegations kept for UI code
  undo(): void { this.board.undo(); }
  redo(): void { this.board.redo(); }
  zoomToFit(animate = true): void { this.board.zoomToFit(animate); }
  zoomTo100(): void { this.board.zoomTo100(); }
  setLiquidMode(on: boolean): void { this.board.setLiquidMode(on); }

  openCommandMenu(): void {
    this.board.edit.end();
    this.commandMenu.toggle();
  }

  // -- insert placement policy ----------------------------------------------

  /** Closest on-screen frame to the reference point, if any. */
  private nearestFrame(ref: Point): BNode | null {
    const vp = this.board.camera.viewportWorldRect();
    let best: BNode | null = null;
    let bestD = Infinity;
    for (const n of this.board.store.orderedNodes()) {
      if (n.type !== 'card') continue;
      if (!rectsIntersect({ x: n.x, y: n.y, w: n.w, h: n.h }, vp)) continue;
      const d = Math.hypot(n.x + n.w / 2 - ref.x, n.y + n.h / 2 - ref.y);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  /**
   * Where a new node should land: inside the selected (else nearest visible)
   * frame, stacked flush from the top below its children (width fitted, flush
   * elements edge-to-edge); else below the last selection; else viewport center.
   */
  private insertPlacement(w: number, h: number, intoFrame = true, flush = false): { x: number; y: number; w: number } {
    const MARGIN = 24;
    const GAP = 0; // stack flush against the previous element
    const PAD = flush ? 0 : MARGIN;
    const { store, selection, camera } = this.board;
    const ids = selection.size
      ? [...selection.ids]
      : this.lastSelectedId && store.node(this.lastSelectedId)
        ? [this.lastSelectedId]
        : [];
    let ax0 = Infinity, ay0 = Infinity, ax1 = -Infinity, ay1 = -Infinity;
    for (const id of ids) {
      const n = store.node(id);
      if (!n) continue;
      ax0 = Math.min(ax0, n.x);
      ay0 = Math.min(ay0, n.y);
      ax1 = Math.max(ax1, n.x + n.w);
      ay1 = Math.max(ay1, n.y + n.h);
    }
    const anchor = ax0 !== Infinity ? { x: ax0, y: ay0, w: ax1 - ax0, h: ay1 - ay0 } : null;
    const ref = anchor
      ? { x: anchor.x + anchor.w / 2, y: anchor.y + anchor.h }
      : camera.screenToWorld({ x: camera.viewW / 2, y: camera.viewH / 2 });

    if (intoFrame) {
      // a selected frame is always the target; otherwise the nearest visible one
      let frame: BNode | null = null;
      for (const id of ids) {
        const n = store.node(id);
        if (n?.type === 'card') frame = n;
      }
      frame ??= this.nearestFrame(ref);
      const frameRect = frame ? { x: frame.x, y: frame.y, w: frame.w, h: frame.h } : null;
      // use the frame's column only while the chain still touches the frame
      if (frame && frameRect && (!anchor || rectsIntersect(anchor, frameRect))) {
        let y = frame.y + PAD;
        for (const n of store.orderedNodes()) {
          if (n.id === frame.id || n.type === 'card') continue;
          if (rectsIntersect({ x: n.x, y: n.y, w: n.w, h: n.h }, frameRect)) {
            y = Math.max(y, n.y + n.h + GAP);
          }
        }
        // never on top of the last insert — but frames themselves are
        // backgrounds, not stack anchors
        let floor = -Infinity;
        for (const id of ids) {
          const n = store.node(id);
          if (!n || n.type === 'card') continue;
          floor = Math.max(floor, n.y + n.h);
        }
        if (floor > -Infinity) y = Math.max(y, floor + GAP);
        return { x: frame.x + PAD, y, w: Math.min(w, frame.w - PAD * 2) };
      }
    }

    if (anchor) {
      return { x: Math.round(anchor.x / 8) * 8, y: Math.round((anchor.y + anchor.h + GAP) / 8) * 8, w };
    }
    const c = camera.screenToWorld({ x: camera.viewW / 2, y: camera.viewH / 2 });
    return { x: Math.round((c.x - w / 2) / 8) * 8, y: Math.round((c.y - h / 2) / 8) * 8, w };
  }

  // -- creation actions --------------------------------------------------------

  createFrameAtCenter(): void {
    const w = 320; // same insert width as components
    const h = 480; // tall enough for image + heading + description + a control row
    const FRAME_GAP = 32;
    // new canvases line up: to the right of the rightmost visible frame
    const vp = this.board.camera.viewportWorldRect();
    let prev: BNode | null = null;
    for (const n of this.board.store.orderedNodes()) {
      if (n.type !== 'card') continue;
      if (!rectsIntersect({ x: n.x, y: n.y, w: n.w, h: n.h }, vp)) continue;
      if (!prev || n.x + n.w > prev.x + prev.w) prev = n;
    }
    const p = prev
      ? { x: prev.x + prev.w + FRAME_GAP, y: prev.y }
      : this.insertPlacement(w, h, false);
    const node: BNode = { id: newNodeId(), type: 'card', x: p.x, y: p.y, w, h, content: '', fill: '#ffffff' };
    // frames are backgrounds: insert at the bottom of the z-order
    this.board.history.push(this.board.store, new AddNodes([{ node, index: 0 }]));
    this.board.selection.set([node.id]);
  }

  createWidgetAtCenter(component: string): void {
    const def = WIDGETS[component];
    const w = def?.w ?? 320;
    const h = def?.h ?? 240;
    // widgets span the frame's full width; images sit flush against the frame
    const p = this.insertPlacement(w, h, true, component === 'image');
    const node: BNode = { id: newNodeId(), type: 'widget', x: p.x, y: p.y, w: p.w, h, component };
    this.board.insert(node);
  }

  createHeadingAtCenter(): void {
    this.createTextNodeAtCenter(32, 360, true, 'Heading');
  }

  createDescriptionAtCenter(): void {
    this.createTextNodeAtCenter(15, 320, false, 'Description');
  }

  private createTextNodeAtCenter(fontSize: number, width: number, bold: boolean, content: string): void {
    // cap-trimmed single line: text-box trim-both cap alphabetic ≈ 0.72em
    const h = Math.round(fontSize * 0.72);
    const p = this.insertPlacement(width, h);
    const node: BNode = { id: newNodeId(), type: 'text', x: p.x, y: p.y, w: p.w, h, content, fontSize, bold };
    this.board.insert(node);
    this.board.edit.begin(node.id);
  }

  private seedCards(count: number): void {
    const cols = Math.ceil(Math.sqrt(count));
    const nodes: { node: BNode; index: number }[] = [];
    let index = this.board.store.doc.nodeOrder.length;
    for (let i = 0; i < count; i++) {
      nodes.push({
        index: index++,
        node: {
          id: newNodeId(),
          type: 'card',
          x: (i % cols) * 300,
          y: Math.floor(i / cols) * 200 + 400,
          w: 260,
          h: 160,
          content: `<h3>Card ${i + 1}</h3><p>Seeded perf-test card with some <b>rich</b> content and a <a href="#">link</a>.</p>`,
          fill: ['#ffffff', '#fff7d6', '#e8f4ff', '#eefbe7'][i % 4]!,
        },
      });
    }
    this.board.history.push(this.board.store, new AddNodes(nodes));
  }
}
