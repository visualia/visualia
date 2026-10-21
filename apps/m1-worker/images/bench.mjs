// Image model benchmark for the M1 (m1-1). Runs on the M1 itself:
//
//   cd ~/visualia-worker/images && /opt/homebrew/bin/node bench.mjs [model ...]
//
// For each model, one at a time:
//   1. wait until nothing else uses the GPU (`ollama ps` empty, macmon GPU idle);
//   2. measure the chip's idle power for 15 s (the baseline);
//   3. start gen.py (loads the model once, then makes every image), reading macmon
//      every 250 ms, the same way proxy.mjs meters text requests:
//      chip power = all_power + ram_power + gpu_ram_power, net = minus idle;
//   4. the python process exits, which frees the model, before the next one.
// Results go to results/<model>.json; images to out/<model>/ (never in git).
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const PROMPTS = {
  poster: 'A minimalist exhibition poster for an art school spring show. The large bold headline reads exactly "Kevadnäitus 2027". Clean Swiss typography on off-white paper, one green leaf shape, plenty of empty space.',
  bog: 'A photograph of a misty Estonian bog boardwalk at dawn: weathered wooden planks leading into fog, small crooked pine trees, dark bog pools, soft pink first light.',
  pattern: 'An abstract generative pattern in red and white: repeating geometric shapes inspired by Estonian folk knitting, reinterpreted as crisp code-made art, flat colors, no text.',
};
const SEED = 42;

const MODELS = {
  'flux2-klein-4b-q8': { family: 'flux2', model: 'mflux-community/flux2-klein-4b-mflux-q8', base: 'flux2-klein-4b', steps: 4, precision: 'float16' },
  'z-image-turbo-q6': { family: 'z-image-turbo', model: 'mflux-community/z-image-turbo-mflux-q6', base: 'z-image-turbo', steps: 9, precision: 'float16' },
  'ernie-image-turbo-q4': { family: 'ernie-image-turbo', model: 'mflux-community/ernie-image-turbo-mflux-q4', base: 'ernie-image-turbo', steps: 8, precision: null },
  'flux2-klein-9b-q4': { family: 'flux2', model: 'mflux-community/flux2-klein-9b-mflux-q4', base: 'flux2-klein-9b', steps: 4, precision: 'float16' },
};

const OLLAMA = '/opt/homebrew/bin/ollama';
const PY = new URL('.venv/bin/python', import.meta.url).pathname;
const GEN = new URL('gen.py', import.meta.url).pathname;
const HERE = new URL('.', import.meta.url).pathname;
const IDLE_SECS = 15;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r2 = (x) => Math.round(x * 100) / 100;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---- macmon: one sample every 250 ms, kept with its arrival time -------------
const samples = [];
const macmon = spawn('/opt/homebrew/bin/macmon', ['pipe', '-i', '250']);
let buf = '';
macmon.stdout.on('data', (d) => {
  buf += d;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
    let s; try { s = JSON.parse(line); } catch { continue; }
    samples.push({
      t: Date.now(),
      chip: (s.all_power ?? 0) + (s.ram_power ?? 0) + (s.gpu_ram_power ?? 0),
      sys: s.sys_power ?? 0,
      gpu: s.gpu_active_ratio ?? 0,
      ram: s.memory?.ram_usage ?? 0,
      swap: s.memory?.swap_usage ?? 0,
    });
    if (samples.length > 20000) samples.splice(0, 5000);
  }
});

const window = (t0, t1) => samples.filter((s) => s.t > t0 && s.t <= t1);
// Energy over [t0, t1]: each sample covers the time since the previous one.
function energy(t0, t1) {
  let chipJ = 0, sysJ = 0, prev = null;
  for (const s of samples) {
    if (prev && s.t > t0 && s.t <= t1) { const dt = (s.t - Math.max(prev.t, t0)) / 1000; chipJ += s.chip * dt; sysJ += s.sys * dt; }
    prev = s;
  }
  return { chipJ, sysJ };
}

// Other GPU jobs on this machine that don't show in `ollama ps` while they start up:
// the text-model benchmark and an MLX-LM server. Wait while any of them runs.
const OTHER_JOBS = /bench\.mjs bench-instructions|mlx_lm\.server|mlx_lm\.generate/;
function otherJobs() {
  const ps = execFileSync('/bin/ps', ['-axo', 'pid=,command='], { encoding: 'utf8' });
  return ps.split('\n').filter((l) => OTHER_JOBS.test(l) && !l.includes(String(process.pid)));
}

function ollamaLoaded() {
  const out = execFileSync(OLLAMA, ['ps'], { encoding: 'utf8' }).trim().split('\n').slice(1).filter(Boolean);
  return out;
}

// Wait until Ollama has nothing loaded and the GPU has been idle for IDLE_SECS,
// then return that quiet window's average chip power as the idle baseline.
async function waitForQuietGpu() {
  for (;;) {
    const loaded = ollamaLoaded();
    if (loaded.length) { log('ollama busy:', loaded.join(' | '), '- waiting 30 s'); await sleep(30000); continue; }
    const others = otherJobs();
    if (others.length) { log('other GPU job running:', others[0].trim().slice(0, 80), '- waiting 30 s'); await sleep(30000); continue; }
    const t0 = Date.now();
    await sleep(IDLE_SECS * 1000);
    const w = window(t0, Date.now());
    const gpuMax = Math.max(...w.map((s) => s.gpu));
    const gpuAvg = w.reduce((a, s) => a + s.gpu, 0) / w.length;
    if (ollamaLoaded().length || otherJobs().length || gpuAvg > 0.05 || gpuMax > 0.3) { log(`GPU not idle (avg ${r2(gpuAvg)}, max ${r2(gpuMax)}) - waiting 30 s`); await sleep(30000); continue; }
    const idleW = w.reduce((a, s) => a + s.chip, 0) / w.length;
    const ram = Math.max(...w.map((s) => s.ram));
    const swap = Math.max(...w.map((s) => s.swap));
    return { idleW, ram, swap };
  }
}

