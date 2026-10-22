// Multi-file step 0: how models stream tool calls, and whether they write several
// files in one reply. Raw SSE and a JSON summary per call go to out/<model>/.
// See plans/multi-file.md "Capture (step 0)".
// Usage: node capture.mjs [--runs 2] [--local <ollama base url>] [--cases a,b] [model ...]
//        [--first-run n]  start at run n (turns.json per model is merged, not replaced)
//   (cloud models through the gateway with eka-test-001 from ../../.keys.local;
//    --local calls Ollama's OpenAI endpoint directly, thinking off, one call at a
//    time with a minute's pause, stops above 85 °C, unloads the model at the end)
// Cases per run:
//   auto      the site brief, tool_choice auto, parallel_tool_calls true
//   required  the same brief, tool_choice required on the first step (auto after)
//   serial    the same brief, tool_choice auto, parallel_tool_calls false
//   edit      "make the heading red", with auto's files fed back as read results
//   big       one long index.html (aim 15–25 KB) + style.css: escaping of big content
// Each case is a loop of up to MAX_STEPS model calls over an in-memory file system.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { meter } from '../../apps/pool/meter.mjs';

const GATEWAY = process.env.GATEWAY ?? 'https://gw.visualia.space';
const args = process.argv.slice(2);
const valueOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const LOCAL = valueOf('--local')?.replace(/\/$/, '');
const RUNS = Number(valueOf('--runs') ?? 2);
const FIRST_RUN = Number(valueOf('--first-run') ?? 1);
const CASES = (valueOf('--cases') ?? 'auto,required,serial,edit,big').split(',');
const picked = args.filter((a, i) => !a.startsWith('--') && !['--local', '--runs', '--cases', '--first-run'].includes(args[i - 1]));
const MODELS = picked.length ? picked : LOCAL ? ['gemma4:26b'] : [
  '@cf/deepseek-ai/deepseek-v4.1-flash-1017',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/qwen/qwen3.8-27b',
];
const MAX_STEPS = 6;
const power = LOCAL ? meter() : null;
const keys = Object.fromEntries(readFileSync(new URL('../../.keys.local', import.meta.url), 'utf8').trim().split('\n').map((l) => l.split('=')));

const SYSTEM = [
  'You build small static websites by calling tools. Files live in the project folder; paths are relative to it (index.html, style.css, img/a.png).',
  'Write each file with `write`, one call per file, and make all the files in one reply: call write several times in the same answer.',
  'Change an existing file with `edit` (oldText copied exactly from the file, short but unique); rewrite a whole file only when most of it changes.',
  'Link files with relative paths only (href="style.css", src="main.js", href="about.html"), never starting with "/".',
  'Do not call ls or read for files you have just written or been shown. When the files are written, stop: answer with one short sentence, no tool call.',
].join(' ');

const BRIEF = 'A small site: index.html and about.html linking to each other, a shared style.css, and main.js showing the current time on both pages.';
const EDIT = 'Make the main heading red on both pages.';
const BIG = 'One long page, index.html, plus style.css: "40 Estonian artists", a section for each of 40 invented artists, each with a heading, two paragraphs of about 60 words, and a small inline SVG drawing. Write all of it in full, no placeholders; index.html should be 15–25 KB.';

const TOOLS = [
  { name: 'read', description: 'Read a file. Returns its text.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Relative path' } }, required: ['path'], additionalProperties: false } },
  { name: 'ls', description: 'List the files in a folder.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Folder, "." for the project root' } }, required: ['path'], additionalProperties: false } },
  { name: 'write', description: 'Create or overwrite a whole file.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Relative path, e.g. index.html' }, content: { type: 'string', description: 'The complete file content' } }, required: ['path', 'content'], additionalProperties: false } },
  { name: 'edit', description: 'Replace exact text in a file. Each oldText must occur exactly once in the file.', parameters: { type: 'object', properties: { path: { type: 'string' }, edits: { type: 'array', items: { type: 'object', properties: { oldText: { type: 'string' }, newText: { type: 'string' } }, required: ['oldText', 'newText'], additionalProperties: false } } }, required: ['path', 'edits'], additionalProperties: false } },
  { name: 'delete', description: 'Delete a file.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } },
].map((f) => ({ type: 'function', function: f }));

