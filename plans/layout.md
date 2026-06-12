# Layout — a pluggable placement seam for the engine

Sketch, 2026-06-13. The prerequisite the [mcp](mcp.md) and agent ideas
quietly depend on. Today "where does a node go" is one hardcoded heuristic in
the demo app; it needs to become an engine seam with pluggable strategies
that are **declarative** (a function of the data) and **re-runnable** (so
layout can adjust after the fact), not a coordinate baked once at insert.

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

## Three decisions that fall out

### Scope is genuinely both container and cross-cutting

- **Container-scoped** (Figma auto-layout): a frame owns how its children
  flow — stack / grid / wrap. Most everyday structure.
- **Cross-cutting**: a timeline spanning the whole board; swimlanes crossing
  it; a force graph of relationships. Not bounded by one frame.

So `apply()` takes a node *set* at any scope — a frame's children, a free
selection, or the whole doc — not "a frame has a layout" alone.

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
- Animated re-layout: route layout deltas through `CameraAnim`-style tweening
  so adjustments glide instead of snap (ties into
  [presentation](presentation.md)).
