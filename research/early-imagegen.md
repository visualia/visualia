# Early image generators without PyTorch (checked 2026-11-09)

The question: which "early" image generators (GANs from 2017 to 2021 and the
first diffusion models) can run here **without PyTorch at runtime**, as a plain
forward pass? The target is the stack we already use for upscaling
(`plans/local-images.md`, "Upscaling"): an ONNX file imported into **Burn
0.22.1** at build time (`burn-onnx` 0.22.0), run on Metal natively and on
WebGPU or WebAssembly in a tab. Other non-Python runtimes (C++, TensorFlow.js,
onnxruntime-web) are noted where they exist.

**How this was checked:** Hugging Face API listings (file names and byte
sizes), GitHub READMEs, the burn-onnx source (cloned at `77c18b6`,
2026-11-09) and web search. Nothing new was run for this note; the SD-Turbo
timing is from `plans/estonian-visuals.md`. Anything not confirmed from a
source is marked "not verified". Opset numbers were not read from the files.

## Short answer

- **SD-Turbo and SD 1.5 already run here** through stable-diffusion.cpp on
  the M2 (SD-Turbo: 0.7 s to draw, 6 s in all). Ready ONNX exports exist for
  both, and SD-Turbo runs in a tab with onnxruntime-web today.
- **BigGAN is the easiest new one.** Class label in, one forward pass, 56M
  parameters, about 225 MB, plain ops (conv, batch norm, one self-attention
  block). No ONNX on Hugging Face, but a one-time export from the MIT PyTorch
  port is short.
- **StyleGAN2 / 2-ADA works in browsers already** (onnxruntime-web demos), and
  the ops it exports to are all in burn-onnx's list, including conv with a
  runtime weight. The catch is the licence: NVIDIA's weights are
  **non-commercial**, and FFHQ faces are CC BY-NC-SA.
- **StyleGAN3 is harder:** its export stumbles on `affine_grid` and the
  filtered leaky ReLU. burn-onnx has `GridSample`, so it may work, unchecked.
- **DALL·E mini has a ready ONNX export** (min-dalle, Apache-2.0, three files,
  1.06 GB). It is autoregressive: 256 decoder steps with a KV cache, so it is
  a loop of forward passes, not one. More work than BigGAN, but text in.
- **DeepDream and VQGAN+CLIP need gradients.** Burn's autodiff backend can in
  principle run an imported model backwards (burn-onnx says imported models
  are trainable). Not tried.

## 1. Stable Diffusion 1.5 and SD-Turbo

