# Lemonade and LocalAI against Ollama (measured 2026-10-23)

The question: could **Lemonade** (the local AI server AMD sponsors) or
**LocalAI** replace Ollama in the pool, or run beside it for images and later
speech? The teacher wants one runner a student installs from its maker, the
same on Mac and Windows, with no Python environment of ours to ship. Measured
on the M1 Pro (16 GB, macOS 26.6.2) against Ollama 0.40.5 and the mflux
numbers in `plans/local-images.md`.

## Short answer

- **Neither replaces Ollama.** Lemonade has no MLX on macOS (llama.cpp on
  Metal only): 15 tok/s on Qwen 3.5 9B against Ollama MLX's 20 on the same
  prompt, and with its defaults it ran out of GPU memory on 16 GB. LocalAI's
  MLX backend is faster (28.6 tok/s) but loads in 88 s, ships its own Python,
  and LocalAI has no native Windows build.
- **MLX:** Lemonade uses it for nothing on a Mac (an open issue asks for it).
  LocalAI uses MLX for text, vision-language, speech (mlx-audio) and video
  (mlx-video), **not for images**: its image backends are
  stable-diffusion.cpp on Metal and diffusers on PyTorch MPS.
- **Images:** both draw FLUX.2 klein 4B through stable-diffusion.cpp on Metal,
  and both are **2.4 to 3.2 times slower than mflux** on the M1 (31 s against
  12.7 s at 512², 118–132 s against 41.8 s at 1024²), with worse Estonian
  text on the poster. On the pool's Macs neither is worth adding for images.
  On Windows with GeForce, Lemonade is the one of the two that exists natively
  (an MSI with CUDA backends); try it on one lab PC before deciding.
- **Speech:** both run Whisper large-v3 turbo through whisper.cpp on Metal and
  transcribed an Estonian sentence word for word. For Estonian speech out,
  only LocalAI has something: OmniVoice, whose Estonian came back word for word
  through Whisper. Its Piper backend crashed. Lemonade's only Mac voice is
  Kokoro (no Estonian).
- **Recommendation:** keep Ollama for text. Don't adopt either runner now.
  If images or speech move into the pool, the engine both of them wrap,
  stable-diffusion.cpp and whisper.cpp, is the thing to plan around. Lemonade
  is the closer fit if a ready-made runner is wanted on Windows lab PCs.

## Comparison

| | Ollama (baseline) | Lemonade | LocalAI |
|---|---|---|---|
| Version tested | 0.40.5 | 2026.43.3 (2026-10-21) | 4.12.0 (2026-10-22) |
| Licence | MIT | Apache-2.0 | MIT |
| Mac install | app, drag to Applications | `.pkg`, **needs admin**; or a 6 MB "embeddable" tarball | `LocalAI.dmg` (menu-bar launcher, per user), which downloads the 192 MB server on first launch |
| What it puts on a Mac | the app, `~/.ollama` | `/usr/local/bin/{lemond,lemonade,lemonade-tray}`, `/Applications/lemonade-app.app`, a **root LaunchDaemon** (`ai.lemonadeserver.server`, starts at boot), a LaunchAgent for every user (tray), `/Library/Application Support/Lemonade`, `/var/log/lemonade`, plus libwebsockets headers, static library and CMake files in `/usr/local` | `/Applications/LocalAI.app`; server, backends and models in the folder it runs from |
| Signed | Developer ID (Ollama) | pkg and its three binaries: Developer ID of an individual (Geramy Loveless, `YBQ9BU6Q6F`), notarised. The embeddable build: ad hoc | app and server: Developer ID, LocalAI S.R.L. (`34F3GGU9A6`), notarised |
| Engines downloaded later | none | 429 files, 129 MB from GitHub (llama.cpp b11393, sd.cpp master-957, whisper.cpp 1.8.4, kokoros b21), **all ad hoc signed** | OCI images from quay.io, "installed without signature verification" (its own log); 6 backends 818 MB, 15,489 files, 59 Mach-O, all ad hoc, one with its own Python 3.10 |
| What allowlisting sees | one signed app | one signed installer, then hundreds of unsigned binaries in a cache folder | one signed app and server, then unsigned binaries and a Python interpreter |
| Ports | 11434 | 13305 (HTTP), **9000** (WebSocket, fixed), internal ports per engine (8001 for images), a UDP discovery broadcast **on by default** | **:8080 on all interfaces** by default |
| Text on Apple Silicon | **MLX** (`runner: mlx`) | llama.cpp, Metal | llama.cpp, Metal; **MLX** (mlx-lm) |
| Images | removed in 0.32.6 | stable-diffusion.cpp, Metal | stable-diffusion.cpp, Metal; diffusers, PyTorch MPS |
| Speech to text | none | whisper.cpp, Metal; Moonshine (CPU) | whisper.cpp, Metal; mlx-audio, Parakeet, Moonshine and more |
| Text to speech | none | Kokoro (no Estonian) | OmniVoice (Estonian), Piper, Kokoro, mlx-audio, Qwen3-TTS and more |
| APIs | Ollama, OpenAI | OpenAI (`/api/v1`), Ollama (`/api/*`), Anthropic | OpenAI, Ollama (no `/api/pull`), Anthropic, ElevenLabs |
| Pull by name with a percent | `/api/pull` | `/api/pull` in Ollama's shape (`completed`/`total`), and `/v1/pull` | `/models/apply`, then `/models/jobs/<id>` with `progress` in % |
| Unload on demand | `keep_alive: 0` | `POST /v1/unload` | `POST /backend/shutdown` |
| Windows | per-user installer, CUDA | MSI, CUDA, Vulkan, ROCm, Ryzen NPU | **containers or WSL only**; no native build |

