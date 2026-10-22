// visualia gateway: every model call goes through here.
// POST /v1/chat/completions  OpenAI-compatible; Bearer <course key>; `stream: true` supported
// POST /v1/decide            typed decisions (Clef-flash); images allowed
// POST /v1/images            { prompt, size } -> { data: [{ b64_json }] } (FLUX.2 klein 4B)
// GET  /usage               last rows; Bearer <teacher key>
// Models `pool/<name>` go to a classmate's computer through the pool
// (apps/pool, plans/pool.md), else to the cloud; see poolChat below.
// Trusted entrypoint (service bindings only, never the internet): `Trusted`
// takes the person and project from x-visualia-person / x-visualia-project.
// See plans/walking-skeleton.md, plans/studio-core.md.

import { WorkerEntrypoint } from 'cloudflare:workers';
import { costUsd } from './prices.js';

// Reachable only through a service binding with `entrypoint: "Trusted"`, so the
// caller (the studio) has already authenticated the person.
export class Trusted extends WorkerEntrypoint {
  async fetch(request) {
    const person = request.headers.get('x-visualia-person');
    const who = person
      ? await this.env.DB.prepare('SELECT id AS person_id, school_id, role FROM people WHERE id = ?').bind(person).first()
      : null;
    if (!who) return json({ error: 'unknown person' }, 401);
    who.project_id = request.headers.get('x-visualia-project');
    const path = new URL(request.url).pathname;
    if (path === '/v1/decide') return decide(request, this.env, who);
    if (path === '/v1/images') return images(request, this.env, who);
    return chat(request, this.env, this.ctx, who);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/v1/chat/completions' && request.method === 'POST') {
        return await chat(request, env, ctx);
      }
      if (url.pathname === '/v1/decide' && request.method === 'POST') {
        return await decide(request, env);
      }
      if (url.pathname === '/v1/images' && request.method === 'POST') {
        return await images(request, env);
      }
      if (url.pathname === '/usage' && request.method === 'GET') {
        return await usage(request, env);
      }
      return json({ error: 'not found' }, 404);
    } catch (err) {
      return json({ error: 'gateway error', detail: String(err?.message ?? err) }, 500);
    }
  },
};

// Options passed through to the model; anything else in the body is ignored.
const PASS = [
  'max_tokens', 'max_completion_tokens', 'temperature', 'top_p', 'stop', 'seed',
  'response_format', 'tools', 'tool_choice', 'reasoning_effort', 'chat_template_kwargs',
];

