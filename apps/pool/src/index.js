// visualia pool: shared compute that connects out only (plans/pool.md).
//
// GET  /join      the pool page: sign in with a course key, then "Join the pool"
// GET  /share     old address, redirects to /join
// POST /login     course key (form body, never the URL) -> signed host-only cookie
// POST /logout
// GET  /me        { person, school } for the signed-in person, else 401
// GET  /connect   WebSocket upgrade: a worker (a tab, or worker-node.mjs) joins its own school's Pool
//
// The gateway reaches the pool only through a service binding (entrypoint
// ForGateway), never over the internet. One Pool Durable Object per school
// holds the open worker sockets and relays jobs. Nothing about a job is stored:
// the prompt passes through memory to one worker, the tokens pass back.

import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers';

const COOKIE = '__Host-pool';
const FIRST_MS = 30_000;     // a worker must start answering within this
const IDLE_MS = 15_000;      // ...and not go quiet for longer than this between tokens
// Per model: characters in, tokens out, characters back (a worker sending more is
// cut off). The tab models have a 4,096-token context; the node models can make
// whole pages.
const LIMITS = {
  'qwen2.5-1.5b': { prompt: 12_000, tokens: 2048, out: 32_000 },
  'qwen3-4b': { prompt: 12_000, tokens: 2048, out: 32_000 },
  'qwen3.5-9b': { prompt: 48_000, tokens: 8000, out: 64_000 },
  'gemma4-26b': { prompt: 48_000, tokens: 8000, out: 64_000 },
};
// A tab has a 4,096-token context whatever the model, so a node model's job
// goes to a tab only when it fits these (qwen3.5-9b runs in tabs and on nodes).
const TAB = { prompt: 12_000, tokens: 2048 };
// Decision models answer /v1/decide (state + typed questions -> answers), one
// JSON reply, no stream. Loaded when asked: a cold start takes 8-18 s.
const DECIDE = { 'clef-flash': { prompt: 32_000, out: 32_000 } };
const DECIDE_MS = 40_000;    // the whole answer, model load included
const MAX_SCHEMA = 8_000;    // characters of JSON schema

// ---- the gateway's door ---------------------------------------------------------

// Reachable only through a service binding with `entrypoint: "ForGateway"`.
// The gateway has already checked the asker's key; it sends the school (to pick
// the right Pool) and the job, and nothing about who asked.
export class ForGateway extends WorkerEntrypoint {
  async fetch(request) {
    const school = request.headers.get('x-visualia-school');
    if (!school) return json({ error: 'no school' }, 400);
    const pool = this.env.POOL.get(this.env.POOL.idFromName(school));
    const path = new URL(request.url).pathname === '/decide' ? '/decide' : '/job';
    return pool.fetch(`https://pool${path}`, { method: 'POST', body: await request.text() });
  }
}

// ---- the public side: the pool page, sign in, connect ------------------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/' || url.pathname === '/share') return Response.redirect(`${url.origin}/join`, 301);
      if (url.pathname === '/join') return joinPage(request, env);
      if (url.pathname === '/login' && request.method === 'POST') return await login(request, env);
      if (url.pathname === '/logout' && request.method === 'POST') return logout(request, env);
      if (url.pathname === '/me') {
        const who = await session(request, env);
        return who ? json(who) : json({ error: 'not signed in' }, 401);
      }
      if (url.pathname === '/connect') return await connect(request, env);
      return env.ASSETS.fetch(request); // visualia.css
    } catch (err) {
      return json({ error: 'pool error', detail: String(err?.message ?? err) }, 500);
    }
  },
};

// The page may talk only to the addresses it lists in "Addresses": the browser
// enforces it with this policy.
const CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' wss://pool.visualia.space https://cdn.jsdelivr.net https://huggingface.co https://*.hf.co https://raw.githubusercontent.com",
  "img-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ');

