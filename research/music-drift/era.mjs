// The era ladder for music (2026-11-17): the same prompts as the 2026 ElevenLabs clips, through an
// older model, on this Mac, no cloud. Like the picture era ladder in evals/estonian-visuals/out/era/.
// Usage:
//   node research/music-drift/era.mjs [id ...]        make the clips (skips ones that exist); anthem-2 = a second take
//   SECONDS=2 node research/music-drift/era.mjs smoke  a 2 s test clip, out/era/<model>/smoke.*
//   node research/music-drift/era.mjs report          loudness per clip, the table for the README
// Writes out/era/<model>/<id>.wav, .mp3, .json (seconds, energy) and copies them to
// ~/visualia-local/music-drift/era/<model>/ (kept, never clean up).
// Model: MusicGen small (Meta, 2023, weights CC BY-NC 4.0), Xenova/musicgen-small as ONNX, run by
// transformers.js from evals/estonian-visuals/neighbours/ (onnxruntime-web as WebAssembly on the CPU:
// onnxruntime-node's binary is refused on this machine). Instrumental only; it cannot sing.
// Weights (~600 MB) are cached in ~/visualia-local/hf-js/.
// Energy the way the pool measures it: macmon, 4 samples a second; chip = CPU + GPU + ANE + memory,
// net = minus the idle baseline. Waits under 72 °C before a clip; pauses generation while at 78 °C or above; stops when the last 2 s average above 85 °C
// (single samples spike higher: peak_c in the JSON is the highest single sample). THREADS=3 by default.
// Sampling is random (transformers.js has no seed), so a re-run gives a different clip.
// Research use only: out/ is not in git.

