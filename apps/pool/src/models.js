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
export const MODELS = [
  { name: 'qwen3.5-9b', label: 'Qwen 3.5 (9B)', tag: 'qwen3.5:9b', gb: 7.6, need_gb: 16 },
  { name: 'gemma4-26b', label: 'Gemma 4 (26B)', tag: 'gemma4:26b', gb: 16.1, need_gb: 32 },
  { name: 'clef-flash', label: 'Clef-flash (decisions)', tag: 'clef-flash-8k',
    from: 'hf.co/bartowski/Cloudflare_clef-flash-GGUF:Q4_K_M', ctx: 8192, gb: 7.0, need_gb: 16, decide: true },
];
