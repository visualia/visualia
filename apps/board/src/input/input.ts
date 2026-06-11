import type { Camera } from '../camera/camera';
import type { CameraAnim } from '../camera/camera-anim';
import { AddNodes, PatchNodes, type NodePatch } from '../core/history';
import type { History } from '../core/history';
import type { Store } from '../core/store';
import { newNodeId, type BNode, type NodeId, type Point, type Rect } from '../core/types';
import type { EditController } from '../content/edit';
import { HANDLE_CURSORS, MIN_H, MIN_W, handleAt, hitNode, nodesInRect, resizeRect, type Handle } from '../interact/hit-test';
import type { Selection } from '../interact/selection';
import { snapBBox, type GuideSeg } from '../interact/snap';
import { PinchTracker, VelocityTracker } from './touch';
import { classifyWheel, wheelZoomFactor } from './wheel';
import { clampZ } from '../camera/camera';

const DRAG_THRESHOLD_PX = 4;
const SNAP_THRESHOLD_PX = 6;
const LIQUID_CURSOR = 'help'; // the standard "?" cursor
const GRID_SIZE = 8; // world units; drags land on this grid unless object-snapped
const INERTIA_DISTANCE_MS = 160;

export interface InputHost {
  camera: Camera;
  anim: CameraAnim;
  store: Store;
  history: History;
  selection: Selection;
  edit: EditController;
  flags: { space: boolean };
  invalidate(): void;
  setMarquee(r: Rect | null): void;
  setGuides(g: { v: GuideSeg[]; h: GuideSeg[] } | null): void;
  visibleNodes(): BNode[];
  liquidOn(): boolean;
  addLiquidPoint(screen: Point): void;
}

type GState =
  | { k: 'idle' }
  | { k: 'pan'; pid: number; last: Point; touch: boolean }
  | { k: 'pressedNode'; pid: number; id: NodeId; startS: Point; startW: Point; shift: boolean; alt: boolean; wasSelected: boolean }
  | { k: 'pressedEmpty'; pid: number; startS: Point; startW: Point; shift: boolean; baseSel: Set<NodeId> }
  | { k: 'dragNodes'; pid: number; startW: Point; startPos: Map<NodeId, Point>; startBBox: Rect; cloneIds: NodeId[] | null }
  | { k: 'marquee'; pid: number; startW: Point; shift: boolean; baseSel: Set<NodeId> }
  | { k: 'resize'; pid: number; id: NodeId; handle: Handle; startRect: Rect; startW: Point }
  | { k: 'pinch'; pids: [number, number] };

export class PointerController {
  private state: GState = { k: 'idle' };
  private touches = new Map<number, Point>();
  private pinch = new PinchTracker();
  private velocity = new VelocityTracker();
  private lastLiquid: Point | null = null;

  constructor(
    private root: HTMLElement,
    private host: InputHost,
  ) {
    root.addEventListener('pointerdown', this.onPointerDown);
    root.addEventListener('pointermove', this.onPointerMove);
    root.addEventListener('pointerup', this.onPointerUp);
    root.addEventListener('pointercancel', this.onPointerUp);
    root.addEventListener('dblclick', this.onDblClick);
    root.addEventListener('wheel', this.onWheel, { passive: false });
    root.addEventListener('contextmenu', (e) => {
      if (this.state.k !== 'idle') e.preventDefault();
    });
  }

  get gestureActive(): boolean {
    return this.state.k !== 'idle';
  }

  updateCursor(): void {
    const { flags, edit } = this.host;
    if (this.host.liquidOn()) {
      this.root.style.cursor = LIQUID_CURSOR;
      return;
    }
    let cursor = 'default';
    switch (this.state.k) {
      case 'pan':
        cursor = 'grabbing';
        break;
      case 'dragNodes':
      case 'pressedNode':
        cursor = 'move';
        break;
      case 'resize':
        cursor = HANDLE_CURSORS[this.state.handle];
        break;
      case 'marquee':
      case 'pressedEmpty':
        cursor = 'crosshair';
        break;
      default:
        if (edit.activeId) cursor = 'auto';
        else if (flags.space) cursor = 'grab';
    }
    this.root.style.cursor = cursor;
  }

