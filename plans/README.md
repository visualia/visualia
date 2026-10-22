# Plans board

| Plan | Status | What |
|---|---|---|
| [walking-skeleton](walking-skeleton.md) | shipped | One Worker, one model call through AI Gateway, one usage row in D1 |
| [first-pages](first-pages.md) | shipped | Can cheap models make working pages from Estonian briefs? |
| [probe](probe.md) | building | What can my machine run? Web page first, CLI later |
| [studio-core](studio-core.md) | building | Describe a page, watch it build live, change it, publish it |
| [usage-page](usage-page.md) | shipped | The class's shared view of what was used and what it cost |
| [multi-file](multi-file.md) | building | Projects beyond one HTML file: Computer's Workspace in the studio agent, preview.visualia.space, snapshots in R2 (spike paused, see its last section) |
| [local-models](local-models.md) | building | Local models from the browser (in the tab, local Ollama) and a class pool |
| [local-images](local-images.md) | building | What the M1 can draw: FLUX.2 klein, Z-Image, ERNIE-Image via mflux; speed, energy, licences |
| [class-space](class-space.md) | building | One permanent class chat and everyone's work on the home page, peers change each other's projects (credited), phone first |
| [pool](pool.md) | building | Shared compute that connects out only: a tab or a signed Tauri worker; auditable, open source |
| [worker-app](worker-app.md) | building | The pool worker in Rust: the `visualia-worker` program (1.3 MB, runs on the M1) and a Tauri app around it (3.6 MB), the key in the keychain; `core` free of I/O for the tab later; next signing and Ollama as a separate download |
| [board](board.md) | building | The wall: every work in the class as one document in the Class DO; canvas on laptops, newest-first feed on phones; groups, moves, undo, remix lines |
| [style](style.md) | building | One small sheet: black sans on white, hierarchy from size, weight, opacity, whitespace |

## Backlog

Not plans yet. One line each; a line becomes a plan file when we pick it up.
Roughly in order within each group.

**Fix and finish**
- Instructions v0.4: v0.3 plus the short file's concrete rules; eval 2–3×.
- Before students: proper login (EKA OIDC?), budgets per student. (AI Gateway payload logging stays on: the teacher's call, 2026-10-22.)
- Energy on the usage page: measured J for `m1-1` rows, ranges for cloud.

**Media on the M1** (one model at a time, ~11 GB; all MLX)
- Images on the M1: an `m1-1/` image route in the proxy (mflux, FLUX.2 klein 4B) behind the gateway's `/v1/images` (the cloud route is done, `studio-core.md`).
- Speech to text: Whisper / Qwen3-ASR via mlx-audio. Speak a brief instead of typing. Check Estonian.
- Text to speech: Qwen3-TTS / Kokoro via mlx-audio; Estonian is the question (TartuNLP's voices?).
- Music and sound: mlx-audio's music models, Stable Audio Open Small. Sound for p5 / Tone.js pages.
- Video: Wan 2.2 5B or LTX-2.3 via mlx-video. Test only: likely minutes per second of video on 16 GB.

**Board** (`board.md`)
- Group suggestions from embeddings: BGE-M3 (`research/embeddings.md`) as `pool/bge-m3` on the M1, `@cf/baai/bge-m3` as fallback; "Put with…" and similar works.
- Presence on works and "follow" on the projector (step 5); notes (step 6).
- Opening a work in place (step 7); far-zoom 2D canvas; group aggregation.
- "Since you were here" from the op log; overlaps nudged apart.

**Studio**
- "Fix it" uses the checker's stored `off` sentence and the screenshot (both done, `studio-core.md`).
- Skills on demand (p5, three.js, sound, charts), loaded when the brief needs them.
- Multi-file projects (`multi-file.md`): finish the spike's UI checks (paused).
- Remove single-file mode once multi-file works on all page models (DeepSeek, Gemma 4 cloud, Gemma 4 26B local): every project becomes files; old pages are imported as index.html; then drop `kind` and the srcdoc-only path.
- Use my computer, then the class pool (`local-models.md` steps 2–3).
- Rooms and the other collective features (`schools/eka/docs/STUDIO.md`).

**Worker app engines** (needs the M1; this Mac's ThreatLocker blocks new binaries, Docker has no Apple GPU)
- Bundle a pinned Ollama as the worker app's engine on every platform (MLX on Macs, CUDA on GeForce) instead of llama-server; measure its bundled size and speed/energy on the M1.
- Apple's built-in model (Foundation Models, macOS 26+) for small jobs on Macs via a tiny Swift helper: no download; tool calling partly broken upstream, 8k context.
- Fallback if Ollama is too big to bundle: SwiftLM (native Swift/MLX server, prebuilt binary).
- Release builds, signing and notarisation in GitHub Actions; speed and energy tests on real hardware only.

**Housekeeping**
- SSH to the M1 over the tunnel (key-only sshd, tunnel hostname, Access app).
- Remove the three spare Ollama builds on the M1 (~22 GB).

Course-level material for EKA is in `schools/eka/docs/` (PLAN, INFRA, STUDIO,
STRUCTURE, VISUALIA, WORKSHOP, POSITRON).
