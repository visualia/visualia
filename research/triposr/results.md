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
