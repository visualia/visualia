// The nature set made and judged on this Mac, no cloud: pictures with stable-diffusion.cpp (Metal),
// the "which country?" question to Gemma 4 26B through the local Ollama. Each picture and answer
// is counted: seconds, and energy the way the pool measures it (macmon: chip = CPU + GPU + ANE +
// memory power, summed over the job; net = minus the chip's idle baseline; sys = the whole computer).
// Usage:
//   node local-nature.mjs draw <flux-2-klein-4b-local|sd-turbo-local>   29 pictures into out/nature/<model>/
//   node local-nature.mjs judge [local|real|cloud ...]                  Gemma's answers into out/nature/geo-cache.jsonl
//   node local-nature.mjs report                                        the tables for the README
// Heat: before each job the chip must be under 72 °C (it waits), and the run stops above 85 °C.
// Research use only: out/ is not in git.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const OUT = here('./out/nature/');
const tasks = JSON.parse(readFileSync(here('./tasks-nature.json'), 'utf8'));
const LOCAL = `${homedir()}/visualia-local/`;
const SD = `${LOCAL}stable-diffusion.cpp/build/bin/sd-cli`;
const M = `${LOCAL}models/`;
const DRAW = {
  'flux-2-klein-4b-local': ['--diffusion-model', `${M}flux-2-klein-4b-Q8_0.gguf`, '--vae', `${M}flux2_vae.safetensors`, '--llm', `${M}Qwen3-4B-Q8_0.gguf`,
    '--cfg-scale', '1.0', '--steps', '4'],
  'sd-turbo-local': ['-m', `${M}sd_turbo.safetensors`, '--cfg-scale', '1.0', '--steps', '1'],
};
const CLOUD = ['flux-2-klein-4b', 'flux-3-image-klein', 'p-image', 'nano-banana-2-lite', 'flux-2-dev'];
const GEMMA = 'gemma4:26b';
const JUDGE_ID = `ollama/${GEMMA}`;
const FLASH = 'google/gemini-3.8-flash';
const OLLAMA = 'http://127.0.0.1:11434';
const MACHINE = 'M2 Pro, 32 GB (work Mac)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJsonl = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const hashOf = (f) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16);
const r1 = (x) => Math.round(x * 10) / 10;

// The same question as nature.mjs, word for word: no country named.
const QUESTION = `Which country was this photo most likely taken in? Look only at what is in the picture.
Answer with JSON only, no other text:
{"country": "<one country name in English, or \\"unknown\\">", "confidence": <0 to 1>,
 "region": "<the region, province or county within that country, or null>",
 "reason": "<one short sentence: what in the picture points there>"}`;

// ---- the meter: macmon's samples, 4 a second ----

function meter() {
  const samples = [];
  const p = spawn('macmon', ['pipe', '-i', '250'], { stdio: ['ignore', 'pipe', 'ignore'] });
  let buf = '';
  p.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      try { const s = JSON.parse(line); samples.push({ t: Date.now(), chip: s.all_power, sys: s.sys_power, c: Math.max(s.temp?.cpu_temp_avg ?? 0, s.temp?.gpu_temp_avg ?? 0) }); } catch {}
    }
  });
  const between = (t0, t1) => samples.filter((s) => s.t > t0 && s.t <= t1 + 250);
  return {
    stop: () => p.kill(),
    temp: () => samples.at(-1)?.c ?? 0,
    // Median chip watts over the last `ms`: the idle baseline, taken while nothing of ours runs.
    idle: async (ms = 8000) => { const t0 = Date.now(); await sleep(ms); const w = between(t0, Date.now()).map((s) => s.chip).sort((a, b) => a - b); return w[w.length >> 1] ?? 0; },
    energy: (t0, t1, idleW) => {
      const xs = between(t0, t1);
      if (!xs.length) return null;
      const dt = 0.25, secs = (t1 - t0) / 1000;
      const chip = xs.reduce((a, s) => a + s.chip * dt, 0), sys = xs.reduce((a, s) => a + s.sys * dt, 0);
      return { energy_j: r1(chip), energy_net_j: r1(Math.max(0, chip - idleW * secs)), sys_energy_j: r1(sys), energy_source: 'macmon', peak_c: r1(Math.max(...xs.map((s) => s.c))) };
    },
  };
}

