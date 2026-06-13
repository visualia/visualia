# Dynamics — pluggable motion, connectors & connect-gestures

Sketch, 2026-06-13. One architecture for three things the board needs to move
and grow: **camera animation**, **temporary arrangements of nodes** (the lens),
and **connectors** (cables between elements) with the **gestures** to make and
break them. The brief: make it as modular and pluggable as possible — an
exploration space where different algorithms (bezier vs physics cables, fisheye
vs spotlight, magnetism vs ports) live side by side and apps pick.

## The unifying idea

All three are **dynamic, pluggable behaviors composited over the canonical doc
via render-time resolution, driven by one clock.** None of them mutate stored
state (except an explicit "commit"). This is the same trick already used by the
media proxy (`src` resolved at render), autogrow (`h` resolved on insert), and
the planned fisheye lens (position resolved at render). Generalize it:

```
doc (nodes + edges)                      ← source of truth, the only persisted thing
  → layout resolution (managed rects)    ← layout.md seam
  → transient layers (lens / re-layout deltas)   } node channel
  → connector geometry (routers, physics)        } read (possibly-animated) anchors
  → camera transform                              } camera channel
  → render (GL pass: edges under nodes)
```

Three plug points, one shared substrate. Decompose every algorithmic choice
into a **registry** so apps swap implementations.

## Where the code lives — one package: `@visualia/dynamics`

The three concerns share a substrate, so they share a package. `@visualia/
dynamics` is the whole pluggable dynamic layer — *its own exploration space* —
internally modular via sub-registries, externally one unit. It depends one-way
on `@visualia/engine` (the doc's awareness that edges exist, and the renderer/
tick seams), exactly like `three`, `shadcn`, `mcp` already do. The engine never
imports dynamics.

- **`@visualia/engine`** keeps only the **seams** the core loop and persistence
  can't function without:
  - **immediate camera only** — the core owns `Camera` state, the transform
    math, and **direct pointer/touch pan + zoom** (drag pans, wheel/pinch zooms,
    *now*, no easing). That's the floor. It can also *set* the camera instantly
    (jump to a target). It does **not** animate the camera — no smoothing, no
    inertia, no fly. Any motion-over-time is a dynamics layer that drives the
    camera each frame via the tick. (So `zoomToFit()` in the bare engine is an
    instant jump; the *animated* version is a dynamics concern or an app opt-in.)
  - the **steppables tick** — `Board` owns the rAF loop; expose
    `registerSteppable({step(dt)})` so any dynamic subsystem advances on it
    (zero cost idle, the existing `animating || liquid` pattern generalized).
  - **renderer hooks** — a render-pass registry (a GL pass can register to draw
    *under* nodes — the connector pass) and a **node-rect-delta** hook (a layer
    can supply per-node rect overrides the renderer composites — the lens /
    node-animation channel).
  - **edges in the doc** — a generic edge collection persisted/serialized like
    nodes are, so connector *data* survives; connector *behavior* lives in
    dynamics (same split as `NodeKind`: engine knows "edges exist," dynamics
    knows "how they route, hang, and render").
- **`@visualia/dynamics`** holds everything algorithmic/exploratory:
  - **motion** — tween core + `Easing` registry; the **node animator** (rect
    channel); and **all camera animation** — exponential smoothing, inertia,
    Van Wijk fly, spring, camera-along-connector. The engine pans; dynamics
    makes the camera *glide*. (An app that wants no animation just doesn't load
    this; pan/zoom still work.)
  - **lenses** — the `Lens` registry (fisheye/DOI, spotlight, magnify-cursor,
    arrange-by-X preview), feeding the node-delta hook.
  - **connectors** — the `Edge` *behavior*: `ConnectorRouter` registry (straight
    / elbow / bezier / physics-`cable`), the GL render pass, animated flow-dots.
  - **gestures** — the connect/break `Tool` plugins (nudge-to-connect,
    snap-apart-to-break, drag-from-edge).
- **apps compose** — pick easings, camera paths, lenses, routers, gestures from
  the registries, same shape as `tools: [...]` / `kinds: [...]` in `BoardOptions`.

