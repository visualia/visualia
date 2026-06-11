import type { EditController } from '../content/edit';

export interface KeyboardActions {
  deleteSelection(): void;
  duplicateSelection(): void;
  selectAll(): void;
  clearSelection(): void;
  editSelection(): void;
  nudgeSelection(dx: number, dy: number): void;
  undo(): void;
  redo(): void;
  zoomTo100(): void;
  zoomToFit(): void;
  zoomStep(dir: 1 | -1): void;
  setLiquidMode(on: boolean): void;
  openCommandMenu(): void;
}

const LIQUID_HOLD_MS = 1200;

export class KeyboardController {
  flags = { space: false };
  private liquidTimer: number | undefined;

  constructor(
    private actions: KeyboardActions,
    private edit: EditController,
    private onFlagsChange: () => void,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => {
      this.flags.space = false;
      this.endLiquidHold();
      this.onFlagsChange();
    });
  }

  private endLiquidHold(): void {
    clearTimeout(this.liquidTimer);
    this.liquidTimer = undefined;
    this.actions.setLiquidMode(false);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const mod = e.metaKey || e.ctrlKey;

    // Escape always leaves edit mode, even with focus inside the editor.
    if (e.key === 'Escape' && this.edit.activeId) {
      e.preventDefault();
      this.edit.end();
      return;
    }

    // The palette hotkey works everywhere — including inside an edit session
    // (it commits the edit and opens the menu).
    if (mod && (e.key === '/' || e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      this.actions.openCommandMenu();
      return;
    }

    // Typing into app UI (command menu, widget inputs) never triggers shortcuts.
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

    if (this.edit.activeId) {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.edit.end();
      }
      return; // everything else belongs to the contenteditable
    }

    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      this.flags.space = true;
      // looooong space press summons the liquid cursor 🌊
      this.liquidTimer = window.setTimeout(() => this.actions.setLiquidMode(true), LIQUID_HOLD_MS);
      this.onFlagsChange();
      return;
    }

    const a = this.actions;
    if (mod) {
      switch (e.key.toLowerCase()) {
        case '0':
          e.preventDefault();
          a.zoomTo100();
          return;
        case '1':
          e.preventDefault();
          a.zoomToFit();
          return;
        case 'z':
          e.preventDefault();
          if (e.shiftKey) a.redo();
          else a.undo();
          return;
        case 'a':
          e.preventDefault();
          a.selectAll();
          return;
        case 'd':
          e.preventDefault();
          a.duplicateSelection();
          return;
        case '=':
        case '+':
          e.preventDefault();
          a.zoomStep(1);
          return;
        case '-':
          e.preventDefault();
          a.zoomStep(-1);
          return;
      }
      return;
    }

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        a.deleteSelection();
        return;
      case 'Escape':
        a.clearSelection();
        return;
      case 'Enter':
        e.preventDefault();
        a.editSelection();
        return;
      case '+':
      case '=':
        a.zoomStep(1);
        return;
      case '-':
        a.zoomStep(-1);
        return;
      case '!': // shift+1: zoom to fit
        if (e.shiftKey) a.zoomToFit();
        return;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        a.nudgeSelection(dx, dy);
        return;
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space') {
      this.flags.space = false;
      this.endLiquidHold();
      this.onFlagsChange();
    }
  };
}
