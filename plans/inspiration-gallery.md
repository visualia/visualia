# Paste a website as an inspiration gallery

Sketch, 2026-06-12. Paste a URL onto the board → full-page snapshot as a node.
Crop parts of it into their own image nodes (snapping to the page's own image/
section edges), extract info (palette, fonts, copy, assets).

## Hard constraint: pixels need a browser engine

A purely client-side board cannot screenshot an arbitrary site — cross-origin
iframes taint the canvas, so there's no `drawImage`-and-read path. Three ways out:

### A. Local virtual browser — Playwright sidecar (recommended)

A small Node process (or Vite dev middleware) drives headless Chromium:

- `page.screenshot({ fullPage: true })` → the gallery image.
- Same session, one `page.evaluate()`: bounding rects of every `<img>`, `<video>`,
  `<section>`, heading and nav, plus computed font families, og:/meta tags,
  asset URLs. Cheap, exact, no ML.
- **This rect map IS the snapping feature**: page-pixel rects scale linearly into
  node-space, so the crop marquee snaps to real element edges — same shape as the
  existing `interact/snap.ts` guides, just fed from the capture metadata instead
  of sibling nodes.

Fully local, fully buildable today. The only network dependency is the target
site itself. Playwright is a devDependency + one `npx playwright install chromium`.

### B. LLM — optional, and only for semantics

Not needed for capture, crop, snap, palette (pixel quantization), fonts (computed
styles), or copy (DOM text). Only for enrichment: "tag the vibe", caption a crop,
"why does this hero work". If/when wanted:

- **OpenRouter**: fine as a thin escape hatch — one key, any vision model, call it
  from the sidecar (keys stay out of the browser). Direct Anthropic API equally
  simple if model-hopping isn't the point.
- Local model (ollama + a vision model): possible, but vision quality is the weak
  link; not worth it for v1.

### C. Cloudflare stack — the hosted variant, later

Workers + **Browser Rendering** (puppeteer-on-CF) for capture, R2 for stored
screenshots, Workers AI (qwen-vl / llava) if enrichment should also be hosted.
Right call only when the board itself is deployed/shared and a local sidecar is
unacceptable. Free-tier limits are fine for personal use. Defer — A and C expose
the same capture contract (`{png, rects, meta}`), so swapping later is cheap.

## Board integration

- Paste handler: URL on clipboard → `website` capture → image node with
  `{src, sourceUrl, rects, meta}` (image kind + sidecar fields, or a new kind).
- Crop: marquee inside the node (reuse marquee + snap machinery) → new image node
  from the sub-rect; CSS-crop first (object-position trick), real re-encode never
  strictly needed since the source png is local.
- Extract panel: palette swatches → color chips, font list, copy blocks → text
  nodes, asset URLs → insertable image nodes (needs the
  [same-origin media proxy](image-proxy.md) so arbitrary hosts texture in GL mode).

## v1 cut

Sidecar with two endpoints: `POST /capture {url}` → `{pngPath, rects, meta}`;
static serving of captures. Board: paste-URL handler, capture node, crop-with-snap.
No LLM, no cloud. Enrichment + CF variant are later layers.

## Open questions

- Capture staleness: keep the png forever (inspiration is a moment in time — yes?)
  or offer re-capture?
- Full-page screenshots get huge (10k+ px tall) — tile into the texture farm, or
  cap height at capture time?
- Lazy-loaded content: scroll-through-then-capture pass in the sidecar?
- Where do crops keep provenance (sourceUrl + rect) — needed for "open original".
