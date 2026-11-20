# Model runs behind the Arunädal / HARNO decks (talk.html, intro.html, drift-room/*)

Read 2026-11-20 from the repo (scripts, READMEs, plans, worklog 2026-11, `out/costs.json` of 2026-11-19,
`out/energy/energy.json`, `git diff`). Counts are files on disk now (pictures include reruns, alts, refs where noted).

Classes: **A** already on platform, **B** pool / worker app job, **C** gateway / studio, **D** shared infra need,
**E** one-off research to archive.

"Usage rows" = the gateway Worker wrote a D1 `usage` row (person `eka-teacher`, remote D1), which `costs.mjs` reads.

## 1. Pictures

| Kind | Script(s) | Models | Where it ran | Count (files) | Cost recorded? | Energy | Class |
|---|---|---|---|---|---|---|---|
| EKI prompts, estonia / germany / design sets | `run.mjs generate` (`--set`) | 10 then 19 catalog + Workers AI models (FLUX.2 klein 4B/9B, FLUX.2 dev, FLUX.1 schnell, Phoenix, Lucid Origin, SDXL, SDXL Lightning, Dreamshaper 8 LCM; later p-image, FLUX.3 klein, Nano Banana 2 lite/Pro, FLUX.2 pro, Qwen Image 3, Seedream 5, Grok Imagine, GPT Image 2, Recraft v4.1) | Cloud through gateway `/v1/images`; **2026-11-09 runs on the *local* gateway** (wrangler dev) | estonia ~100, germany 300, design 199 | 11-09 rows sit in a local D1: **not in costs.json** (README estimates ~$0.75 + ~$0.74 + ~$0.74); later runs yes | estimate 2.9 Wh/picture | A (catalog) / D (batch job) |
| Nature set (29 prompts × models), history set | `run.mjs --set nature|history generate` | as above | gateway (live) | nature 333 (incl. ~20 Commons), history 174 | yes; unpriced models estimated in `costs-manual.json` | estimate | A / D |
| Films (5 films, 19 models, alts, 2nd runs Nipernaadi + Alpinist) | `films.mjs draw|more|retry` | 19 gateway models (BUDGET guard, refusal log `runs.json`) | gateway (live) | 168 | yes (+ est.) | estimate | A / D |
| Lauluväljak Tallinn + Riga, Pikk Hermann | `lauluvaljak.mjs`, `hermann.mjs draw` | 19 gateway models, named/neutral | gateway (live); `pool/chilloutmix` 503 | 50 + 19 + 39 | yes ($1.12 Lauluväljak) | estimate | A / D |
| Drift-room landscapes, figures, film scenes (one template + edits via `references`) | `drift-room.mjs template|land|bg|figure|film` | Nano Banana 2 lite / Pro, FLUX.2 pro, Seedream, GPT Image 2, Grok (edits) | gateway `/v1/images` + `references` (uncommitted, deployed) | land 183, figure 14, film 32 | yes | estimate | A (C for an edit UI) |
| Cover / story edits (outpaint, fill hole, back view, full figure) | `widen-cover.mjs`, `widen-figure.mjs`, `story.mjs` | Nano Banana Pro, Seedream 5 pro, FLUX.2 pro, GPT Image 2 | gateway | cover 58, story 26 | yes | estimate | A; E (scripts) |
| Era ladder 2022 → 2026 (woman, man, village; paint) | `era.mjs draw|dalle|import|paint|cut|compose|judge` | DALL·E mini (tab), SD 1.4 + ChilloutMix (sd.cpp, M1), SDXL, FLUX.1 schnell, FLUX.2 dev, klein 4B, Nano Banana Pro, GPT Image 2 | mixed: gateway, Chrome tab WebGPU (work Mac), sd.cpp on M1 | 91 | cloud yes; local no | 2 DALL·E + 2 ChilloutMix entries in energy.json; rest none | B (local eras) / E |
| Costume era (Muhu by year) | `costume-era.mjs` | era cloud models, 3 each | gateway | 24 | yes (`spend.jsonl` too) | estimate | E |
| Folk costumes pilot / round 2 / drift | `costume-pilot.mjs`, `costume-round2.mjs`, `costume-drift.mjs` | FLUX.3 klein, Nano Banana 2 lite (+ **refs via REST**), Nano Banana Pro | gateway; pilot refs **REST `/ai/run` outside the gateway Worker** | rahvaroivad/ 5,185 files (mostly 644 scraped photos + crops) | gateway part yes; REST refs (~12 pictures, ~$0.5) **not in costs-manual** | estimate | E (licence unclear) |
| ChilloutMix "Estonian woman/man" grids + controls, cover figure | `apps/pool-app/sd-web` (Chrome tab) | ChilloutMix fp16 ONNX (SD 1.5 fine-tune) | Chrome tab WebGPU, work Mac | `out/cover/people`, cover | n/a ($0) | 2 macmon entries only | B (pool/chilloutmix exists, A) |
| Older SD on the M1 | `local-sd.sh` + `run.mjs import` | SD 1.4, SD 1.5, Dreamshaper 8, SD-Turbo (+ queued SDXL, SDXL Lightning, ChilloutMix) | sd.cpp Metal, M1 | sd-1.4/1.5/turbo/dreamshaper-8 10 each, local-m1 79 | n/a | seconds only | B |
| Local nature run | `local-nature.mjs draw` | FLUX.2 klein 4B (sd.cpp), SD-Turbo | sd.cpp, Mac | 29 each | n/a | **measured** (macmon chip/net/sys) | B |
| DALL·E mini | `run.mjs` / `era.mjs dalle` (Playwright drives `apps/pool-app/dalle-mini`) | DALL·E mini (Apache) ONNX Runtime Web | Chrome tab WebGPU, work Mac | dalle-mini 10 + era seeds | n/a | 2 entries | B (tab job, early-imagegen) |
| ChilloutMix through the pool | gateway `pool/chilloutmix` → pool → `visualia-pool-cli` sd-cli | ChilloutMix | M1 via live gateway | few (503 in the Lauluväljak run) | usage row with energy_j | **measured** by the worker | A |

