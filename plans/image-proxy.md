# Same-origin media proxy — any net image, rastered locally

Sketch, 2026-06-12 — **IMPLEMENTED 2026-06-13**: `mediaProxy()` vite plugin
at `@visualia/engine/vite` (it exists to serve the engine's media path, so it
lives with the engine) + `proxyResolver()` on the media kinds; render-time
rewrite, canonical URLs in the doc. Verified with non-CORS image and video
hosts. No disk cache yet — still an open item below. Today the GL media path (`media-kinds.ts`) sets
`crossOrigin='anonymous'`, so `texImage2D` only accepts images whose host sends
`Access-Control-Allow-Origin` — picsum and MDN samples do, most of the web
doesn't. A tainted source renders as an empty node. A local proxy makes every
URL same-origin and removes the constraint entirely.

## Shape

Vite dev middleware (or the same sidecar as [website](website.md)):

```
GET /proxy?url=<encoded> → server-side fetch → stream body back
                           with upstream content-type, long cache headers
```

**A working reference implementation already exists** (found during the
[lineage](lineage.md) harvest): `~/personal/workshop/server/api/
image-proxy.get.ts` — Nuxt nitro, with private/loopback-host blocking and
URL validation. Port it, don't invent it. Workshop also has the adjacent
variant, `site-proxy.get.ts`, which proxies whole pages (with URL rewriting
to keep subresources proxied) for iframe embeds — a separate concern from
media, but the same skeleton if the board ever grows a web-embed node kind.

The image kind (or a tiny `resolveSrc()` in the app layer) rewrites external
`src` → `/proxy?url=...`. Same-origin now: no taint, GL texture upload always
works, `crossOrigin` becomes irrelevant. Works for `<video>` sources too
(range-request passthrough needed for seeking).

## Details that matter

- **Disk cache** keyed by URL hash (`.data/media-cache/`): instant re-loads,
  boards survive dead links and offline work — an inspiration board probably
  *wants* frozen copies (same provenance question as gallery crops).
- **Hotlink protection**: server-side fetch sends no browser Referer, which
  defeats most referer-based blocking for free; a few hosts want a UA header.
- **Limits**: cap response size (e.g. 50 MB), follow redirects with a hop limit,
  only allow http(s).
- **SSRF**: irrelevant while strictly-local dev, but block private/loopback
  ranges anyway so the middleware is safe to lift into a hosted variant.
- **CF variant**: the identical contract as a Worker — `fetch` + Cache API/R2.
  Cloudflare also has Image Resizing if thumbnails ever matter.

## Why this is the cheapest sketch in plans/

No browser engine, no LLM, no new node kinds, no engine changes — one
endpoint (portable from workshop) plus a `src` rewrite. It also unblocks the
other sketches: gallery asset extraction inserts arbitrary-host image nodes,
and MCP `board_insert({type:'image', src})` stops caring whether the host
does CORS — which matters immediately for any agent-built board full of
reference images (the lineage-board use case).

## Open questions

- Rewrite `src` at insert time (stored URL is the proxy URL — leaks localhost
  into the doc) or at render time (stored URL stays canonical — cleaner)?
  Leaning render-time.
- Should the DOM fallback mode also use the proxy (consistency + caching) or
  keep direct loads (no taint concern there)?
