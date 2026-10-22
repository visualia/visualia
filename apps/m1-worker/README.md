# m1-worker

The M1 laptop (`m1-1`, MacBook Pro M1 Pro 16 GB, `ssh mbp`, 192.168.1.241 on
the home LAN) as a class pool worker. Since 2026-10-22 it is an ordinary node
worker (the `visualia-worker` program from `apps/worker-app`, outbound only); the Cloudflare Tunnel
`m1-1` and the secret-checking proxy that came before it are retired
(`plans/pool.md` "The M1 joins").

```
the M1 ──outbound wss──▶ pool.visualia.space ◀── gateway (pool/qwen3.5-9b, /v1/decide → pool/clef-flash)
```

On the M1 (`~/visualia-worker/`):
- `pool/visualia-worker`: the Rust program, built on the M1 in
  `~/visualia-build/apps/worker-app` (since 2026-10-22; before that
  `apps/pool/worker-node.mjs` on Node).
- `pool/env` (chmod 600, never in git): `VISUALIA_KEY` (the person `m1-1`'s
  key, also in `.keys.local`) and
  `POOL_MODELS=qwen3.5-9b=qwen3.5:9b,clef-flash=clef-flash-8k`.
- `pool/run-worker.sh` and the LaunchAgent `space.visualia.m1.worker` (start at
  login, keep alive), log in `pool/worker.log` (model, seconds, joules; no prompts).
- `run-ollama.sh` and the LaunchAgent `space.visualia.m1.ollama` (below).

Update the worker: `rsync -az --exclude target --exclude node_modules apps/worker-app/ mbp:visualia-build/apps/worker-app/`, then on the M1
`cd ~/visualia-build/apps/worker-app && cargo build -p worker --release && cp target/release/visualia-worker ~/visualia-worker/pool/ && launchctl kickstart -k gui/$(id -u)/space.visualia.m1.worker`.

Models load when a job asks for them; nothing is kept warm. Ollama holds one
model at a time, so a decision after a page job reloads Clef (5.8 s measured).

## Ollama tuning (2026-10-21)

Ollama runs from its own LaunchAgent `space.visualia.m1.ollama`
(`run-ollama.sh`; the Homebrew service is stopped) with OLLAMA_CONTEXT_LENGTH=16384
(the default 4096 cut pages off), flash attention, q8_0 KV cache, keep-alive -1,
one model and one request at a time.
Models: qwen3.5:9b, gemma4:e4b, Clef-flash Q4_K_M (hf.co/bartowski/Cloudflare_clef-flash-GGUF)
as `clef-flash-8k`: create it with
`printf 'FROM hf.co/bartowski/Cloudflare_clef-flash-GGUF:Q4_K_M\nPARAMETER num_ctx 8192\n' > Modelfile && ollama create clef-flash-8k -f Modelfile`.

Engines (checked 2026-10-21, `~/visualia-worker/ollama.log`): Ollama 0.40.5 already
runs **MLX** for the library builds Apple Silicon gets: `qwen3.5:9b` (nvfp4 with
MTP speculative decoding, `draft_num_predict 3`) and `gemma4:e4b` (nvfp4 with a
Gemma 4 assistant draft model) start an "mlx runner subprocess" (MLX 0.32.4).
Clef-flash (GGUF) runs in Ollama's `llama-server` (llama.cpp). So there is no
separate MLX server: a trial of `mlx_lm.server` 0.32.2 behind the proxy measured
no speed gain over Ollama's MLX runner (Qwen 32.9 vs 33.5 tok/s) and was removed (`plans/first-pages.md`,
run 6). Also pulled for comparison: `qwen3.5:9b-mlx` (MLX without MTP, 25% slower) and the GGUF builds `qwen3.5:9b-q4_K_M` and `gemma4:e4b-it-q4_K_M`
(llama.cpp); about 22 GB together, safe to `ollama rm`. The gateway can name them as `m1-1/<tag>` like any
Ollama model.

Ollama logs "Structured output is unavailable: xgrammar library not found" when
it starts an MLX runner: `format` / `response_format` JSON schemas are probably
not enforced for the MLX models (not yet tested). Clef-flash runs in
llama-server, so `/v1/systemone` (the gateway's `/v1/decide`) is unaffected.

Memory: ~12 GB for the GPU (`iogpu.wired_limit_mb=12288`). Clef-flash takes
9.8 GB at 16k context, a page model 7–10 GB; with OLLAMA_MAX_LOADED_MODELS=1
Ollama swaps them itself. After a page model, the next decision call reloads
Clef first (decide measured 11.6 s and 17.9 s cold vs 4.2 s warm; the gateway's
timeout is 20 s, then it falls back to Clef on Workers AI).

## History: the tunnel and proxy (2026-10-21 to 2026-10-22)

The M1 first served through tunnel `m1-1` → `proxy.mjs` (shared-secret check,
`/v1` endpoints only, macmon energy as an extra event, `enable_thinking: false`
mapped to Ollama's `think: false`, `GET /v1/loaded`, and Clef-flash reloaded
after a minute idle). Retired for the pool's rule, connect out only; the
energy method lives on in `apps/pool/meter.mjs`, the thinking switch in the
worker's `think: false`. The proxy is in git history (removed in the commit
"M1 joins the pool").
