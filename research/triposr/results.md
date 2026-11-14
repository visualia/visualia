# TripoSR in Node on the M1 (2026-11-14)

Machine: M1 Pro (T6000), 16 GB, macOS 26.6.2, Node 24.20.0, onnxruntime-node 1.31.1, pngjs, isosurface (tables only). No Python anywhere.
Model: brodatech/triposr-onnx, `triplane.onnx` + `triplane.onnx_data` (3,349,149,696 bytes, fp32, not 1.6 GB as its README.txt says; no INT8 file exists in that repo) and `nerf.onnx` (180,763 bytes).
nerf.onnx takes `triplane [1,3,40,64,64]` + `xyz [K,3]` in [-0.87,0.87] and does the grid_sample + concat + MLP + exp(d-1) inside; outputs `density [K,1]` (activated, threshold 25 as run.py) and `color [K,3]` (sigmoid, 0..1).

Peak memory from /usr/bin/time -l: CPU encoder 3.24 GB max RSS (3.16 GB footprint). WebGPU encoder 1.85 GB max RSS, 5.8 GB footprint (GPU buffers in unified memory). CoreML encoder: killed after 58 s (NeuralNetwork) and 113 s (MLProgram), 53 GB peak footprint, only 1057 of 2113 nodes in 318 partitions; no result.
First row is the cold first run (page cache empty): load 3.8 s, encoder 19 s.

| image | grid | encoder EP | decoder EP | load s | encoder s | decoder grid s | MC s | colour s | total s | peak RSS MB (in-process) | verts | tris | GLB bytes | components (largest share) | boundary edges | extent x,y,z (TripoSR frame) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| chair.png | 128 | cpu | cpu | 3.841 | 18.982 | 0.955 | 0.107 | 0.01 | 23.985 | 3054 | 10198 | 20400 | 531492 | 1 (100.0%) | 0 | 0.604, 0.573, 1.072 |
| chair.png | 128 | cpu | cpu | 1.308 | 7.8 | 0.944 | 0.105 | 0.009 | 10.257 | 3093 | 10198 | 20400 | 531492 | 1 (100.0%) | 0 | 0.604, 0.573, 1.072 |
| chair.png | 256 | cpu | cpu | 1.303 | 7.804 | 7.322 | 0.536 | 0.027 | 17.102 | 3093 | 41744 | 83492 | 2171892 | 1 (100.0%) | 0 | 0.599, 0.569, 1.069 |
| flamingo.png | 128 | cpu | cpu | 1.305 | 7.774 | 0.956 | 0.112 | 0.005 | 10.231 | 3093 | 5398 | 10748 | 281264 | 13 (94.0%) | 0 | 0.327, 0.765, 1.01 |
| flamingo.png | 256 | cpu | cpu | 1.3 | 7.783 | 7.399 | 0.56 | 0.02 | 17.156 | 3093 | 23070 | 46136 | 1200744 | 3 (96.2%) | 0 | 0.327, 0.762, 1.005 |
| hamburger.png | 128 | cpu | cpu | 1.306 | 7.783 | 0.949 | 0.109 | 0.011 | 10.254 | 3094 | 13262 | 26508 | 690580 | 4 (99.5%) | 0 | 0.906, 0.915, 0.491 |
| hamburger.png | 256 | cpu | cpu | 1.332 | 7.803 | 7.33 | 0.533 | 0.029 | 17.147 | 3094 | 55322 | 110612 | 2877516 | 8 (99.5%) | 0 | 0.902, 0.918, 0.483 |
| chair.png | 128 | cpu | coreml | 1.405 | 7.768 | 2.351 | 0.11 | 0.034 | 11.758 | 4383 | 10198 | 20400 | 531492 | 1 (100.0%) | 0 | 0.604, 0.573, 1.072 |
| chair.png | 128 | webgpu | cpu | 3.633 | 3.043 | 1.165 | 0.112 | 0.009 | 8.073 | 1771 | 10198 | 20400 | 531492 | 1 (100.0%) | 0 | 0.604, 0.573, 1.072 |
| chair.png | 256 | webgpu | webgpu | 1.628 | 2.898 | 4.113 | 0.555 | 0.029 | 9.347 | 1966 | 41744 | 83492 | 2171892 | 1 (100.0%) | 0 | 0.599, 0.569, 1.069 |
| chair.png | 128 | webgpu | cpu | 1.535 | 2.818 | 1.004 | 0.113 | 0.009 | 5.57 | 1768 | 10198 | 20400 | 531492 | 1 (100.0%) | 0 | 0.604, 0.573, 1.072 |
| chair.png | 256 | webgpu | cpu | 1.499 | 2.817 | 7.489 | 0.555 | 0.027 | 12.493 | 1769 | 41744 | 83492 | 2171892 | 1 (100.0%) | 0 | 0.599, 0.569, 1.069 |
| flamingo.png | 128 | webgpu | cpu | 1.477 | 2.815 | 1.158 | 0.115 | 0.005 | 5.65 | 1769 | 5396 | 10744 | 281160 | 13 (94.0%) | 0 | 0.327, 0.765, 1.01 |
| flamingo.png | 256 | webgpu | cpu | 1.499 | 2.814 | 7.556 | 0.562 | 0.019 | 12.547 | 1769 | 23070 | 46136 | 1200744 | 3 (96.2%) | 0 | 0.327, 0.762, 1.005 |
| hamburger.png | 128 | webgpu | cpu | 1.463 | 2.809 | 1.043 | 0.109 | 0.011 | 5.531 | 1770 | 13262 | 26508 | 690584 | 4 (99.5%) | 0 | 0.906, 0.915, 0.491 |
| hamburger.png | 256 | webgpu | cpu | 1.462 | 2.809 | 7.47 | 0.54 | 0.029 | 12.432 | 1770 | 55322 | 110612 | 2877516 | 8 (99.5%) | 0 | 0.902, 0.918, 0.483 |

