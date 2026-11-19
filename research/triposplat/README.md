# TripoSplat without Python at run time

A cut-out picture to Gaussian splats with VAST's TripoSplat (code and weights MIT,
github.com/VAST-AI-Research/TripoSplat), run in Node on WebGPU from our own fp16 ONNX
export. Numbers and findings: `research/local-multimodal.md` ("TripoSplat").

Python is needed once, to export (on the M1, beside a checkout of VAST's repo at
`d8db9e0` with its `ckpts/` from `VAST-AI/TripoSplat`):

| file | what |
| --- | --- |
| `bench.py` | times VAST's own pipeline on MPS (`python bench.py chair.png 4 20`) |
| `sdpa_pieces.py` | attention in 256 MB pieces on MPS: without it a 16 GB Mac crashes (one 9.7 GB buffer) |
| `refs.py` | one 4-step run on the chair, keeping each part's real inputs (`refs.pt`) |
| `export.py` | the five fp16 graphs (`onnx/`) and VAST's fp32 answers for them (`refs/`) |
| `export-all.sh` | `export.py` for several parts, traced on MPS |
| `refs_dit.py` | two more DiT answers: the zero-feature call and t = 500 |
| `fp32math.py` | fp16 weights, fp32 MatMul/Gemm/Softmax: `<part>32.onnx` for ONNX Runtime's WebGPU backend |

Node only after that (`onnxruntime-node` 1.31.1 and `pngjs`, from beside TripoSR's script):

| file | what |
| --- | --- |
| `check.mjs` | one graph against VAST's fp32 answer (`node check.mjs dit32 webgpu`) |
| `triposplat.mjs` | the whole run: `node triposplat.mjs prepared.png out.ply [steps] [seed]` |
| `prepare.mjs` | VAST's `preprocess_image`: a picture to the prepared 1024 px square (cut-out with `../triposr/rmbg.mjs`) |
| `splat.mjs` | the PLY to a 32-byte `.splat`, order kept (Morton, for a morph by index) |

`triposplat.mjs` takes VAST's prepared 1024 px picture (object on black); `prepare.mjs` makes one
(ported 2026-11-16, bilinear resizing instead of PIL's Lanczos). `START=refs/<x>.npz`
starts from given features and noise, `LATENT=refs/gs.npz` from a given latent, for
tests. The PLY has VAST's `save_ply` transform, but in Spark (three.js, y up) the chair and the costume figures
stand upside down, the front along +x: a half turn about x, then a quarter turn about y, stands them up facing +z
(`evals/estonian-visuals/out/drift-room/figures.html`, 2026-11-16).