let lastRowId = LOCAL ? 0 : (await fetchRows())[0]?.id ?? 0;
let lastCall = 0;
let hotStop = false;
const summary = [];

for (const model of MODELS) {
  const dir = new URL(`./out/${(LOCAL ? `local/${model}` : model).replace(/^@cf\/[^/]+\//, '').replace(/[/:]/g, '_')}/`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (let run = FIRST_RUN; run <= RUNS; run++) {
    const files = {};
    for (const kase of CASES) {
      if (hotStop) break;
      const fs = {};
      let messages;
      if (kase === 'edit') {
        const src = files.auto ?? files.required ?? files.serial;
        if (!src || !Object.keys(src).length) { console.log(`${short(model)} r${run} edit: skipped, no files from an earlier case`); continue; }
        Object.assign(fs, structuredClone(src));
        const reads = Object.keys(fs).map((p, i) => ({ id: `call_read_${i}`, type: 'function', function: { name: 'read', arguments: JSON.stringify({ path: p }) } }));
        messages = [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: BRIEF },
          { role: 'assistant', content: '', tool_calls: reads },
          ...reads.map((c, i) => ({ role: 'tool', tool_call_id: c.id, content: fs[Object.keys(fs)[i]] })),
          { role: 'assistant', content: 'Here are the current files.' },
          { role: 'user', content: EDIT },
        ];
      } else {
        messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: kase === 'big' ? BIG : BRIEF }];
      }
      const turn = { model, run, case: kase, steps: [], stopped: null };
      for (let step = 1; step <= MAX_STEPS; step++) {
        const choice = kase === 'required' && step === 1 ? 'required' : 'auto';
        const body = {
          model, messages, tools: TOOLS, tool_choice: choice, stream: true,
          max_tokens: kase === 'big' ? 16000 : 8000,
          ...(kase === 'serial' ? { parallel_tool_calls: false } : { parallel_tool_calls: true }),
          ...(LOCAL ? { stream_options: { include_usage: true }, think: false, reasoning_effort: 'none' } : { chat_template_kwargs: { enable_thinking: false } }),
        };
        const name = `r${run}-${kase}-s${step}`;
        const r = await call(body, model);
        writeFileSync(new URL(`${name}.sse`, dir), r.raw ?? '');
        const s = analyse(r, fs);
        s.tool_choice = choice;
        turn.steps.push(s);
        writeFileSync(new URL(`${name}.json`, dir), JSON.stringify({ request: { ...body, messages: body.messages.length }, ...s, calls: s.calls }, null, 2));
        log(model, run, kase, step, s);
        if (r.aborted && power) hotStop = true;
        if (s.error || r.aborted) { turn.stopped = s.error ?? 'aborted'; break; }
        if (!s.calls.length) { turn.stopped = 'text'; break; }
        messages = [...messages,
          { role: 'assistant', content: s.text || '', tool_calls: s.calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: typeof c.argsRaw === 'string' ? c.argsRaw : JSON.stringify(c.argsRaw ?? {}) } })) },
          ...s.calls.map((c) => ({ role: 'tool', tool_call_id: c.id, content: c.result })),
        ];
        if (step === MAX_STEPS) turn.stopped = 'step cap';
      }
      turn.files = Object.fromEntries(Object.entries(fs).map(([p, t]) => [p, t.length]));
      turn.links = linkCheck(fs);
      for (const [p, t] of Object.entries(fs)) {
        mkdirSync(new URL(`r${run}-${kase}/`, dir), { recursive: true });
        writeFileSync(new URL(`r${run}-${kase}/${p.replace(/\//g, '_')}`, dir), t);
      }
      files[kase] = fs;
      summary.push(turn);
      const prev = (() => { try { return JSON.parse(readFileSync(new URL('turns.json', dir), 'utf8')); } catch { return []; } })();
      writeFileSync(new URL('turns.json', dir), JSON.stringify([...prev.filter((t) => !(t.run === run && t.case === kase)), turn], null, 2));
      if (power && power.gpuC() > 85) { console.error('stopping: GPU over 85 °C'); hotStop = true; break; }
    }
  }
  if (LOCAL) await fetch(`${LOCAL.replace(/\/v1$/, '')}/api/generate`, { method: 'POST', body: JSON.stringify({ model, keep_alive: 0 }) }).catch(() => {});
}
power?.close();
writeFileSync(new URL(LOCAL ? './out/local-turns.json' : './out/turns.json', import.meta.url), JSON.stringify(summary, null, 2));
console.log('\n' + table(summary));