- **stable-diffusion.cpp** lists "SD1.x, SD2.x, SD-Turbo" as supported
  ([README](https://github.com/leejet/stable-diffusion.cpp), local copy
  `~/visualia-local/stable-diffusion.cpp/docs/sd.md`, which names
  `v1-5-pruned-emaonly.safetensors`). It is built on the M2 (`build/bin/sd-cli`,
  `sd-server`), and `~/visualia-local/models/sd_turbo.safetensors` (5.2 GB) is
  there. Measured: SD-Turbo 1 step, 512², 0.7 s drawing, 6 s in all, 3.7 GB
  (`plans/estonian-visuals.md`).
- **ONNX, SD-Turbo** (all fp16, sizes from the HF API):
  [onnxruntime/sd-turbo](https://huggingface.co/onnxruntime/sd-turbo):
  `unet/model.onnx` 1.73 GB, `text_encoder/model.onnx` 681 MB,
  `vae_decoder/model.onnx` 99 MB, `vae_encoder` 68 MB.
  [schmuell/sd-turbo-ort-web](https://huggingface.co/schmuell/sd-turbo-ort-web)
  is the same with "ort-web friendly changes"; it is what Microsoft's
  [ORT Web WebGPU example](https://github.com/microsoft/onnxruntime-inference-examples/tree/main/js/sd-turbo)
  loads. [microsoft/sd-turbo-webnn](https://huggingface.co/microsoft/sd-turbo-webnn)
  has static shapes for WebNN. Already covered in `research/browser-models.md`
  (2.6 GB, under 1 s on an RTX 4090, no laptop figures).
- **ONNX, SD 1.5:**
  [onnx-community/stable-diffusion-v1-5-ONNX](https://huggingface.co/onnx-community/stable-diffusion-v1-5-ONNX)
  (fp32: UNet 3.44 GB as `unet/weights.pb` + graph, text encoder 493 MB, VAE
  decoder 198 MB). Several fp16 copies exist (for example
  [sharpbai/stable-diffusion-v1-5-onnx-directml-fp16](https://huggingface.co/sharpbai/stable-diffusion-v1-5-onnx-directml-fp16)).
- **Other runtimes:** [Gadersd/stable-diffusion-burn](https://github.com/Gadersd/stable-diffusion-burn)
  (SD 1.4 hand-ported to an old Burn, MIT, last push 2024-10, "WGPU backend
  unstable"); [candle](https://github.com/huggingface/candle/tree/main/candle-examples/examples/stable-diffusion)
  (Rust: v1.5, v2.1, XL, Turbo; Metal not mentioned in that README);
  [mlc-ai/web-stable-diffusion](https://github.com/mlc-ai/web-stable-diffusion)
  (SD 1.5 in a tab via TVM and WebGPU, Apache-2.0, last push 2024-03).
- **Licences:** SD 1.5 is CreativeML OpenRAIL-M. SD-Turbo is the Stability AI
  Community licence, commercial use allowed under its terms
  ([model card](https://huggingface.co/stabilityai/sd-turbo)); the ONNX copies
  are tagged "other".
- **burn-onnx:** UNet attention, GroupNorm, Resize and the CLIP text encoder
  are all in the [op list](https://github.com/tracel-ai/burn-onnx/blob/main/SUPPORTED-ONNX-OPS.md)
  (Attention, GroupNormalization, LayerNormalization, Resize, Gather, Einsum,
  Gelu, Erf). We would still write the tokenizer and the 1 to 4 step
  scheduler. The 1.7 GB UNet as generated Rust is untried.

## 2. BigGAN (DeepMind, 2018)

- **Input:** a class label (one of 1000 ImageNet classes, one-hot), a 128-dim
  noise vector `z` and a truncation value. One forward pass, no text.
- **Originals:** TensorFlow 1 Hub modules `deepmind/biggan-deep-128/256/512`
  and `biggan-128/256/512`
  ([TF Hub tutorial](https://www.tensorflow.org/hub/tutorials/biggan_generation_with_tf_hub));
  tfhub.dev now redirects to Kaggle Models.
- **PyTorch port:** [huggingface/pytorch-pretrained-BigGAN](https://github.com/huggingface/pytorch-pretrained-BigGAN)
  (MIT, "variance of the output difference of the order of 1e-5"):
  BigGAN-deep-128 50.4M params / 201 MB, -256 55.9M / 224 MB,
  -512 56.2M / 225 MB. Mirror on HF:
  [osanseviero/BigGAN-deep-128](https://huggingface.co/osanseviero/BigGAN-deep-128)
  (`pytorch_model.bin`, 211 MB).
- **ONNX:** none found on Hugging Face (search "biggan", 2026-11-09) or on
  GitHub. **Export is easy:** the model is a `torch.nn.Module` of linear,
  conv, conditional batch norm (multiply and add), nearest upsample and one
  self-attention block (matmul + softmax). The batch-norm statistics are
  picked per truncation value from a table of 51; exporting with a fixed
  truncation (or as an input index into a Gather) keeps the graph static.
  All of these are in burn-onnx's list. About 20 lines of Python, once.
- **Browser:** [josephrocca/tfjs-gans](https://github.com/josephrocca/tfjs-gans)
  shows how to convert BigGAN from TF Hub to TensorFlow.js; no hosted BigGAN
  model there (not verified that its demo includes BigGAN).
- **Licence:** code MIT; DeepMind's weights were published on TF Hub, whose
  default is Apache-2.0. Not verified on the Kaggle page (it returned 404).

## 3. StyleGAN2, StyleGAN2-ADA, StyleGAN3 (NVIDIA, 2019 to 2021)

- **Input:** a 512-dim latent only (no text). The mapping network turns `z`
  into `w`; the synthesis network draws. Class-conditional only for some
  ADA models (CIFAR-10). Models: FFHQ faces (1024), AFHQ cats, dogs, wild
  (512), LSUN churches, cars, horses, cats (256), MetFaces.
- **Ready ONNX:** none on Hugging Face (search "stylegan2", "stylegan3").
  [Goblaski/stylegan2-web-convert](https://github.com/Goblaski/stylegan2-web-convert)
  is a script that exports any stylegan2-ada-pytorch pickle to three ONNX
  files (full, mapping, synthesis), **opset 10**, fp32, and runs them with
  onnxruntime in a page ([blog](https://www.guidodejong.nl/hack/running-stylegan2-ada-in-browser/):
  "slow on CPU", tens to hundreds of MB). No licence on the repo.
  [cyrildiagne/mobilestylegan-web-demo](https://github.com/cyrildiagne/mobilestylegan-web-demo)
  runs [MobileStyleGAN](https://github.com/bes-dev/MobileStyleGAN.pytorch)
  (a distilled FFHQ 1024 generator; repo Apache-2.0, its README has
  `--export-model onnx` and CoreML) with onnxruntime-web 1.10 on WebAssembly.
  [jqhisme/In-Browser-StyleGAN-Editing](https://github.com/jqhisme/In-Browser-StyleGAN-Editing)
  does latent editing in a tab with ONNX Runtime.
- **Custom ops:** upfirdn2d, fused bias-act and modulated conv are CUDA
  plugins in NVIDIA's code, but each has a plain-PyTorch reference path that
  the exporter uses on CPU. They become Pad, Reshape, Conv / ConvTranspose
  **with a weight computed at runtime** (the style modulates it), grouped by
  batch. burn-onnx handles this: when the weight is not a constant, Conv2d
  and ConvTranspose2d fall back to the functional op, grouping included
  (`crates/burn-onnx/src/import/burn/node/conv2d.rs`, "A runtime weight has
  no module to live in, so the functional op takes it"; test
  `test_conv2d_runtime_weight`). Opset 10 is in range (1 to 24). Not tried.
- **StyleGAN3:** export fails on `affine_grid_generator` and `lerp` per the
  [converter README](https://github.com/Goblaski/stylegan2-web-convert) and
  [NVlabs/stylegan3#57](https://github.com/NVlabs/stylegan3/issues/57);
  `filtered_lrelu` also has a reference path. A
  [StyleGAN3 to ONNX notebook](https://gist.github.com/josephrocca/b8fc780ac8e04408b69cce361a16a4f3)
  exists (did not render; contents not verified). burn-onnx supports
  GridSample, so a decomposed export may import. Medium to high effort.
- **Licence:** [Nvidia Source Code License-NC](https://nvlabs.github.io/stylegan2-ada-pytorch/license.html)
  for code and pretrained networks: research and non-commercial use only.
  FFHQ images are CC BY-NC-SA 4.0 ([ffhq-dataset](https://github.com/NVlabs/ffhq-dataset)).
  Fine for a classroom demo, not for anything sold.

## 4. DALL·E mini / Craiyon (2021 to 2022)

- **Original:** JAX/Flax, [dalle-mini/dalle-mini](https://huggingface.co/dalle-mini/dalle-mini)
  (`flax_model.msgpack` 1.75 GB, Apache-2.0), `dalle-mega` larger, plus the
  [VQGAN decoder](https://huggingface.co/dalle-mini/vqgan_imagenet_f16_16384)
  (Flax, 304 MB). Code: [borisdayma/dalle-mini](https://github.com/borisdayma/dalle-mini) (Apache-2.0).
- **min-dalle:** [kuprel/min-dalle](https://github.com/kuprel/min-dalle)
  (MIT, PyTorch, inference only).
- **Ready ONNX:** [StuartGray/min-dalle-onnx](https://huggingface.co/StuartGray/min-dalle-onnx)
  (Apache-2.0, 2026-10-12): `encoder_fp16.onnx` 405 MB, `decoder_step_fp16.onnx`
  471 MB, `detokenizer_fp32.onnx` 187 MB, BPE `vocab.json` + `merges.txt`, and
  a `manifest.json` giving the I/O: 64 text tokens in; decoder called once per
  image token (256 steps) with 12 per-layer caches; VQGAN detokenizer turns 256
  tokens into a 256×256 image. It is the mini model (12 layers, 1024 wide).
- **Input:** English text. Output 256×256, recognisably 2022 quality.
- **burn-onnx:** BART-style encoder and decoder (Gather, LayerNorm, MatMul,
  Softmax) and a conv decoder; all in the list. We would write the BPE
  tokenizer, the 256-step loop with cache hand-off, and top-k sampling (TopK,
  Multinomial are supported, or do it in Rust). Mixed fp16/fp32 graphs not
  tried in Burn.
- **Craiyon:** the later Craiyon models are not released (not verified
  beyond no weights found on HF).

## 5. Others, briefly

| Model | Input | Non-PyTorch route | Note |
|---|---|---|---|
| DCGAN (2015) | latent | TF.js demos ([ganshowcase](https://alantian.github.io/ganshowcase/)) | tiny, trained per dataset; no shared weights worth using |
| ProGAN (2017) | latent | TF Hub `progan-128`, convertible to TF.js ([tfjs-gans](https://github.com/josephrocca/tfjs-gans)) | CelebA faces only (not verified on Kaggle) |
| pix2pix (2017) | image (sketch, labels) | ran in a tab in 2017 with deeplearn.js ([edges2cats](https://github.com/tensorflow/tfjs/issues/79)) | U-Net, plain convs; trivial ONNX export from [junyanz](https://github.com/junyanz/pytorch-CycleGAN-and-pix2pix) (BSD) |
| CycleGAN (2017) | image | Keras weights [keras-io/CycleGAN](https://huggingface.co/keras-io/CycleGAN) (CC0, 46 MB, horse to zebra) | ResNet + InstanceNorm, both in burn-onnx |
| GauGAN / SPADE (2019) | segmentation map | TF.js shards [salim4n/gaugan-tfjs](https://huggingface.co/salim4n/gaugan-tfjs) (20 × 15 MB, no licence) | NVIDIA weights are non-commercial ([NVlabs/SPADE](https://github.com/NVlabs/SPADE)) |
| LDM-400M text2im (2021) | text | none found; [CompVis/ldm-text2im-large-256](https://huggingface.co/CompVis/ldm-text2im-large-256) is PyTorch (Apache-2.0, BERT 2.3 GB + UNet 3.5 GB + VQ-VAE 335 MB fp32) | superseded by SD 1.5 for us |
| Karlo (unCLIP, 2022) | text | none found; [kakaobrain/karlo-v1-alpha](https://huggingface.co/kakaobrain/karlo-v1-alpha) diffusers only (OpenRAIL-M) | four diffusion stages, ~13 GB; not worth it |
| VQGAN decoder alone (2020) | codebook tokens | Flax ([vqgan-jax](https://github.com/patil-suraj/vqgan-jax)); ONNX as min-dalle's detokenizer (above) | decodes tokens, does not generate by itself |

## Gradient-based: DeepDream and VQGAN+CLIP

- **Both need autodiff.** DeepDream adds the gradient of a layer's activation
  to the image, step after step ([TF tutorial](https://www.tensorflow.org/tutorials/generative/deepdream)).
  VQGAN+CLIP optimises the VQGAN latent so that CLIP's image embedding moves
  towards the text embedding, a few hundred steps of decoder + CLIP + backward.
- **Non-PyTorch:** DeepDream exists in TensorFlow 2 (the tutorial, Python).
  TensorFlow.js has `tf.grad`, so a tab version is possible; no maintained
  TF.js DeepDream found (not verified). VQGAN in JAX
  ([vqgan-jax](https://github.com/patil-suraj/vqgan-jax)) plus CLIP in JAX
  make a JAX VQGAN+CLIP possible; no ready one found.
- **Burn:** wrapping a backend in `Autodiff<...>` gives `backward()` and
  `grad()` on any tensor marked `require_grad()`
  ([Burn book, autodiff](https://burn.dev/books/burn/building-blocks/autodiff.html)),
  and burn-onnx says an imported model "is a regular Burn Module, so you can
  fine-tune it" ([README](https://github.com/tracel-ai/burn-onnx)). So an
  imported CLIP image encoder (ONNX ready:
  [Xenova/clip-vit-base-patch32](https://huggingface.co/Xenova/clip-vit-base-patch32)
  `onnx/vision_model.onnx` 352 MB, fp16 176 MB, MIT) plus an imported VQGAN
  decoder, with the latent as the tensor that needs a gradient, is plausible.
  Untested: whether every generated op has a backward on wgpu, memory in a
  tab, and speed. DeepDream with an imported Inception or ResNet is the
  smaller first test.

## Ranked

| # | Model | Input | Runtime without PyTorch | ONNX ready? | Licence | Size | Effort here | Why |
|---|---|---|---|---|---|---|---|---|
| 1 | SD-Turbo | text | sd.cpp (Metal, done); ORT Web (WebGPU, demo) | yes, fp16 | Stability Community | 2.6 GB | low (sd.cpp) / medium (Burn) | already measured; Burn needs tokenizer + scheduler |
| 2 | BigGAN-deep-256 | class label + noise | TF Hub (TF1), TF.js by conversion | no, easy export | MIT code; weights Apache-2.0 (not verified) | 224 MB | low | one pass, plain ops, small; 1000 classes to play with |
| 3 | StyleGAN2-ADA (AFHQ, FFHQ, churches) | latent | ORT Web demos (WASM) | script, opset 10 | NVIDIA NC | 100 to 400 MB (not verified) | low to medium | ops all import, runtime-weight conv supported; non-commercial |
| 4 | SD 1.5 | text | sd.cpp (Metal), web-stable-diffusion (WebGPU) | yes, fp32 and fp16 | OpenRAIL-M | 4 to 5 GB fp32 | low (sd.cpp) / medium (Burn) | 20+ steps, slower than Turbo; the classic look |
| 5 | DALL·E mini (min-dalle) | text | ORT (any) | yes, fp16 + fp32 | Apache-2.0 | 1.06 GB | medium | 256-step loop with KV cache, BPE tokenizer to write |
| 6 | pix2pix / CycleGAN | image | deeplearn.js (2017), Keras | no, trivial export | BSD / CC0 | 50 MB | low | image-to-image, not text; good for sketch exercises |
| 7 | DeepDream | image | TF Python; Burn autodiff (untried) | backbone yes | varies | 50 to 100 MB | medium | needs backward through an imported model |
| 8 | StyleGAN3 | latent | none known working | no, export fails | NVIDIA NC | ~ StyleGAN2 | high | affine_grid, filtered_lrelu |
| 9 | VQGAN+CLIP | text | none ready | parts yes | MIT / MIT | ~0.7 GB | high | hundreds of backward passes; memory in a tab |
| 10 | LDM-400M, Karlo | text | none | no | Apache / OpenRAIL-M | 6 to 13 GB | high | big, superseded by SD |

## Order to try

1. **BigGAN-deep-256** into Burn: export once, import like Real-ESRGAN, class
   picker in a page. Smallest step with a fresh "early AI" result.
2. **StyleGAN2-ADA** with the Goblaski script (AFHQ cats or LSUN churches),
   then burn-onnx; it tests runtime-weight conv. Classroom use only (NC).
3. **SD-Turbo stays on sd.cpp** for now; the Burn port is the bigger job
   already listed in `plans/estonian-visuals.md`.
4. **min-dalle ONNX** if a text-in "2022" look is wanted: the files are ready,
   the loop and tokenizer are ours.
5. **DeepDream on Burn autodiff** as the probe for whether VQGAN+CLIP is
   feasible at all.
