// visualia gateway: every model call goes through here.
// POST /v1/chat/completions  OpenAI-compatible; Bearer <course key>
// GET  /usage               last rows; Bearer <teacher key>
// See plans/walking-skeleton.md.

import { costUsd } from './prices.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/v1/chat/completions' && request.method === 'POST') {
        return await chat(request, env);
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

async function chat(request, env) {
  const who = await identify(request, env);
  if (!who) return json({ error: 'invalid or missing course key' }, 401);

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) {
    return json({ error: 'body must be JSON with a messages array' }, 400);
  }
  const model = body.model || env.DEFAULT_MODEL;

  const started = Date.now();
  let result;
  let error = null;
  try {
    result = await env.AI.run(
      model,
      { messages: body.messages, max_tokens: body.max_tokens, temperature: body.temperature },
      {
        gateway: {
          id: env.AI_GATEWAY_ID,
          metadata: { school: who.school_id, person: who.person_id },
        },
      },
    );
  } catch (err) {
    error = String(err?.message ?? err);
  }
  const latency = Date.now() - started;

  const usage = readUsage(result);
  await env.DB.prepare(
    `INSERT INTO usage (school_id, person_id, model, tokens_in, tokens_cache_read, tokens_cache_write,
       tokens_out, tokens_reasoning, neurons, latency_ms, cost_usd, ok, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      who.school_id, who.person_id, model,
      usage.tokens_in, usage.tokens_cache_read, usage.tokens_cache_write,
      usage.tokens_out, usage.tokens_reasoning, usage.neurons,
      latency, error ? null : costUsd(model, usage), error ? 0 : 1, error,
    )
    .run();

  if (error) return json({ error: 'model call failed', detail: error }, 502);
  return json(toOpenAI(model, result));
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
