import { AddNodes, PatchNodes, type NodePatch } from '../core/history';
import { newNodeId, type BaseNode, type NodeId, type Point, type Rect } from '../core/types';
import { HANDLE_CURSORS, MIN_H, MIN_W, handleAt, hitNode, nodesInRect, resizeRect, type Handle } from '../interact/hit-test';
import { snapBBox } from '../interact/snap';
import { dist, normRect, type InputHost, type Tool, type ToolEvent } from './input';
import { VelocityTracker } from './touch';

const DRAG_THRESHOLD_PX = 4;
const SNAP_THRESHOLD_PX = 6;
const GRID_SIZE = 8; // world units; drags land on this grid unless object-snapped
const INERTIA_DISTANCE_MS = 160;

// -- hand: pan/zoom only ---------------------------------------------------------

type HandState = { pid: number; last: Point; touch: boolean } | null;

/** Pan tool — the whole surface drags the camera. Default in viewer boards,
    and the middle-button/space-bar fallback everywhere. */
export class HandTool implements Tool {
  readonly id = 'hand';
  private state: HandState = null;
  private velocity = new VelocityTracker();

  get active(): boolean {
    return this.state !== null;
  }

  cursor(): string {
    return this.state ? 'grabbing' : 'grab';
  }

  onDown(ev: ToolEvent, host: InputHost): void {
    host.anim.cancel();
    this.velocity.reset();
    this.state = { pid: ev.e.pointerId, last: ev.screen, touch: ev.e.pointerType === 'touch' };
  }

  /** adopt a touch pointer mid-flight (pinch degrading to one finger) */
  adoptPointer(pid: number, screen: Point, touch: boolean, host: InputHost): void {
    host.anim.cancel();
    this.velocity.reset();
    this.state = { pid, last: screen, touch };
  }

  onMove(ev: ToolEvent, host: InputHost): void {
    const st = this.state;
    if (!st || ev.e.pointerId !== st.pid) return;
    host.camera.panByScreen(ev.screen.x - st.last.x, ev.screen.y - st.last.y);
    st.last = ev.screen;
    if (st.touch) this.velocity.add(ev.screen.x, ev.screen.y);
    host.invalidate();
  }

  onUp(ev: ToolEvent, host: InputHost): void {
    const st = this.state;
    if (!st || ev.e.pointerId !== st.pid) return;
    if (st.touch) this.applyInertia(host);
    this.state = null;
  }

  onCancel(): void {
    this.state = null;
    this.velocity.reset();
  }

  private applyInertia(host: InputHost): void {
    const v = this.velocity.velocity();
    this.velocity.reset();
    if (!v) return;
    const cam = host.camera;
    host.anim.animateTo({
      x: cam.x - (v.x * INERTIA_DISTANCE_MS) / cam.z,
      y: cam.y - (v.y * INERTIA_DISTANCE_MS) / cam.z,
      z: cam.z,
    });
    host.invalidate();
  }
}

// -- select: the editor state machine ---------------------------------------------

type SelectState =
  | { k: 'idle' }
  | { k: 'pressedNode'; pid: number; id: NodeId; startS: Point; startW: Point; shift: boolean; alt: boolean; wasSelected: boolean }
  | { k: 'pressedEmpty'; pid: number; startS: Point; startW: Point; shift: boolean; baseSel: Set<NodeId> }
  | { k: 'dragNodes'; pid: number; startW: Point; startPos: Map<NodeId, Point>; startBBox: Rect; cloneIds: NodeId[] | null }
  | { k: 'marquee'; pid: number; startW: Point; shift: boolean; baseSel: Set<NodeId> }
  | { k: 'resize'; pid: number; id: NodeId; handle: Handle; startRect: Rect; startW: Point; startNode: BaseNode };

/**
 * Editor tool: click/shift-click selection, marquee, node dragging with
 * snapping, edge/corner resize. Honors board caps (select/move/resize) and
 * per-node kind capabilities; presses that nothing claims fall through to a
 * camera pan, so a caps-restricted board still navigates.
 */
export class SelectTool implements Tool {
  readonly id = 'select';
  private state: SelectState = { k: 'idle' };
  private fallbackPan = new HandTool();
  private hoverKey = ''; // last hovered node for shift-group preview caching

