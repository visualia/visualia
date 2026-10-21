---
status: building
---

# Local images: what the M1 can draw

How fast, how costly and how good the newest open image models are on the M1
(M1 Pro, 16 GB, ~12 GB usable by the GPU). Measuring only: no studio or
gateway feature yet. Code: `apps/m1-worker/images/`.

## What runs where (checked 2026-10-21)

- **Ollama can't do images any more.** It added FLUX.2 [klein] and
  Z-Image-Turbo in January 2026, then removed image generation in 0.32.6
  ("temporarily removed, continue using 0.32.5"). On the M1's 0.40.5,
  `ollama pull x/flux2-klein` still downloads 5.7 GB, but running it returns
  `image generation models are not currently supported`. Pulled, tested and
  removed again.
- **mflux** (MLX port, MIT, 0.23.0) is the runtime: FLUX.2 [klein], Z-Image,
  ERNIE-Image, Qwen-Image 2.1, FLUX 3 Image Klein and more. Pre-quantized
  weights come from `mflux-community` on Hugging Face, with no account needed.
  diffusers on MPS wasn't needed.

## Models

Picked for fitting in 16 GB and for licence. A school can use Apache 2.0
freely; it can't use the non-commercial ones for anything sold or for clients.

| Model | Licence | Tested | Why |
|---|---|---|---|
| FLUX.2 [klein] 4B (BFL, Jan 2026) | Apache 2.0 | 8-bit, 8.6 GB | smallest current model; 4 steps |
| Z-Image-Turbo (Alibaba Tongyi, Nov 2025) | Apache 2.0 | 6-bit, 8.4 GB | strong at text and photos; 9 steps |
| ERNIE-Image-Turbo (Baidu) | Apache 2.0 | 4-bit, 6.6 GB | newer Apache model, claims good text; 8 steps |
| FLUX.2 [klein] 9B | **non-commercial** | 4-bit, 9.5 GB | the bigger klein, as a quality reference |

Left out: Qwen-Image 2.1 Turbo (9 Oct 2026; Qwen research licence, 10 GB at
4-bit), FLUX 3 Image Klein (13 Oct 2026; FLUX Kommunity licence, gated), Ideogram 4
(non-commercial), Krea 2 (community licence, 16 GB at 4-bit). Not tested:
SDXL-Turbo / SD 3.5 as an old baseline, since the newer Apache models replace them.

## Install

