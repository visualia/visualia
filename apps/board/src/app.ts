import { Camera, clampZ } from './camera/camera';
import { CameraAnim } from './camera/camera-anim';
import { CanvasContentLayer } from './content/canvas-layer';
import type { ContentLayer } from './content/content-layer';
import { EditController } from './content/edit';
import { FallbackContentLayer } from './content/fallback-layer';
import { frameKind, textKind } from './core/builtin-kinds';
import { AddNodes, DeleteNodes, History, PatchNodes, type NodePatch } from './core/history';
import { KindRegistry } from './core/kinds';
import { Autosaver, loadCamera, loadDoc } from './core/persistence';
import { Store } from './core/store';
import { emptyDoc, newNodeId, rectsIntersect, type NodeId, type Point, type Rect } from './core/types';
import type { BNode } from './node-types';
import { PointerController } from './input/input';
import { KeyboardController } from './input/keyboard';
import { Selection } from './interact/selection';
import type { GuideSeg } from './interact/snap';
import { Renderer } from './render/renderer';
import { CommandMenu } from './ui/command-menu';
import { widgetKind } from './widgets/kind';
import { WIDGETS } from './widgets/registry';

const ZOOM_STEP = 2 ** 0.25;
const CULL_MARGIN = 64; // world-ish slack so shadows aren't clipped at edges

export class App {
  readonly camera = new Camera();
  readonly anim = new CameraAnim(this.camera);
  readonly store = new Store<BNode>();
  readonly history = new History();
  readonly selection = new Selection();
  readonly renderer: Renderer;
  readonly content: ContentLayer;
  readonly edit: EditController;
  readonly pointer: PointerController;
  readonly keyboard: KeyboardController;
  readonly commandMenu: CommandMenu;
  readonly registry: KindRegistry;
  readonly mode: 'gl' | 'dom';

  marquee: Rect | null = null;
  guides: { v: GuideSeg[]; h: GuideSeg[] } | null = null;

  private liquidMode = false;
  private liquidTrail: { x: number; y: number; born: number }[] = [];
  private lastSelectedId: NodeId | null = null;
  private lastZoomVar = 0;

  private scheduled = false;
  private lastTick = 0;
  private pendingFit = false;
  private autosaver: Autosaver;
  private glLayer: CanvasContentLayer | null = null;

  constructor(
    root: HTMLElement,
    private canvas: HTMLCanvasElement,
    domLayer: HTMLElement,
    domLayerInner: HTMLElement,
    forceFallback: boolean,
  ) {
    const apiAvailable =
      typeof HTMLCanvasElement.prototype.getElementTransform === 'function' &&
      typeof WebGL2RenderingContext.prototype.texElementImage2D === 'function' &&
      typeof HTMLCanvasElement.prototype.requestPaint === 'function';
    this.mode = apiAvailable && !forceFallback ? 'gl' : 'dom';
    document.body.classList.add(`mode-${this.mode}`);

    const gl = canvas.getContext('webgl2', {
      alpha: this.mode === 'dom', // dom mode: transparent overlay canvas above content
      antialias: false,
      premultipliedAlpha: true,
      desynchronized: true,
    });
    if (!gl) throw new Error('WebGL2 is required');

    this.registry = new KindRegistry([textKind(), frameKind(), widgetKind]);

    this.renderer = new Renderer(
      gl,
      this.camera,
      this.mode === 'dom',
      (n) => this.registry.of(n)?.chrome?.(n) ?? null,
    );
    if (this.mode === 'gl') {
      this.glLayer = new CanvasContentLayer(
        canvas,
        gl,
        this.store,
        this.registry,
        this.camera,
        () => this.renderer.dpr,
        () => this.invalidate(),
      );
      this.content = this.glLayer;
    } else {
      this.content = new FallbackContentLayer(domLayer, domLayerInner, this.store, this.registry, this.camera);
    }

    this.edit = new EditController(this.content, this.store, this.registry, this.history, () => this.invalidate());
    this.keyboard = new KeyboardController(this, this.edit, () => this.pointer.updateCursor());
    this.pointer = new PointerController(root, {
      camera: this.camera,
      anim: this.anim,
      store: this.store,
      history: this.history,
      selection: this.selection,
      edit: this.edit,
      flags: this.keyboard.flags,
      invalidate: () => this.invalidate(),
      setMarquee: (r) => (this.marquee = r),
      setGuides: (g) => (this.guides = g),
      visibleNodes: () => this.visibleNodes(),
      liquidOn: () => this.liquidMode,
      addLiquidPoint: (p) => this.addLiquidPoint(p),
    });

    this.commandMenu = new CommandMenu(this);

    this.autosaver = new Autosaver(
      () => this.store.doc,
      () => this.camera,
    );

    this.store.on('change', ({ ids, structural }) => {
      this.content.syncFromStore(structural ? undefined : ids);
      if (structural) this.selection.prune((id) => !!this.store.node(id));
      this.autosaver.docChanged();
      this.invalidate();
    });
    this.store.on('reset', () => {
      this.selection.clear();
      this.history.clear();
    });
    this.selection.on('change', () => {
      if (this.selection.size) this.lastSelectedId = [...this.selection.ids].pop() ?? null;
      this.glLayer?.updateSelection(this.selection.ids);
      this.invalidate();
    });

    document.documentElement.style.setProperty('--board-zoom', '1');
    this.observeResize();
    this.watchContextLoss();
  }

