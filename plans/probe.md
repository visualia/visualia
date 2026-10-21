---
status: building
---

# Probe: what can my machine run?

Every student finds out, in the first session, what their own laptop can do
with local models, and the class sees its hardware spread. Two layers over one
model table.

## Model table (`packages/models/models.json`)

Data, not code: each model's size on disk at a given quantisation, the memory
it needs, what it's good for (page-making, chat, decisions, Estonian), how to
get it (Ollama tag, MLX repo), and where each number came from. Updated as
models change; the tools never hardcode models.

## Web page (`apps/probe/index.html`), first

Zero install. Detects what a browser can see, asks for what it can't, and
answers per model from the table. Browsers hide exact memory (Chrome caps it at
8 GB, Safari gives nothing) and free disk (only a storage quota), so the page
shows what it detected, pre-fills its best guess, and lets the student correct
it from "About This Mac" / Task Manager. Later: an in-browser speed test.

## CLI (later, `npx visualia-probe`)

Exact numbers, for students who want local models:

- chip, memory, GPU-usable memory (macOS default limit, or NVIDIA VRAM),
  **free disk**, OS, installed runtimes (Ollama, LM Studio, MLX, llama.cpp);
- per model: fits / doesn't, with the reason ("needs 21 GB disk, you have 9.7");
- `--json` for machines; later `--bench` (pull one model, run the first-pages
  briefs: tokens/s, pass rate, energy via macmon) and `--send` (post to the
  gateway with the student's key, for the class dashboard).

Lesson that shaped it: the teacher's own M2 Pro has 32 GB, enough for the
models worth testing, but 9.7 GB free disk, so memory alone gives the wrong
answer.


## First version (2026-10-21)

`apps/probe/index.html`, Estonian, one file, reads `packages/models/models.json`.
On the teacher's M2 Pro in Chrome it pre-filled 32 GB and 10 GB free disk
(real: 9.7) without input: Chrome now reports real memory, and its storage
quota tracked free disk closely here. Verdicts: Clef-flash, 9B models and EstLLM
run; the 17–21 GB page-making models don't fit for disk; with 40 GB free, Qwen
3.8 27B fits, Qwen 3.6 35B-A3B is just over macOS's default GPU limit (~2/3 of
32 GB). Deployed at https://probe.visualia.space (static Worker, models.json copied in
at deploy). Not tested in Safari or Firefox.

All UI text is in English for now (decision 2026-10-21); Estonian later.