  get active(): boolean {
    return this.state.k !== 'idle' || this.fallbackPan.active;
  }

  cursor(host: InputHost, screen?: Point): string {
    if (this.fallbackPan.active) return this.fallbackPan.cursor();
    switch (this.state.k) {
      case 'dragNodes':
      case 'pressedNode':
        return 'move';
      case 'resize':
        return HANDLE_CURSORS[this.state.handle];
      case 'marquee':
      case 'pressedEmpty':
        return 'crosshair';
      default: {
        if (screen && host.caps.resize && host.selection.size === 1) {
          const id = [...host.selection.ids][0]!;
          const node = host.store.node(id);
          if (node && host.nodeCaps(node).resizable) {
            const handle = handleAt(host.camera, node, screen);
            if (handle) return HANDLE_CURSORS[handle];
          }
        }
        return 'default';
      }
    }
  }

  onDown(ev: ToolEvent, host: InputHost): void {
    const { e, screen: s, world: w } = ev;
    if (this.hoverKey) {
      this.hoverKey = '';
      host.setGroupHints(null);
    }

    // Resize handles take priority (only shown for a single selection).
    if (host.caps.resize && host.selection.size === 1) {
      const id = [...host.selection.ids][0]!;
      const node = host.store.node(id);
      if (node && host.nodeCaps(node).resizable) {
        const handle = handleAt(host.camera, node, s);
        if (handle) {
          this.state = {
            k: 'resize',
            pid: e.pointerId,
            id,
            handle,
            startRect: { x: node.x, y: node.y, w: node.w, h: node.h },
            startW: w,
            startNode: structuredClone(node),
          };
          return;
        }
      }
    }

    const hit = host.caps.select ? hitNode(host.store, w, (n) => host.nodeCaps(n).selectable) : null;
    if (hit) {
      const wasSelected = host.selection.has(hit.id);
      if (!e.shiftKey && !wasSelected) host.selection.set([hit.id]);
      this.state = { k: 'pressedNode', pid: e.pointerId, id: hit.id, startS: s, startW: w, shift: e.shiftKey, alt: e.altKey, wasSelected };
    } else if (host.caps.select) {
      this.state = {
        k: 'pressedEmpty',
        pid: e.pointerId,
        startS: s,
        startW: w,
        shift: e.shiftKey,
        baseSel: new Set(host.selection.ids),
      };
    } else {
      // nothing here for this tool to do — navigate instead
      this.fallbackPan.onDown(ev, host);
    }
  }

