// TripoSR in Node: image -> triplane (ONNX) -> density grid (ONNX) -> marching cubes (JS) -> GLB.
// usage: node triposr.mjs <image.png> [--res 128] [--enc cpu|coreml] [--dec cpu|coreml] [--out out.glb]
//        [--threshold 25] [--ratio 0.85] [--chunk 262144] [--no-color]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ort = require('onnxruntime-node');
const { PNG } = require('pngjs');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes('--' + k);
const IMG = args[0];
const RES = +opt('res', 128);
const ENC = opt('enc', 'cpu');
const DEC = opt('dec', 'cpu');
const THRESH = +opt('threshold', 25);
const RATIO = +opt('ratio', 0.85);
const CHUNK = +opt('chunk', 262144);
const COLOR = !flag('no-color');
const OUT = opt('out', `out/${path.basename(IMG, '.png')}-${RES}-${ENC}-${DEC}.glb`);
const MODELS = opt('models', '.');
const RADIUS = 0.87;

let peakRss = 0;
const sample = () => { const r = process.memoryUsage().rss; if (r > peakRss) peakRss = r; };
const sampler = setInterval(sample, 50);
const T = {}; let t0 = performance.now();
const lap = k => { const t = performance.now(); T[k] = (t - t0) / 1000; t0 = t; sample(); };
const tStart = performance.now();

// ---- preprocessing, as tsr/utils.py resize_foreground + run.py composite + ImagePreprocessor
function preprocess(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H, data } = png; // RGBA 8 bit
  let y1 = H, y2 = -1, x1 = W, x2 = -1, anyTransparent = false;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = data[(y * W + x) * 4 + 3];
    if (a < 255) anyTransparent = true;
    if (a > 0) { if (y < y1) y1 = y; if (y > y2) y2 = y; if (x < x1) x1 = x; if (x > x2) x2 = x; }
  }
  let S, rgb; // S x S float rgb in [0,1] on grey
  if (!anyTransparent) {
    // treated as already processed (grey background, sized foreground), like --no-remove-bg
    if (W !== H) throw new Error('opaque image must be square and pre-composited');
    S = W; rgb = new Float32Array(S * S * 3);
    for (let i = 0; i < S * S; i++) for (let c = 0; c < 3; c++) rgb[i * 3 + c] = data[i * 4 + c] / 255;
  } else {
    // numpy slice fg = image[y1:y2, x1:x2] excludes the max row and column; kept identical
    const fh = y2 - y1, fw = x2 - x1, size = Math.max(fh, fw);
    const ph0 = Math.floor((size - fh) / 2), pw0 = Math.floor((size - fw) / 2);
    const newSize = Math.floor(size / RATIO);
    const qh0 = Math.floor((newSize - size) / 2);
    S = newSize; rgb = new Float32Array(S * S * 3).fill(0.5);
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const si = ((y + y1) * W + (x + x1)) * 4;
      const oy = y + ph0 + qh0, ox = x + pw0 + qh0;
      const a = data[si + 3] / 255, o = (oy * S + ox) * 3;
      for (let c = 0; c < 3; c++) {
        const v = (data[si + c] / 255) * a + (1 - a) * 0.5;
        rgb[o + c] = Math.floor(v * 255) / 255; // astype(uint8) truncates
      }
    }
  }
  return resizeAA(rgb, S, 512);
}

// bilinear with antialias (triangle filter widened by the scale), align_corners=False, like torch
function resample1d(src, n, m, stride, count, get, set) {
  const scale = n / m, support = Math.max(scale, 1);
  for (let o = 0; o < m; o++) {
    const center = (o + 0.5) * scale;
    const lo = Math.max(0, Math.floor(center - support)), hi = Math.min(n - 1, Math.ceil(center + support));
    const w = []; let ws = 0;
    for (let i = lo; i <= hi; i++) { const t = 1 - Math.abs((i + 0.5 - center) / support); const v = t > 0 ? t : 0; w.push(v); ws += v; }
    for (let k = 0; k < count; k++) { let acc = 0; for (let i = lo; i <= hi; i++) acc += w[i - lo] * get(i, k); set(o, k, acc / ws); }
  }
}
function resizeAA(rgb, S, D) {
  const tmp = new Float32Array(S * D * 3); // rows S, cols D
  resample1d(null, S, D, 0, S * 3, (i, k) => { const y = Math.floor(k / 3), c = k % 3; return rgb[(y * S + i) * 3 + c]; },
    (o, k, v) => { const y = Math.floor(k / 3), c = k % 3; tmp[(y * D + o) * 3 + c] = v; });
  const chw = new Float32Array(3 * D * D);
  resample1d(null, S, D, 0, D * 3, (i, k) => { const x = Math.floor(k / 3), c = k % 3; return tmp[(i * D + x) * 3 + c]; },
    (o, k, v) => { const x = Math.floor(k / 3), c = k % 3; chw[c * D * D + o * D + x] = v; });
  return chw;
}

