// Software render of a GLB from triposr.mjs to PNG: four views (front, right, back, 3/4) side by side.
// usage: node render.mjs in.glb out.png [size]
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { PNG } = createRequire(import.meta.url)('pngjs');
const [IN, OUT, SZ = '320'] = process.argv.slice(2);
const S = +SZ;
const b = fs.readFileSync(IN);
const jl = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + jl).toString());
const bin = b.subarray(20 + jl + 8);
const acc = i => { const a = json.accessors[i], v = json.bufferViews[a.bufferView]; const n = a.count * ({ VEC3: 3, VEC4: 4, SCALAR: 1 })[a.type];
  const C = { 5126: Float32Array, 5125: Uint32Array, 5121: Uint8Array }[a.componentType]; return new C(bin.buffer.slice(bin.byteOffset + v.byteOffset, bin.byteOffset + v.byteOffset + n * C.BYTES_PER_ELEMENT)); };
const prim = json.meshes[0].primitives[0];
const P = acc(prim.attributes.POSITION), I = acc(prim.indices), C = prim.attributes.COLOR_0 != null ? acc(prim.attributes.COLOR_0) : null;
const views = [0, 90, 180, 45].map(d => d * Math.PI / 180);
const W = S * views.length, img = new PNG({ width: W, height: S });
for (let i = 0; i < W * S; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 40; img.data[i * 4 + 3] = 255; }
const zb = new Float32Array(W * S).fill(-Infinity);
const L = [0.4, 0.6, 0.7], ll = Math.hypot(...L); L.forEach((v, i) => L[i] = v / ll);
views.forEach((ang, vi) => {
  const ca = Math.cos(ang), sa = Math.sin(ang), scale = S * 0.55, ox = vi * S + S / 2, oy = S / 2;
  const tx = new Float32Array(P.length);
  for (let v = 0; v < P.length / 3; v++) { const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    const rx = x * ca + z * sa, rz = -x * sa + z * ca; tx[v * 3] = ox + rx * scale; tx[v * 3 + 1] = oy - y * scale; tx[v * 3 + 2] = rz; }
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], bb = I[t + 1], c = I[t + 2];
    const ax = tx[a * 3], ay = tx[a * 3 + 1], bx = tx[bb * 3], by = tx[bb * 3 + 1], cx = tx[c * 3], cy = tx[c * 3 + 1];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (area === 0) continue;
    // face normal in view space for shading
    const ux = tx[bb * 3] - ax, uy = -(by - ay), uz = tx[bb * 3 + 2] - tx[a * 3 + 2], wx = cx - ax, wy = -(cy - ay), wz = tx[c * 3 + 2] - tx[a * 3 + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const sh = 0.25 + 0.75 * Math.abs(nx * L[0] + ny * L[1] + nz * L[2]);
    const x0 = Math.max(vi * S, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(vi * S + S - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(S - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area, w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * tx[a * 3 + 2] + w1 * tx[bb * 3 + 2] + w2 * tx[c * 3 + 2], pi = y * W + x;
      if (z <= zb[pi]) continue; zb[pi] = z;
      for (let k = 0; k < 3; k++) { const col = C ? (w0 * C[a * 4 + k] + w1 * C[bb * 4 + k] + w2 * C[c * 4 + k]) : 200; img.data[pi * 4 + k] = Math.min(255, col * sh); }
    }
  }
});
fs.writeFileSync(OUT, PNG.sync.write(img));
