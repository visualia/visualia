---
status: building
---

# Boards: surfaces built type by type

A living experiment. The teacher builds it up first, one type and one idea at
a time (types and primitives, how an AI sees a board, its MCP), and later
with the students. The first board (`board.md`) is cleared. Nothing here is
planned ahead of the teacher's next choice.

## Decided (2026-10-23)

- **Surface:** things sit at positions on an open surface that pans and zooms.
  Not a flow.
- **Many boards** per school, each with a title. Everyone in the school sees
  and changes all of them (peers, as in the rest of the studio).
- **First type: text.** Plain body text, one size, no styling.

## Built (2026-10-23)

- `boards` in D1 (migration `0013_boards.sql`): id, school, title, maker,
  created and last changed. The things on a board live in its Durable Object.
- **The Board Durable Object** (`apps/studio/src/board.js`), one per board:
  - Things are records `{ id, type, x, y, …fields, by, t }` in its SQL storage.
  - Pages speak `put`, `set` and `del` over a WebSocket, and get a `hello`
    with every thing on connect.
  - Each type lists its fields and how each is checked. A bad field refuses
    the whole change.
  - The last write to a field wins; `by` and `t` say who changed it last and
    when.
  - Limits: 2,000 things a board, positions within a million pixels of the
    origin, text up to 5,000 characters.
- **The Worker:**
  - `GET/POST /api/boards`, `GET /api/boards/:id`, the page at `/board/<id>`.
  - Board sockets are allowed for members of the board's school only.
- **The page** (`public/board.html`):
  - The surface pans by dragging, two-finger scroll or one finger, and zooms
    with a pinch or ctrl/⌘ + wheel.
  - The first look fits everything in view.
  - Adding text: double-click, or **Add text**.
  - Click a text to type, drag a text to move it. Others see it move, and see
    the words 0.3 s after typing stops.
  - An emptied text is removed.
- **Home:** "Boards" lists the school's boards, latest change first, with
  **New board**.
- **Checked locally** (wrangler dev; scratchpad `mf2/boards.mjs`,
  `boardui.mjs`):
  - Protocol, 14 checks: the API, two people live (add, change, remove), the
    five kinds of bad change refused, the state for a new page, and no
    sign-in refused.
  - Chromium with two people (1280 px and 375 px): double-click and **Add
    text**, typing with Estonian letters and line breaks, a move seen by the
    other, an emptied text removed.
- Deployed: migration 0013 applied, studio live.

## Not yet (the teacher picks what comes next)

- Other types (images first was the suggestion).
- How an AI sees a board, and the board in MCP.
- Presence (who is here, who is typing), undo, history.
- Removing or renaming a board.