> **Migration (the engine boundary):** the right line is *minimum core* — the
> engine owns only immediate pointer pan/zoom; **everything that animates the
> camera lives in dynamics**, Van Wijk included (it's one presentation-specific
> path, not core). Today `CameraAnim` + `flyTo` sit in the engine because they
> were built before this package existed — that's the thing to extract, not
> preserve. The extraction is real work (the engine's `zoomToFit`/`zoomStep`/
> wheel-smoothing/touch-inertia currently lean on `CameraAnim`); after it, bare
> `zoomToFit()` is an instant jump and an app/dynamics supplies the glide.

## 1. The motion substrate — the clock + tween core

One **rAF tick** already exists (`Board.tick`, which loops while
`animating || liquid`). Generalize it into a **steppables registry**: any
subsystem that needs per-frame advancement (camera anim, node anims, connector
physics, effects) registers a `step(dt)`; the tick runs them and keeps looping
while any is active. **Zero cost when idle** — the loop stops when nothing
needs stepping (the existing pattern).

The **tween core** is a minimal primitive: a clock + an easing + "advance
toward target." Easing is a **pluggable registry** (`smoothstep`, `cubic`,
`spring`, …). This is the *scaffolding* shared by both animation channels — the
part that's genuinely reusable from `CameraAnim` (not the Van Wijk path; see
below).

## 2. Two animation channels — orthogonal and composable

The distinction that matters (and that "reuse flyTo" earlier blurred): **camera
and node motion are separate channels.**

- **Camera channel** *(lives in dynamics, not core)* — animates the viewport;
  nodes keep their world coordinates. Pluggable **`CameraPath`** strategies:
  exponential smoothing, **Van Wijk fly** (presentation), linear, spring,
  camera-along-connector. *Migration note:* `CameraAnim` (incl. Van Wijk) is
  **currently in the engine** — built for presentation before this package
  existed. It should move to `@visualia/dynamics`, leaving the engine with only
  immediate pointer pan/zoom (per the package map above). The two hardcoded
  modes become a path registry.
- **Node channel** *(not built)* — animates per-node rects (position/size) from
  current → target. A **plain eased rect-lerp**, *not* Van Wijk: a node moving
  100px wants an eased straight interpolation, not a zoom-out arc. Shares the
  easing curve with the camera channel, not the path math.

They **compose, case by case**:

| Operation | Camera | Nodes |
|---|---|---|
| Presentation (fly between frames) | ✓ | — |
| Tidy / arrange-by-date (commit) | optional (fit after) | ✓ |
| Fisheye lens / temporary rearrange | usually — | ✓ |
| Focus-a-frame-and-explode-its-children | ✓ | ✓ |

The Van Wijk path being camera-specific is *why* they're separate registries.

## 3. Temporary arrangements = transform layers (the lens)

A **lens** is a pure function `(nodes, focus, params) → Map<NodeId, RectDelta>`,
eased in/out by the **node channel**, applied at render time over stored rects —
**no doc mutation, no history** (ephemeral by construction). Pluggable **`Lens`
registry**: fisheye/DOI (`importance − distance`), spotlight, magnify-cursor,
arrange-by-X *preview*. This is the [layout](layout.md) "lens" application mode;
the same strategy can run as a lens preview *or* a commit (which does mutate, via
the node channel + history). The DOI score is the unifying backbone (drives
magnification + semantic-LOD + landmark survival).

## 4. Connectors — the exploration space

The future "connecting things." Designed as a self-contained pluggable package
so many ideas coexist.

