# @visualia/engine

Framework-free infinite-canvas engine. WebGL2 renderer (instanced SDF chrome,
content textures, optional liquid effect), Chrome HTML-in-canvas content
pipeline with a DOM fallback, Figma-grade pointer/zoom input, object+grid
snapping with guides, selection, undo history, localStorage persistence.

Zero npm dependencies. Shipped as TypeScript source (`exports` → `src/`);
any esbuild/Vite-based consumer compiles it directly, tarball installs included.

## Usage (no React required)

```html
<div id="board-root">
  <canvas id="gl" layoutsubtree></canvas>
  <div id="dom-layer" hidden><div id="dom-layer-inner"></div></div>
</div>
```

```js
import '@visualia/engine/styles.css';
import { createBoard, frameKind, textKind, newNodeId } from '@visualia/engine';

const board = createBoard({
  root: document.getElementById('board-root'),
  canvas: document.getElementById('gl'),
  domLayer: document.getElementById('dom-layer'),
  domLayerInner: document.getElementById('dom-layer-inner'),
  kinds: [textKind(), frameKind()],
});

board.loadFromStorage(); // or board.insert({ id: newNodeId(), type: 'text', ... })
```

GL mode needs Chrome 148+ with `chrome://flags/#canvas-draw-element`
(origin trial); everywhere else the same API runs on the DOM fallback.

## Interaction models

Three configurable layers, coarse to fine:

1. **Board caps** — `interaction: 'editor' | 'viewer' | {select?, move?, resize?, edit?}`.
   `'viewer'` is a pan-first read-only board (dblclick still routes to kind
   edit specs, so `activate` links keep working). `defaultKeymap(board)`
   filters its bindings by the same caps.
2. **Per-kind caps** — `NodeKind.capabilities(node)` returns
   `{selectable?, movable?, resizable?}`; a non-selectable node is
   click-through (presses fall to the node behind), non-movable nodes drop
   out of multi-drags. Intersected with board caps.
3. **Tools** — gestures live in pluggable `Tool` objects, not the engine.
   `PointerController` only normalizes events (capture, pinch, wheel,
   edit-session click-out) and routes single-pointer gestures to the active
   tool. Built-ins: `SelectTool` (the editor state machine) and `HandTool`
   (pan; also the middle-button/space fallback). Register custom tools via
   `BoardOptions.tools` and switch at runtime with `board.setTool(id)` —
   that's the hook for Figma-style toolbars, connector tools, lassos.

```js
// read-only data viewer
createBoard({ ..., interaction: 'viewer' });

// custom tool
class LassoTool { id = 'lasso'; get active() {...} cursor() {...} onDown/onMove/onUp/onCancel(...) {...} }
createBoard({ ..., tools: [new LassoTool()] });
board.setTool('lasso');
```

## Extending

Node behavior is pluggable via `NodeKind`: GL chrome, DOM content
(texture-captured or overlay), edit semantics (`html` contenteditable with
auto-grow/empty-delete, or `activate` for interactive content), per-kind
interaction `capabilities`, and per-kind (de)serialization. `htmlBehavior()`
builds HTML-content kinds; `@visualia/react` adapts React components;
`@visualia/shadcn` is a ready widget kit. Keyboard is data-driven:
`defaultKeymap(board)` plus your own `KeyBinding`s (set `worksInEdit` for
bindings that fire mid-edit).
