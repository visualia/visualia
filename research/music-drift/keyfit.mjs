// Puts clips in one key (asked 2026-11-19: "tune songs to key", for the AI Estonia map's stacked layers).
//   node research/music-drift/keyfit.mjs <base> <clip> [<clip> ...]      ids under out/, without .mp3
// Each clip's key is estimated (a chroma profile over the whole clip, correlated with Krumhansl–Kessler's 24 major and
// minor profiles); the others are pitch-shifted, the tempo kept (ffmpeg asetrate + atempo), by the fewest semitones
// (at most 6, up or down) that bring their scale onto the base's (a minor key counts as its relative major).
// Writes out/keyed/<id>.mp3 and out/keyed/keys.json. Research use only: out/ is not in git.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const [base, ...rest] = process.argv.slice(2);
if (!base || !rest.length) throw new Error('node keyfit.mjs <base> <clip> ...');
const SR = 22050, N = 8192;
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function pcm(id) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', `${OUT}${id}.mp3`, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}
// a plain radix-2 FFT, magnitudes
function mags(x) {
  const n = x.length, re = Float64Array.from(x), im = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) {
      const c = Math.cos(a * k), s = Math.sin(a * k), ur = re[i + k], ui = im[i + k];
      const vr = re[i + k + len / 2] * c - im[i + k + len / 2] * s, vi = re[i + k + len / 2] * s + im[i + k + len / 2] * c;
      re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
    }
  }
  const m = new Float64Array(n / 2); for (let i = 0; i < n / 2; i++) m[i] = Math.hypot(re[i], im[i]); return m;
}
function chroma(x) {
  const c = new Float64Array(12), win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  for (let o = 0; o + N <= x.length; o += N / 2) {
    const m = mags(Array.from({ length: N }, (_, i) => x[o + i] * win[i]));
    for (let k = 1; k < N / 2; k++) {
      const f = k * SR / N; if (f < 55 || f > 2000) continue;
      const pc = ((Math.round(12 * Math.log2(f / 440)) % 12) + 12 + 9) % 12;   // A = 9
      c[pc] += m[k];
    }
  }
  return c;
}
const corr = (a, b) => { const ma = a.reduce((s, v) => s + v) / 12, mb = b.reduce((s, v) => s + v) / 12; let n = 0, da = 0, db = 0;
  for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return n / Math.sqrt(da * db); };
function keyOf(id) {
  const c = chroma(pcm(id)); let best = null;
  for (let t = 0; t < 12; t++) for (const [mode, prof] of [['major', MAJ], ['minor', MIN]]) {
    const r = corr(c, prof.map((_, i) => prof[(i - t + 12) % 12]));
    if (!best || r > best.r) best = { tonic: t, mode, r };
  }
  return { ...best, name: `${NAMES[best.tonic]} ${best.mode}`, major: best.mode === 'major' ? best.tonic : (best.tonic + 3) % 12 };
}
mkdirSync(`${OUT}keyed/`, { recursive: true });
const kb = keyOf(base), result = { base: { id: base, ...kb }, clips: [] };
console.log(`base ${base}: ${kb.name} (r ${kb.r.toFixed(2)})`);
for (const id of rest) {
  const k = keyOf(id);
  let shift = ((kb.major - k.major) % 12 + 12) % 12; if (shift > 6) shift -= 12;
  const ratio = 2 ** (shift / 12), file = `${OUT}keyed/${id.replace(/\//g, '__')}.mp3`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${OUT}${id}.mp3`, '-af', `asetrate=44100*${ratio},aresample=44100,atempo=${1 / ratio}`, '-b:a', '192k', file]);
  result.clips.push({ id, ...k, shift, file: file.replace(OUT, '') });
  console.log(`${id}: ${k.name} (r ${k.r.toFixed(2)}) → shifted ${shift > 0 ? '+' : ''}${shift} semitones`);
}
writeFileSync(`${OUT}keyed/keys.json`, JSON.stringify(result, null, 1));
