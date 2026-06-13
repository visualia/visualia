# Lineage — nine years of ideas feeding the board

Harvest notes, NOT a plan. Everything mined 2026-06-12…13 from the project's
ancestry for live education, presentations and generative art on the
infinite canvas. Organized chronologically by repo creation date; the links
corpus and the idea lineages have their own sections at the end.

Timeline at a glance:

| When | What | One line |
|---|---|---|
| 2017 | kasutajaliidesed1–3 | interactive course slides; `[[shortcodes]]`; type/form/motion explorables |
| 2018 Jun | make | generative 2D art on rune.js; the utils layer is born |
| 2018 Aug | designstem/fachwerk | Vue 2 teaching framework; reactive markdown; pattern components |
| 2018 Nov | eka_{client,speech,server,webhook} | bot, voice, relay, @-commands — realtime stack in embryo |
| 2019 | designstem/projects | 26 real lessons; 5E; the intro-to-CS ladder |
| 2020 Mar | visualia_first | Vue 3 framework; 5 render modes; Monaco language server |
| 2020–23 | elektronstudio | live performance platform; message vocabulary; multi-runtime |
| 2021 Jan | eka_virtual | spatial video chat — draggable WebRTC blobs |
| 2021 Jun | visualia_second | 673-line lib; geometry-as-data |
| 2022–24 | fachwerk-dev | Slidev parsing; Strapi backend; sandboxed live Vue |
| 2024 Oct | wakeup trio | multiplayer spatial synth; zones as triggers |
| 2025 Jan | studio | WHIP/WHEP live video on Cloudflare Stream |
| 2025 Mar | demo | record/replay transport over interactions |
| 2026 Jan | workshop | @-commands drive a shared board; LLM participants |
| 2026 Jun | visualia (board) | the engine — terminus; gaps = everything above |

Clone paths while they last: `/tmp/harvest-{kasutajaliidesed,misc,fachwerk,
projects,visualia-first,visualia-second,elektron,eka,fachwerk-dev,wakeup,
studio,demo,workshop}`; workshop's real code is local at
`~/personal/workshop` (ahead of GitHub).

---

## 2017 — kasutajaliidesed1–3 (the origin: interactive UX/UI course slides)

"Interactive slides for UX/UI course in Tartu University CS department",
a trilogy (Apr–May 2017): part 1 visual design, part 2 interaction design,
part 3 animation + designer process + future of UIs. Vue 2 + marked +
anime.js + d3-scale/d3-shape — the exact vendor set fachwerk adopted a year
later. Everything starts here:

- **Markdown slides**: `slides.md` split on `---`; each slide rendered by a
  Vue component chosen by content shape (`src/App.vue` — Markup, Heading,
  Youtube, Photo…). Prev/next + counter; ~50 lines of framework.
- **The first shortcode syntax**: `[[typo text1.md]]` — double-bracket
  component embeds in markdown, WITH an argument: a markdown file of
  classic Estonian literary prose fed into the exercise.
- **Teaching instruments as components** — and the subject is visual design
  itself: `Typo.vue` is a **live type specimen with sliders** (font family,
  size, line-height, padding, text opacity) where students typeset a real
  text passage inside the slide; plus `Contrast`, `Color`, `Wheel/Wheel2`
  (color wheels), `Photo`, `Site`. The
  [design-playground](design-playground.md) specimen insert, nine years
  early — the oldest idea in the tree is the one currently sketched.
- Parts 2–3 extend the instruments to interaction design (`EditField/ShowField/
  Fields` — form-field exercises) and motion (`Typo3`), and the curriculum
  canon shows early: Frank Chimero's *What Screens Want*, Apple HIG 1987 —
  "Why shouldn't using a computer be **fun**?"

## 2018 (Jun) — make (generative 2D art; self-declared fachwerk predecessor)

"Generative 2D art in Javascript, a wrapper around rune.js adding extra
utilities. Predecessor of designstem/fachwerk" (kristjanjansen/make). Two
months before fachwerk; the utils layer is born here:

