# Text to SVG: which models can draw vector from a brief

Written 2026-10-23. The question: which models can make good SVG from a short
brief, the kind art students write, and how fast? This covers chat models
writing SVG as code, and OmniSVG, a model built for SVG. Image-to-SVG
(tracing) is out of scope: see "Vector (SVG)" in `models-2026-10.md`.

**How this was checked:**
- Everything ran on the **M1 Pro (16 GB)**, Ollama 0.40.5, one model and one
  generation at a time. The M1 was also a live pool worker, so the script
  waits while any other model is loaded. It never had to wait.
  No temperature reading (no macmon on the M1). `pmset -g therm` showed no
  thermal or performance warnings.
- 8 briefs (`evals/svg/briefs.json`): 6 in English, 2 in Estonian. 4 need Estonian
  words in the image, 2 of them with ä or õ.
- Chat models: `evals/svg/run.mjs`, Ollama's `/api/chat` streaming, reasoning
  off, temperature 0.4, seed 42, at most 6,000 tokens out. The system prompt
  asks for one standalone SVG in a code block and for exact Estonian letters.
- OmniSVG: `evals/svg/omnisvg.py`, PyTorch 2.6.0 on MPS, bf16, with the
  official repo's tokenizer and SVG decoding (details below).
- Checks: `evals/svg/render.mjs` in headless Chromium (Playwright) on the M2.
  It checks well-formed XML with `DOMParser` and renders each file as an
  `<img>` (no scripts, no outside files) at 512 px. For animations it takes a
  second frame 1.5 s later and records whether anything moved. It also finds
  the required Estonian words in the `<text>`. Pattern tiles were also tiled 3×3 to
  check that the edges meet. I looked at every PNG.
- Judged like `browser-models.md`: **usable** (could go to a student as is),
  **needs fixing** (right idea, wrong detail or layout), **wrong** (broken,
  empty, not the thing asked for).
- Raw outputs, PNGs and logs are not in the repo. They are in
  `~/visualia-svg/` on the M1.

## The short answer

- **No local model makes good SVG reliably.** The best, Gemma 4 12B, gave 2
  usable out of 8, 5 that need fixing and 1 failure. Qwen3.5 9B, the pool's
  model today, gave 1 usable out of 8.
- **The common failures are layout and motion, not syntax.** Nearly every
  file parsed and rendered. But text ran off the edge or sat under a shape,
  chart bars ignored the zero line, and **no model made a working orbit
  animation**. Illustrations (a fox) came out as a few crude blobs.
- **Estonian letters were right** in every text that Qwen3.5 and both Gemma 4
  models wrote: "Kevadnäitus", "Avatud uste päev", "14. märts", "Põhja pst
  7", "Tere tulemast". Qwen2.5-Coder 7B invented months ("Januar", "Joolu",
  "Märts" for "oktoober").
- **Speed is fine without reasoning:** 8–60 s per SVG when the model doesn't loop, at 22–52 tokens/s, with
  the first token in under 2 s. With reasoning on, Qwen3.5 9B took 1.7 to 9.5 min per
  SVG and got only slightly better.
- **OmniSVG 1.1 4B runs on the M1 but is not useful here.** Its decoding
  is right: the repo's own example prompts give a clean heart and bookmark.
  On our briefs all 8 failed. It only writes filled paths on a 200×200 grid
  with 4-bit-per-channel colours, so it can't write text or animation. Longer
  briefs ran to its 1,536-token limit before closing the shape. It manages
  4–10 tokens/s, takes 35–370 s per SVG, and pushed the M1's swap to 11.8 GB.
- **StarVector has no text-to-SVG model to download.** Only `im2svg` 1B and
  8B are published. Text-to-SVG needs your own fine-tune (their config is for
  8 GPUs).
- **Recraft V4.1 vector was not tested.** It needs a key through the course
  gateway, and this run was told not to call the gateway.

## Results

