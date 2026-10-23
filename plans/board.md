---
status: dropped
---

# The board: everyone's works, one document, many views

## Cleared (2026-10-23)

The teacher's decision: this first board is gone, and a new board gets built.
It is a living experiment, built with the students, type by type and idea by
idea; before that the teacher builds it up: its types and primitives, how an
AI sees it, its MCP, in the spirit of the original Visualia board.

Removed: `packages/board` (document, layouts, wall renderer, sync, tests,
demo), the board in the Class DO (its tables are dropped on the next wake),
the drag relay, the placeholder thumbnails, and the board's words. The studio
home's "Everyone's work" is a plain grid of the shared projects' latest
screenshots (newest first, or by person), reloaded when the Class DO says
`{ type: 'work' }`. Everything below is the history of the first board; its code is in git at
commit f9673f6.

What follows is how the set-aside version worked.

The wall in the class space (`class-space.md`) shows every work by everyone in
the class: live, newest change first, readable on a phone. This plan explains
how it works:

- one document per class, changed by small ops
- several layouts of that document, chosen by screen width
- one DOM renderer that stays fast with hundreds of works and their images

It builds on the June canvas (`~/personal/visualia_canvas`) and on its
assessment (`schools/eka/docs/VISUALIA.md`), but changes the plan there in
places. The research behind it is in `research/spatial-interfaces.md`, and the
reading list is `research/reading.md`.

