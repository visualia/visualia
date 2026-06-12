import { Camera, clampZ } from './camera/camera';
import { CameraAnim } from './camera/camera-anim';
import { CanvasContentLayer } from './content/canvas-layer';
import type { ContentLayer } from './content/content-layer';
import { EditController } from './content/edit';
import { FallbackContentLayer } from './content/fallback-layer';
import { AddNodes, DeleteNodes, History, PatchNodes, type NodePatch } from './core/history';
import { KindRegistry, type BaseNode, type NodeKind } from './core/kinds';
import { Autosaver, loadCamera, loadDoc } from './core/persistence';
import { Store } from './core/store';
import { emptyDoc, newNodeId, rectsIntersect, type NodeId, type Point, type Rect } from './core/types';
import { PointerController, type Tool } from './input/input';
import { resolveInteraction, type InteractionCaps, type InteractionOption } from './input/interaction';
import { HandTool, SelectTool } from './input/tools';
import { Selection } from './interact/selection';
import type { GuideSeg } from './interact/snap';
import { Renderer } from './render/renderer';

const ZOOM_STEP = 2 ** 0.25;
const CULL_MARGIN = 64; // world-ish slack so edge content isn't clipped

export interface BoardOptions {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  domLayer: HTMLElement;
  domLayerInner: HTMLElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kinds: NodeKind<any>[];
  forceFallback?: boolean;
  /** localStorage autosave/restore (default true; set false for data viewers) */
  persist?: boolean;
  /** interaction model: 'editor' (default), 'viewer' (pan-first, read-only),
      or a partial caps override — see InteractionCaps */
  interaction?: InteractionOption;
  /** extra interaction tools beyond the built-in select/hand; activate with setTool() */
  tools?: Tool[];
  /** initially active tool id (default: 'select' when caps allow, else 'hand') */
  initialTool?: string;
  /** board background in GL mode (DOM mode: style the page body instead) */
  background?: string;
}

/**
 * The engine facade: owns camera, store, history, selection, rendering
 * (HTML-in-canvas GL or DOM fallback), pointer input and persistence.
 * Application policy (what to insert where, palettes, shortcuts beyond the
 * pointer gestures) lives in the consumer.
 */
export class Board<N extends BaseNode = BaseNode> {
  readonly camera = new Camera();
  readonly anim = new CameraAnim(this.camera);
  readonly store = new Store<N>();
  readonly history = new History<N>();
  readonly selection = new Selection();
  readonly registry: KindRegistry;
  readonly renderer: Renderer;
  readonly content: ContentLayer;
  readonly edit: EditController;
  readonly pointer: PointerController;
  readonly mode: 'gl' | 'dom';
  /** resolved interaction capabilities (drives gestures, keymap, overlay) */
  readonly caps: InteractionCaps;
  /** shared modifier state (space-pan); a keyboard layer mutates this */
  readonly flags = { space: false };

  marquee: Rect | null = null;
  guides: { v: GuideSeg[]; h: GuideSeg[] } | null = null;

  private liquidMode = false;
  private liquidTrail: { x: number; y: number; born: number }[] = [];
  private lastZoomVar = 0;

  private scheduled = false;
  private lastTick = 0;
  private pendingFit = false;
  private autosaver: Autosaver | null = null;
  private glLayer: CanvasContentLayer | null = null;