## 2. Judges and text

| Kind | Script(s) | Models | Where it ran | Count | Cost recorded? | Energy | Class |
|---|---|---|---|---|---|---|---|
| Criteria judge (yes/no per criterion, `judge-cache.jsonl`) | `run.mjs judge` | Clef-flash (`/v1/decide`) | 11-09: **local gateway** → local D1 | ~1,997 cache rows (estonia/germany/design) | **not in costs.json** (README: ~$0.015 per 470) | none | A (decide) / D (judge job) |
| "Which country?" / flag / film / parish judges | `lauluvaljak`, `hermann`, `films`, `history`, `landmarks`, `era`, `costume-*`, `parish-open.mjs` | Gemini 3.8 Flash, Claude Sonnet 5.5 | gateway `/v1/chat/completions` JUDGES (uncommitted, deployed) | Gemini 2,614 calls, Sonnet 84 (gateway) | yes, $7.94 + $0.78 | estimate 0.24 Wh/answer (floor) | A |
| Nature "which country?" judge | `nature.mjs judge` | Gemini 3.8 Flash (plain + primed), Sonnet 5.5 sample | **Cloudflare REST** `/ai/v1/chat/completions` (passes AI Gateway, not the Worker) | 330 + 10 | **no**: README says $1.26; not in costs-manual | none | D (route through gateway) |
| Costume text extraction (expert text → criteria) | `costume-extract.mjs` | Claude Sonnet 5.5 (manual row says "Gemini": mislabel) | REST | 12 entries, 148k tok in | manual row $0.87 | none | E |
| Local judge comparison | `local-nature.mjs judge` | Gemma 4 26B (Ollama) | local Mac | 114 | n/a | **measured** | A-ish (gemma4-26b is a pool chat model; vision through pool not checked) / E |
| Music judge ("where is this music from?"), control, no-vocals | `measure.mjs judge|judge 2|novocals`, control | Gemini 3.8 Flash with `input_audio` | live gateway | 162 + 45 + 35 | yes (in Gemini rows) | estimate | A |
| Claude Code session work: Estonian translations, prompt writing, "Estimate costs" prompt on the cost slide | (agent sessions) | Claude Opus 5.5 | Claude Code, outside visualia | many | **no** | no | D (agent-coders plan) / note only |

## 3. Embeddings, depth, cut-outs, 3D

