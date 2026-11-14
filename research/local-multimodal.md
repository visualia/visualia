# Pictures, sound and video into local models, and making sound locally

2026-11-14. Read from the web and two repos; nothing installed, downloaded or run. **READ** means read on the
cited page (secondary when only a search summary or a blog said it), **INFERRED** means reasoned from it.

## Verdict

- **Listening needs no new model in the pool.** positron's tempo and key detectors already turn sound into numbers
  in the asker's tab. Words built from them fit today's pool job, which is text only (`plans/pool.md`).
- **Pictures are one protocol change away on desktop workers.** The Ollama models the M1 and M2 already serve take
  images, but the pool refuses picture jobs.
- **"My node only" is a routing rule in the Pool, not a new system.**
- **Local sound generation became practical in 2026**: Stable Audio 3 small renders 10 s in about 1 s on an M1 8 GB,
  and ACE-Step 1.5 (MIT) runs in under 4 GB of graphics memory.

## 1. Models that take pictures, sound or video

| Model | Size | In | Runtimes | Where it fits (INFERRED unless marked) |
| --- | --- | --- | --- | --- |
| Qwen3.5 0.8B to 9B | 9B: 6 to 7 GB at 4-bit, plus a 0.9 GB vision part | image | Ollama default tag, llama.cpp, Transformers.js (0.8B/2B/4B, 0.65/1.6/3.0 GB) | 9B: M1, M2, GeForce, already in the pool as `pool/qwen3.5-9b`. READ secondary ([Ollama](https://ollama.com/library/qwen3.5:9b-mlx), [mmproj](https://huggingface.co/jc-builds/Qwen3.5-9B-VLM-Q4_K_M-GGUF)); small sizes in a tab, `research/browser-models.md` |
| Qwen3-VL 2B / 4B / 8B | 8B: 6.1 GB | image, video | llama.cpp, Ollama, Transformers.js (2B, 1.4 GB) | 8B "fits in 8 GB", READ secondary ([GGUF](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF)) |
| Qwen2.5-Omni 3B / 7B | 3B, 7B | audio, image | llama.cpp (text out only) | READ ([llama.cpp multimodal](https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md)) |
| Qwen3-Omni 30B | 30B (MoE) | audio, image | llama.cpp | GeForce or a 32 GB Mac only. READ, same page. Qwen3.5-Omni is closed (READ secondary, [Wikipedia](https://en.wikipedia.org/wiki/Qwen)) |
| Gemma 4 E2B / E4B / 12B / 26B | E2B 2.8 GB in WebLLM | image, video; audio on E2B/E4B (and 12B) | llama.cpp, Ollama 0.33.3+ (via MLX), mlx-vlm, WebLLM (E2B), Transformers.js | `pool/gemma4-26b` already on the M2. READ secondary ([Ollama audio](https://pulseaugur.com/cluster/232954-ollama-adds-image-and-audio-support-for-gemma4-models), [mlx-vlm](https://github.com/Blaizzy/mlx-vlm)) |
| MiniCPM-o 4.5 | 9B, 6.1 GB in Ollama | image, video up to 10 fps, audio; speech out | Ollama, llama.cpp, a llama.cpp-omni fork, mlx-vlm | READ ([card](https://huggingface.co/openbmb/MiniCPM-o-4_5), [Ollama](https://ollama.com/openbmb/minicpm-o4.5)) |
| SmolVLM / SmolVLM2 256M, 500M | 0.19 / 0.36 GB | image; video (SmolVLM2) | llama.cpp, Transformers.js | any tab, English only. READ |
| Moondream2, Florence-2 | 0.33 GB (Florence) | image | llama.cpp (Moondream), Transformers.js | READ |
| Whisper large-v3 turbo | 0.9 to 1.5 GB | speech to text | whisper.cpp, mlx-audio | MEASURED on the M1: 0.9 to 1.6 s warm, Estonian exact (`research/local-runners.md`) |
| CLAP (LAION, music variants) | ONNX builds | music and text in one space | Transformers.js | tab: name what is heard from a word list. READ ([Xenova/larger_clap_music_and_speech](https://huggingface.co/Xenova/larger_clap_music_and_speech)); licence not checked |
| MuQ / MuQ-MuLan | 300M / 700M | music embedding, music and text | PyTorch | weights CC-BY-NC 4.0, so non-commercial only. READ ([repo](https://github.com/tencent-ailab/MuQ)) |

- **Audio understanding is weak on small machines.** One test on an M2 8 GB: Gemma 4 E2B took 5 min 35 s for 10 s of
  speech and looped; Whisper small did 47 s in 18.5 s. READ ([note.com](https://note.com/bhrtaym/n/n13e7d880d7c6?hl=en)).
  None of these models is trained to describe music (INFERRED from their cards).
- **No browser speed figures** were found for any vision model (`research/browser-models.md`, unchanged here).
- **WebLLM** has Gemma 4 E2B (text and audio in) and Phi-3.5-vision only; whether its Gemma build takes audio in a tab
  is not established.

## 2. Media and the pool

Today a pool job is system, user and assistant strings up to 12,000 characters; "Pictures, tools and longer prompts"
go to the gateway's paid model, and `/v1/decide` sends pictures there too (`plans/pool.md`).

**(a) Analyse in the asker's tab, send words.** positron's detectors already output what a prompt needs: tempo as
`{bpm, confidence, beats, candidates}` (`demo/radio/tempo.mjs:179`) and key as `{key, mode, confidence, also,
tuning, chroma[12]}` (`demo/radio/key/index.html:630`), in plain WebAudio, nothing fetched. Tempo must come with its
confidence: on an ambient station 78 % of the loudness movement was below 0.1 Hz and the detector scored 0.169
against 0.992 on a 120 BPM click (positron `research/vr-sound-visual-2026-09.md`), so the words should say "no steady
beat; slow swell every ~20 s" rather than a number. A picture becomes a caption from SmolVLM or Florence-2 in the tab.
- Pool change: none. Privacy: the sound or picture never leaves the asker's computer; the worker sees only the words,
  which it already does with any prompt.

**(b) Send the media to a worker.** A 1 MP JPEG is a few hundred KB, 30 s of Opus about 0.5 MB (INFERRED).
- Pool change: picture or audio parts in the job frame, a size cap, and a worker announcing which media each model
  takes. Only desktop workers hold a vision model now.
- Privacy: a stranger's computer sees the photo or recording, which is more personal than text. The rule "everything
  visible, nothing stored" holds (jobs live in memory, prompts are never logged), but the share screen's line "a
  worker sees the prompts it runs" would have to say pictures and sound too (INFERRED).

(a) first; (b) for what words cannot carry, judging a student's image, for example.

## 3. "My node only"

A person sends jobs to their own worker: the home Mac or a lab PC they are signed in on.
- **How it fits:** the Pool already knows each worker's person id (`served_by`) and the gateway knows the asker's
  key. A job marked `only: 'mine'` goes to a worker signed in as the same person, or waits, or fails. **No fallback to
  a paid model**, or the privacy is gone. The asker's id stays in the Pool and is never sent to the worker.
- **Why it matters:** heavy jobs (sound, images, a 26B model) and private media go to a computer the person trusts,
  and the "a stranger sees my photo" problem disappears. Usage rows stay as today.
- **Later:** `only: 'class-gpu'`, the lab PCs only, for jobs that need a big card.

Other systems, and why none is needed:
- **Petals** supports a private swarm "among people you trust" and warns that the public swarm processes your data on
  other people's machines. READ ([repo](https://github.com/bigscience-workshop/petals)).
- **exo** finds devices on the same network and splits one model's layers across them (READ secondary,
  [review](https://www.promptquorum.com/power-local-llm/exo-review)); **llama.cpp RPC** "should never be run on an
  open network", has no authentication and has had an out-of-bounds write bug. READ
  ([SECURITY.md](https://github.com/ggml-org/llama.cpp/blob/master/SECURITY.md)).
- **Ollama on the LAN** opens a port, against the pool's rule "connect out, never open in".
- All three split one model across machines; the pool sends whole jobs, so a pinned route is all it takes (INFERRED).

## 4. Making sound locally

| Model | Size | Speed (READ) | Runtimes | Licence |
| --- | --- | --- | --- | --- |
| **Stable Audio 3** small music / sfx (May 2026) | "50 M block"; 1.6 GB peak | ~1 s per 10 s clip, M1 8 GB; up to 380 s clips | official MLX build, PyTorch | Stability Community: free for education, research, and under $1M revenue ([MLX README](https://github.com/Stability-AI/stable-audio-3/blob/main/optimized/mlx/README.md), [licence](https://stability.ai/license)) |
| Stable Audio 3 medium | 1.4B; 3.8 GB peak | ~5 s per 10 s, M1 8 GB | same | same |
| Stable Audio Open Small | 341M, 11 s max | under 8 s per 11 s on a phone CPU | MLX port, 683 MB ONNX on WebGPU | same (`research/music-to-prompt.md`) |
| **ACE-Step 1.5** | under 4 GB VRAM; XL 4B wants 12 GB+ | under 10 s per song, RTX 3090 | PyTorch, MLX for its LM, Mac package | **MIT** ([repo](https://github.com/ace-step/ACE-Step-1.5), speed READ secondary) |
| **Magenta RealTime 2** (June 2026) | small 230M, base 2.4B | live, ~200 ms control latency; small on any Apple silicon incl. Air, base needs M2+ Max or M4 Pro | MLX C++ engine, AUv3, Python; NVIDIA offline only | code Apache 2.0, weights CC BY 4.0 (READ secondary) ([repo](https://github.com/magenta/magenta-realtime)) |
| MusicGen small | 300M | not checked | Transformers.js ONNX | **CC-BY-NC 4.0**: non-commercial ([card](https://huggingface.co/Xenova/musicgen-small)) |

- Magenta RT 2 is the only one that plays live and follows MIDI, audio and text, but it is a Mac app, not a job
  that returns a clip. It belongs on one computer, not in the pool (INFERRED).
- AudioLDM 2 and YuE were not checked in this pass; Stable Audio 3 and ACE-Step replace them for this use (INFERRED).

## 5. What to try first

1. **Music to words in the tab, prompt on the pool.** positron's `tempo.mjs` and the key code, plus a slow
  envelope, written out as words with confidences; optionally CLAP labels. Pool change: none. Cost: a week of
  porting at most, no download beyond CLAP (INFERRED). Goes in `research/music-to-prompt.md` idea 6, then
  `plans/board.md`.
2. **Pictures to desktop workers.** Image parts allowed only for node workers whose model takes them
  (`qwen3.5-9b`, `gemma4-26b`), capped in size; the share screen says workers see pictures. Cost: protocol, gateway
  allowlist, one test on the M1. Goes in `plans/pool.md`.
3. **`only: 'mine'`.** The routing rule from section 3, with no paid fallback. Goes in `plans/pool.md`.
4. **Sound clips as a job kind.** Stable Audio 3 small on MLX in the M1 worker, ACE-Step on a GeForce, a job that
  returns one Opus clip. Measure seconds and energy per 10 s on the M1 first, as `plans/local-images.md` did for
  images. Goes in a new `plans/local-sound.md`.
5. **Audio understanding by models: wait.** Whisper for speech; positron's detectors for music.

## Not known

- Speed of any vision model in a tab; whether WebLLM's Gemma 4 E2B takes audio.
- The lab GeForce cards' memory, which decides the Qwen3-Omni 30B and ACE-Step XL rows.
- Stable Audio 3 small's total parameter count (the README says only "50 M block"), and its quality.
- CLAP's licence, and Magenta RT 2's weight licence from the primary page.
- Cloudflare's WebSocket message limit for a media frame through the Pool.

## 3D objects: which machine decides which model (added 2026-11-14)

What the docs say about the class's hardware: the VR lab's GPUs are still a question to EKA IT
(`schools/eka/docs/PLAN.md:223`, `INFRA.md:467`); `INFRA.md` proposes a school GPU box with an RTX 5090, 32 GB, at
about €6,000, and nothing records that it was bought. So the 3D model is decided by the answer:

| machine | 3D model that fits | note |
| --- | --- | --- |
| school GPU box, RTX 5090 32 GB | TRELLIS.2 (MIT): 4B, needs 24 GB NVIDIA, Linux; 3 s at 512³ to 60 s at 1536³ on an H100 | best shapes ([repo](https://github.com/microsoft/TRELLIS.2)) |
| lab GeForce with 8 to 16 GB | TripoSR (MIT, about 6 GB, under 0.5 s on an A100), TripoSG (MIT, 1.5B, 8 GB) | simpler shapes, fast |
| Macs only | TripoSR, INFERRED to run on Apple silicon, not measured | Hunyuan3D's Mac port is out: its licence excludes the EU |

Hunyuan3D (2.1, 2mini) is out for an Estonian school whatever the machine: its licence excludes the EU, the UK and South
Korea. Sources: positron `research/geometry-vfx-2026-11.md`. A finished mesh goes to the headset as a file, cut to about
100k triangles and 1 to 2K textures first (Quest 3S, WebGL2; WebGPU in an immersive session is still behind a flag).

**Ask EKA IT:** the VR lab machines' GPU model and memory, and whether the school GPU box exists.