- **First appearance of the signature trig pair**: `circlex/circley` with
  the −90° offset (0° = North) — the exact functions that become fachwerk's
  `polarx/polary`, second's `polar()`, fachwerk-dev's `pol2car`, and
  wakeup-synth's stage math. Plus `scale()` (the Processing map) and
  `round`.
- **Pedagogical aliasing**: `random = gimme = something = anything` — and
  array helpers with synonym chains (`add/plus/increase/inc/from`) — a
  natural-language-ish vocabulary so non-programmers can read code aloud.
- Array-prototype pipeline play: `[1,2,3].step(50).add(10).between(0,100)` —
  chainable numeric arrays as a composition teaching tool.
- 5000×5000 SVG canvas with layered **grid overlays + labels** (design-grid
  scaffolding as a first-class scene element).
- Built on **rune.js** — Rune Madsen's graphic-design library, which is
  also entry #1 in the links corpus: the Programming Design Systems school
  of thought is the explicit foundation.

## 2018 (Aug) — designstem/fachwerk (Vue 2 teaching framework)

Markdown teaching/presentation framework; zero build step (open HTML, edit,
see), single-file distribution for locked-down classroom machines.

- **Reactive state woven into content** — the signature idea. Global store,
  `get(key, default)` / `set(key, value)` callable from any component or
  markdown interpolation (`src/utils/state.js`): a slider anywhere drives a
  scene anywhere, no wiring. Plus `send/receive` channels and declarative
  `<f-keyboard alt character="e">` shortcut components.
- **Document ↔ slides** as two projections of one markdown (Alt+T); live
  CodeMirror editor side-by-side (Alt+E), cursor/scroll preserved,
  localStorage autosave keyed by doc title.
- **Pipe-metadata DSL**: `| theme: dark`, `| height: 100vh`, `| 1 2 3` (CSS
  grid), `---` slide breaks, `| chapter/section:` + ids for deep links
  (`src/utils/internal.js` parsePage).
- **The sacred-geometry component family** (`src/components/2dpattern/`),
  each a slot-repeating transform:
  - `FSpinPattern` — rosettes/mandalas (repeat slot N×, rotate `360/N`°)
  - `FMirrorX/Y` — reflection via `scale(1,-1)` + clipPath; nested = kaleidoscope
  - `FGridPattern/FBrickPattern/FHexPattern/FCirclePattern` — tilings; hex =
    60° polar math, alternating row offset; slots get `{row, col, index}`
  - `FRegularpolygon/FHexagon/FPolyhedron3` — N-gons from `polarpoints()`,
    3D solids
- **Math substrate** (`src/utils/trig.js`): `polarx/polary/polarpoints` with
  −90° offset (0° = North, visual convention), `deg2rad/rad2deg`.
- **~50 documented utils injected into markdown scope**: `range`, `scale`
  (the Processing map), `random`, `distance`, `shuffle`, `any`, `chunk`,
  `unique`, `rgb/hsl`, `colorscale` (chroma.js), `colorblind`, `contrast` —
  and the **RYB↔HSL painter's-wheel mapping** (`aihues/ai2hue/hue2ai`) for
  harmonies that look right to designers.
- Vendor exposure: d3 scales/shapes, chroma, anime.js, three.js; music/MIDI
  experiments (synth, drum sequencer, piano).

## 2018 (Nov) — the EKA Emerging Theme quartet: eka_{client,speech,server,webhook}

Masters-project messaging experiments; the whole realtime stack in embryo:

- **eka_client** — single-file Vue chat with a **scripted bot participant**:
  rules `{check: 'message == "hi" && greeted != "1"', message: "Hi!",
  state: "greeted = 1"}` evaluated with **jexl**, **compromise** NLP for
  fuzzier matching, template replies, persistent conversation state.
  Identities are random Pokémon names — ancestor of workshop's
  pronounceable ids. The proto-`@ai`.
- **eka_speech** — voice as a chat modality: Web Speech API both directions
  (SpeechRecognition transcription in, SpeechSynthesis with voice picking
  out) over the same socket. A thread nothing since has picked up.
