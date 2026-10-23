// Text to SVG: briefs × local Ollama models, one generation at a time.
// See research/svg-generation.md.
// Usage (on the machine running Ollama): node run.mjs [--base http://127.0.0.1:11434] [--out ./out]
//   [--only id,id] [--think] model ...   (--think: reasoning on, results under <model>-think/)
// Writes out/<model>/<id>.svg, <id>.txt (the raw answer) and results.jsonl.
// Validation and rendering are separate: node render.mjs <out dir> (Playwright Chromium).
// Polite on a live pool worker: waits while another model is loaded, unloads its own at the end.

import { writeFileSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const valueOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const BASE = (valueOf('--base') ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
const OUT = valueOf('--out') ?? new URL('./out/', import.meta.url).pathname;
const MODELS = args.filter((a, i) => !a.startsWith('--') && !['--base', '--out', '--only'].includes(args[i - 1]));
const briefs = JSON.parse(readFileSync(new URL('./briefs.json', import.meta.url), 'utf8'));
const only = valueOf('--only')?.split(',');
const THINK = args.includes('--think');

const SYSTEM = [
  'You make one SVG image from a short brief, which may be in English or Estonian.',
  'Answer with exactly one complete, standalone SVG document in a single ```svg code block, nothing else.',
  'Start with <svg xmlns="http://www.w3.org/2000/svg" and a viewBox. No external files, fonts or scripts.',
  'Any text in the image is written exactly as given in the brief, with the right letters (ä, õ, ö, ü).',
].join(' ');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function loaded() {
  const r = await fetch(`${BASE}/api/ps`).then((x) => x.json());
  return r.models.map((m) => m.name);
}
// Wait while something else is loaded (a pool job), so only one model is in memory.
async function waitQuiet(model) {
  for (;;) {
    const others = (await loaded()).filter((n) => n !== model);
    if (!others.length) return;
    console.log(`waiting: ${others.join(', ')} loaded`);
    await sleep(15000);
  }
}

function extract(text) {
  const fenced = text.match(/```(?:svg|xml)?\s*\n([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const m = body.match(/<svg[\s\S]*<\/svg>/);
  return m ? m[0] : null;
}

for (const model of MODELS) {
  const dir = `${OUT}/${model.replace(/[/:]/g, '_')}${THINK ? '-think' : ''}`;
  mkdirSync(dir, { recursive: true });
  await waitQuiet(model);
  // Load outside the measurement.
  const t0 = performance.now();
  await fetch(`${BASE}/api/generate`, { method: 'POST', body: JSON.stringify({ model, prompt: '', keep_alive: '10m' }) });
  console.log(`${model}: loaded in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  for (const b of briefs) {
    if (only && !only.includes(b.id)) continue;
    await waitQuiet(model);
    const start = performance.now();
    let ttft = null, answerStart = null, text = '', final = null;
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({
        model, stream: true, think: THINK, keep_alive: '10m',
        options: { temperature: 0.4, num_ctx: THINK ? 16384 : 8192, num_predict: THINK ? 12000 : 6000, seed: 42 },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: b.brief }],
      }),
    });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        const j = JSON.parse(line);
        if (j.error) throw new Error(j.error);
        const piece = j.message?.content ?? '';
        if ((piece || j.message?.thinking) && ttft === null) ttft = performance.now() - start;
        if (piece && answerStart === null) answerStart = performance.now() - start;
        text += piece;
        if (j.done) final = j;
      }
    }
    const total = performance.now() - start;
    const svg = extract(text);
    writeFileSync(`${dir}/${b.id}.txt`, text);
    if (svg) writeFileSync(`${dir}/${b.id}.svg`, svg);
    const row = {
      model: THINK ? `${model} think` : model, id: b.id, lang: b.lang,
      ttft_s: ttft && +(ttft / 1000).toFixed(2), answer_starts_s: THINK && answerStart ? +(answerStart / 1000).toFixed(1) : undefined, total_s: +(total / 1000).toFixed(1),
      tokens_out: final?.eval_count, tok_per_s: final && +(final.eval_count / (final.eval_duration / 1e9)).toFixed(1),
      done_reason: final?.done_reason, svg_bytes: svg ? Buffer.byteLength(svg) : 0,
      at: new Date().toISOString(),
    };
    appendFileSync(`${OUT}/results.jsonl`, JSON.stringify(row) + '\n');
    console.log(JSON.stringify(row));
    await sleep(5000); // a short pause between generations
  }
  await fetch(`${BASE}/api/generate`, { method: 'POST', body: JSON.stringify({ model, keep_alive: 0 }) });
  console.log(`${model}: unloaded`);
}
