import type { BNode, BoardDoc, CameraState } from './types';
import { emptyDoc } from './types';

const DOC_KEY = 'board:doc';
const CAMERA_KEY = 'board:camera';
const SAVE_DEBOUNCE_MS = 500;
const CAMERA_THROTTLE_MS = 1000;

/**
 * Content HTML is local-only data in v1, but strip active content anyway so a
 * future import feature can't smuggle scripts through the same path.
 */
export function sanitizeHtml(html: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_ELEMENT);
  const doomed: Element[] = [];
  for (let el = walker.nextNode() as Element | null; el; el = walker.nextNode() as Element | null) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'iframe' || tag === 'object' || tag === 'embed') {
      doomed.push(el);
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      else if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(attr.value))
        el.removeAttribute(attr.name);
    }
  }
  for (const el of doomed) el.remove();
  return tpl.innerHTML;
}

function validNode(n: unknown): n is BNode {
  if (typeof n !== 'object' || n === null) return false;
  const o = n as Record<string, unknown>;
  const base =
    typeof o.id === 'string' &&
    typeof o.x === 'number' &&
    typeof o.y === 'number' &&
    typeof o.w === 'number' &&
    typeof o.h === 'number';
  if (!base) return false;
  if (o.type === 'text' || o.type === 'card') return typeof o.content === 'string';
  if (o.type === 'widget') return typeof o.component === 'string';
  return false;
}

export function loadDoc(): BoardDoc | null {
  const raw = localStorage.getItem(DOC_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BoardDoc>;
    if (parsed.version !== 1) throw new Error(`unknown doc version ${String(parsed.version)}`);
    const doc = emptyDoc();
    const nodes = parsed.nodes ?? {};
    const order = Array.isArray(parsed.nodeOrder) ? parsed.nodeOrder : Object.keys(nodes);
    for (const id of order) {
      const n = (nodes as Record<string, unknown>)[id];
      if (!validNode(n) || n.id !== id || doc.nodes[id]) continue; // drop unknown/corrupt defensively
      if (n.type !== 'widget') n.content = sanitizeHtml(n.content);
      doc.nodes[id] = n;
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