- **eka_server** — the ur-broadcaster: **16 lines** of socket.io echo +
  broadcast relay. Becomes elektron `ws` (+Redis, +store/replay, 2021),
  then studio's 5-line Nitro handler (2025), then workshop on
  `data.elektron.art` (2026).
- **eka_webhook** — **the first @-commands, 2018**: a micro service
  listening on the chat socket — messages starting `@ifttt` / `@slack` are
  routed OUT to IFTTT maker webhooks and Slack; POST endpoints `/ifttt`
  `/slack` inject external events INTO the chat. @-addressing was born
  bidirectional: chat as a bus bridging the outside world, eight years
  before `@board`. (Era note: IFTTT/Slack keys hardcoded — long dead, but
  the same hygiene slip as studio 2025.)

## 2019 — designstem/projects (~26 classroom lessons on fachwerk)

The proof the model worked with real teachers (Estonia/Finland/Germany,
secondary + vocational).

- **5E lesson structure**: Engage (real-world hook) → Explore (interactive
  sim) → Explain (math/sidebar overlay) → Elaborate (project) → Evaluate
  (reflection/peer review). Hands-on + digital pairing (paper construction
  next to its 3D sim).
- **Pacing machinery**: chapters/sections with ids (deep links), next-button
  progression, full-height themed sections, non-modal `f-sidebar overlay`
  for reference matter, inline "🤔 Discuss" prompts.
- **The intro-to-CS pedagogical ladder** (explicit in `patterns/index.md`) —
  the harvest's keystone:
  1. one shape + one slider (variables)
  2. `v-for="x in range(-2,2)"` (iteration)
  3. nested ranges → grid (composition)
  4. slider sets state, everything reads it (reactivity)
  5. `scale(row, 0,2, 0,255)` (mapping domains)
  6. `hsl(scale(...), scale(...))` (function composition)
  Every rung is a live visual change, never an abstract exercise. The
  `algorithms/` lesson grounds it pre-code: recipes → paper folding →
  randomness → emergent pattern.
- **Spirals lesson** (`spirals/components/Spiral.js`): Archimedean
  `r = a + b·θ`, d3 cardinal-spline smoothing; curriculum walks nature →
  polar coords → spreadsheets → parametric play. Polygon math in
  `triangles/utils.js` (`solvePolygon(n, r)`).
- **Google Sheets as CMS** (`FSheetsV4`) for glossary/team/links — content
  editable by non-programmers.
- Which components earned their keep across 26 lessons: slider, drag,
  scene, scene3, math, sidebar, video.

## 2020 (Mar) — visualia_first (GH: visualia_original; Vue 3 framework)

The maximalist successor: a full framework again, Vue 3 beta, ES-module CDN
distribution, no build step.

- **Multi-mode rendering**: every primitive (`v-circle`, `v-rect`…) has
  svg / canvas / three-SVG / webgl / **pdf** implementations; `VScene`
  selects via provide/inject; transforms compose hierarchically down the
  tree (`src/internals/transform.js`).
- **Runtime markdown→Vue compilation** (`src/internals/compiler.js`):
  `~~~live` fences become `<v-live>` split editor/preview; whole page
  compiled in-browser via `@vue/compiler-dom`.
- **Monaco as a real language server** (`editor/components/VMonaco.js`):
  custom language, completions, hover docs from source, live template
  compile errors, formatting.
- **`docs_*` convention**: every util exports a doc string with a live
  example fence — self-documenting, executable docs.
- Utils refined: `circlepoints`, `gridpoints`, `snap`, same color/RYB suite.
- Gaps: no presenter mode/notes, no audio, declarative-only animation.

## 2020 (Sep) – 2023 — elektronstudio (live performance platform)

elektron.art: virtual stage for performing arts. `v1`–`v4` clients, `ws`
broadcaster (behind `data.elektron.art`), `example_{p5,tonejs,max,python,
figma,vue}`, `foyer` (React 3D venue), `teaching`, `docs`.

