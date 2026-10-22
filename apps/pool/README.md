# pool

The class pool: `pool.visualia.space` (the join page, sign-in, and one `Pool`
Durable Object per school) in `src/index.js`. See `plans/pool.md`.
Deploy: `npm run deploy`.

## Running a computer with Ollama as a worker

The main worker is now the Rust program and app in `apps/worker-app`
(`visualia-worker`, 1.3 MB; the M1 runs it). This Node script does the same
and stays for computers where a new program is blocked but Node is allowed
(the work Mac's ThreatLocker kills the Rust binary).

`worker-node.mjs` is the worker app's core without the app: a Node script that
puts this computer's Ollama models into the class pool. Needs Node 25 (fetch
and WebSocket built in, no packages), Ollama, and on a Mac `macmon` for energy.

```sh
cd apps/pool
VISUALIA_KEY=<course key> node worker-node.mjs     # Ctrl+C to leave the pool
```

Keep the key out of the shell history, e.g. from `.keys.local`:
`VISUALIA_KEY=$(grep '^eka-teacher=' ../../.keys.local | cut -d= -f2-) node worker-node.mjs`.

**What it does**
- Signs in with the course key (read from `VISUALIA_KEY` only, never an
  argument or a URL) and keeps the pool's cookie in memory.
- Opens one outbound WebSocket to the pool, the same one the join page opens,
  and offers the pool models it has in Ollama: `pool/qwen3.5-9b`
  (`qwen3.5:9b`) and `pool/gemma4-26b` (`gemma4:26b`), and for decisions
  `pool/clef-flash` (e.g. `clef-flash=clef-flash-8k`; the gateway's
  `/v1/decide` tries it before the cloud). `POOL_MODELS` changes
  the list (`name=tag,…`); the gateway serves only the names it allows.
- Runs one job at a time on Ollama with thinking off, and streams the words
  back. A JSON schema goes to Ollama as `format`; where Ollama can't enforce it
  (its MLX runner), the schema goes into the prompt and the answer is checked
  before it is sent, or the job is handed back to the cloud.
- Measures each job's energy with macmon (`meter.mjs`: chip energy, net of the
  idle baseline, and whole system) and reports it with the job; it lands in the
  class's usage rows.
- Loads a model only when a job asks for it; keeps nothing warm.
- Refuses jobs while the graphics chip is over 85 °C (the cloud takes them).

**What it never does**
- Opens no port and accepts no incoming connection.
- Writes nothing to disk, logs no prompt and no answer (only model, tokens,
  seconds, energy), runs no tools, files or programs for a job.
- Downloads no model: it offers only what is already in Ollama.

**Addresses it talks to**
- `https://pool.visualia.space` and `wss://pool.visualia.space/connect` (out).
- `http://127.0.0.1:11434` (Ollama, on this computer).
- It also starts `/opt/homebrew/bin/macmon` locally to read power.

**How to stop it**: Ctrl+C (or `pkill -f worker-node.mjs`): the socket closes,
a running job is stopped and the cloud finishes it. Revoking the course key
stops it at its next connect; blocking `pool.visualia.space` stops it for good.

The M1 runs it as a LaunchAgent: `apps/m1-worker/README.md`.

Measure a model's energy on a fixed prompt: `node meter.mjs [model] [runs]`
(waits a minute and for the GPU to be under 60 °C before each run).
