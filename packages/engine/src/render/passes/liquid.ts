import { createProgram } from '../gl-utils';
import fullscreenVert from '../shaders/fullscreen.vert.glsl?raw';
import liquidFrag from '../shaders/liquid.frag.glsl?raw';

export interface LiquidPoint {
  x: number; // CSS px
  y: number;
  age: number; // seconds
  strength: number;
}

export const MAX_LIQUID_POINTS = 32;

/**
 * Easter egg: while active, the scene renders into an offscreen texture and is
 * composited through a ripple-displacement shader. Zero cost when inactive —
 * the framebuffer indirection only exists while ripples are alive.
 */
export class LiquidPass {
  private prog!: WebGLProgram;
  private fbo!: WebGLFramebuffer;
  private tex!: WebGLTexture;
  private texW = 0;
  private texH = 0;
  private uScene!: WebGLUniformLocation | null;
  private uViewport!: WebGLUniformLocation | null;
  private uDpr!: WebGLUniformLocation | null;
  private uCount!: WebGLUniformLocation | null;
  private uPts!: WebGLUniformLocation | null;
  private ptsData = new Float32Array(MAX_LIQUID_POINTS * 4);

  constructor(private gl: WebGL2RenderingContext) {
    this.init();
  }

  init(): void {
    const gl = this.gl;
    this.prog = createProgram(gl, fullscreenVert, liquidFrag);
    this.uScene = gl.getUniformLocation(this.prog, 'uScene');
    this.uViewport = gl.getUniformLocation(this.prog, 'uViewport');
    this.uDpr = gl.getUniformLocation(this.prog, 'uDpr');
    this.uCount = gl.getUniformLocation(this.prog, 'uCount');
    this.uPts = gl.getUniformLocation(this.prog, 'uPts');
    this.fbo = gl.createFramebuffer();
    this.tex = gl.createTexture();
    this.texW = this.texH = 0;
  }

  /** Redirect scene rendering into the offscreen texture. */
  begin(deviceW: number, deviceH: number): void {
    const gl = this.gl;
    if (this.texW !== deviceW || this.texH !== deviceH) {
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, deviceW, deviceH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.texW = deviceW;
      this.texH = deviceH;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
  }

  /** Composite the captured scene to the canvas through the ripple field. */
  end(points: readonly LiquidPoint[], viewW: number, viewH: number, dpr: number): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.uScene, 0);
    gl.uniform2f(this.uViewport, viewW, viewH);
    gl.uniform1f(this.uDpr, dpr);
    const n = Math.min(points.length, MAX_LIQUID_POINTS);
    for (let i = 0; i < n; i++) {
      const p = points[points.length - n + i]!; // newest points win the slots
      this.ptsData[i * 4] = p.x;
      this.ptsData[i * 4 + 1] = p.y;
      this.ptsData[i * 4 + 2] = p.age;
      this.ptsData[i * 4 + 3] = p.strength;
    }
    gl.uniform1i(this.uCount, n);
    gl.uniform4fv(this.uPts, this.ptsData);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
