# board

The wall's document, layouts and DOM renderer. Vanilla JS, no dependencies.
See `plans/board.md`.

- `src/doc.js`: records and ops (`put`, `set`, `del`), applied in server order.
- `src/layouts.js`: `canvas`, `feed`, `people`. These are pure functions from
  records to boxes.
- `src/sync.js`: `createHub` (the Class DO's sequencer) and `createClient`
  (optimistic, pending overrides, replay on reconnect). Same code in the DO
  and the browser.
- `src/wall.js`: `createWall(el, { imageUrl, placeholder, onOp, onOpen,
  nameOf, scroller })`. One plane, culling with recycled tiles, image widths
  by on-screen size and a decoded-memory cap, at most 6 loads at once, and
  zoom levels on the canvas. Without `onOp` it is read-only.
- `src/wall.css`: uses `visualia.css` variables only.

Demo, from the repo root:

```sh
python3 -m http.server 8765    # any static server works
# open http://localhost:8765/packages/board/demo/
```

It has 400 fake works by 24 people in 8 groups. A narrow window shows the
feed; a wide one shows the canvas. The corner of each picture shows which
image width was asked for.

Tests, including the convergence fuzz (`SEEDS=n`, default 3,000, ~4 s):
`node --test packages/board/test/*.test.js`

The studio copies `src/` to `apps/studio/public/board/` at build.
