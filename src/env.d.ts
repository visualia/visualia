/// <reference types="vite/client" />

// HTML-in-canvas API (Chrome origin trial, chrome://flags/#canvas-draw-element).
// Not yet in lib.dom — exact surface verified at runtime in content/canvas-layer.ts.

interface WebGL2RenderingContext {
  texElementImage2D?(
    target: GLenum,
    level: GLint,
    internalformat: GLint,
    format: GLenum,
    type: GLenum,
    element: Element,
  ): void;
}

interface CanvasPaintEvent extends Event {
  readonly changedElements?: ReadonlyArray<Element>;
}

interface HTMLCanvasElement {
  getElementTransform?(element: Element, screenSpaceTransform: DOMMatrixReadOnly): unknown;
  requestPaint?(): void;
}

interface HTMLElementEventMap {
  paint: CanvasPaintEvent;
}
