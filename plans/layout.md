# Layout — a pluggable placement seam for the engine

Sketch, 2026-06-13. The prerequisite the [mcp](mcp.md) and agent ideas
quietly depend on. Today "where does a node go" is one hardcoded heuristic in
the demo app; it needs to become an engine seam with pluggable strategies
that are **declarative** (a function of the data) and **re-runnable** (so
layout can adjust after the fact), not a coordinate baked once at insert.

## Status (updated 2026-06-13) — almost none of this is built yet

The seam itself is **not built**. Placement is still the single app-side
heuristic. But a few adjacent pieces landed this session that the seam will
build on, or that already realize slivers of the ideas below:

**Built:**
- **Auto-height fit on insert** — `Board.insert()` now measures auto-height
  kinds (text) and corrects their stored `h` via `EditController.fitHeight()`
  ([edit.ts](packages/engine/src/content/edit.ts), [board.ts](packages/engine/src/board.ts)).
  This is *intrinsic sizing*, the one slice of "layout resolves geometry, not
  the caller" that exists — agents/palette pass a placeholder and the engine
  fixes it. The general width/position seam is still missing.
- **Reading-order inference** — `App.orderedFrames()` ([app.ts](apps/board/src/app.ts))
  greedily row-clusters `card` nodes (rows top→bottom, each left→right) for
  presentation order. This is a working prototype of the "gestalt → structure"
  read (proximity/order) and the kind of pure function a `flow`/`timeline`
  strategy needs — but it lives in the app, computes order not positions, and
  isn't the seam.
- **Animated camera tween** — `CameraAnim.flyTo()` (Van Wijk) exists, so the
  "animated re-layout" open question below has its easing primitive ready;
  layout deltas could route through the same machinery. (It currently animates
  the *camera*, not node positions.)

**Not built (all still sketch):** the `Layout` interface and registry; any
strategy (`freeform`/`flow`/`grid`/`pack`/`timeline`/`graph`); the
managed/pinned per-node flag; container/cross-cutting scope; persisted layout
*intent*; the commit ("tidy") and **lens (fisheye/DOI)** application modes; the
`board_layout` MCP verb. `insertPlacement` is unchanged and remains the only
placement logic.

## The problem: there is no layout engine, only heuristics

- `insertPlacement()` ([app.ts:146](apps/board/src/app.ts:146)) lives in the
  board *app*, not the engine. It does exactly one thing: drop the node into
  the selected/nearest frame, stacked flush below that frame's existing
  children; else below the last selection; else viewport center. One-shot —
  the returned `{x, y, w}` is baked into the node and never reconsidered.
- The engine's `Board.insert(node)` takes a node whose `x/y/w/h` are already
  decided. The engine has no opinion about position at all.
- **eka-sitemap doesn't use `insertPlacement`** — it shelf-packs 2,296 nodes
  into √n grids with its own bespoke code at seed time. Two canvas use
  cases, two unrelated layout implementations, nothing shared.

A third use case (the lineage board: era frames as timeline columns by year,
trace swimlanes crossing them, link-card grids) would be a third bespoke
implementation. That recurrence is the signal: layout wants to be a seam,
exactly like `Tool`, `NodeKind`, `ContentSpec` already are.

## The load-bearing requirement: re-runnable, not one-shot

"Adjust later" kills the current model. `insertPlacement → {x,y}` can never
re-flow — inserting node 5 can't reconsider nodes 1–4. The fix is to treat
**layout as a pure, idempotent function of a node set + intent**, callable on
demand, not a position computed once and forgotten.

```ts
interface Layout {
  id: string;            // 'freeform' | 'flow' | 'grid' | 'pack' | 'timeline' | 'graph'
  apply(nodes: Node[], params: object, ctx: LayoutCtx): Map<NodeId, Rect>;
}
```

Persist BOTH: the resolved `x/y/w/h` (so freeform survives, and a viewer
without the solver still renders) AND the layout *intent* on the container
(`{layout: 'timeline', key: 'date'}`). Intent is what makes re-running
possible; coordinates are the cached result.

## Manual + parametric coexisting — three application modes (the key idea)

A layout strategy isn't a mode the board lives in; it's a function you can
apply three ways, and manual placement always sits underneath as the
authoritative ground truth (the "squishy default" — Maggie Appleton's
squish-vs-structure: hand placement is sacred, automation is an *offered
service*, never enforced). The same `apply()` runs in all three:

1. **insert** — resolve one new node's slot (today's `insertPlacement`).
2. **commit / "tidy"** — bake new positions for a node set, as one undoable
   history entry. This is the "rearrange them for me" verb: align, distribute,
   grid-pack, arrange-by-date. Reversible (⌘Z), but it *does* edit stored
   coordinates. You shuffle by hand; you invoke tidy when you want help; you
   undo tidy to get your spatial memory back.