function jobsFor() {
  const jobs = [{ id: 'poster-512-cold', prompt: PROMPTS.poster, w: 512, h: 512, seed: SEED }];
  for (const size of [512, 1024]) for (const [k, p] of Object.entries(PROMPTS)) jobs.push({ id: `${k}-${size}`, prompt: p, w: size, h: size, seed: SEED });
  return jobs;
}

async function runModel(name) {
  const m = MODELS[name];
  if (!m) throw new Error(`unknown model ${name}; known: ${Object.keys(MODELS).join(', ')}`);
  log(name, 'waiting for a quiet GPU');
  const idle = await waitForQuietGpu();
  log(name, `idle chip ${r2(idle.idleW)} W, ram ${r2(idle.ram / 1e9)} GB, swap ${r2(idle.swap / 1e9)} GB; starting`);

  const out = `${HERE}out/${name}`;
  const spec = { cache_gb: 1, vae_tiling: true, ...m, out, jobs: jobsFor() };
  const tSpawn = Date.now();
  const child = spawn(PY, [GEN, JSON.stringify(spec)], { cwd: HERE, env: { ...process.env, HF_HOME: `${HERE}hf`, HF_HUB_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1' } });
  const events = [];
  let interfered = false;
  const poll = setInterval(() => { try { if (ollamaLoaded().length || otherJobs().length) interfered = true; } catch {} }, 5000);
  let lbuf = '', errTail = '';
  child.stdout.on('data', (d) => {
    lbuf += d;
    let nl;
    while ((nl = lbuf.indexOf('\n')) >= 0) {
      const line = lbuf.slice(0, nl); lbuf = lbuf.slice(nl + 1);
      let e; try { e = JSON.parse(line); } catch { continue; }
      e.at = Date.now();
      events.push(e);
      if (e.ev === 'loaded') log(name, `loaded in ${r2((e.at - tSpawn) / 1000)} s`);
      if (e.ev === 'image_done') log(name, e.id, `${e.seconds} s, MLX peak ${e.peak_gb} GB`);
    }
  });
  child.stderr.on('data', (d) => { errTail = (errTail + d).slice(-4000); });
  const code = await new Promise((r) => child.on('exit', r));
  clearInterval(poll);
  await sleep(1000);
  const tEnd = Date.now();

  const runWin = window(tSpawn, tEnd);
  const loaded = events.find((e) => e.ev === 'loaded');
  const starts = Object.fromEntries(events.filter((e) => e.ev === 'image_start').map((e) => [e.i, e.at]));
  const images = events.filter((e) => e.ev === 'image_done').map((e) => {
    const t0 = starts[e.i], t1 = e.at, secs = (t1 - t0) / 1000;
    const { chipJ, sysJ } = energy(t0, t1);
    return { id: e.id, seconds: e.seconds, peak_gb: e.peak_gb, chip_j: r2(chipJ), net_j: r2(Math.max(0, chipJ - idle.idleW * secs)), sys_j: r2(sysJ) };
  });
  const loadE = loaded ? energy(tSpawn, loaded.at) : null;
  const avg = (xs) => (xs.length ? r2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const warm = (size) => images.filter((i) => i.id.endsWith(`-${size}`));
  const summary = (size) => {
    const w = warm(size);
    const net = avg(w.map((i) => i.net_j));
    return { s_per_image: avg(w.map((i) => i.seconds)), chip_j: avg(w.map((i) => i.chip_j)), net_j: net, net_wh: net == null ? null : Math.round(net / 3.6) / 1000, sys_j: avg(w.map((i) => i.sys_j)), mlx_peak_gb: Math.max(...w.map((i) => i.peak_gb)) };
  };
  const result = {
    model: name, ...m, exit_code: code, interfered,
    idle_chip_w: r2(idle.idleW),
    cold_load_s: loaded ? r2((loaded.at - tSpawn) / 1000) : null,
    cold_load_j: loadE ? r2(loadE.chipJ) : null,
    first_image_s: images[0]?.seconds ?? null,
    cold_to_first_image_s: images[0] ? r2((starts[0] + images[0].seconds * 1000 - tSpawn) / 1000) : null,
    warm512: summary(512), warm1024: summary(1024),
    ram_before_gb: r2(idle.ram / 1e9), ram_peak_gb: r2(Math.max(...runWin.map((s) => s.ram)) / 1e9),
    swap_before_gb: r2(idle.swap / 1e9), swap_peak_gb: r2(Math.max(...runWin.map((s) => s.swap)) / 1e9),
    images, stderr_tail: code ? errTail : undefined,
  };
  mkdirSync(`${HERE}results`, { recursive: true });
  writeFileSync(`${HERE}results/${name}.json`, JSON.stringify(result, null, 2));
  log(name, 'done', JSON.stringify({ cold_load_s: result.cold_load_s, warm512: result.warm512, warm1024: result.warm1024, ram_peak_gb: result.ram_peak_gb, swap_peak_gb: result.swap_peak_gb, interfered, code }));
  if (code) log(name, 'stderr:', errTail.slice(-1500));
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MODELS);
await sleep(1500);
for (const n of names) { await runModel(n); await sleep(10000); }
macmon.kill();
log('all done');
