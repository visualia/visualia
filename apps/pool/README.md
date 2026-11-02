# pool

The class pool: `pool.visualia.space` (the join page, sign-in, and one `Pool`
Durable Object per school) in `src/index.js`. See `plans/pool.md`.
Deploy: `npm run deploy`.

It also serves the Visualia Pool app's updates (`plans/worker-app.md` step 4),
from the R2 bucket `visualia-pool-app`, without sign-in (the app checks each
update's signature against its own key):
`GET /app/update/<target>/<arch>/<version>` answers with the manifest when a
newer version exists, else 204; `GET /app/files/<name>` is the update itself.
Published by `apps/pool-app/publish-update.mjs`. `GET /app/models` sends
the app's model list (`src/models.js`); the app checks it against limits of
its own and downloads only on a click.

## Running a computer with Ollama as a worker

The worker is the Rust program and app in `apps/pool-app`
(`visualia-pool-cli`, 1.3 MB, and the Visualia Pool app around it). The Node
script `worker-node.mjs` that did the same for the work Mac while ThreatLocker
killed new binaries was retired on 2026-11-02 (in git history before that).
`meter.mjs` stays here: the evals measure energy with it.

```sh
cd apps/pool-app && cargo build --release -p pool-core
VISUALIA_KEY=$(grep '^eka-teacher=' ../../.keys.local | cut -d= -f2-) target/release/visualia-pool-cli
```

(Reading the key from `.keys.local` keeps it out of the shell history.)

**What it does**
- Signs in with the course key (read from `VISUALIA_KEY` only, never an
  argument or a URL) and keeps the pool's cookie in memory.
- Opens one outbound WebSocket to the pool, the same one the join page opens,
  and offers the models on the model list (`src/models.js`; the program uses
  its built-in copy) that it has in Ollama: `pool/qwen3.5-9b`,
  `pool/gemma4-26b`, and for decisions `pool/clef-flash` (the gateway's
  `/v1/decide` tries it before the cloud). `POOL_MODELS` (`name=tag,…`)
  replaces the list; the gateway serves only the names it allows.
- Runs one job at a time on Ollama with thinking off, and streams the words
  back. A JSON schema goes to Ollama as `format`; where Ollama can't enforce it
  (its MLX runner), the schema goes into the prompt and the answer is checked
  before it is sent, or the job is handed back to the cloud.
- Measures each job's energy with macmon's library, linked in (chip energy,
  net of the idle baseline, and whole system) and reports it with the job; it
  lands in the class's usage rows.
- Loads a model only when a job asks for it; keeps nothing warm.
- Refuses jobs while the graphics chip is over 85 °C (the cloud takes them).

**What it never does**
- Opens no port and accepts no incoming connection.
- Writes nothing to disk, logs no prompt and no answer (only model, tokens,
  seconds, energy), runs no tools, files or programs for a job.
- Downloads no model: it offers only what is already in Ollama (the app
  downloads, on a click).

**Addresses it talks to**
- `https://pool.visualia.space` and `wss://pool.visualia.space/connect` (out).
- `http://127.0.0.1:11434` (Ollama, on this computer).

**How to stop it**: Ctrl+C (or `pkill visualia-pool-cli`): the socket closes,
a running job is stopped and the cloud finishes it. Revoking the course key
stops it at its next connect; blocking `pool.visualia.space` stops it for good.

The M1 runs it as a LaunchAgent: `apps/m1-worker/README.md`.

Measure a model's energy on a fixed prompt: `node meter.mjs [model] [runs]`
(waits a minute and for the GPU to be under 60 °C before each run).
