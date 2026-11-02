# worker-app

The pool worker for computers with Ollama (`plans/worker-app.md`): one Rust
worker, run two ways.

```
worker/      core.rs    the decisions, no I/O (frames, models offered, JSON check, cool-down)
             native.rs  the talking: outbound wss to pool.visualia.space, Ollama on 127.0.0.1
             meter.rs   energy per job, temperatures, memory (macmon's library, linked in)
             main.rs    the `visualia-worker` program (terminal, LaunchAgent)
src-tauri/   the app: a window (ui/, our HTML + visualia.css) around the same worker,
             the course key in the keychain; capabilities/default.json lists all
             the window may ask for
```

Build on a Mac with Rust (rustup) and Node (for the Tauri CLI only):

```sh
cd apps/worker-app
cargo build -p worker --release      # target/release/visualia-worker (1.3 MB)
npm install && npm run build         # target/release/bundle/macos/Visualia Pool.app (3.7 MB)
cargo test -p worker --lib --no-default-features   # without --lib the onboard example fails to build
cargo build -p worker --no-default-features --target wasm32-unknown-unknown   # core alone, as WebAssembly
```

The program: `VISUALIA_KEY=<course key> visualia-worker` (environment:
`POOL`, `OLLAMA`, `POOL_MODELS` e.g. `qwen3.5-9b=qwen3.5:9b,clef-flash=clef-flash-8k`);
Ctrl+C or SIGTERM leaves the pool and unloads the models.
`--version` prints the version.

The app: run it, or `Visualia Pool.app/Contents/MacOS/visualia-pool --join`
to join at once (for a login item). Debug builds only: `VISUALIA_KEY` in the
environment is used instead of the keychain (for tests on a machine nobody is
looking at).

First screen: checks for Ollama (else "Get Ollama", which opens
https://ollama.com/download), lists the models on the model list (sent by the
pool at `/app/models`, checked by `core::check_list`; a built-in copy when the
pool can't be reached) with what this computer's memory and disk allow, and
downloads one with a percent through Ollama, or removes one (×). Without a
screen: `POOL=… cargo run -p worker --example onboard [tag] [stop-at-%]`
or `onboard --remove <tag>` does the same from a terminal.

**Updates** (`plans/worker-app.md` step 4): the app asks
`https://pool.visualia.space/app/update/…` at start and every 6 hours, shows
"Version x is ready" and installs only when someone clicks Update: it leaves
the pool, downloads, checks the signature against the public key in
`tauri.conf.json`, replaces itself and restarts. Off with
`defaults write space.visualia.pool Updates off` (or the same key from MDM).
Build with the private key in the environment, then publish:

```sh
TAURI_SIGNING_PRIVATE_KEY=~/.config/visualia/pool-updater.key TAURI_SIGNING_PRIVATE_KEY_PASSWORD= npm run build
node publish-update.mjs --notes "what changed"     # R2, then latest.json
```

The private key is on the teacher's work Mac only, outside the repo; losing it
means installed apps can't update again (a new key needs a manual reinstall).
Debug builds only: `VISUALIA_TEST_UPDATE=1` installs a found update without a
click. To test without the live pool, build with
`--debug --config '{"version":"0.2.90","plugins":{"updater":{"endpoints":["http://127.0.0.1:8787/app/update/{{target}}/{{arch}}/{{current_version}}"],"dangerousInsecureTransportProtocol":true}}}'`
against `wrangler dev` in `apps/pool`, and publish with `--debug --local`.

**Audit**: `worker/src/` (what runs and what it talks to),
`src-tauri/capabilities/default.json` (what the window may ask for),
`src-tauri/tauri.conf.json` (the window's Content Security Policy),
`apps/pool/README.md` (what a worker never does).
