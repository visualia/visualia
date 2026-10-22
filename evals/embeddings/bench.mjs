// Embedding models on a Mac's Ollama: speed, energy and whether they group
// class works (briefs.json: 8 themes x 5, Estonian and English). See
// research/embeddings.md.
//
//   node bench.mjs <ollama tag> [prefix]     on the machine with Ollama (needs meter.mjs next to it)
//   node bench.mjs --cloud <@cf/model>       quality only, Workers AI REST (CF_ACCOUNT, CF_TOKEN)
//
// Prints one JSON line per model: load, latency, throughput, energy, quality.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const OLLAMA = process.env.OLLAMA ?? 'http://127.0.0.1:11434';
const data = JSON.parse(readFileSync(new URL('./briefs.json', import.meta.url), 'utf8'));
const items = data.items;
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

// Each model's own prefix for clustering / documents, from its model card.
const PREFIX = {
  'embeddinggemma': 'task: clustering | query: ',
  'qwen3-embedding:0.6b': 'Instruct: Identify the theme of this art student\'s project brief\nQuery:',
  'nomic-embed-text-v2-moe': 'search_document: ',
};

// ---- quality --------------------------------------------------------------------
const norm = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

export function quality(vecs) {
  const v = vecs.map(norm);
  let nn = 0, p4 = 0, cross = 0;
  for (let i = 0; i < v.length; i++) {
    const others = v.map((w, j) => ({ j, s: j === i ? -2 : dot(v[i], w) })).sort((a, b) => b.s - a.s);
    if (items[others[0].j].theme === items[i].theme) nn++;
    p4 += others.slice(0, 4).filter((o) => items[o.j].theme === items[i].theme).length / 4;
    const other = others.find((o) => items[o.j].lang !== items[i].lang);
    if (items[other.j].theme === items[i].theme) cross++;
  }
  return { nn_pct: round((100 * nn) / v.length, 0), p4_pct: round((100 * p4) / v.length, 0), cross_pct: round((100 * cross) / v.length, 0) };
}

// ---- Workers AI (quality only) ------------------------------------------------------
if (process.argv[2] === '--cloud') {
  const model = process.argv[3];
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT}/ai/run/${model}`, {
    method: 'POST', headers: { authorization: `Bearer ${process.env.CF_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text: items.map((i) => i.text) }),
  });
  const j = await res.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors));
  const vecs = j.result.data ?? j.result.response;
  console.log(JSON.stringify({ model, dims: vecs[0].length, ...quality(vecs) }));
  process.exit(0);
}

// ---- Ollama -----------------------------------------------------------------------
const { meter } = await import('./meter.mjs');
const tag = process.argv[2];
const prefix = process.argv[3] ?? PREFIX[tag.replace(/:latest$/, '')] ?? '';
const m = meter();

const embed = async (input) => {
  const r = await fetch(`${OLLAMA}/api/embed`, { method: 'POST', body: JSON.stringify({ model: tag, input, keep_alive: '10m' }) });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
};
const unloadAll = async () => {
  const { models = [] } = await fetch(`${OLLAMA}/api/ps`).then((r) => r.json());
  for (const x of models) await fetch(`${OLLAMA}/api/generate`, { method: 'POST', body: JSON.stringify({ model: x.name, keep_alive: 0 }) });
};
// Another job on this Mac (a Tauri build) would spoil the numbers: wait for it.
const quiet = async () => {
  for (;;) {
    let busy = '';
    try { busy = execSync("pgrep -l -x cargo; pgrep -l -x rustc; pgrep -lf '[t]auri build'",{ encoding: 'utf8' }).trim(); } catch {}
    if (!busy) return;
    console.error('waiting for:', busy.split('\n')[0]);
    await new Promise((r) => setTimeout(r, 30_000));
  }
};

// Repeat a batch until at least `secs` have passed, so macmon's 250 ms samples add up.
async function measure(texts, secs = 4) {
  await quiet();
  const job = m.start();
  const t0 = Date.now();
  let n = 0, tokens = 0;
  while (Date.now() - t0 < secs * 1000) {
    const r = await embed(texts);
    n += texts.length;
    tokens += r.prompt_eval_count ?? 0;
  }
  const e = m.stop(job);
  const s = (Date.now() - t0) / 1000;
  return {
    texts_s: round(n / s, 1), ms_batch: round((1000 * s) / (n / texts.length), 0), tok_text: round(tokens / n, 0),
    j100: round((100 * e.energy_j) / n), net_j100: round((100 * e.energy_net_j) / n), sys_j100: round((100 * e.sys_energy_j) / n),
  };
}

await unloadAll();
await quiet();
await m.cool({ below: 60, pause: 20_000 });

// Cold load: one short text with nothing loaded.
let t0 = Date.now();
const first = await embed([prefix + items[0].text]);
const load = { load_s: round((Date.now() - t0) / 1000), ollama_load_s: round((first.load_duration ?? 0) / 1e9), dims: first.embeddings[0].length };

// Single-text latency, warm: ten different briefs one by one, median.
const lat = [];
for (const it of items.slice(1, 11)) { t0 = Date.now(); await embed([prefix + it.text]); lat.push(Date.now() - t0); }
lat.sort((a, b) => a - b);

const short = items.map((i) => prefix + i.text);
const long = data.long.map((t) => prefix + t);
const batch = (list, n) => Array.from({ length: n }, (_, i) => list[i % list.length]);
const runs = {};
for (const [name, list] of [['short', short], ['long', long]]) {
  for (const n of [1, 16, 64]) runs[`${name}_${n}`] = await measure(batch(list, n));
}

// Quality, with the model's prefix and without.
const q = quality((await embed(short)).embeddings);
const qRaw = prefix ? quality((await embed(items.map((i) => i.text))).embeddings) : q;

await fetch(`${OLLAMA}/api/generate`, { method: 'POST', body: JSON.stringify({ model: tag, keep_alive: 0 }) });
m.close();
console.log(JSON.stringify({ tag, prefix: !!prefix, ...load, single_ms: lat[5], gpu_c: Math.round(m.gpuC() ?? 0), ...q, raw: qRaw, runs }));