// ---- marching cubes with welded vertices (tables from Paul Bourke via the isosurface package)
const src = fs.readFileSync(require.resolve('isosurface/lib/marchingcubes.js'), 'utf8');
const tablesSrc = src.slice(0, src.indexOf('exports.marchingCubes'));
const { edgeTable, triTable, cubeVerts, edgeIndex } = new Function(tablesSrc + ';return {edgeTable,triTable,cubeVerts,edgeIndex};')();
function marchingCubes(f, N) { // f[(i*N+j)*N+k] > 0 inside, i=x j=y k=z
  const idx = (i, j, k) => (i * N + j) * N + k;
  const vmap = new Map(); const pos = []; const tris = [];
  const g = new Float64Array(8), ev = new Int32Array(12);
  const eAxis = edgeIndex.map(([a, b]) => { const p = cubeVerts[a], q = cubeVerts[b]; return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2]), p[0] !== q[0] ? 0 : p[1] !== q[1] ? 1 : 2]; });
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < N - 1; j++) for (let k = 0; k < N - 1; k++) {
    let ci = 0;
    for (let v = 0; v < 8; v++) { const c = cubeVerts[v]; const s = f[idx(i + c[0], j + c[1], k + c[2])]; g[v] = s; if (s > 0) ci |= 1 << v; }
    const em = edgeTable[ci]; if (!em) continue;
    for (let e = 0; e < 12; e++) {
      if (!(em & (1 << e))) continue;
      const [bx, by, bz, ax] = eAxis[e];
      const key = idx(i + bx, j + by, k + bz) * 3 + ax;
      let id = vmap.get(key);
      if (id === undefined) {
        const [a, b] = edgeIndex[e], p0 = cubeVerts[a], p1 = cubeVerts[b];
        const ga = g[a], gb = g[b], d = ga - gb, t = Math.abs(d) > 1e-12 ? ga / d : 0.5;
        id = pos.length / 3;
        pos.push(i + p0[0] + t * (p1[0] - p0[0]), j + p0[1] + t * (p1[1] - p0[1]), k + p0[2] + t * (p1[2] - p0[2]));
        vmap.set(key, id);
      }
      ev[e] = id;
    }
    const tt = triTable[ci];
    for (let t = 0; t < tt.length; t += 3) tris.push(ev[tt[t]], ev[tt[t + 1]], ev[tt[t + 2]]);
  }
  return { pos: new Float32Array(pos), tris: new Uint32Array(tris) };
}

// ---- mesh checks: connected components (union find), bounding box, signed volume
function analyse(pos, tris) {
  const nv = pos.length / 3, par = new Int32Array(nv).map((_, i) => i);
  const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
  for (let t = 0; t < tris.length; t += 3) { uni(tris[t], tris[t + 1]); uni(tris[t], tris[t + 2]); }
  const compTris = new Map();
  for (let t = 0; t < tris.length; t += 3) { const r = find(tris[t]); compTris.set(r, (compTris.get(r) || 0) + 1); }
  const sizes = [...compTris.values()].sort((a, b) => b - a);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nv; i++) for (let c = 0; c < 3; c++) { const v = pos[i * 3 + c]; if (v < min[c]) min[c] = v; if (v > max[c]) max[c] = v; }
  let vol = 0;
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t] * 3, b = tris[t + 1] * 3, c = tris[t + 2] * 3;
    vol += (pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c]) + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c])) / 6;
  }
  // boundary edges: an edge used once means a hole or the box wall cutting the surface
  const em = new Map();
  for (let t = 0; t < tris.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = tris[t + e], b = tris[t + (e + 1) % 3], key = a < b ? a * nv + b : b * nv + a;
    em.set(key, (em.get(key) || 0) + 1);
  }
  let boundary = 0, nonManifold = 0; for (const c of em.values()) { if (c === 1) boundary++; else if (c > 2) nonManifold++; }
  return { components: sizes.length, largestShare: sizes[0] / (tris.length / 3), componentTris: sizes.slice(0, 5), min, max, volume: vol, boundaryEdges: boundary, nonManifoldEdges: nonManifold };
}

