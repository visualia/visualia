import { createProgram, DynamicBuffer, parseColor } from '../gl-utils';
import { rectsVert } from '../shaders';
import { rectsFrag } from '../shaders';

export const FLOATS_PER_INSTANCE = 16; // rect4 + radius1 + fill4 + stroke4 + params3

/** CPU-side builder for one instanced draw of SDF rects. */
export class RectBatch {
  private data: number[] = [];
  count = 0;

  clear(): void {
    this.data.length = 0;
    this.count = 0;
  }

  push(opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    radius?: number;
    fill?: string;
    fillAlpha?: number;
    stroke?: string;
    strokeAlpha?: number;
    strokeWidthPx?: number;
    shadowAlpha?: number;
  }): void {
    const fill = parseColor(opts.fill ?? 'transparent');
    const stroke = parseColor(opts.stroke ?? 'transparent');
    this.data.push(
      opts.x, opts.y, opts.w, opts.h,
      opts.radius ?? 0,
      fill.r, fill.g, fill.b, fill.a * (opts.fillAlpha ?? 1),
      stroke.r, stroke.g, stroke.b, stroke.a * (opts.strokeAlpha ?? 1),
      opts.strokeWidthPx ?? 0, opts.shadowAlpha ?? 0, 0,
    );
    this.count++;
  }

  toArray(): Float32Array {
    return new Float32Array(this.data);
  }
}

/** Instanced SDF rounded-rect pass; used for node chrome and UI overlay. */
export class RectsPass {
  private prog!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;
  private instances!: DynamicBuffer;
  private uCam!: WebGLUniformLocation | null;
  private uViewport!: WebGLUniformLocation | null;

  constructor(
    private gl: WebGL2RenderingContext,
    private unitQuad: WebGLBuffer,
  ) {
    this.init(unitQuad);
  }

  init(unitQuad: WebGLBuffer): void {
    const gl = this.gl;
    this.unitQuad = unitQuad;
    this.prog = createProgram(gl, rectsVert, rectsFrag);
    this.uCam = gl.getUniformLocation(this.prog, 'uCam');
    this.uViewport = gl.getUniformLocation(this.prog, 'uViewport');
    this.instances = new DynamicBuffer(gl);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.unitQuad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances.buf);
    const stride = FLOATS_PER_INSTANCE * 4;
    const attribs: [number, number, number][] = [
      [1, 4, 0], // aRect
      [2, 1, 16], // aRadius
      [3, 4, 20], // aFill
      [4, 4, 36], // aStroke
      [5, 3, 52], // aParams
    ];
    for (const [loc, size, offset] of attribs) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
  }

  bind(cam: { x: number; y: number; z: number }, viewW: number, viewH: number): void {
    const gl = this.gl;
    gl.useProgram(this.prog);
    gl.uniform3f(this.uCam, cam.x, cam.y, cam.z);
    gl.uniform2f(this.uViewport, viewW, viewH);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  upload(batch: RectBatch): void {
    this.instances.upload(batch.toArray());
  }

  /** Draw a contiguous run of uploaded instances (painter's-order interleaving). */
  drawRange(first: number, count: number): void {
    if (count <= 0) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances.buf);
    const stride = FLOATS_PER_INSTANCE * 4;
    const base = first * stride;
    const attribs: [number, number, number][] = [
      [1, 4, 0],
      [2, 1, 16],
      [3, 4, 20],
      [4, 4, 36],
      [5, 3, 52],
    ];
    for (const [loc, size, offset] of attribs) {
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, base + offset);
    }
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
  }

  unbind(): void {
    this.gl.bindVertexArray(null);
  }

  draw(batch: RectBatch, cam: { x: number; y: number; z: number }, viewW: number, viewH: number): void {
    if (batch.count === 0) return;
    this.bind(cam, viewW, viewH);
    this.upload(batch);
    this.drawRange(0, batch.count);
    this.unbind();
  }
}
