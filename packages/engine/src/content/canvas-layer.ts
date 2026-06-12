import type { Camera } from '../camera/camera';
import type { KindRegistry } from '../core/kinds';
import type { Store } from '../core/store';
import type { BaseNode, NodeId } from '../core/types';
import { TextureCache } from '../render/texture-cache';
import { ContentLayer, type NodeRefs } from './content-layer';

const SCALE_STEPS = [0.5, 1, 2, 4] as const;
const MAX_CAPTURE_PX = 4096;
const RESCALE_DEBOUNCE_MS = 150;
const SCALE_HYSTERESIS = 0.15;
const CARET_BLINK_MS = 500;
const PARK = 'translate(-100000px, -100000px)';
/** transform settle delay after the camera stops moving */
const SETTLE_MS = 80;
/** texElementImage2D captures per paint event — spreads big capture storms
    (thousands of nodes scrolled into view) over frames instead of one freeze */
const MAX_CAPTURES_PER_PAINT = 100;

/**
 * HTML-in-canvas mode. Wrappers are direct children of <canvas layoutsubtree>:
 * invisible but hit-testable/focusable. We capture each wrapper into a GL
 * texture inside the canvas `paint` event and keep the wrapper's CSS transform
 * synced via getElementTransform so DOM interactivity lands on rendered pixels.
 *
 * Crispness: capture happens at layout size, so the wrapper is laid out at
 * node.w*s × node.h*s with `zoom: s` on the inner content; the GL quad still
 * maps to the node's world rect, so the texture is sharp whenever s >= z*dpr.
 *
 * Kinds with content.mode 'overlay' render as visible DOM in #gl-overlay
 * above the canvas instead (media texElementImage2D can't rasterize).
 */
export class CanvasContentLayer extends ContentLayer {
  readonly mode = 'gl' as const;
  readonly cache: TextureCache;

  private scales = new Map<NodeId, number>();
  /** size|scale|content fingerprint of the last capture request, per node */
  private captureKeys = new Map<NodeId, string>();
  private pendingCapture = new Set<NodeId>();
  private visibleIds = new Set<NodeId>();
  /** wrappers whose CSS transform matches the current camera */
  private placed = new Set<NodeId>();
  /** wrappers currently parked offscreen */
  private parked = new Set<NodeId>();
  private lastCamSig = '';
  private settleTimer: number | undefined;
  private rescaleTimer: number | undefined;
  private caretTimer: number | undefined;
  private hasGetElementTransform: boolean;
  private overlayInner: HTMLDivElement;

  constructor(
    private canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    store: Store,
    registry: KindRegistry,
    private camera: Camera,
    private dpr: () => number,
    private invalidate: () => void,
  ) {
    super(store, registry);
    this.ctxInvalidate = invalidate;
    this.cache = new TextureCache(gl);
    this.hasGetElementTransform = typeof canvas.getElementTransform === 'function';
    canvas.addEventListener('paint', this.onPaint as EventListener);

    const overlayEl = document.createElement('div');
    overlayEl.id = 'gl-overlay';
    this.overlayInner = document.createElement('div');
    this.overlayInner.id = 'gl-overlay-inner';
    overlayEl.appendChild(this.overlayInner);
    canvas.parentElement?.appendChild(overlayEl);
  }

  protected container(): HTMLElement {
    return this.canvas;
  }

  protected override containerFor(node: BaseNode): HTMLElement {
    return this.registry.isOverlay(node) ? this.overlayInner : this.canvas;
  }

  override contentScale(id: NodeId): number {
    return this.scales.get(id) ?? 1;
  }

  getTexture = (id: NodeId): WebGLTexture | null => this.cache.get(id);

  private captureKey(node: BaseNode): string {
    const spec = this.registry.of(node)?.content;
    const key = spec?.contentKey(node) ?? '';
    // media textures hold native pixels — node size/scale don't invalidate them
    if (spec?.source) return key;
    return `${node.w}|${node.h}|${this.contentScale(node.id)}|${key}`;
  }

  override syncFromStore(ids?: NodeId[]): void {
    const before = new Set(this.refs.keys());
    super.syncFromStore(ids);
    for (const id of ids ?? this.store.doc.nodeOrder) {
      const node = this.store.node(id);
      if (!node || !this.refs.has(id)) continue;
      if (this.registry.isOverlay(node)) continue; // visible DOM — no scales, no captures
      if (!before.has(id)) {
        this.scales.set(id, this.pickScale(node));
        this.applyNodeStyle(node, this.refs.get(id)!); // re-apply with the chosen scale
      }
      // Recapture only when size, scale or content changed — pure moves keep the texture.
      const key = this.captureKey(node);
      if (this.captureKeys.get(id) !== key) {
        this.captureKeys.set(id, key);
        this.markDirty(id);
      }
    }
    for (const id of before) {
      if (!this.refs.has(id)) {
        this.cache.evictOne(id);
        this.scales.delete(id);
        this.captureKeys.delete(id);
        this.pendingCapture.delete(id);
        this.placed.delete(id);
        this.parked.delete(id);
      }
    }
  }

