---
status: building
---

# Worker app: the pool on a desktop, as an app

The pool's second way to join (`pool.md` "Two ways to join"): a signed,
per-user app for Macs first, then Windows and Linux. It must stay small enough
for school IT and students to audit. Code: `apps/worker-app`.

## Built (2026-10-22): the spike

**What it is.** A Tauri v2 app (2.12): one plain window in our own HTML and
`visualia.css`, a Rust core of ~180 lines, and the existing worker script
(`apps/pool/worker-node.mjs`) running on a pinned Node.js sidecar.

- **The window**: course key (saved to the macOS keychain, never to a file;
  the window can save and forget it, not read it), Join / Leave, the models
  offered, the graphics chip's temperature, and a list of jobs (time, model,
  tokens or "a decision", seconds, joules). Never a prompt or an answer.
  Wording: "Join the pool", "Connects out to pool.visualia.space only. Never
  shows or keeps what people ask."
- **The core** (`src-tauri/src/main.rs`): six commands (`has_key`, `status`,
  `save_key`, `forget_key`, `join`, `leave`); starts the worker
  with a cleared environment (only the key, the event switch and the model
  list), relays its JSON lines to the window as `worker` events, keeps the
  latest joined/waiting event for a window that opens later. Leaving writes
  "quit" to the worker's stdin (it stops its job, which the cloud finishes,
  and unloads its models), waits 5 s, then ends it. Quitting the app leaves
  the pool the same way; if the app dies, the worker's stdin closes and it
  leaves. `--join` joins at start, off the main thread, whether or not the
  window is shown (for a login item).
- **The worker**: unchanged behaviour (outbound only, macmon energy,
  cool-down, `decide` jobs to Ollama's `/v1/systemone`), plus `WORKER_EVENTS=1`:
  one JSON line per event on stdout (`joined`, `waiting`, `job`, `temp`,
  `cooling`, `cooled`, `left`), the log on stderr, "quit" on stdin. The same
  file runs from the terminal and in the M1's LaunchAgent.
- **The audit surface**: `capabilities/default.json` names everything the
  window may ask (listen to events, the six commands; no files, no shell, no
  network from the window: its CSP allows only the app's own files and IPC).
  The commands are declared in `build.rs`, so a command missing from the
  capability file can't be called.

**Why a Node sidecar and not a port.** One worker implementation for the
terminal, the LaunchAgent and the app: what IT audits is the same 300 lines
whichever way a computer joins, and fixes land once. A port to Rust (tokio,
tungstenite, reqwest) would be a second implementation of the protocol, the
JSON check and the energy meter; a port into the webview can't set the
Origin and cookie headers the pool's socket needs and would put the course key
in the window. Cost: Node adds 117 MB to the app (most of its size). Later,
if size matters: a Node single executable is no smaller; the port to Rust is
the way to ~10 MB, once the protocol settles.

**Sizes** (M1, release build, ad-hoc signed): the app 127 MB, of which Node
117 MB and the Rust core 9.6 MB; zipped 40 MB. Debug bundle 144 MB. First
build 40 s (Rust 1.99.1 via rustup in the home folder, no admin; Tauri CLI
2.12.4 from npm).

**Verified on the M1** (2026-10-22, lid closed, over SSH; the LaunchAgent
worker stopped for the test and restarted after):
- the debug build saved the `m1-1` key to the keychain itself and read it
  back; `--join` joined the pool as `m1-1` with `pool/qwen3.5-9b` and
  `pool/clef-flash` on the bundled Node;
- through the public gateway as eka-test-001: a `pool/qwen3.5-9b` chat (24
  tokens, 6.2 s, 39 J chip) and a `/v1/decide` (Clef loaded on demand, 7.6 s,
  29 J) were served by the app;
- a normal Quit (AppleEvent, as Cmd+Q): "left the pool", Ollama emptied; a
  second start read the key from the keychain with nothing in its
  environment.
- The window couldn't be photographed on the M1 (lid closed: no display; the
  page also never finished loading there while the keychain blocked the main
  thread, see below). It was rendered in WebKit here with the real run's
  events replayed (light, dark, no key): one bug found and fixed (`hidden`
  sections showed, since `visualia.css` makes sections grids).

**Found:**
- A keychain entry made by another program (`security`) makes the app wait
  on an "allow access?" dialog; an unsigned or ad-hoc build changes identity
  on every build, so every rebuild asks again. The app's own entries don't
  ask. Signed builds (Developer ID) keep access across updates. Reading the
  key at start now happens off the main thread, so the window never freezes.
- macmon is not bundled: on a Mac without Homebrew's macmon, energy is null.

## Next

1. **Bundled Ollama** (the engine decision in `pool.md`). Official macOS build
   v0.40.5: `ollama-darwin.tgz` 174 MB, SHA-256
   `75f9907dafa2fd4c61b5967de2ebb81ccc17eb28da9172edbad0dbc717474dcf`,
   540 MB unpacked (universal: x86 CPU variants included; an arm64-only cut
   would be smaller, to measure). Homebrew's build is 51 MB but needs
   Homebrew's mlx, mlx-c, python and others, so it can't be bundled. Plan: a
   `fetch-ollama.mjs` like `fetch-node.mjs` (pinned version and hash), the
   files as a sidecar plus resources, run on a private port (not 11434, so it
   never collides with an Ollama the person already has) with
   `OLLAMA_MODELS` in the app's own folder, one model at a time; or use the
   person's own Ollama when it is there. Model downloads from the pinned list
   with SHA-256 checks, in the window, with sizes.
2. **macmon**: bundle it (MIT, ~2 MB) pinned by hash, or read power through
   IOReport directly from the Rust core.
3. **Signing and notarisation** in GitHub Actions (tag → build → sign with a
   Developer ID → notarise → attest → release); needs the signing identity
   (`pool.md` open question 3). Then a login item ("Join when this computer
   starts") with `--join`.
4. **Windows** (the VR lab's GeForce PCs): Node and Ollama's Windows builds
   (Ollama's CUDA zip is 1.4 GB), Credential Manager (the `keyring` crate
   already covers it), `nvidia-smi` for energy. Linux after.
5. A menu-bar (tray) icon so the window can close while the worker runs.
6. `WORKER.md`: the plain-language page for IT and students (`pool.md`).
