export function createProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`program link failed: ${log ?? ''}`);
  }
  return prog;
}

function compile(gl: WebGL2RenderingContext, type: GLenum, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('createShader failed');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader compile failed: ${log ?? ''}\n${src}`);
  }
  return sh;
}

/** Shared unit quad (TRIANGLE_STRIP) used by all rect-shaped passes. */
export function createUnitQuad(gl: WebGL2RenderingContext): WebGLBuffer {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  return buf;
}

/** Growable dynamic VBO for per-instance data. */
export class DynamicBuffer {
  readonly buf: WebGLBuffer;
  private capacity = 0;

  constructor(private gl: WebGL2RenderingContext) {
    this.buf = gl.createBuffer();
  }

  upload(data: Float32Array): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    if (data.byteLength > this.capacity) {
      this.capacity = Math.max(data.byteLength * 2, 4096);
      gl.bufferData(gl.ARRAY_BUFFER, this.capacity, gl.DYNAMIC_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
  }
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const cssColorCache = new Map<string, RGBA>();

/** Parse a CSS color to RGBA 0..1 (canvas-based, cached). */
export function parseColor(css: string): RGBA {
  const hit = cssColorCache.get(css);
  if (hit) return hit;
  const cnv = parseColorCanvas ?? (parseColorCanvas = document.createElement('canvas'));
  cnv.width = cnv.height = 1;
  const ctx = cnv.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  const rgba = { r: (d[0] ?? 0) / 255, g: (d[1] ?? 0) / 255, b: (d[2] ?? 0) / 255, a: (d[3] ?? 0) / 255 };
  cssColorCache.set(css, rgba);
  return rgba;
}
let parseColorCanvas: HTMLCanvasElement | null = null;