async function chat(request, env, ctx, trusted = null) {
  const who = trusted ?? (await identify(request, env));
  if (!who) {
    // Rate-limit failed keys per address, so keys can't be guessed by brute force.
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
    if (!(await env.KEY_LIMIT.limit({ key: ip })).success) return json({ error: 'too many attempts' }, 429);
    return json({ error: 'invalid or missing course key' }, 401);
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) {
    return json({ error: 'body must be JSON with a messages array' }, 400);
  }
  const model = body.model || env.DEFAULT_MODEL;
  const input = { messages: body.messages };
  for (const k of PASS) if (body[k] !== undefined) input[k] = body[k];
  const stream = body.stream === true;
  if (stream) {
    input.stream = true;
    input.stream_options = { include_usage: true };
  }
  const gateway = {
    gateway: {
      id: env.AI_GATEWAY_ID,
      metadata: { school: who.school_id, person: who.person_id, ...(who.project_id ? { project: who.project_id } : {}) },
    },
  };

  if (model.startsWith('pool/')) return poolChat(env, ctx, who, model, input, stream, gateway);

  const started = Date.now();
  let result;
  try {
    result = model.startsWith('m1-1/') ? await localWorker(env, model, input) : await env.AI.run(model, input, gateway);
  } catch (err) {
    const error = String(err?.message ?? err);
    await record(env, who, model, {}, { latency: Date.now() - started, error, streamed: stream });
    return json({ error: 'model call failed', detail: error }, 502);
  }

  if (!stream) {
    await record(env, who, model, { ...readUsage(result), ...energyOf(result) }, { latency: Date.now() - started, streamed: false });
    return json(toOpenAI(model, result));
  }

  // Streaming: pass the server-sent events through untouched, watch them for
  // the first token and the latest usage, and record the row exactly once:
  // when the stream ends, or when the client disconnects (cost so far is real).
  let firstToken = null;
  let usage = {};
  let buffer = '';
  let recorded = false;
  const decoder = new TextDecoder();
  const finish = (error) => {
    if (recorded) return;
    recorded = true;
    ctx.waitUntil(record(env, who, model, usage, {
      latency: Date.now() - started, firstToken, streamed: true,
      error: error ?? (usage.tokens_out == null ? 'stream ended without usage' : null),
    }));
  };
  const scan = (chunk) => {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;
      let event;
      try { event = JSON.parse(payload); } catch { continue; }
      if (firstToken == null && (event.choices?.[0]?.delta?.content || event.response)) {
        firstToken = Date.now() - started;
      }
      if (event.usage) usage = { ...readUsage(event), ...energyOf(usage) };
      if (event.visualia) usage = { ...usage, ...energyOf({ visualia: event.visualia }) };
    }
  };
  const reader = result.getReader();
  const out = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) { finish(null); controller.close(); return; }
        scan(value);
        controller.enqueue(value);
      } catch (err) {
        finish(String(err?.message ?? err));
        controller.error(err);
      }
    },
    cancel(reason) {
      finish('client disconnected');
      return reader.cancel(reason);
    },
  });
  return new Response(out, {
    headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' },
  });
}

// ---- decisions: a decision model answers typed questions with probabilities ----
// POST /v1/decide { state, questions, model? } -> { answers, model, usage }
// Default: Clef-flash on the M1 (free, measured); falls back to Workers AI.
const DECIDE_LOCAL = 'm1-1/clef-flash-8k'; // Q4_K_M with an 8k context (apps/m1-worker/README.md)
const DECIDE_CLOUD = '@cf/cloudflare/clef-flash';