  // -- lifecycle ---------------------------------------------------------------

  loadOrSeed(): void {
    this.store.replaceDoc(loadDoc<BNode>(this.registry) ?? emptyDoc<BNode>());
    const cam = loadCamera();
    if (cam) {
      this.camera.x = cam.x;
      this.camera.y = cam.y;
      this.camera.z = clampZ(cam.z);
    } else if (this.camera.viewW > 10) {
      this.zoomToFit(false);
    } else {
      this.pendingFit = true; // viewport size not measured yet — fit on first resize
    }
    const seed = new URLSearchParams(location.search).get('seed');
    if (seed) this.seedCards(parseInt(seed, 10) || 100);
    this.invalidate();
  }

  // -- frame loop ----------------------------------------------------------------

  invalidate(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame((t) => this.tick(t));
  }

  private tick(t: number): void {
    this.scheduled = false;
    const dt = this.lastTick ? t - this.lastTick : 16;
    this.lastTick = t;

    const animating = this.anim.step(dt);
    if (animating || this.pointer.gestureActive) this.autosaver.cameraChanged();

    const now = performance.now();
    this.liquidTrail = this.liquidTrail.filter((p) => now - p.born < 2000);
    const liquid = this.liquidTrail.length
      ? this.liquidTrail.map((p) => ({ x: p.x, y: p.y, age: (now - p.born) / 1000, strength: 1 }))
      : null;

    // portaled UI (select dropdowns) scales itself with the board zoom
    if (this.lastZoomVar !== this.camera.z) {
      this.lastZoomVar = this.camera.z;
      document.documentElement.style.setProperty('--board-zoom', String(this.camera.z));
    }

    const visible = this.visibleNodes();
    this.content.sync(visible);
    this.renderer.render({
      visible,
      selection: this.selection.ids,
      marquee: this.marquee,
      guides: this.guides,
      getTexture: this.glLayer ? this.glLayer.getTexture : null,
      editingId: this.edit.activeId,
      liquid,
    });

    if (animating || liquid) this.invalidate();
    else this.lastTick = 0;
  }

  setLiquidMode(on: boolean): void {
    if (this.liquidMode === on) return;
    this.liquidMode = on;
    this.pointer.updateCursor();
    this.invalidate();
  }

  private addLiquidPoint(p: Point): void {
    this.liquidTrail.push({ x: p.x, y: p.y, born: performance.now() });
    if (this.liquidTrail.length > 64) this.liquidTrail.shift();
    this.invalidate();
  }

  private visibleNodes(): BNode[] {
    const vp = this.camera.viewportWorldRect();
    const margin = CULL_MARGIN / this.camera.z + CULL_MARGIN;
    const r: Rect = { x: vp.x - margin, y: vp.y - margin, w: vp.w + margin * 2, h: vp.h + margin * 2 };
    return this.store.orderedNodes().filter((n) => rectsIntersect({ x: n.x, y: n.y, w: n.w, h: n.h }, r));
  }

  // -- actions (keyboard / toolbar) ---------------------------------------------

  deleteSelection(): void {
    if (!this.selection.size) return;
    this.edit.end();
    this.history.push(this.store, new DeleteNodes(this.store, [...this.selection.ids]));
    this.selection.clear();
  }

  duplicateSelection(): void {
    if (!this.selection.size) return;
    const clones: { node: BNode; index: number }[] = [];
    let index = this.store.doc.nodeOrder.length;
    for (const id of this.selection.ids) {
      const n = this.store.node(id);
      if (!n) continue;
      clones.push({ node: { ...structuredClone(n), id: newNodeId(), x: n.x + 16, y: n.y + 16 }, index: index++ });
    }
    if (!clones.length) return;
    this.history.push(this.store, new AddNodes(clones));
    this.selection.set(clones.map((c) => c.node.id));
  }

  selectAll(): void {
    this.selection.set(this.store.doc.nodeOrder);
  }

  clearSelection(): void {
    this.selection.clear();
  }

  editSelection(): void {
    if (this.selection.size !== 1) return;
    this.edit.begin([...this.selection.ids][0]!);
  }