- **The message vocabulary** ("many actions" over one ws): `CHAT`, `HEART`,
  `LIKE`, `IMAGE` (webcam frame ~1Hz → audience video wall),
  `IMAGE_JOIN/LEAVE`, `USER_UPDATE`, `CHANNEL_JOIN/LEAVE` →
  `CHANNELS_UPDATED` (presence rosters), `CHAT_SYNC`/`LIKE_SYNC` (history
  replay), `VIDEO` (encoder webhook), `STATS`. Literal slash commands: just
  `/update` (all clients reload) and `/reset` (clear state everywhere),
  parsed in `v1/src/lib/chat.js`.
- **The ws server** (~176 lines, `ws/index.js`): envelope `{id, datetime,
  userId, userName, channel, type, value, store?}`; everything through a
  Redis channel, fan-out to all sockets; `store: true` appends to a Redis
  list; REST `GET /messages` replay; webhook ingest. No auth; `channel`
  field = room multiplexing.
- **Runtime-agnostic clients driving art live** — the killer idea. The
  example_* repos prove any JSON+ws speaker participates: Python sends
  values, p5 renders, ToneJS plays, Max/MSP reacts. Chat literally drives
  visuals and sound during performances.
- Missing (ours to add): spatial cursors/viewport sync, drawing primitives,
  CRDT, permission tiers.

## 2021 (Jan) — eka_virtual (spatial video chat, EKA workshop)

"Remote collaboration in virtual environments" workshop result
(kristjanjansen/eka_virtual); shares code with elektron.live. **Live WebRTC
video tiles (OpenVidu) as draggable avatars on a shared plane**:

- Drag broadcasts `CHANNEL_USER_UPDATE {userX, userY, userScale}` over the
  elektron ws (debounced 100ms) — everyone sees everyone's camera move;
  per-user scale slider too.
- **Organic blob video masks**: a palette of hand-tuned `border-radius`
  recipes (`src/lib/radiuses.js`, e.g. `60% 40% 60% 40% / 50% 35% 65% 50%`)
  — video tiles as soft shapes instead of rectangles; CSS blend modes.
- Join/leave sound effects (watch on subscriber count → `events.emit("play",
  "join")`), screenshare as a message type, camera/mic device pickers,
  Google Sheets config (the old `gsx$` feed API).

The direct ancestor of wakeup-synth's avatar plane (2024) — with real video
instead of dots — and the closest existing thing to "live cameras as
draggable nodes on a board".

## 2021 (Jun) — visualia_second (GH: visualia-prev; tiny Vue 3 + TS lib)

The minimalist rebound: 673 lines, 4 components, npm lib for VitePress/
Slidev markdown. The deepest architectural lesson of the lineage:

- **Geometry became data, not components**: `rectgrid/hexgrid/polargrid`
  return `{x, y, row, col, index}` arrays; `arcpath/linepath/hexagonpath`
  return SVG path strings (d3-shape, degree inputs); rendering is the
  consumer's `v-for`. (`src/utils/grids.ts`, `paths.ts`)
- **State collapsed to a bare `reactive({})` exported as `v`** — `v.x` in
  any markdown page, no ceremony; `get/set` kept as sugar; mitt event bus
  (`emit/on`) e.g. for SVG download.
- 4 components: `VAnimate` (time→value, v-model), `VSlider`, `VSvg`
  (responsive container: centered coords, bleed, SVG export), `VMath`.
- VitePress `<script setup>` per page = live notebook; p5.js integration
  shares state through `v` (`docs/integrations.md`).

## 2022–2024 — fachwerk-dev (the reboot: lib/fachwerk/api/create/links/build)

- **Slidev-parsed authoring** (`fachwerk/composables/parser.ts`):
  `@slidev/parser` — `---` pages with YAML frontmatter, `--` sections within
  a page, sections auto-arranged in a responsive grid (`Page.vue`).
- **Cursor→slide mapping** (`composables/editor.ts`): slides carry start/end
  line numbers; caret position activates the containing slide — dual-pane
  editing where preview follows the cursor.