## Measurements

All on the M1, one runner at a time, after the machine was quiet (no Ollama
model loaded, no other benchmark, `~/visualia-svg` not written to for 3
minutes). Machine memory is active + wired + compressed pages from `vm_stat`;
process memory is the server's whole process tree as `top` reports it.
Temperature and energy were not measured (both need sudo or macmon, which
isn't installed on the M1). Scripts: `~/visualia-runners/bench-img.mjs` and
`bench-text.mjs` on the M1.

### Images: FLUX.2 klein 4B, 4 steps, seed 42, cfg 1

Prompts from `plans/local-images.md`: the "Kevadnäitus 2027" poster and the
misty bog boardwalk. Warm numbers are the mean of those two prompts. mflux is
the mean of three prompts (`plans/local-images.md`).

| Runner and weights | Download | Cold 512² | Warm 512² | Warm 1024² | Process peak | Machine peak | Swap |
|---|---|---|---|---|---|---|---|
| mflux 0.23.0, q8 (baseline) | 8.6 GB | 15 s | **12.7 s** | **41.8 s** | 10.4 GB (MLX) | 15.2 GB | 0 |
| Lemonade, Q8_0 GGUF + Qwen3-4B Q8_0 (added by hand) | 8.5 GB | 70 s | 31.0 s | 119 s | 9.3 GB | 15.4 GB | 0 |
| LocalAI, the same Q8 files | same | 54 s | 39.0 s | 132 s | 11.1 GB | 15.0 GB | 0 |
| LocalAI gallery `flux.2-klein-4b` (Q4_0 + Qwen3-4B Q4_K_M) | 5.3 GB | 39 s | 31.1 s | 118 s | 6.9 GB | 14.9 GB | 0 |

- **Lemonade's own catalogue entry** `Flux-2-Klein-4B` is the unquantised
  release (16.1 GB: bf16 model and text encoder), too big for 16 GB, so a Q8
  model was registered with `lemonade pull user.… --recipe sd-cpp
  --checkpoint main … --checkpoint text_encoder … --checkpoint vae …`. A
  student would get the 16 GB one.
- **LocalAI's gallery config offloads weights to the CPU**
  (`offload_params_to_cpu: true`); that may be why its Q8 run is the slowest.
- **Quality:** the bog photos are as good as mflux's, with a little more
  contrast. The posters are worse: the headline came out "Kevadläitus" or
  "Kevadäiitus" at 512² and "Kevadrätitus" at 1024² from every
  stable-diffusion.cpp run, and the year was missing at 1024². mflux had it
  right at 512². Same model and steps; the engine or its GGUF quantisation makes the difference.
  Images and side-by-side sheets: `~/visualia-runners/out/` on the M1.
- **Unload works on both** and gives the memory back (3.4–3.6 GB used after,
  against 3.5–3.8 GB before).
- API shape: `POST /v1/images/generations` (Lemonade under `/api/v1`), with
  `b64_json`, plus non-OpenAI fields `steps` (Lemonade) or `step` (LocalAI),
  `cfg_scale` and `seed`.

### Text: Qwen 3.5 9B

One short Estonian prompt ("Kirjuta kolm lühikest lauset Tallinna
vanalinnast."), thinking off, temperature 0, about 75 tokens out. Rate is
counted from the first to the last streamed token, mean of two warm runs. The
JSON check asks for a title and three colours with a JSON schema.

| Runner, engine, weights | Cold first token | Warm tok/s | Process | JSON schema |
|---|---|---|---|---|
| Ollama, MLX, `qwen3.5:9b` (nvfp4) | 3.9 s | **20.5** | 7.9 GB | 501, as known (the worker puts it in the prompt) |
| Lemonade, llama.cpp Metal, UD-Q4_K_XL | 3.4 s | 14.8 | 7.6 GB | enforced, valid |
| LocalAI, llama.cpp Metal, gallery `qwen3.5-9b` (Q4_K_M + DFlash draft) | already loaded | 5.6 | 9.6 GB | enforced, valid |
| LocalAI, llama.cpp Metal, same weights, no draft | 5.0 s | 16.1 | 6.4 GB | enforced, valid |
| LocalAI, MLX, `mlx-community/Qwen3.5-9B-4bit` | **88 s** | **28.6** | 4.8 GB RSS (MLX memory not all in RSS) | ignored (plain text back) |

- `plans/pool.md` has Ollama MLX at 33–35 tok/s on this model. Today's
  20.5 is on a 75-token answer with a different quantisation (nvfp4); the
  order between engines is the point, not the absolute number.
- **Lemonade with its defaults failed:** it auto-sized the context to 183,173
  tokens on a 16 GB Mac, and llama.cpp ran out of GPU memory ("Compute
  error"). It worked after `lemonade config set ctx_size=16384`.
- **Thinking off is spelled differently on each.** Lemonade's OpenAI route
  honours `chat_template_kwargs: {enable_thinking: false}`. LocalAI needs
  `reasoning_effort: "none"`. Neither honours Ollama's `think: false` on its
  Ollama route: both streamed thinking only. Lemonade's Ollama route also
  ignored `format`. So the worker's current Ollama calls would not work
  unchanged against either.
- LocalAI's gallery config for Qwen 3.5 9B (speculative decoding with a DFlash
  draft model, 4 parallel slots) is three times slower on the M1 than plain
  llama.cpp.
- LocalAI loads MLX models from Hugging Face by name into its models folder;
  it didn't use `HF_HOME`.

### Speech

Whisper large-v3 turbo through whisper.cpp on Metal on both (Lemonade f16
1.5 GB, LocalAI q8 0.9 GB). A 3.9 s English clip from macOS `say` and a 3.8 s
Estonian clip from OmniVoice.

| | Cold | Warm | English | Estonian (`language=et`) |
|---|---|---|---|---|
| Lemonade | 17 s | 0.9 s | exact | exact: "Kevadnäitus avatakse viiendal mail kunstiakadeemia suures saalis." |
| LocalAI | 10.5 s | 1.5–1.6 s | exact | exact, same sentence |

- **Estonian speech out:** LocalAI's `omnivoice-cpp` (Apache-2.0, GGML on
  Metal) made 3.8 s of 24 kHz audio in 17 s cold, and Whisper heard it word for
  word, so it is at least clear. How natural it sounds was not judged.
  LocalAI's Piper backend with the Estonian `et_EE-news-medium` voice crashed
  on load (exit 2, "fault"). Lemonade's Kokoro speaks (MP3 in 4 s) but has no
  Estonian voice.
- Lemonade accepts WAV only for transcription.

## Pros and cons

**Lemonade**
- Pros: native Windows MSI with CUDA, Vulkan and ROCm, the same engines on Mac
  and PC (llama.cpp, stable-diffusion.cpp, whisper.cpp). An Ollama-shaped
  `/api/pull` with byte progress, so the app's download percent would carry
  over. OpenAI routes for images, transcription and speech. JSON schema works.
  Clean unload. An "embeddable" build (6 MB, own folder, no daemon) exists for
  apps that bundle it. Apache-2.0, active (pushed daily).
- Cons: no MLX on macOS ([#891 Support MLX on macOS](https://github.com/lemonade-sdk/lemonade/issues/891),
  open since 2026-01-21), so text is slower than Ollama on the pool's Macs.
  The Mac installer needs admin and starts a root service at boot, a tray for
  every user, and leaves developer files in `/usr/local`. That breaks the
  pool's "no admin, no background service" rule. Installer signed by a
  person, not a company. Engines arrive later as hundreds of unsigned
  binaries. Fixed port 9000, LAN broadcast on by default, and a log warning
  that its `/internal/*` endpoints are unauthenticated. Context auto-sizing
  broke a 9B model on 16 GB. Its Ollama route ignores `think` and `format`.
  Images 2.4–3.2 times slower than mflux, with worse text. The catalogue's klein
  4B is 16 GB.

**LocalAI**
- Pros: the only one with MLX on a Mac, and its MLX text was the fastest
  measured (28.6 tok/s). Per-user signed and notarised app and server. The
  widest choice of speech engines, including OmniVoice with usable Estonian.
  Pull jobs report a percent. JSON schema works on llama.cpp. MIT.
- Cons: no native Windows (containers or WSL), so not one runner for the
  GeForce lab. Backends are unsigned OCI downloads (its log says so), one of
  them a 541 MB Python. MLX cold start 88 s, and MLX ignores the JSON schema.
  Gallery defaults are slow on 16 GB (DFlash draft, CPU offload for images).
  Binds all interfaces by default. Backend download broke on a Mac with
  Docker Desktop's leftover `credsStore: desktop` in `~/.docker/config.json`
  ("docker-credential-desktop: executable file not found"), fixed only by
  pointing `DOCKER_CONFIG` at an empty folder. Piper crashed. Ollama route has
  no `/api/pull` and ignores `think`. A large surface (agents, MCP, P2P, a
  web UI) for a pool that needs four calls.

## Recommendation

- **Keep Ollama for text.** It is one signed app from its maker, runs MLX, and
  the worker already speaks it. Neither runner is faster with what a student
  would get by default, and both would need changes to the worker's calls.
- **Don't add either runner for images on the pool's Macs.** Both wrap
  stable-diffusion.cpp, which is 2.4–3.2 times slower than mflux here and worse
  at Estonian letters. On Macs the image question is mflux (Python, the
  teacher's portability concern) or waiting for an MLX image route in a runner
  a student can install.
- **On Windows GeForce PCs, Lemonade is worth one test.** It is the only one of
  the two with a native installer, and CUDA is where stable-diffusion.cpp is
  fast. Measure klein 4B, Whisper and Qwen 3.5 9B on one lab PC, installed by
  IT (the MSI's admin needs are not checked here).
- **Speech:** Whisper through whisper.cpp is the same engine in both and handles
  Estonian. For Estonian voice out, OmniVoice is the lead (LocalAI showed it
  works), but LocalAI as a whole is too heavy to ask students to install for
  one voice. Compare with `omnivoice.cpp` on its own and with the gateway's
  Gemini TTS (`research/models-2026-10.md`).

What the pool app would need if Lemonade ran beside Ollama (Windows first):
- Detect it (`GET 127.0.0.1:13305/api/version`, its Ollama-style route) and link its download, as
  for Ollama.
- New job kinds: images on `POST /api/v1/images/generations` (`steps`,
  `cfg_scale`, `seed`, `b64_json`), transcription on
  `/api/v1/audio/transcriptions`.
- Text through its OpenAI route with `chat_template_kwargs` to turn thinking
  off, or stay on Ollama for text.
- Set `ctx_size` (16384) before loading a model, through `lemonade config`
  or `config.json`.
- Downloads through `/api/pull` (Ollama's progress shape) and models
  registered by name, including a hand-registered Q8 klein on 16 GB machines.
- `POST /api/v1/unload` after each image, since text and images share one
  machine's memory.

## Installed, then removed

Everything went under `~/visualia-runners/` on the M1 and was removed after
measuring. Nothing was installed system-wide: the Lemonade `.pkg` needs an
admin password, so its contents were read with `pkgutil --expand-full` and
the embeddable build was run instead, from its own folder, on 127.0.0.1 with
`--no-broadcast`. LocalAI ran as the release binary with `--address
127.0.0.1:8088` (not the `.dmg` launcher, whose signature was checked).

- Lemonade: embeddable 2026.43.3 (16 MB), engines 129 MB, models 17 GB (klein
  Q8 + Qwen3-4B Q8 + VAE, Qwen 3.5 9B UD-Q4_K_XL, Whisper large-v3 turbo,
  Kokoro). Empty `~/.cache/lemonade` made by the CLI, removed.
- LocalAI: server 183 MB, backends 818 MB (llama.cpp 81, MLX 541, sd.cpp 61,
  whisper 26, Piper 85, OmniVoice 24), models 19 GB (including a second copy of
  the MLX model), Hugging Face cache 5.6 GB, a temp folder in `/var/folders`,
  removed.
- Kept: the two benchmark scripts, the quiet check, test audio and the images
  (`~/visualia-runners`, 14 MB).
- Not touched: Ollama 0.40.5 and its models, the Visualia Pool app, the
  SVG experiments. Ollama's `qwen3.5:9b` was stopped after the baseline run.

## Sources

Read 2026-10-23.
- Lemonade: [repo](https://github.com/lemonade-sdk/lemonade) (Apache-2.0),
  [release v2026.43.3](https://github.com/lemonade-sdk/lemonade/releases/tag/v2026.43.3),
  [macOS install](https://github.com/lemonade-sdk/lemonade/blob/v2026.43.3/docs/guide/install/macos.md),
  [Windows install](https://github.com/lemonade-sdk/lemonade/blob/v2026.43.3/docs/guide/install/windows.md),
  [embeddable guide](https://github.com/lemonade-sdk/lemonade/blob/v2026.43.3/docs/embeddable/README.md),
  [OpenAI API](https://github.com/lemonade-sdk/lemonade/blob/v2026.43.3/docs/api/openai.md),
  [Ollama API](https://github.com/lemonade-sdk/lemonade/blob/v2026.43.3/docs/api/ollama.md),
  [Lemonade API](https://github.com/lemonade-sdk/lemonade/blob/v2026.43.3/docs/api/lemonade.md),
  [model catalogue](https://github.com/lemonade-sdk/lemonade/blob/v2026.43.3/src/cpp/resources/server_models.json),
  [engine versions](https://github.com/lemonade-sdk/lemonade/blob/v2026.43.3/src/cpp/resources/backend_versions.json),
  [FAQ](https://github.com/lemonade-sdk/lemonade/blob/v2026.43.3/docs/guide/faq.md)
  ("macOS support uses the llama.cpp backend with Metal acceleration"),
  [#891 Support MLX on macOS](https://github.com/lemonade-sdk/lemonade/issues/891).
- LocalAI: [repo](https://github.com/mudler/LocalAI) (MIT),
  [release v4.12.0](https://github.com/mudler/LocalAI/releases/tag/v4.12.0),
  [install options](https://github.com/mudler/LocalAI/blob/v4.12.0/docs/content/getting-started/install.md),
  [macOS](https://github.com/mudler/LocalAI/blob/v4.12.0/docs/content/getting-started/macos.md),
  [backends](https://github.com/mudler/LocalAI/blob/v4.12.0/docs/content/features/backends.md),
  [image generation](https://github.com/mudler/LocalAI/blob/v4.12.0/docs/content/features/image-generation.md),
  [text to audio](https://github.com/mudler/LocalAI/blob/v4.12.0/docs/content/features/text-to-audio.md),
  [backend index](https://github.com/mudler/LocalAI/blob/v4.12.0/backend/index.yaml),
  [model gallery](https://github.com/mudler/LocalAI/blob/v4.12.0/gallery/index.yaml),
  [Ollama routes](https://github.com/mudler/LocalAI/blob/v4.12.0/core/http/routes/ollama.go).
- Weights: [leejet/FLUX.2-klein-4B-GGUF](https://huggingface.co/leejet/FLUX.2-klein-4B-GGUF),
  [unsloth/Qwen3-4B-GGUF](https://huggingface.co/unsloth/Qwen3-4B-GGUF),
  [mlx-community/Qwen3.5-9B-4bit](https://huggingface.co/mlx-community/Qwen3.5-9B-4bit),
  [Serveurperso/OmniVoice-GGUF](https://huggingface.co/Serveurperso/OmniVoice-GGUF),
  [Piper et_EE voice](https://huggingface.co/rhasspy/piper-voices/tree/main/et/et_EE/news/medium).
- Baselines: `plans/local-images.md` (mflux), `plans/pool.md` "Engines",
  `plans/worker-app.md`, `research/models-2026-10.md` section 4.
