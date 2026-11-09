# BigGAN in Burn

BigGAN-deep-256 (DeepMind, 2018): pick one of the 1000 ImageNet classes and a
seed, get a 256×256 picture in one pass. Early image generation for the course
(`research/early-imagegen.md`), run without Python, like the upscaler.

1. **Once, on a Mac that can run PyTorch** (the M1; ThreatLocker blocks new
   programs on the work Mac): `export.py` (the command is in its header)
   downloads the PyTorch port's weights (huggingface/pytorch-pretrained-BigGAN,
   MIT) and writes `models/biggan_deep_256.onnx`.
2. `cargo run --release --example draw -- 207 1 out.png` (207 is "golden
   retriever"). build.rs makes the Burn code and weights from the ONNX file.

The truncation is fixed at 0.4 in the export: lower is tidier and less varied.
Weights licence: the PyTorch port is MIT; DeepMind's TF Hub weights are listed
as Apache-2.0 (not verified, `research/early-imagegen.md`).
