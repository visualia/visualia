// TripoSplat in Node, no Python: a prepared picture to Gaussian splats (.ply),
// running our fp16 ONNX export (export.py) in onnxruntime-node on WebGPU.
// The sampler, the octree walk and the PLY writer are VAST's (MIT,
// github.com/VAST-AI-Research/TripoSplat, triposplat.py and model.py) ported
// to JavaScript.
//   node triposplat.mjs prepared.png out.ply [steps=4] [seed=42]
// prepared.png: 1024 x 1024 RGB, the object on black, as VAST's preprocess_image
// leaves it (out-<name>-prepared.png from bench.py).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';

const require = createRequire(import.meta.url);
const nm = process.env.NODE_MODULES ?? `${homedir()}/triposr-onnx/node_modules`;
const ort = require(`${nm}/onnxruntime-node`);
const { PNG } = require(`${nm}/pngjs`);

const [src, out, stepsArg = '4', seedArg = '42'] = process.argv.slice(2);
const STEPS = Number(stepsArg), CFG = 3.0, SHIFT = 3.0, POINTS = 8192, LEVELS = 8;
const EP = process.env.EP ?? 'webgpu';
const times = {};
const time = async (name, f) => { const t = performance.now(); const r = await f(); times[name] = +((times[name] ?? 0) + (performance.now() - t) / 1000).toFixed(2); return r; };

// Seeded randomness: xoshiro128** (seeded by splitmix32), normals by
// Box-Muller. mulberry32 here gave hazy chairs from two seeds out of two while
// NumPy's and torch's noise gave clean ones (2026-11-15). Not torch's stream,
// so the result differs from VAST's run in detail, not in kind.
const sm = (x) => () => { x = (x + 0x9e3779b9) | 0; let z = x; z = Math.imul(z ^ (z >>> 16), 0x85ebca6b); z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35); return (z ^ (z >>> 16)) >>> 0; };
const seedGen = sm(Number(seedArg) >>> 0);
const xs = Uint32Array.from([seedGen(), seedGen(), seedGen(), seedGen()]);
const rotl = (x, k) => (x << k) | (x >>> (32 - k));
const rand = () => {
  const r = Math.imul(rotl(Math.imul(xs[1], 5), 7), 9) >>> 0, t = xs[1] << 9;
  xs[2] ^= xs[0]; xs[3] ^= xs[1]; xs[1] ^= xs[2]; xs[0] ^= xs[3]; xs[2] ^= t; xs[3] = rotl(xs[3], 11);
  return r / 4294967296;
};
const randn = (n) => { const a = new Float32Array(n); for (let i = 0; i < n; i += 2) { const r = Math.sqrt(-2 * Math.log(1 - rand())), th = 2 * Math.PI * rand(); a[i] = r * Math.cos(th); if (i + 1 < n) a[i + 1] = r * Math.sin(th); } return a; };
const T = (data, dims, type = 'float32') => new ort.Tensor(type, data, dims);
// FP32 lists the parts that run with fp32 maths (fp32math.py: <name>32.onnx).
// The WebGPU backend sums fp16 in fp16; the DiT is fast and close enough in fp16.
const FP32 = (process.env.FP32 ?? 'dinov3,vae,octree,gs').split(',');
const open = (name) => time(`load_${name}`, () => ort.InferenceSession.create(`onnx/${name}${FP32.includes(name) ? '32' : ''}.onnx`, { executionProviders: [EP], graphOptimizationLevel: 'all' }));

// ---- the picture -> feature1 (DINOv3) and feature2 (Flux VAE) ---------------
const png = PNG.sync.read(readFileSync(src));
if (png.width !== 1024 || png.height !== 1024) throw new Error('prepared.png must be 1024 x 1024');
const N = 1024 * 1024, mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
const dinoIn = new Float32Array(3 * N), vaeIn = new Float32Array(3 * N);
for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) {
  const v = png.data[i * 4 + c] / 255;
  dinoIn[c * N + i] = (v - mean[c]) / std[c];
  vaeIn[c * N + i] = v * 2 - 1;
}
let s = await open('dinov3');
let feature1 = (await time('dinov3', () => s.run({ pixels: T(dinoIn, [1, 3, 1024, 1024]) }))).feature1;
await s.release();
s = await open('vae');
let feature2 = (await time('vae', () => s.run({ pixels: T(vaeIn, [1, 3, 1024, 1024]), noise: T(randn(32 * 128 * 128), [1, 32, 128, 128]) }))).feature2;
await s.release();

