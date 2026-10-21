# Visualia as the course's shared canvas: assessment

Draft 2026-10-21. Read-only review of `~/personal/visualia` (working tree,
including today's uncommitted bug/security fixes, 32 files, +1304/−351).
Companion to `PLAN.md` (block B), `STUDIO.md` ("Shared canvas") and `INFRA.md`
§6 (Judgement Machines). Paths are relative to the visualia repo unless they
start with `~`.

**Verdict:** evolve it, don't restart. The engine is small, typed and built
around the right seams. What doesn't fit the new role is around the edges:
storage is one browser's localStorage, the agent bridge only works through a
local dev server, the default renderer depends on an experimental Chrome API,
and React is used only for a palette and some demo widgets. Make DOM rendering
the default, move the document into a Durable Object, add the studio node
kinds, and host the MCP server on Workers. That's about 14 days for a usable
class board and about 25 for the full list below. A fresh board would cost the
same server-side work plus 6–8 days to win back interaction details that
already work.

---

## 1. What is there

54 commits, all by one author, written 2026-06-11…13 (three days, agent-built).
`npm run typecheck` passes in all 7 workspaces. There are **no tests**: no test
files, no test runner, and no `test` script in any package.json.

| Package | Code LOC | Files | What it is |
|---|---:|---:|---|
| `packages/engine` | 5,369 | 35 | Board facade, store, history, kinds, input/tools, snap, layout, camera, GL renderer + HTML-in-canvas layer, DOM fallback layer, media proxy (Vite) |
| `apps/board` | 2,279 | 13 | The app: `app.ts` (886), kinds for image/website/crop, IndexedDB blobs, React command palette, capture + import sidecars |
| `packages/shadcn` | 855 | 15 | 12 shadcn/ui components + a `widget` kind with 9 demo widgets |
| `packages/mcp` | 657 | 3 | stdio MCP server → Vite WebSocket relay → in-page bridge |
| `apps/eka-sitemap` | 536 | 3 | Read-only viewer of 2,296 artun.ee pages: a second consumer that proves the engine is reusable |
| `packages/three` | 400 | 3 | Shared three.js "texture farm" (one WebGL context for all 3D nodes) |
| `packages/react` | 50 | 1 | `reactContent()` adapter; used only by shadcn |
| `plans/` | 3,276 (md) | 16 | Design notes plus research: `topics.md`, `links.md`, `lineage.md` |

About 1,375 engine lines are GL-only (`render/*`, `content/canvas-layer.ts`).

## 2. Architecture as it stands

### Module boundaries: mostly good, and the app layer is a junk drawer

| Area | Finding | Where |
|---|---|---|
| Engine API | Has the right seams: `NodeKind` (render, edit, caps, crop, layout fit, deserialize), `Tool` (gestures), `Layout` (placement strategies), interaction caps (`editor`/`viewer`). A student extension can plug into each without touching the core. | `core/kinds.ts:103-135`, `input/input.ts`, `layout/layout.ts`, `README.md` |
| Store | All mutations go through `Store` methods, which emit `change{ids, structural}`. That one choke point is what makes sync feasible. Weak spot: the event carries ids but not the values, and patches are applied in place with `Object.assign`. | `core/store.ts:44-63` |
| App layer | `App` is an 886-line god class: presentation mode, insert placement, import, agent verbs, website capture, the agent's "view", seeding. `plans/packaging.md` already proposed splitting it (`@visualia/media`, `@visualia/capture`, `boardVerbs(board)` in mcp). None of that was done. | `apps/board/src/app.ts:51-886`; agent verbs `660-863` |
| Globals | The engine writes `document.body` classes and a `--board-zoom` CSS variable on `<html>`, and the README requires fixed element ids, so only one board fits on a page. That matters when embedding a board in a studio page or showing a mini-map. | `board.ts:103`, `board.ts:196`, `README.md:13-18` |

### Render pipeline and the experimental API

| Question | Answer |
|---|---|
| What GL mode needs | `getElementTransform` + `texElementImage2D` + `requestPaint` (Chrome flag or origin trial). The engine checks for all three and otherwise falls back to DOM. | `board.ts:98-102` |
| API churn | Two signatures are handled already (`texture-cache.ts:88-93`). The README records a third shape coming (`content="drawable"`, `updateElementGeometry`, `texElementSubImage2D`) that isn't adopted (`README.md:44-46`). Expect it to break again during the course. |
| Who can run GL | Only Chrome with the flag. That excludes Safari, Firefox, phones and most students' default setup. |
| What DOM mode gives | A complete board: the same kinds, editing, snapping, undo, culling and crisp re-raster after a pan (`content/fallback-layer.ts`). It loses the "liquid" shader, the content LOD fade (`minPx`) and throughput at thousands of nodes; eka-sitemap's fps chip shows the difference. A class board with a few hundred nodes doesn't need that throughput. |
| A trap | DOM mode **still requires WebGL2**, because selection chrome, marquee and guides are drawn on a transparent GL canvas above the DOM (`board.ts:105-111`). If the context is lost or blocklisted, the constructor throws. |
| The decisive point for the new role | The main new content is live studio projects in **sandboxed cross-origin iframes**. HTML-in-canvas doesn't paint cross-origin iframe content (by design, per the explainer; verify against the current Chrome build). So in GL mode they would have to be `overlay` nodes, and overlays sit in `#gl-overlay` *above* the whole canvas (`styles.css:29-35`), which breaks z-order against every other node. DOM mode has no such problem. |

**Conclusion:** render DOM-first. Make GL an opt-in package for demos (the
liquid cursor, eka-sitemap scale), not the default path.

### Data model and persistence

| Aspect | State | Gap for the new role |
|---|---|---|
| Document | `{version:1, nodes: Record<id,N>, nodeOrder: id[]}`, flat, no parent/child (frames contain things only geometrically). Each kind validates and migrates in `deserialize` (`persistence.ts:24-33`). | Workable. Add `boardId`, author/created fields per node and a schema version per kind. |
| Storage | One global localStorage key `board:doc` per origin, debounced 500 ms (`persistence.ts:5-6, 79-82`). | One board per browser, single user, ~5 MB quota. Needs a server. |
| Media | Dropped files are stored in IndexedDB by content hash; the doc keeps `idb://<hash>` and a `resolveSrc` seam turns that into a URL (`apps/board/src/idb-store.ts`). | The design is right. Swap the backend to R2 (`r2://<sha>` → a `/media/<sha>` route); the seam already exists. |
| Widget state | shadcn widgets keep their state in React, not in the doc (`registry.tsx:25`). A checkbox doesn't survive a reload and wouldn't sync. | Remove (see §4). |

### Undo and history

`core/history.ts` is a local command stack (100 entries, nudge-merge only)
with `AddNodes`/`DeleteNodes` snapshots and `PatchNodes` before/after
field patches. `amend()` folds late measurements (text height, image natural
size) into snapshots. It's well done for a single user. Each patch is
field-level, so it converts directly into an op log. Multiuser needs undo per
user: undo only your own ops, and skip fields someone else has changed since.
Gestures mutate the store live and commit on release (`input/tools.ts:203-398`),
so live drags should go out as ephemeral presence and only the release
becomes an op.

### MCP agent bridge

Agent → stdio `server.mjs` → `ws://localhost:5180/__mcp` (Vite plugin, token
in `~/.cache`) → the board tab elected leader by Web Locks → `App.agent*`
verbs → reply (`packages/mcp/vite.ts:31-159`, `bridge.ts:41-190`,
`main.ts:23-36`, DEV builds only). Today's security fixes (token, Origin/Host
checks, reply isolation) make it sound **as a local tool**. Structurally, the
verbs run in a browser tab, so with no tab open there is no agent. That's the
wrong shape for a class where the studio's Think agent, students' Claude Code
and a teacher's script all write to the same board. The verb set itself
(`snapshot/insert/patch/delete/zoom_to/layout/view/capture/crop/import`) and
the rule "inserts go through `kind.deserialize`" (`app.ts:660-663`) are worth
keeping.