// ---- one model call ---------------------------------------------------------

async function call(body, model) {
  // DeepSeek allows 20 requests a minute per account: keep 3.5 s between calls.
  if (!LOCAL) { const wait = 3500 - (Date.now() - lastCall); if (wait > 0) await sleep(wait); }
  if (LOCAL) await power.cool({ below: 70, pause: lastCall ? 60_000 : 0 }).catch((e) => { hotStop = true; throw e; });
  lastCall = Date.now();
  const t0 = Date.now();
  const job = power?.start();
  const hot = new AbortController();
  const watch = power && setInterval(() => power.gpuC() > 85 && hot.abort(new Error('GPU over 85 °C')), 1000);
  const res = await fetch(LOCAL ? `${LOCAL}/chat/completions` : `${GATEWAY}/v1/chat/completions`, {
    method: 'POST', signal: hot.signal,
    headers: LOCAL ? { 'content-type': 'application/json' } : { authorization: `Bearer ${keys['eka-test-001']}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((e) => ({ ok: false, status: 0, text: async () => String(e.message) }));
  if (!res.ok) {
    clearInterval(watch); if (job) power.stop(job);
    return { error: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`, raw: '', seconds: (Date.now() - t0) / 1000 };
  }
  const decoder = new TextDecoder();
  let raw = '', buffer = '';
  const events = [];
  let aborted = false;
  try {
    for await (const chunk of res.body) {
      const piece = decoder.decode(chunk, { stream: true });
      raw += piece; buffer += piece;
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        try { events.push({ t: Date.now() - t0, e: JSON.parse(payload) }); } catch {}
      }
    }
  } catch (e) { aborted = String(e.message ?? e); }
  clearInterval(watch);
  const energy = job ? power.stop(job) : null;
  const out = { raw, events, seconds: (Date.now() - t0) / 1000, aborted, energy, gpu_c: power ? Math.round(power.gpuC()) : null };
  if (!LOCAL) {
    await sleep(1500); // the usage row is written in waitUntil
    const rows = (await fetchRows()).filter((r) => r.id > lastRowId && r.model === model).sort((a, b) => a.id - b.id);
    if (rows.length) { out.row = rows[rows.length - 1]; lastRowId = Math.max(lastRowId, ...rows.map((r) => r.id)); }
  }
  return out;
}

async function fetchRows() {
  const r = await fetch(`${GATEWAY}/usage`, { headers: { authorization: `Bearer ${keys['eka-teacher']}` } }).catch(() => null);
  return r?.ok ? r.json() : [];
}

// ---- what came back ----------------------------------------------------------