// ---- flow matching, Euler with CFG (FlowEulerCfgSampler.sample) ----------------
const dit = await open('dit');
// START=refs/dit.npz: VAST's features and starting noise instead (to test the sampler alone).
const start = process.env.START ? (await import('./check.mjs')).npz(process.env.START) : null;
const use = (k) => start && (process.env.START_USE ?? 'features,noise').split(',').includes(k);
if (use('features')) { feature1 = T(start.feature1.data, start.feature1.shape); feature2 = T(start.feature2.data, start.feature2.shape); }
const zeros1 = T(new Float32Array(feature1.data.length), feature1.dims), zeros2 = T(new Float32Array(feature2.data.length), feature2.dims);
const latent = use('noise') ? start.latent.data : randn(POINTS * 16), camera = use('noise') ? start.camera.data : randn(5);
const lin = Array.from({ length: STEPS + 1 }, (_, i) => 1 - i / STEPS);
const tSeq = lin.map((x) => (SHIFT * x) / (1 + (SHIFT - 1) * x));
for (let i = 0; i < STEPS; i++) {
  const t = tSeq[i], dt = t - tSeq[i + 1];
  const feeds = (f1, f2) => ({ latent: T(latent.slice(), [1, POINTS, 16]), camera: T(camera.slice(), [1, 1, 5]), t: T(new Float32Array([1000 * t]), [1]), feature1: f1, feature2: f2 });
  const c = await time('dit', () => dit.run(feeds(feature1, feature2)));
  const u = await time('dit', () => dit.run(feeds(zeros1, zeros2)));
  for (const [x, k] of [[latent, 'v_latent'], [camera, 'v_camera']]) {
    const a = c[k].data, b = u[k].data;
    for (let j = 0; j < x.length; j++) x[j] -= (CFG * a[j] - (CFG - 1) * b[j]) * dt;
  }
}
await dit.release();
// LATENT=refs/gs.npz: VAST's own final latent instead (to test the steps after it).
if (process.env.LATENT) latent.set((await import('./check.mjs')).npz(process.env.LATENT).latent.data);
const latentT = T(latent, [1, POINTS, 16]);

// ---- the octree walk (OctreeProbabilityFixedlenDecoder.sample, systematic) -------
const octree = await open('octree');
let coords = [[0, 0, 0]], counts = [POINTS];
for (let lv = 1; lv <= LEVELS; lv++) {
  const resP = 1 << (lv - 1), P = coords.length;
  const pad = new Float32Array(POINTS * 3);
  coords.forEach((c, r) => { for (let d = 0; d < 3; d++) pad[r * 3 + d] = (c[d] + 0.5) / resP; });
  const logits = (await time('octree', () => octree.run({ coords: T(pad, [1, POINTS, 3]), res: T(BigInt64Array.of(BigInt(1 << lv)), [1], 'int64'), latent: latentT, num: T(BigInt64Array.of(BigInt(POINTS)), [1], 'int64') }))).logits.data;
  const nextCoords = [], nextCounts = [];
  for (let r = 0; r < P; r++) {
    const n = counts[r], l = logits.subarray(r * 8, r * 8 + 8), m = Math.max(...l);
    const p = Array.from(l, (x) => Math.exp(x - m)), sum = p.reduce((a, b) => a + b, 0);
    let acc = 0; const cdf = p.map((x) => Math.min((acc += x / sum), 1 - 1e-12));
    const got = new Array(8).fill(0), u0 = rand() / n;
    for (let k = 0, j = 0; k < n; k++) { const u = Math.min(u0 + k / n, 1 - 1e-12); while (j < 7 && cdf[j] < u) j++; got[j]++; }
    for (let ch = 0; ch < 8; ch++) if (got[ch]) {
      nextCoords.push([coords[r][0] * 2 + (ch & 1), coords[r][1] * 2 + ((ch >> 1) & 1), coords[r][2] * 2 + ((ch >> 2) & 1)]);
      nextCounts.push(got[ch]);
    }
  }
  coords = nextCoords; counts = nextCounts;
}
await octree.release();
const points = new Float32Array(POINTS * 3);
let q = 0;
coords.forEach((c, r) => { for (let k = 0; k < counts[r]; k++, q++) for (let d = 0; d < 3; d++) points[q * 3 + d] = (c[d] + rand()) / (1 << LEVELS); });

// ---- Gaussians and the PLY (Gaussian._get_ply_data with its default transform) -----
const gs = await open('gs');
const g = await time('gs', () => gs.run({ points: T(points, [1, POINTS, 3]), latent: latentT }));
await gs.release();
const n = g.xyz.dims[0];
const props = ['x', 'y', 'z', 'nx', 'ny', 'nz', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3'];
const header = `ply\nformat binary_little_endian 1.0\nelement vertex ${n}\n${props.map((p) => `property float ${p}`).join('\n')}\nend_header\n`;
const body = new Float32Array(n * props.length);
const h = Math.SQRT1_2; // the transform (x, y, z) -> (x, -z, y) is a quarter turn about x: q = (h, h, 0, 0)
for (let i = 0; i < n; i++) {
  const o = i * props.length, [x, y, z] = g.xyz.data.subarray(i * 3, i * 3 + 3);
  body.set([x, -z, y, 0, 0, 0], o);
  body.set(g.f_dc.data.subarray(i * 3, i * 3 + 3), o + 6);
  body[o + 9] = g.opacity.data[i];
  body.set(g.scale.data.subarray(i * 3, i * 3 + 3), o + 10);
  const [w, a, b, c] = g.rotation.data.subarray(i * 4, i * 4 + 4);
  body.set([h * (w - a), h * (a + w), h * (b - c), h * (c + b)], o + 13);
}
writeFileSync(out, Buffer.concat([Buffer.from(header), Buffer.from(body.buffer)]));
times.total = +Object.entries(times).reduce((t, [, v]) => t + v, 0).toFixed(1);
console.log(JSON.stringify({ out, gaussians: n, steps: STEPS, ep: EP, fp32: FP32, times }));
