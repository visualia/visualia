# Handoff

Written 2026-10-21, rewritten 2026-10-23 and 2026-11-02, updated 2026-11-10
(the seventh stretch: the EKA course card; upscaling in the pool with Burn,
in the app and in tabs; the gateway's image model menu and a klein 9B
upscaler; local image generation tried with stable-diffusion.cpp; the
Estonian visuals plan), 2026-11-15 (prompts in the open; TripoSplat
without Python) and 2026-11-16 (prompts deployed; Remove background in Rust;
the HARNO keynote and Arunädal demo; later the same day the value drift
work: catalog models, judges, nature, costumes, music, history, the drift room) and 2026-11-17 (the demo
pages: cover, rooms, cost, prompt box, maps, figures, music measures; in the evening SHARP done, the 3D cover,
figurines, music without the voice, regilaul, ChilloutMix controls) and 2026-11-18 (the new intro as the main
template, the AI Estonia map, sound, keys; HARNO prep; in the afternoon the intro's nature walk, slides block, end and
credits, MusicGen instrumentals for films and national songs) and 2026-11-20 (talk.html: a title-less first step,
songs under the costumes and song grounds; then the talk day's live fixes).
Read this, then
`plans/README.md` (the board and backlog) and `worklog/2026-11.md`.

## Right now

**2026-11-20, later in the evening: where talks live, and the model runs.** `plans/talks-online.md` now compares
visualia, positron and an own private repo for the talks and recommends `~/personal/talks` (the user's call). New
`plans/runs-to-platform.md` from the inventory in `research/talk-model-runs.md`: first commit the gateway, pool and
studio work that was deployed on 11-16 and never committed (the live service is ahead of git). The local server is
to become a Node `serve.mjs`. HARNO (27.11): maybe a lighter version of the deck, undecided.

**2026-11-20, evening: the white-out explained, two plans written, nothing built.** Cause reproduced
(`research/talk-white-2026-11-20.md`): serve.py (HTTP/1.0, backlog 5, no-store) resets a request when slides.html
loads at the klint step, the page never starts, and talk.html fades it in as blank paper. Second suspect: a lost WebGL
context (same white, nothing handles it). Map jank: the hidden 3D renders under the map. Flashes: iframe crossfades
show the sky through. Next: `plans/stage.md` (step 0 hardens the current deck before any showing; then the rebuild on
positron's transport, one canvas, one sound space, node tests plus a short headed smoke) and `plans/talks-online.md`
(code into `apps/talks`, media to R2 `visualia-talks`, research outputs to a private `visualia-research`; online keys
and front page). Open questions for the user in both plans: which machine ran the talk, the next showing, SHARP and
Kihnu/Seto before anything is public.

**2026-11-20, after the talk: talk.html failed on stage.** Around the klint 3D (the end of the walk, before the nature
slides) the screen went white in front of ~100 people; restarted, resumed from the index at the bog 3D. Cause unknown.
Before anything else: replay the walk with Space in a visible window, logging page errors and WebGL context losses and
taking a screenshot each step; fix the cause; run the full test (`PAGE=talk.html SETTLE=6000 node
evals/estonian-visuals/test-intro.mjs all`) before any further showing. Suspects, unverified: the walk steps merged
this morning (prompts inside the 3D step, `arrive`), and too many pages loaded at once near the slides (Chrome's WebGL
limit gave a white box on 11-19). Lesson: no live edits after the last full test on a talk day. Backlog line in
`plans/README.md` (Fix and finish, first).

**2026-11-20, the talk day: talk.html walked through with the user and fixed live; all local, not committed. The
full test (`test-intro.mjs`) has not run since the picks went in (mid-morning); only targeted headless checks.**
**Serve now with `python3 evals/estonian-visuals/serve.py`** (same port 8123, same files, but `Cache-Control: no-store`:
pages inside talk.html stayed old in the browser's cache). Embedded pages load as `?v=1120` for the same reason; prompt
boxes as `prompt-box.js?v=fadebox`. Backups beside each page as `*.before-*` (dozens today). Deck backup in
`~/plans/visualia-decks/` refreshed at the end of the day (the changed pages, map files and serve.py).

- **Order:** title → costume prompt and grids → walk (one step a scene; its three prompts come in together once the camera
  has arrived, smaller, 31.5vw, fading away when the arrow keys move the camera) → nature slides klint, raba, robirohi →
  **Laulupeoväljakud** (new first step: both prompts big in the middle, "2023–2026 · 10 mudelit"; the runo song, then
  Mesipuu from lucid-origin on, `LAUL_SECOND` 6) → Setomaa slides and 3D → lake → figurines (DALL·E mini alone first,
  turnable by wheel or drag; the row fades in, no rising; silent throughout; exit: the women leave, paper turns black,
  no prompt cards) → films Kevade, Nukitsamees, Hukkunud Alpinisti hotell last (alpinist2 picks one slide earlier) →
  map (loaded during the last film, its song plays on) → costs (4 Space steps) → credits.
- **Index picks (talk.html `i`):** every step starts picked; a circle or X leaves it out (`deck-index.js` `out`,
  localStorage `dx-out`); Space skips steps left out; a group with nothing left is skipped whole.
- **Prompts never type now** (prompt-box.js: the whole box fades in 1.1 s, no caret, no key clicks; `?typing=1` types).
  Wherever several show together they come at once, one size (walk, grids, film title cards, song grounds, close-ups).
- **Map (`ai-estonia.html`):** heat locked to the map (`heatmap.js` `lock`), 10m coasts around the Baltic
  (`world-fine.json`), no ring; Estonia's heat alone first, each → adds the next distance band (`RING_EDGES`) and one
  music layer, the map zooming out a step (never past the all-heat view `ZEND`); past the last band it shrinks 10 % a
  press, centred, soft edges. 14 layers, **no pitch shifting** (user: robotic), clips as made incl. the talk's songs,
  gains from ebur128. `fin-rule-arc` and the voiced shifted clips removed (ElevenLabs sang a section text). Title as the
  talk's (semibold, line under it regular .85), fades in at 4.5 s over 3.2 s. Map canvas at most 1.25 dpr; lines
  unblurred and thinned while moving: frames 16.7 ms p95 headless.
- **Costs (`cost.html`):** paper, euros (0,86 € a dollar), prompt "Estimate monetary and energy costs of this project"
  (2026, USA, Claude Opus 5.5); talk steps: empty paper, prompt, numbers, bars; all 19 models, no legend, one grey,
  2px corners, no note, no Rahvarõivatekstid row. Credits' Eelarve / Energiakulu read from costs.json (41 €, 4,0 kWh).
- **Credits:** pictures back (Nipernaadi, then Kevade from Phoenix on at Nipernaadi's pace), cropped more, first at 9 s
  (3 s after the roll starts); roll on the right half; when it stops on the signature, Nipernaadi fades out and Kevade
  comes in; "Heliloojad". The map no longer loads under the credits (its Alpinist music leaked in).
- **Sound:** the 3D scene hidden from the map on (it showed through fades); talk's sounds retry each file 4 times (one
  failed download had silenced the credits song).
- **Open:** run `PAGE=talk.html SETTLE=6000 node evals/estonian-visuals/test-intro.mjs all` (tile 24 needs SETTLE
  14000); listen to the map's 14 layers; costs.mjs after any new paid run; commit nothing from out/ (git-ignored).

**2026-11-20 (late on 11-19): talk.html, sound and the opening; all local, not committed, not yet heard or watched.**
Serve `python3 -m http.server 8123 --bind 127.0.0.1 -d evals/estonian-visuals/out`, open
`http://127.0.0.1:8123/drift-room/talk.html`.

- **First step without the title:** a new stop 0 "Maastik" (the landscape alone); Space fades the title in (2.4 s).
  Every step index moved by one (nothing hard-codes them). Backup `talk.before-notitle.html`.
- **Song playlist** `LAUL_SONGS` (the user's pick): `el-regi-tohi.mp3` → `national/nat-mesipuu.mp3` →
  `national/nat-sind-surmani.mp3` (the MiniMax takes with voice, not MusicGen; under `sounds-research/`). Each once,
  3 s cross-fades, round again; from the top each time. Starts on the costumes once the landscape is gone (figs part
  > 0; the costumes had no sound there), plays on through Laulupeoväljakud, fades out after (3 s). laul-ee-lv.html itself
  has no music and stays so (user: "forget about sound ground file"). Backups `talk.before-laulsongs.html`,
  `talk.before-figsongs.html`. Known gap: if the sound first starts on a later costume step, it stays silent until the
  next step.
- **No more songs** (user, 2026-11-19): more runo songs and Latvian ones were asked, then called off before any run.
  Rõuge texts for later, if asked again: folklore.ee/lepp/rouge/?sel_id=3 (E 17167 "Viibisi mina", E 17167/8 "Taha ei
  talupojale", E 17168/9 "Millaal maksan eide vaeva", the rest of E 17169 "Tohi siin").
- **Backup refreshed:** `~/plans/visualia-decks/` (code and JSON only, rules in its README).

**2026-11-19: talk.html is the new main deck (steps-based), not yet walked through by the user; all local, not committed.**
Serve: `python3 -m http.server 8123 --bind 127.0.0.1 -d evals/estonian-visuals/out`; start page `/` (index.html, "Working on now").

- **`out/drift-room/talk.html`** (built 2026-11-19 from intro.html, which stays as the fallback): one flat STEPS list = the
  index, one tile per step; every step a full description (camera, page in front at its part, sound, boxes); Space
  animates, an index jump lands the same; one token per step change. Embedded pages answer one contract
  (`deck-step.js`, window.deckStep) and forward keys. Pages are loaded only for the steps around the current one
  (`ensure/unload/keepNear`, Chrome's ~16 WebGL contexts were exceeded when all four were loaded: white box). Films are
  addressed by name (`__films.show`), not number (an off-by-one skipped a picture). Sound: talk's keys wake the pages'
  sound (`promptKeysStart`, 'talkwake'), keys from the pages start talk's own (credits song was silent).
  **Performance pass done (2026-11-19, test passes 138/138 tiles + walk):** at most 9 WebGL contexts at any step
  (usually 3–6), frame p50 16.7 ms, spikes 50–100 ms at page hand-overs, heap ~300 MB (headless, one tab). frame-edge.js
  shares one WebGL context per page (2D canvases), `keys.js` deckPause pauses hidden pages' loops (frame-edge,
  heatmap, splat-stage, slides, films, costumes3), pages loaded ahead get `?paused`, talk's own 3D stops under opaque
  pages, costumes3 pixelRatio 1.25. `perf-talk.mjs` measures; the WebGL warning fails the test. Left: costumes3 still
  redraws every frame for the sway; not measured in a visible window. Keep one tab of the deck open.
- **Order of the talk:** title, costume prompt, ChilloutMix grids → the walk Matsalu…klint → nature slides (klint, raba,
  robirohi, Setomaa; the last Setomaa slide is a window onto the mirrored 3D Setomaa) → the overlay fades, the 3D turns
  right into the joined first scene (a second cover mesh, LAKE2), stops on the lake → Rahvariided (costumes3 embedded:
  the ChilloutMix woman with legs flies in after her prompt types; to the timeline; the others appear by themselves
  with their years; the judge's question box first, then the chart; exit split left/right with the two song festival
  prompts) → Laulupeoväljakud (laul-ee-lv.html, the 10 picked models, Tallinn vs Riga) → Filmid (Kevade, Alpinist,
  Alpinist teine kord, Nukitsamees; only picked slides; black title cards) → AI Estonia map (black; opens on Estonia;
  → adds an area and a music layer, zooming out, America last; Space cuts the music and goes on) → Mis see maksis
  (black, odometer numbers, growing bars) → credits (centred, "Tehisaru-Eesti 2026" holds in the middle; pictures off).
- **Tests:** `evals/estonian-visuals/test-intro.mjs` (`PAGE=talk.html SETTLE=6000 node … all`): every tile + Space /
  Shift+Space walk, headless. Last full pass on talk.html before today's later edits; rerun before the talk.
- **New today:** Riga song festival set (`lauluvaljak.mjs SET=latvia`, `out/lauluvaljak-latvia/`); second full runs
  Nipernaadi (`nipernaadi2`, out of the talk) and Alpinist (`alpinist2`); SHARP 3D for all of them (measured);
  `energy.mjs` (macmon wrapper); `research/music-drift/keyfit.mjs` (key estimate + pitch shift, the map's layers in
  C# major, `out/keyed/`); four MiniMax runo songs; MusicGen instrumental Ernesaks takes (`ernesaks-instr-2` on
  Lauluväljak pre-2026); the two-minute Alpinist theme (`films/named-alpinist-long`).
- **Shared:** prompt boxes lay out the whole prompt from the start (no reflow), foot always one line (fitFoot), no final
  full stop, typing 27/s; indexes: years, per-group counters, picks drive playback (`deck-index.js playable`), silence
  while open.
- **Alpinist teine kord** (`alpinist2`): in films.html as its own group to pick from; in the talk only its picked
  pictures show, pooled with the Alpinist's own picks in model order, no title card of its own (none if nothing
  picked). Picks live in the browser's localStorage (films.html index): another browser shows no picks.
- **Open:** walk talk.html by hand on the presentation machine (GPU load); pick from Alpinist teine kord in the films
  index; listen to the map's six-layer mix (wind band +6 semitones); M1 energy runs (SD 1.4, ChilloutMix sd.cpp,
  TripoSplat) still unmeasured; Viimne reliikvia and Nipernaadi are out of the talk; costs $47.67 (`costs.mjs`).

**2026-11-18, evening: decks tuned, the intro grows past the slides, all local, not committed.** Serve:
`python3 -m http.server 8123 --bind 127.0.0.1 -d evals/estonian-visuals/out`; **the start page is now `/` (index.html,
explore.py writes it, "Working on now" list on top)**. Backups beside each page as `*.before-*`.

- **Next, asked, not started:** in the intro, after the lake stop: all nine costume figurines come in **big, side by
  side** over the lake; Space: the background **turns away** (camera yaw) and the figurines go to the **timeline row**
  (as `costumes3.html`); Space: the **"Kas see on Eesti?" chart**; then the map and credits. Plan: `costumes3.html?embed`
  as an overlay iframe like the slides (OVER in intro.html, `showEnd`), a new state `big` before `row` (x spread ~1.3,
  scale ~2.4, feet below the screen, rising in), transparent page with a paper layer fading in on `row`, messages
  `{figs: 'end'|'start'|state}` to the intro (turn the camera on `row`), `i` forwarded as the slides do.
- **Intro after the slides:** the slides' last picture (Setomaa, FLUX.3 klein, **mirrored**, `slides.html?flip=`) becomes
  its own **3D scene** (SHARP made today, measured: 36 s, 0,09 Wh chip above idle; `land3d/nature/flux-3-image-klein/
  setomaa.spz`), shown in the klint's place (no glide), SHARP's prompt typed, the **village sound** of the first scene
  back. Then a **cut to the lake** (the first scene's left start, `jump` stop: dip to sky). Map and credits after it.
- **costumes3.html:** the ChilloutMix place is now the **cover's man** (`figures3d/cover.splat`, `?woman=1` / `?feet=1`);
  step 2 the chart "Kas see on Eesti?" (judge's country question, `era/judge.jsonl`); the **energy chart** is built but
  hidden (`?energy=1`): six of nine bars would be the 2,9 Wh estimate; bring back once the M1 numbers exist. **Click a
  figure:** a copy flies in from the right to the cover's framing, row stays, little turn; ←/→ drag turn, ↓ back to the
  legs, Esc away; boxes top left: its picture's prompt (right model, year, country, measured energy where we have it) and
  TripoSplat's ("Turn this cut-out into a 3D figure…", 2026, CHN, M1). Smoke titles on the charts (`smoke.js`).
- **Films deck:** dark theme by default (`?theme=light` the old paper), black title cards with dark prompt boxes lower
  left, the song fading in under its typing prompt, Kevade first, slow crossfades (5 s in, 6,5 s out), noir vignette out
  (crop 9 %), judge's titles in Estonian and "Nõukogude Liit" kept, **FLUX.3 klein ×3 extra per film** (`films.mjs more`,
  judged, in places.json; reliikvia refused 3×), playback keeps to index picks (`deck-index.js playable`). Alpinist
  ending candidates in `out/films/flux-3-image-klein/alpinist-{alt,prompt}<n>.png`; the English title "Dead
  Mountaineer's Hotel" is refused by FLUX.3 klein. **Not chosen yet.**
- **Lauluväljak + Pikk Hermann merged:** `laul-ja-lipp.html` (both rooms in turn, one index of two groups, picks respected).
  Both rooms follow the films' **year rule for music** (MusicGen small 2023 for 2023–25 pictures, the song before plays on
  for 2022, the last scene keeps the anthem). Lauluväljak pre-2026: **`ernesaks-instr-2`** (new instrumental takes 1–4,
  `research/music-drift/era.mjs ernesaks-instr`, the choir-prompt takes were unlistenable). User to listen to 3, 4.
- **Shared:** prompt boxes' foot larger and never broken inside a value, boxes keep their width, `.pbox.dark`, typing
  27 letters/s, 0,05 Wh shown with two decimals; index: counters per group, model years on tiles, **no sound while open**
  (`keys.js deckMute`), no picks on the intro's index; right columns 56/44 (films, slides, rooms) so feet fit one line.
- **Energy (new rule, memory `measure-energy`):** every local run measured as it runs. `evals/estonian-visuals/energy.mjs`
  wraps any command in macmon (`out/energy/energy.json`). Measured here: DALL·E mini picture ~0,05 Wh, cut-out ~0,02 Wh,
  SHARP Setomaa 0,09 Wh. **Needs the M1** (sd-cli is blocked here by ThreatLocker): SD 1.4, ChilloutMix (sd.cpp),
  TripoSplat; the commands are in the energy agent's report (worklog 2026-11-18).
- **Costs:** study total $44.32 (`costs.mjs`), plus today's ~12 Alpinist tries and FLUX.3 extras (~$0.20, recorded).

**2026-11-18, afternoon: the intro grown to the whole talk's frame, all local, not committed.** `out/drift-room/intro.html`
(backups `intro.before-*.html`, newest `intro.before-quiet-jump.html`). Stops (index `i`, three sections):
- **Sissejuhatus:** title, costume prompt, Estonian / Latvian ChilloutMix grids, then a walk right through Nano Banana Pro
  scenes **Matsalu → mist-bog → juniper-alvar → klint** (one template, horizons meet; the klint mirrored in the splat
  data at load, Spark ignores a negative scale). Each scene's prompts type **before** it, in the scene before: the edit
  prompt (`runs.json`) and the sound prompt (its JSON), Matsalu also "Turn matsalu.png into a 3D scene I can walk into."
  Every sound generated (ElevenLabs), no recordings. Index jumps glide silently, the arrived scene fades in.
- **Loodus slides:** `slides.html?only=klint,bog,eyebright,setomaa&embed&notitle&nomusic&nosound&judge&life=10&push=0.45&fit=1`
  in an iframe. 5 models each, judge placement for all (klint was nearest-photos), no sound box or amber heat, the intro
  plays each subject's `*-ee` clip, heat goes out and grows in, the label after it. Space past the last slide goes on.
  The index lists every slide. Lasnamäe dropped (its prompt "panel blocks" may confuse; user said never mind).
  Robirohi's prompt says "eyebright" (Rhinanthus is yellow rattle): pictures not remade.
- **Lõpp:** `ai-estonia.html` (fin-bed 1.3 over the scene at 0.4), black with **credits** (roll, smoked as one block,
  ~84 s, ends "Kõik tegelased ja paigad on välja mõeldud. … Tehisaru-Eesti / 2026" and rolls away), Nipernaadi
  (`mm-room-nipernaadi`) loops, ←/→ switch to Kevade / Alpinist (MiniMax), last Space fades the song over 12 s.
  3D and the map stop drawing once black (credits were janky).
- Shared changes: `prompt-box.js` softer clicks (`.before-soft`), `deck-index.js` 4 px corners, `slides.html` (?only
  order, ?notitle ?nomusic ?nosound ?embed ?judge ?life ?push ?fit, quick-jump ghost fix, whole-pixel stage),
  `splat-stage.js` push/fit options, `lauluvaljak.html` the slides' frame (its 3D from slide 2 renders as a thin smear,
  also before the change: open).
- **Films deck:** MusicGen small (2023, local) instrumental first under each film (`era.mjs film-*`); the music keeps to
  the picture's year (2023–25 MusicGen loops, 2026 ElevenLabs + MiniMax incl. the two Nipernaadi instrumentals);
  Kevade's pictures grey with a slight noir; Alpinist songs cut to room, synth, mm-room.
- **MusicGen national songs** (`era.mjs nat-*`, `out/era/musicgen-small/`): all five made, not in any deck yet. Ask:
  song grounds and Hermann with the films' year rule? (nature sounds are all 2026: the rule would silence older slides).
  Energy of nat-mesipuu/randaja/sind-surmani invalid (busy Mac).
- **Costs:** two paid Nipernaadi instrumentals ($0.30) not yet in `costs.mjs` (total ~$44.34, credits say ~38 €).
- **Next:** national costumes as their own deck (user: "lets work on separately", start from `costumes3.html`); the
  talk's further blocks (suggested costumes → music with/without voice → Hermann); nothing listened to yet.

**2026-11-18: the new intro (likely the talk's main template), all local, not committed.** Serve as below
(`python3 -m http.server 8123 --bind 127.0.0.1 -d evals/estonian-visuals/out`); pages in `out/drift-room/`.

- **`intro.html`** (backups `intro.before-*.html`, the zoom try `intro.with-zoom.html`). The cover landscape as SHARP 3D
  (`land3d/cover/wide-seedream-5-pro.spz`) on a sky-blue page (#a8b5c6), fading in with the title. **Stops**, Space /
  Shift+Space glide between them:
  1. left start (village and lake) with the title "Mitu sõrme / on eestlasel?" bold + the cover's subtitle, smoking in
     an 18 s loop (`smoke.js`), pinned in the sky so it moves with the scene, as far from the left as the top;
  2. the picture's own view, a prompt box types "Estonian national costume" (the user's wording; `cover.html`'s box
     says "Eesti rahvarõivas": ask which the picture was made from);
  3. "Estonian woman" / "Estonian man", rows of ChilloutMix seeds 1–4 (`out/cover/people/`) on a sky veil, each row
     under its box; 4. the same for Latvian;
  5. Matsalu (Nano Banana Pro, `land/nano-banana-pro/matsalu.png` as SHARP), set to the right of the cover, tipped 5.5°
     so the horizons meet, the two cross-fading by position (the cover's near tree smeared without it);
  6. Matsalu's boxes typed in turn: the image's edit prompt (`runs.json` bg-matsalu), SHARP (the picture + `sharp
     predict -i matsalu.png`), the sound's prompt verbatim.
  A title belongs to its scene and only shows on stop 1. Boxes type at once (`promptBox.type(0)`); key clicks in
  `prompt-box.js`. Arrows / WASD move, Q/E down/up, ↓ backs off up to 6 near-ground depths, drag turns slowly with
  inertia, R start, P logs the view. `?next=<land3d key>` swaps the right scene (`scene-pick.html` lists all 135).
- **Sound** (Web Audio, starts on the first click or key, loops cross-faded 4 s, levelled to one RMS, follows the scene
  cross-fade, M off/on): village `setomaa-ee` + `oldtown-ee` bells at 0.45 (peipsi-ee was "too sea-y"); Matsalu
  `matsalu-ee` (made today: "an October evening at Matsalu bay … cranes"; **BirdNET hears a Limpkin 0.91, no crane**).
  No real recordings in the intro (asked). Other `?next` scenes play their place's `*-ee` clip.
- **Keys, the decks' rule** (memory `deck-keys`): Space next, Shift+Space back (animated), arrows move 3D, mouse slower
  with inertia; **1/2/3 volume** low/mid/high. `keys.js` does Shift+Space → ← and the volume (wraps every Web Audio
  destination and media volume), loaded by 13 decks; `intro.html` handles Space itself (`data-keys="own"`). 3D decks
  (room-splat, hermann, lauluvaljak, figures) still step with ←/→: ask before converting.
- **`ai-estonia.html`** "Eesti / triivi / piirid": bold title and subtitle fade in together, then smoke; the heat spreads
  from Estonia over 11 s; linear heat (`?sqrt=1` old), smaller ring (`heatmap.js` `askR`); bottom line "● 329 pilti.
  Eestisse jäi 35 % piltide kaalust." numbers semibold. **Every heatmap** has more contrast (`heatmap.js` gain 2.2,
  gamma 0.8; `?contrast=0` old). Imports bumped (`?v=contrast`, `prompt-box.js?v=nodelay`).
- **Figurines:** all nine era women in `figures.html` (labels with checked years: klein 4B 2026, Nano Banana Pro 2025);
  `costumes3.html` (third costume version: the nine in one even row, years under); ChilloutMix women with feet
  (`out/cover/legs/`, English prompts work, Estonian ones draw coastlines) and one as a figurine
  (`figures3d/costume-legs.splat`). Energy for the nine: pictures ~26 Wh (estimate), TripoSplat ~2.6 h on the M1
  (not measured; ~80–105 Wh if 30–40 W): measure with `macmon` next time.
- **Music:** Grünberg by name refused by ElevenLabs (both prompts, copyrighted_material_detected), MiniMax made
  `mm-composer-alpinist` (3:15, unheard). Music README "Naming Sven Grünberg, and cranes for Matsalu". Credits ran out
  again ($0.03; auto top-up did not fire), topped up by the user ~09:30. Study total **$44.04**, 3.69 kWh
  (`cost.html` still shows $42.7: update if wanted).
- **HARNO keynote (27.11, 10–16, Öpiku, closing keynote):** no programme published anywhere (news, form, harno.ee,
  digipadevus.ee checked 2026-11-18): ask HARNO for the running order. 41 AI criteria on the pupil assessment page
  (Nov 2025), summary in chat; to fold into `research/harno/model.md` (5.2.6 / 5.3.5 not found under those numbers).
- **Next:** more nature scenes to the right of Matsalu (the user picks in `scene-pick.html`); the talk's 10 minutes;
  commit scripts/docs when the teacher says (media never).

**2026-11-17, end of day: the Arunädal demo pages (EKA, 20.11), not committed.** All under
`evals/estonian-visuals/out/` (git-ignored). Serve: `python3 -m http.server 8123 --bind 127.0.0.1 -d
evals/estonian-visuals/out`; http://127.0.0.1:8123/ opens `explore.html` (every page and sound; refresh with
`python3 evals/estonian-visuals/explore.py`). Everything Estonian on screen; prompts stay verbatim as sent. **Every
deck:** ←/→/Space step (one queued per key), `i` = thumbnail index (`deck-index.js`), M = sound on/off where sound.
**Evening update (2026-11-17, ~22:00), below "Evening".** Then 2026-11-18, the section above this one.

**The talk's order as built (the user picks the final 10 minutes):**
1. `drift-room/cover.html`: Ken Burns over ChilloutMix's "Eesti rahvarõivas" (the user's own pick, a bearded man in
   a woman's headdress: the beard is fine) widened by Seedream (onion domes), title "Mitu sõrme / on eestlasel?" going
   Crisp → Breath → Haze, background fades, prompt typed. → on the last step opens:
2. `story-open.html` "Tühimike täitmine" (the machine fills every gap with the average): figure → map ("Eesti:
   sinine, must, valge") → she rises as smoke, hole → Nano Banana Pro fills it (added another onion-domed church) →
   pan to Seedream's domes → push into the filled land (3D once SHARP has `story/filled.png`) → dissolve to Pakri →
   `slides.html#1`. `story-close.html` (the end): particles gather, she turns to the back GPT Image 2 invented (bow,
   ribbons), "Selja mõtles välja masin." Assets `out/story/`, script `story.mjs`, `figure-fx.js`.
3. `slides.html`: 15 nature subjects, 140 slides. Title = full-bleed real photo (Estonian names `TITLE_NAMES`,
   `TITLE_PHOTOS` overrides: Kolkja in summer, Kiviõli ash hill; `TITLE_FOCUS`/`TITLE_ZOOM`), silent; picture slides =
   3D splat (`splat-stage.js`: short forward drift, rise/tilt so the foreground slips out, pans; no sideways tracks)
   or flat with push-in; prompt box (blue dot, year, country code, model, €, Wh); generated nature sound + music box
   (amber dot) + amber music heat; map with blue heat, label pinned (fades out, heat drifts, fades in), black ring.
   No-country pictures hidden (`?plain=1`), sentences/tally off (`?notes=1`, `?tally=1`), map slides off
   (`?maps=1`), `?flat=1` no 3D.
4. `films.html`: 5 films × 19 models (refusals left out), real trailer stills on titles (research only, ©
   Tallinnfilm; `out/films/stills/`), box bottom right; 3D for 20 pictures; 4–6 songs per film played to the end
   then the next; label = the judge's film guess, else the place; Alpinist's ring in the Swiss Alps.
5. `lauluvaljak.html`, `hermann.html`: full-photo title, splats, right column (picture box, music box, map; no
   amber), choir only on the song grounds. `costumes.html` (figurine row + map + graph "Paremad pildid, mitte
   paremad teadmised"), `costume-slides.html`, `era-figures.html`, `figures.html` (particles), `drift-types.html`
   (grid of the 12 types, bold titles), `cost.html` (~$42.7, 3.4 kWh), `klint-map.html`, `sound-map.html`.
Shared: `prompt-box.js/.css`, `frame-edge.js` (one soft breathing edge everywhere, auto-crops baked-in frames),
`splat-stage.js`, `models.js` (release order, maker codes USA/GER/GBR/CHN/AUS/POL; fine-tunes = base model's),
`et.js`, `slide-type.css`, `map/heatmap.js` (ink, askInk, lines, fade; world.json; no ring glow), `map/room-map.js`.

**Findings today (for the talk):** Muhu by year: placed in Estonia 0 → 9/9 by 2026, Muhu criteria flat 11–17 %.
Pikk Hermann: plain prompt → British flags from the best models, 0/19 Estonian. Song grounds placed by the sign.
Films: judge names the better-known film (Nipernaadi → Tarkovsky's *Mirror*), 4/95 refusals (FLUX). Music judge =
language: Estonian singing → Estonia 54/54, no words → never; every generated nature sound placed abroad (Peipsi →
Fiji, rye → Japan). Release years checked (Nano Banana Pro 2025, FLUX.2 pro 2025, klein 4B 2026).

**Evening (2026-11-17), all local, not committed:**
- **SHARP done** (work Mac): the 18 nature scenes, the 5 era pairs (`list-nature.txt` had `era/` without `../`; fixed,
  original kept as `list-nature.before-era.txt`), `story/filled.png` (story-open picks it up) and
  `cover/wide-seedream-5-pro.png` (`list-cover.txt`). `land3d/index.json` 256 scenes. A browser check of all 44 3D
  slides: three bad moves fixed in `splat-stage.js` (forward ≤ 40 % of the near depth: the cornflowers; `era/*` a
  short plain push, no rise or tilt). Backup `splat-stage.before-depthcap.js`.
- **Cover in 3D** (`drift-room/cover.html`, backup `cover.before-3d.html`, `?flat=1` off): the same crops through a
  camera view offset; the camera starts forward and up and pulls back as the crop widens; at the end framing the
  canvas fades onto the flat stage for the prompt step. Open: the title step is soft (1024×512 source); `FWD` halves
  the pull-back if too strong.
- **Figurines** (`drift-room/figures.html`, `figures3d/*.splat`, TripoSplat 20 steps seed 42 on the M1, ~15 min
  each): `cover` (the cover figure, cut at the skirt: no feet), `era-<era>` for the nine eras' women
  (`~/visualia-build/figures/era/run.sh`, log `run.log`; DALL·E mini seed 8 queued after it, `after.sh` → `dm-s8-20.ply`,
  its 8 new seeds in `out/era/2022-dalle-mini/seeds/`, `woman.png` untouched). Fetch + convert:
  `scp mbp:visualia-build/figures/era/<n>-20.ply` then `node research/triposplat/splat.mjs in.ply out.splat`. Drag
  turns, wheel zooms, double click resets; `?fx=burst` (or F) = burst into small points and contract, default smoke.
  `?figs=era-2022-dalle-mini,...,cover`. Backups `figures.before-drag.html`,
  `figures.before-burst.html`. TripoSplat invented a long veil for the cover figure's back; GPT Image 2 invented a bow.
- **Music without the voice** (`research/music-drift/measure.mjs separate | judge novocals | novocals`; Demucs 4.0.1
  in `~/visualia-local/demucs/.venv`, CPU, MPS lacks an op): placed in Estonia 35/45 with the voice, **1/45 without**;
  8 a cappella clips had nothing left. `out/novocals/`, `out/judge-novocals.jsonl`, $0.13. Music README "The judge
  without the voice". Choirs leak (8 dB drop): listen.
- **Regilaul** (`run.mjs` `el-regi-*`, `finale.mjs` `fin-regilaul-arc`; README "Regilaul from Rõuge"): three real Rõuge
  texts; call and response comes through with 8–9 lines, dropped with 14; the arc may sing its own stage direction
  (Whisper hears it; listen). `seed` is refused with `prompt` on ElevenLabs.
- **ChilloutMix people** (`out/cover/people/`, Chrome tab `sd-web`; evals README "ChilloutMix, 'Estonian woman' and
  its controls"): flag colour follows the country, blonde from "Estonian", Latvian men 19th century, seed 3 = a car.
- Left: the old local image runs; Remove background build; MusicGen leftovers (`node research/music-drift/era.mjs`).
- Open: the 10-minute order; EUR = USD × 0.86; Kruusmaa's 1.5× to confirm; xeno-canto recordings are CC BY-NC-SA
  (talk only); film stills and the Nipernaadi originals research only; rahvaroivad.ee data to delete; commit
  scripts/docs when the teacher says (media never).
- Costs: `node evals/estonian-visuals/costs.mjs` after every paid run; outside-gateway calls into
  `costs-manual.json` (now $43.41). Disk about 10 GB free (Demucs venv, 19 SPZ added).

**2026-11-16, evening: the value drift work for the Arunädal demo (EKA, 20.11), not committed.**
Asked: *"its for research only and will be rm later"* (the rahvaroivad.ee data), *"keep that music around"*,
*"keep regilaul too"*, *"keep it in visualia"*. Session ran partly on 4G.

- **Deployed today, gateway and studio, from the working tree** (so they also carry the unfinished Remove
  background: the gateway's `/v1/cutout` and the studio's `/cutout` page answer an error until the pool side
  and app are built). Gateway: catalog image models unwrap `{state, result: {image}}` (`base64Of`); six new
  image models in `IMAGE_MODELS` (FLUX.2 pro, GPT Image 2, Qwen Image 3, Seedream 5 pro, Grok, Nano Banana Pro)
  plus p-image, FLUX.3 klein, Nano Banana 2 lite, Recraft; `/v1/images` takes `references`; `/v1/chat/completions`
  allows catalog models only from `JUDGES` (`google/gemini-3.8-flash`, `anthropic/claude-sonnet-5.5`, no
  streaming; Claude translated by `toAnthropic`). Studio: the Generate page lists the new models (the teacher:
  *"currently on, ui for management later"*, $0.03–0.13 a picture).
- **AI Gateway credits:** unified billing, $20 loaded 2026-11-16 (5 % fee), auto top-up on. The `usage` table
  showed $3.82 for the day at one point; agents also called Cloudflare's REST API directly (music, extraction),
  which is not in `usage`: the dashboard balance is the truth. Nano Banana 2 lite and GPT Image 2 record no
  price. From now on calls should go through the gateway (music needs a route first).
- **Research** (all with sources marked): `research/drift-mechanisms.md` (12 mechanisms, "why it drifts where
  it drifts", "are models getting better": EKI's data says Estonian language up, knowledge of Estonia stuck;
  Kruusmaa's 5.8 points does not match EKI's +15.6, ask him); `research/music-drift/` (README, anthem, Pärt
  refused by ElevenLabs, Koidula refused as "copyrighted", tintinnabuli generator, finale mixes, film theme
  songs, `nature-sounds.md` with BirdNET in Node); clips kept in `research/music-drift/out/` **and**
  `~/visualia-local/music-drift/` (never clean up). Demo: `research/arunadal-demo.md` (older plan),
  `research/arunadal-2026.md` (the block and its speakers).
- **Evals** (`evals/estonian-visuals/README.md`, one section each): Nature (judge places real Estonian photos
  55 %, generated 31 %, without the word Estonia 9 %); Neighbours (embeddings in Node, `neighbours/` package
  pinned; the control only works for the klint: Pakri lands 0/10 in Estonia, England/France); Folk costumes
  pilot and round two (expert text lifts criteria 27 → 81 %; Gemini names 15/27 real parishes, Sonnet 5/27);
  History and films (countryside scenes 9/18 placed in Sweden, 0 in Estonia; films refused by FLUX; the
  deportations text-only, both answers merge 1941 into 1949). `plans/folk-costumes.md` (idea).
- **rahvaroivad.ee data**, research only, git-ignored, **to delete later**: `out/rahvaroivad/` (366 entries,
  terms, media.json, 644 photos). Most photos exist only full size; the rest on wifi:
  `FULL=1 node fetch-rahvaroivad.mjs` (gentle, resumable). The licence question to MTÜ Rahvarõivas is still
  open; no costume picture made from their photos is shown anywhere.
- **Drift room** (`plans/drift-room.md`, idea, local only): `out/drift-room/room.html` (274 generated scenes
  as depth meshes, Depth Anything V2 small via transformers.js, fog transitions, camera moves, film songs per
  scene, light paper) and `slides.html` (picture left, caption, model strip, tally, watercolour map with the
  heat in flag blue #0072CE from `places.json`, `map/heatmap.js`, `edges.js`). Serve:
  `python3 -m http.server 8123 --bind 127.0.0.1 -d evals/estonian-visuals/out`. Done last: no pencil and no
  torn edges anywhere, soft edges, the room's map floats on the paper. Still wrong: gaps behind steep near
  trees show as darker olive smears mid-move. Backups `*.before-*.html` beside them.
- **Later the same evening (2026-11-16, ~21:45):**
  - **Overview page:** `evals/estonian-visuals/explore.py` writes `out/explore.html` (grouped by the 12 drift
    mechanisms + "are we getting better" + local vs cloud, then everything by set, each with an explanation;
    `out/sounds-research` is a symlink to `research/music-drift/out`). Rerun it to refresh.
  - **Slides** (`out/drift-room/slides.html`, `edges.js`): real photos full bleed with rounded inner corners;
    generated pictures as soft organic blobs, no rim lines, border animating (being made to wave all the time
    with crossfades inside); story order (demo order, real → weakest → best, named → plain); model strip,
    tally as numbers, landmark checks for Tallinn/Raekoda (`landmarks.json`, `landmarks.mjs`: generated
    Raekoda passes 30 % of checks vs 78 % real; controls 12/12, 10/10).
  - **Rooms:** `room-splat.html` uses **SHARP** 3D scenes (Apple, research-only weights, `~/visualia-local/sharp/`,
    kept; 113 scenes as 17 MB SPZ in `out/drift-room/land3d/`, 1.8 GB), falls back to the depth lift; walks
    by itself (C: walk/drive/drift), move with arrows/WASD/drag/wheel (G toggles auto, Q the sequence), waves of
    best vs weak models with good vs bad sounds, plain 3.5 s dissolves (no morphs), no anthem, no mirror, hue off
    (H). `room.html` is the mesh version. `figures.html`: TripoSplat costume figures (average, Muhu, Kihnu)
    made on the M1, `out/drift-room/figures3d/`. 66 more backgrounds across 8 models (`land/<model>/`).
  - **Era ladder** (`out/era/`, `ladder.jpg`): 2022 DALL·E mini → 2026 GPT Image 2 / Nano Banana Pro, pasted and
    painted backgrounds; ChilloutMix (local) to be added as a 2023 step.
  - **Local:** Gemma 4 26B as a local judge (15 % of real Estonian photos placed in Estonia vs Gemini's 55 %,
    ~5 s and 130 J an answer). Local pictures: ThreatLocker blocks sd-cli on the work Mac again (also
    onnxruntime-node's native lib; use onnxruntime-web). **On the M1** `~/visualia-build/local-run/` (SD-Turbo,
    ChilloutMix, SD 1.5 on the nature set, 12 costume prompts, era prompts) is queued behind the era agent's
    `era-local.sh`; results to copy back into `out/nature/<model>-local/` etc., then `node places.mjs`.
  - **Costume drift toward Russia** is a hint only: the neighbour control failed (real Estonian costumes found
    1–2/8). Needs same-style museum photos and garment crops before it can be claimed.
  - **Credits:** ran out once ($0 at about 20:40), topped up by the teacher; auto top-up didn't trigger. Check it.
  - **Disk (work Mac):** was 99 % full; scratch files, the npm cache and `~/visualia-local/models` (13 GB, the
    local FLUX.2 klein / SD-Turbo weights; blocked here anyway) deleted: 21 GB free. Other big items, not ours to
    judge: `~/.ollama/models` 46 GB, `~/Downloads` 51 GB, `~/Library/Caches/dev.kdrag0n.MacVirt` 5.6 GB.
  - Still open: the photo fetch (`out/rahvaroivad/`, ~3,300/4,170), rahvaroivad data to delete after research.
- **Next:** decide the demo's 10 minutes from this (the klint pair and counts, "where is this?", costumes in
  the room only, nature sounds and the corncrake, the finale anthem → bed → anthem, the room as the closing
  picture); ask Kruusmaa, MTÜ Rahvarõivas, and the Pärt Centre only if his name is shown; places.json should
  use neighbours only for the klint; commit when the teacher says.

**2026-11-16: Remove background, written end to end, not built, not
committed; its gateway route and studio page went out with the evening deploy** (`plans/pool-3d.md`; section 2 records the
change). The teacher chose **`ort` in the app, no Node helper**: a helper
plus Node would be a second install and a runtime for IT, against the
2026-10-22 decision.

- Worker: `apps/pool-app/pool-core/src/cutout.rs`, feature `cutout` (on by
  default), `ort` =2.0.0-rc.15 (ONNX Runtime linked in at build) and
  `image` =0.25.10. BiRefNet-lite on the CPU with
  `research/triposr/rmbg.mjs`'s steps ported line by line. `core.rs`:
  `Job.cutout`, `Model.cutout` (`.onnx` files allowed, only for removers),
  `cutout_models`, `done_cutout`, `CUTOUT_SECONDS` 50, `CUTOUT_FREE_GB` 10.
  `native.rs`: `cutouts_here`, `cutout_job` (refuses under 10 GB free
  memory). Both `Config` builders (CLI, Tauri) fill `cutouts`. New tests
  `cutouts`, `resizes_and_cleans`.
- Pool: `/cutout` (nodes only, 60 s, `CUTOUT_OUT` 6M chars); `models.js`
  entry `birefnet-lite`, file `birefnet_lite.onnx`, SHA-256 `56000243…3333`.
- Gateway: `/v1/cutout` (also the Trusted path), usage at $0 with energy.
- Studio: `/cutout` "Remove background" (`public/cutout.html`), `/api/cutout`,
  linked from home; 7 new keys, `check-text` passes (234).
- **Not built:** the M1 went unreachable (`ssh mbp` timed out from about
  midday 2026-11-16), and Rust only builds there (ThreatLocker). Next: copy
  `pool-core/{Cargo.toml,src/*}` and `src-tauri/src/main.rs` to
  `~/visualia-build/pool-app-src`, `cargo test -p pool-core`, fix the `ort`
  API calls if rc.15 differs (`commit_from_file`, `inputs()[0].name()`,
  `try_extract_tensor`), then a real photo with the model file in
  `UPSCALE_DIR`.
- Then: the model file to R2 (224 MB, under wrangler's limit:
  `publish-weights.mjs` takes it once it is in `upscale/weights/`), deploy
  gateway, pool, studio, and app 0.5.0 (this job and the ChilloutMix
  negative prompt).

**Deployed 2026-11-16:** migration `0014_prompts.sql`, gateway, pool, studio
(prompts in the open; https://studio.visualia.space/prompts, editable by
`eka-teacher`). Committed: `3367808` (TripoSplat research), `dc11d94`
(ChilloutMix + prompts), `38e778d` (HANDOFF, worklog).

**HARNO keynote (27.11.2026), 2026-11-16, not committed** (`research/harno/`,
also holding another session's earlier uncommitted changes and `sources/img/`):
the speaker's brief kept verbatim as `sources/keynote-brief.md`; its five
sources checked (`sources.md`, "Checked 2026-11-16": the Parker / "factory
manager of Ikea" line holds as another developer's words, "power tools" is
not in the transcript; four Port columns hold). Port's Postimees interview
(14.11, paywalled) read in full from the speaker's photos (not in the repo):
entry routes in `work.md`, "learn to learn" and "we expect answers" in
`learning.md`. Next, when asked: a speakable 35-minute script.

**Arunädal demo (20.11.2026, EKA), 2026-11-16, not committed:**
*"Loovus ja tehisaru"*, the value drift block opens with our 10-minute
"Demo Kallutatusest" (bias), spoken in Estonian. `research/arunadal-2026.md`
(the block, its speakers, TI-Hüpe), `research/arunadal-demo.md` (planned to
the minute: the 2026-11-09 Estonian visuals run, framed by Kruusmaa's Sirp
piece on EKI's mõõdupuu). Kruusmaa's numbers come from a fetch summary:
read the article before quoting. Times and the full panel: check the
programme spreadsheet.

**Research notes from 2026-11-16** (written by agents, not checked line by
line): `research/kristjan-port-ai.md` (Postimees interview 2026-11-14, "AI
will leave the middle class without work", paywalled), `research/annx-studio.md`
(ANNX Studio, Seoul, footage to splats, closed; built on Brush, Apache-2.0,
a possible pool job), `research/splat-morph.md` (morph splats and point
clouds: Spark 2.4 with a `dyno` modifier first; TripoSplat's octree order
may pair splats for free; the live morph is positron's).

**2026-11-15 (since committed; prompts deployed 2026-11-16):** The
working tree also still holds the uncommitted ChilloutMix work below and
`research/harno/` (another session's).

**Prompts in the open** (`plans/prompts.md`, building). Asked: *"i want all
preprompts to be editaable for visibility / education"*; decided: students
read, the teacher changes them for the school.

- The studio's `/prompts` ("What the models are told", linked from home):
  all 14 prompts the studio and pool add, 11 editable, 3 shown only. One
  list in `apps/studio/src/prompts.js`; a school's changes in D1 `prompts`
  (migration `0014_prompts.sql`); `GET/POST /api/prompts` (POST only for
  `role = 'teacher'`). Used by the page agent, checker, fix requests
  (new `{type: 'fix', problems}` message), the klein upscaler (gateway,
  Upscale page) and ChilloutMix's negative prompt (gateway -> pool
  `negative` -> pool-core `Job.negative`). Klein's default moved to
  `packages/prompts/index.js`.
- Tested: the API (student 403, checks, save, reset), the page in Chrome,
  one request and one fix through a stand-in gateway (the teacher's text
  arrived); pool-core's 9 tests on the M1 (its copy in
  `~/visualia-build/pool-app-src` now has the change). The real gateway
  and pool weren't run locally (Workers AI connection failed from here).
- **To deploy:** `wrangler d1 migrations apply visualia --remote`, then
  gateway, pool, studio. EKA has one `teacher` in `people`: confirm it's
  the right person. The negative prompt reaches computers on app 0.5.0.
- **Open, asked the teacher:** ChilloutMix and nudity. The negative prompt
  steers, it doesn't stop; nothing checks the finished picture and it is
  deployed. An output check in the gateway, or hide it until there is one.

**TripoSplat (picture to Gaussian splats), without Python**
(`research/local-multimodal.md` "TripoSplat", `research/triposplat/`
README, `plans/pool-3d.md` section 11).

- The browser port (`triposplat-webgpu.vercel.app`, unlicensed, fp32,
  6.5 GB): 15 min at 4 steps on the M2 Pro, smeared. Not usable.
- VAST's own PyTorch on the M1 (MPS): 152 s at 4 steps, 630 s at 20, 8.4 GB
  GPU, clean. Needs attention in pieces (`sdpa_pieces.py`): without it a
  16 GB Mac crashes (Python crashed twice on the M1 that way).
- **Our own fp16 ONNX export** (`export.py`, 3.1 GB, five graphs, each
  checked against VAST's fp32) + `triposplat.mjs` (sampler, octree walk,
  PLY in JS), Node + `onnxruntime-node` on WebGPU: 202 s at 4 steps, 917 s
  at 20. ONNX Runtime's WebGPU sums fp16 in fp16: `fp32math.py` casts
  MatMul/Softmax to fp32 for all parts but the DiT.
- Same noise as VAST: same clean chair. 4 steps with our JS noise came out
  hazy three times out of three (not settled: luck or the generators); 20
  steps clean. Offer 20.
- **On the M1, `~/visualia-build/triposplat/`:** VAST's checkout `d8db9e0`
  with `ckpts/` (4.4 GB), `onnx/` (fp16 and `*32` graphs), `refs/`, PLYs.
  Node's `onnxruntime-node` and `pngjs` come from `~/triposr-onnx`.
- **Next:** picture preparation (crop, scale, on black) in JS; DINOv3's
  licence (its weights ride in VAST's MIT repo); can the headset show
  splats; then the `splat` pool job.

**Also this session:** no depth estimator exists in visualia (only a
mention of Depth Pro in `research/models-2026-10.md`). The upscaler is live
at https://studio.visualia.space/upscale; the tab build is still 11-09's.

**2026-11-10, ChilloutMix in the pool: deployed and working, not committed**
(`plans/worker-app.md` "Pictures in the pool"). The gateway's `/v1/images`
with `model: "pool/chilloutmix"` → pool `/image` → a node worker runs
stable-diffusion.cpp's `sd-cli` (not bundled; `SD_CLI` or
`~/.visualia/sd-cli`) → base64 PNG, $0 with energy. Studio /generate has it
("In the pool"). **Deployed** gateway, pool, studio. First picture through
`gw.visualia.space` came back from `m1-1` (a lighthouse, 512², 112 s, 1.9 kJ).

- **The M1 worker** is the terminal program, built there
  (`~/visualia-build/pool-app-src`, a copy of `apps/pool-app`; pool-core's 9
  tests pass there), started with `nohup` (log `~/.visualia/cli.log`),
  `UPSCALE_DIR=~/.visualia/files` (the weights linked in) and
  `SD_CLI=~/.visualia/sd-cli` (linked to `~/visualia-build/stable-diffusion.cpp`).
  It dies with a restart. The Pool app 0.4.0 also runs there as `m1-1`.
- **Speed:** the M1 was on battery with **Low Power Mode on**: 4.9 s a step
  (about 100 s a picture) against 1.25 s on full power (about 28 s; load
  under 1 s, decode 4.5 s). Battery was at 11% at the last look. Plug it in,
  turn Low Power Mode off (`sudo pmset -a lowpowermode 0`), then time it
  through the gateway again. `--diffusion-fa` made no difference. Three
  ffmpeg test streams (`gen.sh`, another project) take about a CPU core there.
- **The comparison queue on the M1 is paused** (`kill -STOP`): resume with
  `ssh mbp 'kill -CONT 32364 38543 33390'`. One SDXL picture (Brandenburg
  Gate) and one SDXL Lightning picture were killed and are redrawn on resume.
- **Weights not in R2** (`files/chilloutmix_NiPrunedFp16Fix.safetensors`,
  `visualia-pool-app`), so no other computer can Get it. SHA-256 in
  `models.js` checked (`59ffe224…`). wrangler stops at about 300 MB (file is
  1.99 GiB); the Cloudflare API MCP gets 403 on R2; a temporary one-file
  upload Worker was refused by the permission check. Ways: an R2 API token
  and `curl --aws-sigv4`, allow that Worker, or the dashboard. The copy in
  the session scratchpad is gone with the session; the M1 has the original.
- **ThreatLocker** still SIGKILLs cargo build scripts on the work Mac
  (`parking_lot_core`); Rust there is at `/opt/homebrew/opt/rustup/bin`, not
  on PATH. Build on the M1.
- Left: R2, app 0.5.0 (by hand, as 0.4.0), commit and push.

**ChilloutMix in a Chrome tab** (`apps/pool-app/sd-web/`, README, not
committed): ONNX Runtime Web 1.31.1, WebGPU; text encoder 246 MB, UNet
1.72 GB (fp16, `temb` as input), VAE decoder 99 MB, exported on the M1
(`export.py`, diffusers `from_single_file`, SDPA attention); CLIP tokenizer
and DPM++ 2M Karras in JS. On the work Mac (M2 Pro): 19.8 s a picture warm,
24-28 s with loading. Models in `sd-web/models/` (gitignored) here and in
`~/visualia-build/sd-web/models/` on the M1. Serve with
`python3 -m http.server 8011 --bind 127.0.0.1` in `sd-web` (copy
`visualia.css` in first). Left: cache the 2 GB (OPFS), memory on 8 GB Macs,
fused attention, a pool tab worker for `kind: 'image'`.

**2026-11-09, pushed and deployed** (gateway, pool, studio, the upscaler
weights in R2, app 0.4.0 published):

- **Upscaling** (`plans/local-images.md` "Upscaling"): Real-ESRGAN in Rust
  with Burn (`apps/pool-app/upscale`; no Python, no extra program; Metal
  natively, WebGPU in tabs). Pool app **0.4.0** (built and signed in
  `apps/pool-app/target/release/bundle`, 22.5 MB) offers `upscale-fast` and
  `upscale-quality` once their weights are downloaded from the pool (model
  list `file` + `sha256`, R2 `/app/files/`). The pool's `/upscale`, the
  gateway's `/v1/upscale` (also `@cf/black-forest-labs/flux-2-klein-9b`,
  which redraws and invents detail; output capped at 1536×1536 worth of
  pixels), the studio page `/upscale` (linked from the class page), and the
  join page's "Upscaler" box and "No chat model". Warm on the M2: fast 0.2 s,
  detailed about 4 s for 320×128 → 1280×512; a tab 1.0 s.
- **Gateway `/v1/images` takes `model`**: nine Workers AI models tested;
  four catalog models need gateway credits (unified billing). SDXL, SDXL
  Lightning and Dreamshaper leave Workers AI on 2026-11-20; run on
  2026-11-09, nothing worth keeping (`worklog/2026-11.md`).
- **Deployed 2026-11-09:** gateway, pool (bucket `visualia-pool-app`
  existed; weights put and checked by SHA-256 as served), studio. App 0.4.0
  published (by hand): a 0.3.0 app now gets the update offer, signed. The tab upscaler served is the 10:56 build
  (`apps/pool/public/upscale`, the one tested in tabs); `build-web.sh` can't
  rerun here while ThreatLocker kills build scripts (below).
- **Images:** the studio stays on klein 4B (teacher's choice, 2026-11-09:
  9B is 13× the price); a failed 4B falls back to 9B. Catalog models need AI
  Gateway credits (dashboard, AI Gateway billing) before they answer.
- **Running locally from the session** (stops with it): `wrangler dev` for
  the pool (8787), gateway (8788), studio (8789) on one local D1 in the
  scratchpad, test key person `m2-test`, and `visualia-pool-cli` with
  `UPSCALE_DIR`. Local pool sign-in needs `ORIGIN=http://pool.visualia.space`
  in `apps/pool/.dev.vars` (gitignored; wrangler dev rewrites Origin).
- **Local image generation**: stable-diffusion.cpp built in
  `~/visualia-local/stable-diffusion.cpp` (Metal), models in
  `~/visualia-local/models` (14 GB: FLUX.2 klein 4B Q8 + Qwen3 4B + VAE,
  SD-Turbo). klein 4B 30 s for 512², SD-Turbo 6 s and draws Greece's flag for
  Estonia's. Not in the pool.
- **Estonian visuals** (`plans/estonian-visuals.md`, idea): the EKI
  leaderboard harnesses read and compared with our models; a playground to
  build; 31 folk-costume photos from rahvaroivad.ee in
  `evals/estonian-visuals/out/` (class only, not in git). **The teacher
  emails rahvaroivas.ee about the licence before the course.**
- **Revoke** the Hugging Face write token in the remotes of
  `~/personal/leaderboard_old/{data,ui}`.
- **The EKA course card** is a Google Doc (English only);
  `schools/eka/docs/COURSE-CARD.md` is the older draft.
**From 2026-11-02:**

- **The M1 is in the pool on 0.3.0** as `m1-1` (copied from the work Mac's
  build, started from its login item, keychain allowed on 2026-11-02).
- **The M1 is cleaned up** (2026-11-02): the three spare model builds, the
  old `~/visualia-build` and the 0.2.0 backup are gone (models 48 → 39 GB).
- **The work Mac is in the pool** as `eka-teacher` with `visualia-pool-cli`
  (qwen3.5-9b, gemma4-26b, clef-flash), started from a Claude Code session:
  it stops when that session ends. Ollama there was started the same way.
- **The update key** `~/.config/visualia/pool-updater.key` (work Mac only, no
  password, mode 600) signs every update; losing it means installed apps
  can't update again. **Back it up.**
- **The repo is public** (an anonymous request got 200 on 2026-11-02), though
  this file said private: decide which.
- **ThreatLocker blocks again** (2026-11-09): cargo's freshly built build
  scripts were killed (SIGKILL) during `build-web.sh`; wrangler and esbuild
  still run. Ask IT. Earlier (2026-11-02) it blocked nothing:
  re-signed copies, a freshly compiled binary and esbuild 0.28.2 all ran, so
  whether an approval survives an update can't be tested until it enforces
  again; ask IT what changed. The esbuild and workerd overrides stay until
  re-tested deliberately (`CLAUDE.md`). Rust (Homebrew rustup, 1.96) builds
  here now.
- **Boards are still the thread to pick up** (`plans/boards.md`): the teacher
  picks the next type or idea; build only that, and ask before designing.
  `plans/board-sight.md` (idea) is the proposal for how an AI sees a board.
- **MCP step 1 works from a real AI tool** (2026-10-23,
  `claude mcp add --transport http visualia https://mcp.visualia.space/mcp`).
- The note for EKA IT is in Claude Docs
  (https://claude.ai/artifact/54RozP72WYmyQEsSBixY8W), tab-only; not sent yet.

## What exists and is live

| Address | What | Code |
|---|---|---|
| https://studio.visualia.space (also visualia.space) | The studio. Home: the class chat (permanent, presence), Boards, "Everyone's work" as a plain live grid of shared projects (newest first / by person; the first board is cleared, `plans/board.md`), and "Your private projects". A project is a folder of files (`plans/multi-file.md`; old single-page versions become manifests on first read): describe → live preview → change → versions → publish; errors with auto-fix; "matches the request %" judged from a 375 px screenshot; pictures generated in pages; remix with credit; Share with class / Make private. `/usage` for everyone | `apps/studio` |
| https://studio.visualia.space/board/<id> | Boards: many per school, each a surface (pan, zoom), live for the class; text so far | `apps/studio` (`board.js`, `board.html`), `plans/boards.md` |
| https://projects.visualia.space/<person>/<slug>/ | Published projects, CSP sandbox; only the pictures the published version uses | `apps/studio` |
| https://gw.visualia.space | Gateway: every model call, `usage` rows in D1 (cost, energy, `served_by`, `served_kind`); `/v1/images` (FLUX.2 klein 4B); `/v1/decide` (Clef-flash: `pool/clef-flash` on a node worker, else cloud); `pool/<model>` routing with cloud fallback and mid-answer continuation | `apps/gateway` |
| https://pool.visualia.space/join | "Join the pool": a browser tab does AI work for everyone in the pool (WebLLM: Qwen2.5 1.5B, Qwen3 4B, or Qwen3.5 9B as `pool/qwen3.5-9b`, tabs only for jobs that fit 4,096 tokens); outbound only. Built, not deployed: `/app/update/…`, `/app/files/…` (R2 `visualia-pool-app`) and `/app/models` (`src/models.js`) | `apps/pool` |
| https://mcp.visualia.space/mcp | MCP server, step 1 read-only: `list_work`, `get_project`, `read_chat`, `usage_summary`; sign-in by OAuth with the course key on its own page; reads through the studio's `ForMcp` entrypoint and visibility rules | `apps/mcp`, `plans/mcp.md` |
| Visualia Pool (app) 0.3.0 | A 4.3 MB Tauri app, signed ad hoc (Rust: `pool-core`, `core` without I/O, builds to WASM too; the same code as the `visualia-pool-cli` program): checks for Ollama and links its download; the model list from the pool, checked against hard limits (8 models, 24 GB each, Ollama or hf.co tags, memory and free disk, a download stopped when bigger than listed, click only); Get with a percent, Remove (×) when out of the pool; Clef-flash made from its GGUF; machine and live lines; "Work done" table; starts with the computer and joins while a key is saved; looks for updates at start and every 6 hours, installs on a click (signed with our key; off with `defaults write space.visualia.pool Updates off`). Each new unsigned build asks for keychain access once, at the machine | `apps/pool-app`, `plans/worker-app.md` |
| https://probe.visualia.space | "What can my computer run?" + in-browser speed test | `apps/probe` |

Cloudflare (personal account, Workers Paid): D1 `visualia` (migrations 0001–0013
applied), R2 `visualia-projects` (and `visualia-pool-app`, not created yet), AI Gateway
`visualia`, Images binding, Browser Rendering, zone `visualia.space`.
`workers_dev` off everywhere.

Default page model: DeepSeek V4.1 Flash (`@cf/deepseek-ai/deepseek-v4.1-flash-1017`,
20 requests/min per account); fallback Gemma 4 26B (checked live for
multi-file: works, twice as slow, one garbled word). Instructions v0.4
(`schools/eka/instructions.md`), bundled at studio deploy.

## Machines

| | What it does | Notes |
|---|---|---|
| **M2 Pro, work Mac (32 GB)** | Ollama 0.40.8 (Homebrew), `qwen3.5:9b`, `gemma4:26b`, `clef-flash-8k`; in the pool as `eka-teacher` with `visualia-pool-cli` while a session runs it; Rust 1.96 (Homebrew rustup); the update key | ThreatLocker killed new binaries until at least 2026-10-23 (the Rust worker, the app, workerd 1.20261006+: exit 137); on 2026-11-02 it blocked nothing, and the Rust program runs here (`visualia-pool-cli`; the Node worker is retired). Homebrew Python, uv, PyTorch (MPS) and MLX run. Gemma 4 26B makes pages locally. Heats to 70–80 °C under load |
| **M1 Pro, home (16 GB)** | Ollama 0.40.5 (own LaunchAgent), Clef-flash 8k, mflux, six embedding models, Rust (1.99); the **Visualia Pool app 0.3.0** in `/Applications`, key in the keychain, its own login item (`--join`): `pool/qwen3.5-9b`, `pool/clef-flash` | SSH `mbp` on the home LAN only: from the work Mac, **turn the work VPN off** first (with it on, 192.168.1.241 times out). No inbound route. Apps are built on the work Mac and copied (`apps/m1-worker/README.md`). After a restart on 2026-11-02 the 0.2.0 app had exited at login; watch whether 0.3.0 survives the next one. Screen capture over SSH is refused |
| **Browser tabs** | WebLLM on WebGPU | Up to Qwen3.5 9B (5 GB, ~11 tok/s on the M2, usable Estonian); no tool calls yet; no Estonian on the 1.5B |

Same speed on M1 and M2: token generation is memory-bandwidth bound (both 200
GB/s); the M2's gain is memory size.

## Keys

`XXXX-XXXX`, SHA-256 hashed. Live keys in `.keys.local` (gitignored, chmod
600): `eka-teacher`, `eka-test-001`, `eka-test-002`, `m1-1` (the M1 worker). New key:
`node apps/gateway/add-key.mjs <person> [school] [role]`. People are shown by id
(teacher's choice for now). The app's update key: `~/.config/visualia/pool-updater.key`
(public half in `apps/pool-app/src-tauri/tauri.conf.json`).

## How to deploy and push

- `cd apps/<app> && npm run deploy` (studio copies `visualia.css`,
  `packages/text`, `instructions.md` first; every app
  runs the text check, which fails on a missing or unused key). Gateway: `npx wrangler deploy`.
  D1: `npx wrangler d1 migrations apply visualia --remote` from `apps/gateway`.
- The pool app: `cd apps/pool-app`, build with
  `TAURI_SIGNING_PRIVATE_KEY=~/.config/visualia/pool-updater.key TAURI_SIGNING_PRIVATE_KEY_PASSWORD= npm run build`,
  then `node publish-update.mjs --notes "…"` (after the pool is deployed).
  Models change in `apps/pool/src/models.js` (a pool deploy, plus the gateway
  for its allowlist), not in the app.
- After a studio deploy wait ~30 s before testing (Durable Objects can serve the
  old version briefly; that caused the "missing match score" scare).
- Push with the personal GitHub account: `gh auth switch -u kristjanjansen`,
  push, switch back to `Kristjan-Jansen_enefit`. Repo `visualia/visualia`
  answers anonymous requests (public; see "Right now"). No Claude attribution
  in commits.
- esbuild overridden to 0.28.1, workerd to 1.20260701.1 (newer ones are killed
  here; local dev with `--compatibility-date 2026-07-08`). Network commands
  need the sandbox disabled.

## Testing rules

- Never type course keys into a browser on the live site. Node scripts, and
  Playwright with the session cookie set from a script (scratchpad has
  `checktest`, `classtest`, `vistest`, `walllive`, `pool2-e2e`, …).
- Two-person checks with `eka-test-001` / `eka-test-002`.
- Live test leftovers: test messages in the class chat (kept on purpose), test
  projects and private remixes (no delete endpoint yet).
- Local checks: `wrangler dev` with the role (studio, projects, preview) on
  localhost, seeded D1/R2 and two local keys; scripts in the scratchpad
  (`mf2/dev.sh`, `studio.mjs`, `boards.mjs`, `boardui.mjs`, `home.mjs`).
  Playwright on localhost takes the `__Host-` cookie with `secure: true`.
- Heat on the M2: one run at a time, pause between runs, stop above 85 °C.

## Decisions the teacher made (keep them)

- AI Gateway payload logging stays on (2026-10-22).
- Words: every word people read lives in the app's `text.json` (shared
  `packages/text`); load the `visualia-writing` skill before writing any.
  Universal, communal wording ("everyone in the pool"), never "classmates" on
  the pool or app; "work", not "jobs" or "questions"; never "the cloud".
- Decide stays cloud-or-pool with models loaded on demand; nothing kept warm.
- Visualia Pool app: Rust worker, no bundled runtime; Ollama is a separate
  download from its maker (the app links it); metadata says only "an
  educational tool" (no EKA). Labs: the tab first; the app where IT deploys it.
- MCP is for everyone in the course from the start. Tentative yes, to confirm
  with the class before step 2: MCP changes count against budgets; outside
  agents may act on shared works, credited and undoable.
- UI: black sans on white, two sizes, two weights, two inks, three spaces, boxed
  fields, no bold UI text; minimal wording; phone first.
- UI in English only; no Estonian translation (2026-10-23). Models still
  take and write Estonian (briefs, page text).
- The class is peers: no teacher tools; everyone sees the same data.
- Projects start private; "Share with class"; publish is owner-only.
- Usage visible to everyone (ids, no prompt text, private titles hidden).
- Pool: outbound only, auditable, open source eventually; "Join the pool".
- `research/` holds general material (reading list, studies); course material
  stays in `schools/<slug>/docs/`.
- No timelines in plans.
- The board is a living experiment, built type by type: first with the teacher
  (types and primitives, AI sight, MCP), then with the students. Surface, not
  flow; many boards per school; text first (2026-10-23). The first board is
  cleared.
- One colour: `--select` (#0d99ff, the original Visualia board's blue) for
  what is selected or edited on a board, nothing else (`plans/style.md`).
- Every project is a folder of files; no single-file mode (2026-10-23).
- Local video dropped (Kandinsky: NVIDIA-only, 26.7 GB; `plans/local-video.md`).
- Keep Ollama for text. Lemonade and LocalAI not adopted
  (`research/local-runners.md`); pictures stay in the cloud for now.
- Visualia and positron share small pieces, never merge (2026-11-02,
  `research/positron.md`).
- `plans/backstage.md` is standing: inference about a student's process only
  on the student's request, backstage private by default (2026-11-02).
- The pool app updates only on a click, from pool.visualia.space, signed with
  our own key; IT can turn it off. No channel per school until a second school
  needs one (2026-11-02).
- One model list, sent by the pool; the app's hard limits only change with an
  app update; nothing downloads or is removed without a click (2026-11-02).
- The Node worker is retired; `visualia-pool-cli` or the app on every Mac
  (2026-11-02).
- No middots in the app: things side by side get a wide space; Remove is a ×
  without underline (2026-11-02).

## Open / next

0. **This stretch** (see "Right now"): deploy and publish 0.4.0; run the old
   image models before 2026-11-20; the Estonian visuals first version
   (`evals/estonian-visuals` harness on the 10 EKI prompts, judges, the
   playground page); unified billing; a pool `image` job (stable-diffusion.cpp
   or a Burn SD-Turbo port); Burn next for background removal or picture
   embeddings (`plans/local-images.md`, the background read in the worklog).

1. **0.4.1:** the shared layout with the join page (`packages/style/pool.css`),
   the version and update notice under the description. Build when
   ThreatLocker lets a build run on the work Mac (it kills new programs
   again since 2026-11-09, also `visualia-pool-cli`: the work Mac is out of
   the pool).
2. **The M1:** updated 0.3.0 → 0.4.0 from the live pool on a click
   (2026-11-09). **It does not survive a restart:** the login item runs it
   and it exits at once (status 0); find out why. Start by hand meanwhile
   (`ssh mbp 'open -a "/Applications/Visualia Pool.app" --args --join'`).
3. **Boards** (`plans/boards.md`): the teacher picks the next type or idea
   (images was the suggestion); `plans/board-sight.md` for AI sight. Not
   built: presence, undo, removing or renaming a board.
4. **Signed-in checks on the live site:** a board with two people, and an old
   single-page project (open, change, publish).
5. **Pool app, the rest** (`plans/worker-app.md` Next): signing with a Developer
   ID and CI (the update key into a GitHub secret then), Windows (NSIS target),
   the version in the pool's hello. Bundled Ollama stays off (decision).
6. **Words:** the studio's server-side error texts still to move into
   `text.json` (`plans/studio-core.md`).
7. **MCP:** step 2 (make) after the class agrees (`plans/mcp.md`).
8. **Multi-file:** tools through a pool worker, so local Gemma 4 26B can do
   page turns; asset upload; hand-editing files.
9. **Pool, next kinds of work:** embeddings (BGE-M3, `research/embeddings.md`)
   is the smallest step; pictures wait for the GeForce lab PCs; SVG through
   the page model with a render check (`research/svg-generation.md`).
10. Before real students: proper login (EKA OIDC?), budgets per student, a
    delete for projects.
11. New ideas from the chat (`plans/README.md`): `board-sight`, `taste-rules`,
    `small-data`; research in `research/canvas-agents.md`, `taste.md`,
    `small-data.md`; EKA's `RIGHTS.md` and `DRIFT.md`. Gemma 4 26B sees
    images but grouped by proximity right 1 time in 3; Clef-flash answers
    typed board questions in ~2 s warm (`worklog/2026-11.md`).
12. Speech, rate limits, positron: as before (`research/models-2026-10.md`,
    `research/positron.md`).
