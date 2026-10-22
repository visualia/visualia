# board

The wall's document, layouts and DOM renderer. Vanilla JS, no dependencies.
See `plans/board.md`.

- `src/doc.js`: records and ops (`put`, `set`, `del`), applied in server order.
- `src/layouts.js`: `canvas`, `feed`, `people`. These are pure functions from
  records to boxes.
- `src/wall.js`: `createWall(el, { imageUrl, onOp, onOpen, nameOf })`. One
  plane, culling, image widths by on-screen size, and zoom levels on the
  canvas.
- `src/wall.css`: uses `visualia.css` variables only.

Demo, from the repo root:

```sh
python3 -m http.server 8765    # any static server works
# open http://localhost:8765/packages/board/demo/
```

It has 400 fake works by 24 people in 8 groups. A narrow window shows the
feed; a wide one shows the canvas. The corner of each picture shows which
image width was asked for.

Tests: `node --test packages/board/test/*.test.js`
