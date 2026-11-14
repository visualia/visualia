// Background removal in Node: a photo (JPEG or PNG) in, a PNG with alpha and a mask PNG out.
// Model: BiRefNet-lite (MIT), the ONNX export onnx-community/BiRefNet_lite-ONNX, onnx/model.onnx, 1024x1024 input.
// Steps as rembg's birefnet session: resize to 1024, normalise (ImageNet mean and std), sigmoid, min-max,
// resize back to the photo's size, then rembg's post_process_mask (3x3 opening, gaussian sigma 2, cut at 127).
// usage: node rmbg.mjs <photo.jpg|png> [--ep cpu|webgpu] [--out cut.png] [--mask mask.png] [--soft] [--model path]
// Also a module: triposr.mjs imports readImage, writePNG, isOpaque and createRemover from here.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ort = require('onnxruntime-node');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');

export const MASK_MODEL = {
  name: 'BiRefNet-lite', licence: 'MIT', file: 'rmbg/birefnet_lite.onnx', bytes: 224005088,
  sha256: '5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333',
  url: 'https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/de15b22ba131738a16dff04aab8bdf8dc32e3ac1/onnx/model.onnx',
};
const SIZE = 1024, MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];

// RGBA 8 bit, whatever came in
export function readImage(file) {
  const buf = fs.readFileSync(file);
  if (buf[0] === 0x89 && buf[1] === 0x50) { const p = PNG.sync.read(buf); return { W: p.width, H: p.height, data: new Uint8Array(p.data.buffer, p.data.byteOffset, p.data.length) }; }
  if (buf[0] === 0xff && buf[1] === 0xd8) { const j = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 2048 }); return { W: j.width, H: j.height, data: j.data }; }
  throw new Error(`${file}: neither PNG nor JPEG`);
}
export function writePNG(file, W, H, rgba) {
  const p = new PNG({ width: W, height: H }); p.data = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, PNG.sync.write(p));
}
export const isOpaque = img => { for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 255) return false; return true; };

// one plane, separable triangle filter widened by the scale (antialiased bilinear, align_corners=False)
function resize1d(src, sw, sh, dw, horizontal) {
  const n = horizontal ? sw : sh, m = dw, scale = n / m, support = Math.max(scale, 1);
  const ow = horizontal ? m : sw, oh = horizontal ? sh : m, out = new Float32Array(ow * oh);
  for (let o = 0; o < m; o++) {
    const c = (o + 0.5) * scale, lo = Math.max(0, Math.floor(c - support)), hi = Math.min(n - 1, Math.ceil(c + support));
    const w = new Float32Array(hi - lo + 1); let ws = 0;
    for (let i = lo; i <= hi; i++) { const t = 1 - Math.abs((i + 0.5 - c) / support); w[i - lo] = t > 0 ? t : 0; ws += w[i - lo]; }
    if (horizontal) for (let y = 0; y < sh; y++) { let a = 0; for (let i = lo; i <= hi; i++) a += w[i - lo] * src[y * sw + i]; out[y * ow + o] = a / ws; }
    else for (let x = 0; x < sw; x++) { let a = 0; for (let i = lo; i <= hi; i++) a += w[i - lo] * src[i * sw + x]; out[o * ow + x] = a / ws; }
  }
  return out;
}
export const resizePlane = (src, sw, sh, dw, dh) => resize1d(resize1d(src, sw, sh, dw, true), dw, sh, dh, false);

// rembg post_process_mask: opening (3x3 ellipse, which is a cross), gaussian blur sigma 2, then > 127
function postProcess(m, W, H) {
  const pass = (src, pick) => { const o = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = src[y * W + x];
      if (x > 0) v = pick(v, src[y * W + x - 1]); if (x < W - 1) v = pick(v, src[y * W + x + 1]);
      if (y > 0) v = pick(v, src[(y - 1) * W + x]); if (y < H - 1) v = pick(v, src[(y + 1) * W + x]); o[y * W + x] = v; }
    return o; };
  const opened = pass(pass(m, Math.min), Math.max);
  const k = [], s = 2; let ks = 0; for (let i = -6; i <= 6; i++) { const v = Math.exp(-(i * i) / (2 * s * s)); k.push(v); ks += v; }
  const blur = (src, dx, dy) => { const o = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let a = 0;
      for (let i = -6; i <= 6; i++) { const xx = Math.min(W - 1, Math.max(0, x + i * dx)), yy = Math.min(H - 1, Math.max(0, y + i * dy)); a += k[i + 6] * src[yy * W + xx]; }
      o[y * W + x] = a / ks; }
    return o; };
  const b = blur(blur(opened, 1, 0), 0, 1), out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = b[i] > 127 ? 255 : 0;
  return out;
}

