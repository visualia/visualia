// Rewrites every Split node with more than 8 outputs into one Slice per output, so that onnxruntime's WebGPU
// backend can run the graph (a Split with 11 outputs needs 11 storage buffers; the M1 allows 10, browsers often 8).
// usage: node patch-split.mjs rmbg/birefnet_lite.onnx rmbg/birefnet_lite_webgpu.onnx   (needs: npm i onnx-proto)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { onnx } = createRequire(import.meta.url)('onnx-proto');
const [IN, OUT, MAX = '8'] = process.argv.slice(2);
const m = onnx.ModelProto.decode(fs.readFileSync(IN));
const g = m.graph, consts = new Map();
for (const n of g.node) if (n.opType === 'Constant') consts.set(n.output[0], n.attribute.find(a => a.name === 'value').t);
for (const t of g.initializer) consts.set(t.name, t);
const num = x => typeof x === 'object' && x !== null ? x.toNumber() : Number(x);
const ints = t => t.int64Data?.length ? t.int64Data.map(num) : [...new BigInt64Array(Uint8Array.from(t.rawData).buffer)].map(Number);
const i64 = (name, vals) => onnx.TensorProto.create({ name, dataType: 7, dims: [vals.length], int64Data: vals });
const out = []; let patched = 0;
for (const n of g.node) {
  if (n.opType !== 'Split' || n.output.length <= +MAX) { out.push(n); continue; }
  const axis = num(n.attribute.find(a => a.name === 'axis')?.i ?? 0);
  const sizes = ints(consts.get(n.input[1]));
  let start = 0;
  n.output.forEach((o, k) => {
    const p = `${n.name}/slice${k}`;
    g.initializer.push(i64(p + '/s', [start]), i64(p + '/e', [start + sizes[k]]), i64(p + '/a', [axis]));
    out.push(onnx.NodeProto.create({ name: p, opType: 'Slice', input: [n.input[0], p + '/s', p + '/e', p + '/a'], output: [o] }));
    start += sizes[k];
  });
  patched++;
}
g.node = out;
fs.writeFileSync(OUT, onnx.ModelProto.encode(m).finish());
console.log(JSON.stringify({ patched, nodes: out.length, bytes: fs.statSync(OUT).size }));
