# Presentation mode — Prezi on the board

Sketch, 2026-06-12. Promoted from the `~/plans/visualia-engine-evolution.md` §7
backlog: *"saved camera frames + CameraAnim tweens = Prezi."* A board IS a
presentation surface — slides are just named camera states over content that
already exists. The engine has nearly everything; this is mostly app policy + UI.

## What already exists

- **`CameraAnim.animateTo({x,y,z})`** — exponentially-smoothed free animation;
  the slide transition is one call.
- **`camera.fitTarget(rect, pad)`** — rect → camera state; "frame this card"
  is solved.
- **Viewer interaction caps** (`interaction: 'viewer'`) — present mode = the
  existing read-only model (pan/zoom off or limited, dblclick-activate kept
  for links).
- **Frames (card kind)** — natural slide containers; a "slide" is usually
  `fitTarget` of a frame's rect.
- Zoom LOD / semantic zoom infra — overview steps ("show everything") degrade
  gracefully at far zoom.

## What's missing (the actual work)

1. **Slide list on the doc** — ordered, named camera targets. Two flavors:
   - `{ rect }` targets (follow a node/frame id — survives content edits), or
   - raw `{x,y,z}` (camera bookmarks, content-independent).
   Probably: `slides: { id, name, nodeId? , rect? }[]` stored next to
   `nodeOrder` in the doc (version bump) — node-bound when possible, rect as
   fallback. Resolved to camera state at step time via `fitTarget`.
2. **Present controller** (app layer): arrow keys / click / space step
   `current ± 1` → `anim.animateTo(resolve(slide))`; Escape exits. Enter via
   command palette ("Present") or `?present` URL param.
3. **Authoring UI**: "add current view as slide" (palette command, v1) and a
   slide strip (reorderable list with mini-thumbnails — minimap-from-rects-pass
   idea pays off here) for v2.
4. **Present chrome**: hide selection/banner/palette; optional progress dots.
   Maybe a CSS class on body (`.presenting`) is enough.

## Transition feel

`CameraAnim`'s exponential smoothing (TAU 0.04s) is tuned for direct
manipulation — snappy, not cinematic. Presentations want a slower, eased
glide and possibly a zoom-out-then-in arc for long jumps (the Prezi move).
Options: a `tau` override on `animateTo`, or a second tween mode
(duration + cubic ease, arc via midpoint keyframe when distance > viewport).
Engine change, but small and additive.

## v1 cut — ZERO-SETUP (chosen direction, 2026-06-13)

No authored slide list at all. Slides = the board's frames (`card` nodes),
ordered automatically by a "reading order" inferred from layout. Present
starts at the selected frame (or the logical first when nothing is selected),
arrow/space step through, Esc exits and flies back to the pre-presentation
camera. The persisted `slides[]` doc model above is deferred — this needs no
schema change and no authoring.

### A. Logical frame order (no authoring)

`orderedFrames()`: take all `card` nodes, cluster into rows (greedy: sort by
top y; a frame joins a row if its vertical center falls within the row's band
± tolerance, else opens a new row), sort each row left-to-right by x, flatten
rows top-to-bottom. For a grid (the lineage board) this yields exactly
2017→…→2026. "Logical first" = order[0] (top-left frame). Heuristic; refine
later for nested/overlapping frames. If zero frames: no-op.

### B. Present controller (app layer)

App state: `presenting`, `slides: NodeId[]` (snapshot at entry),
`slideIndex`, `savedCamera`. 
- `startPresentation()`: snapshot order; pick start index = selected card's
  index, else the card containing the selected node, else 0; save camera;
  clear selection; add `.presenting` body class; fly to slide.
- `next/prev`: clamp at ends (no wrap); fly to `fitTarget(frame.rect)`.
- `exit()` (Esc): fly back to `savedCamera`; drop `.presenting`.
- Keys: ←/↑/PageUp = prev; →/↓/Space/PageDown/Enter = next; Esc = exit.
  Click-to-advance optional (v1: keyboard).

### C. Keymap priority — needs one engine primitive

