import type { Camera } from '../camera/camera';
import type { CameraAnim } from '../camera/camera-anim';
import type { History } from '../core/history';
import type { NodeCaps } from '../core/kinds';
import type { Store } from '../core/store';
import type { BaseNode, Point, Rect } from '../core/types';
import type { EditController } from '../content/edit';
import { hitNode } from '../interact/hit-test';
import type { Selection } from '../interact/selection';
import type { GuideSeg } from '../interact/snap';
import type { InteractionCaps } from './interaction';
import { PinchTracker } from './touch';
import { classifyWheel, wheelZoomFactor } from './wheel';
import { clampZ } from '../camera/camera';

const LIQUID_CURSOR = 'help'; // the standard "?" cursor

/** Everything a tool may act on. Provided by the Board facade. */
export interface InputHost {
  camera: Camera;
  anim: CameraAnim;
  store: Store;
  history: History;
  selection: Selection;
  edit: EditController;
  /** shared modifier state (space-pan); a keyboard layer mutates this */
  flags: { space: boolean };
  /** board-level interaction capabilities */
  caps: InteractionCaps;
  /** per-node caps from the kind registry (already defaulted) */
  nodeCaps(node: BaseNode): NodeCaps;
  invalidate(): void;
  setMarquee(r: Rect | null): void;
  setGuides(g: { v: GuideSeg[]; h: GuideSeg[] } | null): void;
  visibleNodes(): BaseNode[];
  liquidOn(): boolean;
  addLiquidPoint(screen: Point): void;
}

/** A pointer event normalized for tools. */
export interface ToolEvent {
  e: PointerEvent;
  screen: Point;
  world: Point;
}

/**
 * An interaction model. The PointerController normalizes events (capture,
 * touch/pinch, wheel, edit-session click-out) and routes single-pointer
 * gestures to the active tool; the tool owns its own gesture state machine.
 * Engine built-ins: SelectTool (editor) and HandTool (pan). Apps register
 * custom tools via BoardOptions.tools and switch with board.setTool(id).
 */
export interface Tool {
  readonly id: string;
  /** a gesture is in progress (this tool has claimed the pointer) */
  readonly active: boolean;
  /** cursor for the current state; `screen` is provided on idle hover */
  cursor(host: InputHost, screen?: Point): string;
  onDown(ev: ToolEvent, host: InputHost): void;
  onMove(ev: ToolEvent, host: InputHost): void;
  onUp(ev: ToolEvent, host: InputHost): void;
  /** the gesture was taken away (pinch started, tool switched) */
  onCancel(host: InputHost): void;
  /** adopt an in-flight pointer (e.g. pinch degrading to a one-finger pan) */
  adoptPointer?(pid: number, screen: Point, touch: boolean, host: InputHost): void;
}

export interface PointerControllerOptions {
  tools: Tool[];
  /** id of the initially active tool */
  initialTool: string;
  /** id of the tool used for middle-button / space-bar panning */
  panTool: string;
}

export class PointerController {
  private tools = new Map<string, Tool>();
  private activeId: string;
  private panToolId: string;
  /** tool that claimed the current pointer gesture */
  private gestureTool: Tool | null = null;
  private touches = new Map<number, Point>();
  private pinchPids: [number, number] | null = null;
  private pinch = new PinchTracker();
  private lastLiquid: Point | null = null;

  constructor(
    private root: HTMLElement,
    private host: InputHost,
    opts: PointerControllerOptions,
  ) {
    for (const t of opts.tools) this.tools.set(t.id, t);
    this.activeId = opts.initialTool;
    this.panToolId = opts.panTool;

    root.addEventListener('pointerdown', this.onPointerDown);
    root.addEventListener('pointermove', this.onPointerMove);
    root.addEventListener('pointerup', this.onPointerUp);
    root.addEventListener('pointercancel', this.onPointerUp);
    root.addEventListener('dblclick', this.onDblClick);
    root.addEventListener('wheel', this.onWheel, { passive: false });
    root.addEventListener('contextmenu', (e) => {
      if (this.gestureActive) e.preventDefault();
    });
  }

  get gestureActive(): boolean {
    return this.pinchPids !== null || !!this.gestureTool?.active;
  }