  private screenPt(e: PointerEvent | MouseEvent): Point {
    // board root is fullscreen at the origin, so client coords are screen coords
    return { x: e.clientX, y: e.clientY };
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
        this.abandonPress();
        host.anim.cancel();
        this.pinch.begin(a![1], b![1], host.camera.z);
        this.velocity.reset();
        this.state = { k: 'pinch', pids: [a![0], b![0]] };
        this.updateCursor();
        return;
      }
      if (this.touches.size > 2) return;
    }

    if (this.state.k !== 'idle') return;

    if (e.button === 1 || (e.button === 0 && host.flags.space)) {
      e.preventDefault();
      this.capture(e);
      host.anim.cancel();
      this.velocity.reset();
      this.state = { k: 'pan', pid: e.pointerId, last: s, touch: e.pointerType === 'touch' };
      this.updateCursor();
      return;
    }
    if (e.button !== 0) return;

    const w = host.camera.screenToWorld(s);

    // Resize handles take priority (only shown for a single selection).
    if (host.selection.size === 1) {
      const id = [...host.selection.ids][0]!;
      const node = host.store.node(id);
      const handle = node && handleAt(host.camera, node, s);
      if (node && handle) {
        this.capture(e);
        this.state = { k: 'resize', pid: e.pointerId, id, handle, startRect: { x: node.x, y: node.y, w: node.w, h: node.h }, startW: w };
        this.updateCursor();
        return;
      }
    }

    const hit = hitNode(host.store, w);
    if (hit) {
      const wasSelected = host.selection.has(hit.id);
      if (!e.shiftKey && !wasSelected) host.selection.set([hit.id]);
      this.capture(e);
      this.state = { k: 'pressedNode', pid: e.pointerId, id: hit.id, startS: s, startW: w, shift: e.shiftKey, alt: e.altKey, wasSelected };
    } else {
      this.capture(e);
      this.state = {
        k: 'pressedEmpty',
        pid: e.pointerId,
        startS: s,
        startW: w,
        shift: e.shiftKey,
        baseSel: new Set(host.selection.ids),
      };
    }
    this.updateCursor();
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

    const st = this.state;
    switch (st.k) {
      case 'idle': {
        this.hoverCursor(s);
        return;
      }
      case 'pinch': {
        const a = this.touches.get(st.pids[0]);
        const b = this.touches.get(st.pids[1]);
        if (!a || !b) return;
        const { z, mid, midDelta } = this.pinch.update(a, b);
        host.camera.zoomAbout(mid, clampZ(z));
        host.camera.panByScreen(midDelta.x, midDelta.y);
        this.velocity.add(mid.x, mid.y);
        host.invalidate();
        return;
      }
      case 'pan': {
        if (e.pointerId !== st.pid) return;
        host.camera.panByScreen(s.x - st.last.x, s.y - st.last.y);
        st.last = s;
        if (st.touch) this.velocity.add(s.x, s.y);
        host.invalidate();
        return;
      }
      case 'pressedNode': {
        if (e.pointerId !== st.pid) return;
        if (dist(s, st.startS) < DRAG_THRESHOLD_PX) return;
        const ids = host.selection.has(st.id) ? [...host.selection.ids] : [st.id];
        let dragIds = ids;
        let cloneIds: NodeId[] | null = null;
        if (st.alt) {
          // option-drag duplicates: originals stay, the copies follow the pointer
          const clones: BNode[] = [];
          for (const id of ids) {
            const n = host.store.node(id);
            if (n) clones.push({ ...structuredClone(n), id: newNodeId() });
          }
          for (const c of clones) host.store.addNode(c);
          cloneIds = clones.map((c) => c.id);
          host.selection.set(cloneIds);
          dragIds = cloneIds;
        }
        const startPos = new Map<NodeId, Point>();
        let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
        for (const id of dragIds) {
          const n = host.store.node(id);
          if (!n) continue;
          startPos.set(id, { x: n.x, y: n.y });
          bx0 = Math.min(bx0, n.x);
          by0 = Math.min(by0, n.y);
          bx1 = Math.max(bx1, n.x + n.w);
          by1 = Math.max(by1, n.y + n.h);
        }
        const startBBox = { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 };
        this.state = { k: 'dragNodes', pid: st.pid, startW: st.startW, startPos, startBBox, cloneIds };
        this.updateCursor();
        this.onPointerMove(e);
        return;
      }
      case 'pressedEmpty': {
        if (e.pointerId !== st.pid) return;
        if (dist(s, st.startS) < DRAG_THRESHOLD_PX) return;
        this.state = { k: 'marquee', pid: st.pid, startW: st.startW, shift: st.shift, baseSel: st.baseSel };
        this.updateCursor();
        this.onPointerMove(e);
        return;
      }
      case 'dragNodes': {
        if (e.pointerId !== st.pid) return;
        const w = host.camera.screenToWorld(s);
        let dx = w.x - st.startW.x;
        let dy = w.y - st.startW.y;
        // Object edges/centers take priority; otherwise land on the small grid.
        const candidates = host.visibleNodes().filter((n) => !st.startPos.has(n.id));
        const moved = { x: st.startBBox.x + dx, y: st.startBBox.y + dy, w: st.startBBox.w, h: st.startBBox.h };
        const snap = snapBBox(moved, candidates, SNAP_THRESHOLD_PX / host.camera.z);
        dx += snap.dx;
        dy += snap.dy;
        if (!snap.v.length) dx += Math.round(moved.x / GRID_SIZE) * GRID_SIZE - moved.x;
        if (!snap.h.length) dy += Math.round(moved.y / GRID_SIZE) * GRID_SIZE - moved.y;
        host.setGuides(snap.v.length || snap.h.length ? { v: snap.v, h: snap.h } : null);
        const patches = new Map<NodeId, Partial<BNode>>();
        for (const [id, p] of st.startPos) {
          patches.set(id, { x: p.x + dx, y: p.y + dy });
        }
        host.store.patchNodes(patches);
        host.invalidate();
        return;
      }
      case 'resize': {
        if (e.pointerId !== st.pid) return;
        const w = host.camera.screenToWorld(s);
        const r = resizeRect(st.startRect, st.handle, w.x - st.startW.x, w.y - st.startW.y);
        // moved edges land on the grid
        const g = (v: number): number => Math.round(v / GRID_SIZE) * GRID_SIZE;
        if (st.handle.includes('w')) {
          const x = Math.min(g(r.x), r.x + r.w - MIN_W);
          r.w += r.x - x;
          r.x = x;
        }
        if (st.handle.includes('e')) r.w = Math.max(MIN_W, g(r.x + r.w) - r.x);
        if (st.handle.includes('n')) {
          const y = Math.min(g(r.y), r.y + r.h - MIN_H);
          r.h += r.y - y;
          r.y = y;
        }
        if (st.handle.includes('s')) r.h = Math.max(MIN_H, g(r.y + r.h) - r.y);
        host.store.patchNode(st.id, r);
        host.invalidate();
        return;
      }
      case 'marquee': {
        if (e.pointerId !== st.pid) return;
        const w = host.camera.screenToWorld(s);
        const rect = normRect(st.startW, w);
        host.setMarquee(rect);
        const ids = nodesInRect(host.store, rect).map((n) => n.id);
        host.selection.set(st.shift ? [...st.baseSel, ...ids] : ids);
        host.invalidate();
        return;
      }
    }
  };

  // -- pointerup / cancel -------------------------------------------------------

  private onPointerUp = (e: PointerEvent): void => {
    const { host } = this;
    if (e.pointerType === 'touch') this.touches.delete(e.pointerId);
    const st = this.state;

    switch (st.k) {
      case 'pinch': {
        if (!st.pids.includes(e.pointerId)) return;
        const remaining = st.pids.find((p) => this.touches.has(p));
        if (remaining !== undefined) {
          const last = this.touches.get(remaining)!;
          this.state = { k: 'pan', pid: remaining, last, touch: true };
        } else {
          this.applyInertia();
          this.state = { k: 'idle' };
        }
        break;
      }
      case 'pan': {
        if (e.pointerId !== st.pid) return;
        if (st.touch) this.applyInertia();
        this.state = { k: 'idle' };
        break;
      }
      case 'pressedNode': {
        if (e.pointerId !== st.pid) return;
        if (st.shift) host.selection.toggle(st.id);
        else host.selection.set([st.id]);
        this.state = { k: 'idle' };
        break;
      }
      case 'pressedEmpty': {
        if (e.pointerId !== st.pid) return;
        if (!st.shift) host.selection.clear();
        this.state = { k: 'idle' };
        break;
      }
      case 'dragNodes': {
        if (e.pointerId !== st.pid) return;
        host.setGuides(null);
        if (st.cloneIds) {
          // one undoable command for the whole duplicate-drag, at final positions
          const snapshots = st.cloneIds
            .map((id) => ({ node: host.store.node(id), index: host.store.doc.nodeOrder.indexOf(id) }))
            .filter((s2): s2 is { node: BNode; index: number } => !!s2.node && s2.index >= 0)
            .map((s2) => ({ node: structuredClone(s2.node), index: s2.index }));
          if (snapshots.length) host.history.push(host.store, new AddNodes(snapshots), true);
        } else {
          const patches = new Map<NodeId, NodePatch>();
          for (const [id, p] of st.startPos) {
            const n = host.store.node(id);
            if (!n || (n.x === p.x && n.y === p.y)) continue;
            patches.set(id, { before: { x: p.x, y: p.y }, after: { x: n.x, y: n.y } });
          }
          if (patches.size) host.history.push(host.store, new PatchNodes('move', patches), true);
        }
        this.state = { k: 'idle' };
        break;
      }
      case 'resize': {
        if (e.pointerId !== st.pid) return;
        const n = host.store.node(st.id);
        if (n) {
          const after = { x: n.x, y: n.y, w: n.w, h: n.h };
          if (JSON.stringify(after) !== JSON.stringify(st.startRect)) {
            host.history.push(
              host.store,
              new PatchNodes('resize', new Map([[st.id, { before: { ...st.startRect }, after }]])),
              true,
            );
          }
        }
        this.state = { k: 'idle' };
        break;
      }
      case 'marquee': {
        if (e.pointerId !== st.pid) return;
        host.setMarquee(null);
        this.state = { k: 'idle' };
        break;
      }
      case 'idle':
        break;
    }
    this.updateCursor();
    host.invalidate();
  };

  // -- double click ---------------------------------------------------------

  private onDblClick = (e: MouseEvent): void => {
    const { host } = this;
    const target = (e.target as Element | null)?.closest?.('.node') as HTMLElement | null;
    if (host.edit.activeId && target?.dataset.id === host.edit.activeId) return;
    const s = this.screenPt(e);
    const w = host.camera.screenToWorld(s);
    const hit = hitNode(host.store, w);
    if (hit) {
      host.selection.set([hit.id]);
      host.edit.begin(hit.id, s);
    }
    this.updateCursor();
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

  private abandonPress(): void {
    if (this.state.k === 'pressedNode' || this.state.k === 'pressedEmpty' || this.state.k === 'pan') {
      this.state = { k: 'idle' };
    }
  }

  private applyInertia(): void {
    const v = this.velocity.velocity();
    this.velocity.reset();
    if (!v) return;
    const cam = this.host.camera;
    this.host.anim.animateTo({
      x: cam.x - (v.x * INERTIA_DISTANCE_MS) / cam.z,
      y: cam.y - (v.y * INERTIA_DISTANCE_MS) / cam.z,
      z: cam.z,
    });
    this.host.invalidate();
  }

  private hoverCursor(s: Point): void {
    const { host } = this;
    if (host.liquidOn()) {
      this.root.style.cursor = LIQUID_CURSOR;
      return;
    }
    if (host.edit.activeId) return;
    let cursor = host.flags.space ? 'grab' : 'default';
    if (!host.flags.space && host.selection.size === 1) {
      const id = [...host.selection.ids][0]!;
      const node = host.store.node(id);
      const handle = node && handleAt(host.camera, node, s);
      if (handle) cursor = HANDLE_CURSORS[handle];
    }
    this.root.style.cursor = cursor;
  }
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}