Times are warm (model loaded first, outside the measurement). TTFT is time
to the first token. For reasoning runs, "answer" is when the SVG itself
started.

| Model | Download | Usable / needs fixing / wrong | s per SVG (median, range) | TTFT | tokens/s | Bytes (median) |
|---|---|---|---|---|---|---|
| **Gemma 4 12B** (`gemma4:12b`, q4) | 7.7 GB | **2 / 5 / 1** | 45 (20–219) | 0.8–1.8 s | 21–28 | 1,975 |
| Qwen3.5 9B (`qwen3.5:9b`) | already there (7.6 GB) | 1 / 4 / 3 | 30 (8–53) | 0.5–1.2 s | 26–33 | 1,583 |
| Qwen3.5 9B, reasoning on (**partial**: 7 of 8, stopped for time) | same | 1 / 4 / 2 | 233 (103–570) | 0.5–1.5 s, answer after 84–541 s | 20–28 | 1,503 |
| Gemma 4 E4B (`gemma4:e4b`) | already there (9.5 GB) | 0 / 4 / 4 | 20 (9–26) | 0.3–0.9 s | 43–52 | 1,995 |
| Qwen2.5-Coder 7B (`qwen2.5-coder:7b`) | 4.7 GB | 0 / 3 / 5 | 17 (5–264) | 0.3–1.8 s | 23–25 | 879 |
| OmniSVG 1.1 4B (PyTorch MPS) | 7.6 GB (+ 10 MB Qwen2.5-VL configs) | 0 / 0 / 8 | 123 (34–369) | 0.7–5.2 s | 4–10 | 3,233 (3 gave none) |

Per brief (U = usable, F = needs fixing, W = wrong):

| Brief | Gemma 4 12B | Qwen3.5 9B | Qwen3.5 9B think | Gemma 4 E4B | Coder 7B | OmniSVG 4B |
|---|---|---|---|---|---|---|
| bicycle icon, one line weight | W: looped on one path to 6,000 tokens, no SVG | F: wheels and a V, no frame | F: wheels and a lump | W: a black disc (no `fill="none"`) | W: a house | W: unrelated glyph |
| logo "Kevadnäitus 2027" | F: ä right, word runs over the badge edge | F: ä right, sun rays cross the word | **U**: ä right, clean | F: ä right, squiggles over letters | F: ä right, plain text only | W: empty |
| seamless folk tile, 3 colours | **U**: tiles cleanly, three colours | **U**: tiles (nothing crosses the edge), plain | F: tiles, two colours only | W: circles and stripes cut at the edge | F: tiles, holes and odd shapes | W: empty |
| fox in a birch forest | F: birches right, fox small and crude | W: fox unreadable | W: fox unreadable | W: red blob | W: looped, no SVG | W: black square |
| bar chart (Estonian) | F: right labels, bars float off the zero line | W: bars don't match the scale | F: bars right, tallest bar covers the title | F: line chart, no title, has a `<script>` | W: wrong months, wrong bars | W: empty |
| open-day poster (Estonian text) | F: title clipped, adds English "ART ACADEMY" | F: date half hidden, address missing | F: text crosses the grid lines | F: title clipped | F: title cut ("Avatud uste") | W: building-like shapes, no text |
| animated orbit (SMIL/CSS) | F: moves, but 6 circles, two fly to the corners | W: circles leave the canvas | W: hit 12,000 tokens, no SVG | W: not well-formed XML (`xlink` prefix undeclared) | W: circles slide, no orbit | W: a ring and blobs, static |
| house in snow (Estonian brief) | **U**: house, smoke, tree, sign readable (tree leans) | F: tree covers the sign | not run (stopped) | F: sign text overflows its box | W: a circle and a square | W: unrelated shape |

## OmniSVG 1.1 4B on Apple Silicon

