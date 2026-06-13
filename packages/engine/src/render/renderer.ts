import type { Camera } from '../camera/camera';
import type { ChromeStyle, ContentSpec } from '../core/kinds';
import type { BaseNode, NodeId, Rect } from '../core/types';
import type { GuideSeg } from '../interact/snap';
import { createUnitQuad, parseColor } from './gl-utils';
import { ContentPass } from './passes/content';
import { LiquidPass, type LiquidPoint } from './passes/liquid';
import { RectBatch, RectsPass } from './passes/rects';

export const ACCENT = '#0d99ff'; // Figma selection blue
const ACCENT_EDIT = '#0a7ad1'; // slightly deeper while a component is in edit mode
const GUIDE_COLOR = '#f24822'; // Figma snap-guide red
const GROUP_COLOR = '#8b5cf6'; // inferred-group preview violet (third overlay hue)
const BG_COLOR = '#f5f5f3';
const HANDLE_PX = 8;
const FULL_UV = [0, 0, 1, 1] as const;

export interface RenderInput {
  visible: BaseNode[];
  selection: ReadonlySet<NodeId>;
  marquee: Rect | null; // world
  /** snap guide segments while dragging */
  guides: { v: GuideSeg[]; h: GuideSeg[] } | null;
  /** inferred-group preview rects (shift-hover); a third colour */
  groupHints: Rect[] | null;
  /** texture provider in HTML-in-canvas mode; null in DOM fallback mode */
  getTexture: ((id: NodeId) => WebGLTexture | null) | null;
  /** media-texture source aspect (null for element captures) — drives cover crop */
  getTexAspect: ((id: NodeId) => number | null) | null;
  editingId: NodeId | null;
  /** live ripples for the liquid-cursor easter egg; null = direct rendering */
  liquid: readonly LiquidPoint[] | null;
}

export class Renderer {
  dpr = 1;
  private rects: RectsPass;
  private content: ContentPass;
  private liquid: LiquidPass;
  private unitQuad: WebGLBuffer;
  private chromeBatch = new RectBatch();
  private overlayBatch = new RectBatch();
  private deviceW = 1;
  private deviceH = 1;

  constructor(
    private gl: WebGL2RenderingContext,
    private camera: Camera,
    /** DOM fallback: canvas is a transparent overlay ABOVE the content layer,
        drawing only selection/marquee/guides; node chrome is real DOM. */
    private domMode: boolean,
    /** per-kind background rect lookup (injected — renderer knows no node types) */
    private chromeOf: (node: BaseNode) => ChromeStyle | null,
    /** board background in GL mode (DOM mode: style the page body instead) */
    private background: string = BG_COLOR,
    /** per-kind content spec lookup, for content LOD (minPx) */
    private contentOf: (node: BaseNode) => ContentSpec | undefined = () => undefined,
    /** overlay-mode nodes render as DOM above the canvas; their selection ring
        is CSS (.overlay-selected) — drawing it here too would double it */
    private isOverlay: (node: BaseNode) => boolean = () => false,
  ) {
    this.unitQuad = createUnitQuad(gl);
    this.rects = new RectsPass(gl, this.unitQuad);
    this.content = new ContentPass(gl, this.unitQuad);
    this.liquid = new LiquidPass(gl);
  }

  /** Recompile everything after webglcontextrestored. */
  reinit(): void {
    this.unitQuad = createUnitQuad(this.gl);
    this.rects.init(this.unitQuad);
    this.content.init(this.unitQuad);
    this.liquid.init();
  }

  resize(deviceW: number, deviceH: number): void {
    const gl = this.gl;
    if (gl.canvas.width !== deviceW || gl.canvas.height !== deviceH) {
      gl.canvas.width = deviceW;
      gl.canvas.height = deviceH;
    }
    this.deviceW = deviceW;
    this.deviceH = deviceH;
    gl.viewport(0, 0, deviceW, deviceH);
  }

  /** object-fit:cover crop for media textures whose aspect differs from the node's */
  private coverUv(n: BaseNode, input: RenderInput): readonly [number, number, number, number] {
    if (!input.getTexAspect || !this.contentOf(n)?.source) return FULL_UV;
    const ta = input.getTexAspect(n.id);
    if (!ta || n.h <= 0) return FULL_UV;
    const na = n.w / n.h;
    if (ta > na) {
      const s = na / ta;
      return [(1 - s) / 2, 0, s, 1]; // source wider: crop left/right
    }
    if (ta < na) {
      const s = ta / na;
      return [0, (1 - s) / 2, 1, s]; // source taller: crop top/bottom
    }
    return FULL_UV;
  }

  /** 0..1 content fade from the kind's minPx (1 when unset). */
  private contentAlpha(n: BaseNode): number {
    const minPx = this.contentOf(n)?.minPx;
    if (!minPx) return 1;
    const w = n.w * this.camera.z;
    if (w <= minPx) return 0;
    const fadeEnd = minPx * 1.4;
    return w >= fadeEnd ? 1 : (w - minPx) / (fadeEnd - minPx);
  }