- **First real backend**: documents in Strapi v4 (per-user, i18n), debounced
  3s saves. No realtime; last-writer-wins.
- **Sandboxed live Vue**: `compileSfc()` extracts `<script setup>` +
  template → compiles into iframe; markdown via marked + `marked-katex`
  (math) + DOMPurify with Vue-directive pre-sanitization.
- **Utils continuity, yet another generation**: `seq/range/remap`,
  `rectgridpoints/circlepoints`, `arcpath/polygonpath`, `pol2car`, `hsl`,
  mitt — now TS, npm-packaged (`lib/src/functions/`).
- **create-fachwerk templates**: vanilla, Vue/Vite, VitePress, petite-vue,
  p5, **Figma plugin**, Node, Deno — the multi-runtime instinct again.
- `todo.md` confirms the 2019 pattern components (regular-polygon/hex/polar)
  were lost in rewrites and wanted back.

## 2024 (Oct–Nov) — wakeup / wakeup-synth / wakeup-foyer (elektronstudio)

Production trio for the WAKEUP performance; the synth is the find.

**wakeup-synth** — a **multiplayer spatial synthesizer** (`src/pages/
Synth.vue`, built on the elektron-era "elektro" component lib):

- Every audience member is a **draggable avatar on a shared 2D plane**;
  positions broadcast via the elektron `USER` envelope (debounced), with
  **presence decay** — `opacity = scale(updatedSince, 0, limit, 1, 0.1)`,
  stale users filtered out. Ephemeral presence rendering in 3 lines.
- **Zones as triggers**: collision detection (`collisions` lib —
  Circle/Polygon) between your avatar and placed zones; entering a zone
  plays/changes Tone.js audio (MonoSynth → FeedbackDelay, Sampler with
  remote-hosted samples → Reverb, filters). **Space is the instrument** —
  the crowd plays it by standing in places.
- **Radial clock sweep**: Tone.Transport + Loop drive a rotating line
  (`pol2car(a, 250)`) — a radar-style sequencer hand sweeping the circular
  stage. Generative music meets the polar-geometry substrate (the lineage
  utils `pol2car/scale/range` appear again, imported from elektro).

**wakeup-foyer** — react-three-fiber pre-show waiting room (successor of
the 2020 `foyer`): emoji avatars on stalks, lights/effects, schedule, video
walls, crowd.mp3 ambience. **wakeup** — Nuxt shell around the production.

Board translations: avatars-with-decay = the missing spatial-presence
layer; zone nodes that trigger behavior on cursor/avatar entry (sound,
reveal, "stand in the corner you agree with" classroom mechanics); the
radial sweep = a circle sequencer over `polargrid()` — sacred geometry that
plays.

## 2025 (Jan) — studio (kristjanjansen/studio; live-video lab)

Small Nuxt 3 lab for the live-video leg, built on **Cloudflare Stream**:

- **WHIP publish** (browser camera → CF via WebRTC, `utils/whip.ts` +
  `composables/videowhip.ts`) and **WHEP play** (sub-second-latency
  playback) — the upgrade path from elektron's 1Hz dataURL webcam wall to
  real streams.
- **HLS playback** (hls.js) for the same inputs at scale; ffmpeg RTMPS
  recipes in the README (restream a TV channel, timestamp test pattern,
  local camera).
- **CF API route** (`server/routes/cf.get.ts`): list live inputs, derive
  HLS playback + viewer-count URLs per input.
- **`useVideoframe`**: video → canvas frame capture as timestamped JPEG
  dataURLs — exactly the bridge a video node needs to become a texture/
  snapshot source on the board (crop a frame into an image node).
- `useVideoControls` (mute/volume/PiP/fullscreen + idle-hide UI), and a
  five-line Nitro ws broadcast handler (`routes/ws.get.ts`) — the elektron
  ws server reduced to its essence on Nitro.
- ⚠️ Hygiene: a CF API token and RTMPS stream key are committed in this
  public repo — rotate.

## 2025 (Mar) — demo (kristjanjansen/demo; record/replay transport lab)