async function joinPage(request, env) {
  const res = await env.ASSETS.fetch(new Request(new URL('/join', request.url), request));
  const headers = new Headers(res.headers);
  headers.set('content-security-policy', CSP);
  headers.set('referrer-policy', 'no-referrer');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(res.body, { status: res.status, headers });
}

async function connect(request, env) {
  if (request.headers.get('upgrade') !== 'websocket') return json({ error: 'WebSocket only' }, 426);
  // Only this site's own page may open a worker socket (the cookie alone isn't enough).
  // worker-node.mjs, which is no browser, signs in the same way and sends this Origin too.
  if (request.headers.get('origin') !== `https://${env.HOST}`) return json({ error: 'wrong origin' }, 403);
  const who = await session(request, env);
  if (!who) return json({ error: 'not signed in' }, 401);
  const pool = env.POOL.get(env.POOL.idFromName(who.school));
  return pool.fetch('https://pool/connect', { headers: { upgrade: 'websocket', 'x-pool-person': who.person } });
}

// Same check as the gateway and the studio: the key's SHA-256 hash, 10 tries a
// minute per address. The key arrives in the form body and is never stored.
async function login(request, env) {
  if (request.headers.get('origin') !== `https://${env.HOST}`) return json({ error: 'wrong origin' }, 403);
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (!(await env.LOGIN_LIMIT.limit({ key: ip })).success) return text('Too many attempts. Wait a minute.', 429);
  const form = await request.formData();
  const key = String(form.get('key') ?? '').trim();
  const row = key
    ? await env.DB.prepare(
        'SELECT p.id FROM keys k JOIN people p ON p.id = k.person_id WHERE k.hash = ? AND k.revoked_at IS NULL',
      ).bind(await sha256(key.toUpperCase().replace(/[^A-Z]/g, ''))).first()
    : null;
  if (!row) return new Response(null, { status: 303, headers: { location: '/join?wrong' } });
  const value = `${row.id}.${await sign(env, row.id)}`;
  return new Response(null, {
    status: 303,
    headers: {
      location: '/join',
      'set-cookie': `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 120}`,
    },
  });
}

function logout(request, env) {
  if (request.headers.get('origin') !== `https://${env.HOST}`) return json({ error: 'wrong origin' }, 403);
  return new Response(null, {
    status: 303,
    headers: { location: '/join', 'set-cookie': `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0` },
  });
}

