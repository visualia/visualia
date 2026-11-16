// Runs one exported TripoSplat graph (export.py) in onnxruntime-node and
// compares it with VAST's fp32 answer kept in refs/<part>.npz.
//   node check.mjs <part> [webgpu|cpu] [runs]
// onnxruntime-node comes from beside TripoSR's script (NODE_ORT, default
// ~/triposr-onnx/node_modules/onnxruntime-node).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const require = createRequire(import.meta.url);
const ort = require(process.env.NODE_ORT ?? `${homedir()}/triposr-onnx/node_modules/onnxruntime-node`);
const [part, ep = 'webgpu', runs = '2'] = process.argv.slice(2);

// np.savez writes an uncompressed zip of .npy files.
export function npz(path) {
  const buf = readFileSync(path), out = {};
  for (let i = 0; i + 30 < buf.length && buf.readUInt32LE(i) === 0x04034b50;) {
    let size = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26), extraLen = buf.readUInt16LE(i + 28);
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString().replace(/\.npy$/, '');
    const start = i + 30 + nameLen + extraLen;
    if (size === 0xffffffff) size = Number(buf.readBigUInt64LE(i + 30 + nameLen + 4 + 8)); // zip64 extra: sizes
    const npy = buf.subarray(start, start + size);
    const hlen = npy.readUInt16LE(8), header = npy.subarray(10, 10 + hlen).toString();
    const shape = header.match(/'shape': \(([^)]*)\)/)[1].split(',').filter((s) => s.trim()).map(Number);
    const type = header.match(/'descr': '([^']+)'/)[1];
    const data = npy.subarray(10 + hlen);
    const copy = (T) => new T(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    out[name] = { shape, type, data: type === '<f4' ? copy(Float32Array) : type === '<i8' ? copy(BigInt64Array) : null };
    i = start + size;
  }
  return out;
}

if (import.meta.url !== `file://${process.argv[1]}`) { /* imported for npz() */ } else {
const ref = npz(`refs/${part}.npz`);
const t0 = performance.now();
const session = await ort.InferenceSession.create(`onnx/${part}.onnx`, { executionProviders: [ep], graphOptimizationLevel: 'all' });
console.log(JSON.stringify({ part, ep, load_s: +((performance.now() - t0) / 1000).toFixed(1) }));
const feeds = {};
for (const name of session.inputNames) {
  const r = ref[name];
  feeds[name] = new ort.Tensor(r.type === '<i8' ? 'int64' : 'float32', r.data, r.shape);
}
for (let run = 0; run < Number(runs); run++) {
  const t = performance.now();
  const got = await session.run(feeds);
  const s = (performance.now() - t) / 1000;
  const errs = session.outputNames.map((o) => {
    const a = got[o].data, b = ref[`want_${o}`].data;
    let max = 0, sum = 0, top = 0, nan = 0;
    for (let i = 0; i < b.length; i++) {
      if (Number.isNaN(a[i])) { nan++; continue; }
      const e = Math.abs(a[i] - b[i]); max = Math.max(max, e); sum += e; top = Math.max(top, Math.abs(b[i]));
    }
    return { o, max: +max.toPrecision(4), mean: +(sum / b.length).toPrecision(4), of: +top.toPrecision(4), nan };
  });
  console.log(JSON.stringify({ run, s: +s.toFixed(2), errs }));
}
}
