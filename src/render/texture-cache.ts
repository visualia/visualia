import type { NodeId } from '../core/types';

const BUDGET_BYTES = 256 * 1024 * 1024;
const MIP_OVERHEAD = 1.34;

interface Entry {
  tex: WebGLTexture;
  bytes: number;
  lastUsedFrame: number;
  /** capture scale the texture was taken at */
  scale: number;
}

/**
 * Per-node element textures captured via texElementImage2D.
 * Captures MUST happen inside the canvas `paint` event (canvas-layer drives that);
 * this class only manages GL objects and the byte budget.
 */
export class TextureCache {
  private entries = new Map<NodeId, Entry>();
  private totalBytes = 0;
  frame = 0;

  constructor(private gl: WebGL2RenderingContext) {}

  get(id: NodeId): WebGLTexture | null {
    const e = this.entries.get(id);
    if (!e) return null;
    e.lastUsedFrame = this.frame;
    return e.tex;
  }

  scaleOf(id: NodeId): number | null {
    return this.entries.get(id)?.scale ?? null;
  }

  has(id: NodeId): boolean {
    return this.entries.has(id);
  }

  /** Capture `el` into the node's texture. Call only inside the paint event.
      `mips=false` for content recaptured every frame (video) — mip generation
      at 60fps costs more than the minification quality it buys. */
  capture(id: NodeId, el: Element, cssW: number, cssH: number, scale: number, dpr: number, mips = true): boolean {
    const gl = this.gl;
    if (!gl.texElementImage2D) return false;
    let e = this.entries.get(id);
    if (!e) {
      e = { tex: gl.createTexture(), bytes: 0, lastUsedFrame: this.frame, scale };
      this.entries.set(id, e);
    }
    this.totalBytes -= e.bytes;
    gl.bindTexture(gl.TEXTURE_2D, e.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    try {
      gl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
    } catch (err) {
      console.warn('board: texElementImage2D failed', err);
      this.evictOne(id);
      return false;
    }
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Capture pixel size isn't directly observable; estimate from layout size.
    e.bytes = Math.ceil(cssW * cssH * dpr * dpr * 4 * MIP_OVERHEAD);
    e.scale = scale;
    e.lastUsedFrame = this.frame;
    this.totalBytes += e.bytes;
    return true;
  }

  /** Evict LRU textures until under budget. Never evicts `protect` ids. */
  enforceBudget(protect: ReadonlySet<NodeId>): void {
    if (this.totalBytes <= BUDGET_BYTES) return;
    const victims = [...this.entries.entries()]
      .filter(([id]) => !protect.has(id))
      .sort((a, b) => a[1].lastUsedFrame - b[1].lastUsedFrame);
    for (const [id] of victims) {
      if (this.totalBytes <= BUDGET_BYTES) break;
      this.evictOne(id);
    }
  }

  evictOne(id: NodeId): void {
    const e = this.entries.get(id);
    if (!e) return;
    this.gl.deleteTexture(e.tex);
    this.totalBytes -= e.bytes;
    this.entries.delete(id);
  }

  clear(): void {
    for (const id of [...this.entries.keys()]) this.evictOne(id);
  }
}
