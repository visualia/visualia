# talk.html went white on stage (Arunädal, 2026-11-20)

What we know about the failure, written the evening after. The plan that follows from it is `plans/stage.md`.
Claims are tagged MEASURED (run today), READ (in the code) or INFERRED. The scripts and key frames are kept beside
this file, in `talk-white-2026-11-20/`.

## What happened

Around the klint 3D (the end of the walk, before the nature slides) the screen went white in front of about 100
people. The user restarted the deck and resumed from the index at the bog 3D. Nothing was logged: serve.py writes
to /dev/null, and the console went with the reload.

The last full test ran 08:37–09:14. Live edits went on until 10:58 (22 `*.before-*` backups from that day).

## Reproduced: the local server drops a request, and a page fades in dead

The likely cause, reproduced in 5 of about 15 loads on the klint step (MEASURED). Other test clients may have been
using the same server during some of those runs. On stage only one browser was using it, which is not proven to
fail; the mechanism is the same.

- serve.py is a `ThreadingHTTPServer`: HTTP/1.0, a listen backlog of 5 (`request_queue_size`), and `no-store`, so
  every request opens a new connection and nothing is cached.
  - 16 parallel requests gave 3 connection resets; 32 gave 15.
- On Space onto klint, `keepNear` loads slides.html: about 35 requests, 7–11 in flight.
- The reset hit `models.js?v=order`, one of slides.html's static imports (`slides.html:187-195`).
  - One failed import stops the whole module.
  - `deckStep.provide()` (`slides.html:951`) never runs. The page makes no fetches and logs only a script `error`.
- The paper background is plain CSS, so it still paints.
- `applyStep` turns the front iframe `in` without waiting for ready (`talk.html:638`); only `applyPage` waits.
  - The dead page fades in fully opaque by 2.7 s and stays flat paper `#e6e4df`, which reads as white on a projector.
  - `ensure()` waits up to 60 s for ready and then only logs to the console (`talk.html:574-586`).
- After a restart the files load again, which fits "resumed from the index and went on".
- Frames: `talk-white-2026-11-20/frames/fast-800_6003ms_whiteout.jpg` (paper at 6 s, still at 7.6 s) and
  `fast-800_1504ms_paper-over-glide.jpg`.

### Also a white screen at that step: the main canvas loses its WebGL context

- Simulated at klint, this gives pure white with only the two prompt boxes (MEASURED,
  `frames/klint-mainlost.jpg`). Nothing in the deck handles `webglcontextlost` (READ).
- Klint is the first step that adds contexts (4 → 8). Chrome drops the oldest first, which is the landscape's. The
  same symptom appeared on 11-19, with every page loaded at once.
- No context was lost in any run today, and the count stayed at 9 or fewer. So this is the second suspect, not the
  first.

### Runs that did not fail

All headed Chrome with the canvas-draw-element flag and the user's picks (34 steps left out): normal pace (4.5 s),
fast (300 ms), impatient presses and Shift+Space at klint, and an index rehearsal. None failed. Which machine and
profile ran the talk is still to be asked.

## Unlikely

- **A renderer or GPU process crash.** There were no Crashpad dumps that day, the GPU process never restarted, and a
  renderer crash shows "Aw, Snap", not white.
- **The morning's walk merge (`arrive`).** It only delays the DOM boxes, and its loop exits on the token. The index
  picks were the riskier change. They sent mist-bog straight to klint through the untested `snapTo` cut
  (`:625,633`), and no test applies picks.

## Live WebGL contexts

MEASURED headed, with the flag and the picks. The test's own count misses frame-edge's detached canvases.

| Where in the talk | Contexts |
|---|---|
| Walk | 4 (Spark, 2 smoke, edge) |
| Klint 3D | 8 (slides.html loads) |
| Last bog slide → song grounds | 12 |
| After the credits once | +1 (the credits smoke is never destroyed) |

The title smoke draws two WebGL2 contexts every frame for the whole talk, through the experimental flag.

## Why it was likely, and why it went undiagnosed

- Pages fade in before they are ready, with no fallback and no visible error.
- One failed fetch kills a page silently. Only the mp3s are retried.
- No context-loss handling anywhere.
- The context budget is implicit, hand-tuned and measured wrong.
- no-store, plus a server with a backlog of 5.
- An experimental Chrome flag sits on the critical path.
- Picks change the path of steps, and the tests never apply them. Picks are keyed by page plus query, and the harness
  opens `?keys=0&test=1`.
