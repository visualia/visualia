// VAST's preprocess_image (triposplat.py) in Node: a picture in, the 1024 px square TripoSplat expects out
// (the object on black). Steps as VAST's: scale the short side to 1024; cut out with BiRefNet-lite if the
// picture has no real alpha (research/triposr/rmbg.mjs); erode the alpha by 1 px (3x3 min); a square crop
// around the alpha's box, 1.2 times its longer side; resize to 1024; composite on black.
// Resizing is rmbg.mjs's antialiased bilinear on premultiplied colour, not PIL's Lanczos.
//   node prepare.mjs <picture.png|jpg> <prepared.png> [--cut cut.png]
// RMBG=path/to/rmbg.mjs if it is not at ../triposr/rmbg.mjs (on the M1: ~/triposr-onnx/rmbg.mjs).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rmbgPath = process.env.RMBG ? path.resolve(process.env.RMBG) : path.join(here, '../triposr/rmbg.mjs');
const { readImage, writePNG, isOpaque, createRemover, resizePlane, MASK_MODEL } = await import(pathToFileURL(rmbgPath));

const SIZE = 1024;
let remover = null;

export async function prepare(file, { cutOut } = {}) {
  let { W, H, data } = readImage(file);
  const s = SIZE / Math.min(W, H);
  if (s !== 1) {
    const w = Math.max(1, Math.round(W * s)), h = Math.max(1, Math.round(H * s));
    const planes = [0, 1, 2, 3].map(c => resizePlane(Float32Array.from({ length: W * H }, (_, i) => data[i * 4 + c]), W, H, w, h));
    data = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) for (let c = 0; c < 4; c++) data[i * 4 + c] = Math.round(planes[c][i]);
    W = w; H = h;
  }
  if (isOpaque({ data })) {
    remover ??= await createRemover({ model: process.env.RMBG_MODEL ?? path.join(path.dirname(rmbgPath), MASK_MODEL.file) });
    data = (await remover.remove({ W, H, data })).data;
  }
  if (cutOut) writePNG(cutOut, W, H, data);
  // erode the alpha, 3x3 square
  const a = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) a[i] = data[i * 4 + 3];
  const e = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let m = 255;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = Math.min(H - 1, Math.max(0, y + dy)), xx = Math.min(W - 1, Math.max(0, x + dx)); m = Math.min(m, a[yy * W + xx]); }
    e[y * W + x] = m; }
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (e[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) throw new Error(`${file}: nothing left after the cut-out`);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, half = Math.max(x1 - x0, y1 - y0) / 2 * 1.2;
  const L = Math.trunc(cx - half), T = Math.trunc(cy - half), side = Math.trunc(cx + half) - L;
  // the crop, premultiplied, transparent outside the picture (as PIL's crop)
  const planes = [0, 1, 2, 3].map(() => new Float32Array(side * side));
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const sx = L + x, sy = T + y; if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
    const j = sy * W + sx, al = e[j] / 255, k = y * side + x;
    for (let c = 0; c < 3; c++) planes[c][k] = data[j * 4 + c] * al; planes[3][k] = e[j];
  }
  const r = planes.map(p => resizePlane(p, side, side, SIZE, SIZE));
  const out = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) { for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.max(0, Math.min(255, Math.round(r[c][i]))); out[i * 4 + 3] = 255; }
  return { data: out, box: [x0, y0, x1, y1], crop: [L, T, side] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), ci = args.indexOf('--cut');
  const t = performance.now();
  const r = await prepare(args[0], { cutOut: ci >= 0 ? args[ci + 1] : undefined });
  writePNG(args[1], SIZE, SIZE, r.data);
  console.log(JSON.stringify({ in: args[0], out: args[1], box: r.box, crop: r.crop, seconds: +((performance.now() - t) / 1000).toFixed(1), peakRssMB: Math.round(process.memoryUsage().rss / 2 ** 20) }));
}
