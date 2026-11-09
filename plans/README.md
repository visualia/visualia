# Plans board

| Plan | Status | What |
|---|---|---|
| [walking-skeleton](walking-skeleton.md) | shipped | One Worker, one model call through AI Gateway, one usage row in D1 |
| [first-pages](first-pages.md) | shipped | Can cheap models make working pages from Estonian briefs? |
| [probe](probe.md) | building | What can my machine run? Web page first, CLI later |
| [studio-core](studio-core.md) | building | Describe a page, watch it build live, change it, publish it |
| [usage-page](usage-page.md) | shipped | The class's shared view of what was used and what it cost |
| [multi-file](multi-file.md) | building | Projects beyond one HTML file: Computer's Workspace in the studio agent, preview.visualia.space, snapshots in R2 (single-file mode removed and deployed 2026-10-23) |
| [local-models](local-models.md) | building | Local models from the browser (in the tab, local Ollama) and a class pool |
| [local-images](local-images.md) | building | What the M1 can draw: FLUX.2 klein, Z-Image, ERNIE-Image via mflux; speed, energy, licences |
| [local-video](local-video.md) | dropped | Kandinsky 6.0 Video Lite on the M2: official code NVIDIA-only, 26.7 GB, PyTorch only; too hard for a portable worker. Video stays in the cloud, or on GeForce PCs later |
| [class-space](class-space.md) | building | One permanent class chat and everyone's work on the home page, peers change each other's projects (credited), phone first |
| [pool](pool.md) | building | Shared compute that connects out only: a tab or a signed Tauri worker; auditable, open source |
| [mcp](mcp.md) | building | Your own AI tool reading Visualia: `mcp.visualia.space`, sign in with the course key (OAuth), read-only tools for work, projects, chat, usage; for everyone in the course |
| [worker-app](worker-app.md) | building | Visualia Pool in Rust (`apps/pool-app`): the `visualia-pool-cli` program (1.3 MB) and a Tauri app around it (4.2 MB), the key in the keychain; `core` free of I/O for the tab later; updates from the pool, signed and on a click (built, not live yet); next signing and Ollama as a separate download |
| [board](board.md) | dropped | The first board, cleared 2026-10-23 (`packages/board`, the Class DO's board). A new board gets built: types first, AI sight, MCP |
| [boards](boards.md) | building | Many boards per school, each a surface, built type by type with the teacher; first type: text (live, pan and zoom) |
| [style](style.md) | building | One small sheet: black sans on white, hierarchy from size, weight, opacity, whitespace |
| [backstage](backstage.md) | standing | What may be inferred about a student's process: only on the student's request, backstage private by default, publishing explicit, no process dashboards |
| [board-sight](board-sight.md) | idea | How an AI sees and edits a board: records first, Set-of-Marks screenshots, the same `put / set / del`, comments; waits for the teacher's choice |
| [taste-rules](taste-rules.md) | idea | Readable taste rules a student asks for and owns (CIPHER with Clef); an optional small scorer |
| [small-data](small-data.md) | idea | Tiny models from students' own material with dataset cards; browser first, then resumable `train-small` jobs on the pool |
| [estonian-visuals](estonian-visuals.md) | building | How well models know Estonia, as a playground: generate, judge with fixed vision models, show side by side; EKI's imagery tests redone on our models; folk costumes from rahvaroivad.ee (licence to ask) |
| [early-imagegen](early-imagegen.md) | building | The old image models without PyTorch: BigGAN and StyleGAN2-ADA in Burn, DALL·E mini in a tab; next an Early AI page and pool jobs |
| [design-classics](design-classics.md) | idea | A third visuals set: do picture models know graphic design movements (Bauhaus, Swiss, Constructivist, De Stijl…)? Ten prompts, visual criteria, the teacher labels |

## Backlog

Not plans yet. One line each; a line becomes a plan file when we pick it up.
Roughly in order within each group.

**Fix and finish**
- On 2026-11-21: take SDXL, SDXL Lightning and Dreamshaper 8 LCM off the Generate page (`apps/studio/public/generate.html`) and out of the gateway's `IMAGE_MODELS`; Workers AI drops them on 2026-11-20. Their local versions run on the M1 (`evals/estonian-visuals/local-sd.sh`).
- Import the M1's ChilloutMix, SDXL 1.0 and SDXL Lightning pictures into the visuals sets (`node run.mjs import`, both countries), judge, publish.
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
- Boards (`boards.md`): built type by type with the teacher; text is live. The teacher picks the next type or idea.

**Studio**
- "Fix it" uses the checker's stored `off` sentence and the screenshot (both done, `studio-core.md`).
- Skills on demand (p5, three.js, sound, charts), loaded when the brief needs them.
- Multi-file projects (`multi-file.md`): check an old project signed in; tools through the pool's node worker for local Gemma.
- Use my computer, then the class pool (`local-models.md` steps 2–3).
- Rooms and the other collective features (`schools/eka/docs/STUDIO.md`).

**Worker app engines** (needs the M1; this Mac's ThreatLocker blocks new binaries, Docker has no Apple GPU)
- Bundle a pinned Ollama as the worker app's engine on every platform (MLX on Macs, CUDA on GeForce) instead of llama-server; measure its bundled size and speed/energy on the M1.
- Apple's built-in model (Foundation Models, macOS 26+) for small jobs on Macs via a tiny Swift helper: no download; tool calling partly broken upstream, 8k context.
- Fallback if Ollama is too big to bundle: SwiftLM (native Swift/MLX server, prebuilt binary).
- Release builds, signing and notarisation in GitHub Actions; speed and energy tests on real hardware only.
- Adapters through R2: upload under a content hash, a registry row (base model, scope, parent, ed25519 signature), `adapter.available` pushed to runners with that base, checked on download; personal adapters owner-only (`research/small-data.md`).
- LoRA training without Python: test the QVAC llama.cpp fork (beta, SFT only) on one Mac and one GeForce PC; then rejection-sampling fine-tuning (generate N, keep the best, short SFT, repeat).

**Shared with positron** (`research/positron.md`)
- Write down the device message format both projects nearly use (a Durable Object WebSocket room, signed commands for anything that starts something), then extract it as a small package with tests, vendored at a tag.

**Housekeeping**
- SSH to the M1 over the tunnel (key-only sshd, tunnel hostname, Access app).
- Remove the three spare Ollama builds on the M1 (~22 GB).

Course-level material for EKA is in `schools/eka/docs/` (PLAN, INFRA, STUDIO,
STRUCTURE, VISUALIA, WORKSHOP, POSITRON).
