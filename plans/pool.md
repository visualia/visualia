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
| Install | none: open `visualia.space/share` | one signed app, per-user install, no admin |
| Runs on | Chrome/Edge with WebGPU, phones too | macOS, Windows, Linux |
| Engine | WebLLM in the tab | its own `llama-server` (llama.cpp: CUDA, Vulkan, Metal), or Ollama / LM Studio if already there; images later (stable-diffusion.cpp or mflux) |
| Models | small (1–8B) | what the machine holds; GeForce lab PCs: 14–30B, images |
| Energy | estimated from the device | measured: `nvidia-smi`, `macmon`, no admin |

The M1 becomes an ordinary worker; the tunnel and proxy retire.

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

**The share page** (`pool.visualia.space/share`): sign in with the course key
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

**Not yet:** a queue when all workers are busy; the usage page showing "served
by" (the studio isn't touched here); worker app (Tauri); polling fallback for
networks that block WebSockets; dropping workers that return junk; energy
estimates for tabs.
