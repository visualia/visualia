# m1-worker

The M1 laptop (`m1-1`, MacBook Pro M1 Pro 16 GB, `ssh mbp`, 192.168.1.241) as a
local model worker for the gateway. See `plans/local-models.md`.

```
gateway (model "m1-1/<name>") → https://m1-1.visualia.space (Cloudflare)
  → tunnel m1-1 (outbound from the M1, no open ports)
  → proxy.mjs on 127.0.0.1:11435 (secret check, /v1 model endpoints only, energy via macmon)
  → Ollama on 127.0.0.1:11434
```

On the M1 (`~/visualia-worker/`): `proxy.mjs`, `env` (VISUALIA_SECRET, TUNNEL_TOKEN;
chmod 600, never in git), `run-proxy.sh`, `run-tunnel.sh`, and two LaunchAgents
`space.visualia.m1.proxy` / `space.visualia.m1.tunnel` (start at login, keep alive).
Installed with Homebrew: ollama, cloudflared, macmon. The gateway holds the same
secret as `M1_SECRET`.

Energy per call comes back as a `visualia` event before `[DONE]`: chip energy,
net of the chip's idle baseline, and whole-system energy, stored in `usage`.

Update the proxy: `scp proxy.mjs mbp:visualia-worker/proxy.mjs && ssh mbp 'launchctl kickstart -k gui/$(id -u)/space.visualia.m1.proxy'`.

Tuning (2026-10-21): Ollama runs from its own LaunchAgent `space.visualia.m1.ollama`
(`run-ollama.sh`; the Homebrew service is stopped) with OLLAMA_CONTEXT_LENGTH=16384
(the default 4096 cut pages off), flash attention, q8_0 KV cache, keep-alive -1,
one model and one request at a time. The proxy maps
`chat_template_kwargs.enable_thinking: false` to Ollama's `think: false` /
`reasoning_effort: "none"`: first token 4.9 s instead of 59 s.
Models: qwen3.5:9b, gemma4:e4b, Clef-flash Q4_K_M (hf.co/bartowski/Cloudflare_clef-flash-GGUF).

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

## One model at a time, Clef kept ready (2026-10-22)

Clef-flash and a page model don't fit in the GPU budget together (Ollama sees
~11.3 GB; Clef 6.7 GB + Qwen/Gemma 5–9.5 GB), checked with
`OLLAMA_MAX_LOADED_MODELS=2`: Ollama evicts Clef anyway. So:

- Clef runs as `clef-flash-8k` (the Q4_K_M GGUF with `PARAMETER num_ctx 8192`;
  6.7 GB loaded instead of 9.8 GB at 16k). Create it on the M1 with
  `printf 'FROM hf.co/bartowski/Cloudflare_clef-flash-GGUF:Q4_K_M\nPARAMETER num_ctx 8192\n' > Modelfile && ollama create clef-flash-8k -f Modelfile`.
- `GET /v1/loaded` on the proxy lists the models in memory. The gateway asks
  before a decide call and goes straight to Workers AI Clef when Clef isn't
  loaded, instead of waiting 8–18 s for a reload.
- After a minute with no requests the proxy loads `WARM_MODEL`
  (default `clef-flash-8k`) back.

Measured: decide on the M1 with Clef warm 1.0–1.3 s; right after a page model,
cloud in 0.5 s; Clef reloaded by the proxy within ~75 s.