import { writeFileSync, mkdirSync, existsSync, copyFileSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const NEIGHBOURS = here('../../evals/estonian-visuals/neighbours/');
const KEEP = `${homedir()}/visualia-local/music-drift/era/`;
const MACHINE = 'M2 Pro, 32 GB (work Mac)';
const SECS = Number(process.env.SECONDS ?? 20);
const THREADS = Number(process.env.THREADS ?? 3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r1 = (x) => Math.round(x * 10) / 10;
const PAUSE = new Int32Array(new SharedArrayBuffer(4));

const MODELS = {
  'musicgen-small': {
    id: 'Xenova/musicgen-small',
    year: 2023,
    // q8 decoder and text encoder; the audio decoder in fp32 (as the transformers.js example does).
    dtype: { text_encoder: 'q8', decoder_model_merged: 'q8', encodec_decode: 'fp32' },
    how: `MusicGen small (300M), transformers.js 4.3.2, onnxruntime-web WASM on the CPU, ${THREADS} threads, q8, guidance 3, sampled, no seed`,
  },
};

// Each prompt is the 2026 clip's text, word for word, minus what MusicGen cannot do (lyrics, a voice).
// `pair` is the 2026 clip it is played against (relative to out/).
const ANTHEM = 'The Estonian national anthem, sung by a mixed choir in Estonian.';
const PROMPTS = {
  anthem: { text: ANTHEM, pair: 'el-anthem-1.mp3', from: 'run.mjs el-anthem-1, same words' },
  ernesaks: { text: `Gustav Ernesaks's "Mu isamaa on minu arm", sung by a large Estonian mixed choir at the song festival, in Estonian.`, pair: 'el-ernesaks-1.mp3', from: 'run.mjs el-ernesaks-1, lyrics left out' },
  regilaul: { text: 'Estonian regilaul (runosong): a lead woman singer sings each line and a group of women repeats it, call and response, in Estonian.', pair: 'el-regilaul-1.mp3', from: 'run.mjs el-regilaul-1, same words' },
  'part-desc': { text: 'Slow Estonian sacred minimalism for piano and strings: a stepwise melody over bell-like tonic triads, silence between phrases.', pair: 'el-part-desc.mp3', from: 'run.mjs el-part-desc, same words (instrumental there too)' },
  nipernaadi: { text: 'A 1983 Estonian film song: acoustic guitar and a soft accordion, an unhurried walking tempo, a summer road in the countryside.', pair: 'films/room-nipernaadi.mp3', from: 'films.mjs STYLE.nipernaadi without the voice and the diction' },
  bog: { text: 'Field recording, no music, no instruments, no melody, only natural ambient sound recorded with a stereo microphone: spring dawn on an Estonian raised bog (Viru raba), cranes calling, black grouse lekking, a curlew, wind over the bog.', pair: 'nature/bog-ee.mp3', from: 'nature.mjs bog-ee, same words' },
  bed: { text: 'Calm relaxing ambient background music, piano and soft strings, A minor, 75 BPM.', pair: 'finale/fin-bed.mp3', from: 'finale.mjs fin-bed, same words: the probable, on purpose' },
  // The five films (asked 2026-11-18: "add meta sound model instrumentals for each movie, use as first one"): films.mjs
  // STYLE without the voice, the choir and the diction (MusicGen cannot sing); the Alpinist's text as it is.
  'film-nipernaadi': { text: 'A 1983 Estonian film song: acoustic guitar and a soft accordion, an unhurried walking tempo, a summer road in the countryside.', pair: 'films/room-nipernaadi.mp3', from: 'films.mjs STYLE.nipernaadi without the voice and the diction' },
  'film-nukitsamees': { text: "A 1981 Estonian children's musical film song: playful, kannel (Estonian zither), fiddle and accordion, a bouncy folk-dance beat.", pair: 'films/room-nukitsamees.mp3', from: 'films.mjs STYLE.nukitsamees without the voices and the diction' },
  'film-kevade': { text: 'A 1969 Estonian film song: light strings and a flute, tender and bright, spring by a river.', pair: 'films/room-kevade.mp3', from: "films.mjs STYLE.kevade without the boys' choir and the diction" },
  'film-reliikvia': { text: 'A 1969 Estonian adventure film song: a galloping rhythm, strings and brass.', pair: 'films/room-reliikvia.mp3', from: 'films.mjs STYLE.reliikvia without the baritone, the male choir and the diction' },
  // The national songs (asked 2026-11-18: "national songs from 2023 models too?"): national.mjs's styles without the
  // voices, the choir, the words and the diction (MusicGen cannot sing); pair = the ElevenLabs clip.
  'nat-isamaa-armas': { text: 'A simple 19th-century Estonian patriotic song in an old German folk-song style: a small brass band, gentle and steady.', pair: 'national/nat-isamaa-armas.mp3', from: 'national.mjs nat-isamaa-armas without the choir, the words and the diction' },
  'nat-kungla': { text: 'An Estonian national-awakening song from the 1870s: bright and festive, a swinging folk-like dance lilt, the refrain repeated with joy.', pair: 'national/nat-kungla.mp3', from: 'national.mjs nat-kungla without the choir, the crowd, the words and the diction' },
  'nat-mesipuu': { text: 'A modern Estonian song-festival anthem: a symphonic wind band, broad and slowly rising, moderate tempo, the last line held and swelling.', pair: 'national/nat-mesipuu.mp3', from: 'national.mjs nat-mesipuu without the massed choir, the words and the diction' },
  'nat-randaja': { text: 'An intimate Estonian art song of the late 1970s: an acoustic guitar and soft strings, slow and wistful, a wanderer walking a dusty country road at dusk.', pair: 'national/nat-randaja.mp3', from: "national.mjs nat-randaja without the woman's voice, the words and the diction" },
  'nat-sind-surmani': { text: 'An Estonian choral song from the first song festival, 1869: solemn and warm, a slow hymn-like tempo, 19th-century romantic part-song harmony, outdoors.', pair: 'national/nat-sind-surmani.mp3', from: "national.mjs nat-sind-surmani without the men's choir, a cappella, the words and the diction" },
  // Ernesaks without the choir (asked 2026-11-18: "gen more ernesaks, these are unlistenable": the prompt above asks for
  // a choir, which MusicGen cannot make, and gives a mush of voice-like noise): the song's mood and setting, instruments
  // only, the way the national songs were asked
  'ernesaks-instr': { text: 'A solemn Estonian song-festival hymn from 1944: slow and broad, warm romantic harmony, a symphonic wind band and strings, rising and swelling at the end.', pair: 'el-ernesaks-1.mp3', from: 'run.mjs el-ernesaks-1 without the choir, the words and the diction' },
  'film-alpinist': { text: 'A 1979 Estonian science-fiction film score: cold analog synthesizers, a slow pulsing bass, wind and snow, a lonely mountain hotel at night, mysterious and calm. Instrumental.', pair: 'films/room-alpinist.mp3', from: 'films.mjs ALPINIST, same words' },
};

// ---- the meter: macmon, 4 samples a second, in its own process ----
// generate() keeps Node's main thread busy (WASM), so a meter in this process reads its samples late
// and in bursts. A small child process logs them (with macmon's own timestamps) to a file and holds the
// heat guard: when the last 2 s (8 samples) average above 85 °C it kills this process, mid-clip if need be.

const METER_LOG = here('./out/era/meter.jsonl');
const METER = `
const { spawn } = require('node:child_process'); const fs = require('node:fs');
const [log, parent] = process.argv.slice(1); fs.writeFileSync(log, '');
const p = spawn('macmon', ['pipe', '-i', '250'], { stdio: ['ignore', 'pipe', 'ignore'] });
const cs = []; let buf = '';
p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1);
  try { const s = JSON.parse(l); const c = Math.max(s.temp?.cpu_temp_avg ?? 0, s.temp?.gpu_temp_avg ?? 0);
    fs.appendFileSync(log, JSON.stringify({ t: Date.parse(s.timestamp), chip: s.all_power, sys: s.sys_power, c }) + '\\n');
    cs.push(c); if (cs.length > 8) cs.shift();
    if (cs.length === 8 && cs.reduce((a, b) => a + b, 0) / 8 > 85) { console.error('above 85 °C for 2 s: stopping'); try { process.kill(+parent, 'SIGTERM'); } catch {} p.kill(); process.exit(2); }
  } catch {} } });
setInterval(() => { try { process.kill(+parent, 0); } catch { p.kill(); process.exit(0); } }, 2000);
`;

function meter() {
  mkdirSync(here('./out/era/'), { recursive: true });
  const p = spawn(process.execPath, ['-e', METER, METER_LOG, String(process.pid)], { stdio: ['ignore', 'ignore', 'inherit'] });
  const samples = () => (existsSync(METER_LOG) ? readFileSync(METER_LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  const between = (t0, t1) => samples().filter((s) => s.t > t0 && s.t <= t1);
  return {
    stop: () => p.kill(),
    temp: () => samples().at(-1)?.c ?? 0,
    // Median chip watts over `ms` while nothing of ours runs: the idle baseline.
    idle: async (ms = 8000) => { const t0 = Date.now(); await sleep(ms); const w = between(t0, Date.now()).map((s) => s.chip).sort((a, b) => a - b); return w[w.length >> 1] ?? 0; },
    energy: (t0, t1, idleW) => {
      const xs = between(t0, t1);
      if (!xs.length) return null;
      const secs = (t1 - t0) / 1000, dt = secs / xs.length; // spread over the job, in case a sample was missed
      const chip = xs.reduce((a, s) => a + s.chip * dt, 0), sys = xs.reduce((a, s) => a + s.sys * dt, 0);
      return { energy_j: r1(chip), energy_net_j: r1(Math.max(0, chip - idleW * secs)), sys_energy_j: r1(sys), mean_chip_w: r1(chip / secs), samples: xs.length,
        energy_source: 'macmon', peak_c: r1(Math.max(...xs.map((s) => s.c))) };
    },
  };
}

async function cool(m) {
  for (let k = 0; m.temp() >= 72; k++) {
    if (k > 60) throw new Error(`still ${m.temp().toFixed(0)} °C after 5 minutes: stopping`);
    await sleep(5000);
  }
}

// ---- transformers.js, borrowed from ../../evals/estonian-visuals/neighbours/ ----

async function transformers() {
  const require = createRequire(`${NEIGHBOURS}package.json`);
  const T = await import(pathToFileURL(require.resolve('@huggingface/transformers')).href);
  T.env.cacheDir = `${homedir()}/visualia-local/hf-js/`;
  T.env.useWasmCache = false;
  const ortDir = require.resolve('onnxruntime-node', { paths: [`${NEIGHBOURS}node_modules/@huggingface/transformers/`] });
  T.env.backends.onnx.wasm.wasmPaths = pathToFileURL(ortDir.replace(/dist\/.*$/, 'dist/')).href;
  T.env.backends.onnx.wasm.numThreads = THREADS;
  return T;
}

// 16-bit PCM mono WAV.
function wav(samples, rate) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return b;
}

async function make(name, ids) {
  const M = MODELS[name];
  const dir = here(`./out/era/${name}/`), keep = `${KEEP}${name}/`;
  mkdirSync(dir, { recursive: true }); mkdirSync(keep, { recursive: true });
  const T = await transformers();
  const m = meter();
  await sleep(1500);
  const idleW = await m.idle();
  console.log(`${name}: idle chip ${idleW.toFixed(1)} W, ${m.temp().toFixed(0)} °C`);
  try {
    let t0 = Date.now();
    const tokenizer = await T.AutoTokenizer.from_pretrained(M.id);
    const model = await T.MusicgenForConditionalGeneration.from_pretrained(M.id, { dtype: M.dtype });
    const load = { seconds: r1((Date.now() - t0) / 1000), ...m.energy(t0, Date.now(), idleW) };
    console.log(`loaded in ${load.seconds} s`);
    const rate = model.config.audio_encoder.sampling_rate;
    for (const id of ids) {
      // `<id>-2` is a second take of `<id>`.
      const p = id === 'smoke' ? { text: PROMPTS.bed.text, pair: null, from: 'smoke test' } : PROMPTS[id] ?? PROMPTS[id.replace(/-\d+$/, '')];
      if (!p) throw new Error(`unknown id ${id}: ${Object.keys(PROMPTS).join(' ')}`);
      if (id !== 'smoke' && existsSync(`${dir}${id}.wav`)) continue;
      await cool(m);
      const secs = id === 'smoke' ? Number(process.env.SECONDS ?? 2) : SECS;
      t0 = Date.now();
      // Throttle: every 5 steps, while the CPU is at 78 °C or above, the thread sleeps (Atomics.wait:
      // generate() cannot be awaited mid-way). Paused seconds count in `seconds` and are also given apart.
      let steps = 0, paused = 0;
      const streamer = { put() {
        if (++steps % 5) return;
        for (let k = 0; m.temp() >= 78 && k < 300; k++) { Atomics.wait(PAUSE, 0, 0, 1000); paused += 1; }
      }, end() {} };
      const out = await model.generate({ ...tokenizer(p.text), max_new_tokens: Math.round(secs * 50), do_sample: true, guidance_scale: 3, streamer });
      const t1 = Date.now();
      await sleep(400);
      const e = m.energy(t0, t1, idleW);
      writeFileSync(`${dir}${id}.wav`, wav(out.data, rate));
      execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-loglevel', 'error', '-i', `${dir}${id}.wav`, '-b:a', '160k', `${dir}${id}.mp3`]);
      const row = { model: name, model_id: M.id, year: M.year, id, prompt: p.text, from: p.from, pair: p.pair, audio_seconds: r1(out.data.length / rate), sample_rate: rate,
        seconds: r1((t1 - t0) / 1000), paused_s: paused, ...e, idle_w: r1(idleW), load, where: MACHINE, how: M.how };
      writeFileSync(`${dir}${id}.json`, JSON.stringify(row, null, 2));
      for (const ext of ['wav', 'mp3', 'json']) copyFileSync(`${dir}${id}.${ext}`, `${keep}${id}.${ext}`);
      console.log(`${id}: ${row.audio_seconds} s of audio in ${row.seconds} s, ${e?.energy_j} J (net ${e?.energy_net_j}), peak ${e?.peak_c} °C`);
    }
  } finally { m.stop(); }
}

// Loudness (EBU R128 integrated, LUFS) and peak, per clip and its 2026 pair.
function loudness(file) {
  const r = spawnSyncText(file);
  const I = r.match(/I:\s+(-?[\d.]+) LUFS/g)?.at(-1)?.match(/-?[\d.]+/)[0];
  const LRA = r.match(/LRA:\s+(-?[\d.]+) LU/g)?.at(-1)?.match(/-?[\d.]+/)[0];
  const peak = r.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.at(-1)?.match(/-?[\d.]+/)[0];
  // Brightness (median spectral centroid, Hz) and noisiness (median spectral flatness: 0 = pure tones, 1 = noise).
  const st = spawnSync('/opt/homebrew/bin/ffmpeg', ['-hide_banner', '-i', file, '-ac', '1', '-af', 'aspectralstats=measure=centroid+flatness,ametadata=print:file=-', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 }).stdout;
  const med = (k) => { const xs = [...st.matchAll(new RegExp(`${k}=([\\d.]+)`, 'g'))].map((m) => +m[1]).sort((a, b) => a - b); return xs[xs.length >> 1]; };
  return { lufs: I, lra: LRA, peak, centroid: Math.round(med('centroid')), flatness: med('flatness')?.toFixed(2) };
}
function spawnSyncText(file) {
  return spawnSync('/opt/homebrew/bin/ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr ?? '';
}

function report() {
  for (const name of Object.keys(MODELS)) {
    const dir = here(`./out/era/${name}/`);
    if (!existsSync(dir)) continue;
    console.log(`| Clip | Prompt from | Made in (paused) | Energy (chip, net) | Peak °C | LUFS / LRA / peak | Centroid Hz, flatness | 2026 pair | Pair LUFS / LRA | Pair centroid, flatness |`);
    console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'smoke.json').sort()) {
      const r = JSON.parse(readFileSync(dir + f, 'utf8'));
      const a = loudness(`${dir}${r.id}.wav`);
      const b = r.pair && existsSync(here(`./out/${r.pair}`)) ? loudness(here(`./out/${r.pair}`)) : {};
      console.log(`| \`${r.id}\` | ${r.from} | ${r.seconds} s (${r.paused_s ?? '?'} s) for ${r.audio_seconds} s | ${r.energy_j} J, ${r.energy_net_j} J | ${r.peak_c} | ${a.lufs} / ${a.lra} / ${a.peak} | ${a.centroid}, ${a.flatness} | \`${r.pair}\` | ${b.lufs ?? '—'} / ${b.lra ?? '—'} | ${b.centroid ?? '—'}, ${b.flatness ?? '—'} |`);
    }
  }
}

const args = process.argv.slice(2);
if (args[0] === 'report') report();
else await make('musicgen-small', args.length ? args : Object.keys(PROMPTS));