// ---- GLB writer: POSITION, NORMAL, COLOR_0 (u8 normalised), uint32 indices
function writeGLB(file, pos, nrm, col, tris) {
  const nv = pos.length / 3;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nv; i++) for (let c = 0; c < 3; c++) { const v = pos[i * 3 + c]; min[c] = Math.min(min[c], v); max[c] = Math.max(max[c], v); }
  const pad4 = n => (n + 3) & ~3;
  const parts = [], views = [], accessors = []; let off = 0;
  const add = (buf, target) => { const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength); views.push({ buffer: 0, byteOffset: off, byteLength: b.length, target }); parts.push(b); const p = pad4(b.length) - b.length; if (p) parts.push(Buffer.alloc(p)); off += pad4(b.length); return views.length - 1; };
  const attrs = {};
  accessors.push({ bufferView: add(pos, 34962), componentType: 5126, count: nv, type: 'VEC3', min, max }); attrs.POSITION = 0;
  accessors.push({ bufferView: add(nrm, 34962), componentType: 5126, count: nv, type: 'VEC3' }); attrs.NORMAL = 1;
  if (col) { accessors.push({ bufferView: add(col, 34962), componentType: 5121, normalized: true, count: nv, type: 'VEC4' }); attrs.COLOR_0 = 2; }
  accessors.push({ bufferView: add(tris, 34963), componentType: 5125, count: tris.length, type: 'SCALAR' });
  const json = { asset: { version: '2.0', generator: 'triposr.mjs (onnxruntime-node)' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: attrs, indices: accessors.length - 1, mode: 4, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 }, doubleSided: false }],
    buffers: [{ byteLength: off }], bufferViews: views, accessors };
  let jb = Buffer.from(JSON.stringify(json)); jb = Buffer.concat([jb, Buffer.alloc(pad4(jb.length) - jb.length, 0x20)]);
  const bin = Buffer.concat(parts);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jb.length + 8 + bin.length, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  fs.writeFileSync(file, Buffer.concat([head, ch(jb.length, 0x4e4f534a), jb, ch(bin.length, 0x004e4942), bin]));
}

const epList = ep => ep === 'coreml' ? [{ name: 'coreml' }, 'cpu'] : ep === 'coreml-mlprogram' ? [{ name: 'coreml', modelFormat: 'MLProgram', computeUnits: 'ALL' }, 'cpu'] : ep === 'webgpu' ? ['webgpu', 'cpu'] : ['cpu'];

// ---- run
const image = preprocess(IMG); lap('preprocess');
const enc = await ort.InferenceSession.create(path.join(MODELS, 'triplane.onnx'), { executionProviders: epList(ENC), graphOptimizationLevel: 'all' });
const dec = await ort.InferenceSession.create(path.join(MODELS, 'nerf.onnx'), { executionProviders: epList(DEC), graphOptimizationLevel: 'all' });
lap('modelLoad');
const encOut = await enc.run({ image: new ort.Tensor('float32', image, [1, 3, 512, 512]) });
const triplane = encOut.triplane ?? encOut[enc.outputNames[0]];
lap('encoder');
await enc.release?.();
sample();

const N = RES, total = N * N * N;
const dens = new Float32Array(total);
const lin = i => -RADIUS + (2 * RADIUS * i) / (N - 1); // linspace(0,1,N) scaled to (-r,r)
let dmin = Infinity, dmax = -Infinity;
for (let s = 0; s < total; s += CHUNK) {
  const n = Math.min(CHUNK, total - s), xyz = new Float32Array(n * 3);
  for (let p = 0; p < n; p++) { const q = s + p, k = q % N, j = Math.floor(q / N) % N, i = Math.floor(q / (N * N)); xyz[p * 3] = lin(i); xyz[p * 3 + 1] = lin(j); xyz[p * 3 + 2] = lin(k); }
  const o = await dec.run({ triplane, xyz: new ort.Tensor('float32', xyz, [n, 3]) });
  const d = o.density.data;
  for (let p = 0; p < n; p++) { const v = d[p]; dens[s + p] = v; if (v < dmin) dmin = v; if (v > dmax) dmax = v; }
  sample();
}
lap('decoderGrid');