Steps 1–4 and 8 are built: `packages/board/`, thumbnails, the live wall on
the home page, arranging it (groups, moves, undo, the phone's "Put with…"),
and remix lines (see "First pieces", "Built: steps 2–3" and "Built: steps 4
and 8").

## What we take from visualia_canvas

The June engine is a single-user editor: snapping, resize, crop, text editing.
The wall mostly needs viewing, arranging and live updates. So we start a small
package and port pieces one at a time, as each one is needed. We don't adopt
the engine whole. (`apps/board/README.md` already says this, and it replaces
the "evolve it" verdict in VISUALIA.md.)

| Take | From | Why |
|---|---|---|
| Every change goes through one door | `engine/src/core/store.ts` | That door is what makes sync possible. Ours is `applyOp` |
| Field-level patches | `engine/src/core/history.ts` (`PatchNodes`) | Patches turn straight into ops and per-user undo |
| Layout as a pure, re-runnable function | `engine/src/layout/layout.ts` | It becomes the main seam (see below) |
| Culling, and `will-change` only while moving | `engine/src/content/fallback-layer.ts` | DOM stays cheap with many items |
| Camera math | `engine/src/camera/camera.ts` | Small and correct |
| `sanitizeHtml` | `engine/src/core/kinds.ts:263-327` | When notes get formatting |
| Semantic zoom ideas | `visualia_canvas/plans/zoom.md` | Tiers by on-screen size, landmarks, groups shown as one tile |
| MCP verb names | `packages/mcp/server.mjs` | For agents on the board, later |

| Leave behind | Why |
|---|---|
| The GL renderer and HTML-in-canvas as default | Chrome-flag only. Cross-origin iframes can't be painted. Phones can't run it. It stays in visualia_canvas as research |
| The WebGL2 overlay for selection in DOM mode | DOM mode then throws without WebGL2 (`board.ts:105-111`) |
| React, shadcn, cmdk, Tailwind | The repo is vanilla JS. Widget state lived outside the document |
| MCP through the Vite relay | It needs a dev server and an open tab. Agents will use DO RPC (or a hosted MCP) instead |
| Media proxy, import sidecar, Playwright capture | The studio already makes screenshots with Browser Rendering |
| localStorage and IndexedDB as storage | One browser and one person. The Class DO holds the document |
| Each image drawn into its own `<canvas>` | A full-size bitmap per image is too much memory on a phone. Use `<img>` at the right size |
| The `nodeOrder` array and required `x, y, w, h` | A shared array conflicts. On the wall, position is optional (below) |
| Body classes and fixed element ids | They allow one board per page. Ours takes any element |

## Principles

1. **Position means something, and the canvas helps with it.** People arrange
   works by hand. Proximity and named groups become structure the other
   views can use. The canvas does the tidying: no overlap, and dropping into
   a group's grid.
   Sources: Wattenberger,
   [Evolving the infinite canvas](https://wattenberger.com/thoughts/evolving-the-infinite-canvas);
   Tversky, *Mind in Motion*
   ([APS](https://www.psychologicalscience.org/observer/tversky-proposes-audacious-theory-of-spatial-thinking)).
2. **One document, many views.** The canvas, the newest-first feed and "by
   person" are layouts of the same records. None of them owns the data.
   Sources:
   [Evolving the infinite canvas](https://wattenberger.com/thoughts/evolving-the-infinite-canvas);
   [Are.na](https://help.are.na/docs/getting-started/blocks)'s grid.
3. **Zoom changes what a thing is, not only its size.**
   - From far away, a work is who made it.
   - Closer, it is what it looks like.
   - Up close, it is the work with its title, version and history.

   Sources: Victor,
   [Ladder of Abstraction](https://worrydream.com/LadderOfAbstraction/);
   Wattenberger, [Fish eye](https://wattenberger.com/thoughts/fish-eye);
   [Pad++](https://courses.cs.washington.edu/courses/cse510/16wi/readings/bederson1994.pdf).
4. **Landmarks at every level.** Group names and people's names stay readable
   at any zoom. Sources: Lu,
   [Abstractions](https://www.susielu.com/data-viz/abstractions).
5. **Time is the main axis.** The feed is ordered by the newest real change,
   and a new version moves a work to the top. Up close, a work shows its
   versions as a strip. Stepping up the ladder means seeing all weeks;
   stepping down means one version.
   Sources: [Ladder of Abstraction](https://worrydream.com/LadderOfAbstraction/).
6. **Provenance is visible.** Every version records who asked for it
   (`class-space.md`). A remix keeps `from`. On the canvas that becomes a
   line; in the feed it is "from X".
   Sources: [tldraw computer](https://computer.tldraw.com/)'s arrows;
   [Observable Canvases](https://observablehq.com/blog/introducing-canvases-early-access)'
   branches;
   [Are.na connections](https://help.are.na/docs/getting-started/connections).
7. **Quiet presence, peers first.** Show who is here and what they are
   looking at, and let people follow someone's view during a crit. There is
   no teacher dashboard, no likes and no ranking.
   Sources: Resnick,
   [Lifelong Kindergarten](https://www.media.mit.edu/publications/lifelong-kindergarten-cultivating-creativity-through-projects-passion-peers-and-play/)
   (peers, play; "playground, not playpen" is Bers' metaphor);
   [tldraw](https://tldraw.dev/) presence.
8. **Some friction is the point.** Pinning a work to a place is a
   deliberate, physical act, not an endless frictionless feed.
   Sources: Wattenberger,
   [Our interfaces have lost their senses](https://wattenberger.com/thoughts/our-interfaces-have-lost-their-senses).
9. **Phones are first, and honest.** Canvases are poor on phones: Figma's app
   is view and comment only
   ([help](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app)),
   and Muse never reached the phone
   ([retrospective](https://adamwiggins.com/muse-retrospective/)). The phone
   gets the flattened view by default. It contributes with taps, not drags
   (see "How a phone contributes").
   Source: Kinopio,
   [design principles](https://pketh.org/design-principles.html).
10. **AI is a small tool on the board, not a chatbot.** For example, it can
    suggest groups that people accept or reject.
    Sources: Appleton,
    [Squish Meets Structure](https://maggieappleton.com/squish-structure);
    [PAIR patterns](https://pair.withgoogle.com/guidebook-v2/patterns).

### How the engine fares against these

| Principle | Engine | Verdict |
|---|---|---|
| 1 Position means something | Has layout strategies and snapping. Positions are baked in at insert. | **Partly holds.** Keep the layout seam, add groups and "drop into a group" |
| 2 One document, many views | Geometry *is* the document: every node has `x, y, w, h` | **Doesn't hold.** Position becomes optional, and layouts derive geometry |
| 3, 4 Zoom as meaning, landmarks | `minPx` fade (GL only); eka-sitemap's hand-made `lod-far/mid` classes | **Idea holds, code doesn't.** LOD belongs to the renderer for every layout |
| 5 Time | No time on nodes | **Missing.** `t` = time of the last real change |
| 6 Provenance | No author, no source | **Missing.** `by`, `from` |
| 7 Presence | Single user | **Missing.** Presence goes in the Class DO, outside the document |
| 9 Phone | Pinch works in DOM mode; never tried on phones | **Doesn't hold.** A spatial canvas is the wrong default on a phone |

## The document and many people

**Where it lives.** It lives in the `Class` Durable Object that
`class-space.md` already plans: one per class, holding the chat, who is
online and the project list. It is not a separate BoardRoom DO. The wall is
part of the class space, a member already has one WebSocket to the class, and
a few hundred records fit easily. If a class ever wants several boards, each
board can become its own DO then.

**Shape** (`packages/board/src/doc.js`). The document is a flat map of
records:

| Record | Fields |
|---|---|
| `work` | `project`, `version`, `title`, `by`, `t`, `from?`, `at?` |
| `note` | `text`, `by`, `t`, `at?` |
| `group` | `name`, `at` (a named place on the canvas) |

- **`at` is optional.** A record without it is simply not placed yet. Every
  layout still shows it, and only the canvas has to choose where. This one
  decision lets the phone views ignore positions completely.
- **`t` is the time of the last real change** (a new version, an edited
  note), not of a move. So "newest first" means newest work.
- Stored in DO SQLite as `items(id, json)` plus an `ops(seq, by, op)` log.
  The log gives undo, "what changed since you were here" and replay.

**Ops.** There are three: `put` a record, `set` some fields, `del` a record.

- The client sends an op, and the DO gives it the next sequence number,
  applies it and broadcasts it.
- Clients apply ops in sequence order and ignore ones they have already seen.
- A move shows locally at once (optimistic) and is confirmed when the op
  comes back.

**Conflicts: last writer wins per field, ordered by the server. No CRDT.**
This is the Figma model
([Figma](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)),
and close to tldraw sync on a DO ([tldraw](https://tldraw.dev/docs/sync)).

- Two people moving the same work: the later move wins, and both see it.
- One person moving a work while another adds a version: different fields,
  so both changes stay.
- Records are small and nobody types inside the same one together. Long
  shared text belongs in the chat or in a project's brief.
- The server is always there (the DO), and offline editing is not a goal. A
  phone that drops out queues its ops and resends them.
- **Why not Yjs, Automerge or Loro?** All three solve problems we don't have
  (co-typing, peer-to-peer, offline merging), and each adds a dependency and
  a binary document format to the DO. If co-typing a note ever matters, use
  **Yjs**: it is the most used, has a DO binding (y-partyserver) and supports
  awareness. Add it for that field only.

**Undo** is per person. It undoes only your own ops: the inverse op is
computed from the log. If someone else has changed the field since, that
field is skipped.

**Presence is not in the document.** Who is online, what each person has
open or is looking at, and a drag in progress are all broadcast messages.
They are never stored. Only the drop is sent as an op, as in the engine's
gestures (`input/tools.ts`) and Kinopio.

**StudioAgent and the Class DO.**

- Projects keep their own `StudioAgent`.
- When a version is saved, the agent calls the Class DO over DO RPC:
  `workChanged({ project, version, title, by })`.
- The Class DO turns that into a `put` (first version) or a
  `set { version, title, by, t }` (later ones), using the project id as the
  record id so the call can safely repeat.
- The agent never writes the board directly, and the board never writes
  projects.

## How works appear

- **Every version of every project in the class is on the wall.** Unpublished
  work is shown only to members, as `class-space.md` says. A project is one
  record, and a new version updates it and moves it to the top of the feed.
- **The picture is the version's screenshot**, `projects/<id>/<n>.png`
  (375×812 CSS px at 2×, from the studio's check). The wall shows its top 3:4,
  because phone pages lead with their top. Until a screenshot exists, the
  tile shows the title.
- **The caption** reads: title; who asked for this version · `v<n>` · how
  long ago · "from X" for a remix.
- **Opening a work** shows it full screen on a phone, or in place on a laptop.
  It shows the live page in a sandboxed iframe on `projects.visualia.space`
  (`allow-scripts`, never `allow-same-origin`), its versions as a strip, and
  its conversation. Back returns to the same place in the wall.
- **Live iframes appear only when a work is open**, never in the grid. With 40
  pages running at once, a phone would stop.
- **New works start unplaced.** The canvas shows them in a "Not placed yet"
  row above everything, so they are never lost off-screen. Someone pins each
  one to a group.

## Renderers and layouts

**The seam is the layout, not the renderer.**

```
records ──layout(records, width)──▶ boxes { id, x, y, w, h } + labels ──renderer──▶ screen
```

- **Layouts** (`packages/board/src/layouts.js`) are pure functions with no
  DOM, so they are tested in Node.
- **The renderer** (`packages/board/src/wall.js`, `createWall`) draws boxes.
  It never reads `at` and never edits the document; a move calls `onOp`.
- **So can one document drive the DOM, GL and a flattened list? Yes.** The
  flattened list is not a separate renderer: it is a layout drawn by the same
  DOM renderer, with the browser's own scroll in place of a camera. A GL
  renderer could take the same boxes later. Nothing on the wall needs one.
- **In visualia_canvas the seam was in the wrong place.**
  - The swap point was `ContentLayer` (`engine/src/content/content-layer.ts`),
    implemented by `CanvasContentLayer` (GL) and `FallbackContentLayer` (DOM).
  - Both assume a camera over a plane where geometry is the truth, and the
    chrome is always WebGL (`render/renderer.ts`).
  - `ContentSpec` (`core/kinds.ts:46-73`) mixes GL fields into every kind.
  - A list could only be faked as a layout baked into positions.

**Layouts and where each is the default:**

| Layout | What it shows | Default on |
|---|---|---|
| `feed` | Newest change first, a heading per day, two across on a phone, more columns on wider screens | Phones (narrower than 700 px) |
| `canvas` | Where people put things; group names as landmarks; pan, pinch, wheel; drag to move | Laptops and the projector |
| `people` | One section per person, whoever changed something last first | Anyone, by choice |
| `grid` of one group, `timeline` of one project's versions | Later | |

Everyone can switch views, and the choice is remembered on that device.

**How a phone contributes.**

- **Taps, not drags.**
  - "Put with…" on a work opens a list of groups; picking one sets `at` to
    the group's next free slot.
  - "New note" adds a note to a group or to the feed.
  - Opening, remixing, and asking for a change happen on the project, as in
    `class-space.md`.
- **The phone can open the canvas** to look around (pan and pinch work), but
  arranging is done on laptops and the projector, in meetups. That is a
  deliberate choice: two-column dragging on a 390 px screen is a poor way to
  arrange forty works.

**Zoom levels on the canvas** (`data-lod` on the plane, from on-screen tile
width):

- **far**: under 56 px; the person's initials.
- **mid**: under 140 px; the picture alone.
- **near**: the picture and the caption.

Group names stay at text size on screen at every zoom (landmarks). Later, at
far zoom, a whole group becomes one tile showing its count and four pictures
(`visualia_canvas/plans/zoom.md`, "Aggregation").

## Scaling: many works, many images

- **Culling.** Only items within half a screen of the viewport exist in the
  DOM. Measured in the demo:
  - a phone feed of 428 records keeps 8–12 elements;
  - a laptop canvas zoomed to the picture level keeps about 220.

  Zoomed all the way out, everything is in view: about 420 small initials
  tiles with no images. Group aggregation fixes that past about a thousand.
  This is the same idea as tldraw's culling
  ([tldraw](https://tldraw.dev/sdk-features/culling)).
- **One transform.** The camera is a single `translate() scale()` on the
  plane. Each item is a `translate()` in world units with
  `contain: strict`. `will-change` stays on the plane while moving.
- **Scroll views use native scroll.** That keeps momentum, the address bar
  hiding, and the accessibility of a scrolling page. We didn't use
  `content-visibility: auto`, because absolutely placed, culled items need
  neither it nor its estimated sizes. It would help only if we stopped
  culling.
- **Image widths in fixed buckets**: 160, 320, 480 and 640 px. The renderer
  picks the smallest one at least as wide as on-screen width × device pixel
  ratio, upgrades only after the camera settles (150 ms), and never
  downgrades. This is tldraw's approach
  ([tldraw](https://tldraw.dev/sdk-features/performance)). A two-across phone
  at 2× gets 480; a far canvas loads no images at all.
- **Thumbnails are made once and kept.**
  - A route `GET /thumb/<id>/<n>/<w>` in the studio Worker reads
    `projects/<id>/<n>.png` from R2.
  - It cuts the top 3:4, resizes with the **Images binding**
    (`env.IMAGES.input(...).transform({ width, height, fit: 'cover', gravity: 'top' }).output({ format: 'image/webp' })`),
    and stores the result as `projects/<id>/<n>.w<w>.webp`.
  - It serves `Cache-Control: public, max-age=31536000, immutable`, since a
    version never changes.
  - Each thumbnail is transformed once in its lifetime, so we stay far below
    the 5,000 free unique transformations a month
    ([pricing](https://developers.cloudflare.com/images/pricing/)).
  - We use the binding and not `/cdn-cgi/image/...`, because our images are
    served by a Worker, and Cloudflare documents error 9524 for images whose
    URL a Worker intercepts
    ([troubleshooting](https://developers.cloudflare.com/images/reference/troubleshooting/)).
  - Checked 2026-10-22: the binding works on the Images Free plan (the
    tutorial's "Images Paid" prerequisite is out of date; the pricing page
    says Free covers transformations of images stored outside Images). No
    fallback needed.
  - The studio's project list thumbnails (backlog) use the same route.
- **`<img decoding="async">`**, not a `<canvas>` per image.

## Sticky dots (consider)

The teacher's reading list (`research/reading.md`) suggests non-competitive
dots on a personal wall. Each kind of dot is a learning moment, such as "I
supported someone else's creative process" or "I tried something bold". What
matters is the pattern over time; there are no scores.

- **It fits as a record:** `dot { on: person, kind, by, t }`. A dot is only
  ever added, never edited, so it can't conflict.
- **It would show in the `people` view**, as each person's dots along time.
- **Open: colour vs `style.md`.** The style rule says "state is a word, not a
  colour". Dots could be words or shapes, or this could be the one place
  colour is allowed.
- **Open: given by whom?** By yourself (reflection) or by a peer (I saw you
  do this)? Never counted on a work, and never ranked.

## First pieces, in order

Each piece is small and can ship on its own.

1. **`packages/board`: the document, layouts, a DOM renderer and a demo.**
   Built. Node tests cover ops and layouts.
2. **Thumbnails:** the `/thumb` route with Images binding and R2 caching. The
   studio project list uses it first. Built.
3. **A read-only wall in the class space.** Built, on the home page (not a
   separate `/wall`).
   - The Class DO keeps the records.
   - StudioAgent calls `workChanged` on each version.
   - The page loads a snapshot, then live ops.
   - The feed and people views are complete from day one; the canvas shows
     everything as "Not placed yet".
4. **Arranging on the canvas:** groups, moving works (ops through the Class
   DO), and per-person undo. Built.
5. **Presence:** who's here; initials on the work someone has open; "follow"
   a person's view during a crit on the projector.
6. **Phone contributions:** "Put with…" (built with step 4) and notes.
7. **Opening a work in place:** the live iframe, the version strip and the
   conversation, then back to the same spot.
8. **Provenance lines:** `from` drawn on the canvas. Built (with remix,
   `class-space.md`).
9. **Group aggregation** at far zoom.
10. **The canvas helps:** dropping into a group's next slot, nudging overlaps
    apart, and AI-suggested groups that people accept or reject.
11. **Sticky dots,** if the class wants them.
12. **Agents on the board:** a DO RPC tool for the studio agent first, then a
    hosted MCP (`McpAgent`) with the old verb names.

## Decided (2026-10-22)

1. **Someone moves your work:** no notification. The work's history shows
   "moved by X", and on return "since you were here" lists what changed
   (from the op log).
2. **Groups:** anyone can rename or delete. Delete is a tombstone: its works
   go back to "Not placed yet", and undo brings the group and its works back.
3. **Remix:** goes to the next free slot in its source's group, with the
   `from` line; if the source isn't placed, the remix isn't either.
4. **Projector:** "Follow" is opt-in, per screen: follow a person's view, or
   follow the newest change. Off by default.

## Media and DOM budget

**DOM nodes.**
- A tile is at most 3 elements: the box, an `<img>`, a caption (caption only
  at near zoom). Positions via `transform` only; `contain: strict` per tile.
- Only tiles within half a screen of the view exist, and tile elements are
  **recycled** from a pool while panning, never created and destroyed per
  frame.
- Budget, always: **< 1,000 nodes for the whole page** (Lighthouse warns at
  ~1,400). Phone feed ~15 tiles ≈ 50 nodes; laptop canvas mid zoom ~200
  tiles ≈ 600 nodes.
- **Far zoom is not DOM.** Below the mid level the wall draws everything on
  one `<canvas>` (2D): a dot or initials per work, group names as text. One
  node for thousands of works; DOM tiles come back as you zoom in. This is the
  one place a canvas earns its keep.

**Images.**
- Sources: version screenshots (`<n>.png`, 750×1624), generated pictures
  (`<n>-<k>.jpg`), uploads later.
- Derivatives made once and stored immutable in R2: WebP at 160, 320, 480,
  640 px wide (top 3:4 crop), plus a **16 px blurred placeholder** inlined in
  the record (~300 bytes base64) so a tile paints at once, before its image.
- **Decoded-memory cap**, the real phone limit: a decoded image costs
  w × h × 4 bytes (480×640 ≈ 1.2 MB, 160×213 ≈ 0.14 MB). Keep decoded images
  under ~60 MB on a phone and ~150 MB on a laptop by choosing the bucket from
  how many tiles are on screen, not only their size; if the cap would be
  exceeded, drop one bucket.
- Loading is driven by culling, not `loading="lazy"`: at most 6 fetches at
  once, nearest to the view centre first; a tile culled before its image
  arrives cancels it (`src` removed). `decoding="async"`; first screen gets
  `fetchpriority="high"`.

**Motion and video.**
- Works are live pages; most move. The grid never runs them. A **motion
  preview** is captured with the screenshot: ~3 s, 320 px, as MP4 (H.264,
  ~100–300 KB) from Browser Rendering frames (or animated WebP if encoding in
  the Worker is easier).
- Played only when it matters: on a laptop on hover; on a phone when the tile
  is the most centred one in the feed. **At most 1 playing on a phone, 3 on a
  laptop.** `<video muted playsinline preload="none" poster=screenshot>`,
  created when it starts, removed when it stops (IntersectionObserver
  pauses anything off screen).
- **Students' own video** (later): original in R2; short previews and posters
  via Cloudflare Media Transformations (or Stream if it needs adaptive
  playback). Same play rules.
- **Opening a work**: exactly one live iframe on the page at a time.

## Sync and performance: how we build and prove it

**Sync protocol** (Class DO is the only writer):

- Ops carry `{opId, by, base}`; the DO assigns `seq`, applies, logs, and
  broadcasts. Clients apply in `seq` order.
- **Optimistic with pending overrides** (the Figma trick): a client applies
  its own op at once and keeps it in a pending list. While a field has a
  pending local op, remote ops on that field are applied underneath but not
  shown; the echo of the local op (later `seq`, so it wins anyway) clears it.
  No flicker, no rollback in the common case.
- **Reconnect:** the client sends its last `seq`; the DO replays the log since
  then, or sends a fresh snapshot if the log was compacted past it.
- **Log compaction:** keep the items table as the snapshot and the last
  ~2,000 ops (enough for undo and "since you were here"); older ops are
  dropped.
- **Order inside a group:** fractional index keys (strings between
  neighbours), never arrays, so two people inserting at once don't conflict.
- **Drags are presence, not ops:** position streamed at ≤ 20/s, coalesced,
  never stored; others see a ghost. The drop is one `set`.
- **Hibernating WebSockets** (DO hibernation API): between meetups the class
  costs nothing while sockets stay open.
- Co-typing inside a note is out of scope; if it ever matters, Yjs on that
  field only.

**Performance budget** (checked in CI-like scripts, not by feel):

| What | Budget |
|---|---|
| First wall paint, 4G phone | < 1 s after the snapshot (snapshot < 100 KB gzip for 500 works) |
| Pan/zoom, mid-range Android (Playwright, CPU ×4 throttle), 1,000 works | 60 fps, no frame > 32 ms |
| Phone memory, feed of 1,000 works | < 150 MB |
| Op round trip, 25 clients | < 150 ms p95 |

**Proving it:**

1. **Convergence fuzz** (Node, `packages/board/test`): random ops from N
   simulated clients with random delays and reconnects; after quiet, every
   client's document hash equals the DO's. Run thousands of seeds.
2. **Load script:** 25 bot clients over real WebSockets against the deployed
   DO doing moves, notes and group edits for 10 minutes; measure p95 round
   trip and check convergence.
3. **Frame test:** Playwright traces of pan/zoom on a 1,000-work fixture with
   CPU throttling, at phone and laptop sizes.
4. **Image check:** count bytes loaded for a phone feed scroll and a far-zoom
   canvas (expect none at far zoom).

**Escape hatches** if a class outgrows it: one DO per board instead of per
class (past ~2,000 items or several boards); group aggregation at far zoom
(past ~1,000 visible tiles); a GL renderer for the same boxes (not expected).

## Built: steps 2–3 (2026-10-22)

**Sync, proved first** (`packages/board/src/sync.js`, `test/sync.test.js`).
- One pure module for both sides: `createHub` (the DO's sequencer: seq, log
  of the last 2,000 ops, replay since a seq or a snapshot past compaction,
  dedupe by `opId` with an `ack`) and `createClient` (base + pending
  overrides, a gap buffer, resend after every sync). The Class DO and the
  browser run this same code.
- Groups delete as a tombstone (`gone`); works in a gone group wait in "Not
  placed yet" and come back on undo. Order inside a group: fractional keys
  (`between` in `doc.js`). Both are in the document and the fuzz, not yet in
  any UI.
- **Fuzz:** 3,000 seeds in ~3.5 s; 2–6 clients each, ~285,000 ops in all,
  24,000 reconnects, 17,600 replays, 2,800 snapshots after compaction, 1,240
  acks for resent ops; one seed in five delivers out of order. After quiet
  every client's hash and seq equal the server's, and no op is applied twice.
  Every local op shows at once. Eight broken variants of `sync.js` (no
  resend, no dedupe, no gap buffer, replay past compaction, no overlay, ack
  ignored, stale snapshot applied, echo not clearing pending) each fail it.

**Thumbnails** (`apps/studio/src/thumbs.js`). `GET /thumb/<id>/<n>/<w>`, w ∈
16, 160, 320, 480, 640: the PNG's top 3:4 via the Images binding, WebP, kept
as `projects/<id>/<n>.w<w>.webp`, `private, max-age=31536000, immutable`. The
same `visible()` check as files (others' private projects 404, no session
401). First make ~0.9–1.3 s, then ~0.25 s from R2. Sizes for a simple page:
1.1 / 2.2 / 3.4 / 4.6 KB; up to 8 KB for a photo. The 16 px placeholder is
82–116 bytes (~150 base64) and rides in the work record (`ph`). The chat's
project thumbnails now use the 320 width instead of the full PNG.
Backfill: `apps/studio/backfill-thumbs.mjs`, run once: 3 of 8 class projects
had a screenshot of their latest version (the rest predate screenshots and
show an empty frame with the title until their next version).

**The wall** (Class DO + home page).
- Class DO: `board_items(id, json)` and `board_ops(seq, op_id, op)` in its SQL;
  the hub loads once per wake. First load ever puts every shared project with
  a version on the board. On connect: chat hello, then the board (`?since=`
  gets the ops since, else a snapshot); then each op.
- `workChanged({ project, version, title, by })` over DO RPC: StudioAgent calls
  it after each version and again when the screenshot is in (adds `shot`,
  `ph`); the Worker calls it when visibility changes. The DO reads D1 and R2
  and does `put`, `set` or `del`, record id = project id, `t` moves only with
  a new version. Shared projects only; private ones are `del`.
- Home page: the wall replaces the grid. Its own width picks the view (feed
  under 700 px, canvas above); "Canvas · Newest first · By person" switch it,
  remembered per device. Read-only: a tap opens the project, a drag pans.
  The canvas starts with everything in view, or at the picture level at the
  top left when that would be far zoom. "Your private projects" stays a list.
- Renderer: a tile is 3 elements (box, `<img>`, caption; initials and the
  second caption line are pseudo-elements), recycled from a pool; ≤ 6 image
  fetches, nearest the centre first, cancelled when culled; bucket capped by
  decoded memory (60 MB phone, 150 MB laptop); placeholder as the `<img>`'s
  background; first screen `fetchpriority=high`.

**Numbers.**
- Live, two people (`walllive.mjs`): person 2's new version on person 1's
  project reached the top of person 1's open phone feed 108 ms after `done`,
  first in "Not placed yet" on the laptop canvas, caption "eka-test-002 · v3";
  the screenshot followed as a `set { shot, ph }`. Sharing a private project
  put it on person 2's open wall, making it private took it off; it was never
  in a snapshot or on a wall otherwise.
- First paint (Playwright, live, 8 works): the board snapshot arrives at
  0.5–0.8 s after navigation, the first tile 3–8 ms later; with 4G-like
  network and CPU ×4, snapshot at 1.1–1.4 s, tile +12 ms.
- Snapshot: 1.9 KB (0.75 KB gzip) for 8 works; ~335 B a work with its
  placeholder. 500 such works: 184 KB raw, 84 KB gzip (budget 100 KB).
- DOM: live home page 130 elements on a phone (wall 27), 129 on a laptop.
  Fixture of 1,000 works: phone feed scroll (60 flicks and a fling) at most
  96 elements, 317 image requests of which 242 cancelled before the answer,
  never more than 6 at once; laptop canvas at the picture level, panning, at
  most 408 elements, 6 at once.
- Images, live phone scroll of the whole feed: 3 thumbnails, 16 KB (640 px at
  3×; 480 at 2×).

**Not yet:** the far-zoom 2D canvas (zoomed all the way out, a 1,000-work
canvas is 3,000 elements); motion previews; ops from clients (moves, groups,
notes: step 4); names instead of ids.

## Built: steps 4 and 8 (2026-10-22)

**The document.** A group is a named place with a grid: its works carry `in`
and `order` (fractional keys) and the canvas lays them out four across from
the group's `at`, with one free slot at the end to drop into. A work outside
any group has `at`; neither = "Not placed yet". Ops people make are built in
one place (`doc.js`: `move`, `place`, `unplace`, `newGroup`, `rename`,
`removeGroup`); the canvas, the phone and the fuzz all use them. A reorder in
the same group writes only `order`. A work left without a key (an undo that
skipped `order`) goes last.

**The server checks people's ops** (`accept` in `doc.js`, run by the hub):
groups may be made (id `g-…`, name, place; `by` and `t` set by the server),
renamed, moved, deleted and undeleted; works may only get `at`, `in`, `order`.
Works, versions, titles and deletes come only from the studio. A refused op is
acked back, which drops it from the sender's pending list.

**Undo** (`sync.js`, client): each field of the board remembers which op wrote
it last, from the ops in server order. Ctrl/Cmd+Z (or "Undo") takes my newest
op not undone yet and puts back, field by field, the value from just before it
in server order (captured when its echo arrives; until then, what I saw).
Fields someone else wrote since are skipped; an op with nothing left is passed
over for the next. An undo is an ordinary `set` with `undo` and `w`, the
writers it restores, so a later undo by anyone sees the fields as they were
(undoing my delete hands the group back to whoever made it). Undo of making a
group deletes it. Undo reaches back across reconnects; after a snapshot (the
log compacted past me) fields are unknown until written again. No redo.

**The canvas** (`wall.js`). Mouse or pen: drag a work anywhere, or onto a
group's grid between two works (the pointer picks the slot); drag a group's
name to move it with its works; click the name to rename or delete it. "New
group" puts one in the middle of the view. A finger pans (phones place with
taps). Others' drags: the position is sent at most every 50 ms (coalesced, the
latest wins), relayed by the Class DO to everyone else and never stored, and
shown as a dashed outline with the person's name; it goes on let-go or after
3 s of quiet. The drop is one `set`. Group frames are a hairline around the
grid. A remix and its source are joined by a thin line over the tiles (one
`<svg>` with one `<path>` for all lines; adjacent tiles leave only a 12-unit
gap, so a line under them barely showed).

**Phone.** In "Newest first" and "By person", each work has a "Put with…" link
(`With <group>` once placed); it opens the group list as plain links over the
bottom of the screen; picking one puts it in that group's next slot, "Not
placed yet" takes it out.

**Numbers.**
- Fuzz (`test/sync.test.js`): 3,000 seeds in ~8 s, 312,000 sequenced ops:
  33,700 groups made, 21,300 renames, 17,500 deletes, 9,100 undeletes, 16,000
  group moves, 53,700 moves, 75,000 placements in a group, 18,700 unplacings,
  5,900 remixes placed by the server; 33,500 undos (66,500 fields; 4,150 ops
  passed over because others had rewritten them, 90 partial), 3,750 Ctrl+Z
  with nothing to undo; 8,100 forged ops (works, deletes, titles, taken ids),
  all refused; 6,900 refusals of real ops, each because its target was gone
  or it was a resend past the dedupe window. 10,000 seeds: 26 s, 1.04 M ops,
  112,000 undos, green. Checked per op: it shows at once and means what it
  says on the client's own canvas (a move is at the drop, a placement at its
  index in its group's grid, a delete sends its works to "Not placed yet", an
  undone delete brings them back, a remix lands right after its source); per
  undo, against an independent replay of the server's full log: which op,
  which fields, which values, which writers; after quiet, every client equals
  the server, and the server equals the replay of its log.
- Broken variants, each caught: move keeps the group; order off by one;
  group made without a place; rename writes title; delete is a `del`; remix at
  the end of its group; server takes any put; server refuses lowercase keys;
  undo without the skip check; undo with the values from when I made it;
  undo restores no writers; undo the same op twice; undo skips making a group;
  writers ignore an undo. (Plus the eight from steps 2–3.)
- Live, two people (scratchpad `board4live.mjs`, Playwright, cookies from a
  script): a group made by person 1 on person 2's open canvas in 67–181 ms; a
  drag streamed 20 positions in 1.3 s (15/s) and person 2 saw the ghost; the
  drop on person 2's canvas 54–368 ms after let-go; rename, delete (its work
  back to "Not placed yet"), Ctrl+Z (group and work back), Ctrl+Z (name back)
  all live on the other canvas; person 2 then moved the work out, and person
  1's next Ctrl+Z passed over it and undid making the group; with nothing
  left, Ctrl+Z sent nothing and "Undo" hid. Both moving one work at once: both
  canvases and a fresh load agreed, the later in server order won. A phone's
  "Put with…" put it in a group on the laptop canvas.
- DOM: live home page 163–165 elements (laptop canvas, phone feed). The
  1,000-work fixture after these changes: phone feed scroll at most 98
  elements, laptop canvas panning at most 410, ≤ 6 image fetches at once.

**Not yet:** notes; follow and presence on works (step 5); the far-zoom 2D
canvas; group aggregation; nudging overlaps apart; a group frame doesn't grow
to show free-placed works near it; "since you were here".
