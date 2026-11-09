// DALL·E mini in a tab: ONNX Runtime Web on WebGPU, three models from ./models/.
// Follows min-dalle's generate_raw_image_stream and sample_tokens.
import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/ort.webgpu.min.mjs";
import { makeTokenizer, textTokens } from "./tokenizer.js";

ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/";

const MODELS = "./models/";
const LAYERS = 12, IMAGE_TOKENS = 256, IMAGE_VOCAB = 16384, START = 16383;
const CACHE_SHAPE = [4, 256, 1024]; // rows 0-1 keys, rows 2-3 values (2 = empty prompt + prompt)

// mulberry32: small seeded RNG, same seed gives the same picture here
// (not the same as min-dalle's torch seed).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// min-dalle sample_tokens: mix the two rows, keep the top k, softmax with temperature, draw one.
export function sample(logits, { temperature, topK, supercondition }, random) {
  const n = IMAGE_VOCAB;
  const mixed = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    mixed[j] = logits[j] * (1 - supercondition) + logits[n + j] * supercondition;
  }
  const sorted = Float32Array.from(mixed).sort().reverse();
  const kth = sorted[topK - 1], max = sorted[0];
  let sum = 0;
  const p = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    if (mixed[j] >= kth) { p[j] = Math.exp((mixed[j] - max) / temperature); sum += p[j]; }
  }
  let r = random() * sum;
  for (let j = 0; j < n; j++) {
    if (p[j] === 0) continue;
    r -= p[j];
    if (r <= 0) return j;
  }
  return mixed.indexOf(max); // rounding left r above 0
}

async function bytes(name, onProgress) {
  const res = await fetch(MODELS + name);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress?.(name, got, total);
  }
  const out = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

const session = (buf, extra = {}) =>
  ort.InferenceSession.create(buf, { executionProviders: ["webgpu"], ...extra });

export async function generate({
  prompt, seed = 1, temperature = 1, topK = 256, supercondition = 16,
  onStatus = () => {}, onProgress,
}) {
  const manifest = await (await fetch(MODELS + "manifest.json")).json();
  const vocab = await (await fetch(MODELS + "vocab.json")).json();
  const merges = await (await fetch(MODELS + "merges.txt")).text();
  const ids = makeTokenizer(vocab, merges)(prompt);
  const text = new ort.Tensor("int64", textTokens(ids, manifest.text_tokens, manifest.pad_token), [2, 64]);

  // 1. Encoder: text in, [2, 64, 1024] fp16 out. Freed before the decoder loads.
  onStatus("encoder");
  const enc = await session(await bytes(manifest.files.enc, onProgress));
  const { encoder_state } = await enc.run({ text_tokens: text });
  await enc.release();

  // 2. Decoder, once per image token. The caches stay on the GPU between steps.
  onStatus("decoder");
  const cacheOut = {};
  for (let l = 0; l < LAYERS; l++) cacheOut[`new_cache_${l}`] = "gpu-buffer";
  const dec = await session(await bytes(manifest.files.dec, onProgress), {
    preferredOutputLocation: { logits: "cpu", ...cacheOut },
  });

  const size = CACHE_SHAPE.reduce((a, b) => a * b);
  let caches = Array.from({ length: LAYERS }, () =>
    new ort.Tensor("float16", new Uint16Array(size), CACHE_SHAPE));
  const random = rng(seed);
  const tokens = new Array(IMAGE_TOKENS);
  let prev = START;

  for (let i = 0; i < IMAGE_TOKENS; i++) {
    const feeds = {
      text_tokens: text,
      encoder_state,
      prev_tokens: new ort.Tensor("int64", BigInt64Array.of(BigInt(prev)), [1, 1]),
      token_index: new ort.Tensor("int64", BigInt64Array.of(BigInt(i)), [1]),
    };
    caches.forEach((c, l) => { feeds[`cache_${l}`] = c; });
    const out = await dec.run(feeds);
    // The old caches are inputs only now; free the GPU copies.
    if (i > 0) caches.forEach((c) => c.dispose());
    caches = caches.map((_, l) => out[`new_cache_${l}`]);
    prev = sample(out.logits.data, { temperature, topK, supercondition }, random);
    tokens[i] = prev;
    onStatus("decoder", i + 1);
  }
  caches.forEach((c) => c.dispose());
  await dec.release();

  // 3. VQGAN detokenizer: 16 x 16 tokens in, [1, 256, 256, 3] RGB 0..255 out.
  onStatus("detokenizer");
  const det = await session(await bytes(manifest.files.det, onProgress));
  const { image } = await det.run({
    tokens: new ort.Tensor("int64", BigInt64Array.from(tokens, BigInt), [1, IMAGE_TOKENS]),
  });
  await det.release();
  return { tokens, rgb: image.data, ids };
}

// RGB floats to a PNG blob via a canvas.
export async function toPng(rgb, side = 256) {
  const canvas = new OffscreenCanvas(side, side);
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(side, side);
  for (let p = 0; p < side * side; p++) {
    img.data[p * 4] = rgb[p * 3];
    img.data[p * 4 + 1] = rgb[p * 3 + 1];
    img.data[p * 4 + 2] = rgb[p * 3 + 2];
    img.data[p * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}
