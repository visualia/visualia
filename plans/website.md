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

---

# Built & findings (2026-06-13)

The v1 shipped, but the *interaction* diverged from the sketch above in two
deliberate ways. Recording what's real, what we learned building the inspiration
gallery, and the API improvements that fall out.

## What actually shipped (vs the sketch)

- **A dedicated `website` node kind** ([website-kind.ts](apps/board/src/website-kind.ts)),
  *not* a plain image. It renders a `<canvas>` showing a **window** into the
  full screenshot — `crop: [sx,sy,sw,sh]` is the visible source-px rect, drawn
  into the node box at scale `w/crop.w`. The canvas is a valid `texImage2D`
  source, so it textures in **GL and DOM alike** with no special path. The
  element rect map lives **on the node** (`rects`, `pageW/H`) → crop survives
  reload and the agent can name elements.
- **Crop is edge-drag, not click-to-new-node.** The sketch's "click an element →
  new cropped image node" was replaced (per user) by *cropping in place*: the
  screenshot is pinned, the node's blue **resize handles crop instead of scale**
  — dragging an edge moves the window, snapping to the element rects with red
  guides, clamped to the screenshot. **No dblclick mode**; select + drag an edge.
  Resizing/scaling is parked. This required a new engine seam:
  **`NodeKind.resizeConstrain(start, rect, pxPerWorld)`** ([kinds.ts](packages/engine/src/core/kinds.ts))
  — a kind reinterprets an edge drag (clamp + snap + guides + a `crop` patch);
  `SelectTool` routes through it when present, else scales as before, and commits
  a generic field-diff so the crop is undoable.
- **Two-stage capture (instant box).** `/capture` now navigates to
  `domcontentloaded`, **measures the page, and returns `{w,h,title,pending:true}`
  immediately** → the frame appears at the real size at once (an empty outlined
  placeholder, no fill, no label). Stage 2 (background, same page) settles,
  screenshots full-page, collects the final rects, writes png+json. An in-flight
  **jobs map** lets the follow-up `/capture` and the held `/capture-img` request
  join the same render (no double work, no client polling). Latency floor =
  `domcontentloaded` (~2–4 s on heavy pages) — far sooner than the full shot.
- **MCP**: `board_capture(url)` (returns the element list) and `board_crop(nodeId,
  target)` — crop now **reframes the window in place** (was: spawn a new image).

Resolved open questions: tall pages → crop to a good height (below); crop mode →
edge-drag, not dblclick; rect stability → stored on the node.

## DocumentKind — website is one *source* of a general shape

A captured site is just **a tall document rendered to pixels, shown through a
crop window, with structural regions to snap to.** A **PDF is the same shape** —
only ingest differs (pdf.js page render + page/figure rects; no headless browser
needed). The whole interaction layer (`resizeConstrain` crop, windowed canvas,
edge-snap, two-stage box) is reusable verbatim. **Recommendation:** generalise
`websiteKind → documentKind` (`type: 'document'`, `source: 'web' | 'pdf'`), two
ingest paths feeding one node. Do it when PDFs are actually wanted; cheap now.

## Findings — the inspiration-gallery experiment

Built a 6-site gallery two ways:

1. **Auto-curated hero crops** (pick each site's biggest wide media element near
   the top, crop to it) — **unreliable.** It picks logos and decorative SVGs
   (samwho's keycap logo, wattenberger's decorative cloud), the best visual is
   often below the fold, and JS/lazy sites render blank (100.antfu's generative
   grid measured a 900 px blank page). "Largest media near top" is not taste.
2. **Uniform "good height" grid** (crop every capture to the *same top slice* at
   a fixed aspect, align in a grid) — **much better.** Each tile is the
   recognisable above-the-fold of a site; the grid is clean and honest. **1:2
   portrait** read best (header + hero + first sections); 4:3 felt cramped.

Two structural lessons:

- **Capture quality is the bottleneck, not crop or layout.** Every weak tile was
  a *capture* failure: lazy images never load (maggie's covers blanked), JS grids
  render empty (antfu), content sits below the fold. The parked **auto-scroll
  pass** (scroll through → trigger lazy → screenshot; `img[loading=lazy]→eager`)
  is the single highest-value fix.
- **The agent should not do pixel math.** The gallery grid was hand-driven —
  the agent looped `agentPatch` computing x/y. That's the wrong layering (see
  [layout.md](layout.md)): the agent should *name a layout* and the board
  computes positions.

## API improvements

### 1. Good heights are the kind's business, not the layout's

The gallery hardcoded "crop top to 1:2". Wrong home. A node kind knows its own
ideal proportions, so add a kind hook:

```ts
// NodeKind
fitTile?(node: T, w: number): { h: number; patch?: Partial<T> };
```

Given a target width, the kind returns the display height it wants **and** an
optional patch to fit — for `website` that's *crop the top to the good aspect*
(`crop:[0,0,pageW, pageW/aspect]`); for `image` it's natural aspect (cover, no
crop); `video` → 16:9; `text` → measured auto-height. The good aspect is a kind
option: `websiteKind({ tileAspect: 1/2 })` (default ≈ 1:2). Any gallery/grid
**asks the kind** instead of guessing. Note this is the *same* operation as
crop-to-fit — `fitTile` just sets the crop window — so it composes with the
edge-crop already built.

### 2. Grid layout as an MCP/agent verb (the [layout.md](layout.md) seam)

The repeatable "inspiration gallery" is `board_layout(scope, 'grid', params)`
from [layout.md](layout.md) — already the target there; the gallery is its
concrete motivating use case. Spec:

```
board_layout(ids | frame, 'grid', { cols, gap, tileWidth, aspect? })
```

The **board** computes positions (pixel math stays in the engine); for each tile
the height comes from the kind's `fitTile` unless `aspect` overrides. So "arrange
these captures in a 3-col grid" → the board crops each to its good height and
places them, one call, no agent arithmetic. Sugar for the whole flow:
`board_capture_grid(urls, { cols, aspect })` = capture many + arrange — the
one-shot moodboard action.

### 3. Capture quality (parked, highest value)

- **Auto-scroll-through** before the screenshot (load lazy images) +
  `img[loading=lazy] → eager`. Fixes maggie-style blank covers.
- **Blank-render detection**: page measured ≈ viewport height with ~no rects ⇒
  flag (JS-only/SPA grid like antfu) so the agent can skip or retry, instead of
  pasting an empty box.