async function decide(request, env, trusted = null) {
  const who = trusted ?? (await identify(request, env));
  if (!who) return json({ error: 'invalid or missing course key' }, 401);
  const body = await request.json().catch(() => null);
  if (!body?.state || !body?.questions) return json({ error: 'state and questions are needed' }, 400);

  // The M1's Clef runs on llama.cpp without the vision encoder: pictures go to the cloud.
  const pics = Array.isArray(body.images) && body.images.length ? { images: body.images.slice(0, 4) } : {};
  const tries = body.model ? [body.model] : pics.images ? [DECIDE_CLOUD] : [DECIDE_LOCAL, DECIDE_CLOUD];
  let lastError = null;
  for (const model of tries) {
    const started = Date.now();
    try {
      let result;
      if (model.startsWith('m1-1/')) {
        // The M1 holds one model at a time. If Clef isn't the one loaded, a
        // reload takes 8-18 s: go to the cloud now instead.
        const ready = await fetch(`${env.M1_URL}/v1/loaded`, {
          headers: { authorization: `Bearer ${env.M1_SECRET}` }, signal: AbortSignal.timeout(2000),
        }).then((r) => r.json()).catch(() => null);
        const name = model.slice('m1-1/'.length);
        if (!body.model && !ready?.models?.some((m) => m.startsWith(name))) continue;
        const res = await fetch(`${env.M1_URL}/v1/systemone`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${env.M1_SECRET}` },
          body: JSON.stringify({ model: model.slice('m1-1/'.length), state: body.state, questions: body.questions }),
          signal: AbortSignal.timeout(8000), // a warm M1 answers in 1-3 s; a hung tunnel mustn't hold the check
        });
        if (!res.ok) throw new Error(`m1-1 ${res.status}`);
        result = await res.json();
      } else {
        result = await env.AI.run(model, { state: body.state, questions: body.questions, ...pics }, {
          gateway: { id: env.AI_GATEWAY_ID, metadata: { school: who.school_id, person: who.person_id } },
        });
      }
      const u = result.usage ?? {};
      await record(env, who, model, {
        tokens_in: u.input_tokens ?? u.prompt_tokens ?? null, tokens_out: 0, neurons: u.neurons ?? null,
        ...energyOf(result),
      }, { latency: Date.now() - started, streamed: false });
      return json({ answers: result.answers, model, usage: u });
    } catch (err) {
      lastError = String(err?.message ?? err);
      await record(env, who, model, {}, { latency: Date.now() - started, streamed: false, error: lastError });
    }
  }
  return json({ error: 'decision failed', detail: lastError }, 502);
}

// ---- images: text to image, OpenAI-ish ----------------------------------------
// POST /v1/images { prompt, size: '1024x1024' } -> { data: [{ b64_json }], model, usage }
// FLUX.2 klein 4B on Workers AI: 4 fixed steps, multipart input, base64 out.
// No usage comes back, so neurons are counted from the pricing page:
// 26.05 per output 512x512 tile (a 1024x1024 image: 104.2, about $0.0011).
const IMAGE_MODEL = '@cf/black-forest-labs/flux-2-klein-4b';
const NEURONS_PER_TILE = 26.05;

async function images(request, env, trusted = null) {
  const who = trusted ?? (await identify(request, env));
  if (!who) return json({ error: 'invalid or missing course key' }, 401);
  const body = await request.json().catch(() => null);
  const prompt = String(body?.prompt ?? '').trim().slice(0, 2000);
  if (!prompt) return json({ error: 'a prompt is needed' }, 400);
  // Sides between 256 and 1024, multiples of 16.
  const [w, h] = String(body.size ?? '1024x1024').split('x').map((n) => Math.min(1024, Math.max(256, Math.round((Number(n) || 1024) / 16) * 16)));
  const model = IMAGE_MODEL;
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('width', String(w));
  form.append('height', String(h));
  const multipart = new Response(form);
  const started = Date.now();
  try {
    // Not through AI Gateway: it refuses a streamed form and loses the fields of
    // a buffered one (2026-10-22). The usage row below is still written.
    const result = await env.AI.run(model, { multipart: { body: multipart.body, contentType: multipart.headers.get('content-type') } });
    if (!result?.image) throw new Error('no image in the answer');
    const neurons = Math.ceil(w / 512) * Math.ceil(h / 512) * NEURONS_PER_TILE;
    await record(env, who, model, { neurons }, { latency: Date.now() - started, streamed: false });
    return json({ created: Math.floor(Date.now() / 1000), model, size: `${w}x${h}`, data: [{ b64_json: result.image }], usage: { neurons } });
  } catch (err) {
    const error = String(err?.message ?? err);
    await record(env, who, model, {}, { latency: Date.now() - started, streamed: false, error });
    return json({ error: 'image failed', detail: error }, 502);
  }
}

// m1-1: the M1 laptop on Kristjan's LAN, running Ollama behind a Cloudflare
// Tunnel and a secret-checking proxy (plans/local-models.md). Same OpenAI
// shapes as Workers AI: a JSON body, or an SSE stream when input.stream is set.
async function localWorker(env, model, input) {
  const res = await fetch(`${env.M1_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.M1_SECRET}` },
    body: JSON.stringify({ ...input, model: model.slice('m1-1/'.length) }),
  });
  if (!res.ok) throw new Error(`m1-1 ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return input.stream ? res.body : res.json();
}

// ---- pool: a classmate's computer, else the cloud --------------------------------
// The job goes to the school's Pool (service binding POOL, apps/pool) with the
// school and the messages only, never who asked. No worker online, or it fails
// before its first word: the cloud answers instead. The worker leaves or stalls
// mid-answer: the cloud is asked to continue from the words already sent, and
// the caller's stream goes on (one chunk with `visualia.served_by` marks the
// switch). Each part gets its own usage row: the pool part at $0 with
// served_by = the worker's person id, the cloud part as usual.
const CONTINUE = 'Your answer above was cut off. Continue it from the exact word where it stopped, mid-sentence if it stopped mid-sentence. Do not repeat anything, do not comment, just continue.';

async function poolChat(env, ctx, who, model, input, stream, gateway) {
  const fallback = env.POOL_FALLBACK || env.DEFAULT_MODEL;
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  let gone = false;       // the caller disconnected
  let reading = null;     // the stream being relayed, cancelled if the caller leaves
  writer.closed.catch(() => { gone = true; reading?.cancel().catch(() => {}); });
  const emit = (event) => {
    if (!stream || gone) return;
    writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)).catch(() => { gone = true; });
  };
  let text = '';
  let finish = 'stop';
  let servedModel = model;
  const usageOut = {};

  // Estonian free text skips the small model: it wrote no usable Estonian in
  // research/browser-models.md. With a schema (groups, titles) it stays.
  let reason = model === 'pool/qwen2.5-1.5b' && !hasSchema(input.response_format) && looksEstonian(input.messages)
    ? 'Estonian text: the small pool model writes poor Estonian' : null;

  const run = async () => {
    // 1. The pool.
    if (!reason) {
      const started = Date.now();
      let res = null;
      try {
        res = await env.POOL.fetch('https://pool/job', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-visualia-school': who.school_id },
          body: JSON.stringify({ model: model.slice('pool/'.length), input }),
        });
      } catch (err) {
        reason = `pool unreachable: ${String(err?.message ?? err)}`;
      }
      if (res && !res.ok) reason = (await res.json().catch(() => ({}))).error ?? `pool ${res.status}`;
      if (res?.ok) {
        const servedBy = res.headers.get('x-pool-served-by');
        let firstToken = null, done = false, error = null, deltas = 0, u = {};
        await relay(res.body, (r) => (reading = r), (e) => {
          if (e === '[DONE]') { done = true; return; }
          if (e.pool_error) { error = e.pool_error; return; }
          if (e.usage) { u = e.usage; return; }
          const c = e.choices?.[0];
          if (c?.delta?.content) {
            if (firstToken == null) firstToken = Date.now() - started;
            text += c.delta.content;
            deltas++;
          }
          if (c?.finish_reason) finish = c.finish_reason;
          emit(e);
        });
        if (!done && !error) error = gone ? 'client disconnected' : 'pool stream ended early';
        await record(env, who, model, {
          tokens_in: u.prompt_tokens ?? null, tokens_out: u.completion_tokens ?? deltas,
        }, { latency: Date.now() - started, firstToken, streamed: stream, error: done ? null : error, servedBy });
        usageOut.prompt_tokens = u.prompt_tokens ?? null;
        usageOut.completion_tokens = u.completion_tokens ?? deltas;
        if (done || gone) return { servedBy };
        reason = error;
      }
    }

    // 2. The cloud: the whole answer, or the rest of it.
    servedModel = fallback;
    emit({ object: 'chat.completion.chunk', model: fallback, choices: [], visualia: { served_by: 'cloud', model: fallback, reason, continued: !!text } });
    const messages = text
      ? [...input.messages, { role: 'assistant', content: text }, { role: 'user', content: CONTINUE }]
      : input.messages;
    const seam = !!text;
    const cloudStarted = Date.now();
    let firstToken = null, usage = {}, error = null;
    try {
      // Thinking off, like the tab model: else the default model spends the
      // token budget reasoning before it writes (seen 2026-10-22).
      // A schema in our shape becomes Workers AI's json_schema. A continuation
      // goes without it: the rest of a JSON text isn't a JSON text itself.
      const { response_format, ...rest } = input;
      const format = seam ? null : cloudFormat(response_format);
      const body = await env.AI.run(fallback, {
        chat_template_kwargs: { enable_thinking: false },
        ...rest, ...(format ? { response_format: format } : {}),
        messages, stream: true, stream_options: { include_usage: true },
      }, gateway);
      await relay(body, (r) => (reading = r), (e) => {
        if (e === '[DONE]') return;
        if (e.usage) usage = readUsage(e);
        const c = e.choices?.[0];
        let content = c?.delta?.content ?? e.response;
        if (c?.finish_reason) finish = c.finish_reason;
        if (!content && !c?.finish_reason) return;
        if (content && firstToken == null) {
          firstToken = Date.now() - cloudStarted;
          // A continuation starts without the space the cut-off word needs.
          if (seam && /[\p{L}\p{N},.;:!?]$/u.test(text) && /^[\p{L}\p{N}]/u.test(content)) content = ` ${content}`;
        }
        if (content) text += content;
        emit({ object: 'chat.completion.chunk', model: fallback, choices: [{ index: 0, delta: content ? { content } : {}, finish_reason: c?.finish_reason ?? null }] });
      });
      if (gone) error = 'client disconnected';
      else if (usage.tokens_out == null) error = 'stream ended without usage';
    } catch (err) {
      error = String(err?.message ?? err);
      emit({ error: { message: `model call failed: ${error}` } });
    }
    await record(env, who, fallback, usage, { latency: Date.now() - cloudStarted, firstToken, streamed: stream, error });
    usageOut.prompt_tokens = (usageOut.prompt_tokens ?? 0) + (usage.tokens_in ?? 0) + (usage.tokens_cache_read ?? 0);
    usageOut.completion_tokens = (usageOut.completion_tokens ?? 0) + (usage.tokens_out ?? 0);
    if (error && !text) throw new Error(error);
    return { servedBy: 'cloud' };
  };

  if (stream) {
    ctx.waitUntil(run().catch(() => {}).finally(() => {
      if (gone) return;
      emit({ object: 'chat.completion.chunk', model: servedModel, choices: [], usage: usageOut });
      writer.write(encoder.encode('data: [DONE]\n\n')).catch(() => {});
      writer.close().catch(() => {});
    }));
    return new Response(readable, {
      headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' },
    });
  }
  try {
    const { servedBy } = await run();
    return json({
      object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: servedModel,
      choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: finish }],
      usage: usageOut, visualia: { served_by: servedBy, ...(servedBy === 'cloud' && reason ? { reason } : {}) },
    });
  } catch (err) {
    return json({ error: 'model call failed', detail: String(err?.message ?? err) }, 502);
  }
}