  render(input: RenderInput): void {
    const cam = this.camera;
    const { viewW, viewH } = cam;
    const liquidActive = !!input.liquid?.length;
    if (liquidActive) this.liquid.begin(this.deviceW, this.deviceH);

    if (this.domMode) {
      this.gl.clearColor(0, 0, 0, 0);
    } else {
      const bg = parseColor(this.background);
      this.gl.clearColor(bg.r, bg.g, bg.b, 1);
    }
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // -- node chrome + content, interleaved in z-order (painter's algorithm).
    // Consecutive chrome instances batch into one instanced draw; a content
    // texture flushes the pending run first so overlapping nodes stack right.
    const chrome = this.chromeBatch;
    chrome.clear();
    const chromeIdx = new Map<NodeId, number>();
    for (const n of input.visible) {
      if (this.domMode) continue; // dom mode: chrome is DOM (fallback layer)
      const c = this.chromeOf(n);
      if (!c) continue;
      chromeIdx.set(n.id, chrome.count);
      chrome.push({
        x: n.x, y: n.y, w: n.w, h: n.h,
        radius: c.radius ?? 0,
        fill: c.fill,
      });
    }

    if (chrome.count) {
      this.rects.bind(cam, viewW, viewH);
      this.rects.upload(chrome);
    }
    if (!input.getTexture) {
      if (chrome.count) {
        this.rects.drawRange(0, chrome.count);
        this.rects.unbind();
      }
    } else {
      let bound: 'rects' | 'content' | null = chrome.count ? 'rects' : null;
      let runStart = -1;
      let runEnd = -1;
      const flush = (): void => {
        if (runStart < 0) return;
        if (bound !== 'rects') {
          this.content.end();
          this.rects.bind(cam, viewW, viewH);
          bound = 'rects';
        }
        this.rects.drawRange(runStart, runEnd - runStart + 1);
        runStart = -1;
      };
      for (const n of input.visible) {
        const ci = chromeIdx.get(n.id);
        if (ci !== undefined) {
          if (runStart < 0) runStart = ci;
          runEnd = ci;
        }
        // content LOD: below minPx on-screen the texture is minified mush —
        // fade it out and let the chrome rect carry the far view
        const alpha = this.contentAlpha(n);
        const tex = alpha > 0 ? input.getTexture(n.id) : null;
        if (tex) {
          flush();
          if (bound !== 'content') {
            if (bound === 'rects') this.rects.unbind();
            this.content.begin(cam, viewW, viewH);
            bound = 'content';
          }
          this.content.drawNode(n, tex, alpha, this.coverUv(n, input));
        }
      }
      flush();
      if (bound === 'content') this.content.end();
      else if (bound === 'rects') this.rects.unbind();
    }

    // -- overlay: selection outlines, handles, marquee
    const overlay = this.overlayBatch;
    overlay.clear();
    const z = cam.z;
    let single: BaseNode | null = null;
    for (const n of input.visible) {
      if (!input.selection.has(n.id)) continue;
      // GL mode: overlay nodes carry their selection ring as CSS above the
      // canvas — skip the GL ring and handles to avoid a double border
      if (!this.domMode && this.isOverlay(n)) continue;
      if (input.selection.size === 1) single = n;
      overlay.push({
        x: n.x, y: n.y, w: n.w, h: n.h,
        stroke: input.editingId === n.id ? ACCENT_EDIT : ACCENT,
        strokeWidthPx: 1,
      });
    }
    if (single && input.editingId !== single.id) {
      const hw = HANDLE_PX / z;
      for (const cx of [single.x, single.x + single.w / 2, single.x + single.w]) {
        for (const cy of [single.y, single.y + single.h / 2, single.y + single.h]) {
          if (cx === single.x + single.w / 2 && cy === single.y + single.h / 2) continue;
          overlay.push({
            x: cx - hw / 2, y: cy - hw / 2, w: hw, h: hw,
            fill: '#ffffff',
            stroke: ACCENT,
            strokeWidthPx: 1,
          });
        }
      }
    }
    if (input.groupHints) {
      for (const r of input.groupHints) {
        overlay.push({ ...r, stroke: GROUP_COLOR, strokeWidthPx: 1.5 });
      }
    }
    if (input.marquee) {
      overlay.push({
        ...input.marquee,
        fill: ACCENT,
        fillAlpha: 0.08,
        stroke: ACCENT,
        strokeWidthPx: 1,
      });
    }
    if (input.guides) {
      const lw = 0.5 / z; // hairline redlines
      for (const g of input.guides.v) {
        overlay.push({ x: g.pos - lw / 2, y: g.start, w: lw, h: g.end - g.start, fill: GUIDE_COLOR });
      }
      for (const g of input.guides.h) {
        overlay.push({ x: g.start, y: g.pos - lw / 2, w: g.end - g.start, h: lw, fill: GUIDE_COLOR });
      }
    }
    this.rects.draw(overlay, cam, viewW, viewH);

    if (liquidActive) this.liquid.end(input.liquid!, viewW, viewH, this.dpr);
  }
}