// The signed cookie, and the person must still hold a key that isn't revoked:
// revoking a key also stops that person's worker at its next connect.
async function session(request, env) {
  const m = (request.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const i = m[1].lastIndexOf('.');
  const person = m[1].slice(0, i);
  if (!person || m[1].slice(i + 1) !== (await sign(env, person))) return null;
  const row = await env.DB.prepare(
    `SELECT p.id AS person, p.school_id AS school FROM people p
      WHERE p.id = ? AND EXISTS (SELECT 1 FROM keys k WHERE k.person_id = p.id AND k.revoked_at IS NULL)`,
  ).bind(person).first();
  return row ?? null;
}

// ---- the Pool: one per school ---------------------------------------------------
//
// Protocol (JSON text frames; "ping" -> "pong" is answered without waking the object):
//   tab  -> pool  { type: 'hello', models: ['qwen2.5-1.5b'] }        once its model is loaded
//   pool -> tab   { type: 'welcome', person, workers }
//   pool -> tab   { type: 'job', id, model, messages, max_tokens, temperature, top_p, stop, seed,
//                   response_format: { type: 'json_object', schema: '<JSON schema as a string>' } }
//   tab  -> pool  { type: 'delta', id, content }                      per token (or a few)
//   tab  -> pool  { type: 'done', id, usage: { prompt_tokens, completion_tokens }, finish_reason }
//                 a worker that measures energy (the node worker, macmon) adds to usage:
//                 energy_j, energy_net_j, sys_energy_j (joules), energy_source ('macmon')
//   tab  -> pool  { type: 'error', id, message }
//   pool -> tab   { type: 'cancel', id }                              the asker left, or too slow
//   decisions (node workers only):
//   pool -> node  { type: 'job', id, kind: 'decide', model, state, questions }
//   node -> pool  { type: 'done', id, answers, usage }                  or { type: 'error', id, message }
//
// To the gateway, a job is an OpenAI-style event stream. If the worker leaves,
// errs or stalls, the stream ends with { pool_error } instead of [DONE], so the
// gateway can finish the answer in the cloud.

export class Pool extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.jobs = new Map(); // job id -> job; in memory only, a job lives as long as its request
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/connect') return this.connect(request);
    if (path === '/job') return this.job(request);
    if (path === '/decide') return this.decide(request);
    return json({ error: 'not found' }, 404);
  }

  connect(request) {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ person: request.headers.get('x-pool-person'), models: [], job: null, last: 0 });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  // An idle worker with the model; the one idle longest goes first. Marks it busy.
  take(model, id, tabOk = true) {
    const free = this.workers()
      .filter(({ a }) => !a.job && a.models?.includes(model) && (tabOk || a.kind === 'node'))
      .sort((x, y) => x.a.last - y.a.last)[0];
    if (!free) return null;
    free.a.job = id;
    free.a.last = Date.now();
    free.ws.serializeAttachment(free.a);
    return free;
  }

  async decide(request) {
    const body = await request.json().catch(() => null);
    const model = String(body?.model ?? '');
    const limit = DECIDE[model];
    if (!limit) return json({ error: 'not a pool decision model' }, 400);
    if (typeof body.state !== 'string' || !body.questions || typeof body.questions !== 'object') return json({ error: 'state and questions are needed' }, 400);
    if (body.state.length + JSON.stringify(body.questions).length > limit.prompt) return json({ error: 'too long for the pool' }, 413);
    const id = crypto.randomUUID();
    const free = this.take(model, id);
    if (!free) return json({ error: 'no worker online for this model' }, 503);
    const answer = await new Promise((resolve) => {
      const job = { id, ws: free.ws, model, decide: resolve, maxOut: limit.out, over: false, timer: null };
      this.jobs.set(id, job);
      free.ws.send(JSON.stringify({ type: 'job', id, kind: 'decide', model, state: body.state, questions: body.questions }));
      this.arm(job, DECIDE_MS);
    });
    return answer.error
      ? json({ error: answer.error }, 502)
      : json({ answers: answer.answers, usage: answer.usage, served_by: free.a.person, kind: free.a.kind ?? 'node' });
  }

  workers() {
    return this.ctx.getWebSockets().map((ws) => ({ ws, a: ws.deserializeAttachment() ?? {} }));
  }

  async job(request) {
    const body = await request.json().catch(() => null);
    const model = String(body?.model ?? '');
    const limit = LIMITS[model];
    if (!limit) return json({ error: 'not a pool model' }, 400);
    const messages = cleanMessages(body?.input?.messages);
    if (!messages) return json({ error: 'only plain text messages go to the pool' }, 422);
    if (messages.reduce((n, m) => n + m.content.length, 0) > limit.prompt) return json({ error: 'prompt too long for the pool' }, 413);
    const format = jsonFormat(body?.input?.response_format);
    if (format === false) return json({ error: 'this response_format is not for the pool' }, 422);

    const input = body.input ?? {};
    const wanted = Number(input.max_tokens ?? input.max_completion_tokens) || 1024;
    const chars = messages.reduce((n, m) => n + m.content.length, 0);
    const id = crypto.randomUUID();
    const free = this.take(model, id, chars <= TAB.prompt && wanted <= TAB.tokens);
    if (!free) return json({ error: 'no worker online for this model' }, 503);
    const { ws, a } = free;

    const { readable, writable } = new TransformStream();
    const job = { id, ws, model, maxOut: limit.out, writer: writable.getWriter(), chars: 0, deltas: 0, timer: null, over: false };
    this.jobs.set(id, job);
    // The asker left (the gateway cancelled the stream): stop the worker.
    job.writer.closed.catch(() => this.end(job, null, 'caller left'));

    ws.send(JSON.stringify({
      type: 'job', id, model, messages,
      max_tokens: Math.min(wanted, limit.tokens),
      ...(typeof input.temperature === 'number' ? { temperature: input.temperature } : {}),
      ...(typeof input.top_p === 'number' ? { top_p: input.top_p } : {}),
      ...(input.stop ? { stop: input.stop } : {}),
      ...(Number.isInteger(input.seed) ? { seed: input.seed } : {}),
      ...(format ? { response_format: format } : {}),
    }));
    this.arm(job, FIRST_MS);
    return new Response(readable, {
      headers: { 'content-type': 'text/event-stream; charset=utf-8', 'x-pool-served-by': a.person, 'x-pool-kind': a.kind ?? 'tab', 'x-pool-job': id },
    });
  }

  async webSocketMessage(ws, data) {
    if (typeof data !== 'string') return;
    let m;
    try { m = JSON.parse(data); } catch { return; }
    const a = ws.deserializeAttachment() ?? {};

    if (m.type === 'hello') {
      a.models = (Array.isArray(m.models) ? m.models : [])
        .filter((x) => typeof x === 'string' && /^[a-z0-9.\-]{1,40}$/.test(x)).slice(0, 8);
      a.kind = m.kind === 'node' ? 'node' : 'tab'; // for the audit trail
      ws.serializeAttachment(a);
      const workers = this.workers().filter((w) => w.a.models?.length).length;
      ws.send(JSON.stringify({ type: 'welcome', person: a.person, workers }));
      return;
    }

    // Everything else belongs to this worker's current job, or is ignored.
    const job = m.id && a.job === m.id ? this.jobs.get(m.id) : null;
    if (!job) return;
    if (job.decide) {
      if (m.type === 'error') return this.end(job, `worker error: ${String(m.message ?? '').slice(0, 200)}`);
      if (m.type !== 'done') return;
      const answers = m.answers && typeof m.answers === 'object' && !Array.isArray(m.answers) ? m.answers : null;
      if (!answers || JSON.stringify(answers).length > job.maxOut) return this.end(job, 'worker sent no usable answers');
      const u = m.usage ?? {};
      job.result = { answers, usage: { prompt_tokens: num(u.prompt_tokens), ...energy(u) } };
      return this.end(job, null);
    }
    if (m.type === 'delta' && typeof m.content === 'string') {
      job.chars += m.content.length;
      if (job.chars > job.maxOut) return this.end(job, 'worker sent too much');
      job.deltas++;
      this.write(job, { choices: [{ index: 0, delta: { content: m.content }, finish_reason: null }] });
      this.arm(job, IDLE_MS);
    } else if (m.type === 'done') {
      const u = m.usage ?? {};
      const usage = {
        prompt_tokens: num(u.prompt_tokens),
        completion_tokens: num(u.completion_tokens) ?? job.deltas,
        ...energy(u),
      };
      this.write(job, { choices: [{ index: 0, delta: {}, finish_reason: m.finish_reason === 'length' ? 'length' : 'stop' }] });
      this.write(job, { choices: [], usage });
      this.end(job, null);
    } else if (m.type === 'error') {
      this.end(job, `worker error: ${String(m.message ?? '').slice(0, 200)}`);
    }
  }

  async webSocketClose(ws) { this.left(ws); }
  async webSocketError(ws) { this.left(ws); }

  left(ws) {
    const a = ws.deserializeAttachment() ?? {};
    const job = a.job ? this.jobs.get(a.job) : null;
    if (job) this.end(job, 'worker left');
    try { ws.close(1000, 'bye'); } catch {}
  }

  arm(job, ms) {
    clearTimeout(job.timer);
    job.timer = setTimeout(() => this.end(job, 'worker too slow'), ms);
  }

  write(job, chunk) {
    if (job.over) return;
    const event = { object: 'chat.completion.chunk', model: `pool/${job.model}`, ...chunk };
    job.writer.write(enc(`data: ${JSON.stringify(event)}\n\n`)).catch(() => {});
  }

  // Ends a job once: done (error null), failed (error: the stream ends with
  // pool_error, and the worker is told to stop), or the caller left.
  end(job, error, callerLeft = null) {
    if (job.over) return;
    clearTimeout(job.timer);
    if (job.decide) {
      job.over = true;
      this.jobs.delete(job.id);
      job.decide(error ? { error } : job.result);
      try {
        const a = job.ws.deserializeAttachment() ?? {};
        if (a.job === job.id) { a.job = null; job.ws.serializeAttachment(a); }
        if (error) job.ws.send(JSON.stringify({ type: 'cancel', id: job.id }));
      } catch {}
      return;
    }
    if (error) job.writer.write(enc(`data: ${JSON.stringify({ pool_error: error, deltas: job.deltas })}\n\n`)).catch(() => {});
    else if (!callerLeft) job.writer.write(enc('data: [DONE]\n\n')).catch(() => {});
    job.over = true;
    job.writer.close().catch(() => {});
    this.jobs.delete(job.id);
    try {
      const a = job.ws.deserializeAttachment() ?? {};
      if (a.job === job.id) { a.job = null; job.ws.serializeAttachment(a); }
      if (error || callerLeft) job.ws.send(JSON.stringify({ type: 'cancel', id: job.id }));
    } catch {} // the socket is gone already
  }
}

