---
status: building
---

# The pool: shared compute that anyone can audit

The class shares compute: student laptops, office machines, the school's
GeForce PCs in the VR lab, the teacher's M1. A machine joins when its owner
wants and leaves whenever it likes; nothing changes for the student asking.
School IT has to be able to see exactly what runs, why, and how to stop it.
Replaces the m1-1 tunnel + proxy design in `local-models.md`.

## The rule: connect out, never open in

```
any machine ──outbound wss:443──▶ Pool (Durable Object, pool.visualia.space) ◀── gateway
```

- No inbound ports, no tunnels, no port forwarding, no admin rights, no
  background service. IT sees outbound HTTPS to one domain and can block the
  whole pool with one rule.
- If a network blocks long-lived WebSockets, the worker falls back to polling
  over plain HTTPS.
- The gateway sends a job to the Pool when a suitable worker is online, else to
  the cloud. A worker leaving mid-job: the job finishes in the cloud.

## Two ways to join

| | Tab | Worker app |
|---|---|---|
| Install | none: open `pool.visualia.space/join` | one signed app, per-user install, no admin |
| Runs on | Chrome/Edge with WebGPU, phones too | macOS, Windows, Linux |
| Engine | WebLLM in the tab | its own `llama-server` (llama.cpp: CUDA, Vulkan, Metal), or Ollama / LM Studio if already there; images later (stable-diffusion.cpp or mflux) |
| Models | small (1–8B) | what the machine holds; GeForce lab PCs: 14–30B, images |
| Energy | estimated from the device | measured: `nvidia-smi`, `macmon`, no admin |

The M1 becomes an ordinary worker; the tunnel and proxy retire (done 2026-10-22, below).

## Packaging: Tauri v2

- **Small and inspectable**: a few MB, Rust core, the UI in our own HTML and
  `visualia.css` in the system webview (WebView2 on Windows 10/11, WebKit on
  macOS).
- **Permissions declared in one file**: Tauri's capability list says what the
  app may do (talk to `pool.visualia.space`, start the bundled `llama-server`
  sidecar, read and write its own model folder). An auditor reads one file
  instead of the whole code.
- **Sidecar**: `llama-server` from llama.cpp's official releases, pinned by
  version and hash, run on `127.0.0.1` only.
- **Not Electron**: ~150 MB and a full Chromium to keep patched, for a tray
  app. **Not Deno compile**: Deno is being wound down after Cloudflare's
  acquisition (October 2026). Node's single executable has no UI; Go would
  work but splits the codebase from the web UI.

## Engines (2026-10-22)

The plan above says `llama-server`; the better default is a **pinned Ollama**
inside the app: MLX on Apple Silicon (33–35 tok/s vs ~21 for llama.cpp on the
M1, Qwen 3.5 9B), CUDA/Vulkan elsewhere, one API we already speak. On Macs,
Apple's built-in model (Foundation Models) can take the small jobs with no
download. SwiftLM is the fallback if Ollama is too big to bundle. All of it is
built and measured on the M1 (ThreatLocker blocks new binaries on the work
Mac; Docker on a Mac has no Apple GPU); releases are built and signed in
GitHub Actions.

## What makes it auditable

- **Open source, public repo.** The worker, the Pool and the gateway are the
  same repo, so "what happens to a job" is readable end to end.
- **Plain-language `WORKER.md`**: what the app does, what it never does, every
  network address it talks to, what it stores. Written for IT and students,
  not developers.
- **Inference only, no training.** Nothing on a worker learns from prompts;
  models are fixed files from a pinned list, checked by SHA-256 before loading.
- **No tools, no files, no shell.** A job is "run this prompt on this model".
  A malicious prompt can at most produce bad text.
- **Signed, reproducible releases**: built in GitHub Actions from a tagged
  commit, with build provenance (attestations); signed for Windows and
  notarised for macOS. Anyone can check that a download matches the source.
- **Everything visible, to everyone.** The app shows each job as it runs (model,
  size, time, energy, which class). The same rows go to the class's usage page,
  so the class and IT see one record: who served what, when, at what cost and
  energy. Prompt text is never logged.