  constructor(opts: BoardOptions) {
    const { root, canvas, domLayer, domLayerInner, kinds, forceFallback = false } = opts;
    this.canvas = canvas;
    this.registry = new KindRegistry(kinds);
    this.caps = resolveInteraction(opts.interaction);

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

    this.renderer = new Renderer(
      gl,
      this.camera,
      this.mode === 'dom',
      (n) => this.registry.of(n)?.chrome?.(n) ?? null,
      opts.background,
      (n) => this.registry.of(n)?.content,
      (n) => this.registry.isOverlay(n),
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
    const caps = this.caps;
    const editingPossible = caps.select || caps.move || caps.resize;
    this.pointer = new PointerController(
      root,
      {
        camera: this.camera,
        anim: this.anim,
        store: this.store,
        history: this.history,
        selection: this.selection,
        edit: this.edit,
        flags: this.flags,
        caps,
        nodeCaps: (n) => this.registry.capsOf(n),
        invalidate: () => this.invalidate(),
        setMarquee: (r) => (this.marquee = r),
        setGuides: (g) => (this.guides = g),
        visibleNodes: () => this.visibleNodes(),
        liquidOn: () => this.liquidMode,
        addLiquidPoint: (p) => this.addLiquidPoint(p),
      },
      {
        tools: [new SelectTool(), new HandTool(), ...(opts.tools ?? [])],
        initialTool: opts.initialTool ?? (editingPossible ? 'select' : 'hand'),
        panTool: 'hand',
      },
    );

    if (opts.persist !== false) {
      this.autosaver = new Autosaver(
        () => this.store.doc,
        () => this.camera,
      );
    }

    this.store.on('change', ({ ids, structural }) => {
      this.content.syncFromStore(structural ? undefined : ids);
      if (structural) this.selection.prune((id) => !!this.store.node(id));
      this.autosaver?.docChanged();
      this.invalidate();
    });
    this.store.on('reset', () => {
      this.selection.clear();
      this.history.clear();
    });
    this.selection.on('change', () => {
      this.glLayer?.updateSelection(this.selection.ids);
      this.invalidate();
    });

    document.documentElement.style.setProperty('--board-zoom', '1');
    this.observeResize();
    this.watchContextLoss();
  }

  private canvas: HTMLCanvasElement;

  // -- lifecycle ---------------------------------------------------------------

  /** Restore doc + camera from localStorage; fits the view on first visit. */
  loadFromStorage(): void {
    this.store.replaceDoc(loadDoc<N>(this.registry) ?? emptyDoc<N>());
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
    this.invalidate();
  }

  flushSave(): void {
    this.autosaver?.flush();
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
    if (animating || this.pointer.gestureActive) this.autosaver?.cameraChanged();

    const now = performance.now();
    this.liquidTrail = this.liquidTrail.filter((p) => now - p.born < 2000);
    const liquid = this.liquidTrail.length
      ? this.liquidTrail.map((p) => ({ x: p.x, y: p.y, age: (now - p.born) / 1000, strength: 1 }))
      : null;

    // portaled UI (dropdowns etc.) can scale itself with the board zoom
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
      getTexAspect: this.glLayer ? (id) => this.glLayer!.cache.aspectOf(id) : null,
      editingId: this.edit.activeId,
      liquid,
    });

    if (animating || liquid) this.invalidate();
    else this.lastTick = 0;
  }

  visibleNodes(): N[] {
    const vp = this.camera.viewportWorldRect();
    const margin = CULL_MARGIN / this.camera.z + CULL_MARGIN;
    const r: Rect = { x: vp.x - margin, y: vp.y - margin, w: vp.w + margin * 2, h: vp.h + margin * 2 };
    return this.store.orderedNodes().filter((n) => rectsIntersect({ x: n.x, y: n.y, w: n.w, h: n.h }, r));
  }

  // -- liquid effect ---------------------------------------------------------------

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

  // -- generic actions ----------------------------------------------------------

  insert(node: N, index = this.store.doc.nodeOrder.length): void {
    this.history.push(this.store, new AddNodes<N>([{ node, index }]));
    this.selection.set([node.id]);
  }

  deleteSelection(): void {
    if (!this.selection.size) return;
    this.edit.end();
    this.history.push(this.store, new DeleteNodes(this.store, [...this.selection.ids]));
    this.selection.clear();
  }

  duplicateSelection(offset = 16): void {
    if (!this.selection.size) return;
    const clones: { node: N; index: number }[] = [];
    let index = this.store.doc.nodeOrder.length;
    for (const id of this.selection.ids) {
      const n = this.store.node(id);
      if (!n) continue;
      clones.push({ node: { ...structuredClone(n), id: newNodeId(), x: n.x + offset, y: n.y + offset }, index: index++ });
    }
    if (!clones.length) return;
    this.history.push(this.store, new AddNodes(clones));
    this.selection.set(clones.map((c) => c.node.id));
  }

  selectAll(): void {
    this.selection.set(this.store.orderedNodes().filter((n) => this.registry.capsOf(n).selectable).map((n) => n.id));
  }

  /** Switch the active interaction tool ('select', 'hand', or a custom id). */
  setTool(id: string): void {
    this.pointer.setTool(id);
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
    const patches = new Map<NodeId, NodePatch<N>>();
    for (const id of this.selection.ids) {
      const n = this.store.node(id);
      if (!n) continue;
      patches.set(id, { before: { x: n.x, y: n.y } as Partial<N>, after: { x: n.x + dx, y: n.y + dy } as Partial<N> });
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

  // -- camera actions -------------------------------------------------------------

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
}

export function createBoard<N extends BaseNode = BaseNode>(opts: BoardOptions): Board<N> {
  return new Board<N>(opts);
}
