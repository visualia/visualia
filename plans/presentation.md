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

## v1 cut

- Doc: `slides[]` (name + nodeId|rect), palette commands "Add slide from
  view", "Present".
- Present mode: viewer caps + arrows/Escape + `animateTo(fitTarget(...))`.
- No strip UI, no arc tween — straight smoothing first, feel it, then tune.

## Open questions

- Slides in the doc vs a sidecar list (separate localStorage key)? Doc feels
  right — they're content. But version-bump + deserialize path needed.
- Node-bound slide whose node was deleted: skip, or keep the last rect?
- Speaker view / notes — text node tagged per slide? (Way later.)
- Export: step-through screenshot sequence → PDF via the capture pipeline?
  Pairs with the gallery sidecar.
- Embeds: presentation web component = viewer embed + slide controller —
  ties into the "embeddable read-only boards" backlog idea.
