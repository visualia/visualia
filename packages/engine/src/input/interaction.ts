/** What the user may do with the pointer/keyboard on this board. */
export interface InteractionCaps {
  /** click/shift-click selection, marquee, selection overlay */
  select: boolean;
  /** dragging nodes (with snap guides), nudging, duplicating */
  move: boolean;
  /** resize handles on a single selection */
  resize: boolean;
  /** dblclick edit sessions (the kind's edit spec decides what "edit" means) */
  edit: boolean;
}

/**
 * Board-level interaction config: a named preset or a partial caps override
 * (unspecified caps default to the editor behavior).
 */
export type InteractionOption = 'editor' | 'viewer' | Partial<InteractionCaps>;

export function resolveInteraction(opt: InteractionOption = 'editor'): InteractionCaps {
  if (opt === 'editor') return { select: true, move: true, resize: true, edit: true };
  // viewer: pan-first read-only board; dblclick still routes to kind edit
  // specs so 'activate' kinds (links, embeds) stay usable
  if (opt === 'viewer') return { select: false, move: false, resize: false, edit: true };
  return { select: true, move: true, resize: true, edit: true, ...opt };
}
