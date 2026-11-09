# stylegan

NVIDIA's StyleGAN2-ADA in Rust with [Burn](https://burn.dev): a seed in, a
512 px picture of a wild animal out (foxes, wolves, lions, tigers, leopards).
Same route as `../upscale`: the ONNX file becomes Burn code at build time
(`build.rs`, `burn-onnx` 0.22.0), so nothing but this crate runs the model.
Background: `research/early-imagegen.md` (section 3). Not built or run yet.

| Model | Pickle | Size | Picture |
| --- | --- | --- | --- |
| AFHQ Wild, StyleGAN2-ADA | [afhqwild.pkl](https://nvlabs-fi-cdn.nvidia.com/stylegan2-ada-pytorch/pretrained/afhqwild.pkl) | 364 MB (363,959,591 bytes; G, D and G_ema) | 512 × 512 |

`afhqcat.pkl` and `afhqdog.pkl` (same folder, same size) export the same way
with `PKL=models/afhqcat.pkl`; build.rs and `src/lib.rs` name the wild one.
NVIDIA published no LSUN church or cat pickles for ADA (only FFHQ, MetFaces,
AFHQ, CIFAR-10, BreCaHAD).

## 1. Export (once, on a Mac that can run PyTorch)

```sh
cd apps/pool-app/stylegan && mkdir -p models
git clone https://github.com/NVlabs/stylegan2-ada-pytorch models/stylegan2-ada-pytorch
git -C models/stylegan2-ada-pytorch checkout d72cc7d041b42ec8e806021a205ed9349f87c6a4
curl -L -o models/afhqwild.pkl https://nvlabs-fi-cdn.nvidia.com/stylegan2-ada-pytorch/pretrained/afhqwild.pkl
uv run --python 3.11 --with torch==2.5.1 --with numpy==1.26.4 --with onnx==1.17.0 \
  --with click==8.1.7 --with requests==2.32.3 export.py
```

It writes `models/stylegan2_afhqwild.onnx` (expected around 120 MB: G_ema
only, fp32) and prints the ops in it. Input `z` 1×512, output `image`
1×3×512×512 in about -1..1. Truncation 0.7 is fixed in the export (change
`PSI` and export again). What the script changes and why is in its header; it
checks its replacements against NVIDIA's code before exporting.

## 2. Run

```sh
cargo run --release --example run -- 42            # seed-42.png
cargo run --release --example run -- 42 fox.png
```

The weights (`stylegan2_afhqwild.bpk`) are not built in. The example reads the
one this build made (in `target/.../build/stylegan-*/out/model/`), or
`STYLEGAN_DIR` if set. `Generator::generate(seed)` gives RGB bytes;
`noise(seed, 512)` is SplitMix64 + Box-Muller, the same on every machine.
Default features: `metal`, `codec`; also `wgpu`, `webgpu`, `cpu`.

## Licence

- Code and weights: [NVIDIA Source Code License-NC](https://nvlabs.github.io/stylegan2-ada-pytorch/license.html).
  Research and non-commercial use only. The pickle and anything exported from
  it (the .onnx, the .bpk) carry it too.
- Dataset: AFHQ (from StarGAN v2, Clova AI), CC BY-NC 4.0.
- Fine for a classroom; not for anything sold. This crate's own code is MIT.

## ONNX ops expected, and burn-onnx 0.22

From reading NVIDIA's code with the export's settings, not from a real export
(the script prints the real list). All are in burn-onnx 0.22.0's
[op list](https://github.com/tracel-ai/burn-onnx/blob/v0.22.0/SUPPORTED-ONNX-OPS.md).

| Op | Where | Note |
| --- | --- | --- |
| Gemm, MatMul, Add, Mul | mapping network (8 layers), the style for each layer | plain |
| LeakyRelu | every layer (slope 0.2, then × √2) | |
| ReduceMean, Sqrt, Div or Reciprocal | z normalised; demodulation (`rsqrt`) | |
| Pow or Mul, ReduceSum | demodulation: weight × style squared, summed over 3 axes | on a **5-D** tensor (1×out×in×k×k) |
| Unsqueeze, Tile, Reshape, Split / Squeeze or Gather, Slice | w copied per layer, then split per block and layer | |
| Conv | 3×3 and 1×1 with constant weights; 4×4 grouped (one per channel) blur filter | `fused_modconv=False` keeps every conv weight a constant |
| ConvTranspose | 3×3 stride 2 (upsampling convs); 4×4 grouped stride 2 (picture upsampling) | symmetric pads only |
| Pad | before the blur filter (1 px each side) | 4-D only, thanks to the replaced upfirdn2d |
| Clip | `conv_clamp=256` on every layer | |
| Constant, maybe Shape / Gather / Concat | folded shapes; the batch size is read from a shape | |

Risks, most likely first:

- **Nothing here has run.** The export uses 2021 code with torch 2.5.1 (CPU
  paths only, so the CUDA plugins are never built); a failure there shows up
  at the first run of export.py.
- **ConvTranspose pads:** burn-onnx 0.22 refuses asymmetric `pads`
  ("Asymmetric padding is not supported", `onnx-ir/src/node/conv_transpose2d.rs`).
  Both transposed convs should be symmetric (the 3×3 one has pads 0, the 4×4
  one 1); if one is not, build.rs fails with that message.
- **5-D tensors and leftover shape ops:** demodulation multiplies a 5-D tensor
  and reduces over 3 axes. Burn's tensors take any rank, but generated code for
  rank 5 is less tried. Shape → Gather → Concat → Reshape chains may survive
  constant folding; burn-onnx supports them, but each one is a place to look.
- **Speed and memory:** ~30M parameters (not checked), 512 px; the 5-D
  weight × style tensors are up to 512×512×3×3 floats per layer. Probably
  seconds per picture on an M1/M2 first run, faster after tuning. Not measured.
- **Batch size is fixed at 1** (the export traces z 1×512, no dynamic axes):
  several pictures at once need a new export.