- **It runs on MPS, with changes.** The official `inference.py` assumes CUDA
  (`torch.cuda.is_bf16_supported()`, `device_map="auto"`) and downloads the
  full Qwen2.5-VL-3B weights before loading OmniSVG's own `pytorch_model.bin`
  over them. On 16 GB that is two 7.5 GB copies. `omnisvg.py` builds the
  model from Qwen2.5-VL-3B's `config.json` on the meta device and resizes the
  vocabulary to 197,000. It then memory-maps the `.bin` and assigns it
  (missing 0, unexpected 0), rebuilds the rotary buffers and moves the model
  to `mps` in bf16. Loading takes 10–12 s.
- **Versions:** Python 3.11 (uv), torch 2.6.0, transformers 4.51.3 (the
  repo's pin), accelerate 1.6.0, CairoSVG 2.7.1 with Homebrew's cairo
  (`DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib`), and IPython, which
  `deepsvg` imports.
- **Decoding is right.** The SVG tokens are decoded by the repo's own
  `SVGTokenizer` (`process_generated_tokens` → `raster_svg` →
  `apply_colors_to_svg`). With its own example prompts it drew a clean red
  heart (91 tokens, 16 s) and a bookmark with a plus (105 tokens, 11 s).
  "A black bicycle icon, side view" ran to 1,536 tokens without an end token,
  so the wheels stayed filled.
- **One sample at a time.** `inference.py` samples 8 sequences at once and
  keeps the ones that render. On the M1 we drew one sample per brief. More
  samples would cost minutes each.
- **mlx-vlm was not tried.** It loads Qwen2.5-VL, but OmniSVG needs a 197k
  vocabulary and its own decoder after generation. MPS ran, so a port wasn't
  needed to answer the question.

## Verdict

- **Studio, page model: yes, for the SVG it is good at.** Diagrams, pattern
  tiles, simple logos and layouts are already code that the page model
  writes. Every file parsed, Estonian letters were right, and the faults
  (clipped text, overlaps, bars off the axis) are the kind a second turn
  fixes. If the studio offers "make an SVG", render it in the page and send
  one repair turn on overflow. The cloud page models were not measured here.
- **Pool job kind: not now.** The best local model gave 2 usable out of 8, so
  most results would need a second pass. Reasoning makes Qwen3.5 slightly
  better but takes minutes per SVG. If a pool `svg` kind comes later, use
  **Gemma 4 12B, reasoning off** (about 45 s, 7.7 GB). It needs a render check
  and a cap of about 3,000 tokens out, because two models looped on one path
  for 6,000 tokens.
- **Designed vector (logos, icons, illustrations): Recraft V4.1 vector**
  (`recraft/recraftv4-1-vector`, $0.08) through the gateway, as
  `models-2026-10.md` suggests. Nothing local comes close for the fox or the
  bicycle. Test it with the same briefs before relying on it, especially the
  Estonian letters.
- **OmniSVG: no.** It has no text and no animation, fails on student-length
  briefs, and is slow and memory-heavy on a 16 GB Mac. StarVector: no
  text-to-SVG weights.

## Left on the M1

- `qwen2.5-coder:7b` (4.7 GB) and `gemma4:12b` (7.7 GB) were pulled for this
  and are still installed. The pool's models were not touched.
- `~/visualia-svg/` holds the OmniSVG clone, a uv venv, and the weights in
  `hf/` (7.6 GB), plus all outputs. Nothing is left loaded.

## Sources

- OmniSVG 1.1 4B card: https://huggingface.co/OmniSVG/OmniSVG1.1_4B
- OmniSVG code: https://github.com/OmniSVG/OmniSVG (`inference.py`,
  `decoder.py`, `tokenizer.py`, `config.yaml`, read 2026-10-23)
- StarVector: https://github.com/joanrod/star-vector and
  https://huggingface.co/starvector (only `im2svg` models, read 2026-10-23)
- Ollama library sizes: https://ollama.com/library/gemma4,
  https://ollama.com/library/qwen2.5-coder (read 2026-10-23)
- Recraft V4.1 vector price: `research/models-2026-10.md`, section 2