3. **lens — temporary, non-destructive** — the one the user actually wants. A
   transient transform *layer* that rearranges/magnifies a region for a
   specific use case, **without touching stored positions**; pop out → animate
   everything back to true coordinates. The board is "temporarily rearranged"
   as a *view*, not an edit.

The lens is the missing primitive. It's the same trick the media proxy and
auto-height use — a render-time resolution over canonical state — applied to
*position* instead of `src`/`h`. Stored layout stays manual; the lens is a
projection on top.

### The lens is fisheye focus+context (with a DOI backbone)

The literature for "magnify and reorganize one region while keeping the whole
visible" is **focus+context / fisheye** (Furnas 1986; Wattenberger's *Fish
Eye*). Don't choose between focus and context — show both: the focal region
in full detail and re-spaced for legibility, the surroundings compressed but
still on screen (not panned away, not a separate view).

Drive it with a **Degree-of-Interest** function rather than raw geometry:

```
DOI(node) = API(node) − D(node, focus)
```

`API` = intrinsic importance (pinned, selected, large frame, search-hit,
recently edited); `D` = canvas distance (or graph distance along connectors)
from the focus. DOI then decides, per node: magnification factor, semantic LOD
(full card → title+thumb → dot), and whether it survives as a *landmark* when
its neighbors collapse. Quantize into a few rings (reuse the existing zoom-LOD
tiers) so it animates cleanly on the GPU instead of continuous per-pixel
distortion. Focus follows selection: change focus → DOI recomputes → layout
re-eases.

### Lens use cases (all temporary, all non-destructive)

- **Presentation** is already a temporary *camera* rearrangement; the lens
  generalizes it to a temporary *node* rearrangement — "explode this frame's
  children into a readable column while I talk, then snap back."
- **Focus mode** — lens on a node/frame: magnify it + its connected
  neighbors, compress the rest.
- **Compare** — pull instances of one card into a temporary row of small
  multiples (the ladder-of-abstraction "parameterize" move), restored on exit.
- **Arrange-by-X preview** — see the board as a timeline / by-date / cluster
  *without committing*; release to restore your manual arrangement. (The same
  strategy can run as a lens preview OR a commit — the user picks.)

Implementation: a lens is a `Map<NodeId, Rect>` delta layer the renderer
applies over stored rects, animated in/out with the `CameraAnim` Van Wijk
easing already built for presentation. No persistence, no history — it's
ephemeral by construction.

## Three decisions that fall out

### Scope is genuinely both container and cross-cutting

- **Container-scoped** (Figma auto-layout): a frame owns how its children
  flow — stack / grid / wrap. Most everyday structure.
- **Cross-cutting**: a timeline spanning the whole board; swimlanes crossing
  it; a force graph of relationships. Not bounded by one frame.

So `apply()` takes a node *set* at any scope — a frame's children, a free
selection, or the whole doc — not "a frame has a layout" alone.

### Composable / nested layouts — clusters within clusters

The seam should **compose recursively**: a container's layout positions its
children, and a child can itself be a container with its *own* layout. A
`grid` of frames, each frame a `flow` stack, one stack holding a `pack`
cluster — arbitrary nesting. This is the natural data model for the board
(clusters inside clusters inside clusters) and the thing the eka-sitemap and
lineage boards both want but hand-roll today.

Resolution is **innermost-first, bottom-up**: a leaf container runs its layout
and reports its resulting size; its parent then lays out *that size* as one
unit; up to the root. (Figma's auto-layout works exactly this way — it needs a
measure pass, which the autogrow `fitHeight` work is the first sliver of.) A
cluster is therefore both a *managed child* of its parent and a *layout host*
for its children — the same node wearing two hats by depth.

Implications: layout intent lives per-container (so each nesting level can pick
its own strategy); `apply()` recurses; and the **lens** (§ temporary
rearrangement) can target any level — explode one cluster's children while its
siblings stay packed. This is the composability the brief asks for; the open
question is just whether v1 resolves nesting eagerly (whole tree on any change)
or lazily (dirty subtrees only).

### Computed vs manual — resolved by managed/freeform per node

If layout recomputes, manual nudges get clobbered. Figma's rule is the clean
one: a node is **either** managed by its container's layout (can't be freely
dragged) **or** freeform. Add a per-node `managed`/`pinned` flag; pin/unpin
is the escape hatch. **Freeform stays the default** — it's an infinite
canvas; manual placement is a feature, not a deficiency (why tldraw/
Excalidraw ship almost no auto-layout). Auto-layout is opt-in structure.

### Lives in the engine, strategies as plugins, app composes

Mirror the existing plugin seams. Engine defines the `Layout` interface and
ships a few reference strategies; the app registers more and chooses/composes
them — same shape as `tools: [...]` in `BoardOptions`.

## Strategy roadmap (pure functions first, no solver)

Ship, in order:

