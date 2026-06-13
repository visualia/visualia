# Website capture — paste a site onto the board (inspiration gallery)

Sketch, 2026-06-12 (chromium findings 2026-06-13). Paste a URL onto the board
→ full-page **screenshot** as a node (captured, frozen — *not* a live iframe;
that "live web kind" is explicitly out of scope here). Crop parts of it into
their own image nodes (snapping to the page's own image/section edges), extract
info (palette, fonts, copy, assets).

## Decision: captured, not live

A captured screenshot node, not an interactive iframe. Inspiration is a moment
in time; a frozen, croppable, manipulable image is exactly what a moodboard
wants, and it sidesteps the live-iframe headaches (per-site CORS, JS, auth,
the page changing under you). The capture is a normal image node afterward —
no special live machinery, full reuse of the existing media/crop/snap stack.

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
site itself.

**Verified here (2026-06-13, this Intune/MDM-managed Mac):**
- **Headless Chrome runs** — rendered a real page to PNG despite MDM + Gatekeeper
  (enterprise management does *not* block headless rendering).
- **The Chromium download is NOT blocked** — `npx playwright install chromium`
  exits 0; the bundled binaries are already cached
  (`~/Library/Caches/ms-playwright/chromium-1223`, incl. `chrome-headless-shell`).
- **Binary speed** (cold launch + viewport screenshot, best of 3):
  | binary | time |
  |---|---|
  | system Google Chrome (`--headless=new`) | ~2.7 s |
  | bundled full Chromium (Chrome-for-Testing) | ~2.6 s |
  | **`chrome-headless-shell`** (Playwright's headless binary) | **~0.30 s** |

  → Full Chrome vs bundled Chromium: **no meaningful difference**. The
  **headless-shell is ~9× faster** — it's the right binary for a capture
  service. In a real sidecar the browser launches **once** and is reused, so
  per-capture cost is just nav + screenshot (sub-second) regardless; the
  launch-speed gap matters for cold starts (serverless / CF) and memory.

**Recommendation (supersedes the earlier "use system Chrome to dodge the
download"):** use **Playwright with its bundled chromium / headless-shell** (the
default) — not blocked here, faster, and Playwright manages the binary + gives
`fullPage` and the rect map over CDP. Keep `channel: 'chrome'` /
`executablePath` (drive the system Chrome) as a **fallback** for a more
locked-down machine where the download *is* blocked — both expose the same
`{png, rects, meta}` contract, so swapping is a one-line config.

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

## Interaction

The whole point: **paste a link, get a croppable frame whose crops snap to the
page's own elements** — and the agent can do the identical thing by *naming*
an element. Both humans and the agent resolve through one shared **element rect
map**.

### 1. Paste → capture (the frame appears)

- A URL on the clipboard (⌘V) — or typed into the palette — is recognized as a
  website paste.
- A **placeholder node** ("capturing `host`…") drops at the paste point
  *immediately* for instant feedback, while the app calls the sidecar
  `POST /capture {url}`.
- On return it becomes a **website node**: the full-page screenshot as an image,
  carrying its element **rect map** as metadata —
  `{ sourceUrl, capturedAt, rects: [{ id, tag, sel, text?, rect }] }`, rects in
  the screenshot's own pixel space. (Tall pages scale to a sane node width; cap
  height or tile — open question.) Afterward it's a normal image node
  (pan/move/delete), just with the extra rects that power cropping.

### 2. Snap-to-element crop

The page's element rects are the croppable units. **Click-to-crop:** hovering
inside the node highlights the element rect under the cursor (outline + dim the
rest); a click extracts *that element* as a new image node, snapped exactly to
its bounding box. The fast path — "grab that hero image / that heading." (A
free-form marquee-snap-to-edges gesture is deferred; click-to-element covers the
common case and is far simpler.)

The crop is a child **image node**: the *same local png* with a `{crop: rect}`
sub-rect (CSS object-position — no re-encode, the png is local), plus
**provenance** `{sourceUrl, rect}` so "open original" works. Crops stack near the
source.

### 3. MCP — the agent snaps by *naming* the element

The agent shares the exact same capture path and targets elements by reference
(the rect map is its "DOM-lite" — it can *see* what's croppable):

- `board_capture(url)` → triggers the sidecar, inserts the website node, and
  **returns its element list** `[{id, tag, sel, text, rect}]`.
- `board_crop(nodeId, target)` → a crop node snapped to an element, where
  `target` is a **CSS selector** (`'img.hero'`), an **element id/index** from
  that list, or a raw rect. *Snap-to-element for the agent = pass the selector*;
  the engine resolves it to the element's rect and crops exactly.
- Sugar: `board_capture(url, { select })` captures **and** immediately crops to
  the matched element(s) in one call — "grab the hero image from this site."

So a human snaps by hovering/dragging; the agent snaps by naming — both land on
the *same* element rect.

### Shared machinery

- **One capture contract** `{png, rects, meta}` (the sidecar), consumed by both
  the paste handler and the MCP verb.
- **Element hit-testing** — cropping resolves the rect under the cursor (the
  smallest enclosing element) from the captured rect map; that map is the only
  input. (A later marquee-magnetize path, if wanted, reuses `interact/snap.ts`
  with these rects as candidates.)
- The local png is **same-origin** (served by the sidecar), so it textures in GL
  with no proxy needed; crops are CSS sub-rects of it.

*Secondary (extract panel, later):* palette swatches → color chips, font list,
copy blocks → text nodes, asset URLs → insertable image nodes (these need the
[same-origin media proxy](image-proxy.md) so arbitrary hosts texture in GL).

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
- **Entering crop mode**: reuse the existing `edit`/activate seam — **dblclick**
  the website node enters crop mode (same entry as text-edit / link-activate),
  hover-highlight + click crops the element, Escape/click-out exits. Plain
  single-drag still pans, so no collision. Note there is **no image crop mode
  today** — images only re-crop implicitly via resize (`object-fit: cover`), so
  this is a new, *capture-specific* mode (only nodes with a rect map get it); a
  generic "crop any image" mode could generalize it later.
- **Rect granularity**: every DOM element is noise — filter the rect map to the
  useful units (`img`, `video`, `section`, `figure`, headings, nav, cards). The
  sidecar decides what's croppable.
- **Overlapping rects**: hover picks the *smallest* rect under the cursor;
  modifier or scroll cycles to the parent (crop the container vs the child).
- **MCP element refs stability**: the returned `id`/`sel` must stay valid for a
  later `board_crop` — store the rect list on the node so crops don't need a
  re-capture.