const f = new Float32Array(total); let inside = 0;
for (let q = 0; q < total; q++) { f[q] = dens[q] - THRESH; if (f[q] > 0) inside++; }
const mc = marchingCubes(f, N);
lap('marchingCubes');

// grid index -> (-r,r), then TripoSR's gradio orientation (Rx -90 then Ry +90): (x,y,z) -> (-y, z, -x)
const nv = mc.pos.length / 3, world = new Float32Array(nv * 3);
for (let v = 0; v < nv; v++) for (let c = 0; c < 3; c++) world[v * 3 + c] = lin(0) + (mc.pos[v * 3 + c] / (N - 1)) * 2 * RADIUS;
let stats = analyse(world, mc.tris);
if (stats.volume < 0) { for (let t = 0; t < mc.tris.length; t += 3) { const a = mc.tris[t + 1]; mc.tris[t + 1] = mc.tris[t + 2]; mc.tris[t + 2] = a; } stats.volume = -stats.volume; stats.flipped = true; }
lap('analyse');

let col = null, colorRange = null;
if (COLOR && nv) {
  col = new Uint8Array(nv * 4); let cmin = Infinity, cmax = -Infinity;
  for (let s = 0; s < nv; s += CHUNK) {
    const n = Math.min(CHUNK, nv - s);
    const o = await dec.run({ triplane, xyz: new ort.Tensor('float32', world.subarray(s * 3, (s + n) * 3), [n, 3]) });
    const c = o.color.data, w = o.color.dims[1];
    for (let p = 0; p < n; p++) { for (let k = 0; k < 3; k++) { const v = c[p * w + k]; cmin = Math.min(cmin, v); cmax = Math.max(cmax, v); col[(s + p) * 4 + k] = Math.max(0, Math.min(255, Math.round(v * 255))); } col[(s + p) * 4 + 3] = 255; }
  }
  colorRange = [cmin, cmax];
}
lap('vertexColor');

const out = new Float32Array(nv * 3);
for (let v = 0; v < nv; v++) { const x = world[v * 3], y = world[v * 3 + 1], z = world[v * 3 + 2]; out[v * 3] = -y; out[v * 3 + 1] = z; out[v * 3 + 2] = -x; }
const nrm = new Float32Array(nv * 3);
for (let t = 0; t < mc.tris.length; t += 3) {
  const a = mc.tris[t] * 3, b = mc.tris[t + 1] * 3, c = mc.tris[t + 2] * 3;
  const ux = out[b] - out[a], uy = out[b + 1] - out[a + 1], uz = out[b + 2] - out[a + 2], vx = out[c] - out[a], vy = out[c + 1] - out[a + 1], vz = out[c + 2] - out[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  for (const i of [a, b, c]) { nrm[i] += nx; nrm[i + 1] += ny; nrm[i + 2] += nz; }
}
for (let v = 0; v < nv; v++) { const l = Math.hypot(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]) || 1; nrm[v * 3] /= l; nrm[v * 3 + 1] /= l; nrm[v * 3 + 2] /= l; }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
writeGLB(OUT, out, nrm, col, mc.tris);
lap('writeGLB');
clearInterval(sampler); sample();

const r = {
  image: path.basename(IMG), res: N, enc: ENC, dec: DEC, threshold: THRESH,
  seconds: { ...Object.fromEntries(Object.entries(T).map(([k, v]) => [k, +v.toFixed(3)])), total: +((performance.now() - tStart) / 1000).toFixed(3) },
  peakRssMB: Math.round(peakRss / 2 ** 20), densityRange: [dmin, dmax], insideVoxels: inside,
  triplaneDims: triplane.dims, vertices: nv, triangles: mc.tris.length / 3, glbBytes: fs.statSync(OUT).size, out: OUT,
  colorRange, mesh: { ...stats, extentPreOrientation: stats.max.map((m, i) => +(m - stats.min[i]).toFixed(3)) },
};
console.log(JSON.stringify(r));
fs.appendFileSync('results.jsonl', JSON.stringify(r) + '\n');
