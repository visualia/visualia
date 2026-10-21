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

## Rewritten for students (2026-10-21)

The first version was written for the teacher ("WebGPU", "storage quota",
"MLX 4-bit"). Now it leads with one plain sentence, then **what you can do**
(chat with a small AI, judge work with a decision model, make web pages: yes,
not yet with "free up N GB", or no), then the computer in plain words (memory
plenty, free space tight, graphics good for AI). Model names, sizes and the
correction fields are folded under "Details and corrections".

## Speed test (2026-10-21)

A "Test my computer" button under "Your computer" (local-models step 1).
Nothing runs on load: the page only checks WebGPU and whether the test model is
already in WebLLM's cache (`webllm/model`), and says "downloads about 300 MB,
kept for next time" or "already on this computer". On click it loads WebLLM
0.2.86 from jsDelivr (pinned) and `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`
(~290 MB; the q4f32 variant on graphics without 16-bit shaders), shows the
download as a percentage, writes 200 tokens for "Write a short HTML page with a
red circle." (`ignore_eos`, temperature 0) and times the writing only (WebLLM's
`decode_tokens_per_s`; no download or prompt time). One row: "Speed — N tokens
a second", plus the estimate for a ~9B model and the time for a ~1,200-token
page vs the studio's ~10 s. No WebGPU: "can't test in this browser (needs
WebGPU; try Chrome)". Errors become one plain sentence (memory, download, lost
device, other).

Measured on the teacher's M2 Pro 32 GB in Chrome: 79 tok/s on the first run
(with download), 87–92 tok/s cached; a cached test takes ~4.5 s. Scaling by
parameters (18×) would have said 5 tok/s for 9B, which is too pessimistic: tiny
models are held back by per-token overhead. A one-off calibration with
Qwen2.5-1.5B (57 tok/s, removed from the cache afterwards) fits 8 ms + 10 ms
per GB of weights, so 9B 4-bit ≈ 16 tok/s, about 6× slower; the page divides by
6 and calls it a rough estimate ("about 14 tokens a second here, a page in
about 80 s"). Slower graphics are more size-bound, so the ratio is likely
larger there. Not tested in Safari or Firefox, and the error paths were not
triggered for real.
