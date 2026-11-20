// node apps/pool/test/depth-test.mjs
//
// The tab's depth code (public/depth.js) against the depth maps
// evals/estonian-visuals/drift-room.mjs made with transformers.js from the same
// model file. Same file, same steps, so the maps should agree almost exactly;
// the only difference is the resize (sharp's cubic here, transformers.js's
// bicubic there). The model run is skipped, with a note, when the file or the
// pictures are not on this computer (they are git-ignored research outputs).

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as ort from 'onnxruntime-web';
import { targetSize, toInput, toGrey, SIDE } from '../public/depth.js';
import { MODELS } from '../src/models.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const MODEL = process.env.DEPTH_MODEL ?? `${root}evals/estonian-visuals/out/neighbours/models/onnx-community/depth-anything-v2-small/onnx/model_quantized.onnx`;
const LAND = `${root}evals/estonian-visuals/out/drift-room/land/nano-banana-2-lite/`;
const PICTURES = ['bog', 'birch', 'alvar', 'ashhill'];

// ---- sizes: the DPT rule ----
assert.deepEqual(targetSize(1024, 1024), { width: 518, height: 518 });
assert.deepEqual(targetSize(518, 518), { width: 518, height: 518 });
// wide: the scale closer to 1 wins for both sides (518/1536 vs 518/1024 -> 518/1024)
assert.deepEqual(targetSize(1536, 1024), { width: 784, height: 518 });
for (const [w, h] of [[640, 480], [300, 900], [1, 1], [4000, 3000]]) {
  const t = targetSize(w, h);
  assert.equal(t.width % 14, 0);
  assert.equal(t.height % 14, 0);
  assert.ok(Math.abs(t.width / t.height - w / h) < 0.1 || Math.min(w, h) < SIDE / 10, `${w}x${h} keeps its shape`);
}

// ---- numbers in and out ----
const one = toInput(new Uint8Array([255, 0, 128, 255]), 1, 1);
assert.ok(Math.abs(one[0] - (1 - 0.485) / 0.229) < 1e-6);
assert.ok(Math.abs(one[1] - (0 - 0.456) / 0.224) < 1e-6);
assert.deepEqual([...toGrey(new Float32Array([2, 4, 3]))], [0, 255, 128]);
assert.deepEqual([...toGrey(new Float32Array([5, 5]))], [0, 0]); // flat: no division by zero

// ---- the model list entry is the file this test runs ----
const entry = MODELS.find((m) => m.depth);
assert.ok(entry, 'a depth model in models.js');

if (!existsSync(MODEL) || !existsSync(`${LAND}bog.png`)) {
  console.log('depth-test: sizes and numbers pass; model run skipped (model or pictures not here)');
  process.exit(0);
}
const bytes = readFileSync(MODEL);
assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, 'models.js sha256 matches the file');

// ---- the model, against the maps made with transformers.js ----
ort.env.wasm.numThreads = 1; // as a tab without cross-origin isolation
const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
const corr = (a, b) => {
  const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; ab += x * y; aa += x * x; bb += y * y; }
  return ab / Math.sqrt(aa * bb);
};
for (const name of PICTURES) {
  const file = `${LAND}${name}.png`;
  if (!existsSync(file) || !existsSync(`${LAND}${name}-depth.png`)) continue;
  const meta = await sharp(file).metadata();
  const { width, height } = targetSize(meta.width, meta.height);
  const rgba = await sharp(file).resize(width, height, { fit: 'fill', kernel: 'cubic' }).ensureAlpha().raw().toBuffer();
  const t0 = performance.now();
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', toInput(rgba, width, height), [1, 3, height, width]) });
  const ms = performance.now() - t0;
  const d = out[session.outputNames[0]];
  const [h, w] = d.dims.slice(-2);
  const grey = toGrey(d.data);
  const ref = await sharp(`${LAND}${name}-depth.png`).greyscale().raw().toBuffer({ resolveWithObject: true });
  const ours = await sharp(Buffer.from(grey), { raw: { width: w, height: h, channels: 1 } })
    .resize(ref.info.width, ref.info.height, { fit: 'fill' }).extractChannel(0).raw().toBuffer();
  const r = corr(ours, ref.data);
  console.log(`depth-test: ${name} ${w}x${h} in ${(ms / 1000).toFixed(2)} s, r = ${r.toFixed(4)}`);
  assert.ok(r > 0.99, `${name}: our map follows the transformers.js map (r = ${r})`);
}
console.log('depth-test: pass');
