# worker-app

The pool worker for computers with Ollama (`plans/worker-app.md`): one Rust
worker, run two ways.

```
worker/      core.rs    the decisions, no I/O (frames, models offered, JSON check, cool-down)
             native.rs  the talking: outbound wss to pool.visualia.space, Ollama on 127.0.0.1
             meter.rs   energy per job from macmon
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
cargo test -p worker --no-default-features
cargo build -p worker --no-default-features --target wasm32-unknown-unknown   # core alone, as WebAssembly
```

The program: `VISUALIA_KEY=<course key> visualia-worker` (environment:
`POOL`, `OLLAMA`, `POOL_MODELS` e.g. `qwen3.5-9b=qwen3.5:9b,clef-flash=clef-flash-8k`,
`MACMON`); Ctrl+C or SIGTERM leaves the pool and unloads the models.
`--version` prints the version.

The app: run it, or `Visualia Pool.app/Contents/MacOS/visualia-pool --join`
to join at once (for a login item). Debug builds only: `VISUALIA_KEY` in the
environment is used instead of the keychain (for tests on a machine nobody is
looking at).

First screen: checks for Ollama (else "Get Ollama", which opens
https://ollama.com/download), lists the models it can download for this
computer's memory, and downloads one with a percent through Ollama. Without a
screen: `cargo run -p worker --example onboard [tag] [stop-at-%]` does the same
from a terminal.

**Audit**: `worker/src/` (what runs and what it talks to),
`src-tauri/capabilities/default.json` (what the window may ask for),
`src-tauri/tauri.conf.json` (the window's Content Security Policy),
`apps/pool/README.md` (what a worker never does).