- **Three off switches**: the owner (pause / quit), the class (revoke a
  worker's token), IT (block the domain).

## Trust between people

- A worker sees the prompts it runs. The share screen says so, plainly.
- Workers serve their own class only. Jobs carry no identity of the asker.
- A worker can return junk: the studio's checks catch it; repeated failures
  drop the worker.

## Open

1. Can students or staff install a per-user app on lab PCs, or does it need IT?
   (Decides app vs tab in the lab.)
2. Does the school network pass long-lived WebSockets to one domain?
3. Code-signing identity: Apple Developer ID and Windows signing under whose
   name (personal, EKA, a foundation)?
4. Which repo goes public first: all of `visualia/visualia` (check history
   for secrets first) or a separate worker repo.

## Built (2026-10-22): the tab worker

The first piece: a browser tab as a worker, chat completions only.

**Where it lives: a separate Worker, `apps/pool` at `pool.visualia.space`**
(option A, not the DO inside the gateway). Why: the pool is the part IT and
students must be able to audit, so it gets its own small Worker (one file, ~300
lines) and its own domain, which IT can block with one rule without touching
the gateway or the studio; it deploys without redeploying the gateway; and its
public side (share page, sign-in, worker sockets) stays apart from the
gateway's key-checked API. The gateway reaches it only through a service
binding (`POOL`, entrypoint `ForGateway`), never over the internet.

**How a job runs**
```
student ─▶ gw /v1/chat/completions model pool/qwen2.5-1.5b
gateway ─(service binding: school + messages, no asker)─▶ Pool DO for that school
Pool ─(the tab's own outbound WebSocket)─▶ an idle tab with the model ─▶ tokens back the same way
```
- One `Pool` Durable Object per school (`idFromName(school)`); a tab can only
  join its own school's Pool, so workers serve their own class only. Sockets
  hibernate; `ping` → `pong` is answered without waking the object. Jobs live
  in memory only: nothing about a job is stored in the pool.
- Pick: an idle worker with the model, the one idle longest. One job per tab.
  No queue yet: all busy = the cloud.
- Text-only chat goes to the pool (system/user/assistant strings, up to 12,000
  characters, max_tokens capped at 2,048). Pictures, tools and longer prompts
  go to the cloud.
- Protocol (JSON frames): `hello {models}` → `welcome`; `job {id, messages,
  max_tokens, …}` → `delta {id, content}`… → `done {id, usage}` or `error`;
  `cancel {id}` when the asker leaves or the worker is too slow.
- Watchdog: first word within 30 s, then no gap over 15 s; more than 32,000
  characters back is cut off.

**Fallback.** No worker, or the worker fails before its first word: the
cloud (`DEFAULT_MODEL`, DeepSeek V4.1 Flash) answers the whole request. The
worker leaves, crashes or stalls mid-answer: **the cloud finishes it.** The
gateway sends the original messages plus the words already streamed (as the
assistant's turn) and "continue exactly where it stopped"; the caller's one
stream goes on. One chunk with `choices: []` and `visualia: { served_by:
'cloud', reason, continued }` marks the switch. Chosen over a clear error
because the caller always gets an answer, which is the pool's promise; the
seam is usually invisible. Two fixes found by testing: the cloud model thinks
by default and spent the whole budget reasoning (now `enable_thinking: false`
for pool fallbacks; the tab model doesn't think either), and continuations
lost the space at the seam (now added when both sides are letters).

**Usage.** Each part gets its own row through the gateway's `record()`: the
pool part as `pool/qwen2.5-1.5b`, `served_by` = the worker's person id, cost
$0, tokens, time, first token; energy null (a tab can't measure). A cut-off
part has `ok = 0`, error `worker left`, and the tokens it did send. The cloud
part is an ordinary row. Migration **0008** adds `usage.served_by`. No separate
provider column: the model prefix is the provider, as with `m1-1/`.

**The pool page** (`pool.visualia.space/join`, "Join the pool"; `/share` redirects): sign in with the course key
(form body, same SHA-256 check as the gateway, 10 tries a minute per address,
own limiter); a signed host-only cookie `__Host-pool` (HttpOnly, Secure,
SameSite=Strict, secret `SESSION_SECRET`). The studio's cookie can't be read
here (host-only), and a second sign-in is simpler than a cross-site hand-off.
The worker socket needs that cookie and this page's Origin, and the person must
still hold an unrevoked key, so revoking a key stops the worker at its next
connect. The page says what it does, what it never does, the four addresses it
talks to (enforced by its Content Security Policy) and what it stores; it lists
each job (time, model, tokens, seconds; never the prompt).

**Model:** Qwen2.5 1.5B Instruct, q4f16_1 (q4f32_1 on graphics without
16-bit shaders), WebLLM 0.2.86 pinned as in the probe. 870 MB download, ~1.6
GB graphics memory, 4,096-token context. Chosen over Llama 3.2 1B (695 MB)
for better text and some Estonian; Qwen3 1.7B thinks by default.

**Verified** (headless Playwright Chromium 148 with real WebGPU on the M2 Pro's
Metal, not a mock; signed in by script, no key typed into a browser; asker
eka-test-001 through the public gateway, worker eka-test-002):
- served by the tab and streamed: 51 tokens, first token 2.7 s (cold), 3.7 s
  total; row `served_by = eka-test-002`, $0;
- no worker: cloud, ~0.6 s added; streamed and non-streamed;
- tab closed after 40 tokens, and the browser SIGKILLed after 40 tokens: both
  seen as "worker left" at once, the cloud continued (183 chunks, one stream,
  one `[DONE]`); rows: pool part `ok = 0` + cloud part;
- refusals: socket without cookie 401, foreign or missing Origin 403, forged
  cookie 401, sign-in from another origin 403; no CSP violations while loading.

**Second model, schemas, Estonian (2026-10-22, from
`research/browser-models.md` §6a):**
- **`pool/qwen3-4b`**: Qwen3-4B q4f16_1 (q4f32_1 without shader-f16), WebLLM
  still 0.2.86, thinking off (`extra_body.enable_thinking: false`). WebLLM
  still starts each reply with an empty `<think>\n\n</think>\n\n`; the tab
  holds the start of the stream back and drops it before sending. The join
  page offers it as an opt-in second choice ("Strong model": 2.3 GB download,
  about 3.4 GB graphics memory, Apple Silicon 16 GB+ or GeForce 6 GB+) and
  shows a hint from `adapter.info` and limits (Apple or NVIDIA, shader-f16,
  `maxBufferSize` ≥ 2 GB: "looks strong enough"; else "the small model is the
  safe choice"). Browsers don't expose memory size, so it is only a hint; the
  person chooses. One model loaded per tab; switching while in the pool
  unloads one and loads the other, and `hello {models}` announces only the
  loaded one. `pool/` stays $0 in `prices.js`.
- **`response_format`**: the gateway passes it to the Pool, which normalises
  `{type:'json_object', schema}` (our shape) or OpenAI's `{type:'json_schema',
  json_schema:{schema}}` into WebLLM's `{type:'json_object', schema:'<string>'}`
  (schemas up to 8,000 characters; anything else the tab can't do: 422, so
  the cloud takes it). On cloud fallback it becomes Workers AI's
  `{type:'json_schema', json_schema:{name:'answer', schema, strict:true}}`,
  which DeepSeek V4.1 Flash accepts per its model schema, streamed. A cloud
  continuation of a cut-off answer goes without it (the rest of a JSON text
  isn't JSON); such an answer may not parse.
- **Estonian free text skips the 1.5B**: for `pool/qwen2.5-1.5b` without a
  schema, if the last user message has õ ä ö ü š ž or two words from a short
  Estonian list, the gateway sends it straight to the cloud (an ordinary cloud
  row) with `visualia.reason` "Estonian text: the small pool model writes poor
  Estonian". With a schema it stays on the pool. `pool/qwen3-4b` takes
  Estonian.
- **Storage**: new downloads go to IndexedDB (`cacheBackend: 'indexeddb'`); a
  model already in Cache Storage (every tab that joined before today) keeps
  loading from there (`hasModelInCache` checks first). "Remove the models"
  deletes both models from both.
- **Usage page**: a "Served by" column (the worker's person id on pool rows).

**Verified** (same rig: headless Chromium, real WebGPU on the M2 Pro, signed
in by script; asker eka-test-001, worker eka-test-002):
- the existing profile's 1.5B loaded from Cache Storage in 2.2 s, no
  download; an English job served by the tab (40 tokens, first token 0.6 s);
- the 4B downloaded to IndexedDB in 208 s on the office network, later
  reloaded in 4.7 s; served English (95 tokens, first token 1.5 s cold,
  ~33 tokens/s), Estonian free text (104 tokens, 3.1 s) and schema jobs
  streamed and not streamed; no `<think>` in any output;
- schema jobs: valid JSON every time (1.5B in Estonian with an `enum`: valid,
  though it picked "Photography" for a noise poster; 4B: "Generative art");
  on the cloud with no worker: valid JSON, streamed and not;
- Estonian free text to the 1.5B (with and without diacritics): cloud, reason
  in the chunk; with the 1.5B loaded and online;
- a model no tab has loaded (4B while the tab had 1.5B, and back): cloud,
  "no worker online for this model";
- usage rows: pool rows $0 with `served_by = eka-test-002` and the right
  model; cloud rows ordinary; the studio's usage page shows them;
- "Remove the models" emptied the origin's storage (882 MB → 1 MB as the
  browser estimates it).

**Not yet:** a queue when all workers are busy; worker app (Tauri); polling
fallback for networks that block WebSockets; dropping workers that return
junk; energy estimates for tabs; the reason a job skipped the pool is not
stored (only in the stream); a 4B test on a 16 GB Mac or a GeForce PC.

## Built (2026-10-22): the node worker on the M2

The worker app's core without the app: `apps/pool/worker-node.mjs` (one file,
no packages, Node 25's own fetch and WebSocket) puts a computer's Ollama models
into the pool. First on the teacher's work Mac (M2 Pro, 32 GB, ThreatLocker:
Homebrew Ollama 0.40.8 and macmon 0.10.0 ran unblocked). How to run it, what
it never does and the addresses it talks to: `apps/pool/README.md`.

- **Sign-in and socket**: the course key from `VISUALIA_KEY` only, posted to
  `/login` like the join page's form; the `__Host-pool` cookie kept in memory;
  then the same outbound WebSocket as the tab, with the page's Origin (the
  cookie is what authenticates; the Origin check is there for browsers). A
  refused connect signs in again; reconnects back off to 60 s. No pool change
  was needed for a non-browser worker.
- **Models**: `pool/qwen3.5-9b` (`qwen3.5:9b`) and `pool/gemma4-26b`
  (`gemma4:26b`), announced only when Ollama has them. The gateway now holds an
  explicit allowlist, `POOL_MODELS`: the two tab models and these two; any
  other `pool/` name is a 400. The Estonian check stays on `pool/qwen2.5-1.5b`
  only, so the 9B and bigger take Estonian.
- **Jobs**: Ollama's native `/api/chat`, `think: false`, `num_predict` =
  `max_tokens`, one job at a time; `cancel` aborts the request. A JSON schema
  goes as Ollama's `format`, but **Ollama 0.40.8's MLX runner answers 501
  "structured output is unavailable"** (the M1's "xgrammar not found" warning,
  now a refusal). The worker then puts the schema in the prompt, holds the
  answer back, checks it (parses; required keys, enums and types at the top
  level) and sends it whole, or fails the job so the cloud takes it. It refuses
  jobs while the GPU is over 85 °C, and unloads its models when it quits.
- **Energy**: `apps/pool/meter.mjs`, the m1-1 proxy's macmon method as a
  module (chip = `all_power + ram_power + gpu_ram_power`, idle baseline as an
  EMA, net = minus idle; plus whole system). The worker adds `energy_j`,
  `energy_net_j`, `sys_energy_j`, `energy_source` to `done.usage`; the Pool
  passes them on (numbers 0–1 MJ only) and the gateway writes them into the
  pool part's usage row (the columns from migration 0005). No migration.

**Verified** (asker eka-test-001 through the public gateway, worker signed in
as eka-teacher, both deployed 2026-10-22):
- English and Estonian free text streamed from the M2 (first token 0.5 s warm,
  6.3 s with the model loading); rows `pool/qwen3.5-9b`, `served_by =
  eka-teacher`, $0, with energy (e.g. 177 tokens: 184 J chip, 96 J net, 494 J
  system);
- schema jobs: the first hit the 501 and went to the cloud (valid JSON); with
  the prompt fallback, served by the M2 twice, valid JSON, 1.5–2.2 s, 36–56 J;
- the worker SIGKILLed mid-story: "worker left" at once, the cloud continued
  the same stream; rows: pool part `ok = 0` with 159 tokens, cloud part;
- worker stopped: cloud, "no worker online for this model";
- `pool/llama-70b`: 400 with the allowed names;
- `pool/gemma4-26b` (Estonian, 83 tokens): served by the M2, first token 8.4 s
  with the model loading cold, 93 J chip, 77 J net; Ctrl+C left the pool and
  unloaded both models from Ollama.

Gemma 4 26B makes pages here (5/5, ~30 s, ~0.14 Wh chip per page:
`plans/first-pages.md` run 9), so both models are offered. The M2 heats up
under load (GPU 46 → 70–80 °C in 30 s of generation).

**Not yet**: one job at a time per computer (no queue); a page job is capped
at the pool's 2,048 tokens out and 12,000 characters in, set for the tab
models; the worker as a background service (it runs in a terminal while
someone watches it).

## Built (2026-10-22): the M1 joins, the tunnel retires

The home M1 runs `worker-node.mjs` as a LaunchAgent with its own key (person
`m1-1`), offering `pool/qwen3.5-9b` and `pool/clef-flash`. Setup:
`apps/m1-worker/README.md`.

- **Decisions through the pool.** The Pool takes a second job kind,
  `POST /decide` (`{ model, state, questions }`, node workers only):
  `job {kind: 'decide', state, questions}` → `done {answers, usage}`, one
  JSON reply, 40 s for the whole answer including a model load, state and
  questions up to 32,000 characters. The worker calls Ollama's
  `/v1/systemone` and reports energy as for chat. The gateway's `/v1/decide`
  tries `pool/clef-flash`, then Workers AI Clef; "no worker" goes to the cloud
  without a failed row; pictures always go to the cloud (no vision encoder on
  the GGUF). `pool/clef-flash` is not a chat model (not in `POOL_MODELS`).
- **No warm-keeping.** The teacher's call: models load when asked, until we
  know the class's real usage. The old proxy's Clef reload after a minute idle
  and the gateway's "is Clef loaded?" check are gone.
- **Removed:** the gateway's `m1-1/<model>` route, `M1_URL`, the `M1_SECRET`
  secret; tunnel `m1-1` (deleted); on the M1 the proxy, the tunnel's
  LaunchAgent, its token file and logs; `apps/m1-worker/proxy.mjs`. The
  `m1-1.visualia.space` DNS record is left for the dashboard (wrangler's login
  has no DNS scope); it answers 530.

**Verified** (eka-test-001 through the public gateway): decide with Clef
loaded 0.9–1.2 s (11–13 J chip); decide right after a Qwen job, Clef loaded on
demand, 5.8 s (28 J chip, 21 net); Estonian chat on `pool/qwen3.5-9b` from the
M1; rows `served_by = m1-1`, `served_kind = node`, with energy; worker stopped
→ decide from Workers AI Clef; the worker unloads its models when it stops.
Node 24 on the M1 is enough (its WebSocket takes the cookie header).
