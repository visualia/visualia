// triposplat.mjs's PLY to the 32-byte .splat (antimatter15's layout, which Spark and most viewers read):
// x y z (f32), scale x y z (f32, linear), r g b a (u8), quaternion w x y z (u8, q * 128 + 128).
// Keeps the order: TripoSplat writes its splats in Morton order of their anchors, which pairs splat i of one
// object with splat i of another for a morph (research/splat-morph.md). No sorting by size.
//   node splat.mjs in.ply out.splat
import { readFileSync, writeFileSync } from 'node:fs';

const [src, out] = process.argv.slice(2);
const buf = readFileSync(src);
const end = buf.indexOf('end_header\n') + 'end_header\n'.length;
const head = buf.subarray(0, end).toString();
const n = +head.match(/element vertex (\d+)/)[1];
const props = [...head.matchAll(/property float (\w+)/g)].map((m) => m[1]);
const P = Object.fromEntries(props.map((p, i) => [p, i]));
const f = new Float32Array(buf.buffer.slice(buf.byteOffset + end, buf.byteOffset + end + n * props.length * 4));
const o = Buffer.alloc(n * 32), SH_C0 = 0.28209479177387814;
const u8 = (x) => Math.max(0, Math.min(255, Math.round(x)));
for (let i = 0; i < n; i++) {
  const r = (k) => f[i * props.length + P[k]], b = i * 32;
  o.writeFloatLE(r('x'), b); o.writeFloatLE(r('y'), b + 4); o.writeFloatLE(r('z'), b + 8);
  for (let d = 0; d < 3; d++) o.writeFloatLE(Math.exp(r(`scale_${d}`)), b + 12 + 4 * d);
  for (let d = 0; d < 3; d++) o[b + 24 + d] = u8((0.5 + SH_C0 * r(`f_dc_${d}`)) * 255);
  o[b + 27] = u8(255 / (1 + Math.exp(-r('opacity'))));
  const q = [0, 1, 2, 3].map((d) => r(`rot_${d}`)), l = Math.hypot(...q) || 1;
  for (let d = 0; d < 4; d++) o[b + 28 + d] = u8((q[d] / l) * 128 + 128);
}
writeFileSync(out, o);
console.log(JSON.stringify({ out, splats: n, bytes: o.length }));
