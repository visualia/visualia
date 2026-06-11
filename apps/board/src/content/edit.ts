import { DeleteNodes, PatchNodes, type History, type NodePatch } from '../core/history';
import type { Store } from '../core/store';
import type { NodeId, Point } from '../core/types';
import type { ContentLayer } from './content-layer';

const MIN_TEXT_H = 28;

/** Manages the single inline contenteditable session. */
export class EditController {
  activeId: NodeId | null = null;
  private before = '';
  private beforeH = 0;
  private onInput = (): void => this.grow();

  constructor(
    private layer: ContentLayer,
    private store: Store,
    private history: History,
    private invalidate: () => void,
  ) {}

  begin(id: NodeId, screenPt?: Point): void {
    if (this.activeId === id) return;
    this.end();
    const node = this.store.node(id);
    const r = this.layer.elementFor(id);
    if (!node || !r) return;
    if (node.type === 'widget') {
      // Widgets aren't contenteditable — "editing" routes pointer events to
      // the live React component until click-out/Escape, and focuses its
      // first inputtable control so the keyboard works immediately.
      this.activeId = id;
      this.before = '';
      this.layer.setEditing(id);
      this.focusWidgetControl(r.content);
      this.invalidate();
      return;
    }
    this.activeId = id;
    this.before = node.content;
    this.beforeH = node.h;
    this.layer.setEditing(id);
    r.content.contentEditable = 'true';
    r.content.addEventListener('input', this.onInput);
    r.content.focus({ preventScroll: true });
    if (screenPt) this.placeCaret(screenPt);
    else this.selectAllText(r.content);
    this.invalidate();
  }

  end(): void {
    const id = this.activeId;
    if (!id) return;
    this.activeId = null;
    const r = this.layer.elementFor(id);
    const node = this.store.node(id);
    this.layer.setEditing(null);
    if (!r || !node) return;
    if (node.type === 'widget') {
      (document.activeElement as HTMLElement | null)?.blur?.();
      this.invalidate();
      return;
    }
    r.content.removeEventListener('input', this.onInput);
    r.content.contentEditable = 'false';
    r.content.blur();
    window.getSelection()?.removeAllRanges(); // drop leftover text highlight

    // a text node with no actual text is invisible clutter — drop it
    if (node.type === 'text' && (r.content.textContent ?? '').trim() === '') {
      this.history.push(this.store, new DeleteNodes(this.store, [id]));
      this.invalidate();
      return;
    }

    const after = r.content.innerHTML;
    const afterH = this.measuredHeight(id) ?? node.h;
    if (after !== this.before || afterH !== this.beforeH) {
      const patch: NodePatch = {
        before: { content: this.before, h: this.beforeH },
        after: { content: after, h: afterH },
      };
      this.store.patchNode(id, patch.after);
      this.layer.noteContentSynced(id, after);
      this.history.push(this.store, new PatchNodes('edit', new Map([[id, patch]])), true);
    }
    this.invalidate();
  }

  /** Re-assert focus on the active session (something stole it, e.g. a closing dialog). */
  refocus(): void {
    if (!this.activeId) return;
    const r = this.layer.elementFor(this.activeId);
    if (!r) return;
    if (this.store.node(this.activeId)?.type === 'widget') {
      this.focusWidgetControl(r.content);
      return;
    }
    r.content.focus({ preventScroll: true });
    this.selectAllText(r.content); // caret to end
  }

  /** Text fields first, then any focusable control (switch, slider, button…). */
  private focusWidgetControl(content: HTMLElement): void {
    const el =
      content.querySelector<HTMLElement>('input, textarea, select') ??
      content.querySelector<HTMLElement>('button, [role="switch"], [role="slider"], [tabindex]:not([tabindex="-1"])');
    el?.focus({ preventScroll: true });
    if (el instanceof HTMLInputElement && el.type === 'text') el.select();
  }

  /** Grow text nodes to fit content while typing (not undoable mid-session). */
  private grow(): void {
    const id = this.activeId;
    if (!id) return;
    const node = this.store.node(id);
    if (!node || node.type !== 'text') return;
    const h = this.measuredHeight(id);
    if (h && Math.abs(h - node.h) > 0.5) this.store.patchNode(id, { h });
  }

  private measuredHeight(id: NodeId): number | null {
    const node = this.store.node(id);
    if (!node || node.type !== 'text') return null;
    const h = this.layer.measureContentHeight(id);
    return h ? Math.max(MIN_TEXT_H, h) : null;
  }

  private placeCaret(screenPt: Point): void {
    // Board root is fullscreen at (0,0), so screen coords equal client coords.
    // Works in GL mode because getElementTransform keeps DOM geometry aligned.
    const sel = window.getSelection();
    if (!sel) return;
    const pos = document.caretPositionFromPoint?.(screenPt.x, screenPt.y);
    if (pos?.offsetNode) {
      sel.setBaseAndExtent(pos.offsetNode, pos.offset, pos.offsetNode, pos.offset);
    }
  }

  /** Select the whole content so typing replaces placeholder text. */
  private selectAllText(content: HTMLElement): void {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(content);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}