  onMove(ev: ToolEvent, host: InputHost): void {
    if (this.fallbackPan.active) {
      this.fallbackPan.onMove(ev, host);
      return;
    }
    const { e, screen: s } = ev;
    const st = this.state;
    switch (st.k) {
      case 'idle':
        return;
      case 'pressedNode': {
        if (e.pointerId !== st.pid) return;
        if (dist(s, st.startS) < DRAG_THRESHOLD_PX) return;
        if (!host.caps.move) return; // press stays a (future) click
        // shift-drag moves the inferred group (plans/grouping.md); select it so
        // it's clear what's moving. otherwise drag the selection (or this node).
        let ids: NodeId[];
        if (st.shift) {
          const node = host.store.node(st.id);
          ids = node ? host.groupOf(node) : [st.id];
          host.selection.set(ids);
        } else {
          ids = host.selection.has(st.id) ? [...host.selection.ids] : [st.id];
        }
        let dragIds = ids.filter((id) => {
          const n = host.store.node(id);
          return n && host.nodeCaps(n).movable;
        });
        if (!dragIds.length) return;
        let cloneIds: NodeId[] | null = null;
        if (st.alt) {
          // option-drag duplicates: originals stay, the copies follow the pointer
          const clones: BaseNode[] = [];
          for (const id of dragIds) {
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
        this.onMove(ev, host);
        return;
      }
      case 'pressedEmpty': {
        if (e.pointerId !== st.pid) return;
        if (dist(s, st.startS) < DRAG_THRESHOLD_PX) return;
        this.state = { k: 'marquee', pid: st.pid, startW: st.startW, shift: st.shift, baseSel: st.baseSel };
        this.onMove(ev, host);
        return;
      }
      case 'dragNodes': {
        if (e.pointerId !== st.pid) return;
        const w = ev.world;
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
        const patches = new Map<NodeId, Partial<BaseNode>>();
        for (const [id, p] of st.startPos) {
          patches.set(id, { x: p.x + dx, y: p.y + dy });
        }
        host.store.patchNodes(patches);
        host.invalidate();
        return;
      }
      case 'resize': {
        if (e.pointerId !== st.pid) return;
        const w = ev.world;
        const r = resizeRect(st.startRect, st.handle, w.x - st.startW.x, w.y - st.startW.y);
        // a kind may reinterpret the drag (e.g. crop a screenshot window)
        const con = host.resizeConstrain(st.startNode, r, st.handle);
        if (con) {
          host.store.patchNode(st.id, { ...con.rect, ...(con.patch ?? {}) });
          host.setGuides(con.guides ?? null);
          host.invalidate();
          return;
        }
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
        const rect = normRect(st.startW, ev.world);
        host.setMarquee(rect);
        const ids = nodesInRect(host.store, rect, (n) => host.nodeCaps(n).selectable).map((n) => n.id);
        host.selection.set(st.shift ? [...st.baseSel, ...ids] : ids);
        host.invalidate();
        return;
      }
    }
  }

  onUp(ev: ToolEvent, host: InputHost): void {
    if (this.fallbackPan.active) {
      this.fallbackPan.onUp(ev, host);
      return;
    }
    const { e } = ev;
    const st = this.state;
    switch (st.k) {
      case 'pressedNode': {
        if (e.pointerId !== st.pid) return;
        if (st.shift) {
          // shift+click toggles the clicked node's inferred group (plans/grouping.md)
          const node = host.store.node(st.id);
          const group = node ? host.groupOf(node) : [st.id];
          const cur = new Set(host.selection.ids);
          if (group.every((id) => cur.has(id))) group.forEach((id) => cur.delete(id));
          else group.forEach((id) => cur.add(id));
          host.selection.set([...cur]);
        } else host.selection.set([st.id]);
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
            .filter((s2): s2 is { node: BaseNode; index: number } => !!s2.node && s2.index >= 0)
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
        host.setGuides(null);
        const n = host.store.node(st.id);
        if (n) {
          // diff every field that changed (x/y/w/h, plus a crop window etc. a
          // resizeConstrain kind may have patched) so undo restores all of it
          const before: Record<string, unknown> = {};
          const after: Record<string, unknown> = {};
          const start = st.startNode as unknown as Record<string, unknown>;
          const cur = n as unknown as Record<string, unknown>;
          for (const k of new Set([...Object.keys(start), ...Object.keys(cur)])) {
            if (k === 'id' || k === 'type') continue;
            if (JSON.stringify(start[k]) !== JSON.stringify(cur[k])) {
              before[k] = start[k];
              after[k] = cur[k];
            }
          }
          if (Object.keys(after).length) {
            host.history.push(
              host.store,
              new PatchNodes('resize', new Map([[st.id, { before: before as Partial<BaseNode>, after: after as Partial<BaseNode> }]])),
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
  }

  /** Shift-hover previews the inferred group the pointer is over (plans/grouping.md). */
  onHover(ev: ToolEvent, host: InputHost): void {
    if (this.state.k !== 'idle' || this.fallbackPan.active) return;
    if (!ev.e.shiftKey) {
      if (this.hoverKey) {
        this.hoverKey = '';
        host.setGroupHints(null);
        host.invalidate();
      }
      return;
    }
    const hit = host.caps.select ? hitNode(host.store, ev.world, (n) => host.nodeCaps(n).selectable) : null;
    const key = hit?.id ?? '';
    if (key === this.hoverKey) return;
    this.hoverKey = key;
    const group = hit ? host.groupOf(hit) : [];
    const rects =
      group.length > 1
        ? group
            .map((id) => host.store.node(id))
            .filter((n): n is BaseNode => !!n)
            .map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }))
        : null;
    host.setGroupHints(rects);
    host.invalidate();
  }

  onCancel(host: InputHost): void {
    if (this.state.k === 'marquee') host.setMarquee(null);
    if (this.state.k === 'dragNodes' || this.state.k === 'resize') host.setGuides(null);
    this.fallbackPan.onCancel();
    this.state = { k: 'idle' };
  }
}