Nuxt lab with one unifying idea: **interaction events as a recordable,
replayable timeline**. `composables/useTransport.ts` is a tiny transport
(schedule events with timestamps, play/stop, callback on due events,
`EventTimeline`/`EventLog` components visualize the tape), exercised by:

- `draw.vue` — record stroke points (150ms throttle), replay raw AND as a
  smoothed Catmull-style curve on a second canvas — sparse-capture +
  smooth-replay, directly relevant to replaying gestures on the board.
- `drag.vue` — record a drag path, replay raw + eased (`useTransition`
  cubic-bezier) — three side-by-side fidelities of the same recording.
- `midi.client.vue` — Web MIDI in/out with record/replay through the same
  transport, dedup window, note events as timeline payloads — performance
  capture beyond the mouse.
- `video.vue` + `useVideoRecorder` — MediaRecorder capture alongside.
- `useMessages.ts` — the elektron envelope again (`{id, datetime, userId,
  …}` over ReconnectingWebSocket): recorded timelines and live messages are
  the same shape, so a replay can be broadcast as if live.

The thread it adds: **record once, replay anywhere, at any fidelity** —
ghost demonstrations, self-playing tutorials, rehearsed presentations.

## 2026 (Jan) — workshop (local `~/personal/workshop`, ahead of GitHub)

Chat + shared board, Nuxt 4 on Cloudflare, ws via `data.elektron.art`.
GitHub has the minimal chat; the local commits (`proxy`→`fixes`→`focus`→`hm`)
have the full **@-command system** (`app/app.vue`, `utils/commands.ts`):

- `@board <text|url|yt-url>` (+image) — content onto the shared board; mode
  auto-detected: YouTube → embed, web URL → iframe **via site-proxy**,
  image → image card, else markdown.
- `@card <text>` (+image) — append card to a vue-flow canvas, auto grid
  placement from container width.
- `@diagram <intent>` — server LLM → `{nodes, edges}` JSON → vue-flow,
  normalized + fitView; multilingual labels.
- `@app <prompt>` — LLM generates a **self-contained interactive teaching
  app** (Tailwind CDN + vanilla JS, sliders/draggables/live feedback) →
  iframe `srcdoc`; host design constraints baked into the prompt so
  generated apps match the UI.
- `@ai <query>` (+image) — LLM reply broadcast INTO chat as "🤖 AI"
  participant; vision support.
- `@clear`; `@focus` — local guard: others' commands stop affecting your
  board (except `@card` in card mode).

**Architecture insight — command-sourcing, not state sync**: the board
replicates because every client executes the same @commands from the message
stream (`applyViewCommandsFromMessage`); no shared state object, no CRDT —
the command IS the protocol. Guards: AI/system senders don't trigger
commands; focus mode filters.

**Server** (Nuxt nitro): `chat-ai.post.ts` + `diagram.post.ts` (Vercel `ai`
SDK + OpenAI `gpt-5.1-codex-mini`); `site-proxy.get.ts` / `image-proxy.get.ts`
already built with private-host blocking — validates
[image-proxy](image-proxy.md) nearly line for line.

Supporting tricks: pronounceable user ids (`utils/ids.ts`), chat image URLs
auto-fetched + client-resized to dataURL, YouTube id extraction,
`stripAtCommands()` keeps display text clean, commands combine per message.

## 2026 (Jun) — visualia/visualia (the current board)

The terminus: WebGL2 HTML-in-canvas engine + DOM fallback, node kinds,
interaction tools, camera animation. Engine only — **no authoring layer,
no reactive state across nodes, no sync, no lesson structure yet**. That gap
is exactly what everything above feeds.

---

## The links corpus → moved to [references.md](references.md)

The DSLinks 593-row corpus (the 2019 designstem taste canon: explorable
explanations × creative-coding × math-art) now lives in
[references.md](references.md) alongside the user's 2026 "Searching for a new
medium" collection and a spatial-UI deep dive. The `DSLinks` pattern —
*reference collections as first-class, searchable, non-technically-editable
content* — is the thing to rebuild on the board.

---