- State is split across globals, `postMessage`, direct `contentWindow` calls, `localStorage` and 14 + 33 timer
  chains in talk.html alone.
- No persistent log.
- Live edits after the last full test.

## Size of the thing

The live deck code is about 13.9k lines (966 KB):
- talk.html: 1122 lines, 101 "asked …" comment blocks;
- six embedded pages, each 185–962 lines;
- eight shared modules.

There are 118 steps, built from stops plus splices. Six iframes are declared up front; four of them are loaded and
unloaded by `keepNear`.

## The test harness

- A full run takes 37–39 minutes: 119 tiles and about 236 presses, at a fixed 6–9 s wait each.
- It takes about 355 screenshots, and nobody reviews them.
- What it misses:
  - It runs headless, so the GPU is not the real one.
  - It uses a fresh profile: no picks, and no smoke path.
  - `pageOk` compares step numbers, so a blank page in front passes.
  - There is no pixel check and no context-loss listener.
  - It presses at one steady pace and never runs a long session.
  - It runs against `http.server`, not serve.py.

## Map jank (cause confirmed by switching it off)

talk.html keeps drawing the hidden Spark 3D scene under the map.
- `covered()` (`talk.html:561`) is false on the map step, so `renderer.render` (`:819`) runs every frame.
- `body.noscene` (`:677`) only sets `visibility: hidden`.

| Headed, talk.html on the map | Frames |
|---|---|
| As it is | 12–14 stalls of 210–295 ms each 5.6 s press; p50 24–25 ms |
| All talk.html GL off | p50 8.3 ms, p95 10 ms, max 10.4 ms |
| Only the 3D canvas off | no stalls; p95 about 17 ms, from the two title smoke canvases (loop at `:867`, never stops) |

- ai-estonia.html alone is fine: p50 16.7 ms. The close Estonia views (10 m coasts) drop to about 30 fps for the
  first two presses, and the shrink past the last band runs clean.
- Smaller costs:
  - `heatmap.js:513` renders the heavy shader every frame, even when nothing has changed;
  - `drawLines` (`heatmap.js:416-422`) draws the first frame of every glide at full detail with blur;
  - films.html, while paused, still runs about 205 rAF callbacks a second;
  - cost.html loads during the map step.

## Flashes between steps

From screencasts of 10 transitions, flagging frames that are not a blend of the two endpoints (MEASURED). Frames are
in `talk-white-2026-11-20/frames/`.

1. **Crossfades dip toward the sky.**
   - Outgoing and incoming iframes each fade their own opacity over 1.4 s (`talk.html:82-83,638`). At the midpoint
     the two cover about 75 %, and the body's sky `#a8b5c6`, or the 3D canvas, shows through.
   - figs → films goes black → grey RGB(43,46,51) → black (`figs-films_442ms_grey-dip.jpg`).
   - slides → laul shows the klint trees (`slides-laul_479ms_3d-through.jpg`).
2. **Paper gaps between nature subjects.**
   - `slides.html:717` (GAP_IN, GAP_HOLD) holds full-screen paper for about 3 s, with an empty prompt card
     (`slides-subject_1203ms_paper.jpg`).
   - This is by design, but on a projector it reads as a white flash.
3. **films → map:** a cut to black, then the map fades in over 2–5 s from `canvas#pics`'s opacity transition
   (`films-map_60ms_black.jpg`).
4. **Clean:** klint 3D → slides, map → cost, cost → black (when the page was ready), and seto → lake.

The white-out and the flashes share a cause: an iframe's own background is shown before its content is known to be
good. A page that never became ready gives the white-out; the paper gap and the crossfade dip are the mild versions.

## Evidence kept

`talk-white-2026-11-20/scripts/` holds the Playwright scripts behind these numbers (`walk`, `seq`, `lose`,
`rehearse`, `reqs`, `count`, and the `jank-*` ones with `jank-instr.js`). Their output paths point at a session
scratchpad; change them before reuse. `frames/` holds the key frames. They are the start of the browser smoke test in
`plans/stage.md` step 0.
