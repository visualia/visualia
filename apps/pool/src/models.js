// The model list the Visualia Pool app downloads from and serves to the pool
// (plans/worker-app.md "the model list"), sent at GET /app/models. Changing it
// needs a pool deploy, not an app update. The app checks every entry against
// limits built into it (apps/pool-app/pool-core/src/core.rs check_list: at most 8 models, 24 GB
// each, Ollama or hf.co tags only) and downloads only when someone clicks Get,
// one at a time, with enough disk; a change here starts no download and removes
// nothing. The gateway allows chat on every model here except those marked
// `decide` (apps/gateway/src/index.js POOL_MODELS); decisions go to pool/clef-flash.
//   name     the pool's name     label  what people read
//   tag      the Ollama tag      gb     download size    need_gb  memory needed
//   from+ctx made from that download with that context length (ollama create)
//   decide   a decision model, not for chat
//   file+sha256  not an Ollama model: a file from /app/files/ (R2 `files/<file>`,
//            apps/pool-app/upscale/publish-weights.mjs), checked by its SHA-256;
//            the upscalers' weights, run by the app itself (and by tabs: join.html)
//   image    a picture model (Stable Diffusion weights in `file`), run by the app
//            with stable-diffusion.cpp's sd-cli, a separate install (SD_CLI or
//            ~/.visualia/sd-cli); offered only where sd-cli and the file are.
//            The pool's /image takes these (apps/pool/src/index.js IMAGE), the
//            gateway as `pool/<name>`. The app checks them (core.rs check_list):
//              steps 1-50   cfg 0-20 (cfg scale)   sampler one of sd-cli's
//              (euler, euler_a, heun, dpm2, dpm++2s_a, dpm++2m, dpm++2mv2, lcm)
//              negative     the negative prompt, at most 200 characters
//              side         the model's native side in pixels, 256-1024; pictures
//                           are at most side x side
//   cutout   a background remover (an ONNX file in `file`), run by the app with
//            the pool3d helper, a separate install (POOL3D_DIR or
//            ~/.visualia/pool3d, apps/pool-app/pool3d); offered only where the
//            helper and the file are. The pool's /cutout takes these, the
//            gateway as `pool/<name>`. Apps before 0.5.0 drop the entry.
export const MODELS = [
  { name: 'qwen3.5-9b', label: 'Qwen 3.5 (9B)', tag: 'qwen3.5:9b', gb: 7.6, need_gb: 16 },
  { name: 'gemma4-26b', label: 'Gemma 4 (26B)', tag: 'gemma4:26b', gb: 16.1, need_gb: 32 },
  { name: 'clef-flash', label: 'Clef-flash (decisions)', tag: 'clef-flash-8k',
    from: 'hf.co/bartowski/Cloudflare_clef-flash-GGUF:Q4_K_M', ctx: 8192, gb: 7.0, need_gb: 16, decide: true },
  { name: 'upscale-fast', label: 'Upscaler, fast', file: 'real_esrgan_general_x4v3.bpk',
    sha256: 'f08da56b06348a0cb6946244262cd8fa7b2c2ce63e98d47b5d60f086d4f965f1', gb: 0.005, need_gb: 8 },
  { name: 'upscale-quality', label: 'Upscaler, detailed', file: 'real_esrgan_x4plus.bpk',
    sha256: '7ffa94e4d274d0d9c91fa3ae452fb41cd1a36df55fa053e2d897683a4d8dc612', gb: 0.067, need_gb: 8 },
  { name: 'chilloutmix', label: 'ChilloutMix', file: 'chilloutmix_NiPrunedFp16Fix.safetensors',
    sha256: '59ffe2243a25c9fe137d590eb3c5c3d3273f1b4c86252da11bbdc9568773da0c', gb: 2.1, need_gb: 16,
    image: { steps: 20, cfg: 7, sampler: 'dpm++2m', negative: 'nsfw, nude, naked', side: 512 } },
  // BiRefNet-lite (MIT), onnx-community/BiRefNet_lite-ONNX at de15b22, onnx/model.onnx (research/triposr-node.md).
  { name: 'birefnet-lite', label: 'Remove background', file: 'birefnet_lite.onnx',
    sha256: '5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333', gb: 0.224, need_gb: 16, cutout: true },
  // Depth Anything V2 small (Apache-2.0), onnx-community/depth-anything-v2-small at 4472b73,
  // onnx/model_quantized.onnx (q8), the file evals/estonian-visuals uses. Tabs only for now:
  // the app's check_list drops it (an .onnx file that is not a background remover).
  { name: 'depth-anything-v2-small', label: 'Depth', file: 'depth_anything_v2_small_q8.onnx',
    sha256: 'fcf51f1b230362b28690bb9d1809bf0431f29cad20534e3f589bd7285547f20d', gb: 0.027, need_gb: 4, depth: true },
];