  get activeTool(): Tool {
    return this.tools.get(this.activeId) ?? [...this.tools.values()][0]!;
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.id, tool);
  }

  setTool(id: string): void {
    if (id === this.activeId || !this.tools.has(id)) return;
    this.gestureTool?.onCancel(this.host);
    this.gestureTool = null;
    this.activeId = id;
    this.updateCursor();
    this.host.invalidate();
  }

  updateCursor(screen?: Point): void {
    const { host } = this;
    if (host.liquidOn()) {
      this.root.style.cursor = LIQUID_CURSOR;
      return;
    }
    if (this.gestureTool?.active) {
      this.root.style.cursor = this.gestureTool.cursor(host, screen);
      return;
    }
    if (host.edit.activeId) {
      this.root.style.cursor = 'auto';
      return;
    }
    if (host.flags.space) {
      this.root.style.cursor = 'grab';
      return;
    }
    this.root.style.cursor = this.activeTool.cursor(host, screen);
  }

  private screenPt(e: PointerEvent | MouseEvent): Point {
    // board root is fullscreen at the origin, so client coords are screen coords
    return { x: e.clientX, y: e.clientY };
  }

  private toolEvent(e: PointerEvent): ToolEvent {
    const screen = this.screenPt(e);
    return { e, screen, world: this.host.camera.screenToWorld(screen) };
  }

  // -- pointerdown ------------------------------------------------------------

  private onPointerDown = (e: PointerEvent): void => {
    const { host } = this;
    const s = this.screenPt(e);

    // Let the active contenteditable receive its own events. Radix portals
    // (select dropdowns etc.) live in document.body but belong to the editing
    // widget — clicking them must not exit edit mode.
    const target = e.target as Element | null;
    const editEl = host.edit.activeId ? (target?.closest?.('.node') as HTMLElement | null) : null;
    if (host.edit.activeId && editEl?.dataset.id === host.edit.activeId) return;
    if (host.edit.activeId && target?.closest?.('[data-radix-popper-content-wrapper], [data-slot="select-content"]')) {
      return;
    }
    if (host.edit.activeId) {
      // the press that leaves edit mode only commits — it never starts a
      // drag/marquee, so an exit click can't accidentally move an element
      host.edit.end();
      this.updateCursor();
      host.invalidate();
      return;
    }

    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, s);
      this.root.setPointerCapture(e.pointerId);
      if (this.touches.size === 2) {
        const [a, b] = [...this.touches.entries()];
        this.gestureTool?.onCancel(host);
        this.gestureTool = null;
        host.anim.cancel();
        this.pinch.begin(a![1], b![1], host.camera.z);
        this.pinchPids = [a![0], b![0]];
        this.updateCursor();
        return;
      }
      if (this.touches.size > 2) return;
    }

    if (this.gestureActive) return;
    if (e.button !== 0 && e.button !== 1) return;

    // middle button / held space always routes to the pan tool
    const pan = e.button === 1 || host.flags.space;
    const tool = pan ? (this.tools.get(this.panToolId) ?? this.activeTool) : this.activeTool;
    if (pan) e.preventDefault();

    this.capture(e);
    tool.onDown(this.toolEvent(e), host);
    if (tool.active) this.gestureTool = tool;
    this.updateCursor(s);
    host.invalidate();
  };

  // -- pointermove ------------------------------------------------------------

  private onPointerMove = (e: PointerEvent): void => {
    const { host } = this;
    const s = this.screenPt(e);
    if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) this.touches.set(e.pointerId, s);

    if (host.liquidOn()) {
      if (!this.lastLiquid || dist(s, this.lastLiquid) > 6) {
        this.lastLiquid = s;
        host.addLiquidPoint(s);
      }
    } else {
      this.lastLiquid = null;
    }

    if (this.pinchPids) {
      const a = this.touches.get(this.pinchPids[0]);
      const b = this.touches.get(this.pinchPids[1]);
      if (!a || !b) return;
      const { z, mid, midDelta } = this.pinch.update(a, b);
      host.camera.zoomAbout(mid, clampZ(z));
      host.camera.panByScreen(midDelta.x, midDelta.y);
      host.invalidate();
      return;
    }

    if (this.gestureTool?.active) {
      this.gestureTool.onMove(this.toolEvent(e), host);
      return;
    }
    this.updateCursor(s); // idle hover
  };

  // -- pointerup / cancel -------------------------------------------------------

  private onPointerUp = (e: PointerEvent): void => {
    const { host } = this;
    if (e.pointerType === 'touch') this.touches.delete(e.pointerId);

    if (this.pinchPids) {
      if (!this.pinchPids.includes(e.pointerId)) return;
      const remaining = this.pinchPids.find((p) => this.touches.has(p));
      this.pinchPids = null;
      if (remaining !== undefined) {
        // degrade to a one-finger pan on the pan tool
        const panTool = this.tools.get(this.panToolId);
        const last = this.touches.get(remaining)!;
        if (panTool?.adoptPointer) {
          panTool.adoptPointer(remaining, last, true, host);
          this.gestureTool = panTool;
        }
      }
      this.updateCursor();
      host.invalidate();
      return;
    }

    if (this.gestureTool) {
      this.gestureTool.onUp(this.toolEvent(e), host);
      if (!this.gestureTool.active) this.gestureTool = null;
    }
    this.updateCursor(this.screenPt(e));
    host.invalidate();
  };

  // -- double click ---------------------------------------------------------

  private onDblClick = (e: MouseEvent): void => {
    const { host } = this;
    if (!host.caps.edit) return;
    const target = (e.target as Element | null)?.closest?.('.node') as HTMLElement | null;
    if (host.edit.activeId && target?.dataset.id === host.edit.activeId) return;
    const s = this.screenPt(e);
    const w = host.camera.screenToWorld(s);
    const hit = hitNode(host.store, w);
    if (hit) {
      if (host.caps.select) host.selection.set([hit.id]);
      host.edit.begin(hit.id, s);
    }
    this.updateCursor(s);
    host.invalidate();
  };

  // -- wheel ------------------------------------------------------------------

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const { host } = this;
    const intent = classifyWheel(e, host.camera.viewH);
    const s = this.screenPt(e);
    if (intent.kind === 'zoom') {
      // Direct manipulation like Figma — no animation between events.
      host.anim.cancel();
      host.camera.zoomAbout(s, clampZ(host.camera.z * wheelZoomFactor(intent.dy)));
    } else {
      host.anim.cancel();
      host.camera.panByScreen(-intent.dx, -intent.dy);
    }
    host.invalidate();
  };

  // -- helpers ----------------------------------------------------------------

  private capture(e: PointerEvent): void {
    try {
      this.root.setPointerCapture(e.pointerId);
    } catch {
      /* capture can fail if the pointer is already gone */
    }
  }
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}