  sync(visible: BaseNode[]): void {
    const cam = this.camera;
    this.cache.frame++;
    this.visibleIds.clear();
    for (const n of visible) this.visibleIds.add(n.id);

    // overlay container mirrors the camera (its children are world-positioned)
    this.overlayInner.style.transform = `translate(${-cam.x * cam.z}px, ${-cam.y * cam.z}px) scale(${cam.z})`;

    // Per-node DOM transforms exist for interactivity (events land on the
    // rendered pixels) — the GL pass positions quads from camera uniforms.
    // Rewriting thousands of them via getElementTransform every frame is the
    // dominant frame cost at far zoom, so while the camera moves we skip them
    // entirely and settle once it stops; `placed` tracks which wrappers are
    // already correct so steady-state frames write nothing.
    const camSig = `${cam.x}|${cam.y}|${cam.z}`;
    const moving = camSig !== this.lastCamSig;
    this.lastCamSig = camSig;
    if (moving) {
      this.placed.clear();
      clearTimeout(this.settleTimer);
      this.settleTimer = window.setTimeout(() => this.invalidate(), SETTLE_MS);
    }

    let scaleMismatch = false;
    for (const n of visible) {
      const r = this.refs.get(n.id);
      if (!r || this.registry.isOverlay(n)) continue;
      // live content (playing video) changes every frame — keep capturing
      const spec = this.registry.of(n)?.content;
      if (spec?.live?.(n, r.content)) this.markDirty(n.id);
      // media path: upload pending sources directly — plain texImage2D has no
      // paint-event constraint, so this happens right here in the frame
      if (spec?.source && this.pendingCapture.has(n.id)) {
        const src = spec.source(n, r.content);
        if (src) {
          this.cache.uploadMedia(n.id, src, !this.registry.liveHint(n));
          // CORS failure also clears pending: retrying every frame can't fix it
          this.pendingCapture.delete(n.id);
          this.cache.enforceBudget(this.visibleIds);
        }
        // src null: not decodable yet — the kind invalidates when it is
      }
      const s = this.contentScale(n.id);
      if (!moving && !this.placed.has(n.id)) {
        const m = new DOMMatrix()
          .translateSelf((n.x - cam.x) * cam.z, (n.y - cam.y) * cam.z)
          .scaleSelf(cam.z / s);
        this.setTransform(r, m);
        this.placed.add(n.id);
        this.parked.delete(n.id);
      }
      if (!moving && this.scaleStepFor(n) !== s) scaleMismatch = true;
      if (!this.cache.has(n.id)) this.markDirty(n.id);
    }
    for (const [id, r] of this.refs) {
      if (this.visibleIds.has(id) || id === this.editingId) continue;
      if (this.parked.has(id)) continue; // already offscreen
      const node = this.store.node(id);
      if (node && this.registry.isOverlay(node)) continue; // world-positioned, culling unnecessary
      r.wrapper.style.transform = PARK;
      this.parked.add(id);
      this.placed.delete(id);
    }
    if (scaleMismatch) this.scheduleRescale();
  }

  protected override applyNodeStyle(node: BaseNode, r: NodeRefs): void {
    if (this.registry.isOverlay(node)) this.scales.set(node.id, 1);
    super.applyNodeStyle(node, r);
    if (this.registry.isOverlay(node)) r.wrapper.style.transform = `translate(${node.x}px, ${node.y}px)`;
    else this.placed.delete(node.id); // geometry may have changed — re-sync its transform
  }

  /** Overlay nodes sit above the GL canvas, so their selection ring is CSS. */
  updateSelection(ids: ReadonlySet<NodeId>): void {
    for (const [id, r] of this.refs) {
      const node = this.store.node(id);
      if (!node || !this.registry.isOverlay(node)) continue;
      r.wrapper.classList.toggle('overlay-selected', ids.has(id));
    }
  }

  override setEditing(id: NodeId | null): void {
    super.setEditing(id);
    clearInterval(this.caretTimer);
    this.caretTimer = undefined;
    if (id) {
      // Caret blink may not fire paint events; force periodic recapture.
      this.caretTimer = window.setInterval(() => this.markDirty(id), CARET_BLINK_MS);
    }
  }