1. `freeform` — identity; manual placement, the default.
2. `flow` — the current frame-stacking generalized (direction, gap, padding,
   wrap). Subsumes `insertPlacement`.
3. `grid` — fixed cols/rows or auto from count; the link-card corpus.
4. `pack` — shelf-pack lifted from eka-sitemap (√n, area-targeted rows).

Then, only when a use case needs them (and only these pull deps):

5. `timeline` — position by a numeric/date key along an axis; the lineage
   board's spine.
6. `graph` — force / layered (dagre or elk) for the trace diagrams,
   connectors, mind-maps.

**Do NOT build a general constraint solver (kiwi/Cassowary) on day one.** The
pure-function-per-strategy model covers all three known use cases. Constraints
are a later escalation only if node *relationships* must be continuously
maintained rather than recomputed per run.

## Intrinsic tile sizing — kinds declare their "good height"

A grid/flow strategy decides *positions*; it should not decide a node's ideal
*proportions*. That's the kind's business. The autogrow already built is the
text case (a kind reporting its intrinsic height); generalise it:

```ts
// NodeKind
fitTile?(node, w): { h: number; patch?: Partial<T> };
```

Given a column width, the kind returns the height it wants — and an optional
patch to fit. `text` → measured auto-height; `image` → natural aspect (cover);
`video` → 16:9; **`website` → crop the top to its good aspect** (default ≈ 1:2),
the patch being the `crop` window (see [document.md](document.md) — `fitTile` is
literally crop-to-fit). So `grid` asks each member's kind for its tile height
instead of forcing one number; uniform-aspect galleries pass an explicit
`aspect` to override. This keeps "where" in the layout seam and "how tall" in the
kind — the clean split the gallery experiment surfaced.

## What this does to the agent / MCP

It removes pixel math from the agent the right way: the agent emits
**structure + intent**, never coordinates. It builds the lineage board by
creating era frames, inserting dated nodes, and calling
`board_layout(frame, 'timeline', {key: 'date'})` — the engine resolves
positions. The agent becomes just another consumer of the layout seam, same
as the human UI and `@board` chat commands — one vocabulary for all three
(the convergence the [lineage](lineage.md) notes keep predicting).

MCP ([mcp](mcp.md)) grows one verb beside `board_insert`:
`board_layout(scope, strategy, params)`.

> **Reality today:** the agent *does* do pixel math. When it built the lineage
> board it passed explicit `x/y` for every frame and text node (and then needed
> 15 follow-up `board_patch` calls to fix clipped heights, before autogrow
> landed). `board_insert` routes through `insertPlacement` only when `x/y` are
> omitted; `board_layout` doesn't exist. This section is the target state — the
> gap it closes is exactly the friction that lineage-board build exposed.
>
> **Second instance (2026-06-13):** the inspiration gallery (see
> [document.md](document.md)) was hand-laid the same way — the agent looped
> `board_patch`, computing each tile's `x/y/h` and the per-kind crop. That is
> exactly `board_layout(ids, 'grid', { cols, gap, tileWidth, aspect })` with
> per-tile height from `fitTile`. Two independent builds now want this verb.

## Sequencing & cost

1. **Layout seam + freeform/flow/grid/pack.** Refactor `insertPlacement` AND
   eka-sitemap's packer to both go through it. The keystone — do it first,
   independent of agents.
2. MCP/proxy on top, with `board_layout` as a verb.
3. `timeline`/`graph` when the lineage board or trace diagrams need them.

Honest caveat: this is the most invasive item in `plans/` — it touches the
engine's insert path and the persistence schema (managed flag + container
intent). Not the "mostly a copy job" the [image-proxy](image-proxy.md) is.
But the agent story is only as good as this seam, so it's the gating piece.

## Open questions

- Does `managed` re-flow trigger on every child change (live, Figma-style) or
  only on explicit re-run? Live is nicer but couples layout into the change
  loop; explicit is simpler for v1.
- Nested managed containers — a `flow` frame inside a `grid` frame: resolve
  innermost-first, parent sizes to children? (Figma does; needs a measure
  pass.)
- Cross-cutting layouts (timeline/graph) over nodes that ALSO live in managed
  frames — who wins? Probably: cross-cutting positions the frames, frames
  position their children.
- Should `freeform` nodes inside a managed frame be allowed (overlay
  annotations on a grid), or is membership all-or-nothing?
- Animated re-layout: glide adjustments instead of snapping. Note this is the
  **node channel**, distinct from the camera: it reuses the *eased-tween
  scaffolding* from `CameraAnim` (clock + easing curve), **not** the Van Wijk
  path (that's camera-specific; node deltas are plain eased rect-lerps). Camera
  and node motion are orthogonal channels that compose — full design in
  [dynamics](dynamics.md), which folds the lens, connectors, and connect-
  gestures into one pluggable substrate.
