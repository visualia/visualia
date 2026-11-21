# Inkling 2 Mini, assessed for visualia (2026-11-21)

Read from the web and from `~/personal/visualia`. Nothing downloaded, installed or run. **READ** = read on the cited
page. **READ (secondary)** = a third party or a search summary said it. **INFERRED** = reasoned from those.

## Verdict

- **The model is real and the Threads post is accurate in substance.** Released 2026-11-20, Apache 2.0, open weights on
  Hugging Face, supported on a 32 GB Mac through Ollama, DeepSWE v1.1 48.2 % self-reported. READ
  ([announcement](https://thinkingmachines.ai/news/inkling-2-mini/),
  [model card](https://huggingface.co/thinkingmachines/Inkling-2-Mini)).
- **It is a text and image in, text out model.** It makes no pixels, clips, sound or meshes, so in visualia it can
  only be a helper: page writing, judging pictures, writing prompts. READ (model card).
- **The headline benchmark is weak evidence.** DeepSWE v1.1 is rated "Flawed" by Epoch AI (grading defects in at
  least 23 of 113 tasks). The independent Artificial Analysis index puts it level with Qwen3.8 27B, not above it.
- **On the 32 GB M2 Pro it fits only by itself.** About 20 GB of weights leaves no room for an image or video model
  at the same time. On the 16 GB M1 it does not fit.
- **Worth one measured try on the M2, as a candidate to replace `pool/gemma4-26b` for page making and picture
  judging.** Not worth anything for music to prompt that the 9B already does, and not before Estonian is checked.

## 1. What visualia uses language models for (READ, from the repo)

- **Pages from a brief (studio agent, code).** `pool/gemma4-26b` "makes pages here (5/5, ~30 s, ~0.14 Wh chip per
  page: `plans/first-pages.md` run 9)" on the M2 Pro 32 GB (`plans/pool.md`).
- **Chat in English and Estonian on the pool.** `pool/qwen3.5-9b` on the M1 and M2, Ollama, `think: false`; the 1.5B
  is sent to the cloud for Estonian because it "writes poor Estonian" (`plans/pool.md`). Cloud fallback is DeepSeek
  V4.1 Flash.
- **Decide jobs** (`/v1/decide`, structured answers, Clef-flash, 0.9 to 5.8 s) (`plans/pool.md`,
  `plans/studio-core.md`).
- **Pictures to desktop workers** (planned): judging a student's image, models that take images
  (`research/local-multimodal.md` section 5 item 2).
- **Music to prompt** (idea): positron's tempo, key and envelope written as words, then a pool text model writes the
  image prompt; needs "no new model in the pool" (`research/local-multimodal.md`, `research/music-to-prompt.md`).
- **Agent coders** (planned): students' own Ollama / LM Studio through `only: 'mine'`, energy metered
  (`plans/agent-coders.md`).
- **Machines:** M1 Pro 16 GB (Ollama worker); M2 Pro 32 GB work Mac with ThreatLocker, Homebrew Ollama 0.40.8,
  36 GB free disk when last measured (`plans/pool.md`, `plans/local-video.md`). Ollama 0.40.8's MLX runner refuses
  structured output with 501 (`plans/pool.md`).

## 2. The model, from primary sources

| Fact | Value | Source |
| --- | --- | --- |
| Released | 2026-11-20 | READ, [announcement](https://thinkingmachines.ai/news/inkling-2-mini/) |
| Licence | Apache 2.0 | READ, [model card](https://huggingface.co/thinkingmachines/Inkling-2-Mini) |
| Parameters | 26.4B total, 3.4B active; middle 12 of 24 layers run 3 times, each pass adds ~1.0B, so "5.4B effective active parameters per token" | READ, model card |
| Architecture | decoder-only, sparse MoE (8 of 128 experts per layer), hidden size 2,304, local/global hybrid attention | READ, model card and [HF blog](https://huggingface.co/blog/inkling2mini) |
| Modalities | in: text and images (40 to 4096 px); out: text only | READ, model card |
| Context | up to 1M tokens | READ, model card |
| Precision | trained and shipped in NVFP4 (20 layers) and MXFP8 (last 4), "single checkpoint of about 20GB" | READ, model card, announcement |
| Mac | "any Mac system (MacBook, Mac Mini) with at least 32GB RAM via Ollama" | READ, announcement |
| Ollama | `inkling-2-mini:latest`, `:26b-a5b`, `:26b-a5b-nvfp4` (labelled MLX), each 20 GB, vision, tools, thinking; minimum Ollama version not stated | READ, [Ollama tags](https://ollama.com/library/inkling-2-mini/tags) |
| GGUF | IQ4_NL and Q8_0; LM Studio lists one GGUF of 17.5 GB, minimum 18 GB RAM | READ, HF blog; [LM Studio](https://lmstudio.ai/models/inkling-2-mini) |
| Runtimes | Transformers, vLLM, SGLang, llama.cpp, MLX, Ollama, Exo, Unsloth | READ, model card and HF blog |
| Extras | a speculative decoding drafter; a research variant with 1 to 3 loop passes | READ, HF blog |

- **Active parameter count is stated three ways:** 3.4B (card), "3B active" (HF blog), 5.4B effective (card,
  Ollama), and "3.1B unique weights per text token" (Artificial Analysis). They agree once looping is counted;
  the Threads post gave none.
- **Languages:** "English and general multilingual support" (READ secondary, search summary of
  [OpenRouter](https://openrouter.ai/thinkingmachines/inkling-2-mini)). Estonian is not mentioned anywhere read.

## 3. The benchmark claim

- **DeepSWE 48.2 % is self-reported**, run with mini-swe-agent v2.4.6. The card's own row: Inkling 2 Mini 48.2 %,
  Qwen3.8-27B 42.2 %, Nemotron 3.5 Super VL 24.7 %, Muse Glimmer 4.4 %, Gemma 4 31B 0.3 %. READ, model card.
- **What DeepSWE is:** Datacurve's benchmark of 113 original long-horizon coding tasks across 91 repositories.
  Epoch AI rates v1.1 **"Flawed"**: defects in at least 23 of 113 tasks (over 20 %), because "the models edited the
  existing tests", which breaks the grader. READ, [Epoch AI review](https://epoch.ai/benchmarks/deepswe/review).
  INFERRED: a 6 point lead over Qwen3.8-27B on this benchmark is inside its noise.
- **Gemma 4 31B at 0.3 %** looks like a harness failure, not a skill gap. INFERRED. It is also not the model the pool
  runs (`gemma4:26b`), which is not in the table.
- **Independent check:** Artificial Analysis Intelligence Index 20.1, equal to Qwen3.8 27B (card, AA column) and
  "matches Qwen3.8 27B and Nanbeige4.3-33B with ~5x and ~6x fewer active parameters". Per their task run: 9.0 min
  and $0.59 per task against 38.2 min and $3.53 for Qwen3.8 27B, ~152K output tokens per task against ~110K. READ,
  [Artificial Analysis](https://artificialanalysis.ai/articles/inkling-2-mini). Those times are on Thinking Machines'
  hosted API, not a Mac.
- Rows that matter more for visualia than DeepSWE (card, self-reported, Inkling / Qwen3.8-27B / Gemma 4 31B):
  Vibe Code Bench 77.9 / 64.9 / none; MMMU Pro 74.9 / 76.3 / 73.4; PerceptionBench 57.5 / 52.4 / 40.7;
  MCP Atlas 82.7 / 77.3 / 54.2; AA-Omniscience non-hallucination 63.4 / 71.4 / 14.5 %. READ, model card.

## 4. Speed on a Mac

- **No official tokens per second for any Mac.** READ secondary (search summary, felloai/eesel).
- Third party, READ secondary ([dev.to roundup](https://dev.to/rigbase/can-my-rig-run-inkling-2-mini-measured-local-speeds-vs-the-210-toks-hype-3alk)):
  M5 Pro 64 GB, llama.cpp IQ4_NL: 29.95 tok/s at a 512 token prompt, 17.39 at 131K. M5 Ultra 96 GB, oMLX: 83.4 at 4K.
  Exo's own 210 tok/s is on an M5 Ultra and 125 on an M5 Max 48 GB (READ secondary,
  [FourWeekMBA](https://fourweekmba.com/ai-inkling-2-mini-runs-210-tokens-a-second-on-a-mac-exo-says/)).
  M4 Pro 24 GB: median 11.6 tok/s (READ secondary, search summary only, source page not opened; 24 GB is under the
  stated minimum, so likely swapping).
- **Nothing measured on an M1 or M2 Pro.** INFERRED from bandwidth: the M2 Pro has about 200 GB/s and a token reads
  roughly 3 to 4 GB of weights (5.4B effective at ~4.5 to 8 bits), so a ceiling near 50 to 60 tok/s and a likely
  15 to 30 tok/s, similar to `gemma4:26b`. Not a fact until measured.

## 5. Fit on visualia's machines (INFERRED)

- **M1 Pro 16 GB: no.** 17.5 to 20 GB of weights against 16 GB, and LM Studio's minimum is 18 GB.
- **M2 Pro 32 GB: yes, alone.** macOS lets the GPU wire roughly two thirds to three quarters of memory (about 21 to
  24 GB), so 20 GB of weights plus a KV cache uses almost all of it. Z-Image-Turbo peaked at 11.0 GB MLX on the M1
  (`plans/local-images.md`) and TripoSplat at 8.4 GB GPU (`research/local-multimodal.md`): **neither can stay loaded
  beside Inkling.** The pattern has to be load, answer, unload, then the image model, which costs a cold load each
  switch (gemma4-26b first token cold was 8.4 s on the M2, `plans/pool.md`). The 1M context is unusable here; budget
  a few thousand tokens.
- **Disk:** 20 GB against the 36 GB free last measured on the M2 (`plans/local-video.md`), which would leave about
  16 GB, under that plan's 30 GB floor. Check `df -h` first.
- **Ollama 0.40.8 on the M2 may not know the model.** Upgrading Homebrew Ollama is an install on a ThreatLocker
  machine and needs the owner's approval; the new binary may be killed, as esbuild 0.28.2 and newer workerd were.
- **School GPU box (RTX 5090 32 GB, if bought):** the NVFP4 checkpoint suits Blackwell cards natively. READ
  (precision) plus INFERRED (fit).

## 6. Against what visualia has

| | Inkling 2 Mini | `pool/gemma4-26b` | `pool/qwen3.5-9b` |
| --- | --- | --- | --- |
| Size on disk | 20 GB (Ollama) READ | not in this repo | 6 to 7 GB at 4-bit plus 0.9 GB vision READ secondary (`local-multimodal.md`) |
| Images in | yes READ | yes READ secondary | yes READ secondary |
| Pages | not measured | 5/5, ~30 s (`first-pages.md` run 9) | not the page model |
| Estonian | unknown | usable (83 tokens served) | usable |
| Runs on M1 16 GB | no INFERRED | no (M2 only today) | yes, measured |

Qwen3.8-27B is the like-for-like open rival in the card and in AA; no Mac measurement or size for it was read here.

## 7. Verdict by role

- **Page making on the M2: try it.** The coding and vibe-coding rows are its strongest, and it would replace
  `gemma4-26b` one for one. INFERRED.
- **Judging student pictures: try it with the same run.** Vision is native and its perception rows beat Gemma 4 31B
  on its own card. INFERRED.
- **Music to prompt: no gain.** The job is turning a dozen numbers into a sentence; the 9B already does that on the
  M1, which Inkling cannot run. INFERRED.
- **Estonian chat: unknown, and a blocker for students.** Must be measured before it is offered.
- **Next to image or video models on one Mac: no.** One at a time with unloading.
- **Thinking:** Ollama tags it "thinking"; the pool sends `think: false`, and Ollama ignored a thinking switch once
  before (`plans/local-models.md`). Check it actually turns off, or every job pays for the reasoning tokens
  (~152K per agent task on AA).

## 8. What to measure on the M2 to make this a fact

Owner approval first: the 20 GB download, and an Ollama upgrade if 0.40.8 refuses the model.

1. `df -h` (free disk), `ollama --version`, then whether `ollama pull inkling-2-mini` runs and the binary survives.
2. **Memory:** peak wired and swap during a page job (`memory_pressure`, `vm_stat`, macmon), at 4K and 16K context.
3. **Speed:** first token cold and warm, decode tok/s, `:latest` against `:26b-a5b-nvfp4` (MLX), with `think: false`
   confirmed by the output token count.
4. **Quality on visualia's own tasks:** the `first-pages.md` brief set (pass count, seconds, Wh against Gemma 4 26B's
   5/5, ~30 s, ~0.14 Wh), the Estonian p5 brief (`plans/local-models.md`), one schema decide job (the 501 path), and
   one picture-judging prompt on a student-like image.
5. **Swap cost:** unload Inkling, load Z-Image-Turbo, make one image, reload Inkling: total seconds.

## Not known

- Any M1 or M2 tokens per second; Estonian quality; the minimum Ollama version; whether the MLX tag runs on Ollama
  0.40.8; real memory use with a KV cache on a 32 GB Mac.
