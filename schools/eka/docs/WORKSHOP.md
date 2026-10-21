# Workshop → studio: what to carry over

Assessment of `~/personal/workshop` (and its siblings) for the course studio
(`STUDIO.md`). Read-only review: code, git history, the deployed site, and the
lineage notes in `~/personal/visualia/plans/lineage.md` and `mcp.md`. The repo
itself has no design docs (`README.md` is the Nuxt starter text) and no notes
on how sessions went, so the pedagogy section is inferred from the code.

## 1. What workshop is

**One sentence:** a group chat next to a big shared "board", where anyone can
put things on the board or summon an AI by writing `@`-commands in the chat.

### Related directories

| Dir | What it is | Relevant? |
|---|---|---|
| `~/personal/workshop` | The app. Nuxt 4 + Vue 3 + Tailwind, 23 commits, 14–19 Jan 2026. Local `main` is 20 commits ahead of GitHub (`kristjanjansen/workshop` only has the starter). | Yes |
| `~/personal/workshop_builder` | Vue SFC generator: prompt → `gpt-4.1-nano` → Vue component compiled in the browser, previewed in an iframe with error rollback. No commits. Same week. | Yes, for the preview harness |
| `~/personal/school` | Bare GPT chat starter (Aug 2025, no commits). | No |
| `~/personal/learning` | Three.js/RxJS demo files. Different lineage. | No |
| `~/personal/visualia/plans/lineage.md` | Kristjan's own history of the line (2017 slides → elektron → workshop → visualia board). Has a workshop section. | Context |

### Features (as built)

All interaction runs through one chat stream. Commands combine in a message.

| Command | Effect | Where |
|---|---|---|
| plain text, image, image URL, YouTube URL | Chat message; image URLs are fetched via proxy and resized to a JPEG data URL; YouTube embeds inline | `app/app.vue` `sendMessage`, `app/utils/urls.ts`, `app/utils/images.ts` |
| `@ai <q>` (+image) | Server LLM call (`gpt-5.1-codex-mini`, vision); reply is broadcast into chat as participant "🤖 AI" | `server/api/chat-ai.post.ts` |
| `@board <text \| url \| yt>` (+image) | Replaces the board. Auto-mode: YouTube → embed, web URL → iframe through `site-proxy`, image → full-bleed, text → markdown, huge type if one sentence | `app/components/Board*.vue`, `server/api/site-proxy.get.ts` |
| `@card <text>` (+image) | Adds a card to a vue-flow canvas, auto grid placement | `app/app.vue` `showCardOnBoardWithMedia`, `BoardDiagram.vue` |
| `@diagram <intent>` | LLM returns `{nodes, edges}` JSON → vue-flow diagram, labels in the user's language | `server/api/diagram.post.ts`, `app/utils/diagram.ts` |
| `@app <topic>` | LLM writes a self-contained interactive teaching page (Tailwind CDN + vanilla JS, sliders/draggables, fits the board, matches host style) → iframe `srcdoc` | prompt inline in `app/app.vue` |
| `@art <prompt>` | LLM picks generative-art *parameters* (style, palette, chaos…) → client renders to canvas → sent as an image. In the deployed build only; removed in the last commit | `git show 69ea906:server/api/art-params.post.ts`, `git show 69ea906:app/app.vue` (`renderGenerativeArt`) |
| `@clear` | Empties the board | `app/app.vue` |
| `@focus` | Local toggle: chat hides, board goes fullscreen, compose floats bottom-left; **others' board commands are ignored except `@card` in card mode** | `app/app.vue`, `app/components/Layout.vue` |

Other details: random pronounceable names (`app/utils/ids.ts`), editable;
copy button on every message puts its text (and image) into your compose box;
typing anywhere on the page goes into the compose box
(`app/components/ChatCompose.vue`); chat auto-scrolls only when you are near
the bottom (`ChatMessages.vue`); connection status dot (`ChatUser.vue`).

Not there: presence/roster, polls, history for late joiners, slides or
step-by-step lessons, shared code editing, rooms, auth, teacher role.

### Architecture

```
Browser (Nuxt SPA, Vue)          ── WebSocket ──►  data.elektron.art (elektron-era relay, not in this repo)
  every client parses @commands                     broadcasts every message to every client, no channel, no history
  and updates its own board
  │ $fetch
  ▼
Nuxt server on a Cloudflare Worker (nitro cloudflare_module)
  /api/chat-ai, /api/diagram, /api/art-params → OpenAI (key in env)
  /api/site-proxy, /api/image-proxy           → fetch arbitrary URLs
```

