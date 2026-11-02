# Small data and old models

Training tiny models on one's own material, and old "bad" models as an
aesthetic. Background for `plans/small-data.md`, including how training could run on
the pool.

Gathered 2026-10-24 to 2026-11-02 in a claude.ai chat and brought in with the
handoff of 2026-11-02. Prices, benchmarks and release claims are as published
by their makers unless marked otherwise and were not checked here; check them
before relying on them.

## Anti-drift practice and old models

### Artists and research

- **Small data / "Little AI"** (ACM 2026, workshops with Autolume): artists
  value training on their own datasets for authorship and control; models
  reflect their own aesthetic; community and shared resources matter.
- **Dataset weighting against bias:** a tiny-model art-kiosk project asked the
  V&A for textiles and Islamic calligraphy and weighted them heavily, because
  pre-trained models lean toward photorealism and Western art.
- **Queer artists (CSCW 2026):** refusal and resistance; glitchy, surreal
  models like DeepDream need little data, so consented small datasets are
  feasible.
- **Community archives:** Stephanie Dinkins, *Not The Only One* (oral
  histories of three generations of one family); Nouf Aljowaysir, *Salaf*
  (dataset representation).
- Also: Anna Ridler, Helena Sarin, Jake Elwes (*Zizi*), Holly Herndon and
  Mat Dryhurst. No art-school programme explicitly framed as anti-drift was
  found: a gap EKA could fill.

### Old "bad" models as an aesthetic

- Early AI imagery (late 2010s, early 2020s): grainy, stroboscopic,
  many-fingered mutant forms; accelerated culture, accelerated nostalgia
  (Ocula).
- "Will Smith eating spaghetti" (ModelScope, March 2023): the model had
  learned stock-footage watermarks, which reveals whose data it was.

### What runs where (estimates unless cited)

| Era | Model | Browser | Pool |
|---|---|---|---|
| 1960s–70s | Nake, Nees, Molnár-style algorithms | plain JS | — |
| 2015 | char-rnn, small GANs | yes; can train on own data in a tab | — |
| 2015 | DeepDream | yes | — |
| 2019 | GPT-2 small | yes (transformers.js) | — |
| 2019–21 | StyleGAN2, VQGAN+CLIP | heavy | GPU, Python |
| 2022 | Stable Diffusion 1.5 | WebGPU, ~4 GB VRAM | yes |
| 2023 | SD Turbo | WebGPU (under a second on an RTX 4090) | yes |
| 2022–23 | Disco Diffusion, Deforum, ModelScope, AnimateDiff | no | PyTorch only |

Licences vary (SD 1.5: CreativeML OpenRAIL-M); check before publishing.

Sources:
- https://dl.acm.org/doi/10.1145/3800645.3812958
- https://arxiv.org/pdf/2606.19957
- https://dl.acm.org/doi/full/10.1145/3816950
- https://joinreboot.org/p/artist-datasets
- https://ocula.com/magazine/opinion/ai-imagery-isnt-what-it-used-to-be/
- https://github.com/mlc-ai/web-stable-diffusion
- https://opensource.microsoft.com/blog/2024/02/29/onnx-runtime-web-unleashes-generative-ai-in-the-browser-using-webgpu/

## Small data

### Methods by amount of material

| Material | Method | Where |
|---|---|---|
| 1 image | texture neural cellular automata, SinGAN-style | browser |
| 50–500 images | FastGAN / lightweight GAN; StyleGAN2-ADA near a thousand | pool |
| 20–100 images on a big base | LoRA on SD 1.5 / FLUX klein, small set weighted | pool (GPU) |
| a few hundred KB of text | char-rnn / tiny GPT | browser |
| an hour or two of audio | RAVE (IRCAM) | pool (training) |
| no training | retrieval and collage over own corpus | anywhere |

From-scratch small models know only your material: the most anti-drift.
LoRAs on big bases keep the base's habits.

### Process

Collect (provenance, consent) → curate 20–500 items (selection is authorship
and where bias enters) → caption in your own words and language → dataset card
→ train small, look, retrain → share in the class library with credit and
lineage.

### What it gives

- **Output:** variations inside your own world, interpolation, a personal
  instrument.
- **Insight:** the model mirrors the dataset (what's consistent is learned,
  what's unique isn't); bias made visible; ML first-hand (loss, overfitting,
  latent space, minutes and watt-hours).
- **Research:** dataset + card, model, outputs as a citable research object;
  clear ownership; low energy, local.
- **Limits:** low resolution, memorisation with very little data, narrow, GANs
  unstable (NCA and char-rnn are more forgiving).

