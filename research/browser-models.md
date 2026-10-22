# Models in the browser: what runs on the GPU in a tab

Written 2026-10-22 for the pool's tab worker (`plans/pool.md`, "Built: the tab
worker"), the probe's speed test and the studio. The question: which AI models
can run in a student's browser on the GPU today, including the ones built into
Chrome and Edge, and which of our jobs they can do in English and Estonian.

**How this was checked:**
- Versions and dates come from npm, GitHub releases, Hugging Face and the
  vendors' docs, read on 2026-10-22. Each fact has a link. Page dates are given
  where the page shows one.
- The measurements were run on this Mac: an M2 Pro with 32 GB, in headless
  Playwright Chromium 148 with real WebGPU on Metal (`--enable-unsafe-webgpu
  --use-angle=metal`; adapter `apple / metal-3`, shader-f16 on), using WebLLM
  0.2.86 from jsdelivr, exactly as `apps/pool/public/join.html` loads it.
- Chrome's built-in AI was checked in the installed Google Chrome 155 and
  Microsoft Edge 155.
- The scripts and raw results are not in the repo; the numbers below are
  copied from them.

## The short answer

- **The current pool model, Qwen2.5-1.5B, is fast (55–72 tokens/s here) and
  fine for short English jobs. It is useless in Estonian.** Across six real
  jobs it gave 3 usable answers in English and none in Estonian.
- **Qwen3-4B is the clear step up.** All six English jobs were usable, and it
  was the only model whose English p5.js sketch both ran and bounced.
  Estonian improves but still needs checking. The cost: 2.3 GB download, about
  3.4 GB of GPU memory, 31–40 tokens/s here.
- **Qwen3.5-2B is not worth the swap.** It runs at half the speed of
  Qwen2.5-1.5B, and its Estonian is uneven (one answer looped). Its big first
  weight file also failed to save in the browser's Cache Storage here.
- **Constrained JSON works; tool calls don't.** WebLLM's OpenAI-style `tools`
  is refused for every model we would use (only Hermes 8B models allow it). A
  JSON schema in `response_format` gave 100% well-formed output for all three
  models, but it does not make the model choose better.
- **Chrome's built-in AI does not speak Estonian.** The Prompt API (Gemini
  Nano) has been stable on the web since Chrome 148, but only for English,
  Japanese, Spanish, German and French. Translator has no Estonian. It needs
  about 20–22 GB of free disk. It doesn't run in Workers. Safari and Firefox
  have nothing like it.
- **Speech to text in Estonian is possible in a tab** with NVIDIA's Parakeet
  v3 (about 670 MB, FLEURS-et error rate 17.7%). Whisper small and below are
  unusable for Estonian.
- **Estonian text to speech now exists as a small open voice:** Piper
  `et_EE-news-medium`, 77 MB, added 2026-08-24.

## 1. Runtimes

