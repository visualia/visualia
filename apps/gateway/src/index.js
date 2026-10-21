// visualia gateway: every model call goes through here.
// POST /v1/chat/completions  OpenAI-compatible; Bearer <course key>; `stream: true` supported
// GET  /usage               last rows; Bearer <teacher key>
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
  if (!who) return json({ error: 'invalid or missing course key' }, 401);

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

  const started = Date.now();
  let result;
  try {
    result = await env.AI.run(model, input, gateway);
  } catch (err) {
    const error = String(err?.message ?? err);
    await record(env, who, model, {}, { latency: Date.now() - started, error, streamed: stream });
    return json({ error: 'model call failed', detail: error }, 502);
  }

  if (!stream) {
    await record(env, who, model, readUsage(result), { latency: Date.now() - started, streamed: false });
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
      if (event.usage) usage = readUsage(event);
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

async function record(env, who, model, usage, { latency, firstToken = null, streamed, error = null }) {
  await env.DB.prepare(
    `INSERT INTO usage (school_id, person_id, project_id, model, tokens_in, tokens_cache_read, tokens_cache_write,
       tokens_out, tokens_reasoning, neurons, latency_ms, first_token_ms, streamed, cost_usd, ok, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(...[
      who.school_id, who.person_id, who.project_id, model,
      usage.tokens_in, usage.tokens_cache_read, usage.tokens_cache_write,
      usage.tokens_out, usage.tokens_reasoning, usage.neurons,
      latency, firstToken, streamed ? 1 : 0,
      costUsd(model, usage), error ? 0 : 1, error, // a failed or cut-off call can still have cost
    ].map((v) => v ?? null)) // D1 rejects undefined
    .run();
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
  const hash = await sha256(key);
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
