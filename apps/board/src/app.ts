import {
  AddNodes,
  Board,
  DeleteNodes,
  KeyboardController,
  PatchNodes,
  defaultKeymap,
  frameKind,
  imageKind,
  newNodeId,
  proxyResolver,
  rectsIntersect,
  textKind,
  videoKind,
  type KeyBinding,
  type NodePatch,
  type Point,
} from '@visualia/engine';
import { threeKind } from '@visualia/three';
import type { BNode } from './node-types';
import { CommandMenu } from './ui/command-menu';
import { widgetKind } from '@visualia/shadcn';
import { WIDGETS } from '@visualia/shadcn';

/** website capture metadata (from the /capture sidecar — see plans/website.md) */
interface WebRect {
  id: string;
  tag: string;
  rect: [number, number, number, number];
  text: string;
}
interface CaptureMeta {
  img: string;
  w: number;
  h: number;
  title: string;
  sourceUrl: string;
  rects: WebRect[];
  error?: string;
}
/** per-captured-node state for click-to-crop: rects in page px + the node scale */
interface CaptureState {
  rects: WebRect[];
  pageW: number;
  pageH: number;
  scale: number; // page px → node px
  sourceUrl: string;
}

/** successive 3D inserts walk this list in order, wrapping around */
const THREE_MODELS = [
  'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb',
  'https://modelviewer.dev/shared-assets/models/RobotExpressive.glb',
];

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
  private threeInserts = 0;

  // -- presentation (zero-setup: frames are slides, ordered by layout) --------
  private presenting = false;
  private slides: string[] = [];
  private slideIndex = 0;
  private savedCamera: { x: number; y: number; z: number } | null = null;

  // website captures: nodeId → element rect map (page-space) for click-to-crop
  // (transient — survives the session, not reload; the screenshot node itself
  // persists via its /capture-img src)
  private captures = new Map<string, CaptureState>();

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
      // low floor: text boxes are leading-trimmed (text-box: trim-both text text)
      kinds: [
        textKind({ minHeight: 10 }),
        frameKind(),
        widgetKind,
        threeKind(),
        // media from any host textures in GL mode via the dev-server proxy;
        // the doc keeps canonical URLs (see plans/image-proxy.md)
        imageKind({ resolveSrc: proxyResolver() }),
        videoKind({ resolveSrc: proxyResolver() }),
      ],
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
          // presentation keys win while presenting (when-guarded so they don't
          // swallow arrows/space/Esc otherwise); placed first for priority
          ...this.presentationBindings(),
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

  // -- presentation ----------------------------------------------------------
  // Zero setup: the board's frames ARE the slides, ordered by an inferred
  // reading order. Present starts at the selected frame (or the logical first),
  // arrows/space step, Esc flies back to the pre-presentation camera.

  get isPresenting(): boolean {
    return this.presenting;
  }

  private presentationBindings(): KeyBinding[] {
    const on = (): boolean => this.presenting;
    const next = (): void => this.stepSlide(1);
    const prev = (): void => this.stepSlide(-1);
    return [
      { key: 'ArrowRight', when: on, run: next },
      { key: 'ArrowDown', when: on, run: next },
      { key: ' ', when: on, run: next },
      { key: 'PageDown', when: on, run: next },
      { key: 'Enter', when: on, run: next },
      { key: 'ArrowLeft', when: on, run: prev },
      { key: 'ArrowUp', when: on, run: prev },
      { key: 'PageUp', when: on, run: prev },
      { key: 'Escape', when: on, run: () => this.exitPresentation() },
    ];
  }

  /** Frames (card nodes) in inferred reading order: rows top→bottom, each
      sorted left→right. Greedy row clustering by vertical-center overlap. */
  private orderedFrames(): BNode[] {
    const frames = this.board.store.orderedNodes().filter((n) => n.type === 'card');
    if (!frames.length) return [];
    const rows: BNode[][] = [];
    for (const f of [...frames].sort((a, b) => a.y - b.y)) {
      const cy = f.y + f.h / 2;
      const row = rows.find((r) => {
        const top = Math.min(...r.map((n) => n.y));
        const bot = Math.max(...r.map((n) => n.y + n.h));
        const tol = Math.min(f.h, ...r.map((n) => n.h)) * 0.5;
        return cy >= top - tol && cy <= bot + tol;
      });
      if (row) row.push(f);
      else rows.push([f]);
    }
    rows.sort((a, b) => Math.min(...a.map((n) => n.y)) - Math.min(...b.map((n) => n.y)));
    for (const r of rows) r.sort((a, b) => a.x - b.x);
    return rows.flat();
  }

  startPresentation(): void {
    const order = this.orderedFrames();
    if (!order.length) return;
    this.slides = order.map((n) => n.id);

    // start at the selected frame, else the frame containing the selection, else first
    let start = 0;
    const sel = [...this.board.selection.ids];
    if (sel.length) {
      const card = sel.find((id) => this.board.store.node(id)?.type === 'card');
      if (card) {
        start = Math.max(0, this.slides.indexOf(card));
      } else {
        const n = this.board.store.node(sel[0]!);
        if (n) {
          const cx = n.x + n.w / 2;
          const cy = n.y + n.h / 2;
          const i = order.findIndex((f) => cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h);
          if (i >= 0) start = i;
        }
      }
    }

    this.board.edit.end();
    this.board.clearSelection();
    const cam = this.board.camera;
    this.savedCamera = { x: cam.x, y: cam.y, z: cam.z };
    this.presenting = true;
    document.body.classList.add('presenting');
    this.board.pointer.updateCursor();
    this.slideIndex = start;
    this.flyToSlide();
  }

  private stepSlide(dir: 1 | -1): void {
    if (!this.presenting) return;
    const next = this.slideIndex + dir;
    if (next < 0 || next >= this.slides.length) return; // clamp at ends
    this.slideIndex = next;
    this.flyToSlide();
  }

  private flyToSlide(): void {
    const n = this.board.store.node(this.slides[this.slideIndex] ?? '');
    if (!n) return this.exitPresentation(); // frame deleted mid-show
    this.board.anim.flyTo(this.board.camera.fitTarget({ x: n.x, y: n.y, w: n.w, h: n.h }));
    this.board.invalidate();
  }

  exitPresentation(): void {
    if (!this.presenting) return;
    this.presenting = false;
    document.body.classList.remove('presenting');
    this.board.pointer.updateCursor();
    if (this.savedCamera) {
      this.board.anim.flyTo(this.savedCamera);
      this.board.invalidate();
    }
    this.savedCamera = null;
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
    this.insertFrame({});
  }

  private insertFrame(props: Record<string, unknown>): BNode {
    const w = typeof props.w === 'number' ? props.w : 320; // same insert width as components
    const h = typeof props.h === 'number' ? props.h : 480; // image + heading + description + a control row
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
    const raw = {
      content: '',
      fill: '#ffffff',
      ...props,
      id: newNodeId(),
      type: 'card',
      x: typeof props.x === 'number' ? props.x : p.x,
      y: typeof props.y === 'number' ? props.y : p.y,
      w,
      h,
    };
    const node = this.board.registry.get('card')?.deserialize(raw) as BNode | null;
    if (!node) throw new Error('invalid frame props');
    // frames are backgrounds: insert at the bottom of the z-order
    this.board.history.push(this.board.store, new AddNodes([{ node, index: 0 }]));
    this.board.selection.set([node.id]);
    return node;
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

  createThreeAtCenter(src = THREE_MODELS[this.threeInserts++ % THREE_MODELS.length]!): void {
    const w = 320;
    const h = 320;
    const p = this.insertPlacement(w, h, true);
    const node: BNode = { id: newNodeId(), type: 'three', x: p.x, y: p.y, w: p.w, h, src };
    this.board.insert(node);
  }

  createImageAtCenter(src = `https://picsum.photos/seed/${Math.floor(Math.random() * 1e6)}/640/480`): void {
    const p = this.insertPlacement(320, 240, true, true);
    const node: BNode = { id: newNodeId(), type: 'image', x: p.x, y: p.y, w: p.w, h: Math.round(p.w * 0.75), src };
    this.board.insert(node);
  }

  createVideoAtCenter(src = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'): void {
    const p = this.insertPlacement(320, 180, true, true);
    const node: BNode = { id: newNodeId(), type: 'video', x: p.x, y: p.y, w: p.w, h: Math.round(p.w * 0.5625), src };
    this.board.insert(node);
  }

  createHeadingAtCenter(): void {
    this.createTextNodeAtCenter(32, 360, true, 'Heading');
  }

  createDescriptionAtCenter(): void {
    this.createTextNodeAtCenter(15, 320, false, 'Description');
  }

  private createTextNodeAtCenter(fontSize: number, width: number, bold: boolean, content: string): void {
    // leading-trimmed single line: ascent + descent of the system font ≈ 1.2em
    const h = Math.round(fontSize * 1.2);
    const p = this.insertPlacement(width, h);
    const node: BNode = { id: newNodeId(), type: 'text', x: p.x, y: p.y, w: p.w, h, content, fontSize, bold };
    this.board.insert(node);
    this.board.edit.begin(node.id);
  }

  // -- agent verbs (shared by MCP, and later @-commands / palette) -------------
  // Inserts and patches go through the kind's deserialize, so agent input gets
  // the same validation/sanitization as persisted docs.

  agentSnapshot(): Record<string, unknown> {
    const cam = this.board.camera;
    return {
      mode: this.board.mode,
      camera: { x: cam.x, y: cam.y, z: cam.z, viewW: cam.viewW, viewH: cam.viewH },
      selection: [...this.board.selection.ids],
      nodes: this.board.store.orderedNodes(),
    };
  }

  agentInsert(type: string, props: Record<string, unknown> = {}): BNode {
    const kind = this.board.registry.get(type);
    if (!kind) throw new Error(`unknown node type "${type}"`);
    if (type === 'card') return this.insertFrame(props);

    const typeDefaults: Record<string, Record<string, unknown>> = {
      text: { content: '', fontSize: 15 },
      three: { src: THREE_MODELS[0] },
    };
    const seed = { ...typeDefaults[type], ...props };
    const defaults = kind.defaults ?? { w: 320, h: 240 };
    const w = typeof seed.w === 'number' ? seed.w : defaults.w;
    let h = typeof seed.h === 'number' ? seed.h : defaults.h;
    if (type === 'text' && typeof seed.h !== 'number') {
      const fs = typeof seed.fontSize === 'number' ? seed.fontSize : 15;
      h = Math.round(fs * 1.2); // leading-trimmed single line (see createTextNodeAtCenter)
    }

    const flush = type === 'image' || type === 'video';
    const p = this.insertPlacement(w, h, true, flush);
    const raw = {
      ...seed,
      id: newNodeId(),
      type,
      x: typeof seed.x === 'number' ? seed.x : p.x,
      y: typeof seed.y === 'number' ? seed.y : p.y,
      w: typeof seed.w === 'number' ? seed.w : p.w,
      h,
    };
    const node = kind.deserialize(raw) as BNode | null;
    if (!node) throw new Error(`invalid props for "${type}" (missing required fields?)`);
    this.board.insert(node); // auto-fits auto-height kinds (text) to content
    return this.board.store.node(node.id) ?? node; // re-read for the corrected h
  }

  agentPatch(id: string, props: Record<string, unknown>): BNode {
    const n = this.board.store.node(id);
    if (!n) throw new Error(`no node "${id}"`);
    const merged = this.board.registry
      .get(n.type)
      ?.deserialize({ ...structuredClone(n), ...props, id: n.id, type: n.type }) as BNode | null;
    if (!merged) throw new Error(`invalid patch for "${n.type}"`);
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      before[key] = (n as unknown as Record<string, unknown>)[key];
      after[key] = (merged as unknown as Record<string, unknown>)[key];
    }
    const patch: NodePatch<BNode> = { before: before as Partial<BNode>, after: after as Partial<BNode> };
    this.board.history.push(this.board.store, new PatchNodes('agent', new Map([[id, patch]])));
    // content/width edits may change the auto-height; re-fit unless the caller
    // set h explicitly (then they meant it)
    if (props.h === undefined) this.board.edit.fitHeight(id);
    return this.board.store.node(id)!;
  }

  agentDelete(ids: string[]): number {
    const existing = ids.filter((id) => this.board.store.node(id));
    if (existing.length) {
      this.board.edit.end();
      this.board.history.push(this.board.store, new DeleteNodes(this.board.store, existing));
    }
    return existing.length;
  }

  agentZoomTo(ids?: string[]): void {
    if (!ids?.length) {
      this.board.zoomToFit();
      return;
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of ids) {
      const n = this.board.store.node(id);
      if (!n) continue;
      x0 = Math.min(x0, n.x);
      y0 = Math.min(y0, n.y);
      x1 = Math.max(x1, n.x + n.w);
      y1 = Math.max(y1, n.y + n.h);
    }
    if (x0 === Infinity) throw new Error('no such nodes');
    this.board.anim.animateTo(this.board.camera.fitTarget({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }));
    this.board.invalidate();
  }

  // -- website capture (plans/website.md) --------------------------------------

  /** Capture a URL as a full-page screenshot node via the /capture sidecar.
      Returns the node id + the croppable element list. */
  async agentCapture(url: string): Promise<Record<string, unknown>> {
    const res = await fetch(`/capture?url=${encodeURIComponent(url)}`);
    const cap = (await res.json()) as CaptureMeta;
    if (!res.ok || cap.error) throw new Error(cap.error ?? `capture failed (${res.status})`);
    const W = 400;
    const scale = W / cap.w;
    const node = this.agentInsert('image', { src: cap.img, w: W, h: Math.max(1, Math.round(cap.h * scale)) });
    this.captures.set(node.id, { rects: cap.rects, pageW: cap.w, pageH: cap.h, scale, sourceUrl: cap.sourceUrl });
    return {
      id: node.id,
      sourceUrl: cap.sourceUrl,
      title: cap.title,
      w: node.w,
      h: node.h,
      elements: cap.rects.map((e) => ({ id: e.id, tag: e.tag, text: e.text })),
    };
  }

  /** Crop a captured website node to one of its elements → a new image node.
      target = element id from the capture's list, a tag/text match, or a raw
      page rect. (The agent's equivalent of click-to-crop.) */
  async agentCrop(
    nodeId: string,
    target: string | { rect: [number, number, number, number] },
  ): Promise<Record<string, unknown>> {
    const cap = this.captures.get(nodeId);
    const host = this.board.store.node(nodeId);
    if (!cap || !host) throw new Error(`no captured node "${nodeId}" (capture it first)`);
    let pageRect: [number, number, number, number];
    if (typeof target === 'object') {
      pageRect = target.rect;
    } else {
      const t = target.toLowerCase();
      const el =
        cap.rects.find((e) => e.id === target) ??
        cap.rects.find((e) => e.tag === t) ??
        cap.rects.find((e) => e.text.toLowerCase().includes(t));
      if (!el) throw new Error(`no element matching "${target}"`);
      pageRect = el.rect;
    }
    const node = await this.cropCapture(host, cap, pageRect);
    return { id: node.id, w: node.w, h: node.h, sourceUrl: cap.sourceUrl };
  }

  /** Draw `pageRect` of the full screenshot onto a canvas → a plain image node
      (a data-URL crop), placed beside the source. Mode-agnostic: it's just an
      image afterward, so GL/DOM both render it with no special machinery. */
  private async cropCapture(
    host: BNode,
    cap: CaptureState,
    pageRect: [number, number, number, number],
  ): Promise<BNode> {
    const [px, py, pw, ph] = pageRect;
    const fullSrc = (host as { src?: string }).src ?? '';
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('crop: source screenshot failed to load'));
      im.src = fullSrc; // same-origin /capture-img → canvas stays untainted
    });
    const canvas = document.createElement('canvas');
    canvas.width = pw;
    canvas.height = ph;
    canvas.getContext('2d')!.drawImage(img, px, py, pw, ph, 0, 0, pw, ph);
    const s = cap.scale;
    const node: BNode = {
      id: newNodeId(),
      type: 'image',
      x: host.x + host.w + 24,
      y: host.y,
      w: Math.max(8, Math.round(pw * s)),
      h: Math.max(8, Math.round(ph * s)),
      src: canvas.toDataURL('image/png'),
    } as BNode;
    this.board.insert(node);
    return node;
  }

  /** rect map for a captured node (for the click-to-crop overlay). */
  captureRects(nodeId: string): { rects: WebRect[]; scale: number } | null {
    const c = this.captures.get(nodeId);
    return c ? { rects: c.rects, scale: c.scale } : null;
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
