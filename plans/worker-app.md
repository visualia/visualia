---
status: building
---

# Worker app: the pool on a desktop, as an app

The pool's second way to join (`pool.md` "Two ways to join"): a signed,
per-user app for Macs first, then Windows and Linux. It must stay small enough
for school IT and students to audit. Code: `apps/worker-app`.

## Built (2026-10-22): the Rust worker

**One worker in Rust for the app and the terminal** (`apps/worker-app`):

| Crate | What | Builds |
|---|---|---|
| `worker` | `core.rs` (~240 lines): the pool's frames, our frames, which models to offer, the JSON check (`fits`), the backoff, when to cool down; no network, files or clock. `native.rs` (~390) and `meter.rs` (~110): the pool socket, Ollama, macmon. `main.rs`: the `visualia-worker` program | native; `core` alone also for wasm32 (`--no-default-features`) |
| `src-tauri` | the app (~160 lines): keychain, Join / Leave, the worker in-process (a tokio task), its events to the window | native |

Same behaviour and log lines as `apps/pool/worker-node.mjs` (sign-in, one
outbound WebSocket with Origin and cookie, ping 25 s, backoff to 60 s, re-sign-in
when refused, models offered only when installed, chat on Ollama `/api/chat`
with `think: false`, schema as `format` and on 501 in the prompt with the
answer held back and checked, decisions on `/v1/systemone`, cancel, macmon
energy, refuse over 85 °C, rest above 75 °C until 65 °C or 60 s, unload on
quit). Dependencies: tokio, tokio-tungstenite and reqwest on the system's TLS
(Security.framework), serde_json, chrono; the binary links only system
libraries.

**Sizes** (M1, release, stripped, ad-hoc signed):

| | Before (Node sidecar) | Now |
|---|---|---|
| The app | 127 MB (Node 117 MB) | **3.6 MB** |
| The app, zipped | 40 MB | **1.7 MB** |
| The terminal program | (Node + script) | **1.3 MB** `visualia-worker` |
| `core` as WebAssembly | | **84 KB**, 35 KB gzipped (no glue yet) |

**Verified on the M1** (asker eka-test-001 through https://gw.visualia.space;
worker = the `m1-1` key from the M1's own env file):
- the program: English and Estonian chat on `pool/qwen3.5-9b` streamed from
  the M1 (first token 1.0–4.8 s), a schema job valid JSON (Ollama's MLX
  runner answers 501 to `format`, so the prompt route with the check ran), a
  decision with Clef loaded on demand (7.7 s, 25 J chip); SIGKILL mid-story:
  "worker left", the cloud continued the same stream; SIGTERM: "left the
  pool", Ollama emptied, macmon stopped; no worker: chat and decide from the
  cloud. Usage rows: `served_by m1-1`, `served_kind node`, energy on every
  served part, the killed part `ok = 0`.
- the app (debug build, key from the environment because the M1's keychain is
  locked over SSH with the lid closed): joined, served an Estonian chat (64 J)
  and a decision (28 J); SIGTERM now quits the normal way (leaves, unloads).
  Found and fixed: SIGTERM used to kill the app without leaving; saving the
  key added a second event listener (every job shown twice).
- **The M1's LaunchAgent now runs the Rust program**
  (`~/visualia-worker/pool/visualia-worker`); the JS copies there are gone.

**ThreatLocker on the work Mac (M2): blocked.** The arm64 `visualia-worker`
(valid ad-hoc signature) is killed at once, exit 137, no output, even for
`--version`, like esbuild 0.28.2 earlier. So `apps/pool/worker-node.mjs`
stays: Node from Homebrew is allowed there. A Developer ID signature may get
it through an allowlist by publisher; to test once we have one.

**The browser tab later (not done):** the tab worker (`apps/pool/public`) could
use `core` as WebAssembly instead of its own JavaScript copy of the frames,
limits and checks. What it would take: a small `wasm` feature with
`wasm-bindgen` exports (parse a frame, build hello/delta/done/error, `fits`,
`json_prompt`, `unfence`, `offered`, the cool-down checks), built with
`wasm-pack --target web`, loaded by the join page (CSP: `'wasm-unsafe-eval'`
is already allowed); the tab keeps its own socket and WebLLM calls (WebLLM is
the engine there, not Ollama). Worth it once the tab and the native worker
both change often; today the tab's own copy is a small part of `join.html`.

<details><summary>The Node sidecar spike before it (same day)</summary>

The first spike ran `apps/pool/worker-node.mjs` on a pinned Node v24 sidecar
inside the app (127 MB, 40 MB zipped; the Rust core 9.6 MB). It served a chat
and a decision on the M1 and showed the keychain issue below. Replaced by the
Rust worker when the teacher chose one small program with no bundled runtime.
</details>

**Found (still true):**
- A keychain entry made by another program makes the app wait on an "allow
  access?" dialog, and an ad-hoc build changes identity on every build, so each
  rebuild asks again. Signed builds (Developer ID) keep access across updates.
- ~~macmon is not bundled~~ (2026-10-23): macmon's library (`macmon =0.10.0`,
  MIT, without its app features) is linked into the worker, macOS only. Power,
  temperatures and memory are read in-process on a thread every 250 ms (IOReport
  and SMC, no sudo); no macmon binary, nothing to install. Test
  `cargo test -p worker meter -- --nocapture` on the M1, which has no macmon:
  4.47 W, 51.8 °C, 11.9/16 GB; a 1.5 s busy job 6.07 J chip, 4.49 J net,
  16.71 J system. The app is 3.86 MB and links only system libraries
  (`libIOReport` among them). `MACMON` and `Config.macmon` are gone. Built
  on the M1, **not installed there yet**: an ad-hoc rebuild asks for
  keychain access again, and nobody is at the M1 to allow it.

