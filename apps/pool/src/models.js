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
export const MODELS = [
  { name: 'qwen3.5-9b', label: 'Qwen 3.5 (9B)', tag: 'qwen3.5:9b', gb: 7.6, need_gb: 16 },
  { name: 'gemma4-26b', label: 'Gemma 4 (26B)', tag: 'gemma4:26b', gb: 16.1, need_gb: 32 },
  { name: 'clef-flash', label: 'Clef-flash (decisions)', tag: 'clef-flash-8k',
    from: 'hf.co/bartowski/Cloudflare_clef-flash-GGUF:Q4_K_M', ctx: 8192, gb: 7.0, need_gb: 16, decide: true },
  { name: 'upscale-fast', label: 'Upscaler, fast', file: 'real_esrgan_general_x4v3.bpk',
    sha256: 'f08da56b06348a0cb6946244262cd8fa7b2c2ce63e98d47b5d60f086d4f965f1', gb: 0.005, need_gb: 8 },
  { name: 'upscale-quality', label: 'Upscaler, detailed', file: 'real_esrgan_x4plus.bpk',
    sha256: '7ffa94e4d274d0d9c91fa3ae452fb41cd1a36df55fa053e2d897683a4d8dc612', gb: 0.067, need_gb: 8 },
];
