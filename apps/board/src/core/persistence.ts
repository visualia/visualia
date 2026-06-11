import type { KindRegistry } from './kinds';
import type { BoardDoc, CameraState } from './types';
import { emptyDoc } from './types';

const DOC_KEY = 'board:doc';
const CAMERA_KEY = 'board:camera';
const SAVE_DEBOUNCE_MS = 500;
const CAMERA_THROTTLE_MS = 1000;

export function loadDoc(registry: KindRegistry): BoardDoc | null {
  const raw = localStorage.getItem(DOC_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BoardDoc>;
    if (parsed.version !== 1) throw new Error(`unknown doc version ${String(parsed.version)}`);
    const doc = emptyDoc();
    const nodes = parsed.nodes ?? {};
    const order = Array.isArray(parsed.nodeOrder) ? parsed.nodeOrder : Object.keys(nodes);
    for (const id of order) {
      const rawNode = (nodes as Record<string, unknown>)[id];
      if (typeof rawNode !== 'object' || rawNode === null || doc.nodes[id]) continue;
      const type = (rawNode as { type?: unknown }).type;
      const kind = typeof type === 'string' ? registry.get(type) : undefined;
      const node = kind?.deserialize(rawNode); // kinds sanitize/migrate; unknown types drop
      if (!node || node.id !== id) continue;
      doc.nodes[id] = node as BoardDoc['nodes'][string];
      doc.nodeOrder.push(id);
    }
    return doc;
  } catch (err) {
    console.warn('board: corrupt saved doc, starting fresh', err);
    localStorage.setItem(`${DOC_KEY}.corrupt`, raw);
    localStorage.removeItem(DOC_KEY);
    return null;
  }
}

export function loadCamera(): CameraState | null {
  try {
    const raw = localStorage.getItem(CAMERA_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as CameraState;
    if (![c.x, c.y, c.z].every(Number.isFinite) || c.z <= 0) return null;
    return c;
  } catch {
    return null;
  }
}

export class Autosaver {
  private docTimer: number | undefined;
  private cameraLastSaved = 0;
  private cameraTimer: number | undefined;

  constructor(
    private getDoc: () => BoardDoc,
    private getCamera: () => CameraState,
  ) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
    window.addEventListener('beforeunload', () => this.flush());
  }

  docChanged(): void {
    clearTimeout(this.docTimer);
    this.docTimer = window.setTimeout(() => this.saveDoc(), SAVE_DEBOUNCE_MS);
  }

  cameraChanged(): void {
    if (this.cameraTimer !== undefined) return;
    const wait = Math.max(0, CAMERA_THROTTLE_MS - (performance.now() - this.cameraLastSaved));
    this.cameraTimer = window.setTimeout(() => {
      this.cameraTimer = undefined;
      this.saveCamera();
    }, wait);
  }

  flush(): void {
    if (this.docTimer !== undefined) {
      clearTimeout(this.docTimer);
      this.docTimer = undefined;
      this.saveDoc();
    }
    this.saveCamera();
  }

  private saveDoc(): void {
    try {
      localStorage.setItem(DOC_KEY, JSON.stringify(this.getDoc()));
    } catch (err) {
      console.warn('board: autosave failed', err);
    }
  }

  private saveCamera(): void {
    this.cameraLastSaved = performance.now();
    const { x, y, z } = this.getCamera();
    try {
      localStorage.setItem(CAMERA_KEY, JSON.stringify({ x, y, z }));
    } catch {
      /* camera persistence is best-effort */
    }
  }
}
