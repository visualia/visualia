import type { Board } from '../board';
import type { EditController } from '../content/edit';

export interface KeyBinding {
  /** matched against e.key (single chars case-insensitively) */
  key: string;
  /** require meta/ctrl */
  mod?: boolean;
  /** require (true) or forbid (false) shift; undefined = either */
  shift?: boolean;
  /** fire even during an edit session / with focus in an input field */
  worksInEdit?: boolean;
  run(e: KeyboardEvent): void;
}

export interface KeyboardOptions {
  /** first match wins — put app bindings before defaultKeymap() */
  bindings: KeyBinding[];
  /** long-press hook on the space (pan) key */
  spaceHold?: { ms: number; begin(): void; end(): void };
}

/**
 * Structural keyboard handling: Escape always ends an edit session, typing
 * into fields never triggers shortcuts (unless a binding opts in via
 * worksInEdit), space drives the shared pan flag (+ optional long-press
 * hook). Everything else is data — see defaultKeymap().
 */
export class KeyboardController {
  private holdTimer: number | undefined;

  constructor(
    private edit: EditController,
    /** shared with the pointer controller (Board.flags) */
    readonly flags: { space: boolean },
    private onFlagsChange: () => void,
    private opts: KeyboardOptions,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => {
      this.flags.space = false;
      this.endHold();
      this.onFlagsChange();
    });
  }

  private endHold(): void {
    clearTimeout(this.holdTimer);
    this.holdTimer = undefined;
    this.opts.spaceHold?.end();
  }

  private matches(b: KeyBinding, e: KeyboardEvent, mod: boolean): boolean {
    if ((b.mod ?? false) !== mod) return false;
    if (b.shift !== undefined && b.shift !== e.shiftKey) return false;
    return b.key.length === 1 ? e.key.toLowerCase() === b.key.toLowerCase() : e.key === b.key;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const mod = e.metaKey || e.ctrlKey;

    // Escape always leaves edit mode, even with focus inside the editor.
    if (e.key === 'Escape' && this.edit.activeId) {
      e.preventDefault();
      this.edit.end();
      return;
    }

    const editing = !!this.edit.activeId;
    const t = e.target as HTMLElement | null;
    const inField = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

    for (const b of this.opts.bindings) {
      if (!this.matches(b, e, mod)) continue;
      if ((editing || inField) && !b.worksInEdit) continue;
      e.preventDefault();
      b.run(e);
      return;
    }

    if (editing || inField) return;

    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      this.flags.space = true;
      const hold = this.opts.spaceHold;
      if (hold) this.holdTimer = window.setTimeout(() => hold.begin(), hold.ms);
      this.onFlagsChange();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space') {
      this.flags.space = false;
      this.endHold();
      this.onFlagsChange();
    }
  };
}

/** The standard board shortcuts, as data — spread app bindings before these. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function defaultKeymap(board: Board<any>): KeyBinding[] {
  return [
    { key: '0', mod: true, run: () => board.zoomTo100() },
    { key: '1', mod: true, run: () => board.zoomToFit() },
    { key: 'z', mod: true, run: (e) => (e.shiftKey ? board.redo() : board.undo()) },
    { key: 'a', mod: true, run: () => board.selectAll() },
    { key: 'd', mod: true, run: () => board.duplicateSelection() },
    { key: '=', mod: true, run: () => board.zoomStep(1) },
    { key: '+', mod: true, run: () => board.zoomStep(1) },
    { key: '-', mod: true, run: () => board.zoomStep(-1) },
    { key: 'Delete', run: () => board.deleteSelection() },
    { key: 'Backspace', run: () => board.deleteSelection() },
    { key: 'Escape', run: () => board.clearSelection() },
    { key: 'Enter', run: () => board.editSelection() },
    { key: '+', run: () => board.zoomStep(1) },
    { key: '=', run: () => board.zoomStep(1) },
    { key: '-', run: () => board.zoomStep(-1) },
    { key: '!', shift: true, run: () => board.zoomToFit() },
    { key: 'ArrowLeft', run: (e) => board.nudgeSelection(e.shiftKey ? -10 : -1, 0) },
    { key: 'ArrowRight', run: (e) => board.nudgeSelection(e.shiftKey ? 10 : 1, 0) },
    { key: 'ArrowUp', run: (e) => board.nudgeSelection(0, e.shiftKey ? -10 : -1) },
    { key: 'ArrowDown', run: (e) => board.nudgeSelection(0, e.shiftKey ? 10 : 1) },
  ];
}