  nudgeSelection(dx: number, dy: number): void {
    if (!this.selection.size) return;
    const patches = new Map<NodeId, NodePatch>();
    for (const id of this.selection.ids) {
      const n = this.store.node(id);
      if (!n) continue;
      patches.set(id, { before: { x: n.x, y: n.y }, after: { x: n.x + dx, y: n.y + dy } });
    }
    this.history.push(this.store, new PatchNodes('nudge', patches));
  }

  undo(): void {
    this.edit.end();
    this.history.undo(this.store);
    this.invalidate();
  }

  redo(): void {
    this.edit.end();
    this.history.redo(this.store);
    this.invalidate();
  }

  zoomTo100(): void {
    const center = { x: this.camera.viewW / 2, y: this.camera.viewH / 2 };
    const w = this.camera.screenToWorld(center);
    this.anim.animateTo({ x: w.x - center.x, y: w.y - center.y, z: 1 });
    this.invalidate();
  }

  zoomToFit(animate = true): void {
    const nodes = this.store.orderedNodes();
    if (!nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    }
    const target = this.camera.fitTarget({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
    if (animate) {
      this.anim.animateTo(target);
    } else {
      this.anim.cancel();
      Object.assign(this.camera, target);
    }
    this.invalidate();
  }

  zoomStep(dir: 1 | -1): void {
    const center = { x: this.camera.viewW / 2, y: this.camera.viewH / 2 };
    this.anim.zoomTo(clampZ(this.anim.targetZ * ZOOM_STEP ** dir), center);
    this.invalidate();
  }

  createHeadingAtCenter(): void {
    this.createTextNodeAtCenter(32, 360, true, 'Heading');
  }

  createDescriptionAtCenter(): void {
    this.createTextNodeAtCenter(15, 320, false, 'Description');
  }

  private createTextNodeAtCenter(fontSize: number, width: number, bold: boolean, content: string): void {
    // exact one-line height: just the line box (no padding)
    const h = Math.ceil(fontSize * (bold ? 1.15 : 1.45));
    const p = this.insertPlacement(width, h);
    const node: BNode = {
      id: newNodeId(),
      type: 'text',
      x: p.x,
      y: p.y,
      w: p.w,
      h,
      content,
      fontSize,
      bold,
    };
    this.history.push(this.store, new AddNodes([{ node, index: this.store.doc.nodeOrder.length }]));
    this.selection.set([node.id]);
    this.edit.begin(node.id);
  }

  createCardAtCenter(): void {
    const c = this.camera.screenToWorld({ x: this.camera.viewW / 2, y: this.camera.viewH / 2 });
    const node: BNode = {
      id: newNodeId(),
      type: 'card',
      x: c.x - 130,
      y: c.y - 80,
      w: 260,
      h: 160,
      content: '<h3>New card</h3><p>Double-click to edit.</p>',
      fill: '#ffffff',
    };
    this.history.push(this.store, new AddNodes([{ node, index: this.store.doc.nodeOrder.length }]));
    this.selection.set([node.id]);
  }

  /** Closest on-screen frame to the reference point, if any. */
  private nearestFrame(ref: Point): BNode | null {
    const vp = this.camera.viewportWorldRect();
    let best: BNode | null = null;
    let bestD = Infinity;
    for (const n of this.store.orderedNodes()) {
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
   * Where a new node should land: inside the nearest visible frame, stacked
   * from the top below its existing children (width fitted to the frame);
   * else below the last selection; else viewport center.
   */
  private insertPlacement(w: number, h: number, intoFrame = true, flush = false): { x: number; y: number; w: number } {
    // elements behave as if they had margins: inset from the frame edges,
    // and the same distance from the previous element. `flush` elements
    // (images) span edge to edge instead.
    const MARGIN = 24;
    const GAP = MARGIN;
    const PAD = flush ? 0 : MARGIN;
    const ids = this.selection.size
      ? [...this.selection.ids]
      : this.lastSelectedId && this.store.node(this.lastSelectedId)
        ? [this.lastSelectedId]
        : [];
    let ax0 = Infinity, ay0 = Infinity, ax1 = -Infinity, ay1 = -Infinity;
    for (const id of ids) {
      const n = this.store.node(id);
      if (!n) continue;
      ax0 = Math.min(ax0, n.x);
      ay0 = Math.min(ay0, n.y);
      ax1 = Math.max(ax1, n.x + n.w);
      ay1 = Math.max(ay1, n.y + n.h);
    }
    const anchor = ax0 !== Infinity ? { x: ax0, y: ay0, w: ax1 - ax0, h: ay1 - ay0 } : null;
    const ref = anchor
      ? { x: anchor.x + anchor.w / 2, y: anchor.y + anchor.h }
      : this.camera.screenToWorld({ x: this.camera.viewW / 2, y: this.camera.viewH / 2 });

    if (intoFrame) {
      // a selected frame is always the target; otherwise the nearest visible one
      let frame: BNode | null = null;
      for (const id of ids) {
        const n = this.store.node(id);
        if (n?.type === 'card') frame = n;
      }
      frame ??= this.nearestFrame(ref);
      const frameRect = frame ? { x: frame.x, y: frame.y, w: frame.w, h: frame.h } : null;
      // use the frame's column only while the chain still touches the frame
      if (frame && frameRect && (!anchor || rectsIntersect(anchor, frameRect))) {
        let y = frame.y + PAD;
        for (const n of this.store.orderedNodes()) {
          if (n.id === frame.id || n.type === 'card') continue;
          if (rectsIntersect({ x: n.x, y: n.y, w: n.w, h: n.h }, frameRect)) {
            y = Math.max(y, n.y + n.h + GAP);
          }
        }
        // never on top of the last insert — but frames themselves are
        // backgrounds, not stack anchors
        let floor = -Infinity;
        for (const id of ids) {
          const n = this.store.node(id);
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
    const c = this.camera.screenToWorld({ x: this.camera.viewW / 2, y: this.camera.viewH / 2 });
    return { x: Math.round((c.x - w / 2) / 8) * 8, y: Math.round((c.y - h / 2) / 8) * 8, w };
  }

  createFrameAtCenter(): void {
    const w = 320; // same insert width as components
    const h = 480; // tall enough for image + heading + description + a control row
    const FRAME_GAP = 32;
    // new canvases line up: to the right of the rightmost visible frame
    const vp = this.camera.viewportWorldRect();
    let prev: BNode | null = null;
    for (const n of this.store.orderedNodes()) {
      if (n.type !== 'card') continue;
      if (!rectsIntersect({ x: n.x, y: n.y, w: n.w, h: n.h }, vp)) continue;
      if (!prev || n.x + n.w > prev.x + prev.w) prev = n;
    }
    const p = prev
      ? { x: prev.x + prev.w + FRAME_GAP, y: prev.y }
      : this.insertPlacement(w, h, false); // frames don't nest into frames
    const node: BNode = {
      id: newNodeId(),
      type: 'card',
      x: p.x,
      y: p.y,
      w,
      h,
      content: '',
      fill: '#ffffff',
    };
    // frames are backgrounds: insert at the bottom of the z-order
    this.history.push(this.store, new AddNodes([{ node, index: 0 }]));
    this.selection.set([node.id]);
  }

  openCommandMenu(): void {
    this.edit.end();
    this.commandMenu.toggle();
  }

  createWidgetAtCenter(component: string): void {
    const def = WIDGETS[component];
    const w = def?.w ?? 320;
    const h = def?.h ?? 240;
    const p = this.insertPlacement(w, h, true, component === 'image');
    const node: BNode = {
      id: newNodeId(),
      type: 'widget',
      x: p.x,
      y: p.y,
      w: p.w,
      h,
      component,
    };
    this.history.push(this.store, new AddNodes([{ node, index: this.store.doc.nodeOrder.length }]));
    this.selection.set([node.id]);
  }

  private seedCards(count: number): void {
    const cols = Math.ceil(Math.sqrt(count));
    const nodes: { node: BNode; index: number }[] = [];
    let index = this.store.doc.nodeOrder.length;
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
    this.history.push(this.store, new AddNodes(nodes));
  }

  // -- environment ---------------------------------------------------------------

  private observeResize(): void {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cssW = entry.contentRect.width;
        const cssH = entry.contentRect.height;
        let dw = Math.round(cssW * devicePixelRatio);
        let dh = Math.round(cssH * devicePixelRatio);
        const dpcb = entry.devicePixelContentBoxSize?.[0];
        if (dpcb) {
          dw = dpcb.inlineSize;
          dh = dpcb.blockSize;
        }
        this.camera.viewW = Math.max(1, cssW);
        this.camera.viewH = Math.max(1, cssH);
        this.renderer.dpr = dw / Math.max(1, cssW);
        this.renderer.resize(Math.max(1, dw), Math.max(1, dh));
      }
      if (this.pendingFit && this.camera.viewW > 10) {
        this.pendingFit = false;
        this.zoomToFit(false);
      }
      this.invalidate();
    });
    try {
      ro.observe(this.canvas, { box: 'device-pixel-content-box' });
    } catch {
      ro.observe(this.canvas);
    }
  }

  private watchContextLoss(): void {
    this.canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.renderer.reinit();
      if (this.glLayer) {
        this.glLayer.cache.clear();
        this.glLayer.markAllDirty();
      }
      this.invalidate();
    });
  }

  flushSave(): void {
    this.autosaver.flush();
  }
}