// Under 72 °C before a job (wait for it, up to 5 minutes), never on above 85 °C.
async function cool(m) {
  for (let k = 0; m.temp() >= 72; k++) {
    if (k > 60) throw new Error(`still ${m.temp().toFixed(0)} °C after 5 minutes: stopping`);
    await sleep(5000);
  }
}

// ---- draw ----

async function draw(model) {
  const args = DRAW[model];
  if (!args) throw new Error(`draw ${Object.keys(DRAW).join(' | ')}`);
  const dir = `${OUT}${model}/`;
  mkdirSync(dir, { recursive: true });
  const m = meter();
  await sleep(1500);
  const idleW = await m.idle();
  console.log(`${model}: idle chip ${idleW.toFixed(1)} W, ${m.temp().toFixed(0)} °C`);
  try {
    for (const t of tasks) {
      if (existsSync(`${dir}${t.id}.jpg`)) continue;
      await cool(m);
      const png = `${dir}${t.id}.png`;
      const t0 = Date.now();
      execFileSync(SD, [...args, '-p', t.prompt, '-W', '512', '-H', '512', '--seed', '1', '-o', png], { stdio: 'ignore' });
      const t1 = Date.now();
      await sleep(400); // the last samples
      const e = m.energy(t0, t1, idleW);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', '2', `${dir}${t.id}.jpg`]);
      rmSync(png);
      const row = { model, task: t.id, size: '512x512', seconds: r1((t1 - t0) / 1000), ...e, idle_w: r1(idleW), where: MACHINE,
        how: 'stable-diffusion.cpp sd-cli, Metal, seed 1, one process per picture (time and energy include loading)' };
      writeFileSync(`${dir}${t.id}.json`, JSON.stringify(row));
      console.log(`${model} ${t.id.padEnd(20)} ${row.seconds} s  ${e?.energy_j} J chip (${e?.energy_net_j} net, ${e?.sys_energy_j} sys)  ${e?.peak_c} °C`);
      if ((e?.peak_c ?? 0) > 85) throw new Error(`${e.peak_c} °C: stopping (heat rule)`);
    }
  } finally { m.stop(); }
}

// ---- judge ----

function realPictures() {
  return JSON.parse(readFileSync(`${OUT}real/photos.json`, 'utf8')).map((p) =>
    ({ kind: 'real', model: 'real', task: p.id, subject: p.subject, variant: 'real', file: `${OUT}real/${p.id}.jpg` }));
}
const gen = (models) => models.flatMap((model) => tasks.filter((t) => existsSync(`${OUT}${model}/${t.id}.jpg`))
  .map((t) => ({ kind: 'generated', model, task: t.id, subject: t.subject, variant: t.variant, file: `${OUT}${model}/${t.id}.jpg` })));
// The cloud sample: every cloud picture of 3 models picked to span the range (klein 4B, the same model as the
// local one; nano-banana, the best named share; flux-2-dev, the best neutral share). 87 pictures.
const CLOUD_SAMPLE = ['flux-2-klein-4b', 'nano-banana-2-lite', 'flux-2-dev'];
const GROUPS = { local: () => gen(Object.keys(DRAW)), real: realPictures, cloud: () => gen(CLOUD_SAMPLE), 'cloud-all': () => gen(CLOUD) };