| Kind | Script(s) | Models | Where it ran | Count | Cost | Energy | Class |
|---|---|---|---|---|---|---|---|
| Nearest real photos ("where did it drift") | `neighbours.mjs embed|report`, `landmarks.mjs embed`, `places.mjs` | DINOv2 small, SigLIP base (transformers.js, onnxruntime-web WASM in Node) | work Mac CPU | ~1,000 refs + all generated; landmarks 326 | $0 | none | B/D later (tab or pool `embed`), else E |
| Depth maps for the 2.5D room | `drift-room.mjs depth`, `lauluvaljak.mjs depth`, `hermann.mjs depth` | Depth Anything V2 small q8 (Apache) | Node WASM, work Mac | every room picture | $0 | none | B (tab or pool `depth`) |
| Remove background | `research/triposr/rmbg.mjs`, `era.mjs cut`, `triposplat/prepare.mjs`; `pool-core/src/cutout.rs` (new) | BiRefNet-lite (MIT) | Node onnxruntime on Mac/M1; Rust `ort` written, not built | era figures, costume figures, 15 figurines | $0 | 3 macmon entries | **B (in progress)** |
| Cover figure matte | `neighbours/cutout` (transformers.js) | MODNet | Node, work Mac | cover + story masks | $0 | none | E (BiRefNet covers it) |
| Landscapes to 3D | `~/visualia-local/sharp/batch.py` + `convert-land3d.mjs` (PLY → SPZ in Chrome) | Apple SHARP (`ml-sharp` aed6527, weights **research-only**) | PyTorch MPS, work Mac | 330 `.spz` (stats.jsonl 330 rows) | $0 | 4 measured batches (~12 Wh); the first ~300 seconds only | **E** (licence) |
| Costume / era figurines to splats | `research/triposplat/{prepare,triposplat,splat}.mjs` (+ `export.py`, `fp32math.py`, `bench.py`) | TripoSplat (VAST, MIT) own fp16 ONNX | Node onnxruntime WebGPU, M1 | 15 `.splat` | $0 | none (needs M1) | B (`splat` job, pool-3d §11) |
| Picture to mesh | `research/triposr/triposr.mjs` | TripoSR ONNX | Node, M1 | bench only, not in decks | $0 | none | B (`mesh` job, plan) |
| Upscaling | `apps/pool-app/upscale` (Burn), gateway `/v1/upscale` (Real-ESRGAN, klein 9B redraw) | Real-ESRGAN | pool | not used in the decks | rows | measured | A |

## 4. Sound

| Kind | Script(s) | Models | Where it ran | Count | Cost recorded? | Energy | Class |
|---|---|---|---|---|---|---|---|
| Anthem, Ernesaks, regilaul, Pärt, finale, film songs, national songs, runo songs, Alpinist long | `research/music-drift/run.mjs`, `finale.mjs`, `films.mjs`, `national.mjs` | ElevenLabs Music v2 ($0.0025/s), MiniMax Music 2.6 ($0.15/track) from Cloudflare's catalog | **REST `/ai/run` with a wrangler OAuth token**, outside the gateway Worker | ~77 ElevenLabs + ~22 MiniMax JSONs (161 clips counted by costs.mjs, 10,012 s) | **by hand** in `costs-manual.json` (18 rows, $10.51 incl. text) | estimate 0.0465 Wh/s (floor from MusicGen) | **C** |
| Nature sounds (Matsalu, bog, cranes…) | `nature.mjs` (music-drift) | ElevenLabs Music v2 (no SFX model in catalog) | REST | 27 | by hand | estimate | C |
| Transcription (words kept, õäöü) | `transcribe.mjs`, `national.mjs transcribe`, `measure.mjs words` | Whisper large-v3-turbo (Workers AI) | REST | all sung clips | by hand ($0.02 etc.) | none | C (`/v1/audio/transcriptions`) |
| Era ladder music 2023 | `music-drift/era.mjs` (`film-*`, `nat-*`) | MusicGen small (Meta, weights **CC BY-NC 4.0**) ONNX via transformers.js WASM | work Mac CPU | 21 | $0 | **measured** (`meter.jsonl`) | B with licence check, or swap model / E |
| Vocal removal | `measure.mjs separate` | Demucs 4 htdemucs (MIT), Python venv CPU | work Mac | 53 | $0 | none | E (maybe B later) |
| Bird check | `birdnet.mjs` | BirdNET v2.4 ONNX (**CC BY-NC-SA**) | Node WASM | nature clips | $0 | none | E |
| Key fitting for map layers | `keyfit.mjs` | none (chroma + Krumhansl–Kessler, ffmpeg) | local | 11 | $0 | none | E (analysis belongs to positron per CLAUDE.md) |
| Collage, tintinnabuli | `collage.py` (librosa), `tintinnabuli.mjs` | none | local | 4 + 2 | $0 | none | E (tintinnabuli: rule-built, positron side) |

## 5. Not model runs (deck plumbing)

`costs.mjs`, `energy.mjs` (→ D), `convert-land3d.mjs`, `places.mjs`, `explore.py`, `serve.py`, `perf-talk.mjs`,
`test-intro.mjs`, `shot*.mjs`, `costume-drift-chart.mjs`, fetchers (`fetch-rahvaroivad.mjs`, Commons fetches). No video
was generated (`local-video` dropped; `nukitsamees.mp4` is a downloaded trailer).

## Money and energy as of costs.json (2026-11-19)

984 pictures, 2,692 answers. $47.67 = gateway $26.31 + estimated (unpriced models) $10.85 + outside $10.51.
3.97 kWh, all estimates except none: costs.json contains no measured local energy (`energy.json`, `meter.jsonl`,
local-nature's macmon rows and pool energy_j are not read by `costs.mjs`).

Missing from it: the 2026-11-09 local-gateway runs (~$2.3 incl. Clef-flash), the nature REST judge ($1.26), the
pilot's REST reference pictures (~$0.5), any key other than `eka-teacher`, Claude Code sessions, and AI Gateway's
real balance (`credits` still null).
