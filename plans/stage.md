---
status: next
---

# Stage: one canvas, one clock, one sound space for the talks

Asked 2026-11-20, after talk.html went white on stage:
*"we need to rethink the whole pres architecture. talk.html steps were right dir but failed us. testing is heavy.
separate browser and nonbrowser stuff. bring in ../positron transport/timeline system to work on staging and perhaps
its all 3d stage and same sound space"*.
Plan only, nothing built. The failure itself is in `research/talk-white-2026-11-20.md`. Paths in positron are under
`~/personal/positron`.

## What to keep from talk.html

- **The step list is the index.** Space and an index jump land in the same state. This was the right direction.
- **Every step is a full description** (camera, layer in front, sound, boxes), not a diff from the step before.
- **Picks:** the user leaves steps out on the index.

## What failed us (summary)

- **The white-out, reproduced (5 of about 15 loads):**
  - serve.py (HTTP/1.0, backlog 5, no-store) reset one of slides.html's static imports on the klint step;
  - the page never started;
  - talk.html faded it in anyway, as flat paper that reads white on a projector.
  - A lost WebGL context gives the same white and is the second suspect.
- **Jank on the map zoom-out:** the hidden 3D scene under the map kept rendering, and the title smoke never stops.
  With them off, frames hold at 8–10 ms.
- **Flashes:** iframe crossfades let the sky colour or the 3D show through at the midpoint; slides hold full paper
  for 3 s between subjects; the map fades in from black.
- Six iframes, each its own document, WebGL contexts and timers. State crossed between them by `postMessage`, direct
  `contentWindow` calls, globals and `localStorage`.
- Timing is about 50 `setTimeout` / `await wait()` chains with tokens, plus CSS transitions and four rAF loops in
  talk.html alone. Nothing can say what the screen should show at time t.
- A page fades in before it is ready, and one failed fetch kills it silently. No context-loss handling, no log.
- The WebGL budget was implicit and measured wrong: up to 12 contexts plus one leaked, against Chrome's ~16.
- Tests: 38 minutes headless, a fresh profile without picks, screenshots nobody reads, and a blank page passes.
- Live edits after the last full test.

## The idea

**The talk is a score, played on positron's transport, drawn on one WebGL2 canvas, heard through one AudioContext.**

### 1. Score

The talk is data: a JSON file in git, built from today's STEPS list.
- A step is a named mark, at a time position, with a hold.
- Events between marks animate the camera, fade a layer, start a sound or show a prompt.
- Picks are a filter over marks, in the score's own file, not localStorage.
- Positron's `timeline/score.mjs` already has named marks (`in` / `out` as `{mark}`), so a score survives a re-cut.

### 2. Transport

Copied from positron at a tag into `packages/timeline/`, under positron's "share, don't merge" rule
(`research/positron.md`). The files: `transport.mjs`, `score.mjs`, `render.mjs`, `keepalive.mjs`, all MIT, no
dependencies, ES modules.
- Position is `p0 + (now − t0) · rate`. The transport holds no timers.
- A Web Worker tick host keeps time when the tab is hidden; rAF only paints (positron LESSONS #84: rAF must never
  trigger).
- Space plays to the next mark and holds. Shift+Space plays back, animated. An index jump is `seek(mark)`.
- **Seeking is reduce + assert.** Each layer's `reduce(events ≤ t)` gives its state, and `assertState` puts it on
  screen. Jumping to step N is the same as playing 1…N, and positron proves that with a property test in node in
  0.2 s.
  - This replaces today's per-step functions and their token checks.
