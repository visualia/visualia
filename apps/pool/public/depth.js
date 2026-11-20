// Depth Anything V2 small for the pool (plans/pool-3d.md section 12): a picture
// in, a grey depth map out (near = white). Pure functions, no browser or Node
// APIs, so the tab (join.html) and the test (apps/pool/test/depth-test.mjs) run
// the same code. The caller resizes the picture to targetSize() and runs the
// ONNX session; this file does the numbers before and after.
//
// The steps follow the model's preprocessor_config.json (DPTImageProcessor):
// fit to 518 keeping the aspect ratio, sides a multiple of 14, scale to 0..1,
// normalise with ImageNet's mean and std. The model answers relative inverse
// depth (bigger is nearer), which is min-max scaled to 0..255 here, as
// evals/estonian-visuals/drift-room.mjs writes its depth maps.

export const SIDE = 518;
export const MULTIPLE = 14;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

// The model's input size for a w x h picture: the scale closer to 1 of the two
// (518/w, 518/h) for both sides, each rounded to the nearest multiple of 14.
export function targetSize(w, h) {
  let sw = SIDE / w, sh = SIDE / h;
  if (Math.abs(1 - sw) < Math.abs(1 - sh)) sh = sw; else sw = sh;
  const fit = (n) => Math.max(MULTIPLE, Math.round(n / MULTIPLE) * MULTIPLE);
  return { width: fit(w * sw), height: fit(h * sh) };
}

// RGBA bytes (w x h, already resized to targetSize) -> the model's input,
// Float32 in [1, 3, h, w] order.
export function toInput(rgba, w, h) {
  const n = w * h;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) out[c * n + i] = (rgba[i * 4 + c] / 255 - MEAN[c]) / STD[c];
  }
  return out;
}

// The model's output (relative inverse depth, w x h) -> grey bytes, near = white.
export function toGrey(depth) {
  let lo = Infinity, hi = -Infinity;
  for (const v of depth) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = hi - lo || 1;
  const grey = new Uint8ClampedArray(depth.length);
  for (let i = 0; i < depth.length; i++) grey[i] = Math.round(((depth[i] - lo) / span) * 255);
  return grey;
}