| Runtime | Latest | Formats | GPU | Status |
|---|---|---|---|---|
| **WebLLM** (`@mlc-ai/web-llm`) | 0.2.86, 2026-10-11 ([release](https://github.com/mlc-ai/web-llm/releases/tag/v0.2.86)) | MLC: compiled WebGPU wasm + q4f16_1 / q4f32_1 weights | WebGPU only | Active again in 2026 (releases Feb, Mar, Apr, May, Sep, Oct). We already pin it. |
| **Transformers.js** (`@huggingface/transformers`) | 4.3.1, 2026-10-06 ([releases](https://github.com/huggingface/transformers.js/releases)); v4.0.0 GA 2026-03-30 | ONNX (fp32, fp16, q8, q4, q4f16, q1/q2 since 4.1) | ORT WebGPU, WASM, WebNN | v3 ended at 3.8.1 (2025-12). v4 has a new WebGPU runtime, tool calling (4.2), structured output (4.3) and WebGPU on Safari 26+ (4.3). The widest model list: Whisper, Moonshine, Kokoro, SmolVLM, Qwen3/3.5, Gemma 3n/4. |
| **ONNX Runtime Web** | 1.30.0, 2026-09-14 ([releases](https://github.com/microsoft/onnxruntime/releases)) | ONNX | WebGPU, WASM, WebNN | The engine under Transformers.js. Its README still calls WebGPU and WebNN "experimental". Wasm memory is capped at 4 GB ([doc](https://onnxruntime.ai/docs/tutorials/web/large-models.html), 2024). |
| **MediaPipe LLM Inference** (`@mediapipe/tasks-genai`) | 0.10.29, 2026-07-08 | .task / .litertlm | WebGPU | **Maintenance only**; Google says to move to LiteRT-LM ([guide](https://developers.google.com/edge/mediapipe/solutions/genai/llm_inference/web_js), updated 2026-06-12). |
| **LiteRT-LM web** (`@litert-lm/core`) | 0.18.0 (0.18.1 on 2026-10-20) ([docs](https://developers.google.com/edge/litert-lm/js), 2026-10-06) | .litertlm | WebGPU | Google's new path for Gemma 4 E2B/E4B on the web. Text only for now ([issue](https://github.com/google-ai-edge/LiteRT-LM/issues/2150)). The model card reports Gemma 4 E2B at 73 tokens/s on an M4 Max with about 1.8 GB of GPU memory ([card](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm)). |
| **wllama** (llama.cpp in wasm) | 3.8.1, 2026-10-02 ([repo](https://github.com/ngxson/wllama)) | GGUF | WebGPU since 3.1 (2026-05), else CPU | Uses llama.cpp's own WebGPU backend ([paper](https://arxiv.org/abs/2605.20706), 2026-05-20). Needs COOP/COEP headers for threads; files capped at 2 GB each (split them). Firefox and Safari need a slower "compat" mode. |
| **WebNN** | W3C Candidate Recommendation Draft, 2026-10-21 ([spec](https://www.w3.org/TR/webnn/)) | — | NPU / GPU / CPU via Core ML, Windows ML, LiteRT | **Ships nowhere by default.** The Chrome/Edge origin trial ended 2026-08-11; the next is pencilled in for Chrome 160–164 ([issue #964](https://github.com/webmachinelearning/webnn/issues/964), 2026-10-20). Flag only. |

**WebGPU itself** ([implementation status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status), read 2026-10-22):
- **Chrome and Edge:** Windows, macOS and ChromeOS since 113; Android 12+
  since 121; Linux partly (Intel Gen12+ since 144).
- **Safari:** macOS, iOS and iPadOS 26, on by default.
- **Firefox:** Windows since 141; all macOS since 147; Linux not yet.
- **shader-f16** (needed for WebLLM's q4f16 builds): Chrome since 121, and all
  Apple devices. Some Qualcomm/Adreno phones lack it, so keep the q4f32
  fallback the join page already has.

**Memory per tab:**
- **wasm32:** 4 GB.
- **Memory64:** Chrome and Edge 133+ and Firefox 134+ (capped at 16 GB);
  Safari, including iOS, doesn't support it.
- **GPU buffers:** this Mac reports `maxBufferSize` of 4 GB. Phones report far
  less, so ask the adapter at run time.

**Other news:**
- **Cross-Origin Storage:** a shared model cache across sites, now used by
  WebLLM 0.2.83+, Transformers.js 4.3 and wllama 3.5.
- **Firefox's own AI runtime:** for extensions only (wllama and Transformers.js
  inside the browser). Nothing is exposed to web pages
  ([docs](https://firefox-source-docs.mozilla.org/toolkit/components/ml/extensions.html)).

**For us:**
- Stay on **WebLLM** for chat. It is what the pool uses, its catalogue is
  current, and it was the fastest here.
- Use **Transformers.js** for everything that isn't a chat model: speech,
  embeddings, small vision.
- Watch LiteRT-LM for Gemma 4.

### WebLLM 0.2.86 catalogue, the models that matter

GPU memory is WebLLM's own `vram_required_MB` figure; download sizes come from
the Hugging Face API. All have a q4f32 build for GPUs without shader-f16.

| Model (q4f16_1) | Download | GPU memory | Estonian (EuroEval rank, lower is better) |
|---|---|---|---|
| Qwen2.5-1.5B-Instruct (the pool's model now) | 880 MB | 1.6 GB | not listed |
| Qwen3.5-0.8B | 450 MB | 1.6 GB | 3.49 |
| Gemma 3 1B | 600 MB | 0.7 GB | 3.75 |
| Qwen3-1.7B | 980 MB | 2.0 GB | 3.20 |
| Qwen3.5-2B | 1.08 GB | 2.2 GB | 3.15 |
| Llama 3.2 3B | 1.8 GB | 2.3 GB | 3.27 |
| Ministral 3 3B Instruct (2512) | 1.9 GB | 2.9 GB | 2.95 |
| Phi-4-mini | 2.2 GB | 3.4 GB | not listed |
| **Qwen3-4B** | 2.3 GB | 3.4 GB | **2.88** |
| Gemma 4 E2B (new in 0.2.86, text + audio in) | 2.8 GB | 3.4 GB | 3.16 |
| Qwen3.5-4B | 2.4 GB | 3.9 GB | 3.23 |

**Notes on the catalogue:**
- **Missing from WebLLM:** Gemma 3n, SmolLM3 and small vision models (the only
  one is Phi-3.5-vision at 4.5 GB).
- **Estonian ranks:** from the EuroEval Estonian leaderboard
  ([csv](https://github.com/EuroEval/leaderboards/tree/main/leaderboards),
  updated 2026-04-17). For scale: the best closed models score about 1.3,
  Gemma-4-31B scores 1.85, and the best small model, Gemma 3n E4B (not in
  WebLLM), scores 2.62.

## 2. Built-in browser AI

### Chrome (Gemini Nano, moving to Gemma 4)

| API | Web status (Chrome stable is 156) | Estonian? |
|---|---|---|
| Prompt API (`LanguageModel`) | **Stable since 148** (2026-05-05), desktop only ([doc](https://developer.chrome.com/docs/ai/prompt-api), updated 2026-08-26; [intent to ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/iR6R7-nQeHI/m/gb9zDAMqAwAJ)). Image and audio input included. `temperature`/`topK` only in an origin trial. | **No.** Input and output languages are en, ja, es, de, fr ([get started](https://developer.chrome.com/docs/ai/get-started)). |
| Summarizer | Stable since 138 | No (same 5 languages) |
| Translator | Stable since 138, desktop only | **No.** 39 languages, Estonian and Latvian not among them ([doc](https://developer.chrome.com/docs/ai/translator-api)). Confirmed here: en→fi "downloadable", en→et "unavailable". |
| Language Detector | Stable since 138 | Not documented. |
| Writer, Rewriter, Proofreader | **Flag only**; their origin trials have ended | — |

**Hardware** ([get started](https://developer.chrome.com/docs/ai/get-started)):
- **OS:** Windows 10/11, macOS 13+, Linux, or a Chromebook Plus. Not Android
  or iOS.
- **Device:** a GPU with more than 4 GB VRAM, or 16 GB RAM and 4 cores. Audio
  input needs the GPU.
- **Disk and network:** about 22 GB free disk and an unmetered connection for
  the first download. The model folder is about 4 GB (secondary sources).

**Where it works:**
- Top-level pages and same-origin iframes.
- Cross-origin iframes, only with `allow="language-model"` (and the matching
  name for each API).
- Extensions.
- **Not in Web Workers.** Confirmed here: `LanguageModel` is undefined inside
  a worker.

**Limits:**
- No published numbers. A session reports its `contextWindow`; when the
  context overflows, the oldest turns are dropped first.
- Creating a session before the model is downloaded needs a user click.

**Terms:**
- The current pages only point to the People + AI Guidebook. We found no
  acknowledgment of Google's Generative AI Prohibited Uses Policy on them.
  Earlier versions linked to that policy, and Mozilla's review cites it
  ([mozilla#1213](https://github.com/mozilla/standards-positions/issues/1213)).
  Whether it still applies is unverified.
- Our uses (summaries, titles, a chat helper) are ordinary uses either way.

**School-managed Chrome can switch it off.** IT has two policies and students
have one setting:

| Control | Who | Effect |
|---|---|---|
| `GenAILocalFoundationalModelSettings` = 1 | IT (policy) | No download, and an existing model is deleted ([definition](https://chromium.googlesource.com/chromium/src/+/main/components/policy/resources/templates/policy_definitions/GenerativeAI/GenAILocalFoundationalModelSettings.yaml)) |
| `BuiltInAIAPIsEnabled` = false | IT (policy) | Pages get an error ([definition](https://chromium.googlesource.com/chromium/src/+/main/components/policy/resources/templates/policy_definitions/Miscellaneous/BuiltInAIAPIsEnabled.yaml)) |
| Settings > AI Innovations > On-device AI | The student | Deletes the model |

Edge has policies with the same names.

**What we saw on this Mac** (Chrome 155, a fresh profile, `chrome://on-device-internals`):
- **Eligible:** performance class "High", possible capabilities "Image,
  Audio", and enough VRAM (25,559 MiB, 3,000 MiB required).
- **Blocked by disk:** "Enough disk space to install: false (5,912 MiB
  available, 20,480 MiB required)". So the Prompt API says `downloadable` and
  can't actually install here. We did not download it.
- **The model list is changing.** Chrome's model manifest (1.20261018.2) now
  lists `gemma4_component`, `gemma4_4b_component` and `gemma4_12b_component`
  next to `nano_v3_gpu_component`. It also has use cases
  `prompt_api_gemma4`, `prompt_api_gemma4_4b` and `prompt_api_gemma4_12b`. So
  Chrome is preparing Gemma 4 tiers behind the same API.
- **Not announced:** we found no announcement. Whether this widens the
  language list is unknown.
- **Playwright hides it.** Under Playwright's default flags (component updates
  and OptimizationHints off), Chrome reports everything as `unavailable`.
  Launch Chrome yourself and connect over CDP to test it.

### Edge

| API | Status | Notes |
|---|---|---|
| Prompt API | Flag only (Canary/Dev); origin trial listed until Edge 150; **not stable** in 156 ([doc](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api), updated 2026-10-19) | Model is **Phi-4-mini** (about 2.4 GB). Needs 5.5 GB VRAM, 20 GB disk, Windows 10/11 or macOS 13.3+. Language list not published. Confirmed here: `LanguageModel` is absent in Edge 155. |
| Translator, Language Detector | Stable since Edge 148 ([notes](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/release-notes/148)), "145+ languages" ([blog](https://blogs.windows.com/msedgedev/2026/06/02/expanding-on-device-ai-in-microsoft-edge-new-models-and-apis-for-the-web/), 2026-06-02) | Estonian is in Microsoft's demo list but unverified. Here, Edge 155 reported en→et and en→de both `unavailable` (likely the low disk). |
| Summarizer | Exposed; `unavailable` here | — |
| Aion-1.0-Instruct | Canary/Dev flag, new small Microsoft model that can run on CPU | Prerelease. |

### Other browsers and standards

- **Safari and Firefox:** no built-in AI for web pages.
- **Standards:**
  - Status: the Prompt, Writing and Translator APIs are Community Group
    drafts.
  - Mozilla: negative on all three (2025).
  - WebKit: **opposes** the Prompt API ([#495](https://github.com/WebKit/standards-positions/issues/495), 2026-05-27).
  - Expect these APIs to stay Chrome-and-Edge only.

## 3. Models by job

### Text

See the WebLLM table above, and section 4 for our measurements.

- **Small Estonian-specific models:** none under 4B. TartuNLP's
  Llama-3.1-EstLLM-8B has no web build
  ([card](https://huggingface.co/tartuNLP/Llama-3.1-EstLLM-8B-Instruct-1125)).
- **EuroLLM-1.7B:** officially covers Estonian, but only as community WebLLM
  builds, and its card says it isn't aligned to human preferences.
- **Licences:** Qwen2.5-1.5B, Qwen3, Qwen3.5 and Gemma 4 are Apache-2.0;
  Gemma 3 and 3n use the Gemma terms; Llama 3.2 uses its own licence.

### Vision (judging a screenshot)

| Model | Web build | Size (q4f16) | Estonian | Licence |
|---|---|---|---|---|
| Qwen3.5-0.8B / 2B / 4B (vision built in) | Transformers.js ([onnx-community/Qwen3.5-2B-ONNX](https://huggingface.co/onnx-community/Qwen3.5-2B-ONNX)); [demo](https://huggingface.co/spaces/webml-community/Qwen3.5-WebGPU) | 0.65 / 1.6 / 3.0 GB | some | Apache-2.0 |
| Qwen3-VL-2B | Transformers.js | 1.4 GB | some | Apache-2.0 |
| Gemma 4 E2B (image + audio in) | Transformers.js ([onnx](https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX)) | 3.4 GB | some | Apache-2.0 |
| SmolVLM 256M / 500M | Transformers.js | 0.19 / 0.36 GB | English only | Apache-2.0 |
| Florence-2 base (captions, OCR, boxes) | Transformers.js | 0.33 GB | English only | MIT |
| Chrome Prompt API with image input | built in | 0 (shared ~4 GB) | no | Google terms |

**What's missing:**
- No browser speed figures were found for any of these.
- Judging a page means reading layout and text, which small VLMs do poorly.
  We didn't test it.

### Speech to text (Estonian)

| Model | Web build | Size | Estonian error rate (WER) | Licence |
|---|---|---|---|---|
| **Parakeet TDT 0.6B v3** | [parakeet.js](https://github.com/ysdede/parakeet.js) (ORT Web: WebGPU encoder + wasm decoder), [onnx](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx) | ~670 MB int8 | **17.7% FLEURS** ([card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)) | CC-BY-4.0 |
| Canary 1B v2 | [onnx](https://huggingface.co/istupakov/canary-1b-v2-onnx), no browser demo | ~1 GB int8 | **8.5% FLEURS**, also translates et↔en ([card](https://huggingface.co/nvidia/canary-1b-v2)) | CC-BY-4.0 |
| TalTech Whisper fine-tunes (e.g. [large-v3-turbo-et-verbatim-2604](https://huggingface.co/TalTechNLP/whisper-large-v3-turbo-et-verbatim-2604), 2026-06) | no ONNX; would need an export | 0.8B+ | best for Estonian; CV11 12% for whisper-large-et | MIT / CC-BY |
| Whisper small / base / tiny | Transformers.js | 0.2–0.55 GB | 51% / 78% / 95% FLEURS ([paper](https://cdn.openai.com/papers/whisper.pdf)): unusable | MIT |
| Moonshine | Transformers.js | 0.19 GB | no Estonian model | MIT |
| Chrome Web Speech, on device | built in | — | Estonian not among its 17 on-device languages ([explainer](https://github.com/WebAudio/web-speech-api/blob/main/explainers/on-device-speech-recognition.md)) | — |

### Text to speech

| Model | Size | Estonian | Licence |
|---|---|---|---|
| **Piper `et_EE-news-medium`** (4 voices) | 77 MB | **yes**, added 2026-08-24 ([voices](https://huggingface.co/rhasspy/piper-voices/tree/main/et/et_EE/news/medium)); runs in a tab via Piper web or sherpa-onnx wasm | voice data CC-BY |
| Supertonic 3 | 398 MB, official WebGPU example | yes, one of 31 languages; **repo archived 2026-09-09** ([model](https://huggingface.co/Supertone/supertonic-3)) | OpenRAIL-M |
| Kokoro-82M (kokoro-js) | 155 MB | no | Apache-2.0 |
| Kitten TTS | 57–78 MB | no | Apache-2.0 |
| TartuNLP Neurokõne | no web build | yes (server or phone app) | MIT |
| Browser `speechSynthesis` | — | no built-in Estonian voice found; Edge's online voices (Anu, Kert) stream from Microsoft | — |

### Image generation

| Model | Download | Speed | Licence |
|---|---|---|---|
| SD-Turbo, 512², 1 step ([ORT Web example](https://github.com/microsoft/onnxruntime-inference-examples/tree/main/js/sd-turbo)) | 2.6 GB | under 1 s on an RTX 4090 ([blog](https://opensource.microsoft.com/blog/2024/02/29/onnx-runtime-web-unleashes-generative-ai-in-the-browser-using-webgpu/), 2024); no laptop figures | Stability Community |
| FLUX.2 klein 4B, int4 ([webgpu build](https://huggingface.co/BasinShapers/flux2-klein-4b-webgpu), 2026-10-12) | ~3.2 GB | 512², 4 steps: ~14 s on an M2 Pro, 6–7 s on an M4 Max; needs ~16 GB | Apache-2.0 |
| Janus-Pro-1B (Transformers.js) | 1.9 GB | ~8 s per image (secondary source) | DeepSeek terms |

SDXL-Turbo, SANA and SANA-Sprint: no working browser build found.

### Embeddings (grouping works)

| Model | Size | Estonian | Licence |
|---|---|---|---|
| granite-embedding-97m-multilingual-r2 ([card](https://huggingface.co/ibm-granite/granite-embedding-97m-multilingual-r2), 2026-04-29) | 98 MB int8 | yes | Apache-2.0 |
| multilingual-e5-small | 118 MB int8 | yes | MIT |
| EmbeddingGemma 2 ([onnx](https://huggingface.co/onnx-community/embeddinggemma-2-ONNX), 2026-09; text + images in one space) | 157 MB text + 98 MB vision | 100+ languages | Apache-2.0 |
| Qwen3-Embedding-0.6B | 567 MB | yes | Apache-2.0 |
| SigLIP2 base, vision tower only (for pictures) | 55 MB | — | Apache-2.0 |

All of these run in Transformers.js. WebLLM's two embedding models
(snowflake-arctic-embed) are English-only.

## 4. Measured: our real jobs on this Mac

**The setup:**
- **Models and settings:** three models, WebLLM 0.2.86, temperature 0, our
  system prompt ("helpful assistant for art students… be brief"; the Estonian
  version also says to answer in Estonian).
- **Thinking off:** for Qwen3.5 and Qwen3 we set `extra_body: {
  enable_thinking: false }`.
- **Scope:** each job was run once in English and once in Estonian.
- **Sketch check:** each p5.js sketch was run in a page with p5 1.11.3 (the
  studio's version). We looked for errors, then checked that the canvas
  draws and moves.
- **Not measured:** Gemma 4 E2B (2.8 GB) and Ministral 3B, to stay inside the
  disk budget.

### Speed

| | Qwen2.5-1.5B (now) | Qwen3.5-2B | Qwen3-4B |
|---|---|---|---|
| Download | 880 MB | 1.08 GB | 2.28 GB |
| GPU memory (WebLLM figure) | 1.6 GB | 2.2 GB | 3.4 GB |
| First load (download over this office network + compile) | 24 s | 63 s | 137 s |
| Later loads (from browser cache) | 1.4 s | 2.6 s | 4.4 s |
| Writing speed | **55–72 tokens/s** | 29–34 tokens/s | 31–40 tokens/s |
| Reading speed (prompt) | 550–670 tokens/s | 300–330 tokens/s | 200–240 tokens/s |
| First word, short prompt | 0.1–0.2 s | 0.2–0.4 s | 0.3–0.6 s |
| First word, very first job after load | 2.5 s | 2.9 s | 1.7 s |
| p5 sketch, English (total) | 2.2 s | 12.4 s | 8.7 s |

**Notes:**
- **The Mac is high-end for this.** An M2 Pro has high memory bandwidth. A
  base M1/M2 or a Windows laptop with Intel graphics will be several times
  slower: we found no trustworthy browser numbers for these, and a guess is
  3–5×. The probe's speed test is the right way to find out per machine.
- **Qwen3.5 is slow in WebLLM.** WebLLM runs it at about half the speed of
  plain models of the same size, probably because of its hybrid
  (linear-attention) design.
  Measured again 2026-10-22 on the 9B (`Qwen3.5-9B-q4f16_1-MLC`, M2 Pro):
  11–12 tokens/s against 25–26 for Qwen3-8B, but only the 9B writes usable
  Estonian; it is the pool tab's largest model (`plans/pool.md`).
- **Cache Storage failed for Qwen3.5-2B.** Its first weight file (254 MB)
  failed to save five times in a row ("Cache.add() encountered a network
  error"). The same file downloaded fine with `fetch` and with curl. WebLLM's
  `cacheBackend: 'indexeddb'` worked, and Qwen3-4B used it too.
- **Why it failed is unclear.** This Mac has only ~5.5 GB of free disk, which
  is the main suspect. Qwen2.5-1.5B loads fine with the default Cache Storage.
  Test any new model in the join page before switching.

### What the jobs produced

**Grades:**
- **usable:** could go to a student as is.
- **needs fixing:** right idea, wrong detail or form.
- **wrong:** misleading, broken, or not Estonian.

The outputs are quoted as given, shortened with "…".

**1. "What changed" between two versions.** Version 2 added a 3-image grid,
and the background went from blue to black.

| Model | English | Estonian |
|---|---|---|
| Qwen2.5-1.5B | "Version 2 uses a `div` with the class "grid" to display images side by side, while Version 1 simply lists them as text." **wrong** (v1 had no images, and it missed the colour) | "Versioon 2 on vähemalt asendatud versioonini. See muutub järgnud: ```html…" **wrong** (not Estonian sense, then dumps HTML) |
| Qwen3.5-2B | "The second version added a CSS grid layout to display three images and changed the background color from blue to black." **usable** | "Väikesele kujutisele (sellel on 3 paigutust) lisati **grid** (sät) klass…" **wrong** |
| Qwen3-4B | "Version 2 added a grid layout with three images and changed the body background to black." **usable** | "Versioon 2 lisas veebilehel pildid ja pildide kujundamiseks kasutatud tarkvara." **needs fixing** (images right, "software" invented, colour missed) |

**2. A title from the brief** (the drag-shapes poster page)

| Model | English | Estonian |
|---|---|---|
| Qwen2.5-1.5B | "Poster Builder - EKA Autumn Exhibition" **usable** | "Koostamine EKA sügisnäituse plakati PNG-failina värvilise kujundeid." **needs fixing** (ungrammatical, too long) |
| Qwen3.5-2B | "Drag & Drop Shapes for EKA Poster" **usable** | "EKA sügisnäituse plakat" (in bold markdown) **usable** |
| Qwen3-4B | "Drag and Build Your EKA Poster" **usable** | "Värvikujundused" **needs fixing** (good Estonian, too vague) |

**3. Choose one of four groups** (a generative p5.js noise poster → Generative art)

| Model | English | Estonian |
|---|---|---|
| Qwen2.5-1.5B | "Generative art" **usable** | "Tüpograafia" **wrong** |
| Qwen3.5-2B | "Typography" **wrong** | "Generatiivne kunst" **usable** |
| Qwen3-4B | "Generative art" **usable** | "Generatiivne kunst." **usable** |

**4. Rewrite a vague brief** ("make something cool with colours for the website, maybe interactive") into purpose / visitor / look

| Model | English | Estonian |
|---|---|---|
| Qwen2.5-1.5B | "- Create visually appealing designs using vibrant colors - Engage visitors with interactive elements… - Showcase creativity…" **needs fixing** (generic, no purpose) | "Lähteülesanne: "Veebileht on värvitav ja võimaldab interaktiivset käesemist."" **wrong** |
| Qwen3.5-2B | "**Purpose:** Create a vibrant, interactive website that visually demonstrates color theory… **Visitor Action:** Click interactive elements to trigger dynamic color shifts… **Visual Style:** … bold gradients…" **usable** | "**Milleks leht on:** See on interaktiivne, värviline veebileht… luudavad uusi tunde…" (repeats itself, cut off) **needs fixing** |
| Qwen3-4B | "- **Create a colorful, interactive section**… - **Visitors interact** by clicking, hovering… - **Design** features bold, dynamic color schemes…" **usable** | "- Leht on värvilise kodulehe, mis esitab erinevaid värvide omadusi… - Külastaja võib selged valikud värvidega…" **needs fixing** (grammar errors) |

**5. Chat: how do I make a circle follow the mouse in p5.js?**

| Model | English | Estonian |
|---|---|---|
| Qwen2.5-1.5B | "Use `mouseX` and `mouseY` to set the circle's position. Set radius dynamically…" **usable** | "Panna p5.js-is ring hiirdi järgima vaid ümiskorraluudite: 1. Loo projektide salasõita (p4.js või p5.js)… `var p5 = require('p5')`…" **wrong** (nonsense) |
| Qwen3.5-2B | "Use `mouse.position`… `circle.x = mouse.x`" **wrong** (invented API) | "Kasutad `p5.Vector`-i, et teha ringi." repeated 10+ times **wrong** (loop) |
| Qwen3-4B | "use `mouseX` and `mouseY` in the draw function: `ellipse(mouseX, mouseY, 50, 50)`" **usable** | "Kasuta `mousemove` esimese ja `mouseleave` toimingut…" + correct code with `mouseMoved()` **usable** (the code is right; the first sentence isn't) |

**6. Write a p5.js sketch** (400×400, 20 random-colour circles bouncing off the edges), then run it

| Model | English | Estonian |
|---|---|---|
| Qwen2.5-1.5B | 130 tokens, 2.2 s. Runs, but draws 20 new random circles each frame: **no bouncing**. **needs fixing** | 247 tokens, 4.7 s. Errors: "createCanvas is not defined", uses Processing's `pushMatrix()`. **wrong** |
| Qwen3.5-2B | 350 tokens, 12.4 s. Error: "Cannot read properties of undefined (reading 'width')". **wrong** | 517 tokens, 18 s. Runs, no bouncing, plus a confused explanation. **needs fixing** |
| Qwen3-4B | 298 tokens, 8.7 s. Runs, 20 circles with a `Circle` class, **bounces**. **usable** | 408 tokens, 12.9 s. Runs and bounces, but in plain canvas, **not p5**. **needs fixing** |

**Tally of usable answers (out of 6):**

| | English | Estonian |
|---|---|---|
| Qwen2.5-1.5B | 3 | **0** |
| Qwen3.5-2B | 3 | 2 |
| Qwen3-4B | **6** | 2 (and 4 needing fixes, none wrong) |

**One caveat on these runs.** They used temperature 0 (always the most likely
word), which makes small models more prone to loops like Qwen3.5's. The pool
passes on whatever temperature the caller sends.

## 5. Tool calls and structured output

**What WebLLM 0.2.86 supports:**
- **OpenAI-style `tools`:** only for five Hermes 8B models
  (`functionCallingModelIds` in the library). For Qwen2.5-1.5B, Qwen3.5-2B and
  Qwen3-4B, the call fails at once with `UnsupportedModelIdError: … is not
  supported for ChatCompletionRequest.tools`.
- **Constrained output:** XGrammar inside WebLLM supports
  `response_format: { type: 'json_object', schema: '<JSON schema as a
  string>' }`. It also supports `type: 'grammar'` (EBNF) and `structural_tag`.
- **Transformers.js:** 4.2 added tool calling and 4.3 added structured output.
  Not tested here.

**What we tested:**
- **The tool format:** we described the tools in the system prompt and asked
  for `{"name": …, "arguments": {…}}`.
- **Two modes:** prompt only, and the same prompt with a JSON schema in
  `response_format`. In schema mode, the group is an `enum` of the four names;
  in the two-step task, the reply is `anyOf` the two tools.
- **Ten tries per task:** five in English and five in Estonian, each with a
  different item.
- **The tasks:**
  - **Group:** pick one of 4 groups for a described work.
  - **Title:** `set_title`, at most 6 words.
  - **Two-step:** `read_version(n)`; we return that version's HTML; then
    `set_summary(...)`.

| 10 tries each (5 EN + 5 ET) | Qwen2.5-1.5B | Qwen3.5-2B | Qwen3-4B |
|---|---|---|---|
| `tools` parameter | refused | refused | refused |
| **Group**, right group: prompt / schema | 8 / 8 | 8 / 8 | 9 / 9 |
| Group, well-formed JSON: prompt / schema | 10 / 10 | **1** / 10 | 10 / 10 |
| **Title**, well-formed call: prompt / schema | 7 / 10 | 9 / 10 | 10 / 10 |
| **Two steps**, both right: prompt / schema | 5 / 5 (all English; Estonian summaries were gibberish) | **0** / 7 | 5 / 5 (all English) |
| Average seconds per call, group / title: prompt → schema | 0.43 / 0.60 → 0.45 / 0.85 | 1.02 / 1.02 → 0.97 / 1.34 | 0.93 / 1.11 → 0.94 / 1.31 |

**The malformed output (prompt mode only; schema mode had none):**
- **Qwen2.5-1.5B, titles:**
  - Twice it put the title in the tool's name, e.g. `{"name": "Interactive
    Sound Map", "arguments": {"title": "Kalamaja Soundscape"}}`.
  - Once it dropped the arguments.
  - Its Estonian two-step summaries were all "Ümberäbinud 1.–15. novembril."
    (not a word).
- **Qwen3.5-2B:**
  - 9 of 10 group answers came wrapped in ```` ```json ```` fences. They are
    fine once the fences are stripped.
  - One title missed its closing brace.
  - In the two-step task it read the version correctly 8 times, then answered
    in plain prose ("Ühelauseline kokkuvõte: …") instead of calling
    `set_summary`. The schema fixed that (7/10).
- **Qwen3-4B, Estonian two-step:** all 5 Estonian two-step tries skipped
  `read_version` and made a summary up at once ("Lehe versioon 3 on t…"). It
  did this with and without the schema: a schema can force the format, but
  not the order of steps.
- **All three, Estonian group task:** each model missed one or two Estonian
  group picks. Usually the typography works went to "Generatiivne kunst" or
  "Fotograafia".
- **Qwen3.5 and Qwen3 with thinking off:** WebLLM puts an empty
  `<think>\n\n</think>\n\n` at the start of every reply. Strip it before
  parsing; the counts above are after stripping.

**What this means:**
- **Always send a JSON schema** for a structured pool job (groups, titles,
  tags). The format is then guaranteed, it costs 0–0.3 s per call here, and an
  `enum` means the answer is always one of our groups.
- **Check the content anyway.** A schema can't make the pick right.
- **Run steps from our code.** Don't let a small model drive a multi-step tool
  loop: the code calls `read_version` itself, then asks the model for the
  summary.
- **Changes needed today:**
  - The pool's job message carries no `response_format`, so the gateway, the
    Pool and the join page would all need to pass it through.
  - The join page would also need to strip the empty think block.

## 6. Recommendation

### (a) The pool's tab worker

- **Keep Qwen2.5-1.5B as the small model for now, but stop sending it
  Estonian free text.** It is the fastest, the smallest download, and fine
  for short English jobs.
  - In Estonian, it gave 0 usable answers out of 6.
  - Route Estonian chat, summaries and rewrites to the strong model below or
    to the cloud.
  - Group and title jobs can still go to it with a schema, and the studio
    checks the result.
- **Don't swap to Qwen3.5-2B.** It is half the speed, with no clear gain, and
  it had the cache-storage failure.
  - If you do want a different small model later, try Qwen3-1.7B first. It
    has a better Estonian rank (3.20) and a plain design, so it should be
    fast in WebLLM. It is untested here.
- **Add a second model, `pool/qwen3-4b`, for strong machines.**
  - **What it is:** Qwen3-4B q4f16_1, thinking off. 2.3 GB download, about
    3.4 GB of GPU memory, 31–40 tokens/s on an M2 Pro.
  - **Results here:** it was the only model with all six English jobs usable,
    and the best in Estonian.
  - **Who should offer it:** Apple Silicon with 16 GB or more, and GeForce
    cards with 6 GB or more.
  - **How a tab joins:** a tab offers it only when the person ticks it, after
    a test load succeeds.
  - **Gemma 4 E2B and Ministral 3B:** worth one comparison run later. Both are
    the same memory class; Ministral ranks second-best in Estonian among
    WebLLM's models.
- **Pool changes that go with it:**
  - Pass `response_format` through.
  - Strip `<think></think>`.
  - Set WebLLM's `cacheBackend: 'indexeddb'`, or retest Cache Storage with
    the 4B model on a normal disk.
  - Add the new model's files to the page's list of addresses. They are
    already covered by `*.hf.co` and `raw.githubusercontent.com`.

### (b) Jobs in the student's own tab, with no pool and no cloud

- **Chrome's built-in AI: not for Estonian, so not for the main path.**
  - It supports no Estonian in any generative API or in Translator.
  - It needs 20–22 GB of free disk.
  - IT can switch it off with one policy.
  - It is missing on Safari, Firefox, phones and Edge (Prompt API).
  - **At most:** an optional English-only helper, behind `availability()`,
    with the cloud as the fallback.
- **What does make sense in the tab, with small downloads through
  Transformers.js:**
  - **Embeddings for grouping works:** granite-embedding-97m-multilingual or
    multilingual-e5-small (about 100 MB, Estonian included). Add the SigLIP2
    vision tower (55 MB) to group by the picture, or EmbeddingGemma 2 for
    text and images together.
  - **Estonian read-aloud:** Piper `et_EE-news-medium`, 77 MB.
  - **Titles, tags and group picks** with a schema, on the student's own
    WebLLM model. Do this only once the student has the model for the pool
    anyway; don't make every student download 1–2 GB for a title.

### (c) Speech to text in the browser, Estonian

- **Try Parakeet TDT 0.6B v3 in the tab** via parakeet.js.
  - About 670 MB, with a FLEURS-et error rate of 17.7%: good enough for a
    spoken brief that the student then reads over.
  - **Not measured here.** Test speed and the first load on a mid laptop
    before relying on it.
- **Use the cloud or the worker app for better quality:** Canary-1B-v2 (8.5%)
  or TalTech's Estonian Whisper. Neither has a ready browser build.
- **Don't use** Whisper small or below (51–95% errors in Estonian), or
  Chrome's on-device Web Speech (no Estonian).

### (d) What not to bother with

- **Writing HTML pages in a tab.** Even Qwen3-4B's sketches are simple, and
  multi-file pages need tool loops. Keep this in the cloud or on the worker
  app's bigger models.
- **Image generation in a tab.**
  - SD-Turbo is 2.6 GB and only fast on big GPUs.
  - FLUX.2 klein needs about 16 GB and takes about 14 s per image on an
    M2 Pro.
  - This belongs in the worker app (stable-diffusion.cpp or mflux) or the
    cloud.
- **Judging a page from a screenshot in a tab.**
  - Small vision models are English-only, or 1.6–3.4 GB with untested
    quality and speed.
  - Keep it in the cloud. Maybe try Qwen3.5-2B vision on the pool later.
- **Chrome Translator for Estonian:** not supported.
- **Writer, Rewriter, Proofreader:** behind a flag.
- **WebNN:** not shipped anywhere.
- **MediaPipe LLM Inference:** maintenance only.
- **WebLLM `tools`:** Hermes 8B only.
- **English-only small models** for anything a student reads: SmolVLM,
  Moonshine, Kokoro, LFM2, Phi-4-mini.

## Not verified

- Speeds on a base M1/M2, Intel or AMD integrated graphics, GeForce lab PCs,
  and phones.
- Whether a 1.6 GB model survives on an iPhone in Safari 26.
- Why Cache Storage refused the 254 MB file.
- Gemma 4 E2B and Ministral 3B on our jobs.
- Chrome's Gemma 4 rollout (seen only in the manifest).
- Gemini Nano's context size.
- Whether Edge's Translator really does Estonian.
- Parakeet's speed in a tab.