## Next

1. **Bundled Ollama** (the engine decision in `pool.md`). Official macOS build
   v0.40.5: `ollama-darwin.tgz` 174 MB, SHA-256
   `75f9907dafa2fd4c61b5967de2ebb81ccc17eb28da9172edbad0dbc717474dcf`,
   540 MB unpacked (universal: x86 CPU variants included; an arm64-only cut
   would be smaller, to measure). Homebrew's build is 51 MB but needs
   Homebrew's mlx, mlx-c, python and others, so it can't be bundled. Plan: a
   `fetch-ollama.mjs` (pinned version and hash), the
   files as a sidecar, run on a private port (not 11434, so it
   never collides with an Ollama the person already has) with
   `OLLAMA_MODELS` in the app's own folder, one model at a time; or use the
   person's own Ollama when it is there. (The decision below: a separate
   download from Ollama's maker.) Model downloads from the pinned list
   with SHA-256 checks, in the window, with sizes.
2. ~~**macmon**~~: linked in as a library (2026-10-23, above).
3. **Signing and notarisation** in GitHub Actions (tag → build → sign with a
   Developer ID → notarise → attest → release); needs the signing identity
   (`pool.md` open question 3). Then a login item ("Join when this computer
   starts") with `--join`.
4. **Windows** (the VR lab's GeForce PCs): the worker builds there as is; Ollama's Windows build
   (Ollama's CUDA zip is 1.4 GB), Credential Manager (the `keyring` crate
   already covers it), `nvidia-smi` for energy. Linux after.
5. A menu-bar (tray) icon so the window can close while the worker runs.
6. `WORKER.md`: the plain-language page for IT and students (`pool.md`).

## Decision (2026-10-22, the teacher)

Size is not the problem; installs are (school IT). The engine is a second,
separate download: Ollama from its maker (signed, ~175 MB), not bundled inside
our app, so IT allowlists a known publisher and updates each part on its own.
In labs the tab comes first; the app is for machines whose IT agrees to deploy
it (Intune/Jamf). A note for EKA IT is in Claude Docs:
https://claude.ai/artifact/54RozP72WYmyQEsSBixY8W

Then, the same day: **the Rust port after all.** One small program with no
bundled runtime for IT to patch (3.6 MB instead of 127 MB), the same code for
the app and the terminal, and its decisions (`core`) free of I/O so the tab can
share them as WebAssembly later. Kept simple: plain functions, two crates.

## Built (2026-10-22): no terminal needed

A student installs Ollama from ollama.com like any app (Mac: drag to
Applications; Windows: OllamaSetup.exe), then our app does the rest:
- **No Ollama** (GET /api/version fails): "This app needs Ollama, a free
  program that runs the models." with "Get Ollama" (opens
  https://ollama.com/download in the browser, the one fixed page the app can
  open, command `open_get_ollama`) and "Check again". Join stays off.
- **Ollama there**: "Models" lists what the app can download, from
  `core::GETTABLE`: Qwen 3.5 (9B), 7.6 GB, needs 16 GB of memory; Gemma 4
  (26B), 16.1 GB, needs 32 GB. Each row says Ready, "Get (7.6 GB)", or "Needs
  32 GB of memory"; under it "This computer has 16 GB of memory" (sysctl
  hw.memsize). Clef stays M1-only (a custom Modelfile), served when present.
- **Get**: Ollama's /api/pull, streamed; the percent over all parts,
  "Downloading 42% · Stop"; one download at a time; stopping keeps the parts,
  the next Get goes on from there. Join turns on once one servable model is
  there.
- Before joining, the window shows only what is needed: no empty "Serving"
  or "Jobs" until there is something in them.

**Verified on the M1** (debug build; the window itself can't be clicked over
SSH with the lid closed, so `worker/examples/onboard.rs` runs the same
functions from a terminal): Ollama stopped → "no Ollama"; started → its tags;
`qwen3:0.6b` (test-only, `VISUALIA_TEST_GET` in debug builds) stopped at 30%,
resumed from 30%, finished, then removed. The debug app with `--join` served
a qwen3.5-9b chat through gw.visualia.space (4.8 s, 27 J). The four window
states rendered in WebKit with a stand-in bridge. Release app 3.7 MB.

Renamed 2026-10-22 (the teacher): the app is **Visualia Pool** (`space.visualia.pool`,
binary `visualia-pool`), described in its metadata only as an educational tool.
The keychain entry moved with the identifier, so a key saved in the old
"Visualia Worker" has to be entered once more. The folder stays `apps/worker-app`.