// Plain text chat only: images, tools and other parts stay with the cloud.
function cleanMessages(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const out = [];
  for (const m of list) {
    if (!['system', 'user', 'assistant'].includes(m?.role) || typeof m.content !== 'string') return null;
    out.push({ role: m.role, content: m.content });
  }
  return out;
}

// JSON output, as WebLLM takes it: { type: 'json_object', schema: '<string>' }.
// Accepts our shape ({ type: 'json_object', schema }) and OpenAI's
// ({ type: 'json_schema', json_schema: { schema } }). null: none or plain text;
// false: something the tab can't do (the cloud takes it).
function jsonFormat(rf) {
  if (rf == null || rf.type === 'text') return null;
  const schema = rf.type === 'json_object' ? rf.schema : rf.type === 'json_schema' ? rf.json_schema?.schema : undefined;
  if (rf.type === 'json_object' && schema == null) return { type: 'json_object' };
  const s = typeof schema === 'string' ? schema : schema && typeof schema === 'object' ? JSON.stringify(schema) : null;
  return s && s.length <= MAX_SCHEMA ? { type: 'json_object', schema: s } : false;
}

// ---- helpers ----------------------------------------------------------------------

const encoder = new TextEncoder();
const enc = (s) => encoder.encode(s);
const num = (v) => (Number.isFinite(v) ? v : null);

// Energy a worker measured for one job: joules, 0 to 1 MJ (a job is at most a
// few minutes), and where it came from. Anything else is dropped.
function energy(u) {
  const j = (v) => (Number.isFinite(v) && v >= 0 && v < 1e6 ? Math.round(v * 100) / 100 : null);
  if (j(u.energy_j) == null) return {};
  return {
    energy_j: j(u.energy_j), energy_net_j: j(u.energy_net_j), sys_energy_j: j(u.sys_energy_j),
    energy_source: /^[a-z-]{1,20}$/.test(u.energy_source) ? u.energy_source : 'worker',
  };
}

async function sign(env, value) {
  const k = await crypto.subtle.importKey('raw', enc(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', k, enc(value));
  return btoa(String.fromCharCode(...new Uint8Array(mac))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', enc(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

function text(t, status = 200) {
  return new Response(t, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
