import { DeleteNodes, PatchNodes, type History, type NodePatch } from '../core/history';
import type { HtmlEditSpec, KindRegistry } from '../core/kinds';
import type { Store } from '../core/store';
import type { BaseNode, NodeId, Point } from '../core/types';
import type { ContentLayer } from './content-layer';

/**
 * Manages the single edit session. Behavior is supplied by the node kind's
 * EditSpec: 'html' kinds get a contenteditable session (placeholder
 * select-all, auto-grow, empty-delete per spec); 'activate' kinds just route
 * pointer events to their live DOM and focus the right control.
 */
export class EditController {
  activeId: NodeId | null = null;
  private before = '';
  private beforeH = 0;
  private onInput = (): void => this.grow();

  constructor(
    private layer: ContentLayer,
    private store: Store,
    private registry: KindRegistry,
    private history: History,
    private invalidate: () => void,
  ) {}

  private htmlSpec(node: BaseNode): HtmlEditSpec<BaseNode> | null {
    const spec = this.registry.of(node)?.edit;
    return spec && spec.kind === 'html' ? (spec as HtmlEditSpec<BaseNode>) : null;
  }

  begin(id: NodeId, screenPt?: Point): void {
    if (this.activeId === id) return;
    this.end();
    const node = this.store.node(id);
    const r = this.layer.elementFor(id);
    if (!node || !r) return;
    const spec = this.registry.of(node)?.edit;
    if (!spec) return;

    if (spec.kind === 'activate') {
      // route pointer events to the live component until click-out/Escape,
      // and focus its first inputtable control so the keyboard works
      this.activeId = id;
      this.before = '';
      this.layer.setEditing(id);
      if (spec.focus) spec.focus(r.content);
      else this.focusDefaultControl(r.content);
      this.invalidate();
      return;
    }

    this.activeId = id;
    this.before = spec.get(node);
    this.beforeH = node.h;
    this.layer.setEditing(id);
    r.content.contentEditable = 'true';
    if (spec.autoHeight) r.content.addEventListener('input', this.onInput);
    r.content.focus({ preventScroll: true });
    if (screenPt) this.placeCaret(screenPt);
    else if (spec.selectAllOnBegin !== false) this.selectAllText(r.content);
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

    const spec = this.registry.of(node)?.edit;
    if (!spec || spec.kind === 'activate') {
      (document.activeElement as HTMLElement | null)?.blur?.();
      this.invalidate();
      return;
    }

    r.content.removeEventListener('input', this.onInput);
    r.content.contentEditable = 'false';
    r.content.blur();
    window.getSelection()?.removeAllRanges(); // drop leftover text highlight

    // a node with no actual text is invisible clutter — drop it (per spec)
    if (spec.deleteWhenEmpty && (r.content.textContent ?? '').trim() === '') {
      this.history.push(this.store, new DeleteNodes(this.store, [id]));
      this.invalidate();
      return;
    }

    const after = r.content.innerHTML;
    const afterH = spec.autoHeight ? this.measuredHeight(id, spec) : null;
    const resolvedH = afterH ?? node.h;
    if (after !== this.before || resolvedH !== this.beforeH) {
      const patch: NodePatch = {
        before: spec.set(node, this.before, spec.autoHeight ? this.beforeH : null),
        after: spec.set(node, after, afterH),
      };
      this.store.patchNode(id, patch.after);
      this.history.push(this.store, new PatchNodes('edit', new Map([[id, patch]])), true);
    }
    this.invalidate();
  }

  /** Re-assert focus on the active session (something stole it, e.g. a closing dialog). */
  refocus(): void {
    if (!this.activeId) return;
    const node = this.store.node(this.activeId);
    const r = this.layer.elementFor(this.activeId);
    if (!node || !r) return;
    const spec = this.registry.of(node)?.edit;
    if (spec?.kind === 'activate') {
      if (spec.focus) spec.focus(r.content);
      else this.focusDefaultControl(r.content);
      return;
    }
    r.content.focus({ preventScroll: true });
    this.selectAllText(r.content);
  }

  /** Text fields first, then any focusable control (switch, slider, button…). */
  private focusDefaultControl(content: HTMLElement): void {
    const el =
      content.querySelector<HTMLElement>('input, textarea, select') ??
      content.querySelector<HTMLElement>('button, [role="switch"], [role="slider"], [tabindex]:not([tabindex="-1"])');
    el?.focus({ preventScroll: true });
    if (el instanceof HTMLInputElement && el.type === 'text') el.select();
  }

  /** Fit auto-width/height nodes to content while typing (not undoable mid-session). */
  private grow(): void {
    if (this.activeId) this.fitText(this.activeId);
  }

  /**
   * Correct an auto-height node's stored height to fit its rendered content,
   * outside an edit session — for programmatic inserts/patches whose caller
   * couldn't measure (the node's content layer must already be mounted, which
   * it is right after a store change). Silent (no history); returns whether h
   * changed. Non-auto-height kinds are a no-op.
   */
  fitHeight(id: NodeId): boolean {
    return this.fitText(id);
  }

  /** Fit an auto-width/height node's stored w/h to its rendered content (silent,
      no history). Width shrinks to the text capped at maxWidth; height measured
      at that width. Returns whether anything changed. */
  fitText(id: NodeId): boolean {
    const node = this.store.node(id);
    if (!node) return false;
    const spec = this.htmlSpec(node);
    if (!spec || (!spec.autoWidth && !spec.autoHeight)) return false;
    const maxW = spec.autoWidth ? (spec.maxWidth ?? 640) : node.w;
    const m = this.layer.measureContent(id, maxW);
    if (!m) return false;
    const patch: Partial<BaseNode> = {};
    if (spec.autoWidth) {
      const w = Math.min(maxW, Math.max(spec.minWidth ?? 0, Math.ceil(m.w)));
      if (Math.abs(w - node.w) > 0.5) patch.w = w;
    }
    if (spec.autoHeight) {
      const h = Math.max(spec.minHeight ?? 0, m.h);
      if (Math.abs(h - node.h) > 0.5) patch.h = h;
    }
    if (patch.w === undefined && patch.h === undefined) return false;
    this.store.patchNode(id, patch);
    this.invalidate();
    return true;
  }

  private measuredHeight(id: NodeId, spec: HtmlEditSpec<BaseNode>): number | null {
    const h = this.layer.measureContentHeight(id);
    return h ? Math.max(spec.minHeight ?? 0, h) : null;
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