On the M1, in `~/visualia-worker/images/`, apart from the text worker: a
Python 3.14 venv made with `uv`, with `mflux==0.23.0`, `mlx==0.32.4` and
`pillow==12.3.0` (Pillow 13.0.0 breaks mflux's import), all pinned in
`requirements.lock.txt`. Weights go in `hf/` (31 GB for the four). See
`apps/m1-worker/images/README.md`.

## How it was measured

`bench.mjs` runs one model at a time, only after `ollama ps` is empty, no other
benchmark is running, and the GPU has been idle for 15 s. That quiet window
gives the idle baseline. `gen.py` loads the model once and keeps it loaded, the
way a worker would. It then makes one cold 512² image, three prompts at 512²
and three at 1024² (seed 42, each model's recommended step count, float16
compute on the FLUX.2 and Z-Image models, M1's fast path). The three prompts
are a poster headlined "Kevadnäitus 2027", a misty Estonian bog boardwalk at
dawn, and a red-and-white folk pattern. Energy is measured the same way as
`proxy.mjs`: chip = CPU + GPU + memory from macmon, net = minus idle.

## Results

Warm averages over the three prompts. J and Wh are net chip energy per image.

| Model | Licence | Size | s/image 512² | s/image 1024² | J/image 512² | J/image 1024² | Wh 1024² | Quality |
|---|---|---|---|---|---|---|---|---|
| FLUX.2 klein 4B q8 | Apache 2.0 | 8.6 GB | **12.7** | **41.8** | **348** | **1,157** | **0.32** | good photo and pattern; "Kevadnäitus" right at 512², wrong ä and stray fake small print at 1024² |
| Z-Image-Turbo q6 | Apache 2.0 | 8.4 GB | 34.9 | 144 | 965 | 3,714 | 1.03 | best overall: Estonian text right at both sizes, best poster layout, very good photo |
| ERNIE-Image-Turbo q4 | Apache 2.0 | 6.6 GB | 45.9 | 216 | 1,322 | 5,648 | 1.57 | nice photo and knit texture; ä comes out as â/ă, invents gibberish lines |
| FLUX.2 klein 9B q4 | non-commercial | 9.5 GB | 26.8 | 85.0 | 723 | 2,258 | 0.63 | text right at both sizes, best photo and pattern; posters plain |

- **Cold start is small.** Load plus first image: klein 4B 15 s, klein 9B 29 s,
  Z-Image 51 s, ERNIE 51 s. MLX loads lazily, so the first image costs about the
  same as a warm one. These runs read weights from a warm disk cache; after a
  reboot, add the time to read 7–10 GB from SSD.
- **Memory:** MLX's own peak was 10.4 GB (klein 4B), 11.0 (Z-Image), 11.4
  (klein 9B) and 16.7 (ERNIE at 1024², spilling past the GPU limit). The machine
  as a whole peaked at 15–15.2 GB of 16 GB.
- **Whole machine** (screen, SSD, everything) is about twice the chip number:
  klein 4B 1024² is 2,186 J (0.61 Wh), about 52 W while it draws.
- **Memory lesson:** a resident model must cap MLX's buffer cache. Without a
  cap, klein 4B reached 17.6 GB at 1024², swapped 4.8 GB and slowed to 57
  s/image. With a 1 GB cap, tiled VAE decoding and a cache clear after each
  image, it ran at 42 s with no swap. Tiled decoding leaves a faint seam on flat
  backgrounds (seen on the posters); larger tiles are the thing to try.
- Images: kept on the M1 in `~/visualia-worker/images/out/`, never in git.

## Cloud comparison (Workers AI, documented prices, not called)

| Model on Workers AI | 512² | 1024² |
|---|---|---|
| `@cf/black-forest-labs/flux-2-klein-4b` ($0.000287 per output 512² tile) | $0.0003 | $0.0011 |
| `@cf/black-forest-labs/flux-1-schnell` ($0.0000528 per tile + $0.0001056 per step, 4 steps) | $0.0005 | $0.0006 |
| `@cf/black-forest-labs/flux-2-klein-9b` ($0.015 first megapixel) | – | $0.015 |
| `black-forest-labs/flux-3-image-klein` (third-party, $0.009 first megapixel) | – | $0.009 |

On the M1, a klein 4B 1024² image uses about 0.61 Wh for the whole machine:
roughly €0.0001 at 20 c/kWh, about a tenth of the cloud price. It also takes
42 s; the cloud should take a few seconds (not measured here). The same model
runs in both places, so a class could switch between them without the pictures
changing much.

## What it means for students' own Macs

- A 16 GB Apple Silicon Mac can make images locally with Apache-licensed
  models: about 13 s for a 512² sketch and 40 s–2.5 min for a 1024² image,
  depending on the model. That's fine for "make one, look, change the prompt";
  it's slow for making many variations.
- Choose by job. **klein 4B** for speed and drafts. **Z-Image-Turbo** when the
  image has to carry Estonian text (posters), at about 3.5× the time.
- 8 GB Macs weren't tested. Only the 4-bit klein 4B (4.6 GB) is a candidate
  there, and it would be tight.
- Newer chips (M3/M4) have faster bf16 and more GPU; they should be quicker,
  but nothing here measured that.
- No app needed beyond `uv tool install mflux`. A friendlier route for
  students is a GUI such as Draw Things, which isn't evaluated here.

## Next

An `m1-1/` image route: the proxy gets an images endpoint that keeps one model
resident (klein 4B q8, or Z-Image for text) with the memory caps above, and the
gateway records each image in `usage` with the measured energy, like text calls.
Not built. Before that, settle how the image route and the text models share the
M1's 16 GB (one at a time, with unloading).

Sources: [Ollama 0.32.6 release notes](https://github.com/ollama/ollama/releases/tag/v0.32.6),
[mflux](https://github.com/mflux-community/mflux) / [PyPI](https://pypi.org/project/mflux/),
model cards on Hugging Face (licences read from their metadata),
[Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).