## Idea lineages (traced across generations)

Sixteen threads. Content & authoring: reactive state, geometry-as-data,
doc↔slides, shortcodes, type & color, live editing, sacred geometry,
persistence, curated references. Live & collaborative: multi-runtime, live
sync/commands, voice, live video, presence/space-as-instrument, record &
replay — plus the AI thread tying both groups together.

**Reactive state woven into content**
fachwerk `get/set` in markdown (2018) → first: same, Vue 3 ref-backed (2020)
→ second: bare `reactive({})` as `v` (2021) → fachwerk-dev: `data` object +
mitt (2022) → board (2026): **absent** — the most-proven idea not yet in the
engine. Candidate carrier: connectors/edges + a reactive-node layer.

**Geometry as data**
make: `circlex/circley` + `scale()` born on a rune.js canvas (Jun 2018) →
fachwerk: `polarx/polary/polarpoints`, geometry otherwise locked inside
components (Aug 2018) → first: `circlepoints/gridpoints` utils (2020) →
second: the full conversion — grids/paths return plain arrays/strings,
rendering is consumer's loop (2021) → fachwerk-dev: same utils, TS + npm,
3rd generation (2022) → wakeup-synth: same `pol2car` doing stage math
(2024) → board: the right consumer at last (point arrays → instanced GL
rendering). The utils layer is the durable core of the entire lineage —
five incarnations of one polar function.

**Document ↔ slides dual projection**
kasutajaliidesed: `---`-split markdown slides, component-per-slide (2017) →
fachwerk: Alt+T doc/slides toggle, pipe-DSL (2018) → first: `---` pages +
grid DSL, hash routing (2020) → fachwerk-dev: standard `@slidev/parser`,
frontmatter, `--` sections, cursor→slide mapping (2023) → board:
[presentation](presentation.md) sketch = same idea, spatial (slides are
camera states over one canvas).

**Shortcodes / embedded commands**
kasutajaliidesed: `[[typo text1.md]]` — component embeds with arguments in
markdown (2017) → eka_webhook: **`@ifttt`/`@slack` — @-addressed chat
commands bridging external services, both directions** (2018) →
fachwerk/first: components-in-markdown (2018–20) → elektron: `/update`
`/reset` (2020) → workshop: `@board/@app/@diagram/@ai` (2026) → board:
command palette + future `@`/MCP verbs, one vocabulary. The @-convention is
not new — it's the 2018 bridge pattern matured.

**Type & color as live instruments**
kasutajaliidesed: Typo slider-specimen, Contrast, color Wheels (2017) →
fachwerk: color utils, RYB wheel mapping, colorblind/contrast (2018) →
designstem: color/typography lessons, colorblindness simulator (2019) →
board: [design-playground](design-playground.md) — the tree's oldest idea,
returning as the newest sketch.

**Live editing / live coding**
fachwerk: CodeMirror side-by-side, Alt+E, localStorage autosave (2018) →
first: Monaco language server + `~~~live` fences, runtime compilation
(2020) → fachwerk-dev: sandboxed SFC-in-iframe + DOMPurify + caret-follows
(2023) → workshop: editing replaced by *chat commands*; `@app` = LLM writes
the interactive app (2026). The author-tool got progressively safer, then
became an agent.

**Multi-runtime participation**
eka_webhook: chat ↔ IFTTT/Slack bridge — external services as chat
participants (2018) → elektron `example_{p5,tonejs,max,python,figma}` — one
ws protocol, any runtime (2020) → create-fachwerk templates incl.
p5/Figma/Deno (2022) → workshop @-commands as the routing convention (2026)
→ board: MCP server ([mcp](mcp.md)) is the same instinct with agents as
participants.

**Live sync / commands**
eka_server: 16-line socket.io broadcast relay (2018) → elektron:
type-dispatch vocabulary, Redis fan-out, `store` replay, presence (2020) →
workshop: **command-sourcing** — @-addressed commands replicate the
board, no state sync (2026) → board: live classroom = engine + this exact
protocol; `@board` verbs ↔ command palette ↔ MCP tools converge into one
vocabulary.

