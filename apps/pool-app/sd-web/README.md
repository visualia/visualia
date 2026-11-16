# sd-web

ChilloutMix (a Stable Diffusion 1.5 fine-tune, 2023) drawing a 512 × 512
picture in a Chrome tab: ONNX Runtime Web 1.31.1 on WebGPU, three fp16 ONNX
files, a 20-step DPM++ 2M Karras sampler in JavaScript, guidance 7, negative
prompt "nsfw, nude, naked". Same shape of experiment as `../dalle-mini`.
Spike page: words are inline, not in a `text.json`. Background:
`research/early-imagegen.md` (section 1).

**It works** (2026-11-10, work Mac, M2 Pro, Chrome): the pictures look
right and look like ChilloutMix (a lighthouse on a rocky coast, an old
fisherman in a knitted sweater as a studio photo, Tallinn's roofs in snow).

| | Time |
| --- | --- |
| Load: download from a local server and open all three models | 4 to 11 s |
| A picture, models already open | 19.8 s |
| of which 20 UNet steps (batch 2) | 18.4 to 18.7 s, about 0.93 s a step |
| text encoder | 0.1 s |
| VAE decoder | 1.1 s |
| First picture in a new tab, load included | 24 to 28 s |

For comparison: sd-cli on the M2 drew SD-Turbo in 0.7 s for its one step
(`research/early-imagegen.md`); DALL·E mini in a tab was about 9 s.

## Run

1. **Export, once, on the M1** (PyTorch, CPU only; ThreatLocker blocks new
   programs on the work Mac). The weights are
   `~/visualia-build/sd-models/chilloutmix_NiPrunedFp16Fix.safetensors`
   (SHA-256 `59ffe224…`, the one on the pool's model list).

   ```sh
   mkdir -p ~/visualia-build/sd-web && cd ~/visualia-build/sd-web
   # copy export.py here, then one part per run (keeps memory down):
   for p in tokenizer text vae unet; do
     nice -n 20 uv run --python 3.11 --with torch==2.5.1 --with diffusers==0.31.0 \
       --with transformers==4.46.3 --with accelerate==1.1.1 --with safetensors==0.4.5 \
       --with huggingface_hub==0.26.2 --with onnx==1.17.0 --with onnxruntime==1.20.1 \
       --with numpy==1.26.4 export.py \
       ~/visualia-build/sd-models/chilloutmix_NiPrunedFp16Fix.safetensors $p
   done
   ```

   diffusers fetches the SD 1.5 configs and CLIP tokenizer from Hugging Face
   (`stable-diffusion-v1-5/stable-diffusion-v1-5`), not weights. Writes
   `models/` and a scratch `models/fp32/` (the fp32 text encoder and VAE,
   used only for the check; delete it after). Took about 1 min each for
   tokenizer, text and VAE and about 17 min for the UNet at `nice -n 20`
   while the M1 was busy as a pool worker.

   SHA-256 of the files used on 2026-11-10:

   ```
   b28a511b03de97708335a985f55ee12c9b2b302962b7924a30d4d9dc04f053d5  text_encoder.onnx
   b84003e955ddb6dd2544e71c64e21170e1b6db95152d41316245fe725aba4136  unet.onnx
   9aab8ce21431f1eb713454330baacf6f87713b9a0da4ee0cd57863805e7a20f0  vae_decoder.onnx
   ```

2. **Copy to the work Mac**, into `models/` here (gitignored):

   ```sh
   cd apps/pool-app/sd-web && mkdir -p models
   for f in text_encoder.onnx unet.onnx vae_decoder.onnx vocab.json merges.txt tokenizer_tests.json; do
     scp mbp:visualia-build/sd-web/models/$f models/
   done
   cp ../../../packages/style/visualia.css .
   node test-tokenizer.mjs        # "all match"
   ```

3. **Serve and open** (WebGPU needs `localhost` or https):

   ```sh
   python3 -m http.server 8011 --bind 127.0.0.1   # then http://localhost:8011/
   ```

   The first Draw downloads and opens all three models (2.07 GB) and keeps
   them; later Draws in the same tab reuse them. `http.server` lets Chrome
   cache `run.js`: after changing it, reload with Cmd+Shift+R.

## Files

| File | What it is |
| --- | --- |
| `export.py` | Loads the safetensors with diffusers `from_single_file`, exports text encoder, UNet and VAE decoder (opset 17, fixed shapes), checks the fp32 text encoder and VAE against PyTorch, writes the tokenizer files and test vectors. |
| `tokenizer.js` | CLIP BPE (49408 entries), 77 ids padded with `<|endoftext|>`. Matches all 6 vectors in `tokenizer_tests.json` (accents, a dash, a newline, a 100-word prompt cut to 77). |
| `test-tokenizer.mjs` | The check above, in Node. |
| `run.js` | Loads the three sessions once, runs text encoder, 20 UNet steps (batch 2: negative prompt, prompt) and VAE decoder. Noise schedule, Karras sigmas, time embedding and sampler in JS. |
| `index.html` | Text, seed, Draw, the picture, Save PNG, and the time per stage. |

## The three models

All take and return float32; weights and maths inside are float16 (keep
I/O types, as in Microsoft's `schmuell/sd-turbo-ort-web`). No fused
contrib ops (MultiHeadAttention, GroupNorm): plain MatMul, Softmax,
InstanceNormalization, which ORT Web's WebGPU kernels cover.

| File | Size | Inputs | Output |
| --- | --- | --- | --- |
| `text_encoder.onnx` | 246 MB | `input_ids` int32 [2, 77] | `last_hidden_state` [2, 77, 768] |
| `unet.onnx` | 1720 MB | `sample` [2, 4, 64, 64], `temb` [2, 320], `encoder_hidden_states` [2, 77, 768] | `noise` [2, 4, 64, 64] |
| `vae_decoder.onnx` | 99 MB | `latent` [1, 4, 64, 64], as the sampler leaves it | `image` [1, 3, 512, 512], RGB 0..1 |

Choices that matter:

- **`temb`, not the timestep.** The UNet's first step (sin and cos of
  t × 160 frequencies) is cut off; the page computes those 320 numbers in
  float64 and passes them in. In fp16, t = 999 has steps of 0.5, so the
  high frequencies would be noise. It also lets the sampler use fractional
  timesteps (k-diffusion `sigma_to_t`).
- **The UNet is traced in fp16**, giving one 1.7 GB file under protobuf's
  2 GiB limit, and no 3.4 GB fp32 copy. The first fp32 attempt failed
  inside torch 2.5's exporter with "The serialized model is larger than the
  2GiB limit", probably from the attention constants below (not retried
  with SDPA). The text
  encoder and VAE go fp32 then `convert_float_to_float16`.
- **SDPA attention (`AttnProcessor2_0`).** diffusers' older `AttnProcessor`
  calls `baddbmm` on an empty tensor, and the exporter folds that into a
  constant the size of the attention matrix: 536 MB per layer at 64 × 64
  in fp16.
- **VAE scale and range inside the graph**: divides by 0.18215, maps
  −1..1 to 0..1 and clamps.

## Sampler

DPM++ 2M with Karras sigmas (rho 7, from 14.61 down to 0.029, then 0),
k-diffusion `sample_dpmpp_2m`. SD 1.5's schedule: scaled-linear betas from
0.00085 to 0.012 over 1000 steps. Per step the UNet sees
`x / sqrt(sigma² + 1)` twice (negative prompt, prompt); noise =
`uncond + 7 × (cond − uncond)`; denoised = `x − sigma × noise`. Starting
noise is mulberry32 + Box-Muller, so a seed repeats a picture here but
never matches torch's or sd-cli's.

## Open

- **Speed.** 0.93 s a step is plain MatMul + Softmax attention over 4096
  positions, without fusion. To try: ORT's fused `MultiHeadAttention`
  (`onnxruntime.transformers.optimizer`, model type `unet`, only if the
  WebGPU kernels cover the fused ops), keeping the latent on the GPU with
  `preferredOutputLocation` and graph capture, fewer steps.
- **Caching.** Each new tab downloads 2.07 GB again (from the local
  server here; from R2 it would be the pool's 2 GB per tab). Cache API or
  OPFS, as for DALL·E mini.
- **Memory.** Not measured. The three sessions stay open (about 2 GB of
  GPU buffers plus the attention scratch); a Mac with 8 GB may not manage.
- **Checked only by eye.** The fp32 text encoder and VAE match PyTorch
  (max difference 3e-5 and 1.4e-5); the fp16 UNet only by the pictures and
  by its noise prediction tracking its input at t = 999 (correlation
  0.9998). No side-by-side with sd-cli for the same seed (the noise
  differs anyway).
- **Not in a pool tab yet.** This page is standalone, like `../dalle-mini`.
- Words inline, no `text.json`; the prompt box has no length warning past
  75 tokens (cut silently, as CLIP does).