- **Transport:** `useWebSocket` to the old elektron relay; one message type,
  `WORKSHOP_MESSAGE {value, image?, youtube?, userId, timestamp}`. Images ride
  the socket as base64.
- **State:** none on the server. Each client holds `messages` and board state
  in Vue refs. The board replicates because every client re-executes the
  commands it sees (`applyViewCommandsFromMessage` in `app/app.vue`) — the
  lineage notes call this "command-sourcing".
- **Cloudflare:** only as a Worker host (`.output/server/wrangler.json`, name
  `kristjanjansen-workshop`). No DO, KV, D1 or R2.

### State of the code

- Six days of work, then nothing since 19 Jan 2026. A sketch for a talk, not a
  product.
- The last commit (`cfade08 hm`) split a ~1,700-line `app.vue` into components
  and dropped `@art`. Even after it, `app/app.vue` (628 lines) has the
  `@board/@diagram/@app/@clear` handling **duplicated** between the sender path
  and the receiver path, with drift (receiver resets `boardYouTubeId` on
  `@diagram`, sender doesn't; sender calls `flowInstance.fitView`, receiver
  `boardRef.fitView`).
- **Real bugs in the model:**
  - `@app` and `@diagram` are re-run by *every receiving client*: N students =
    N LLM calls and N different boards. `@ai` and `@art` do it right (sender
    computes once, broadcasts the result).
  - Late joiners see an empty chat and board.
  - No channel field, so every workshop on the relay is one global room.
- **Security of the live deploy:** `/api/chat-ai`, `/api/diagram`,
  `/api/art-params` are unauthenticated and spend the OpenAI key;
  `/api/site-proxy` is an open HTML proxy that strips CSP and only blocks
  `localhost`/`.local` (no RFC 1918, link-local or IPv6 ranges); chat markdown
  from other users goes through `marked` into `v-html` unsanitised, so any
  participant can run script in everyone's browser. Worth taking down or
  rotating the key if it isn't in use.

### What's deployed today

`https://workshop.kristjan-jansen.workers.dev/` serves the build from before
the last commit (its bundle still contains `@art` and `art-params`; checked
2026-10-21). The page loads; API routes respond (400 on empty input); the relay
at `wss://data.elektron.art` accepts connections, with no traffic seen in a 6 s
listen. So it works, as a single global room with no history.

## 2. What worked pedagogically