export async function createRemover({ model = MASK_MODEL.file, ep = 'cpu', arena = process.env.RMBG_ARENA !== '0' } = {}) {
  // one 1024x1024 run peaks at 7.8 to 9.0 GB RSS on the M1 whether the arena, memory patterns or graph optimisation
  // are on or off (RMBG_ARENA=0, RMBG_OPT=basic|disabled to try); WebGPU needs patch-split.mjs's model first
  const session = await ort.InferenceSession.create(model, { executionProviders: ep === 'webgpu' ? ['webgpu', 'cpu'] : ['cpu'],
    graphOptimizationLevel: process.env.RMBG_OPT || 'all', enableCpuMemArena: arena, enableMemPattern: arena });
  async function remove(img, { soft = false } = {}) {
    const T = {}; let t0 = performance.now(); const lap = k => { const t = performance.now(); T[k] = +((t - t0) / 1000).toFixed(3); t0 = t; };
    const { W, H, data } = img, planes = [0, 1, 2].map(() => new Float32Array(W * H));
    for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) planes[c][i] = data[i * 4 + c] / 255;
    const input = new Float32Array(3 * SIZE * SIZE);
    planes.forEach((p, c) => { const r = resizePlane(p, W, H, SIZE, SIZE); for (let i = 0; i < r.length; i++) input[c * SIZE * SIZE + i] = (r[i] - MEAN[c]) / STD[c]; });
    lap('maskPre');
    const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
    const logits = out[session.outputNames[session.outputNames.length - 1]].data; // the finest of the outputs
    lap('maskModel');
    const pred = new Float32Array(SIZE * SIZE); let mi = Infinity, ma = -Infinity;
    for (let i = 0; i < pred.length; i++) { const v = 1 / (1 + Math.exp(-logits[i])); pred[i] = v; if (v < mi) mi = v; if (v > ma) ma = v; }
    for (let i = 0; i < pred.length; i++) pred[i] = (pred[i] - mi) / (ma - mi || 1);
    const big = resizePlane(pred, SIZE, SIZE, W, H);
    let mask = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) mask[i] = Math.max(0, Math.min(255, Math.round(big[i] * 255)));
    if (!soft) mask = postProcess(mask, W, H);
    const rgba = new Uint8Array(data); let fg = 0;
    for (let i = 0; i < W * H; i++) { rgba[i * 4 + 3] = mask[i]; if (mask[i] > 127) fg++; }
    lap('maskPost');
    return { W, H, data: rgba, mask, seconds: T, foregroundShare: +(fg / (W * H)).toFixed(3) };
  }
  return { remove, release: () => session.release?.(), inputNames: session.inputNames, outputNames: session.outputNames };
}

// ---- CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
  const IN = args[0], EP = opt('ep', 'cpu'), base = path.basename(IN).replace(/\.\w+$/, '');
  const OUT = opt('out', `out/${base}-cut.png`), MASK = opt('mask', `out/${base}-mask.png`);
  let peak = 0; const sample = () => { const r = process.memoryUsage().rss; if (r > peak) peak = r; }; const timer = setInterval(sample, 50);
  const t0 = performance.now(); let t = t0; const T = {}; const lap = k => { const n = performance.now(); T[k] = +((n - t) / 1000).toFixed(3); t = n; sample(); };
  const img = readImage(IN); lap('decode');
  const rm = await createRemover({ model: opt('model', MASK_MODEL.file), ep: EP }); lap('modelLoad');
  const r = await rm.remove(img, { soft: args.includes('--soft') }); Object.assign(T, r.seconds); t = performance.now();
  writePNG(OUT, r.W, r.H, r.data);
  const m = new Uint8Array(r.W * r.H * 4); for (let i = 0; i < r.W * r.H; i++) { m[i * 4] = m[i * 4 + 1] = m[i * 4 + 2] = r.mask[i]; m[i * 4 + 3] = 255; }
  writePNG(MASK, r.W, r.H, m); lap('write');
  clearInterval(timer); sample();
  const res = { tool: 'rmbg', image: path.basename(IN), size: [r.W, r.H], ep: EP, model: MASK_MODEL.name, soft: args.includes('--soft'),
    seconds: { ...T, total: +((performance.now() - t0) / 1000).toFixed(3) }, peakRssMB: Math.round(peak / 2 ** 20), foregroundShare: r.foregroundShare, out: OUT, mask: MASK };
  console.log(JSON.stringify(res));
  fs.appendFileSync('results.jsonl', JSON.stringify(res) + '\n');
}
