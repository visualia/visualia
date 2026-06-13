# Images — current implementation & loose ends

Status note, 2026-06-13. What the `image` node actually is today (it grew a lot
this session: croppable, canvas-rendered, droppable) and the rough edges left.
Sibling docs: [document.md](document.md) (website/pdf share the crop machinery),
[import.md](import.md) (the drop/MCP feature), [image-proxy.md](image-proxy.md)
(the `resolveSrc` seam), [layout.md](layout.md) (where the grid should live).

## What's built

The board replaces the engine's plain `imageKind` with an **app-side croppable
image kind** ([image-kind.ts](apps/board/src/image-kind.ts)); the engine one
still exists/exports for other consumers but the board doesn't use it.

**Node shape** — `{ type:'image', src, crop?, srcW?, srcH? }`:
- `src` — one of: `http(s)://…` (proxied via [image-proxy](image-proxy.md)),
  `data:…` (e.g. a website crop), `idb://<hash>` (dropped file, see below), or
  `/import-img/<hash>` (folder import). All resolve at render through one seam.
- `crop` — the visible **source-px window** `[sx,sy,sw,sh]`. Absent ⇒
  object-fit-cover of the whole image, computed live.
- `srcW/srcH` — natural pixels, stamped on insert (`stampImageDims`, non-undoable
  `store.patchNode`) so the crop interaction knows the source resolution.

**Render** — a `<canvas>` (not an `<img>`): `drawWindow()` draws the crop window
at native source resolution; CSS scales it to the node box. The canvas is a valid
`texImage2D` source, so the same path works in **DOM and GL**. `resolveSrc` is
composed in the app: `idb://` → cached blob URL, everything else → the media
proxy. `update()` re-resolves whenever the *resolved* URL changes (so a late
`idb://` blob URL loads after rehydrate, and a swapped `src` reloads).

**Crop interaction** — shared with websites via
[croppable.ts](apps/board/src/croppable.ts) `cropConstrain`, wired through the
engine's `NodeKind.resizeConstrain(start, rect, handle, pxPerWorld)` hook
([kinds.ts](packages/engine/src/core/kinds.ts)): dragging an **edge or corner
crops** those sides — pixels pinned, the window moves, snapping to the image
bounds (and, for websites, element rects) with red guides, clamped to the image.
A corner crops its two sides. The first edge-drag on an un-cropped image
establishes `crop` from the cover baseline. Undoable (the resize commit diffs all
changed fields, including `crop`). No double-click mode; select + drag a handle.
*(Earlier this session corners aspect-scaled; that was reverted — corners crop
now.)* Legacy image nodes without `srcW/srcH` fall back to plain free-resize.

**Import** ([import.md](import.md), built) — drop one/many images or a **folder**
([import.ts](apps/board/src/import.ts), `webkitGetAsEntry` recursion) → image
nodes, masonry-packed at the drop point (`placeImageGrid`, one undoable batch).
Bytes persist in **IndexedDB** keyed by content hash
([idb-store.ts](apps/board/src/idb-store.ts)); `src = idb://<hash>`; `rehydrate()`
recreates blob URLs on load. **MCP** `board_import({ urls | path })` — URLs
board-side, a local folder via the sidecar
([vite-import.ts](apps/board/vite-import.ts), `GET /import?path=`, confined to
`$HOME`, copies to `.data/imports`, serves `/import-img/` same-origin).

Verified DOM-only this session: edge/corner crop (content pinned, snaps,
undoable), drop → `idb://` gridded + rendered, reload → rehydrated, `board_import`
urls + folder path.

## Loose ends

**Consistency / parity**
- **Video is not croppable** — `videoKind` is still the engine's plain
  `object-fit:cover` `<video>`. Images and websites window-crop via canvas;
  video doesn't. Either generalize the canvas-window render to video or accept
  the split.
- ~~**Two `ImageNode` types**~~ — *resolved 2026-06-13*: the engine's plain
  `imageKind`/`ImageNode` were deleted; the board's croppable image kind is the
  only one.
- **GL crop unverified** — the canvas-source path *should* texture cropped in GL,
  but everything was tested in DOM fallback. Needs a GL-mode pass.

**Crop UX**
- **No "is-cropped" affordance** and **no reset/un-crop** — once cropped, nothing
  signals it or restores the full image (you'd re-drag every edge out).
- **No aspect-lock / fixed-ratio crop**, no numeric crop entry; min window is a
  hard 16 source px.
- **No flatten/export** — a crop is a live window; there's no "bake this crop to a
  new image/file."

**Storage / memory**
- **No blob-URL revocation on cull** — `idb://` URLs accumulate for the session;
  `rehydrate` never frees. Revoke when a node is deleted / off-screen.
- **No orphan GC** — deleting an image node leaves its blob in IndexedDB forever;
  no reference counting or sweep.
- **No thumbnails / downscale** — full-res blobs (and full-page screenshots) are
  the texture; a folder of large photos is heavy and the grid tiles can be huge.
  Store a downscaled thumb for the node, keep the original for crop/export.
- **IndexedDB only** — no disk/sidecar mirror, so dropped images don't survive a
  cleared store and a board isn't shareable with its local images (the
  [import.md](import.md) "shared board" path is deferred).

**Import edges**
- **Image-only** — dropped PDFs/videos/`.glb` are ignored; the kind dispatch in
  [import.md](import.md) (route by MIME) isn't built.
- **No drop feedback** — no "dropping…"/progress overlay, no notice when a
  non-image or unreadable file is skipped.
- **Non-web formats** (HEIC/RAW/TIFF) silently dropped — need sidecar conversion.
- **Folder import caps at 200 files**, silently (`truncated` flag is returned but
  the UI ignores it); large libraries need paging/virtualization.

**Layout**
- ~~**Grid is hand-rolled**~~ — *resolved 2026-06-13*: the layout seam landed
  ([layout.md](layout.md)). `placeImageGrid` now builds nodes + `runLayout('grid')`,
  images expose `fitTile`, and `board_layout(ids,'grid',…)` re-tidies. Remaining:
  route `insertPlacement` / eka-sitemap's packer through the seam too.