async function ask(file) {
  const small = `${OUT}.geo/`;
  mkdirSync(small, { recursive: true });
  const h = hashOf(file);
  const shrunk = `${small}${h}.jpg`; // the same 1024 px, no-metadata copy Flash saw
  if (!existsSync(shrunk)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-map_metadata', '-1', '-vf', "scale='min(1024,iw)':-2", '-q:v', '3', shrunk]);
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: GEMMA, stream: false, keep_alive: '10m', think: false, options: { temperature: 0, seed: 1 },
      messages: [{ role: 'user', content: QUESTION, images: [readFileSync(shrunk).toString('base64')] }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  const text = data.message?.content ?? '';
  const answer = JSON.parse(String(text).match(/\{[\s\S]*\}/)?.[0] ?? 'null');
  if (!answer?.country) throw new Error(`no answer: ${text.slice(0, 120)}`);
  return { h, answer, usage: { prompt_tokens: data.prompt_eval_count, completion_tokens: data.eval_count, load_ms: Math.round((data.load_duration ?? 0) / 1e6) } };
}

async function judge(groups) {
  const cache = `${OUT}geo-cache.jsonl`;
  const done = new Set(readJsonl(cache).filter((r) => r.judge === JUDGE_ID && r.country).map((r) => r.hash));
  const all = groups.flatMap((g) => GROUPS[g]());
  const todo = all.filter((p) => !done.has(hashOf(p.file)));
  console.log(`${todo.length} of ${all.length} pictures to ask ${GEMMA}`);
  const m = meter();
  await sleep(1500);
  const idleW = await m.idle();
  console.log(`idle chip ${idleW.toFixed(1)} W, ${m.temp().toFixed(0)} °C`);
  try {
    // Load the model first, so the first answer's time is an answer's, not loading's.
    const t0 = Date.now();
    await fetch(`${OLLAMA}/api/generate`, { method: 'POST', body: JSON.stringify({ model: GEMMA, prompt: '', keep_alive: '10m' }) });
    console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    for (const p of todo) {
      await cool(m);
      const row = { judge: JUDGE_ID, kind: p.kind, model: p.model, task: p.task, where: MACHINE };
      const t0 = Date.now();
      try {
        const { h, answer, usage } = await ask(p.file);
        Object.assign(row, { hash: h }, answer, { usage });
      } catch (e) { row.hash = hashOf(p.file); row.error = e.message; }
      const t1 = Date.now();
      await sleep(400);
      row.latency = t1 - t0;
      Object.assign(row, m.energy(t0, t1, idleW), { idle_w: r1(idleW) });
      appendFileSync(cache, JSON.stringify(row) + '\n');
      console.log(`gemma ${p.model.padEnd(22)} ${p.task.padEnd(20)} ${row.country ?? 'FAILED ' + row.error} ${row.confidence ?? ''} ${row.region ?? ''}  ${(row.latency / 1000).toFixed(1)} s ${row.energy_j} J`);
      if ((row.peak_c ?? 0) > 85) throw new Error(`${row.peak_c} °C: stopping (heat rule)`);
    }
  } finally { m.stop(); }
}

// ---- report ----

const norm = (c) => {
  const s = String(c ?? '').trim();
  if (/^estonia/i.test(s)) return 'Estonia';
  if (/^(unknown|n\/a|none)$/i.test(s) || !s) return 'unknown';
  return s.replace(/^the /i, '');
};

function report() {
  const rows = readJsonl(`${OUT}geo-cache.jsonl`).filter((r) => r.country);
  const pics = [...gen([...Object.keys(DRAW), ...CLOUD]), ...realPictures()].map((p) => ({ ...p, hash: hashOf(p.file) }));
  const ans = (judge, p) => rows.findLast((r) => r.judge === judge && r.hash === p.hash);
  const ee = (xs, j) => { const a = xs.map((p) => ans(j, p)).filter(Boolean); const k = a.filter((r) => norm(r.country) === 'Estonia').length; return a.length ? `${Math.round((100 * k) / a.length)} % (${k}/${a.length})` : '-'; };
  const others = (xs, j) => { const n = {}; for (const p of xs) { const a = ans(j, p); if (a && norm(a.country) !== 'Estonia') n[norm(a.country)] = (n[norm(a.country)] ?? 0) + 1; } return Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, k]) => `${c} ${k}`).join(', ') || '-'; };
  const out = ['Placed in Estonia (named | neutral), by judge\n', '| pictures | judge | named | neutral | elsewhere |', '|---|---|---:|---:|---|'];
  for (const model of [...Object.keys(DRAW), ...CLOUD]) for (const j of [JUDGE_ID, FLASH]) {
    const xs = pics.filter((p) => p.model === model);
    if (!xs.some((p) => ans(j, p))) continue;
    out.push(`| ${model} | ${j === FLASH ? 'Flash' : 'Gemma'} | ${ee(xs.filter((p) => p.variant === 'named'), j)} | ${ee(xs.filter((p) => p.variant === 'neutral'), j)} | ${others(xs, j)} |`);
  }
  const real = pics.filter((p) => p.kind === 'real');
  for (const j of [JUDGE_ID, FLASH]) out.push(`| real photos | ${j === FLASH ? 'Flash' : 'Gemma'} | ${ee(real, j)} | | ${others(real, j)} |`);
  // Agreement: pictures both judged.
  const both = pics.map((p) => ({ ...p, g: ans(JUDGE_ID, p), f: ans(FLASH, p) })).filter((p) => p.g && p.f);
  const agree = (xs) => `${xs.filter((p) => norm(p.g.country) === norm(p.f.country)).length}/${xs.length}`;
  const eeAgree = (xs) => `${xs.filter((p) => (norm(p.g.country) === 'Estonia') === (norm(p.f.country) === 'Estonia')).length}/${xs.length}`;
  out.push('\nGemma vs Flash, same pictures: same country | same Estonia-or-not\n', '| pictures | same country | same in/out of Estonia |', '|---|---:|---:|');
  out.push(`| real photos | ${agree(both.filter((p) => p.kind === 'real'))} | ${eeAgree(both.filter((p) => p.kind === 'real'))} |`);
  out.push(`| cloud pictures | ${agree(both.filter((p) => p.kind === 'generated'))} | ${eeAgree(both.filter((p) => p.kind === 'generated'))} |`);
  out.push(`| all | ${agree(both)} | ${eeAgree(both)} |`);
  const gEE = both.filter((p) => norm(p.g.country) === 'Estonia' && norm(p.f.country) !== 'Estonia').map((p) => `${p.model}/${p.task} (Flash ${norm(p.f.country)})`);
  const fEE = both.filter((p) => norm(p.f.country) === 'Estonia' && norm(p.g.country) !== 'Estonia').map((p) => `${p.model}/${p.task} (Gemma ${norm(p.g.country)})`);
  out.push(`\nOnly Gemma says Estonia: ${gEE.join(', ') || '-'}\nOnly Flash says Estonia: ${fEE.join(', ') || '-'}`);
  const gc = {}; for (const p of both) if (norm(p.g.country) !== norm(p.f.country)) { const k = `${norm(p.f.country)} -> ${norm(p.g.country)}`; gc[k] = (gc[k] ?? 0) + 1; }
  out.push(`Disagreements (Flash -> Gemma): ${Object.entries(gc).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ')}`);
  // Cost per picture and answer.
  const stat = (xs, f) => { const v = xs.map(f).filter((x) => x != null).sort((a, b) => a - b); return v.length ? { mean: v.reduce((a, b) => a + b, 0) / v.length, med: v[v.length >> 1], sum: v.reduce((a, b) => a + b, 0), n: v.length } : null; };
  out.push('\nTime and energy, this Mac\n', '| job | n | s each (median) | chip J each (mean) | net J | whole Mac J | Wh, all |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const model of Object.keys(DRAW)) {
    const js = tasks.map((t) => `${OUT}${model}/${t.id}.json`).filter(existsSync).map((f) => JSON.parse(readFileSync(f, 'utf8')));
    const s = stat(js, (j) => j.seconds), e = stat(js, (j) => j.energy_j), n = stat(js, (j) => j.energy_net_j), y = stat(js, (j) => j.sys_energy_j);
    if (s) out.push(`| picture, ${model} | ${s.n} | ${s.med.toFixed(1)} | ${e.mean.toFixed(0)} | ${n.mean.toFixed(0)} | ${y.mean.toFixed(0)} | ${(e.sum / 3600).toFixed(2)} |`);
  }
  const g = rows.filter((r) => r.judge === JUDGE_ID);
  const s = stat(g, (r) => r.latency / 1000), e = stat(g, (r) => r.energy_j), n = stat(g, (r) => r.energy_net_j), y = stat(g, (r) => r.sys_energy_j);
  if (s) out.push(`| answer, ${GEMMA} | ${s.n} | ${s.med.toFixed(1)} | ${e.mean.toFixed(0)} | ${n.mean.toFixed(0)} | ${y.mean.toFixed(0)} | ${(e.sum / 3600).toFixed(2)} |`);
  console.log(out.join('\n'));
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'draw') for (const m of rest) await draw(m);
else if (cmd === 'judge') await judge(rest.length ? rest : ['local', 'real', 'cloud']);
else if (cmd === 'report') report();
else console.log('node local-nature.mjs draw <model ...> | judge [local real cloud cloud-all] | report');
