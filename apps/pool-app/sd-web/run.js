// ChilloutMix (Stable Diffusion 1.5) in a tab: ONNX Runtime Web on WebGPU,
// three fp16 models from ./models/ (export.py), DPM++ 2M Karras in JS.
import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/ort.webgpu.min.mjs";
import { makeTokenizer } from "./tokenizer.js";

ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/";

const MODELS = "./models/";
const FILES = { text: "text_encoder.onnx", unet: "unet.onnx", vae: "vae_decoder.onnx" };
const SIDE = 512, LATENT = 64, CH = 4;
const N = CH * LATENT * LATENT; // one latent

// SD 1.5's noise schedule: scaled_linear betas 0.00085 to 0.012 over 1000 steps.
// sigma[t] = sqrt((1 - abar) / abar); the UNet was trained on t = 0..999.
const TRAIN_SIGMAS = (() => {
  const out = new Float64Array(1000);
  let abar = 1;
  for (let t = 0; t < 1000; t++) {
    const b = (Math.sqrt(0.00085) + (Math.sqrt(0.012) - Math.sqrt(0.00085)) * t / 999) ** 2;
    abar *= 1 - b;
    out[t] = Math.sqrt((1 - abar) / abar);
  }
  return out;
})();
const LOG_SIGMAS = TRAIN_SIGMAS.map(Math.log);

// k-diffusion sigma_to_t: the (fractional) timestep for a sigma, interpolated in log sigma.
function sigmaToT(sigma) {
  const ls = Math.log(sigma);
  let i = 0;
  while (i < 998 && LOG_SIGMAS[i + 1] <= ls) i++;
  const w = Math.min(1, Math.max(0, (LOG_SIGMAS[i] - ls) / (LOG_SIGMAS[i] - LOG_SIGMAS[i + 1])));
  return (1 - w) * i + w * (i + 1);
}

// Karras et al. (2022) spacing, rho 7, from the schedule's largest sigma to its smallest, then 0.
export function karrasSigmas(steps) {
  const min = TRAIN_SIGMAS[0] ** (1 / 7), max = TRAIN_SIGMAS[999] ** (1 / 7);
  const out = [];
  for (let i = 0; i < steps; i++) out.push((max + (i / (steps - 1)) * (min - max)) ** 7);
  out.push(0);
  return out;
}

// The UNet's time input: Timesteps(320, flip_sin_to_cos) computed in float64.
function timeEmbedding(t) {
  const e = new Float32Array(320);
  for (let j = 0; j < 160; j++) {
    const a = t * Math.exp(-Math.log(10000) * j / 160);
    e[j] = Math.cos(a);
    e[160 + j] = Math.sin(a);
  }
  return e;
}

// mulberry32 and Box-Muller: a seed gives the same picture here (not the same as torch's).
function gaussian(seed) {
  let a = seed >>> 0;
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) + 1) / 4294967297; // never 0
  };
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
}

async function bytes(name, onProgress) {
  const res = await fetch(MODELS + name);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const out = new Uint8Array(total);
  const reader = res.body.getReader();
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.set(value, got);
    got += value.length;
    onProgress?.(name, got, total);
  }
  return out;
}

const OPTIONS = {
  executionProviders: ["webgpu"],
  enableMemPattern: false,
  enableCpuMemArena: false,
  extra: { session: { disable_prepacking: "1", use_device_allocator_for_initializers: "1", use_ort_model_bytes_directly: "1" } },
};

let loaded = null;

// Downloads and opens the three models once; later pictures reuse them.
export async function load({ onProgress, onStatus = () => {} } = {}) {
  if (loaded) return loaded;
  const t0 = performance.now();
  const vocab = await (await fetch(MODELS + "vocab.json")).json();
  const merges = await (await fetch(MODELS + "merges.txt")).text();
  const tokenize = makeTokenizer(vocab, merges);
  const sessions = {};
  for (const [key, file] of Object.entries(FILES)) {
    const buf = await bytes(file, onProgress);
    onStatus(`opening ${key}`);
    sessions[key] = await ort.InferenceSession.create(buf, OPTIONS);
  }
  loaded = { tokenize, ...sessions, seconds: (performance.now() - t0) / 1000 };
  return loaded;
}

