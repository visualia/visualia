// Cut the figure out of a picture: BiRefNet-lite (MIT, onnx-community/BiRefNet_lite-ONNX) through transformers.js
// on onnxruntime-web (WASM; onnxruntime-node's native library is blocked on this Mac). Writes <out>-mask.png (soft
// alpha, the picture's size) and <out>-cut.png (the picture with that alpha).
// Usage: node cutout.mjs <picture> <out prefix>
import { pipeline, env } from '@huggingface/transformers';
import sharp from 'sharp';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
// as drift-room.mjs depth: onnxruntime-web's WebAssembly files loaded from disk, no blob: URLs, no wasm cache
const require = createRequire(import.meta.url);
env.cacheDir = `${process.env.HOME}/visualia-local/hf-js`;
env.useWasmCache = false;
const ortDir = require.resolve('onnxruntime-node', { paths: [new URL('./node_modules/@huggingface/transformers/', import.meta.url).pathname] });
env.backends.onnx.wasm.wasmPaths = pathToFileURL(ortDir.replace(/dist\/.*$/, 'dist/')).href;
env.backends.onnx.wasm.numThreads = 4;
const [src, out] = process.argv.slice(2);
const t0 = performance.now();
const remove = await pipeline('background-removal', process.env.MODEL || 'onnx-community/BiRefNet_lite-ONNX', { dtype: process.env.DTYPE || 'fp16' });
const got = await remove(src), res = Array.isArray(got) ? got[0] : got;
const { width: w, height: h } = await sharp(src).metadata();
// the result is RGBA at the picture's size; keep its alpha as the mask
const rgba = Buffer.from(res.data);
const alpha = Buffer.alloc(res.width * res.height);
for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
await sharp(alpha, { raw: { width: res.width, height: res.height, channels: 1 } }).resize(w, h).png().toFile(`${out}-mask.png`);
// the cut-out: the picture's colour with the mask as its alpha, built byte by byte (sharp's joinChannel lost the alpha)
const m = await sharp(`${out}-mask.png`).extractChannel(0).raw().toBuffer();
const rgb = await sharp(src).removeAlpha().raw().toBuffer();
const cut = Buffer.alloc(w * h * 4);
for (let i = 0; i < w * h; i++) { cut[i * 4] = rgb[i * 3]; cut[i * 4 + 1] = rgb[i * 3 + 1]; cut[i * 4 + 2] = rgb[i * 3 + 2]; cut[i * 4 + 3] = m[i]; }
await sharp(cut, { raw: { width: w, height: h, channels: 4 } }).png().toFile(`${out}-cut.png`);
console.log(`${((performance.now() - t0) / 1000).toFixed(1)} s, ${res.width}x${res.height}`);
