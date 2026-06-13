# Import — drop files / folders onto the board, organized

Sketch, 2026-06-13. Drop one image, many images, or a whole **folder** onto the
board → they become nodes and lay themselves out (a grid). The local-bytes
sibling of [website capture](document.md) (which ingests *URLs*): same end shape
(media nodes + a layout), different source. The agent can do it too.

## The two halves: ingest, then organize

Import is **ingest** (bytes → nodes) **+ layout** (arrange them). The layout half
is already specified — it's the [grid strategy](layout.md) and the gallery's
good-height work; import is its first real consumer for *local* media. Keep them
separate: a clean ingest that produces nodes, then `board_layout(ids, 'grid', …)`.
Don't hand-roll positioning (the lesson from the inspiration-gallery build).

## Ingest — where the bytes come from

Three sources, all converging on "image (or media) nodes":

- **Multi-file drop** — HTML5 `drop`; `dataTransfer.files` is the dropped set.
- **Folder drop** — `dataTransfer.items[i].webkitGetAsEntry()`; recurse
  directories with `FileSystemDirectoryReader.readEntries()` (Chromium — the
  target env), collecting every file entry, filtered to images by MIME/ext.
- **Picker** — a palette "Import…" command via `showOpenFilePicker` /
  `showDirectoryPicker` (File System Access API), for users who'd rather click.

Route by MIME/extension to the right kind: image → `image` node (now croppable,
corners-scale/edges-crop), and later pdf → [`document`](document.md), video →
`video`, `.glb` → `three`, `.md`/`.txt` → `text`. **Image-first**; the dispatch
is the extensibility seam.

## Where the pixels live — the real decision (persistence)

A dropped file is **local bytes, not a URL**. The board persists to storage and
reloads; the node's `src` must survive that. Options:

| store | persists reload | scales (a folder) | notes |
|---|---|---|---|
| `URL.createObjectURL` | ✗ (revoked) | ✓ | instant, but broken images after reload |
| data URL (base64 in `src`) | ✓ | ✗ | inflates ~33%, blows the ~5 MB localStorage cap fast |
| **IndexedDB blob store** | ✓ | ✓ | **recommended** — bytes off the doc, no bloat |
| dev sidecar → disk | ✓ | ✓ | needs the server; good for *shareable* boards |

**Recommendation: an IndexedDB blob store.** Store each `Blob` keyed by a
**content hash**; the node's `src` is `idb://<hash>`. The image kind's existing
**`resolveSrc` seam** ([image-proxy.md](image-proxy.md)) is exactly the hook:
`resolveSrc('idb://h')` reads the blob once per session and returns a cached
`blob:` URL. So the doc stays small and canonical (just the hash), bytes live in
IndexedDB, and rendering is a same-origin `blob:` URL — no taint, textures in GL,
no proxy. Content-hash keying **dedups** (drop the same photo twice → one blob)
and makes the id stable/portable. Revoke `blob:` URLs on node cull to bound
memory.

This composes cleanly with what exists: `/capture-img` and `/proxy` are the URL
cases; `idb://` is the local-bytes case; **all three resolve at render time
through the same seam.**

(The dev **sidecar-to-disk** variant — POST bytes → `.data/imports/<hash>.ext`
→ served same-origin as `/import-img/<hash>` — is the right call only when the
board is meant to be *shared/deployed* and bytes must outlive one browser's
IndexedDB. Defer; it's a swap behind the same `src`-resolution seam.)

## Organize → grid (reuses [layout.md](layout.md))

After ingest, arrange: `board_layout(ids, 'grid', { cols, gap, aspect? })`.

- **cols** auto from count (`ceil(sqrt(n))`, capped at ~5–6) or fixed.
- **gap** the standard 24 (the frame-padding constant).
- **tile sizing** via the kind's `fitTile`: images keep **natural aspect**
  (a masonry / contact-sheet that respects each photo) **or** pass an explicit
  `aspect` for uniform cover-cropped tiles (a tidy square/landscape grid). Offer
  both — the gallery showed uniform reads cleaner, but a photo dump often wants
  aspect-true.
- **origin** = the **drop point** (world coords under the cursor), or the
  selected / nearest frame; wrap into rows from there.
- Re-runnable (the layout seam) → "re-tidy" after you've nudged things.

## Could MCP do it too? — yes, and from a real path

The agent can't read the user's filesystem *through the browser* — but the dev
**sidecar runs in Node and can**. So the symmetry with capture holds: the human
drops *bytes-without-a-path*; the agent names a *path-without-bytes*; both land
on image nodes + a grid.

- **`board_import(source, opts)`** — `source` is a **local folder/file path**
  (the sidecar enumerates images and serves them same-origin from
  `/import-img/<hash>`, returning the list) **or** a list of **image URLs** (no
  sidecar needed — proxy-resolved). `opts = { layout: 'grid'|'row'|…, cols,
  aspect }`. Returns the inserted node ids.
- Implementation: it's `board_insert` ×N + `board_layout` under one verb —
  exactly the inspiration-gallery flow, generalized to local files. "Import
  `~/Pictures/trip` as a 4-wide grid" becomes one call.
- The URL-list path needs nothing new (existing `board_insert` + the proposed
  `board_layout`); the folder path needs the sidecar `GET /import?path=` reader.

**Guard:** a path-reading endpoint is a dev tool — restrict reads to a
configured root (e.g. under `$HOME`), reject traversal, like capture's private-IP
guard. Note it in the v1.

## v1 cut

1. **Drop** (multi-image + folder, Chromium) → IndexedDB blob store
   (`idb://hash`, `resolveSrc` → `blob:`) → `image` nodes → `board_layout` grid
   at the drop point. Palette "Import…" via the picker.
2. **MCP** `board_import(folderPath | urls, { grid })` — folder via the sidecar
   fs reader (rooted/guarded), URLs via insert+layout.

No thumbnails, no non-web formats, image-only kinds — all later.

## Open questions

- **IndexedDB vs sidecar disk** — IndexedDB canonical (offline, client-only);
  add the disk mirror only when boards are shared. Both behind one `src` seam.
- **Huge folders** (1000s of photos) — cap + warn, or paginate/virtualize the
  import; **downscale a thumbnail on import** (store thumb for the node texture,
  keep the original blob for crop/export)?
- **Dedup scope** — per-board or a global blob store shared across boards.
- **Folder → structure** — should subfolders become frames / clusters
  (nested layout), or is it a flat grid? (Nice; defer — ties to the composable
  layouts in [layout.md](layout.md).)
- **Non-web formats** (HEIC, RAW, TIFF) — need conversion (sidecar/`sharp`) or
  skip with a notice. Web formats only in v1.
- **Drop target** — free grid at the drop point vs. flowing into the
  selected/nearest frame (the [layout](layout.md) `flow` vs `grid` choice).
- **Memory** — many live `blob:` URLs; revoke on cull, recreate on demand.
