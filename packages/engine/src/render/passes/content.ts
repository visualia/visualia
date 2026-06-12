import { createProgram } from '../gl-utils';
import { contentVert } from '../shaders';
import { contentFrag } from '../shaders';

const FULL_UV = [0, 0, 1, 1] as const;

/** Draws one textured quad per node (WebGL HTML-in-canvas mode only). */
export class ContentPass {
  private prog!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;
  private uCam!: WebGLUniformLocation | null;
  private uViewport!: WebGLUniformLocation | null;
  private uRect!: WebGLUniformLocation | null;
  private uTex!: WebGLUniformLocation | null;
  private uAlpha!: WebGLUniformLocation | null;
  private uUvRect!: WebGLUniformLocation | null;
  private lastAlpha = 1;

  constructor(
    private gl: WebGL2RenderingContext,
    unitQuad: WebGLBuffer,
  ) {
    this.init(unitQuad);
  }

  init(unitQuad: WebGLBuffer): void {
    const gl = this.gl;
    this.prog = createProgram(gl, contentVert, contentFrag);
    this.uCam = gl.getUniformLocation(this.prog, 'uCam');
    this.uViewport = gl.getUniformLocation(this.prog, 'uViewport');
    this.uRect = gl.getUniformLocation(this.prog, 'uRect');
    this.uTex = gl.getUniformLocation(this.prog, 'uTex');
    this.uAlpha = gl.getUniformLocation(this.prog, 'uAlpha');
    this.uUvRect = gl.getUniformLocation(this.prog, 'uUvRect');
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, unitQuad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  begin(cam: { x: number; y: number; z: number }, viewW: number, viewH: number): void {
    const gl = this.gl;
    gl.useProgram(this.prog);
    gl.uniform3f(this.uCam, cam.x, cam.y, cam.z);
    gl.uniform2f(this.uViewport, viewW, viewH);
    gl.uniform1i(this.uTex, 0);
    gl.uniform1f(this.uAlpha, 1);
    this.lastAlpha = 1;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  drawNode(
    rect: { x: number; y: number; w: number; h: number },
    tex: WebGLTexture,
    alpha = 1,
    uv: readonly [number, number, number, number] = FULL_UV,
  ): void {
    const gl = this.gl;
    if (alpha !== this.lastAlpha) {
      gl.uniform1f(this.uAlpha, alpha);
      this.lastAlpha = alpha;
    }
    gl.uniform4f(this.uUvRect, uv[0], uv[1], uv[2], uv[3]);
    gl.uniform4f(this.uRect, rect.x, rect.y, rect.w, rect.h);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  end(): void {
    this.gl.bindVertexArray(null);
  }
}