### React and shadcn: they don't earn their place

React is used for two things: the ⌘K palette (`apps/board/src/ui/command-menu.tsx`,
160 lines, cmdk + lucide) and the shadcn demo widgets (button counter, slider,
tabs). Together they add 13 runtime dependencies, Tailwind, a 377 KB bundle,
and a second rendering model next to the engine. The studio UI is vanilla JS.
Students who fork with agents do better with one model.
`@visualia/react` (50 lines) is a fine optional adapter; it just shouldn't be on
the default path.

### three.js

`packages/three/src/farm.ts` is careful work: one WebGL context for all models,
render only when visible or dirty, resource disposal. It's useful in block C
(3D scans from the VR lab on the board). Keep it as an optional kind package,
not in the default build.

### The Vite dev-server plugins make it a local-only tool

| Plugin | What it does | In a hosted class board |
|---|---|---|
| `mediaProxy` (`packages/engine/vite/media-proxy.ts`) | Same-origin proxy so cross-origin images can be textured in GL | Not needed in DOM mode (`<img>` doesn't need CORS). Drop it; store uploads in R2. |
| `captureServer` (`apps/board/vite-capture.ts`, Playwright) | Screenshot a URL, plus an element rect map for crop | Move to Workers Browser Rendering. The studio's verify step already renders previews, so reuse those screenshots as posters. |
| `importServer` (`apps/board/vite-import.ts`) | Read a folder from `$HOME` | Remove. Drag-and-drop upload to R2 covers it. |
| `mcpRelay` (`packages/mcp/vite.ts`) | WebSocket relay to the tab | Replace with a hosted MCP server (§3). |

## 3. Signs of agent-written code

| Sign | Evidence |
|---|---|
| Duplication | Bounding-box union written out 5 times (`app.ts:345, 600, 753`, `board.ts:432`, `input/tools.ts:209`). `handle`/`fail`/`serveImg` copied between `vite-capture.ts:26` and `vite-import.ts:29,108`. `isLocalRequest` twice (`mcp/vite.ts:166`, `engine/vite/media-proxy.ts:47`); the comment calls that intentional. |
| Over-wide API | `engine/src/index.ts` exports ~60 symbols. 26 of them (`Store`, `History`, `Camera`, `PointerController`, `EditController`, `snapBBox`, `hitNode`, …) are used by no consumer outside the engine. |
| Over-abstraction at one consumer | `@visualia/react` exists for `@visualia/shadcn` alone. `ContentSpec` carries GL-only fields (`mode: overlay`, `source`, `live`, `minPx`) that every kind author has to understand (`core/kinds.ts:46-73`). |
| Naming drift | The UI says "frame", the code says `card` (`frameKind()` returns `type: 'card'`, `builtin-kinds.ts:63-72`; `CardNode`). |
| Plans that drifted | Code cites `plans/website.md`, which doesn't exist (`app.ts:28, 103, 767`, `vite-capture.ts:12`); the content is in `document.md`. `packaging.md` reads as a decided split, but nothing was moved. `grouping.md` documents a feature that was built and then reverted. `import.md`'s palette "Import…" entry was never built. Today's fixes updated 7 plan files, so the drift is shrinking. |
| Demo defaults with external hosts | picsum, modelviewer.dev, GitHub raw, MDN video (`app.ts:40-44, 452, 633`). |
| Polish ahead of foundations | Liquid cursor, Prezi mode, auto-width text and crop snapping all exist, while there are no tests, no server, and no second user. |
| On the positive side | Comments explain *why* (caret preservation, quota handling, reasons for capture throttling). The kind/tool/layout seams are consistent, and `sanitizeHtml` is a real allowlist (`core/kinds.ts:263-327`). |

**What tests would need:** vitest for the pure core: Store/History (undo,
redo, amend, merge), `sanitizeHtml` (a security corpus, including the
backslash-in-style and scheme-with-control-character cases), layout
strategies, and persistence round-trip/migration. Op-log convergence tests
(two clients, interleaved ops, same final doc). `@cloudflare/vitest-pool-workers`
for the board Durable Object. One Playwright smoke test in DOM mode: load,
insert, drag, undo, reload, and a second tab sees the change.

## 4. What I'd change, ranked by value for the new role

| # | Change | Why for the course | Effort (days) |
|---|---|---|---:|
| 1 | **DOM-first rendering.** DOM becomes the default; GL moves to opt-in `@visualia/gl`. Draw selection, marquee and guides with SVG/DOM so DOM mode no longer needs WebGL2. Test on iPad and phones. | Every student's browser works, iframes stack correctly, and changes to the Chrome API stop being a course risk. | 2 |
| 2 | **Board room as a Durable Object** (`BoardRoom extends Agent`, one per board). Doc in DO SQLite (`nodes` table + `ops` log). Ops: `add / patch(fields) / delete / reorder`, sequenced by the server, last-writer-wins per field. `setState` only for small room state (presence, who's editing which node, cursors), not for the doc, because it rebroadcasts the whole state on every change. Auth via the studio session. | Multiuser (the block B requirement), the course's "shared space", and visible telepointers: the Engelbart demo, built. | 3–4 |
| 3 | **Client sync adapter.** `Store` emits op values, remote ops apply without history, undo is per user (own ops only, skipped on conflict), drags go out as presence and commit on release, and a node-level lock while someone is text-editing it. | Makes #2 usable. A plain op log beats Yjs here: the store already speaks field patches, and per-node HTML strings don't need a text CRDT for a class. Revisit Yjs (y-partyserver) only if co-editing a single text node turns out to matter. | 2–3 |
| 4 | **A schema shared with the studio** (`@eka/board-schema`, zod; zod is already a dep in `packages/mcp`). Kinds: `project` (projectId, versionSha, slug), `brief` (projectId; a read-only live mirror of the studio agent's brief), `chart` (Clef result: question, labels, probabilities, model, input ref, schema id), plus `text`, `frame`, `image`, `link`. The studio Worker and the board validate against the same file. | The studio, MCP tools and student kinds all write the same nodes, and invalid writes are refused at the server rather than in a tab. | 1 |
| 5 | **`project` kind: sandboxed iframe node.** A poster image (the studio verify screenshot, from R2) by default. A live `<iframe sandbox="allow-scripts">` on the user-content domain mounts when the node is activated (reuse `edit: {kind:'activate'}`) or when it's zoomed in with only a few visible. Never use `allow-same-origin`. Keep this separate from `sanitizeHtml`, which drops `iframe` on purpose (`core/kinds.ts:270-274`). | The core content of the board. Posters keep 40 live projects from loading 40 pages at once. | 1.5 |
| 6 | **Persistence in D1 + R2.** D1: `boards`, `board_members`, links to `projects`/`versions`. R2: media by content hash (`r2://<sha>`, replacing `idb://` via the existing `resolveSrc` seam) and periodic doc snapshots (`boards/<id>/<seq>.json`) for forks and export. Keep localStorage only as an offline cache. | Persistent, shareable boards; "fork this board" for groups. | 1.5 |
| 7 | **Studio → board integration.** On publish, the studio upserts that project's node (new version = patch `versionSha`). Give the Think agent a `board_place` tool that calls BoardRoom over DO RPC, not MCP. Clef runs post `chart` nodes next to the work they judge. | Delivers the "Shared canvas" section of STUDIO.md and the Judgement Machines exercise from INFRA.md §6. | 1.5 |
| 8 | **Hosted MCP server** (`McpAgent` on Workers). The same verbs, run against BoardRoom state, with per-student tokens and author stamped on every op. `view` and `capture` use Browser Rendering. Inserts send an estimated height and the first client to render settles the real one (text measuring needs a DOM). | Students' Claude Code/OpenCode and the studio agent work on the board without a tab or a local dev server. | 2 |
| 9 | **Split `app.ts`.** `boardVerbs(board)` shared by the MCP server and the DO; presentation, placement and capture each in their own module; one `bbox()` helper; delete the import sidecar and media proxy. | Forkability: students' agents can read a 200-line file but get lost in an 886-line one. | 1.5 |
| 10 | **Drop React and shadcn from the default build.** Vanilla ⌘K palette (~150 lines), no widget kit; `@visualia/react` stays as an opt-in adapter. Tailwind goes too. | One rendering model, matching the vanilla-JS studio, with a smaller bundle and fewer dependencies for agents to misuse. | 1 |
| 11 | **Student extension API + skills.** `defineKind({type, schema, defaults, render(el,node), edit?})` sugar over `NodeKind`, hiding GL fields. Two routes: *trusted* kinds by pull request into the class board (teacher merges), and *untrusted* kinds as a sandboxed iframe widget behind a `postMessage` contract (read own node, patch own props, read selection), the same model as STUDIO.md's UI contract. Skills: `class-board-kind` (how to write a kind, tool or layout, with a worked example) and `class-board` (MCP verbs, schema, etiquette). | This is block B's actual exercise: each Engelbart/Kay/Raskin/Victor group extends a seam (see the table below). | 2.5 |
| 12 | **Tests** (see §3). | Twenty people's agents committing to one repo need a safety net, and agents need something to run before claiming they're done. | 3 |
| 13 | **Moderation and roles.** Teacher can lock nodes or regions, hide a member's ops, roll back to a snapshot. | A shared public space needs it (STUDIO.md lists "Moderation" as open). | 1 |
| 14 | **Capture via Browser Rendering** (website kind + crop to element). | Nice for moodboards; not core. | 1.5 |

**Minimum usable class board:** items 1–7 + 9, about 14 days. Item 8 is
needed before students use agents on the board; items 10–13 before students
fork it.

### Block B: one seam per group

| Idea | Seam it extends | Example extension |
|---|---|---|
| Engelbart: augmentation, shared screen | Presence in BoardRoom | Telepointers, "follow me" camera, view-sharing |
| Kay: the medium you reshape | `Tool`, `defineKind` | A drawing tool; a kind whose behaviour is a script on the node |
| Raskin: zoom UI, humane interface | Camera + LOD (`plans/zoom.md`) | Semantic zoom: a project node at low zoom shows its title, at mid zoom its poster, up close the live iframe |
| Victor: explorable explanations | `defineKind` + `chart` | Scrubbable Clef chart: drag a threshold and watch which works flip |

`plans/topics.md` (10 sections with these lineages) and `plans/links.md` (180
curated links) work as block B reading as they stand.

## 5. Keep, change, remove

| Part | Verdict | Note | Days |
|---|---|---|---:|
| Engine core: store, history, kinds, tools, layout, snap, camera, input, edit | **Keep** | Add op events and per-user undo | 2–3 (in #3) |
| `sanitizeHtml` | **Keep** | Add a test corpus | 0.5 |
| DOM fallback layer | **Keep, promote to default** | Replace the WebGL2 chrome overlay | 2 (in #1) |
| GL renderer + HTML-in-canvas layer (~1,375 LOC) | **Change → opt-in `@visualia/gl`** | Freeze at the current API shape; don't chase the next one during the course | 0.5 |
| Liquid shader | **Change → stays inside `@visualia/gl`** | Demo only | 0 |
| `apps/board/src/app.ts` | **Change: split** | Verbs to `boardVerbs`, feature modules | 1.5 |
| Image/crop kinds, `croppable.ts` | **Keep** | Move to a media module | 0.5 |
| `idb-store.ts` | **Change → R2 backend** | Same `resolveSrc` seam | 0.5 |
| localStorage persistence | **Change → DO SQLite + D1 + R2** | localStorage as offline cache only | 1.5 + 3–4 |
| MCP relay + in-tab bridge | **Remove** | Replaced by the hosted MCP server | — |
| MCP verb set + `server.mjs` tool descriptions | **Keep → port to `McpAgent`** | | 2 |
| `vite-capture.ts` (Playwright) | **Change → Browser Rendering** | Later | 1.5 |
| `vite-import.ts`, `media-proxy.ts` | **Remove** | Upload + DOM mode replace them | 0 |
| `@visualia/shadcn` | **Remove** from default | Widget state isn't in the doc | 0.25 |
| `@visualia/react` | **Keep as optional** | Not used by default | 0 |
| ⌘K palette (React/cmdk) | **Change → vanilla** | | 1 |
| `@visualia/three` | **Keep as optional kind** | Block C | 0 |
| Presentation mode | **Keep** | Good for crits on the projector | 0 |
| `apps/eka-sitemap` | **Keep as an example** | Shows viewer mode and a second consumer | 0 |
| `plans/` | **Keep, prune** | Fix `website.md` references, mark `packaging.md`/`grouping.md` status; move topics and links into the course reading | 0.5 |
| New: board schema, `project`/`brief`/`chart` kinds, BoardRoom DO, studio hook, extension API, skills, tests, moderation | **Add** | See §4 | ~15 |

## 6. Evolve or start a smaller "class board" fresh?

**Evolve, but as a new app in the course repo that consumes a trimmed engine.**

- **What a fresh start would save:** about 1,400 GL lines, React, the
  sidecars, and the god class. All of that can be deleted or made optional in
  about 3 days (items 1, 9, 10).
- **What it would cost:** the interaction quality is in the engine:
  Figma-style snapping with guides, auto-height and auto-width text editing
  that keeps the caret, pinch and wheel handling, crop with snapping,
  interaction caps, layout strategies, history amend. Rebuilding that to the
  same feel is 6–8 days, and agents tend to get it subtly wrong. The server
  side (DO, D1/R2, MCP, studio hook) costs the same either way.
- **Forkability argument:** about 5k engine lines with clear seams is
  readable for students' agents, *once* the API surface is narrowed
  (`defineKind`) and skills document it. A from-scratch "minimal canvas"
  would push students into rebuilding pan and zoom instead of extending the
  medium, which isn't block B's point.
- **Shape:** `apps/board/` in the ekai repo holds the class app plus the
  Worker (`BoardRoom`, MCP, routes) and depends on `@visualia/engine` pinned
  to a commit. Visualia stays Kristjan's research playground with GL and
  liquid, and fixes flow back upstream.

### Sequence

1. DOM-first plus the schema package (items 1, 4). The board runs everywhere,
   and the studio and the board agree on node kinds.
2. BoardRoom DO, sync adapter, D1/R2 (items 2, 3, 6). Multiuser and
   persistent.
3. `project`/`brief`/`chart` kinds and the studio publish hook (items 5, 7).
   The board fills itself as students publish.
4. Split `app.ts`, drop React, hosted MCP (items 9, 10, 8). Agents can work
   on the board.
5. Tests, extension API and skills, moderation (items 12, 11, 13). Ready for
   students to fork.
6. Capture via Browser Rendering, GL package polish (item 14, optional).

### Risks

- The agents SDK and Think are 0.x and change quickly (STUDIO.md risk 2).
  BoardRoom should use only `Agent`, WebSockets, SQLite and `@callable`, and
  pin versions as the studio does.
- With twenty live iframes on a projector, posters must be the default and
  live mode opt-in per node.
- Text-editing conflicts: a node lock is enough for a class. If groups
  co-write long text, that belongs in the studio's brief, not on the board.
- Phones: DOM mode plus pinch should work, but nobody has tried it. Test on
  real devices before relying on it.