Inferred from the code and the lineage it continues (elektron chat, fachwerk
lessons, eka_webhook's 2018 `@`-commands):

1. **One public stream.** Every question, image, and AI answer is seen by the
   whole room. Prompts become shared material: you see how others ask, and the
   copy button lets you take someone's prompt and change it.
2. **AI as a visible participant, called on purpose.** The AI speaks only when
   addressed with `@ai`. People talk to each other by default, and the AI
   answer lands in the same place for everyone.
3. **A stage that anyone can push to, but the presenter controls.** `@board`
   is "put this on the projector". `@focus` turns a client into a projector
   that ignores everyone's board changes except cards, so the teacher keeps
   the stage while the class still contributes.
4. **Contributions as cards.** `@card` is a collective brainstorm: everyone
   adds, the wall fills in a grid.
5. **Generated explorables on demand.** `@app` makes an interactive explainer
   (sliders, live feedback) for whatever the room is talking about, styled to
   fit the stage. This is the fachwerk/designstem "Explore" step, produced on
   the spot instead of authored in advance.
6. **Almost no friction.** No login, a name is generated, you can start typing
   anywhere on the page, images and links just work.

What the code doesn't show: how it went with an audience, whether the
command syntax was learnable for non-programmers, or how a busy room behaved
with everyone changing one board.

## 3. What to bring into the studio

### Ideas and interaction patterns (most important)

| Workshop pattern | Studio feature it maps to | How it changes the plan | In STUDIO.md today? |
|---|---|---|---|
| Humans chat; the AI acts only when addressed (`@ai`) | Rooms, turn-taking | A room has **people chat** and **agent requests**. Only a request (`@agent` or a "send to agent" button) enters the turn queue. Talk stays out of the model context and off the usage record | **No.** STUDIO treats every room message as a request |
| `@board`: anyone pushes to a stage | Mob mode, teacher view, gallery | A **stage**: one big surface showing a text, image, URL, video, live preview or published version. Students push, the teacher's projector shows it | **No.** Mob mode has suggestions but no stage; the gallery is a grid |
| `@focus`: presenter ignores pushes except cards | Mob mode, moderation (open question) | **Stage lock** held by the teacher: when on, pushes become suggestions the teacher accepts. Gives moderation a concrete first form | Partly (teacher picks which suggestion runs) |
| `@card` wall | Shared brief, shared canvas | A **card wall** before the brief: everyone adds ideas or reference images, then the group promotes cards into the brief. Later the cards live on the visualia board | **No.** The brief is edited directly |
| Copy any message into compose | Mob mode, forks | **Remix a prompt**: every queued or past request has "use this prompt". A small fork for prompts, so good prompts spread | **No** |
| `@app` host-style constraints in the prompt | Skills (`eka-house`, templates) | The constraints (fit the frame, no scroll, minimal text, help behind "?", match host colours) go into `eka-house` and a new `interactive-explainer` template skill | Partly (`eka-house` exists, content doesn't) |
| `@art`: LLM picks parameters, code renders | Template skills; block A "creative hallucinations" | A `generative-params` template: model outputs a small JSON of parameters and a fixed renderer draws it. Cheap models do this reliably, and the parameters are inspectable | **No** |
| `@diagram`: LLM → `{nodes, edges}` | Shared canvas (visualia MCP) | Same verb as visualia's MCP tools; `mcp.md` already plans "one vocabulary, three transports" | Yes, via visualia |
| Vision on shared images (`@ai` + image) | Later: sketch/screenshot-to-page | Images in the room are context the agent can read when a request references them | Later list only |
| Send results, not commands (`@ai`, `@art` right; `@app`, `@diagram` wrong) | Every collective feature | Design rule: the agent (DO) runs once and broadcasts the result. Clients never re-execute LLM work. Comes free with Think | Implied |
| No history for late joiners | Rooms | Stage, cards and room chat live in DO state/SQLite and replay on connect | Implied for Think chat, not for new objects |
| Generated names, no login | Credit/opt-out (open question) | Pseudonymous display names for anyone who opts out of being named; a guest mode for open days or conference demos (view and card only, no agent spend) | **No** |

From `workshop_builder` (`~/personal/workshop_builder/app/app.vue`,
`server/api/generate-vue.post.ts`):

| Pattern | Studio hook | In STUDIO.md? |
|---|---|---|
| Preview iframe reports runtime errors to the host by `postMessage`; host keeps the **last good version** on screen | Preview; `onChatResponse` verify | **No.** STUDIO verifies with Browser Rendering afterwards; this catches errors live in the student's own browser, free |
| The last error goes into the next request ("LAST_ERROR_TO_FIX") | Verify with one auto-fix | Yes in spirit; this is the cheap first version |
| A host-held store survives regenerations, so slider values and state persist across edits | Preview | **No.** Nice for p5/three sketches: change the code, keep the scene |
| "Smallest change that satisfies the request; return the full file" edit prompt | `eka-house` skill | Partly (Think's `edit` tool covers the mechanics) |

### UI pieces worth porting to vanilla JS

All small; rewrite rather than translate. Drop Vue, Tailwind and vue-flow.

| Piece | Source | Port notes |
|---|---|---|
| Three-slot layout (stage ¾, chat ¼, compose under chat; mobile stacks) + focus mode | `app/components/Layout.vue` | CSS grid with named areas; focus = a class on `<body>`. Also a natural first **layout description** for the reshapeable UI (slots: stage, chat, compose, queue) |
| Stage renderer: text (one sentence → huge centred, several → left-aligned large), image full-bleed with dark overlay for text, iframe, YouTube | `app/components/Board.vue`, `BoardText.vue`, `BoardWeb.vue`, `BoardYouTube.vue`, `BoardApp.vue`, `app/utils/markdown.ts` `hasMultipleParagraphs` | One `renderStage(el, item)` switch. Sanitise markdown (DOMPurify) |
| Message list: author, time, own vs others, autoscroll only near bottom, copy-to-compose | `app/components/ChatMessages.vue` | ~60 lines; author comes from the server stamp, not the client |
| Compose: autosizing textarea (`field-sizing: content`), Enter sends, image attach with pending thumbnail, type-anywhere focus | `app/components/ChatCompose.vue` | Keep type-anywhere off on pages with a live preview, it steals keys from sketches |
| Card styling (4:3 card, image cover, text overlay) | `app/components/BoardDiagram.vue` `<style>` | For the card wall as a plain CSS grid; the visualia board takes over later |
| Connection dot | `app/components/ChatUser.vue` | `AgentClient` open/close events |
| Preview harness (ready / applied / runtime-error messages, rollback) | `~/personal/workshop_builder/app/app.vue` `buildIframeSrcdoc` | Vanilla already; drop the Vue SFC compile, keep the protocol |

### Code and infra reusable as-is (or nearly)

| Code | Source | Use |
|---|---|---|
| URL helpers: first URL, image URL, YouTube id from any URL form, strip URL | `app/utils/urls.ts` | Pure functions; strip types and copy |
| Client-side image resize to JPEG (max 800 px) | `app/utils/images.ts` | Before uploading to R2, not before sending over the socket |
| Pronounceable ids | `app/utils/ids.ts` | Guest and pseudonymous names |
| `@` command stripping | `app/utils/commands.ts` | Display text cleanup for `@agent`, `@stage`, `@card` |
| Image proxy | `server/api/image-proxy.get.ts` | Port to a Worker route **with** a proper private-range block and auth; visualia's `plans/image-proxy.md` already specs this |
| `@app` prompt text | `app/app.vue` (`appPrompt`) | Seed for `interactive-explainer` skill |
| Diagram system prompt | `server/api/diagram.post.ts` | Seed for a visualia-MCP diagram skill |
| Art-params prompt + renderer | `git show 69ea906:server/api/art-params.post.ts`, `git show 69ea906:app/app.vue` (lines 638–1385: seeded RNG, `renderGenerativeArt`, `generateArtDataUrl`) | Seed for `generative-params` template skill and its fixed renderer |

### Leave behind

- Nuxt, Vue, Tailwind, `@vueuse`, vue-flow, the Vercel `ai` SDK and direct
  OpenAI calls. The studio goes through the course gateway and Think.
- The `data.elektron.art` relay. A Durable Object is the room: identity,
  history, channels and broadcast come with it.
- Client-side command execution and the duplicated sender/receiver paths.
- Base64 images over the socket (use R2 keys).
- `site-proxy` as written (open proxy, strips CSP, rewrites links). If the
  stage needs to show external sites, try a plain iframe first and fall back
  to a screenshot via Browser Rendering.
- Unsanitised `marked` → `innerHTML`.
- Regex extraction of HTML from model output (`cleanAiHtmlResponse`); Think
  writes files through tools.

## 4. Plan

Assumes STUDIO's core single-file loop and the "Collective" rooms/queue
exist or are built at the same time. Items marked *(in STUDIO estimate)* are
already counted in STUDIO's ≈6–8 days; the rest is new.

| # | What | Hooks into STUDIO.md | Effort |
|---|---|---|---|
| 1 | **Room chat vs agent requests.** `say()` callable stores people messages in the agent's SQLite (separate from Think's messages) and broadcasts; `@agent` or the send-to-agent button enqueues a turn. Server stamps the author. Replay last N on connect | Collective → Rooms, Turn-taking | 1.5 d (≈1 d in STUDIO estimate) |
| 2 | **Preview harness** from `workshop_builder`: iframe posts runtime errors, host keeps last good, error goes into the next turn as context; host-held store survives regenerations | Architecture → Preview; skills → `verify-preview` | 1.5 d |
| 3 | **Stage.** State object `{kind, payload, by, at}` in `ClassAgent` (class projector) and per project room; vanilla stage renderer and three-slot layout; "show on stage" on messages, previews, versions and gallery items; `@stage` in chat | Mob mode, gallery, teacher view | 2 d |
| 4 | **Stage lock and mob suggestions.** Teacher toggle: when locked, pushes and student `@agent` requests become suggestions; teacher accepts, reorders, drops. "Use this prompt" on every suggestion and past request | Mob mode; Turn-taking; Moderation (open question) | 1 d (+ mob mode itself, in STUDIO estimate) |
| 5 | **Card wall.** `@card` (+image) → cards in project state, CSS grid on the stage; "promote to brief" appends to the shared brief | Shared brief; Shared canvas (cards move to visualia via MCP later) | 1.5 d |
| 6 | **Media intake.** Image attach and paste, client resize, upload to R2, image proxy route with private-range blocking; agent turns can reference room images (vision models only) | Later → sketch/screenshot-to-page; Data model (R2) | 1 d |
| 7 | **Skills from workshop prompts:** `interactive-explainer` (from `@app`), `generative-params` (from `@art`), diagram verbs for the visualia MCP skill; host-style rules into `eka-house` | Skills | 1 d |
| 8 | **Guest and pseudonymous names.** Pronounceable ids for guests (view and card only, no spend) and for students who opt out of being named | Open question → Credit; Auth | 0.5 d |

**Total:** ≈10 days of work, of which ≈7–8 are new on top of STUDIO's
collective estimate. Order matters for 1 → 3 → 4 (the stage needs room
identity; the lock needs the stage). 2 can go first, alongside STUDIO's first
experiment, since it improves the single-file loop for everyone. 5–8 are
independent and can be cut.

**Smallest useful cut:** 1, 2, 3 (≈5 d). That gives a room where people talk,
the agent runs on request, previews self-report errors, and the teacher has a
projector stage. That reproduces what workshop did at the conference, on
studio infrastructure, with history and identity.