- **Recovery:** the URL hash holds the mark, so a reload lands back on the same step in the same state.
- **Leave out** `nested.mjs` (three open order violations in positron's `prop-render.mjs`) and
  `createFanoutScheduler`.

### 3. One stage

One WebGL2 canvas, with three.js and Spark as now, and one DOM layer above it for text: prompt boxes, slide type,
credits.
- Every page today becomes a **layer module**: the 3D walk, slides, costume figures, song grounds, films, map, costs,
  credits.
- Each layer module exports `{ load(), reduce(events, t), assert(state), draw(t), unload() }` and draws into the
  shared renderer: a scene, or a render target composited on a full-screen quad.
- Fades are a layer's opacity in the compositor, never an iframe appearing. A crossfade blends A and B with
  nothing underneath: no third colour shows through (today: the sky `#a8b5c6` or the 3D shows at the midpoint).
- **Only visible layers draw.** No hidden scene keeps rendering (today: the 3D under the map, the smoke).
  - A static layer redraws only when its state changes (today: the heat shader every frame).
- **One context in total**, against 12 today. Context loss is handled once: restore, re-upload, `assert(state at t)`.
- A layer counts as ready only when its assets are decoded. The transport does not cross a mark into a layer that
  isn't ready; it holds and shows a loading state, never blank paper.
- Assets come from the manifest (`plans/talks-online.md`), loaded one step ahead and cached (Cache Storage). On a
  show day everything is cached before the talk starts, with no network during it.
- A standalone page is the same module mounted alone, so `slides.html?group=…` still works for authoring.
- **The smoke:** it uses an experimental Chrome flag and renders forever. Make it a layer in the same context (a
  shader, not canvas-draw-element), or drop it.
- **Open:** whether the map (Canvas 2D heat and coasts today) moves into WebGL or stays a 2D canvas in the DOM layer.
  It could stay 2D at first, as long as it is drawn from the transport.

### 4. One sound space

One AudioContext, owned the positron way (`demo/shell/audio.mjs`: claim and release, suspend and never close).
- Buses: ambience (the scene's landscape sound), music (songs, film themes), layers (the map's 14), effects.
- Every source is started by the transport's audio lane at `audioTime`, so it is sample-locked to the picture.
  - Seeking re-derives what plays from the score: which clip, at what offset, at what gain.
  - No sound carries over by accident (the landscape on the costs slide, the Alpinist under the credits: both bugs
    from 11-20).
- Spatial is optional. The 3D steps could pan the landscape sound with the camera (an HRTF panner, as in positron's
  `/floor/`); everything else stays stereo.
- Audio starts on one gesture: the Start button.

### 5. A log

A ring buffer of events (mark entered, layer ready, fetch failed, context lost, frame over budget), shown by a key on
stage and sent to the local server on a show day. Next time we know.

## Testing: split browser from node

**Node, under 5 s, on every save:**
- the score parses; the marks are unique; every pick names a real mark;
- the asset closure: every file the score and layers name is in the manifest and exists, total bytes per step;
- reduce is pure (positron's property test, on our layers): seek(N) equals play(1…N), with random picks;
- a budget per step from the score, in contexts (always 1), decoded bytes and audio sources;
- the key map: online and stage tables, no key unbound or bound twice;
- the sound plan: per mark, the sources playing and their gains; nothing plays on a mark that has none.

**Browser, headed, on the real GPU:**
- **Smoke, under 5 minutes, before every showing:**
  - seek to every mark;
  - check pixels: the frame isn't uniform and isn't the paper colour unless the score says so;
  - no context loss; no errors in the log; the frame-time budget met;
  - run with the show's picks and the show's server.
- **Soak, run while away:** play the whole talk three times at mixed pace, with random Shift+Space and index jumps,
  watching heap, contexts and frame times.
- **Screenshots only on failure.**

The current 38-minute `test-intro.mjs` retires.

## Show day

- The deck is frozen at a tag and cached whole before the talk. The **dress rehearsal** is the smoke test plus the
  user walking it once.
- **No live edits after the dress.**
- `serve.mjs` (step 0), or no local server at all: the online deck with its cache full.
- The log key, plus a panic key that reloads to the current mark.
- A fallback: the same talk rendered offline to video through `render.mjs` and a virtual clock, on a USB stick.

## Fit

- The player is not positron's, and the talks need not be visualia's. Where they live is compared in
  `plans/talks-online.md` ("Where talks live"); the recommendation there is a private `~/personal/talks` repo that
  vendors positron's transport and visualia's style, with media still made in visualia.
- The media itself stays visualia's (CLAUDE.md, 2026-11-14: a model made the final pixels).

## Steps

0. **Harden the current deck now**, small and separate from the rewrite, in case it is shown again first:
   - replace serve.py with `serve.mjs`: Node's `http`, no dependencies, the same port and folder. It keeps
     connections alive and queues 511 by default (Python's server queued 5, spoke HTTP/1.0 and opened a connection
     per file). no-store only for code, media cached. A `POST /log` appends the deck's event log to a file;
   - fade a page in only after `ready`, with a loading state; pages report load errors to talk (`onerror` →
     `postMessage`), and a page that fails is reloaded once and then skipped, with the error on the log;
   - stop rendering the 3D when a page covers the screen: the map counts as covered (`covered()`, `talk.html:561`);
     stop the title smoke off its steps;
   - crossfade over an opaque underlay of the outgoing colour, not the sky;
   - decide the 3 s paper gap between nature subjects (`slides.html:717`): keep it, shorten it, or make it dark;
   - a `webglcontextlost` handler: reload to the same step through the hash;
   - retry every fetch;
   - stop the credits smoke from leaking; count the detached contexts in the perf test;
   - apply picks in the test.
   - Then start the browser smoke test from the replay scripts in `research/talk-white-2026-11-20/scripts/`.
1. Vendor positron's `timeline/` into `packages/timeline/` at a tag; add its property test to our node tests.
2. The score: convert today's STEPS and picks into `talk.score.json`, plus the node tests for score, closure, keys
   and budgets.
3. The stage shell: one canvas, the compositor, the DOM text layer, transport keys, hash recovery, the log, a loading
   state.
4. Port the layers one at a time, each with its reduce test:
   - 3D walk; slides; figures; song grounds; films; map; costs; credits.
   - The pace is set by the next showing, which is unknown.
5. The sound space: buses, the audio lane, seek re-derivation.
6. The browser smoke and soak tests; retire `test-intro.mjs`.
7. Online (`plans/talks-online.md` step 6 onwards).

## Questions for the user

- Which machine and Chrome profile ran the talk? Was serve.py the server, and was another tab with WebGL open? This
  confirms the cause.
- When is the next showing? Possibly a lighter version as a mood-lifter at HARNO (27.11, not decided). If anything
  is shown before the rebuild, step 0 has to carry it.
- Keep the smoke?
- Map layers as Space sub-steps on stage too?
- Spatial sound on the 3D steps, or stereo throughout?