Big models answer "what does the average look like?"; small models answer
"what is characteristic of this material?"

### Beyond images: the layers of a design

| Layer | Source | Learner |
|---|---|---|
| Surface | pixels | small image models |
| Composition | board records | constraint inference, personal scorer |
| Process | event log (`put / set / del`, `by`, `t`) | small sequence model of moves |
| Decisions | diffs, picks, undos | Clef typing + preference pairs |
| Intent | brief, comments, voice | CIPHER rules; Clef checks intent ↔ result |

**Old work and photos:** an image type on the board; drop a folder; order by
EXIF; group by embedding similarity; align consecutive photos (OpenCV.js);
diff; describe and type the change; lay out as a timeline with branches. Mark
inferred decisions "reconstructed, not recorded" until the student confirms
them. Design files (SVG, PDF, Figma version history) give real structure.
Craft students: a fixed photo setup makes this reliable.

## Training in a transient pool, portably

Constraints: pool members come and go; Macs and Windows/GeForce PCs; no
Python stack on members' machines; the Visualia worker app bundles no runtime.

### Where training happens

| What | Where | Engine | Stored |
|---|---|---|---|
| CIPHER rules | no training; LLM via gateway or pool tabs | DeepSeek / Qwen | D1 |
| Clef decisions | no training; asked | Clef-flash on a node or cloud | — |
| Taste scorer | the student's board page (or Worker) | Rust → WASM, or JS | D1 / R2, KB |
| Small-data models (texture NCA, tiny GAN, char-rnn) | browser tab, own laptop or pool tab | Burn → WASM + WebGPU | R2 + dataset card |
| Larger small-data models (FastGAN, 50–500 images) | pool worker app, resumable chunks | Burn (Metal / CUDA / Vulkan) | checkpoints in R2 |
| LLM LoRA (later) | pool worker app | QVAC llama.cpp (beta) | adapters in R2 |
| Diffusion LoRA, old video models | volunteer machines with Python (uv), or skipped | PyTorch | R2 |

### Engines

- **Burn (Rust):** training and inference; CUDA, ROCm, Metal, Vulkan and
  WebGPU backends with autodiff; WebGPU in Wasm. One codebase for the Tauri
  worker and the browser; compiles into the app (no runtime to bundle).
  Imports PyTorch weights. Catch: models are written or ported by hand.
- **QVAC-fabric-llm.cpp** (Tether): a llama.cpp fork with LoRA fine-tuning on
  CPU, Vulkan, Metal and CUDA; Qwen3 and Gemma3; checkpoint and resume. Beta,
  not yet upstream; SFT only.
- **MLX:** fastest on Apple Silicon; usable without Python via mlx-rs, Swift
  or C++; but Apple only (Linux CUDA only on roadmaps), and the Rust bindings
  are young (asynchronous Metal failures can abort the process). Keep it for
  inference through Ollama on Macs.
- **Python (MLX-LM-LoRA, MLX-Tune, Unsloth, TRL):** full SFT, DPO, ORPO,
  GRPO; only on machines that opt in, via uv.

### RL without an RL framework

Rejection-sampling fine-tuning (expert iteration): the pool generates N
candidates → score with metrics + taste + nudges → keep the best → fine-tune
the adapter (SFT only) → redeploy → repeat. Nudges count as winners too.

### Adapters travelling to runners

1. Trainer uploads to R2 under a content hash (presigned PUT).
2. Registry row (D1 or the coordinator DO): hash, base-model hash, rank,
   scope (class / personal / owner), parent, metrics, signature.
3. The coordinator pushes `adapter.available` over WebSocket to runners with
   that base model.
4. Runner downloads via a short-lived presigned GET, checks the hash and the
   ed25519 signature, caches (LRU), loads.
5. Ack back; jobs needing adapter X go only to runners that have it.

Details: adapters bind to the exact base model; personal adapters encode
taste and are personal data (owner-only URLs); llama-server loads LoRA with
`--lora` and changes scales per request; Ollama needs a Modelfile `ADAPTER`
plus `ollama create`.

### Pool pitfalls

Pin model and adapter versions per batch; cross-check untrusted runners;
take the first K of N results; log seeds and temperatures; expect few nudge
pairs per person early on.

Sources:
- https://github.com/tracel-ai/burn (Burn; see also docs.rs/burn)
- https://huggingface.co/blog/qvac/fabric-llm-finetune
- https://github.com/Goekdeniz-Guelmez/mlx-lm-lora
- https://pypi.org/project/mlx-tune/
- https://docs.rs/crate/mlx-rs/latest
- https://docs.rs/mlxrs
