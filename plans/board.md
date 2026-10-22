---
status: idea
---

# The board: everyone's works, one document, many views

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

The first piece exists: `packages/board/` (see the last section).

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
  - To check before building: the binding's tutorial lists an Images Paid
    plan as a prerequisite. If that holds for us, the fallback is a second,
    smaller screenshot (WebP) taken in the studio's check while the page is
    already open.
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
   studio project list uses it first.
3. **A read-only wall in the class space.**
   - The Class DO keeps the records.
   - StudioAgent calls `workChanged` on each version.
   - The page `/wall` loads a snapshot, then live ops.
   - The feed and people views are complete from day one; the canvas shows
     everything as "Not placed yet".
4. **Arranging on the canvas:** groups, moving works (ops through the Class
   DO), and per-person undo.
5. **Presence:** who's here; initials on the work someone has open; "follow"
   a person's view during a crit on the projector.
6. **Phone contributions:** "Put with…" and notes.
7. **Opening a work in place:** the live iframe, the version strip and the
   conversation, then back to the same spot.
8. **Provenance lines:** `from` drawn on the canvas.
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
