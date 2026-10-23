---
status: dropped
---

# Local video: Kandinsky 6.0 Video Lite on a 32 GB Mac

Could the M2 Pro (work Mac, 32 GB) make a short clip with sound locally, so
that video becomes pool work? Checked 2026-10-23, then dropped before any clip
was made.

**Why dropped:** too hard to run for a portable worker. It has no MLX or
llama.cpp-style engine, only PyTorch.

## What was found

- **The model.** Kandinsky 6.0 Video Lite (3B) makes 5 s clips at 480×864,
  24 fps (121 frames), with synchronised 44 kHz audio, from text or from an
  image plus text. `Lite-distill-5s` samples in 10 steps.
- **Licence: MIT for code and weights.** The repo reports MIT. The official
  Hugging Face repos have `license: mit` and aren't gated.
- **The official code is NVIDIA-only.** It says "An NVIDIA GPU". `just setup`
  needs `nvidia-smi` and installs PyTorch for CUDA 13.0 with FlashAttention 3
  or SageAttention. The CLI's `--device` defaults to `cuda`. Nothing mentions
  MPS or Apple.
- **diffusers port:** `Kandinsky6TI2VAPipeline` is on diffusers main (merged
  2026-10-06) but not in the 0.41.0 release, where the import fails. Its code
  has no CUDA-only calls, so MPS might work. Not tried.
- **No MLX, no GGUF for Lite.** The community quantised builds (int8 ConvRot,
  OrbitQuant W4A4) target ComfyUI or CUDA. The "2.3 GB at 4-bit" claim in
  `research/models-2026-10.md` matches no build found.
- **Size:** `Lite-distill-5s-Diffusers` is 26.7 GB. The 3B transformer is
  6.4 GB. The text encoder (Qwen2.5-VL 7B, bf16) is 16.6 GB. Audio VAE and
  vocoder add 2.2 GB. In bf16 that all shares the Mac's 32 GB of memory.

## What was measured on the M2

| Check | Result |
|---|---|
| Homebrew Python 3.13.13, uv 0.10.8 | run |
| PyTorch 2.14.1 | not killed by ThreatLocker; MPS available; 2048² bf16 matmul 0.4 s |
| MLX 0.32.4 | runs on the GPU |
| Free disk | 36 GB of 460 GB: the 26.7 GB download would have left about 9 GB, under the 30 GB floor |

No weights were downloaded and no clip was made. The test environment
(`~/visualia-video/`) was deleted.

## If it comes back

Official figures for Lite Distill at 480p: 174 s per clip on an RTX 5060 Ti
16 GB and 68 s on an RTX 4090. A GeForce PC is the supported way to run it.
On a Mac it would need about 57 GB of free disk, the text encoder freed before
denoising, and probably tens of minutes per clip (an unmeasured guess). An MLX
port would change the picture. For classes, cloud video (`pruna/p-video`) is
the practical route.

Sources: [kandinskylab/kandinsky-6](https://github.com/kandinskylab/kandinsky-6),
[Lite distill weights](https://huggingface.co/kandinskylab/Kandinsky-6.0-Lite-distill-5s-Diffusers),
[paper 2610.05608](https://huggingface.co/papers/2610.05608),
[diffusers Kandinsky 6 docs](https://huggingface.co/docs/diffusers/main/en/api/pipelines/kandinsky6),
[kabachuha int8 ConvRot](https://huggingface.co/kabachuha/Kandinsky-6.0-Lite-distill-5s-int8-convrot),
[WaveCut W4A4](https://huggingface.co/WaveCut/Kandinsky-6.0-Lite-distill-5s-OrbitQuant-W4A4).