- **Model** — an `Edge {from: Anchor, to: Anchor, kind, style, ...}` **bound to
  node anchors, not absolute coordinates**, so it *reflows automatically* when a
  node moves (tldraw's binding insight). Edges live in the doc beside
  `nodeOrder`. Anchors: fixed ports *or* nearest-edge auto-anchor (pluggable).
- **Routing registry** — `ConnectorRouter: (from, to, params, dt?) → Path`.
  Ships several, apps add more:
  - `straight`, `elbow` (orthogonal), `bezier` (cubic; control points derived
    from anchor normals/direction) — **static** routers, computed once per move.
  - **`cable`** — a **verlet/spring rope sim**: segments with gravity,
    stiffness, damping, so the cable **sags and swings like a real patch
    cable** (Propellerhead Reason's cables are the reference). **Dynamic** —
    needs per-frame stepping, so it joins the clock (§1).
  - **Physics is a param, toggleable** — `{physics: false}` → a static bezier;
    `{physics: true, weight, gravity}` → a hanging cable. Same edge, different
    feel.
- **Render** — a GL pass drawing edges **under** nodes (instanced curves). Style
  is pluggable (color, width, dashes, **animated flow dots** travelling the path
  to show direction/dataflow).
- **Camera-along-connector** — a connector's `Path` *is* a `CameraPath` (§2): the
  camera can **fly along the cable, "going through the flow."** This falls out of
  the registry unification for free — a lovely reuse, and a distinctive
  navigation mode (follow an idea-thread down its cable).

## 5. Connect-gestures — minimal UI, pluggable, physical

Like the `/` palette for inserting and the long-space-hold for the liquid
cursor: **connecting should have minimal, physical UI**, not a toolbar mode.
These are **gesture plugins** on the existing input `Tool` seam — apps choose
the feel (magnetism, explicit ports, or both):

- **Nudge-to-connect** — drag node A so its edge nears B: a **magnetic preview**
  cable appears as they approach (attraction grows with proximity); contact or
  release **commits** the edge. No menu, no mode.
- **Snap-apart-to-break** — yank two connected nodes apart past a **velocity
  threshold** → the cable **breaks** (with a recoil/snap animation, like
  physically unplugging). Slow separation keeps it (the cable just stretches);
  only a fast yank cuts it. Real-world intuition: magnetism + breaking tension.
- **Drag-from-edge-into-empty** — drag from a node's edge to blank canvas → node
  picker → a **new, already-connected node** (the tldraw create-and-wire
  gesture, the most ergonomic graph-building move).

The physical *feel* (magnetism curves, break tension, recoil) lives in the
gesture plugin and can be swapped — an app can use strict drag-from-port instead.

## Design principles (the rules that keep it modular)

- **Bindings, not coordinates** — connectors follow node anchors.
- **Render-time resolution** — transient layers (lens, animation, cable
  geometry) never mutate the doc; only explicit commits do.
- **Registries everywhere** — easing, camera path, node path, lens, router,
  gesture. Apps swap algorithms without forking the engine.
- **One clock, zero-cost idle** — a single steppables tick advances every
  dynamic subsystem; stops when nothing's moving.
- **Physics is opt-in** — a router/param flag; only physics routers and live
  lenses pay per-frame cost.
- **Camera & node motion are orthogonal channels that compose.**
- **Gestures are minimal and physical** — magnetism/nudge over menus.

## Sequencing

1. **Motion substrate + node channel.** Generalize the tick to a steppables
   registry; add the node-rect tween (shares easing with `CameraAnim`).
   Unlocks the lens *and* animated re-layout. Small, builds on what exists.
2. **Lens (fisheye/DOI).** The [layout](layout.md) temporary-rearrange, on the
   node channel. First real consumer of the substrate.
3. **Connectors v1.** Edge model + `bezier` router + GL pass + nudge-to-connect
   gesture. This is also the **lineage-visualization unlock** (idea-threads as
   cables) and the reactive-explorables unlock (edges = dependency graph).
4. **Connectors v2.** `cable` physics router + camera-along-connector +
   snap-apart-to-break. The "exploration space" proper.

## Open questions

- **Doc schema** — edges stored where (an `edges` map beside `nodes`/
  `nodeOrder`)? Version bump + deserialize/sanitize path, like nodes.
- **Anchors** — fixed ports vs nearest-edge auto-anchor; do anchors read
  *animated* node rects (cable follows during a fly) or settled rects?
- **Physics at scale** — cap simulated cables; freeze a cable's sim when both
  ends are still and it's at rest; LOD cables to static beziers when zoomed out.
- **Layering order** — node-channel deltas compose *on top of* managed layout
  (layout positions, then lens/anim deltas, then connectors read the result).
  Confirm the compositing order is stable.
- **Gesture disambiguation** — nudge-to-connect vs ordinary move/drag: resolve
  by proximity-intent + speed + maybe a modifier, so dragging near a node
  doesn't accidentally wire it.
- **Connector ↔ layout** — when a `graph` layout (dagre/elk) runs, do connectors
  drive it (edges are the graph) or just decorate? Probably: graph layout reads
  edges to position nodes; routers then draw them.