## Ordinary photos: background removal first (2026-11-14, same M1)

Mask model: **BiRefNet-lite, MIT licence** ([ZhengPeng7/BiRefNet](https://github.com/ZhengPeng7/BiRefNet)), the
Transformers.js-ready export `onnx-community/BiRefNet_lite-ONNX` at revision `de15b22ba131738a16dff04aab8bdf8dc32e3ac1`,
`onnx/model.onnx`, 224,005,088 bytes, SHA-256 `5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333`.
Input `input_image [1,3,1024,1024]` (ImageNet mean and std), output `output_image [1,1,1024,1024]` logits.
Not chosen: briaai RMBG-1.4 and 2.0 (licence "other", non-commercial), onnx-community/ISNet-ONNX (tagged AGPL-3.0).
Script: `rmbg.mjs` (a photo in, a PNG with alpha and a mask PNG out; also the module `triposr.mjs` imports).
Steps as rembg's birefnet session: resize to 1024, sigmoid, min-max, resize to the photo's size, then rembg's
`post_process_mask` (3x3 opening, gaussian sigma 2, cut at 127). `triposr.mjs` runs it when the picture has no
transparent pixel (any JPEG), releases it, then does TripoSR's `resize_foreground(0.85)` as before. New dependency:
`jpeg-js` (pure JS). The old path is unchanged: `examples/chair.png` at 256 on WebGPU gave a byte-identical GLB.

Photos (Wikimedia Commons, all CC BY-SA 4.0): `Cebu_Wooden_chair.jpg` (958x1280, original),
`Coffee_mug_on_table.jpg` (1280px thumbnail, 1280x1925), `A_Vans_Sneaker_On_The_Side.jpg` (1280px thumbnail, 1280x960).

### The mask step alone (`node rmbg.mjs photos/<p>.jpg`), one cold process per photo

| photo | EP | model load s | pre s | model s | post s | total s | max RSS (time -l) | peak footprint | foreground |
|---|---|---|---|---|---|---|---|---|---|
| chair | cpu | 1.542 | 0.069 | 4.869 | 0.160 | 6.87 | 7.76 GB | 7.82 GB | 25.3 % |
| mug | cpu | 1.557 | 0.108 | 4.599 | 0.300 | 7.05 | 8.04 GB | 7.97 GB | 23.7 % |
| shoe | cpu | 1.547 | 0.061 | 4.556 | 0.162 | 6.58 | 7.92 GB | 7.81 GB | 25.4 % |
| chair | webgpu (patched) | 1.927 | 0.071 | 5.807 | 0.175 | 8.22 | 5.84 GB | 15.24 GB | 25.3 % |
| mug | webgpu (patched) | 1.953 | 0.097 | 4.007 | 0.303 | 6.85 | 7.22 GB | 14.40 GB | 23.7 % |
| shoe | webgpu (patched) | 1.921 | 0.059 | 4.132 | 0.171 | 6.54 | 7.32 GB | 14.99 GB | 25.4 % |

Warm, four runs in one process on the shoe: cpu 4.70, 4.68, 4.67, 4.68 s; webgpu 4.71, 4.67, 4.69, 4.65 s; both
10.2 GB max RSS. So WebGPU gives the same mask and no speed or memory gain here: **run the mask on CPU**.
The memory is the surprise: 7.8 to 9.0 GB RSS for one 1024x1024 run whether the CPU arena, memory patterns or graph
optimisation are on or off (arena off 8.59 GB; arena on with optimisation basic, disabled, extended 9.03, 9.00,
8.98 GB). The in-process RSS sampler misses most of it (it reads 626 MB after the mask inside `triposr.mjs`), so the
numbers here are from `/usr/bin/time -l`.

The unpatched model fails on WebGPU: `Split node /decoder/Split_33 ... Too many storage buffers in shader. Current:
11, Max is 10`. `patch-split.mjs` (Node, `onnx-proto`) rewrites the 50 Split nodes with more than 8 outputs into
Slice nodes; the patched file is 224,367,448 bytes, SHA-256 `cb277641c014abf753ced53e9a19fcf7e7f4614f26e5093729ef053c5b3817e3`.

### Photo to GLB (`node triposr.mjs photos/<p>.jpg --res 256 --enc webgpu --dec webgpu`, mask on CPU, arena off)

| photo | mask load s | mask model s | mask total s | TripoSR load s | encoder s | grid s | total s | max RSS | peak footprint | tris | GLB bytes | components | boundary edges |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| chair | 1.553 | 5.011 | 7.08 | 2.854 | 2.809 | 3.866 | 17.33 | 8.89 GB | 9.75 GB | 72,688 | 1,891,096 | 1 | 0 |
| mug | 1.553 | 5.043 | 7.37 | 2.810 | 2.807 | 3.868 | 17.68 | 8.82 GB | 9.82 GB | 87,024 | 2,263,784 | 1 | 0 |
| shoe | 1.574 | 5.003 | 7.06 | 2.830 | 2.830 | 3.873 | 17.36 | 8.94 GB | 9.73 GB | 76,292 | 1,984,800 | 2 (99.99 %) | 0 |

The peak is the mask step; TripoSR's part stays at about 2.3 GB RSS as before. Warm (both models loaded) the job
would be about 4.7 s mask plus about 7.5 s TripoSR: about 12 s.

### What the results look like (`renders/photo-cutouts.png`, `renders/photo-<p>-256.png`)

Views in the renders: 0, 90, 180 and 45 degrees; the photo's side is the **third** panel (180).
- Cut-outs: clean on all three. The mug's handle hole is cut out, the chair's four legs and the gap under the seat
  are separate, the shoe's long loose lace is kept with its tip. The chair's shadow and the shoe's counter are gone.
- Chair: from the photo side it reads as the chair (back, seat, legs). From the side it is thin and leans forward,
  the back legs splay; the unseen back is a plausible flat panel.
- Mug: from the photo side right (rim, coffee, handle with its hole). The whole mug is tilted about 20 degrees
  because the photo looks down at it and TripoSR assumes a level camera; the back is smooth and plain.
- Shoe: from the photo side very close to the photo. Seen from above or behind it is a thin slab, a side-on photo
  gives no depth, and the lace hangs as a long strand.
