---
status: building
---

# Early image generation: the old models, run without PyTorch

The image models from before today's diffusion ones, for the course: how
picture AI looked and failed in 2018–2022, side by side with what we use now.
Each runs without Python or PyTorch while drawing. PyTorch runs once, on the
M1, to export a model to ONNX; Burn or ONNX Runtime Web runs it after that.
Background and the other candidates: `research/early-imagegen.md`.

## Running (2026-11-09)

| Model | Year | Code | Runs on | Warm | Input |
|---|---|---|---|---|---|
| BigGAN-deep-256 | 2018 | `apps/pool-app/biggan` | Burn, Metal (M1) | 0.07 s, 256 px | ImageNet class + seed |
| StyleGAN2-ADA, AFHQ wild | 2020 | `apps/pool-app/stylegan` | Burn, Metal (M1) | 0.13 s, 512 px | seed |
| DALL·E mini (min-dalle) | 2022 | `apps/pool-app/dalle-mini` | ONNX Runtime Web, WebGPU (Chrome) | about 9 s, 256 px | text |

Export fixes worth remembering: BigGAN's spectral norm baked into the weights
(burn-onnx fails on its rank-0 matmul); StyleGAN's linear layers patched on
each loaded layer to `F.linear` (a `[1, n]` bias Burn won't load; NVIDIA's
pickles carry their own copy of the classes). Licences: BigGAN port MIT
(weights Apache-2.0, not verified); StyleGAN2-ADA weights NVIDIA
non-commercial; min-dalle Apache-2.0.

## Next, in order

1. **Estonian harness** (`plans/estonian-visuals.md`): DALL·E mini as one of
   the generators beside the cloud models, judged by Clef-flash.
2. **An "Early AI" page in the studio:** DALL·E mini in the tab as it runs
   now; BigGAN and StyleGAN in the tab as WebAssembly (the upscaler's route,
   built on the M1, since ThreatLocker kills builds on the work Mac). The
   model files (220–1060 MB) from R2 or Hugging Face, cached in the browser.
3. **Pool jobs** `image-biggan`, `image-stylegan` in the app and the CLI,
   like the upscalers (weights from the pool, checked by SHA-256). Needs an
   app release, so a build on the M1 and the update key there, or
   ThreatLocker letting builds run on the work Mac again.

## Open

- Where the update key may live: the work Mac only so far
  (`plans/worker-app.md`); building releases on the M1 means copying it.
- DeepDream and VQGAN+CLIP need gradients: a Burn autodiff spike.
- Whether StyleGAN's non-commercial licence is fine for the course page.
