# TripoSR in Node, no Python (measured on the M1, 2026-11-14)

A photo of one object to a closed, coloured 3D mesh (GLB), run entirely in Node 24 with `onnxruntime-node` 1.31.1,
`pngjs` and `isosurface`'s marching-cubes tables. Model: the community ONNX export
[brodatech/triposr-onnx](https://huggingface.co/brodatech/triposr-onnx) of TripoSR (MIT,
[VAST-AI-Research/TripoSR](https://github.com/VAST-AI-Research/TripoSR)). Script: `research/triposr/triposr.mjs`,
renders in `research/triposr/renders/`, all numbers in `research/triposr/results.md`. MEASURED on the teacher's M1
(16 GB, macOS 26.6.2), three of TripoSR's own example pictures, which already have their background removed.

## Numbers (seconds, warm)

| backends (picture, then grid) and grid | total | memory |
|---|---|---|
| CPU and CPU, 128 | 10.2 | 3.2 GB |
| CPU and CPU, 256 | 17.1 | 3.2 GB |
| WebGPU and CPU, 128 | 5.5 to 5.7 | 1.9 GB, 5.8 GB footprint |
| **WebGPU and WebGPU, 256** | **9.35** | 2.1 GB, 5.8 GB footprint |

The picture step is 7.8 s on CPU and 2.8 s on WebGPU; the first WebGPU run adds 3.6 s compiling shaders. WebGPU gives
the same shape as CPU to the fourth digit. CoreML failed for the picture step (killed at a 53 GB footprint) and was
2.5 times slower for the grid.

Meshes at grid 256: chair 83,492 triangles (2.2 MB GLB), flamingo 46,136 (1.2 MB), hamburger 110,612 (2.9 MB). All
closed (no open or broken edges). The chair is one piece, upright, the right proportions, its unseen back invented
plausibly. Thin parts (flamingo legs) break into small pieces, more so at grid 128.

## What the export really is

`triplane.onnx` takes the 512x512 picture (0 to 1) and gives three 40x64x64 feature planes; its weights are
3,349,149,696 bytes (fp32), not the 1.6 GB its README says, and there is no INT8 file. `nerf.onnx` (181 KB) takes the
planes and points in the ±0.87 box and returns density (already activated) and colour. The mesh is cut at density
25.0 (TripoSR's own default; the README's 0.0 would mesh the whole box).

## To make it a pool job

- Keep both models loaded between jobs: a warm worker gives a GLB in about 7.5 s at 256, about 4 s at 128 (WebGPU).
- Memory: about 2 GB plus 4 GB of graphics memory (WebGPU), or 3.2 GB on CPU; 3.35 GB of weights on the worker's disk.
  An fp16 export would halve that but needs Python once, elsewhere.
- Background removal for real photos: done (below). Still to do: one job at a time on a 16 GB machine; optionally a 180 degree turn (the picture's side faces -Z) and fewer triangles to
  keep a GLB under about 1 MB for the headset.
- On a Linux GPU box `onnxruntime-node` would use CUDA instead of WebGPU: not tried.

## Ordinary photos: background removal (measured 2026-11-14)

BiRefNet-lite (MIT), `onnx-community/BiRefNet_lite-ONNX` at `de15b22`, 224 MB, SHA-256 `56000243...3333`, 1024x1024
input, in `research/triposr/rmbg.mjs` (also a tool of its own: a photo in, a PNG with alpha and a mask out), imported
by `triposr.mjs` whenever the picture has no transparent pixel. RMBG 1.4 and 2.0 (non-commercial) and ISNet (AGPL)
were turned down.

- The mask step on CPU: 4.6 to 4.9 s, 6.6 to 7.1 s cold, **about 8 GB of memory** (7.8 to 9.0 GB whatever the session
  settings). On WebGPU it first fails (too many storage buffers in one Split node); `patch-split.mjs` (Node) rewrites
  50 Splits into Slices, and then it runs at the same speed with a 14 to 15 GB footprint, so the mask stays on CPU.
- Photo to GLB (three Wikimedia Commons photos, CC BY-SA 4.0: a chair, a mug, a shoe): about 17.5 s cold, 72k to 87k
  triangles, 1.9 to 2.3 MB, closed; about 12 s warm (INFERRED). Peak memory about 9 GB: the mask model is released
  before TripoSR loads, so the peaks do not add.
- Cut-outs clean (the mug's handle hole, the chair's leg gaps, the shoe's lace). Shapes: a photo taken from above
  tilts the object (TripoSR assumes a level camera); a side-on shoe comes out as a thin slab. The unseen sides are
  invented.
- Not a tab job yet: about 8 GB on CPU is past a tab's 4 GB WebAssembly memory (INFERRED). A smaller model (u2netp,
  Apache 2.0) is the tab candidate, untried.

The pool design for both, Remove background and Picture to 3D, is `plans/pool-3d.md`.

## Rerun

```sh
ssh mbp; export PATH=/opt/homebrew/bin:$PATH; cd ~/triposr-onnx
node triposr.mjs examples/chair.png --res 256 --enc webgpu --dec webgpu
node render.mjs out/chair-256-webgpu-webgpu.glb chair.png 300
```
Photos: `node rmbg.mjs photos/mug.jpg` (cut-out only) or `node triposr.mjs photos/mug.jpg --res 256 --enc webgpu --dec webgpu`.
Setup: `npm i onnxruntime-node pngjs isosurface jpeg-js`, the mask model to `rmbg/birefnet_lite.onnx`,, then `config.yaml`, `nerf.onnx`, `triplane.onnx`,
`triplane.onnx_data` from `https://huggingface.co/brodatech/triposr-onnx/resolve/main/`.