// A JSON schema in the request, in our shape or OpenAI's.
function hasSchema(rf) {
  return (rf?.type === 'json_object' && rf.schema != null) || (rf?.type === 'json_schema' && rf.json_schema?.schema != null);
}

// What Workers AI takes for DEFAULT_MODEL: text, json_object (no schema) or
// json_schema { name, schema, strict } (its model schema, checked 2026-10-22).
function cloudFormat(rf) {
  if (!rf || rf.type !== 'json_object' || rf.schema == null) return rf ?? null;
  let schema = rf.schema;
  if (typeof schema === 'string') try { schema = JSON.parse(schema); } catch { return { type: 'json_object' }; }
  return { type: 'json_schema', json_schema: { name: 'answer', schema, strict: true } };
}

// The last user message: õ ä ö ü š ž, or two common Estonian words.
const ET_WORDS = new Set(['ja', 'kas', 'mis', 'kuidas', 'miks', 'palun', 'tere', 'ning', 'mida', 'seda', 'olen', 'oled',
  'kirjuta', 'mulle', 'minu', 'sinu', 'ole', 'kus', 'kui', 'selle', 'siis', 'veel', 'teha', 'saab', 'lehe', 'leht']);
function looksEstonian(messages) {
  const last = [...messages].reverse().find((m) => m?.role === 'user');
  const t = typeof last?.content === 'string' ? last.content.toLowerCase() : '';
  if (/[õäöüšž]/.test(t)) return true;
  return new Set(t.match(/\p{L}+/gu)?.filter((w) => ET_WORDS.has(w))).size >= 2;
}

