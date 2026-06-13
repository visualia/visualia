# Grouping — inferred, proximity-managed groups

Sketch, 2026-06-13. *(Prototyped end-to-end 2026-06-13 — `groupOf` + shift
click/drag/hover/nudge with a violet preview — then reverted; the proximity
inference felt too eager / unpredictable in use. Kept as a sketch to revisit,
likely with tighter or scroll-tunable thresholds and explicit-frame membership
leading.)*

Groups you don't have to make. Instead of creating a group
object, the board **infers** which elements "go together" from the layout
itself — proximity, containment, a header above a cluster — and recomputes it
live. Operations act on the inferred group: **shift-drag moves the whole group**,
**shift-hover previews it** (a distinct-colour outline around the members that
will come along). Manual placement stays sacred (plain drag moves one);
grouping is an *offered* convenience, never enforced — the squish-vs-structure
default again.

## What "seems to go together" — the signals

Ranked; the grouping function combines them.

1. **Containment** — a frame + the nodes inside it. Hard, explicit, unambiguous.
2. **Header attachment** — a text node sitting just above and horizontally
   overlapping a row/grid is its **label** (the cluster-header case the user
   named). Proximity + reading order.
3. **Proximity** — single-linkage clustering by gap: nodes nearer each other
   than to the rest. **Scale-aware** — the threshold is relative (a multiple of
   the median neighbour gap / node size), not an absolute px, so it survives
   zoom and dense vs sparse regions.
4. **Alignment / kind affinity** — a clean row/column, or a run of same-kind
   nodes (an image strip), reinforces a proximity group.

## The grouping function (pure, re-runnable)

```
groups(nodes)        → NodeId[][]     // every inferred cluster
groupOf(node, nodes) → NodeId[]       // the cluster this node belongs to
```

Geometry-only, no stored state — like `snap` and `orderedFrames` (which is
already a sliver of this: row-clustering by vertical overlap). It **composes with
explicit structure** ([layout.md](layout.md)): inside a *managed* frame the frame
IS the group (hard membership wins); elsewhere proximity infers (soft).

## Gestures

- **plain drag** = move one node (freeform, sacred).
- **shift-drag** = move the inferred group ("…and friends"). Resolve `groupOf`,
  translate those ids as a unit (reuses multi-select drag).
- **shift-hover** = *preview*: outline each prospective member in a **third
  hue** (not selection-blue `#0d99ff`, not snap-red `#f24822` — a green/violet),
  plus a faint unifying bbox. Answers "which ones come along?" before you commit.
- **cluster header** = always carries its cluster (a header alone is
  meaningless) — dragging it moves the group, shift or not.
- **modifier / scroll** to tighten/loosen the proximity threshold — grow or
  shrink the inferred group on the fly (like crop's parent-cycle on overlaps).

## Rendering

A new overlay channel beside selection (blue) and guides (red): **group hints**
in a third colour. The renderer already composites an overlay list from
`input.selection` / `marquee` / `guides`; add a `groupHints: Rect[] | outlines`
channel the SelectTool fills on shift-hover and clears on leave.

## Inferred vs explicit (and how they meet)

Soft inference is the **default** — zero commitment, recomputed each interaction.
A **managed frame** is the **hard** opt-in. They compose, and the bridge between
them is *commit*: "tidy" / `board_cluster` ([clustering], [seeing.md](seeing.md))
takes an inferred group and **materialises it as a frame** — the moment a fuzzy
proximity cluster becomes a real container with its own layout. So the same
group flows soft → previewed → moved → (optionally) committed to structure.

## Relation to the rest

- [layout.md](layout.md): inferred groups are *what layout strategies arrange*;
  clusters-in-clusters; the **lens** can target an inferred group ("explode these
  while I talk"). `orderedFrames` is the first row-clustering prototype.
- [seeing.md](seeing.md) / clustering: the agent's by-eye clusters are *explicit*
  groups the agent asserts; this is the **human + geometry** counterpart — same
  destination (a frame + a layout), different author.
- DOI (topics.md): proximity grouping is the discrete cousin of the continuous
  degree-of-interest *distance* term.

## v1 cut

1. `groupOf(node)` from **containment + proximity (single-linkage, scale-aware) +
   header attachment** — pure, in the engine (peer to `snap`).
2. SelectTool: **shift-drag** resolves + moves the group; **shift-hover** sets
   `groupHints`.
3. Renderer **group-hint overlay** (third colour).

Defer: the threshold-tuning scroll gesture, alignment/kind signals, and the
commit-to-frame step (that's the layout/clustering seam).

## Open questions

- **Threshold**: relative (median spacing / node size) and zoom-aware — what
  constant? Must not flicker frame-to-frame (quantise the clustering).
- **Ambiguity / nesting**: overlapping or nested inferred groups — which one
  shift picks (smallest enclosing?), and how the widen-gesture climbs.
- **Stability**: re-inferring on every move must be cheap and stable (spatial
  index + hysteresis).
- **Managed frames win**: a node in a managed frame groups with the frame, full
  stop — proximity doesn't override hard membership.
- **As-a-unit ops**: does shift also make resize/align act on the whole group?
