---
status: idea
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
