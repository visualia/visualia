# MCP server for the board

Sketch, 2026-06-12 — **IMPLEMENTED 2026-06-13** as option A. `@visualia/mcp`
(stdio server + vite relay + in-page bridge with injected `AgentVerbs`,
leader-elected across tabs), media proxy as `@visualia/engine/vite`, agent
verbs on the board App, registered in `.mcp.json`. The notes below remain as
design rationale; `board_layout` still pending the [layout](layout.md) seam.

Goal: let an agent (Claude) read and edit a live board —
"add a heading", "what's on the board", "arrange these into a frame".

## Transport: local is fine

A stdio MCP server registered in the client (`claude mcp add board -- node mcp/server.js`)
covers the single-user dev story. No auth, no hosting. Remote/HTTP transport only
matters if the board itself ever goes multi-user — defer.

## The actual question: what backs the doc?

Today the doc is `localStorage` in the browser tab (`board:doc`, autosaved by the
engine's `Autosaver`). A local MCP server is a separate OS process — it cannot see
browser localStorage. So "local MCP" still needs a path to the state:

### A. Live-page bridge — backend = the running tab (recommended first)

MCP server opens a WebSocket; the board app connects to it on startup (dev-only
module). Tool calls are forwarded as messages and executed against the existing
`Board` API in the page.

- Source of truth stays exactly where it is (Store + localStorage). Zero
  persistence changes.
- Writes go through `history.push` → agent edits are undoable with ⌘Z, and
  `deserialize`/sanitizeHtml keep HTML inserts safe — all for free.
- The page can answer rich queries: visible nodes, camera, screenshots.
- Limitation: tab must be open. Acceptable for a dev tool.
- Wiring: a Vite plugin can host the ws endpoint so there's no extra port;
  the MCP server talks to `ws://localhost:5180/__mcp`.

### B. File-backed doc — backend = a JSON file in the repo

Move (or dual-write) persistence to e.g. `.data/board.json` behind a tiny dev-server
GET/PUT middleware; MCP server reads/writes the file directly; the page reloads the
doc on file change (Vite ws ping).

- Works headless — agent can edit a board nobody has open; docs become
  git-diffable artifacts.
- Costs: conflict policy needed (last-writer-wins is probably fine solo, but
  edits race the 500ms autosave debounce), and writes bypass page-side
  sanitization unless the schema validation is duplicated in the server.
- Good follow-up once headless workflows matter; awkward as the first step.

### C. Real backend — sqlite/CRDT sync server

Only if multiplayer or remote MCP arrives. y-websocket/partykit territory.
Out of scope for now; nothing in A or B blocks moving here later. Lineage
precedents: fachwerk-dev used Strapi for per-user docs (last-writer-wins, no
realtime); workshop syncs a live board with **no backend state at all** —
command-sourcing over a ws relay (see [lineage](lineage.md)) — worth
considering as a C-alternative before reaching for CRDTs.

## Tool surface (v1, via option A)

- `board_snapshot()` → doc JSON + camera + selection (the read for everything)
- `board_insert(type, props)` → position resolved by the [layout](layout.md)
  seam, never by agent coordinates (the current app-side `insertPlacement`
  heuristic is the interim fallback until that seam lands)
- `board_layout(scope, strategy, params)` → re-run a layout over a frame's
  children / a selection / the doc — the verb that makes "arrange these into
  a timeline" expressible (see [layout](layout.md))
- `board_patch(id, partial)` / `board_delete(ids)`
- `board_zoom_to(ids?)` → camera animate, for "show me"
- maybe: `board_screenshot()` → canvas capture for visual feedback loops

**Gating dependency**: the agent story is only as good as the layout seam —
agents emit structure + intent, the engine resolves positions. Sequencing in
[layout](layout.md): seam first, MCP on top.

**Verb convergence** (from the [lineage](lineage.md) harvest): workshop's
`@board/@card/@diagram` chat commands are a sibling transport for the same
operations. Define the verbs once in the App layer; expose them via MCP,
command palette, and (later) @-commands — one vocabulary, three transports.

## Open questions

- ~~Does the MCP server live in `apps/board/mcp/` or `packages/mcp`?~~
  Resolved: `packages/mcp`, engine-generic — the app injects `AgentVerbs`.
- Batch ops: one history entry per tool call (so one ⌘Z undoes one agent action)?
- How does the agent reference nodes — raw ids from snapshot, or a cheap
  human-readable index (type + text excerpt)?
