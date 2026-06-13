# Graphic design playground — typography, color, images

Sketch, 2026-06-12. A board mode for playing with graphic design: type a brief
("warm editorial, 70s, a little loud") → the board fills with rendered type
specimens, palette ramps and sample compositions you can reroll, lock and crop.
The board's HTML-in-canvas pipeline is the ideal preview surface — specimens are
real text nodes at real sizes, not screenshots.

## What "taste" can be based on

Three layers, ordered by reliability:

### 1. Structure + math (deterministic, free, no LLM)

- **Google Fonts API**: the whole catalog with category (serif/sans/display/
  mono), weights, variable axes, popularity. Taste rules become filters:
  body = text face, tall x-height, has real italic + 400/700; display = the
  contrast axis against it.
- **OKLCH color math**: palettes as perceptually-even lightness ramps with
  controlled chroma, harmonies as hue rotations, APCA/WCAG contrast as hard
  constraints. This is how Radix/Tailwind ramps are shaped — generated palettes
  are *correct* by construction; only the seed hue/chroma is a taste decision.
- Classic typographic systems: modular scales, line-length bounds, leading
  ratios. Old rules, fully encodable.

### 2. Curated corpora (where actual taste lives)

- Pairings: Fontpair, Typewolf, Fonts In Use (font × industry × era — the
  richest signal: what real designers chose in context).
- Palettes: design-system tokens (Radix, Material, HIG), Coolors/Color Hunt
  trending data.
- **design.md (designmd.co)**: taste-as-markdown for agents — currently web/UI
  focused, but the format is the right idea. Write a graphic-design flavored
  `taste.md` for this repo: banned-by-default fonts (the Arial/Lobster tier),
  preferred pairings per mood, palette construction rules. Versioned, editable,
  and both the generator and the LLM consume it.
- **The user's own gallery**: [website](website.md)
  extractions (palettes + fonts from saved sites) are personal taste data —
  "more like this board" beats any global corpus.

### 3. LLM as curator — yes, with guardrails

LLMs are genuinely good at vibe → fonts/colors translation (they've read the
Typewolf-tier discourse) and at *justifying* choices, which makes results
teachable. Two failure modes to design around:

- **Hallucinated fonts**: validate every suggestion against the Google Fonts
  catalog (or local font list); reject and re-ask on miss.
- **Median taste**: raw "give me a palette" yields safe beige. Better: the
  deterministic layer generates N candidates, the LLM ranks/pairs/names them
  against the brief and taste.md. Curator, not oracle.

Optional second pass: vision model critiques the *rendered* board frame
("display face too tight at this size") — closes the loop pixels-first.

## Gestalt rules — the most encodable taste of all

Fonts/colors are preference; gestalt is *relational geometry* — checkable over
node rects, which the board already has. Three enforcement modes:

### Encode as constraints (a "gestalt linter")

- **Proximity**: intra-group gaps must beat inter-group gaps by a clear factor
  (≥2×); flag ambiguous middles. Pure rect math.
- **Alignment / continuity**: shared edges and baselines; near-misses (2–6px off)
  are worse than clear offsets — `interact/snap.ts` already finds these lines,
  a linter just scores them instead of snapping.
- **Hierarchy / focal point**: exactly one dominant element; sizes drawn from
  the modular scale, not freeform; visual-weight distribution (area × contrast).
- **Common region / closure**: grouping via frames (the card kind) instead of
  loose clouds.
- **Figure-ground**: APCA contrast of each element against its local background.
- **Repetition**: spacing/radius/size values drawn from a small token set —
  count distinct values, fewer is better.

Output: score + violation list with rects → render as overlay guides (the
red snap-guide rendering already exists; reuse it for lint hints, Figma-tidy
style).

### Where the rules come from

Distilled, rule-shaped sources — no scraping needed: Williams' CRAP
(contrast/repetition/alignment/proximity — operationalized gestalt), Müller-
Brockmann grid systems, Elam's *Geometry of Design*, Lupton's *Thinking with
Type*, NN/g's gestalt-in-UI articles. A page of taste.md rules covers 90%.

### What stays soft (LLM/vision territory)

Whether *semantically related* things are grouped, figure-ground ambiguity
inside images, "is the focal point the right element for the brief" — the
linter sees geometry, not meaning. That's the vision-critique pass's job.

Generation-side, gestalt is free: compose on a column/baseline grid with
spacing tokens and the lint passes by construction — same trick as OKLCH
ramps being correct by construction.

## Pipeline

```
brief ──► LLM (curator) ──► {pairing, palette seed, scale}  — validated JSON
              │                      │
          taste.md            OKLCH ramp gen + Google Fonts load
                                     │
                              board nodes: specimen frame, palette chips,
                              sample comp (poster/card) — reroll/lock per part
```

LLM call from the local sidecar (shared with [mcp](mcp.md) /
[image-proxy](image-proxy.md)): OpenRouter for model-hopping or Anthropic
direct; either is one thin endpoint. Works without the LLM too — pure
catalog-filter + ramp-gen mode is still a useful instrument on its own.

## v1 cut

No LLM: a "specimen" insert that takes {display font, body font, seed color} →
renders a type-scale frame + OKLCH ramp chips on the board, with reroll buttons
driven by catalog filters + taste.md rules. The LLM brief layer drops in on top.

## Open questions

- Font loading: Google Fonts `<link>` per specimen is easy; local font files
  (user's foundry purchases) need a FontFace registry — same proxy/sidecar?
- Are specimens one composite node (frame + children) or a generated sub-board?
- taste.md schema: prose the LLM reads, or structured YAML the generator also
  enforces? (Probably both in one file: rules block + prose block.)
- Image side: tie palettes to gallery crops (extract dominant OKLCH from a crop,
  build the ramp from it)?
