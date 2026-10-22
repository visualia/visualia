// visualia pool worker for a computer with Ollama: the worker app's core,
// without the app (plans/pool.md). Connects out only, to one address.
//
//   VISUALIA_KEY=<course key> node worker-node.mjs
//
// 1. Signs in at https://pool.visualia.space/login with the course key (from the
//    environment only, never an argument or a URL) and keeps the cookie in memory.
// 2. Opens the same outbound WebSocket as the join page (wss://pool.visualia.space/connect).
// 3. Announces the pool models it has in local Ollama (MODELS below).
// 4. Runs each job on Ollama at 127.0.0.1:11434 (thinking off; a JSON schema
//    becomes Ollama's `format`), streams the words back, and reports the job's
//    energy, measured with macmon (meter.mjs). Decision jobs (/v1/decide, for
//    Clef-flash) go to Ollama's /v1/systemone and come back as one answer.
//    Models load when a job asks for them; nothing is kept warm.
// Stop it with Ctrl+C. It writes nothing to disk and never logs a prompt.
//
// Environment: VISUALIA_KEY (needed), POOL (default https://pool.visualia.space),
// OLLAMA (default http://127.0.0.1:11434), POOL_MODELS (e.g. "qwen3.5-9b=qwen3.5:9b").
import { meter } from './meter.mjs';

const POOL = process.env.POOL ?? 'https://pool.visualia.space';
const OLLAMA = process.env.OLLAMA ?? 'http://127.0.0.1:11434';
const KEY = process.env.VISUALIA_KEY;
// pool name -> Ollama tag. The gateway allows only the pool names it lists.
const MODELS = Object.fromEntries((process.env.POOL_MODELS ?? 'qwen3.5-9b=qwen3.5:9b,gemma4-26b=gemma4:26b')
  .split(',').map((p) => p.split('=')));
if (!KEY) { console.error('Set VISUALIA_KEY to your course key.'); process.exit(1); }

const power = meter();
let cookie = null, ws = null, retry = 0, stopping = false;
const running = new Map(); // job id -> AbortController
// Ollama's MLX runner has no structured output (501 "structured output is
// unavailable", 0.40.8). Then the schema goes into the prompt, the answer is
// held back, checked, and sent whole, or the job fails and the cloud takes it.
let formatWorks = true;

const log = (...a) => console.log(new Date().toLocaleTimeString('et-EE'), ...a);

async function signIn() {
  const res = await fetch(`${POOL}/login`, {
    method: 'POST', redirect: 'manual',
    headers: { origin: POOL, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ key: KEY }),
  });
  const set = res.headers.get('set-cookie')?.match(/__Host-pool=[^;]+/)?.[0];
  if (!set) throw new Error(res.status === 429 ? 'too many sign-in attempts, wait a minute' : 'sign-in refused: check the key');
  cookie = set;
}

// The pool models whose Ollama tag is installed here.
let current = []; // the models this worker offers
async function offered() {
  const { models = [] } = await fetch(`${OLLAMA}/api/tags`).then((r) => r.json());
  const have = new Set(models.map((m) => m.name));
  return Object.keys(MODELS).filter((n) => have.has(MODELS[n]) || have.has(`${MODELS[n]}:latest`));
}

async function connect() {
  if (stopping) return;
  try {
    if (!cookie) await signIn();
    const models = await offered();
    current = models;
    if (!models.length) throw new Error(`none of these models is in Ollama: ${Object.values(MODELS).join(', ')}`);
    const sock = new WebSocket(`${POOL.replace(/^http/, 'ws')}/connect`, { headers: { origin: POOL, cookie } });
    ws = sock;
    let ping, opened = false;
    sock.onopen = () => {
      opened = true; retry = 0;
      sock.send(JSON.stringify({ type: 'hello', kind: 'node', models }));
      ping = setInterval(() => sock.readyState === 1 && sock.send('ping'), 25_000);
    };
    sock.onmessage = (e) => {
      if (e.data === 'pong') return;
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === 'welcome') log(`in the pool as ${m.person} with ${models.map((n) => `pool/${n}`).join(', ')}; ${m.workers} worker(s) in the class`);
      if (m.type === 'job') run(sock, m);
      if (m.type === 'cancel') running.get(m.id)?.abort();
    };
    sock.onclose = () => {
      clearInterval(ping);
      if (!opened) cookie = null; // refused at the door: sign in again next time
      again(opened ? 'connection lost' : 'connection refused');
    };
  } catch (e) {
    again(String(e.message ?? e));
  }
}