  markDirty(id: NodeId): void {
    this.pendingCapture.add(id);
    this.canvas.requestPaint?.();
    // If requestPaint is unavailable the next paint event (or capture with
    // last-frame data) still picks this up via the pending set.
    this.invalidate();
  }

  markAllDirty(): void {
    for (const id of this.refs.keys()) this.markDirty(id);
  }

  override dispose(): void {
    this.canvas.removeEventListener('paint', this.onPaint as EventListener);
    clearInterval(this.caretTimer);
    clearTimeout(this.rescaleTimer);
    clearTimeout(this.settleTimer);
    this.cache.clear();
    super.dispose();
  }

  // -- capture ---------------------------------------------------------------

  private onPaint = (e: CanvasPaintEvent): void => {
    const ids = new Set(this.pendingCapture);
    for (const el of e.changedElements ?? []) {
      const id = (el as HTMLElement).dataset?.id ?? (el.closest?.('.node') as HTMLElement | null)?.dataset?.id;
      if (id) ids.add(id);
    }
    let captured = 0;
    let deferred = false;
    for (const id of ids) {
      if (captured >= MAX_CAPTURES_PER_PAINT) {
        deferred = true; // leave the rest in pendingCapture for the next paint
        break;
      }
      if (!this.visibleIds.has(id) && id !== this.editingId) continue; // capture on re-entry instead
      const node = this.store.node(id);
      const r = this.refs.get(id);
      if (!node || !r || this.registry.isOverlay(node)) {
        this.pendingCapture.delete(id);
        continue;
      }
      if (this.registry.of(node)?.content?.source) continue; // media uploads happen in sync(), not via element capture
      const s = this.contentScale(id);
      const mips = !this.registry.liveHint(node);
      if (this.cache.capture(id, r.wrapper, node.w * s, node.h * s, s, this.dpr(), mips)) {
        this.pendingCapture.delete(id);
        captured++;
      }
    }
    if (deferred) this.canvas.requestPaint?.();
    if (captured) {
      this.cache.enforceBudget(this.visibleIds);
      this.invalidate();
    }
  };

  // -- crispness / scale steps -------------------------------------------------

  private pickScale(node: BaseNode): number {
    // media textures hold native pixels — capture scale is meaningless
    if (this.registry.of(node)?.content?.source) return 1;
    // Per-frame-captured content stays at 1:1 — supersampling video every
    // frame (plus mips) can saturate the main thread.
    if (this.registry.liveHint(node)) return 1;
    const raw = this.camera.z * this.dpr();
    let s: number = SCALE_STEPS[SCALE_STEPS.length - 1]!;
    for (const step of SCALE_STEPS) {
      if (step >= raw) {
        s = step;
        break;
      }
    }
    const cap = MAX_CAPTURE_PX / (Math.max(node.w, node.h) * this.dpr());
    while (s > SCALE_STEPS[0]! && node.w * s * this.dpr() > MAX_CAPTURE_PX) s /= 2;
    return Math.min(s, Math.max(cap, SCALE_STEPS[0]!));
  }

  private scaleStepFor(node: BaseNode): number {
    if (this.registry.of(node)?.content?.source) return 1;
    if (this.registry.liveHint(node)) return 1;
    const current = this.contentScale(node.id);
    const raw = this.camera.z * this.dpr();
    // Hysteresis: stay on the current step while raw is within ±15% of its range.
    if (raw <= current * (1 + SCALE_HYSTERESIS) && raw > (current / 2) * (1 - SCALE_HYSTERESIS)) {
      return current;
    }
    return this.pickScale(node);
  }

  private scheduleRescale(): void {
    clearTimeout(this.rescaleTimer);
    this.rescaleTimer = window.setTimeout(() => {
      for (const id of this.visibleIds) {
        const node = this.store.node(id);
        const r = this.refs.get(id);
        if (!node || !r) continue;
        const next = this.scaleStepFor(node);
        if (next === this.contentScale(id)) continue;
        this.scales.set(id, next);
        this.applyNodeStyle(node, r);
        this.captureKeys.set(id, this.captureKey(node));
        this.markDirty(id);
      }
      this.invalidate();
    }, RESCALE_DEBOUNCE_MS);
  }

  // -- transform sync ----------------------------------------------------------

  private setTransform(r: NodeRefs, m: DOMMatrix): void {
    if (this.hasGetElementTransform) {
      try {
        r.wrapper.style.transform = String(this.canvas.getElementTransform!(r.wrapper, m));
        return;
      } catch {
        this.hasGetElementTransform = false; // signature drift — fall back for good
      }
    }
    r.wrapper.style.transform = m.toString();
  }
}
