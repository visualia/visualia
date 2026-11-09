# upscale

Real-ESRGAN 4× upscaling in Rust with [Burn](https://burn.dev): the ONNX
models become Burn code at build time (`build.rs`, `burn-onnx`), so no Python,
ONNX runtime or extra program runs a model. Spike for the pool's upscale job;
results in `plans/local-images.md` ("Upscaling").

| Name here | Model | Size | Licence |
| --- | --- | --- | --- |
| `fast` | Real-ESRGAN-General-x4v3 (SRVGGNetCompact) | 4.9 MB | BSD-3 |
| `quality` | Real-ESRGAN-x4plus (RRDBNet) | 67 MB | BSD-3 |

## Fetch the models (not in git)

Qualcomm AI Hub's float ONNX exports, release v0.66.0 (input 1×3×128×128 in
0..1, but any size works):

```sh
cd apps/pool-app/upscale && mkdir -p models && cd models
for m in real_esrgan_general_x4v3 real_esrgan_x4plus; do
  curl -sLO "https://qaihub-public-assets.s3.us-west-2.amazonaws.com/qai-hub-models/models/$m/releases/v0.66.0/$m-onnx-float.zip"
  unzip -oq $m-onnx-float.zip -d $m
done
shasum -a 256 *.zip
# fc094329…c7cf  real_esrgan_general_x4v3-onnx-float.zip
# 05aa3132…4ca4  real_esrgan_x4plus-onnx-float.zip
```

## Run

```sh
cargo run --release --example run -- fast in.png out.png 112
cargo run --release --example run -- quality in.png out.png 112
```

The last number is the tile size (112 + 2 × 8 px padding = 128 px, the
fastest measured). Default features: `metal`; also `wgpu`, `webgpu`, `cpu`.
