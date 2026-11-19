// BirdNET v2.4 (Cornell Lab + TU Chemnitz, model CC BY-NC-SA 4.0) on audio files, no Python:
// tphakala's ONNX build of the model + onnxruntime-web's WebAssembly backend in Node, ffmpeg to decode.
// Setup (about 47 MB, kept outside git in ~/visualia-local/birdnet/):
//   jsdelivr onnxruntime-web@1.31.1/dist/{ort.node.min.mjs, ort-wasm-simd-threaded.mjs, ort-wasm-simd-threaded.wasm}
//   huggingface tphakala/BirdNET-v2.4/{BirdNET_v2.4_int8_arm_foldconv.onnx, labels.txt, LICENSE}
// Usage: node research/music-drift/birdnet.mjs file.mp3 [...]  → prints JSON: per file, per species, max confidence and seconds.
// NORM=1 loudness-normalises first (the generated clips are quiet, −33 to −60 dB mean).
// 3 s windows, 1.5 s hop, sigmoid of the logits, no location filter (we want to see what is not Estonian).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename } from "node:path";

const DIR = process.env.BIRDNET_DIR ?? `${homedir()}/visualia-local/birdnet`;
const MIN = Number(process.env.MIN_CONF ?? 0.25);
const ort = await import(`${DIR}/ort.node.min.mjs`);
ort.env.wasm.numThreads = 1;
const labels = readFileSync(`${DIR}/labels.txt`, "utf8").trim().split("\n");
const session = await ort.InferenceSession.create(readFileSync(`${DIR}/BirdNET_v2.4_int8_arm_foldconv.onnx`));

function decode(file) {
  const norm = process.env.NORM ? ["-af", "loudnorm=I=-23"] : [];
  const buf = execFileSync("ffmpeg", ["-v", "quiet", "-i", file, ...norm, "-ac", "1", "-ar", "48000", "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

const out = {};
for (const file of process.argv.slice(2)) {
  const pcm = decode(file);
  const W = 144000, HOP = 72000;
  const species = {};
  for (let start = 0; start + W / 2 <= pcm.length; start += HOP) {
    const win = new Float32Array(W);
    win.set(pcm.subarray(start, Math.min(start + W, pcm.length)));
    const res = await session.run({ input: new ort.Tensor("float32", win, [1, W]) });
    const logits = res.output.data;
    for (let i = 0; i < logits.length; i++) {
      const p = 1 / (1 + Math.exp(-logits[i]));
      if (p < MIN) continue;
      const [sci, common] = labels[i].split("_");
      const s = (species[sci] ??= { common, max: 0, at: [] });
      s.max = Math.max(s.max, +p.toFixed(3));
      s.at.push(+(start / 48000).toFixed(1));
    }
  }
  out[basename(file)] = Object.fromEntries(Object.entries(species).sort((a, b) => b[1].max - a[1].max));
}
console.log(JSON.stringify(out, null, 1));