function again(why) {
  if (stopping) return;
  const wait = Math.min(60, 2 ** retry++);
  log(`${why}; trying again in ${wait} s`);
  setTimeout(connect, wait * 1000);
}

async function run(sock, job) {
  if (job.kind === 'decide') return decide(sock, job);
  const send = (m) => sock.readyState === 1 && sock.send(JSON.stringify({ ...m, id: job.id }));
  const tag = MODELS[job.model];
  const stop = new AbortController();
  running.set(job.id, stop);
  const t0 = Date.now();
  const meterJob = power.start();
  let out = 0, usage = {}, finish = 'stop';
  try {
    if (!tag) throw new Error(`this worker has no ${job.model}`);
    if (power.gpuC() > 85) throw new Error('this computer is too hot right now'); // the cloud takes it
    const schema = job.response_format?.schema ? JSON.parse(job.response_format.schema) : null;
    const format = schema ?? (job.response_format?.type === 'json_object' ? 'json' : undefined);
    const ask = (withFormat) => fetch(`${OLLAMA}/api/chat`, {
      method: 'POST', signal: stop.signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: tag, stream: true, think: false,
        ...(withFormat ? { format, messages: job.messages } : { messages: format ? jsonPrompt(job.messages, schema) : job.messages }),
        options: {
          num_predict: job.max_tokens,
          ...(job.temperature != null ? { temperature: job.temperature } : {}),
          ...(job.top_p != null ? { top_p: job.top_p } : {}),
          ...(job.stop ? { stop: [].concat(job.stop) } : {}),
          ...(job.seed != null ? { seed: job.seed } : {}),
        },
      }),
    });
    let res = await ask(format && formatWorks);
    if (format && formatWorks && res.status === 501) { formatWorks = false; res = await ask(false); }
    if (!res.ok) throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const hold = format && !formatWorks; // check the JSON before sending it
    let held = '';
    const dec = new TextDecoder(); let buf = '';
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line) continue;
        const e = JSON.parse(line);
        if (e.error) throw new Error(e.error);
        if (e.message?.content) { out++; if (hold) held += e.message.content; else send({ type: 'delta', content: e.message.content }); }
        if (e.done) { usage = { prompt_tokens: e.prompt_eval_count, completion_tokens: e.eval_count ?? out }; finish = e.done_reason === 'length' ? 'length' : 'stop'; }
      }
    }
    if (hold) {
      const text = held.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
      if (!fits(text, schema)) throw new Error('the answer did not match the schema');
      send({ type: 'delta', content: text });
    }
    const energy = power.stop(meterJob) ?? {};
    send({ type: 'done', finish_reason: finish, usage: {
      ...usage, energy_j: energy.energy_j, energy_net_j: energy.energy_net_j, sys_energy_j: energy.sys_energy_j, energy_source: energy.source,
    } });
    log(`job pool/${job.model}: ${usage.completion_tokens} tokens, ${((Date.now() - t0) / 1000).toFixed(1)} s, ${energy.energy_j ?? '?'} J (net ${energy.energy_net_j ?? '?'})`);
  } catch (e) {
    power.stop(meterJob);
    if (stop.signal.aborted) log(`job pool/${job.model}: cancelled after ${out} pieces`);
    else { send({ type: 'error', message: String(e.message ?? e).slice(0, 200) }); log(`job pool/${job.model} failed: ${String(e.message ?? e).slice(0, 120)}`); }
  } finally {
    running.delete(job.id);
    job.messages = null; // the prompt is not kept
    await coolDown(sock, current);
  }
}