// Reads a server-sent event stream and calls onEvent with each parsed event
// (or the string '[DONE]'). onReader gets the reader, so it can be cancelled.
async function relay(body, onReader, onEvent) {
  const reader = body.getReader();
  onReader(reader);
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') { onEvent('[DONE]'); continue; }
        try { onEvent(JSON.parse(payload)); } catch {}
      }
    }
  } catch {} // a broken stream ends like a short one; the caller decides
}

const encoder = new TextEncoder();

async function record(env, who, model, usage, { latency, firstToken = null, streamed, error = null, servedBy = null }) {
  await env.DB.prepare(
    `INSERT INTO usage (school_id, person_id, project_id, model, tokens_in, tokens_cache_read, tokens_cache_write,
       tokens_out, tokens_reasoning, neurons, latency_ms, first_token_ms, streamed, cost_usd, ok, error,
       energy_j, energy_net_j, sys_energy_j, energy_source, served_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(...[
      who.school_id, who.person_id, who.project_id, model,
      usage.tokens_in, usage.tokens_cache_read, usage.tokens_cache_write,
      usage.tokens_out, usage.tokens_reasoning, usage.neurons,
      latency, firstToken, streamed ? 1 : 0,
      costUsd(model, usage), error ? 0 : 1, error, // a failed or cut-off call can still have cost
      usage.energy_j, usage.energy_net_j, usage.sys_energy_j, usage.energy_source, servedBy,
    ].map((v) => v ?? null)) // D1 rejects undefined
    .run();
}

// Energy measured by the worker (m1-1's proxy adds `visualia`), else nothing.
function energyOf(x) {
  const v = x?.visualia;
  if (v) return { energy_j: v.energy_j, energy_net_j: v.energy_net_j, sys_energy_j: v.sys_energy_j, energy_source: v.source };
  const { energy_j, energy_net_j, sys_energy_j, energy_source } = x ?? {};
  return energy_j == null ? {} : { energy_j, energy_net_j, sys_energy_j, energy_source };
}

// Workers AI returns either { response, usage } or an OpenAI-shaped
// { choices, usage }; usage may carry cached-token details.
function readUsage(result) {
  const u = result?.usage ?? {};
  const cached = u.prompt_tokens_details?.cached_tokens ?? null;
  const prompt = u.prompt_tokens ?? null;
  return {
    tokens_in: prompt == null ? null : prompt - (cached ?? 0),
    tokens_cache_read: cached,
    tokens_cache_write: null,
    tokens_out: u.completion_tokens ?? null,
    tokens_reasoning: u.completion_tokens_details?.reasoning_tokens ?? null,
    neurons: u.neurons ?? null,
  };
}

function toOpenAI(model, result) {
  if (result?.choices) return { ...result, model };
  return {
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      { index: 0, message: { role: 'assistant', content: result?.response ?? '' }, finish_reason: 'stop' },
    ],
    usage: result?.usage,
  };
}

async function usage(request, env) {
  const who = await identify(request, env);
  if (!who || who.role !== 'teacher') return json({ error: 'teacher key required' }, 401);
  const { results } = await env.DB.prepare(
    'SELECT * FROM usage WHERE school_id = ? ORDER BY id DESC LIMIT 50',
  )
    .bind(who.school_id)
    .all();
  return json(results);
}

async function identify(request, env) {
  const auth = request.headers.get('authorization') ?? '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!key) return null;
  const hash = await sha256(key.toUpperCase().replace(/[^A-Z]/g, '')); // KMRT-WABE = kmrtwabe
  return env.DB.prepare(
    `SELECT p.id AS person_id, p.school_id, p.role
       FROM keys k JOIN people p ON p.id = k.person_id
      WHERE k.hash = ? AND k.revoked_at IS NULL`,
  )
    .bind(hash)
    .first();
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
