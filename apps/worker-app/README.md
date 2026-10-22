# worker-app

Visualia Worker: a small desktop app that puts this computer's Ollama models
into the class pool. A spike (`plans/worker-app.md`); the worker itself is
`apps/pool/worker-node.mjs`, the same script the command line and the M1's
LaunchAgent run.

```
window (ui/, our HTML + visualia.css)
  ⇅ six commands (src-tauri/capabilities/default.json lists them all)
Rust core (src-tauri/src/main.rs): keychain, start / stop the worker
  ⇅ stdin "quit" / stdout JSON lines (no prompts)
pinned Node.js sidecar → worker-node.mjs → outbound wss to pool.visualia.space, Ollama on 127.0.0.1
```

Build on a Mac with Rust (rustup) and Node:

```sh
cd apps/worker-app
npm install
npm run build         # copies visualia.css, fetches and checks Node, then tauri build
# debug bundle: npx tauri build --debug
```

`npm run prepare-app` fetches Node v24.22.1 from nodejs.org into
`src-tauri/binaries/`, checked against its SHASUMS256.txt and the hash pinned in
`scripts/fetch-node.mjs`.

Run it, or `Visualia Worker.app/Contents/MacOS/visualia-worker --join` to join
at once (for a login item). Debug builds only: `VISUALIA_KEY` in the
environment is saved to the keychain at start (for tests on a machine nobody is
looking at).

**Audit**: `src-tauri/capabilities/default.json` (what the window may ask for),
`src-tauri/tauri.conf.json` (the window's Content Security Policy, the bundled
files), `src-tauri/src/main.rs` (~180 lines), `apps/pool/worker-node.mjs` and
`meter.mjs` (what runs, what it talks to), `apps/pool/README.md` (what it never does).