// A decision: state + typed questions -> answers, one JSON reply. The model
// loads on demand (Clef-flash cold: 8-18 s on the M1).
async function decide(sock, job) {
  const send = (m) => sock.readyState === 1 && sock.send(JSON.stringify({ ...m, id: job.id }));
  const tag = MODELS[job.model];
  const stop = new AbortController();
  running.set(job.id, stop);
  const t0 = Date.now();
  const meterJob = power.start();
  try {
    if (!tag) throw new Error(`this worker has no ${job.model}`);
    if (power.gpuC() > 85) throw new Error('this computer is too hot right now');
    const res = await fetch(`${OLLAMA}/v1/systemone`, {
      method: 'POST', signal: stop.signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: tag, state: job.state, questions: job.questions }),
    });
    if (!res.ok) throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const r = await res.json();
    const energy = power.stop(meterJob) ?? {};
    const u = r.usage ?? {};
    send({ type: 'done', answers: r.answers, usage: {
      prompt_tokens: u.input_tokens ?? u.prompt_tokens,
      energy_j: energy.energy_j, energy_net_j: energy.energy_net_j, sys_energy_j: energy.sys_energy_j, energy_source: energy.source,
    } });
    log(`decide pool/${job.model}: ${Object.keys(job.questions ?? {}).length} question(s), ${((Date.now() - t0) / 1000).toFixed(1)} s, ${energy.energy_j ?? '?'} J (net ${energy.energy_net_j ?? '?'})`);
  } catch (e) {
    power.stop(meterJob);
    if (stop.signal.aborted) log(`decide pool/${job.model}: cancelled`);
    else { send({ type: 'error', message: String(e.message ?? e).slice(0, 200) }); log(`decide pool/${job.model} failed: ${String(e.message ?? e).slice(0, 120)}`); }
  } finally {
    running.delete(job.id);
    job.state = job.questions = null; // not kept
    await coolDown(sock, current);
  }
}

// A laptop between jobs: if the GPU is hot, say "no models" to the pool (it
// then sends jobs elsewhere or to the cloud) until it is cool again, at most
// COOL_MAX_S. Desktops with a fan rarely trigger this.
const COOL_ABOVE = Number(process.env.COOL_ABOVE ?? 75), COOL_TO = Number(process.env.COOL_TO ?? 65), COOL_MAX_S = 60;
async function coolDown(sock, models) {
  if (!(power.gpuC() > COOL_ABOVE) || sock.readyState !== 1) return;
  sock.send(JSON.stringify({ type: 'hello', kind: 'node', models: [] }));
  const t0 = Date.now();
  while (power.gpuC() > COOL_TO && Date.now() - t0 < COOL_MAX_S * 1000) await new Promise((r) => setTimeout(r, 2000));
  log(`cooled to ${Math.round(power.gpuC())} °C in ${Math.round((Date.now() - t0) / 1000)} s`);
  if (sock.readyState === 1) sock.send(JSON.stringify({ type: 'hello', kind: 'node', models }));
}

function jsonPrompt(messages, schema) {
  const rule = `Answer only with one JSON value, no other text${schema ? `, matching this JSON schema: ${JSON.stringify(schema)}` : ''}.`;
  return [{ role: 'system', content: rule }, ...messages];
}

// Parses, and checks the top level: required keys present, enums kept, types right.
function fits(text, schema) {
  let v; try { v = JSON.parse(text); } catch { return false; }
  if (!schema) return true;
  if (schema.type === 'object') {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    if ((schema.required ?? []).some((k) => !(k in v))) return false;
    for (const [k, p] of Object.entries(schema.properties ?? {})) {
      if (!(k in v)) continue;
      if (p.enum && !p.enum.includes(v[k])) return false;
      if (p.type && p.type !== (Array.isArray(v[k]) ? 'array' : v[k] === null ? 'null' : Number.isInteger(v[k]) && p.type === 'integer' ? 'integer' : typeof v[k])) return false;
    }
  }
  return true;
}

async function quit() {
  stopping = true;
  for (const c of running.values()) c.abort();
  try { ws?.close(1000, 'stopped'); } catch {}
  power.close();
  log('left the pool');
  // Free the memory: unload this worker's models from Ollama.
  await Promise.all(Object.values(MODELS).map((model) => fetch(`${OLLAMA}/api/generate`, {
    method: 'POST', body: JSON.stringify({ model, keep_alive: 0 }), signal: AbortSignal.timeout(3000),
  }).catch(() => {})));
  process.exit(0);
}
process.on('SIGINT', quit);
process.on('SIGTERM', quit);

connect();
