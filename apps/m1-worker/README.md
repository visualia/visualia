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