function analyse(r, fs) {
  const s = { seconds: r.seconds, error: r.error ?? (r.aborted || null), shape: null, text: '', reasoning: '', calls: [], first_any_s: null, first_tool_s: null, finish: null, usage: null, row: null, excerpt: [] };
  if (r.error) return s;
  const byIndex = new Map(); // every call in order
  const current = new Map(); // stream index -> the call it continues
  const shapes = new Set();
  for (const { t, e } of r.events) {
    if (s.first_any_s == null && (e.choices?.[0]?.delta?.content || e.choices?.[0]?.delta?.tool_calls || e.response || e.tool_calls)) s.first_any_s = t / 1000;
    if (e.usage) s.usage = e.usage;
    const c = e.choices?.[0];
    if (c?.finish_reason) s.finish = c.finish_reason;
    const d = c?.delta ?? {};
    if (d.content) s.text += d.content;
    if (d.reasoning_content || d.reasoning) s.reasoning += d.reasoning_content ?? d.reasoning;
    if (typeof e.response === 'string' && e.response) { s.text += e.response; shapes.add('native response'); }
    if (Array.isArray(d.tool_calls)) {
      shapes.add('openai delta.tool_calls');
      for (const [k, tc] of d.tool_calls.entries()) {
        // A new id starts a new call, even at an index already seen: Gemma on
        // Workers AI sends every call of a reply with index 2.
        const idx = tc.index ?? k;
        let call = current.get(idx);
        if (!call || (tc.id && call.id && call.id !== tc.id)) {
          if (call) s.index_reused = true;
          call = { id: tc.id, name: '', argsRaw: '', frags: 0, firstT: t, lastT: t, objectArgs: false };
          current.set(idx, call);
          byIndex.set(byIndex.size, call);
        }
        if (tc.id && !call.id) call.id = tc.id;
        if (tc.function?.name) call.name += tc.function.name;
        const a = tc.function?.arguments;
        if (a != null && a !== '') {
          if (typeof a === 'string') call.argsRaw += a; else { call.argsRaw = a; call.objectArgs = true; }
          call.frags++; call.lastT = t;
        }
        if (s.first_tool_s == null) s.first_tool_s = t / 1000;
        if (s.excerpt.length < 4) s.excerpt.push(JSON.stringify(e).slice(0, 400));
      }
    }
    if (Array.isArray(e.tool_calls)) { // native top-level shape
      shapes.add('native top-level tool_calls');
      for (const tc of e.tool_calls) {
        const idx = byIndex.size;
        byIndex.set(idx, { id: tc.id ?? `native_${idx}`, name: tc.name ?? tc.function?.name ?? '', argsRaw: tc.arguments ?? tc.function?.arguments ?? '', frags: 1, firstT: t, lastT: t, objectArgs: typeof (tc.arguments ?? tc.function?.arguments) === 'object' });
        if (s.first_tool_s == null) s.first_tool_s = t / 1000;
      }
      if (s.excerpt.length < 4) s.excerpt.push(JSON.stringify(e).slice(0, 400));
    }
  }
  s.shape = [...shapes].join(' + ') || 'text only';
  s.events = r.events.length;
  s.energy = r.energy; s.gpu_c = r.gpu_c;
  if (r.row) s.row = { tokens_in: r.row.tokens_in, tokens_cache_read: r.row.tokens_cache_read, tokens_out: r.row.tokens_out, tokens_reasoning: r.row.tokens_reasoning, cost_usd: r.row.cost_usd, latency_ms: r.row.latency_ms, first_token_ms: r.row.first_token_ms, ok: r.row.ok, error: r.row.error };
  for (const call of byIndex.values()) {
    const c = { id: call.id || `call_${Math.random().toString(36).slice(2, 8)}`, name: call.name, frags: call.frags, objectArgs: call.objectArgs, stream_s: Math.round((call.lastT - call.firstT) / 100) / 10, argsRaw: call.argsRaw, args: null, parses: false, schema: false };
    if (call.objectArgs) { c.args = call.argsRaw; c.parses = true; } else { try { c.args = JSON.parse(call.argsRaw || '{}'); c.parses = true; } catch (e) { c.parseError = String(e.message).slice(0, 120); } }
    c.schema = c.parses && validate(c.name, c.args);
    c.result = execTool(c, fs);
    if (c.name === 'write' && c.parses) {
      c.path_first = typeof call.argsRaw === 'string' ? call.argsRaw.indexOf('"path"') < call.argsRaw.indexOf('"content"') : Object.keys(c.args)[0] === 'path';
      c.bytes = String(c.args.content ?? '').length;
      c.escape_suspect = /\\n|\\"/.test(c.args.content ?? '') && !/\n/.test(c.args.content ?? ''); // double-escaped
    }
    s.calls.push(c);
  }
  return s;
}

function validate(name, a) {
  const str = (x) => typeof x === 'string';
  const only = (o, ks) => o && typeof o === 'object' && Object.keys(o).every((k) => ks.includes(k));
  switch (name) {
    case 'read': case 'delete': return only(a, ['path']) && str(a.path);
    case 'ls': return only(a, ['path']) && (a.path == null || str(a.path));
    case 'write': return only(a, ['path', 'content']) && str(a.path) && str(a.content);
    case 'edit': return only(a, ['path', 'edits']) && str(a.path) && Array.isArray(a.edits) && a.edits.length > 0 && a.edits.every((e) => only(e, ['oldText', 'newText']) && str(e.oldText) && str(e.newText));
    default: return false;
  }
}