export async function generate({
  prompt, negative = "nsfw, nude, naked", seed = 1, steps = 20, cfg = 7,
  onStatus = () => {}, onProgress,
}) {
  const m = await load({ onProgress, onStatus });
  const times = { load: m.seconds };
  let t0 = performance.now();

  // 1. Text: row 0 the negative prompt, row 1 the prompt.
  const ids = Int32Array.from([...m.tokenize(negative), ...m.tokenize(prompt)]);
  const { last_hidden_state: hidden } = await m.text.run({ input_ids: new ort.Tensor("int32", ids, [2, 77]) });
  times.text = (performance.now() - t0) / 1000;

  // 2. DPM++ 2M with Karras sigmas (k-diffusion sample_dpmpp_2m), eps-prediction.
  t0 = performance.now();
  const sigmas = karrasSigmas(steps);
  const noise = gaussian(seed);
  const x = new Float32Array(N);
  for (let i = 0; i < N; i++) x[i] = noise() * sigmas[0];
  let old = null;
  for (let i = 0; i < steps; i++) {
    const s = sigmas[i], next = sigmas[i + 1];
    const scale = 1 / Math.sqrt(s * s + 1);
    const sample = new Float32Array(2 * N);
    for (let j = 0; j < N; j++) sample[j] = sample[N + j] = x[j] * scale;
    const temb = timeEmbedding(sigmaToT(s));
    const tembs = new Float32Array(640);
    tembs.set(temb); tembs.set(temb, 320);
    const out = await m.unet.run({
      sample: new ort.Tensor("float32", sample, [2, CH, LATENT, LATENT]),
      temb: new ort.Tensor("float32", tembs, [2, 320]),
      encoder_hidden_states: hidden,
    });
    const eps = out.noise.data;
    out.noise.dispose?.();
    const denoised = new Float32Array(N);
    for (let j = 0; j < N; j++) {
      const e = eps[j] + cfg * (eps[N + j] - eps[j]);
      denoised[j] = x[j] - s * e;
    }
    if (next === 0) {
      x.set(denoised);
    } else {
      const t = -Math.log(s), tNext = -Math.log(next), h = tNext - t;
      const a = next / s, b = -Math.expm1(-h); // x_next = a x + b denoised
      if (!old) {
        for (let j = 0; j < N; j++) x[j] = a * x[j] + b * denoised[j];
      } else {
        const r = (t + Math.log(sigmas[i - 1])) / h; // h_last / h
        const c1 = 1 + 1 / (2 * r), c2 = 1 / (2 * r);
        for (let j = 0; j < N; j++) x[j] = a * x[j] + b * (c1 * denoised[j] - c2 * old[j]);
      }
    }
    old = denoised;
    onStatus("drawing", i + 1, steps);
  }
  times.steps = (performance.now() - t0) / 1000;

  // 3. VAE decoder: latent in, [1, 3, 512, 512] RGB 0..1 out.
  t0 = performance.now();
  const { image } = await m.vae.run({ latent: new ort.Tensor("float32", x, [1, CH, LATENT, LATENT]) });
  times.vae = (performance.now() - t0) / 1000;
  return { rgb: image.data, times };
}

// Planar RGB 0..1 to a PNG blob via a canvas.
export async function toPng(rgb, side = SIDE) {
  const canvas = new OffscreenCanvas(side, side);
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(side, side);
  const plane = side * side;
  for (let p = 0; p < plane; p++) {
    img.data[p * 4] = Math.round(rgb[p] * 255);
    img.data[p * 4 + 1] = Math.round(rgb[plane + p] * 255);
    img.data[p * 4 + 2] = Math.round(rgb[2 * plane + p] * 255);
    img.data[p * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}