**Voice**
eka_speech: speech-to-text in, text-to-speech out, as chat modalities
(2018) → nothing since — the lineage's only dormant thread. Obvious revival:
voice → `@`-commands ("board, show the spiral lesson"), and `@ai` replies
spoken aloud for a hands-busy classroom.

**Persistence**
fachwerk/first/second: localStorage (2018–21) → fachwerk-dev: Strapi CMS,
per-user, debounced saves (2023) → board: localStorage again (2026); the
backend question reopens in [mcp](mcp.md) options A/B/C.

**Curated references**
designstem links sheet + DSLinks (2019) → fachwerk-dev/links site (2022) →
board: [inspiration-gallery](inspiration-gallery.md) extraction output /
sheet-fed link-card frames.

**Sacred geometry / pattern play**
fachwerk pattern components (2018) → lessons prove them (2019) → lost in
the first/second rewrites (utils survived, components didn't) →
fachwerk-dev todo.md wants them back (2023) → board: rebuild as node kinds
or generators over the geometry-as-data layer; missing extensions noted:
L-systems, turtle graphics, Lissajous/harmonograph, golden-ratio helpers.

**Live video**
elektron: webcam frames as 1Hz dataURL messages → audience video wall
(2020) → eka_virtual: OpenVidu WebRTC tiles, draggable + blob-masked +
screenshare (2021) → studio: real WebRTC — WHIP publish / WHEP play on
Cloudflare Stream, HLS at scale, frame-capture composable (2025) → board: video nodes
already texture via `texImage2D`; a WHEP-fed live node + frame-to-image-node
capture would put live cameras ON the canvas (instructor cam as a board
node, croppable like everything else).

**Presence & space as instrument**
elektron: presence rosters (`CHANNELS_UPDATED`) + 3D foyer avatars (2020) →
eka_virtual: draggable live-VIDEO avatars on a shared plane, blob-masked
(2021) → wakeup-synth: draggable avatars with staleness-fade, collision
zones triggering Tone.js sound, radial transport sweep — the crowd plays
the space (2024) → board: live cursors/avatars are the missing presence layer;
zone node kinds reacting to entry (sound, reveal, polling-by-position);
circle sequencer over `polargrid()` = the sound thread (fachwerk's 2018
synth/MIDI instruments → wakeup-synth 2024 → demo's MIDI transport 2025) landing
on the canvas.

**Record & replay**
elektron: `store: true` → Redis history + `CHAT_SYNC` replay (2020) → demo:
`useTransport` — interaction events (strokes, drags, MIDI notes) as a
scheduled timeline, replayed raw or smoothed/eased; recordings share the
live-message envelope so replay can broadcast as if live (2025) → board:
`History` is already command-shaped; a recorded session = timestamped
command log → ghost demos, self-playing lesson boards, presentation
rehearsal, and "replay what the class did" review.

**The AI thread** (oldest start, newest payoff)
eka_client: rule-based chat bot — jexl expression rules + compromise NLP +
conversation state (2018) → workshop: `@ai` LLM participant, `@diagram`
structured generation, `@app` generated interactive teaching apps with
host-styled prompts (2026) → board: MCP agent-driven canvas +
design-playground LLM-as-curator are the same thread arriving from two
directions. The chat-resident automated participant predates LLMs in this
lineage by seven years.

---

## Cross-cutting takeaways

- The board already IS the spatial generalization of every "slides" system
  in the lineage; presentation sketch + section ids close most of the gap.
- Reactive get/set across nodes is the missing primitive that made every
  generation's lessons feel alive.
- workshop's command-sourcing + the elektron envelope is the cheapest
  possible multiplayer; CRDT can wait.
- The intro-to-CS ladder + ~50 utils are a complete curriculum kit,
  liftable nearly verbatim into a future scripting/reactive layer.
- Zero-build, single-file distribution repeatedly mattered in classrooms;
  remember when packaging.
- The proxy idea is validated twice over (workshop site/image proxies);
  porting to the board is mostly a copy job.