// The in-memory file system the tools run against.
function execTool(c, fs) {
  if (!c.parses) return `Error: arguments are not valid JSON (${c.parseError}). Send the call again with valid JSON.`;
  if (!c.schema) return `Error: arguments do not match the ${c.name || 'unknown'} tool's schema.`;
  const p = String(c.args.path ?? '.').replace(/^\.\//, '');
  if (p.startsWith('/')) c.absolute = true;
  const key = p.replace(/^\//, '');
  switch (c.name) {
    case 'write': fs[key] = c.args.content; return `Wrote ${key} (${c.args.content.length} bytes).`;
    case 'read': return key in fs ? fs[key] : `Error: ${key} does not exist.`;
    case 'ls': return Object.keys(fs).map((f) => `${f} ${fs[f].length}`).join('\n') || '(empty)';
    case 'delete': if (!(key in fs)) return `Error: ${key} does not exist.`; delete fs[key]; return `Deleted ${key}.`;
    case 'edit': {
      if (!(key in fs)) { c.edit = { matched: 0, total: c.args.edits.length }; return `Error: ${key} does not exist.`; }
      let text = fs[key]; let matched = 0; const bad = [];
      for (const e of c.args.edits) {
        const n = text.split(e.oldText).length - 1;
        if (n === 1) { text = text.replace(e.oldText, () => e.newText); matched++; } else bad.push(n === 0 ? 'not found' : `found ${n} times`);
      }
      c.edit = { matched, total: c.args.edits.length };
      if (bad.length) return `Error: oldText ${bad.join(', ')} in ${key}; nothing changed.`;
      fs[key] = text; return `Edited ${key} (${matched} replacement${matched === 1 ? '' : 's'}).`;
    }
  }
}

// Links between the files written: relative, and pointing at files that exist.
function linkCheck(fs) {
  const refs = [];
  for (const [p, t] of Object.entries(fs)) {
    if (!/\.html?$/.test(p)) continue;
    for (const m of t.matchAll(/\b(?:href|src)\s*=\s*["']([^"'#]+)["']/gi)) refs.push({ from: p, to: m[1] });
  }
  const own = refs.filter((r) => !/^(https?:|data:|mailto:|\/\/)/i.test(r.to));
  return {
    refs: own.map((r) => `${r.from}→${r.to}`),
    absolute: own.filter((r) => r.to.startsWith('/')).length,
    missing: own.filter((r) => !(r.to.replace(/^\.?\//, '') in fs)).map((r) => `${r.from}→${r.to}`),
  };
}

// ---- output -------------------------------------------------------------------

function log(model, run, kase, step, s) {
  const calls = s.calls.map((c) => `${c.name}${c.args?.path ? `(${c.args.path})` : ''}${c.parses ? '' : '!json'}${c.schema ? '' : '!schema'}${c.edit ? `[${c.edit.matched}/${c.edit.total}]` : ''}`).join(' ');
  const row = s.row ? ` in ${s.row.tokens_in}+${s.row.tokens_cache_read ?? 0}c out ${s.row.tokens_out} $${s.row.cost_usd?.toFixed?.(5) ?? '-'}` : s.usage ? ` in ${s.usage.prompt_tokens} out ${s.usage.completion_tokens}` : '';
  const energy = s.energy ? ` ${s.energy.energy_net_j} J net ${s.gpu_c} °C` : '';
  console.log(`${short(model).padEnd(26)} r${run} ${kase.padEnd(8)} s${step} ${String(s.seconds).padStart(6)}s first ${s.first_any_s ?? '-'}s [${s.shape}] ${s.finish ?? ''} ${calls}${row}${energy}${s.error ? '  ERROR ' + s.error : ''}`);
}

function table(turns) {
  const lines = ['| model | run | case | steps | stop | calls per step | files | absolute links | missing links |', '|---|---|---|---|---|---|---|---|---|'];
  for (const t of turns) {
    lines.push(`| ${short(t.model)} | ${t.run} | ${t.case} | ${t.steps.length} | ${t.stopped} | ${t.steps.map((s) => s.calls.map((c) => c.name).join('+') || 'text').join(' / ')} | ${Object.entries(t.files).map(([p, n]) => `${p} ${n}`).join(', ')} | ${t.links.absolute} | ${t.links.missing.join(' ')} |`);
  }
  return lines.join('\n');
}

function short(m) { return m.split('/').pop(); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
