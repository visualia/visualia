---
status: building
---

# Worker app: the pool on a desktop, as an app

The pool's second way to join (`pool.md` "Two ways to join"): a signed,
per-user app for Macs first, then Windows and Linux. It must stay small enough
for school IT and students to audit. Code: `apps/pool-app`.

Renamed 2026-11-02, so "worker" no longer collides with Cloudflare Workers:
`apps/worker-app` → `apps/pool-app`, the crate `worker` → `pool-core`, the
program `visualia-worker` → `visualia-pool-cli`. Older sections below keep the
old names; this file keeps its name (plans never move). The pool's protocol
still says "worker" (`kind: node`, "N worker(s) in the class").

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
stayed: Node from Homebrew is allowed there (retired 2026-11-02, when
ThreatLocker blocked nothing and `visualia-worker` ran on the M2). A Developer ID signature may get
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

## Built (2026-11-02): updates, first slice

Tauri's updater (`tauri-plugin-updater` 2.14.1, system TLS like the worker):

- **Where from:** `https://pool.visualia.space/app/update/{{target}}/{{arch}}/{{current_version}}`,
  so "connects only to pool.visualia.space" stays true. The pool Worker serves
  `latest.json` (200 when newer, else 204) and the files from the R2 bucket
  `visualia-pool-app` (`apps/pool/README.md`); `publish-update.mjs` uploads the
  file, then the manifest.
- **Signed with our own key:** a minisign pair made with `tauri signer
  generate`; the public half is in `tauri.conf.json`, the private half in
  `~/.config/visualia/pool-updater.key` on the work Mac (no password, mode
  600, never in git). The check can't be turned off. Losing the key means
  installed apps can't update again.
- **When:** the app looks at start and every 6 hours; the window shows
  "Version x is ready. Updating leaves the pool and restarts the app. Update".
  Nothing downloads before the click. Install leaves the pool first (a
  running job goes on in the cloud), downloads, checks the signature,
  replaces the app where it is and restarts it, which joins again when a key
  and a model are there. The window shows its own version.
- **Off for IT:** `defaults write space.visualia.pool Updates off`, or the
  same key from an MDM profile: the app never looks, and the window says
  "Updates are turned off on this computer".
- **Done in Rust:** the window has no network permission still; it may call
  `update_status` and `install_update`, nothing else new.
- Release app 4.2 MB (was 3.86); the update file 2.1 MB.
- **The bundle is signed ad hoc by Tauri** (`bundle.macOS.signingIdentity: "-"`,
  added 2026-11-02 on the M1): before, only the binary carried the linker's
  signature and the bundle's seal was missing ("code has no resources but
  signature indicates they must be present"). A build run on the Mac that made
  it gets away with that; a copy from another Mac carries
  `com.apple.provenance` and macOS killed it at launch
  (`OS_REASON_CODESIGNING`). Updates arrive the same way, so this matters for
  them too. Now `codesign --verify --deep --strict` passes (with the hardened
  runtime flag), and the M1 runs the 0.3.0 built on the work Mac.

**Checked on the work Mac (M2), locally** (the live deploy was not run:
`wrangler dev` for the pool with its R2, debug builds pointed at it with
`--config`, see `apps/pool-app/README.md`):
- 0.2.90 in `~/Applications/vp-test` found 0.2.91, installed it, quit, and
  0.2.91 ran from the same place.
- Negative control: a "0.2.92" whose file had one byte flipped, with the real
  signature: refused ("The signature verification failed"); still 0.2.91 and
  running.
- Without auto-install the window showed the line with Update; with
  `Updates off` the app made no check and the window said so.
- The pool route: no manifest 204, older version 200 with the manifest, same
  version 204, file 200 (11 MB debug).
- `cargo test -p pool-core` passes (3 core, 4 with the native part).
- Built with Rust 1.96 from Homebrew's rustup, on the work Mac: ThreatLocker
  isn't blocking at present (2026-11-02), so the Rust program runs here now.

## Built (2026-11-02): one model list, from the pool

Before, the app had two lists in its code: what it offers to download
(`GETTABLE`) and what it serves (`MODELS`, with Clef-flash, which it could
not download). Now there is one list, sent by the pool at `GET /app/models`
(`apps/pool/src/models.js`), so models change with a pool deploy, not an app
update. Each entry: `name`, `label`, `tag`, `gb`, `need_gb`, and for a model
made from a download, `from` + `ctx` (Clef-flash: the Hugging Face GGUF,
then `ollama create` with `num_ctx 8192`, through Ollama's `/api/create`).
The app keeps a built-in copy (`core::built_in_models`) for when the pool
can't be reached; the terminal program uses it as its default.

**Hard limits in the app** (`core::check_list`, changed only by an app update):
- at most 8 models, at most 24 GB each; names `a-z0-9.-`; tags only from
  Ollama's library or `hf.co/<owner>/<repo>:<quant>`; labels without control
  characters; a bad entry is dropped and logged, the rest is kept;
- Get is refused without enough memory, or without the size × 1.1 plus 10 GB
  of free disk (the home volume, where Ollama keeps models by default);
- a download stops as soon as Ollama reports more than the listed size × 1.1
  (checked: a 0.5 GB model listed as 0.1 GB stopped before any data was
  written; Ollama's pre-allocated part file is sparse, 0 bytes on disk);
- nothing downloads without a click, one download at a time; a new list
  starts no download and removes nothing.

**Remove** (×, next to Ready): only while the computer is out of the pool,
only models on the list (never the person's other models), and a made
model's base too, unless another model on the list uses it.

Checked on the work Mac with `wrangler dev` and a stub list
(`onboard` example, `POOL=…`): the real list (3 models); a stub with four
bad entries kept one; the understated size stopped; an unreachable pool gave
the built-in copy; a model made from `qwen3:0.6b` with `num_ctx 4096`, then
Remove took both away and left the rest. The window (debug build) shows the
labels and "Ready ×". `cargo test -p pool-core`: 5 passed.

Not changed: the gateway's own allowlist (`POOL_MODELS` in
`apps/gateway/src/index.js`); the Node worker's own default went with it
(retired the same day).

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
4. **Updates, the rest** (the first slice is built, above):
   - **Live:** create the R2 bucket `visualia-pool-app`, deploy the pool
     (`npm run deploy` in `apps/pool`), publish 0.3.0
     (`node publish-update.mjs`). Nothing installed has the updater yet:
     0.2.0 (the M1, the work Mac's approved copy) gets 0.3.0 by hand once,
     and updates itself from then on.
   - **A backup of the private key** (`~/.config/visualia/pool-updater.key`,
     on the work Mac only), then a GitHub secret when releases move to CI
     (step 3).
   - **A channel per school** (`app/<school>/latest.json`; deploys are pinned
     to a tag), and the version in the pool's hello, so the pool can say
     "update" instead of the app asking every 6 hours.
   - **Windows:** the NSIS (or MSI) target and its platform in
     `publish-update.mjs` (step 5).
   - **Signing (step 3) still matters for updates:** each ad-hoc update is a
     new identity, so the keychain asks again; if ThreatLocker enforces again
     and approves by hash, each update needs a new approval.
5. **Windows** (the VR lab's GeForce PCs): the worker builds there as is; Ollama's Windows build
   (Ollama's CUDA zip is 1.4 GB), Credential Manager (the `keyring` crate
   already covers it), `nvidia-smi` for energy. Linux after.
6. A menu-bar (tray) icon so the window can close while the worker runs.
7. `WORKER.md`: the plain-language page for IT and students (`pool.md`).

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
