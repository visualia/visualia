# Semantic zoom — the abstraction / altitude axis (LOD + DOI)

Sketch, 2026-06-13. The "Abstraction & zoom" topic ([topics.md](topics.md) §7)
deserves its own plan: **zoom should change *what a node is*, not just its
size** — and the same DOI score that powers the fisheye lens
([layout.md](layout.md) / [dynamics.md](dynamics.md)) picks the representation.
This extends the engine's existing zoom-LOD rather than replacing it.

## What exists today

- **Engine** — `ContentSpec.minPx` → the renderer's `contentAlpha` fades a
  node's content out below N on-screen px and lets the **chrome rect** carry
  the far view ([renderer.ts](packages/engine/src/render/renderer.ts)). A
  2-tier LOD: content texture ↔ chrome rect.
- **Apps** — eka-sitemap drives `lod-far` / `lod-mid` CSS classes off
  `camera.z` to skip sub-pixel text paint (`visibility` + transitions, so bands
  fade rather than pop). Hand-rolled per app.

That's *fade-and-hide*: it shrinks and drops detail. It doesn't **re-encode** or
**aggregate**.

## The gap — three things zoom should do but doesn't

1. **Swap the encoding, not just opacity** (Susie Lu) — full card → title +
   thumbnail → glyph / sparkline → dot. The *representation* changes by band,
   not merely its alpha.
2. **Aggregate** — a frame/cluster of 200 cards collapses to **one** summary
   node (count, mini-chart, thumbnail mosaic) below a threshold; re-expands
   above. Composes with nested layouts — each cluster aggregates independently.
3. **Keep landmarks** — high-importance nodes stay legible across bands so you
   can still navigate when zoomed out (section titles, pins, the focal node).

## Design

### Per-kind LOD tiers
Extend `ContentSpec`: a kind declares an ordered list of representations with
the threshold (on-screen px, or a DOI band — see below) at which each kicks in
— `lod: [{ at, render }, …]`. The renderer picks the tier per node per frame;
today's `minPx` fade becomes the simplest 2-tier case. **Cross-fade** between
tiers, keep the node's centroid/footprint fixed (geometric stability), and add
**hysteresis** on the threshold so jitter across a boundary doesn't flicker the
encoding.

### Aggregation (cluster → summary)
A container gets an `aggregate` representation: below a threshold it renders as
one summary node (the children's count, a chart over their data, a thumbnail
mosaic) instead of N shrunken cards; above, it expands back. The container owns
its aggregate. Pairs with composable/nested layouts ([layout.md](layout.md)) —
each nesting level aggregates independently, so zooming out folds the tree
level by level.

### DOI selects the representation — not just zoom
The tier a node shows is `f(DOI)`, **not purely `f(zoom)`**:

```
representation = tier( DOI(node) )      DOI = API(node) − D(node, focus)
```

(DOI explained in [topics.md](topics.md) §6.) So an *important* node (high API)
stays detailed even when far / zoomed-out — a landmark — while a trivial
neighbour at the same zoom collapses. This **unifies semantic zoom with the
fisheye lens**: both read the same DOI; plain zoom is just the case where the
focus is the whole viewport and distance ≈ off-screen-ness. **Build DOI once,
both consume it.**

### The altitude axis (the explicit ladder)
Beyond passive zoom, an explicit **altitude** control to step between
abstraction *levels* — concrete cards ↔ overlaid trace ↔ summary tile — without
necessarily changing camera zoom. Victor's point is that the insight lives in
the *transitions*, so animate them (Van Wijk-eased, via the node/dynamics
channel). Altitude can be **coupled** to zoom (zoom out = climb) or
**independent** (a slider / key), giving "see the same thing more abstractly"
as a first-class move, not a side effect of pinching.

## Where it lives

- **Engine** — the LOD-tier model on `ContentSpec`, the renderer's band /
  cross-fade / hysteresis logic, and the `aggregate` hook on containers.
  Extends the existing `minPx`.
- **DOI** — shared with the lens; computed in dynamics (or a small shared
  module), fed to the renderer's tier selection.
- **Apps** — declare tiers per kind; eka's `lod-*` classes become a default
  tier set instead of bespoke CSS.

## Sequencing

1. Generalize `minPx` fade → an N-tier `lod` on `ContentSpec` with cross-fade +
   hysteresis. Engine-only, behaviour-preserving for the current 2-tier case.
2. Aggregation hook on containers (needs the [layout](layout.md) seam + nested
   layouts).
3. DOI-driven tier selection — after DOI exists for the lens; unifies semantic
   zoom and the fisheye lens.
4. The explicit altitude control (UI + animated level transitions).

## Open questions

- Tier thresholds in on-screen px, DOI bands, or both?
- Aggregation: who computes the summary — the container kind, or a pluggable
  aggregator (like layout strategies)?
- Does altitude live on the camera (a 4th coordinate) or as per-container state?
- GL vs DOM: the encoding swap must work in both modes — a tier change means a
  texture re-capture in GL mode.

## Cross-links

[topics.md](topics.md) §7 (the concept) · [layout.md](layout.md) (DOI lens +
nested layouts/aggregation) · [dynamics.md](dynamics.md) (the node channel that
eases altitude transitions).