Bindings consume the event on first match, so a presenting-only ArrowRight
can't just guard inside `run` (it would still swallow the key and block
nudge). Add `KeyBinding.when?: () => boolean`; `matches()` returns false when
`when()` is false. Then `when: () => this.presenting` bindings (placed before
defaultKeymap) win while presenting and vanish otherwise. Tiny, generic
(useful for any modal binding). Esc already special-cased for edit sessions;
not editing while presenting, so it flows to the guarded Esc binding.

### D. Present chrome
`.presenting` body class hides the fallback banner, selection ring, palette
trigger; sets a plain cursor. Selection cleared on entry. v1 doesn't hard-lock
pan (harmless); could switch to hand tool later.

### Entry
Command palette item "▶ Present". Optional `?present` URL auto-start later.

## Animation algorithm — Van Wijk smooth zoom-pan (the cinematic fly-to)

The transition between two frames is where it lives or dies. Exponential
`animateTo` is snappy but does a straight pan that, for far frames at high
zoom, is a disorienting high-speed blur. The right algorithm:
**Van Wijk & Nuij (2003), "Smooth and Efficient Zooming and Panning"** — the
standard fly-to (Google Earth / Prezi). 

Parametrize the camera as (center `c`, viewport world-width `w = viewW/z`).
Given start (c0,w0) → end (c1,w1) with pan distance `u1=|c1−c0|` and a
curvature constant `ρ` (ρ²≈2, i.e. ρ≈1.414, is the perceptual optimum; larger
ρ = pull back more):
- same center (u1≈0): geometric zoom, `w(t)=w0·(w1/w0)^t`.
- else closed form gives a path that **zooms out, pans, zooms back in** —
  automatically arcing more the farther apart the frames are:
  ```
  b(i)=(w1²−w0²±ρ⁴u1²)/(2·w_i·ρ²·u1);  r(i)=ln(−b_i+√(b_i²+1))
  S=(r1−r0)/ρ                              // path length = natural duration
  w(s)=w0·cosh(r0)/cosh(ρs+r0)
  u(s)=w0·cosh(r0)·tanh(ρs+r0)/ρ² − w0·sinh(r0)/ρ²
  ```
  At normalized time t∈[0,1] (eased with smoothstep), s=t·S; set center by
  lerping c0→c1 by `u(s)/u1`, and `z=viewW/w(s)`.

The elegant part: **S is itself the perceptual cost**, so duration
`T = clamp(S/V, Tmin, Tmax)` (V = a velocity constant) makes adjacent
same-size steps snappy and whole-board jumps a longer cinematic arc —
without any per-transition tuning. One constant ρ for curvature, one V for
speed.

Implementation: a new timed `CameraAnim.flyTo(target, {rho?, v?})` mode
alongside `animateTo`; it precomputes the Van Wijk params and `step(dt)`
advances a clock, dispatching by mode. `animateTo` stays for direct
manipulation / inertia. This is the "second tween mode" the sketch
anticipated, now literature-backed instead of a hand-rolled midpoint.

Fallback if time-boxed: timed ease-in-out on (center, logZ) with a midpoint
"dip" toward `fitTarget(union(frameA, frameB))` — a cheap arc. Van Wijk is
~30 lines more and correct, so prefer it.

## Scope summary

- **Engine** (additive, generic): `KeyBinding.when?`; `CameraAnim.flyTo()`
  Van Wijk timed mode + `step()` dispatch.
- **App**: presentation state + `orderedFrames()` + start/next/prev/exit +
  guarded keybindings + `.presenting` class.
- **UI**: "Present" palette command; small `.presenting` CSS.
- **No** doc schema change, no slide authoring, no thumbnails/PDF (all deferred
  to the persisted-slides plan above).

## Confirm before building
- "Esc → previous setting" read as: restore the camera from *before*
  presentation (one saved state), not step-back. (Step-back is ←.)
- Non-card selected: start at the card containing it, else logical first.
- Clamp at ends (no wrap).

## Open questions

- Slides in the doc vs a sidecar list (separate localStorage key)? Doc feels
  right — they're content. But version-bump + deserialize path needed.
- Node-bound slide whose node was deleted: skip, or keep the last rect?
- Speaker view / notes — text node tagged per slide? (Way later.)
- Export: step-through screenshot sequence → PDF via the capture pipeline?
  Pairs with the gallery sidecar.
- Embeds: presentation web component = viewer embed + slide controller —
  ties into the "embeddable read-only boards" backlog idea.
