---
status: idea
---

# Board sight: how an AI sees and edits a board

A proposal from a claude.ai chat (2026-10-28, brought in 2026-11-02). It waits
for the teacher's choice: `boards.md` builds one type or idea at a time, and
"how an AI sees a board" is one of its open items. Research behind it:
`research/canvas-agents.md`.

READ (checked 2026-11-02): records are `{ id, type, x, y, …fields, by, t }` in
the Board Durable Object (`apps/studio/src/board.js`), changed with `put`,
`set` and `del` over a WebSocket, each field checked per type.

**Goal.** An agent that reads a board precisely, acts through the same typed
operations people use, and is always visible and reversible.

## 1. Seeing: structure first, pixels second

- `records(viewport)`: simplified records, coordinates rounded.
- `view()`: a small screenshot with each record's id drawn on it
  (Set-of-Marks), so a vision model can name ids instead of coordinates.
- Query helpers in code: `overlaps`, `neighbours`, `find`.
- Before changing anything, the agent highlights what it means to change and
  checks the screenshot (probe before acting).

## 2. Acting: the same operations as people

- Only `put / set / del`, through the same field checks.
- Semantic helpers ("place below", "align", "group") compute coordinates in
  code; the model never computes pixels.
- Every agent change carries `by: 'agent:…'`, so undo per actor is possible.

## 3. Deciding: typed questions

Fast choices go to `/v1/decide` (Clef-flash, `pool.md`): which records belong
together, a record's role, does this follow the brief. The answer and its
probability can be drawn on the board. Below a threshold, the agent asks
instead of acting.

## 4. Speaking: comments, not shapes

Agent remarks are comment threads pinned to records, not new records on the
board (tldraw's "agents can't point" finding). Attributable, resolvable, and
they don't clutter the work.

## 5. Checking

Lint in code: overlap, clipping, off-board. A vision model only for critique of
specific regions, as questions, not verdicts (benchmarks show vision models are
weak design judges).

## 6. Order

1. `records()` and the query helpers, with tests.
2. Agent writes through `put / set / del` with `by` and per-actor undo.
3. `view()` with Set-of-Marks.
4. Comments.
5. `/v1/decide` questions drawn on the board.
