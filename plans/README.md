# Plans board

| Plan | Status | What |
|---|---|---|
| [walking-skeleton](walking-skeleton.md) | shipped | One Worker, one model call through AI Gateway, one usage row in D1 |
| [first-pages](first-pages.md) | shipped | Can cheap models make working pages from Estonian briefs? |
| [probe](probe.md) | building | What can my machine run? Web page first, CLI later |
| [studio-core](studio-core.md) | building | Describe a page, watch it build live, change it, publish it |
| [usage-page](usage-page.md) | shipped | The class's shared view of what was used and what it cost |
| [multi-file](multi-file.md) | idea | Projects beyond one HTML file: Computer's Workspace in the studio agent, preview.visualia.space, snapshots in R2 |
| [local-models](local-models.md) | building | Local models from the browser (in the tab, local Ollama) and a class pool |
| [local-images](local-images.md) | building | What the M1 can draw: FLUX.2 klein, Z-Image, ERNIE-Image via mflux; speed, energy, licences |
| [style](style.md) | building | One small sheet: black sans on white, hierarchy from size, weight, opacity, whitespace |

## Backlog

Not plans yet. One line each; a line becomes a plan file when we pick it up.
Roughly in order within each group.

**Fix and finish**
- Studio match score never arrives (HANDOFF open 0; reporting change local, undeployed).
- Instructions v0.4: v0.3 plus the short file's concrete rules; eval 2–3×.
- Before students: AI Gateway payload logging off, proper login (EKA OIDC?), budgets per student.
- Energy on the usage page: measured J for `m1-1` rows, ranges for cloud.

**Media on the M1** (one model at a time, ~11 GB; all MLX)
- Images through the gateway: an `m1-1/` image route in the proxy (mflux, FLUX.2 klein 4B), Workers AI klein 4B as the cloud twin; images saved as project files in R2.
- Speech to text: Whisper / Qwen3-ASR via mlx-audio. Speak a brief instead of typing. Check Estonian.
- Text to speech: Qwen3-TTS / Kokoro via mlx-audio; Estonian is the question (TartuNLP's voices?).
- Music and sound: mlx-audio's music models, Stable Audio Open Small. Sound for p5 / Tone.js pages.
- Video: Wan 2.2 5B or LTX-2.3 via mlx-video. Test only: likely minutes per second of video on 16 GB.

**Studio**
- See the page: a screenshot of the preview to a vision model (Clef has vision) for the match score and for "Fix it".
- Images in pages: "make me an image of …" inside a project, the page uses it.
- Skills on demand (p5, three.js, sound, charts), loaded when the brief needs them.
- Multi-file projects (`multi-file.md`).
- Use my computer, then the class pool (`local-models.md` steps 2–3).
- Rooms and the other collective features (`schools/eka/docs/STUDIO.md`).

**Housekeeping**
- SSH to the M1 over the tunnel (key-only sshd, tunnel hostname, Access app).
- Remove the three spare Ollama builds on the M1 (~22 GB).

Course-level material for EKA is in `schools/eka/docs/` (PLAN, INFRA, STUDIO,
STRUCTURE, VISUALIA, WORKSHOP, POSITRON).
