---
status: idea
---

# Drift room: a psychedelic splat environment

Asked 2026-11-16: *"plan a psychedelia environment: use gaussian splats on generated landscapes and national
costumes blended into each other plus music"*, and *"keep it in visualia"*. Nothing built. INFERRED unless a
measurement or file is named.

## The idea

Value drift, made into a place you stand in. Generated Estonian landscapes as splat spaces that breathe; costume
figures that melt into each other, Muhu into Kihnu into the average and back; music made from a rule and from
models, driving the motion. The middle of every morph is the probable version, the one models give when nobody
asks for more. You see the specific dissolve into it and come back out.

It uses what the drift work already made (`research/drift-mechanisms.md`, `plans/folk-costumes.md`,
`evals/estonian-visuals` sets `estonia` and `nature`, `research/music-drift/`).

## Pipeline

| Step | In → out | How | State |
| --- | --- | --- | --- |
| Landscapes | prompt → picture | gateway `/v1/images`, the current catalog models (FLUX.2 pro, Nano Banana Pro, GPT Image 2…) | live (deployed 2026-11-16) |
| Depth | picture → depth map | a monocular depth model in ONNX on WebGPU (Depth Anything V2 small, or Apple's Depth Pro), in the tab or Node | **missing**: no depth estimator in visualia yet (HANDOFF) |
| Landscape splats | picture + depth → splats | one splat per pixel lifted along the depth ("2.5D sheet"), 512² = 262,144 splats; colour from the picture, scale from the depth step | to write, small (JS) |
| Costume figures | prompt → picture → cut-out | gateway images; Remove background (`research/triposr/rmbg.mjs` in Node now, `bria/remove-background` in the catalog as a fallback, our pool job later) | Node script works; pool job not built |
| Costume splats | cut-out → splats | TripoSplat, our fp16 ONNX export in Node (`research/triposplat/`), 202 s at 4 steps, 917 s at 20 on the M1 | three figures made on the M1, 2026-11-16 ("Figures in 3D") |
| Morph | splats A, B → splats | Spark 2.4 `dyno` world modifier: blend centre, log-scale, rotation (slerp), colour by index; TripoSplat output is already Morton-ordered, so index pairing is free (`research/splat-morph.md`) | researched, not built |
| Music | rule + models → audio | `research/music-drift/tintinnabuli.mjs` ported to WebAudio, live; loops from `elevenlabs/music-v2` ($0.0025/s) for drones and choir beds | generator works (MIDI/WAV) |
| Motion from music | audio → envelope, tempo | positron's music analysis, imported (per `CLAUDE.md`, it is positron's and visualia imports it) | to wire |
| Page | everything → a room | one studio page, `drift-room.html`, three.js + Spark, WebXR if the headset can show splats | to build |

A fuller 3D landscape (walk around, not just parallax) would be: picture → a camera-orbit video from a catalog video
model → frames → camera poses → Brush (Rust, Apache-2.0) trains a splat scene. Camera poses (SfM) are the missing
piece (`research/annx-studio.md`). Later, if the 2.5D sheets feel flat.

## One standpoint, so pictures blend

Asked 2026-11-16: *"somehow have equal standpoint on camera so imgs can blend"*. If every landscape is seen from the
same camera (height, horizon, focal length, direction), the 2.5D sheets line up pixel for pixel, and splat *i* of the
bog morphs into splat *i* of the alvar with no matching step.

- **A template scene, then edits.** Draw one neutral landscape (flat ground, horizon at a third from the top, eye
  height, 35 mm, looking north). Every other landscape is an *edit* of it with an editing model (Nano Banana, GPT
  Image 2, FLUX.3 klein with the template as reference): "make this a raised bog with a boardwalk, keep the camera,
  horizon and layout". The costume pilot found that edit models copy the reference closely (the Kihnu photo came back
  with its room); here that is what we want.
- **Same depth, different skin.** Stronger: fix one depth map and draw every landscape on it (depth-conditioned
  generation, ControlNet). Not in the catalog as far as checked; stable-diffusion.cpp runs ControlNet locally for
  SD 1.5 and SDXL (lower quality). Try the edit route first.
- **The prompt as a fallback.** A fixed camera sentence on every prompt ("eye level, horizon one third from the top,
  35 mm, centred, no people") narrows it but does not hold the layout; use only to compare.
- **Figures the same way.** One pose: a full-body front view of a neutral figure, centred, same scale. Each costume
  is an edit of that figure ("dress this figure in …, keep pose and framing"), then the cut-out and TripoSplat. Same
  pose means the splats' Morton order pairs arms with arms.
- **Check it:** the horizon row and the depth maps of two edits should match within a few pixels; measure before
  building the morph on them.

## First pictures, 2026-11-16

`evals/estonian-visuals/drift-room.mjs`, live gateway, `KEY_PERSON=eka-teacher`; pictures, contact sheets, cross-fade
GIFs, every prompt and model (`runs.json`) and the measurements (`measure.json`) in
`evals/estonian-visuals/out/drift-room/` (git-ignored). 27 calls, none failed, about $2.2 (Nano Banana 2 lite and GPT Image 2 estimated: the gateway records no price for them).

- **Template:** nano-banana-2-lite, a flat grass field under overcast sky. Asked twice for the horizon a third from the
  top, it drew it at the middle both times (row 511 of 1024). That is right for a level eye-level camera; a horizon at a
  third means tilting down. Kept the middle: any level camera agrees with it.
- **Edits** ("Change this landscape into …; keep exactly the same camera position, horizon line and composition."):
  - **nano-banana-2-lite holds the standpoint best**, and is the cheapest and fastest (7 to 11 s). Horizon at rows
    510 to 514 for bog, alvar, klint (the sea line), ash hill and the average: within 4 px of the template. Rye moved
    it up to 434 (77 px), Peipsi to 455 (the lake line, 56 px). Birch forest has no horizon to measure.
  - **nano-banana-pro redraws the camera:** good pictures, but the horizon went to 321 (rye), 371 (alvar), 411
    (Peipsi), 433 (ash hill); "the average" came back as a raised view over farmland. Spread 304 px. 18 to 63 s.
  - **gpt-image-2** (bog and klint only, 34 s each): bog held (515), the klint's sea line came down to about 550 (by eye).
    Not tried further.
  - The measure (strongest change between 8 rows above and below, middle three quarters of the width) is fooled by
    the beach in the klint pictures (it found 625 and 811); those were read by eye.
- **"The average Northern European landscape"** on lite is the template with two ditches and a farm on the horizon:
  the drift point is nearly the empty field itself.
- **Figures:** a template woman in grey on a grey studio wall and floor, then dressed in "an Estonian folk costume",
  and Muhu and Kihnu described in words from the extracted records (no photos sent). Both Nano Banana models kept the
  pose, scale and floor: head top at 84 to 98 px, feet at 954 to 960 against the template's 96 and 954. Pro keeps the
  figure centred within 3 px; lite's box measures up to 34 px off, a wall shadow by eye, the figure itself centred.
  Both drew Muhu's orange striped skirt and embroidered cap and Kihnu's red striped skirt, grey jacket, headscarf and
  belt. The plain "folk costume" is the dark bodice, white blouse and striped skirt of the pilot.
- **Blend:** on the contact sheets lite's open landscapes (bog, alvar, klint, ash hill, average) share the
  horizon and the ground's perspective, so they should cross-fade cleanly; rye and birch change what fills the frame
  and will jump. The GIFs (`land/fade-<model>.gif`) are there to watch; not yet looked at by a person. Next: depth maps
  of lite's set, to check the ground planes agree as well as the horizon.

## Room v0, 2026-11-16

A first room to look at, local only (`evals/estonian-visuals/out/drift-room/room.html`, not in git, not published).

**Run it:**

```sh
cd evals/estonian-visuals/out/drift-room && python3 -m http.server 8765
# open http://localhost:8765/room.html in Chrome, click once for sound
```

Space starts the next morph, M mirrors the left half. `?still` holds the camera; `?autostart` skips the click.

**What went in.**

- **Film scenes:** `node drift-room.mjs film`, ten edits of `land/template.png` with nano-banana-2-lite into `film/`,
  prompts in `runs.json`. Five scenes, each by name ("a scene from the Estonian film Nipernaadi (1983): …") and as a
  plain description: Nipernaadi's road and the haystacks by the lake, Nukitsamees' forest edge and farm, Paunvere's
  church (Kevade) and the boys by the river (Suvi). About 10 s each; the catalog reports no cost.
- **Horizon:** by eye all ten keep the horizon at the template's row (512 of 1024), contact sheet `film/sheet.png`.
  The measure (`measure.json`, `film`) reads 371 to 588 because it picks the strongest edge, which here is a tree
  line, haystacks or a church instead of the horizon. Only the two road scenes measure at 510 to 511. The measure
  needs a better rule before it says more than the eye.
- **Depth:** `node drift-room.mjs depth`, Depth Anything V2 small (Apache-2.0), the q8 ONNX (27 MB, cached in
  `out/neighbours/models/`), through transformers.js in `./neighbours/` as WebAssembly. 0.9 s a picture on this
  Mac; `<name>-depth.png` (384 px, near = white) next to every lite landscape, the template and every film scene.
  The ground planes agree: every map is black above the horizon and a smooth ramp below it.
- **The room:** three.js 0.187.0 (copied from the npm package into `lib/`), 147,456 points (384²), one per pixel,
  lifted along the depth on the pixel's ray. A shader blends colour and depth of point *i* between two pictures, so
  there is no matching step. The sequence is landscape, film scene, the average, the next landscape, …: 7 s hold, 5 s
  morph. Soft round sprites with a slight blur, a paper grain and a vignette, no depth test (rows drawn far to
  near). Breathing from slow sine noise, its amplitude from the music's loudness (AnalyserNode, slow follower).
  The hue swings slowly (about five minutes a cycle). The middle of each morph loosens a little. Music:
  `fin-mix-anthem-bed-anthem.mp3`, copied in.
- **The map:** `map/heatmap.js` in a canvas at the bottom right, 25% wide, its edge faded. Each frame
  `setBlend(t, a, b)` gets the morph factor. A landscape uses its subject's entry in `places.json`
  (`bog`, `alvar`, …), because the lite edits are not the pictures that file measured. The film scenes and the
  average have no entry yet, so the heat fades to the outline and the mark on Estonia. The room canvas has a CSS
  filter, so it stacks like a positioned element: every overlay needs a z-index or it is painted over (that hid the
  map, the label and the keys at first).
- **Edges:** the sheet feathers into the dark. Alpha falls off over the outer 16% of the grid, the edge bent by the
  same slow noise, and the farthest points are 30% fainter. It reads as a wash, not a framed photo.
- **Checked:** headless Chrome (Playwright, `--enable-unsafe-swiftshader`). No console errors, and the music plays. Screenshots `room-shot-1.png` (bog), `room-shot-2.png` (bog into the Nipernaadi road, halfway),
  `room-shot-3-mirror.png`.

- **Viimne reliikvia (1969):** six more edits, named and plain: Gabriel and Agnes riding, the Pirita convent ruin on
  the horizon, a knights' camp by a river. All six are in the sequence. Four keep the horizon near row 512 (measured
  506 to 523). The plain ride (408) and the plain camp (413, a higher view looking down on the tents) moved the
  camera, so they jump more in the blend.
- **Camera moves:** one move per scene: dolly in, dolly out, track, crane, or an arc of ±12° around a point 3 m
  ahead. The move runs through the hold and the blend (12 s, ease in and out), and each move starts from where
  the last one ended, so shots join without a cut. Limits: ±0.3 sideways, up to 0.3 up, 0.6 in. C picks the next
  move for every scene, A goes back to a move chosen per scene, and `?move=arc` (or another name) fixes one. The
  holes a move opens behind near things show a blurred, darker copy of the same blend on a plane behind the
  sheet, not black. Screenshots `room-move-arc.png`, `room-move-dolly.png`, `room-move-track.png`. At the arc's
  far end the boardwalk still shows a dotted edge where its points thin out.

- **Paper and mist (asked 2026-11-16: light grey, "dreamy foggy feel"):** the default ground is warm paper grey
  `#e6e4df` with a faint grain, and `?bg=dark` brings back black. The map uses its light theme. Fog thickens
  exponentially with distance and is thinner near the ground. Three slow noise banks at 1.8, 3.5 and 6 m move with
  the camera's parallax. The fog thickens in the middle of a morph, so one scene sinks into mist as the next comes
  out. Contrast and saturation are lower, and a blurred, warm copy of each frame gives the glow (soft-light).
  Pictures were too dark before: the textures were decoded to linear and never encoded back. They now pass
  through as sRGB. Screenshot `room-paper-midblend.png`.

- **Every generated picture (asked: "use other 3D images too"):** `node drift-room.mjs scenes` writes `scenes.json`
  (274 scenes: 9 landscape edits, 16 film edits, 7 figures, 145 nature, 81 history, 16 costume) and a 256 px copy
  plus depth for each into `scenes/` (14 MB, 249 depth maps in 5 min 20 s, cached). Generated only: the real
  photos, the rahvaroivad.ee photos and the pilot's "refs" pictures (drawn from those photos, close copies) are
  left out. Pictures that share a template camera (`align`) still morph point by point. Every other change goes
  through the fog: the old scene sinks into mist with its points scattering on their own slow paths, and the new
  one condenses out of it (1.4 × the morph time). The middle keeps a faint ghost. S switches the sequence:
  `room` (the template edits, as before), `subject` (every bog from every model, then the next subject: the drift
  between models) or `dream` (shuffled), also `?seq=`. Captions give the subject and the model. A dozen scenes
  stay in memory and three ahead are preloaded. Screenshot `room-fog-transition.png` (a neutral FLUX.2 dev bog
  into a FLUX.2 klein 4B bog, a quarter of the way through).
- **Film songs:** `music/` holds the five room clips from `research/music-drift/out/films/`. A scene of
  Nipernaadi, Nukitsamees, Kevade, Suvi or Paunvere, Viimne reliikvia or the Alpinist (template edits or the history
  set) plays its song, crossfading over the transition into it. Every other scene plays the finale bed. All
  tracks feed the one analyser that drives the breathing. P turns the music on and off.

**What blends well.** Open, flat scenes with the horizon kept: bog into the road scene reads as one place changing
skin, the boardwalk turning into the road and the farm rising out of the horizon. The sky never jumps. The average
works as a resting point between them.

**What does not.**

- **Parallax holes.** With a camera drift of ±0.35 and the full depth range, near things (the wanderer, the
  boardwalk posts) slid off their background and left black holes in their own shape. Fixed for v0 by compressing
  the depth (distance 1 to 8, not 1 to 28) and keeping the drift to ±0.12. The room is a gently moving picture,
  not a space to walk in. More would need the holes filled (inpainting the background, or splats from a real
  reconstruction).
- **Scenes that change what fills the frame** (Nukitsamees' forest wall, birch, rye) jump more than they melt.
  The forest stands where the template had sky, so the depth there goes from far to near in one morph.
- **Mirror** folds in over about 1.5 s. The right half blends back to the original over the middle 8%, so there is no
  cut line. A figure standing on the middle (the Nipernaadi wanderer) still shows faint stripes there.
- **Not yet seen by a person** with sound on a real screen, only in headless frames. Whether the breathing reads with
  this track is untested.

### Splats v0 (2026-11-16)

Real Gaussian splats in the room, with no M1 and no 3D service: `out/drift-room/room-splat.html` (room.html is
unchanged). Same sequences, camera moves, fog, songs, map, light paper and keys; no pencil.

- **Renderer:** Spark 2.4.0 (`@sparkjsdev/spark`, MIT, World Labs), `dist/spark.module.min.js` copied to
  `lib/spark.module.js` (2.7 MB) with its licence; it imports `three/addons/postprocessing/Pass.js`, copied from
  three 0.187.0 to `lib/addons/`. Installed in a scratch folder, not added to any `package.json`.
- **Built in JS, per picture:** one splat per pixel on an N² grid (`?n=`, default 320 = 102,400 splats; 256 to 512
  work). The centre is the pixel lifted along its ray to the depth, with the mesh room's compressed distance (1 to
  5.5 m). The splat lies flat on the local surface: two tangents from the neighbouring pixels (central difference),
  thin along the normal, sigma 0.6 of the pixel step so neighbours overlap into a soft wash. Colour from the
  picture, opacity 0.9, fading over the seeded ragged edge (the same wash as the mesh). About 0.6 s a picture at
  320², in slices between frames; the last ten stay in memory, three ahead are built in advance.
- **What it took to look right:** the depth maps are 8-bit, so far out one level is several pixel widths of
  distance and the ground comes in terraces. Judged naively, every terrace edge looked like a depth jump. Now: jumps
  are 6 or more levels between neighbours (judged on the raw map); the positions use an edge-aware 5 × 5 mean that
  ramps the terraces and keeps the edges. A splat may reach at most 1.5 pixel widths along its own ray; longer, the
  far ground turned into needles that fanned out from the horizon as the camera moved. On a jump the splat faces the
  camera, one pixel wide; on the far side of a jump it is 2.2 times larger, so a move uncovers some of it. A plain
  depth blur made it worse (the wanderer became a ribbed slope).
- **Morph:** two fixed `PackedSplats`, A (what the `SplatMesh` draws) and B. A `dyno` object modifier reads splat
  *i* of B by index and blends centre, log-scale, rotation (nlerp) and colour; at the end of the morph B is copied
  into A. The same modifier does the breathing, the mirror (it also reads the mirrored index), the hue swing and
  the fog banks (camera position as a uniform). Between pictures from different cameras, each splat of A switches
  to B at its own moment around the middle while they scatter on slow currents plus their own random way, swell
  3.5 times and fade into paper-coloured mist.
- **Compared with the mesh** (`splat-vs-mesh.png`: `mesh-room*.png` on the left, `splat-room.png`,
  `splat-room-move.png`, `splat-room-transition.png` on the right; also `splat-room-fog.png`): softer and more
  painterly by itself, with no glow or blur added. Bog grass reads as brush strokes, and trees against the sky lose
  their twigs. No smeared triangles at tree edges, and no stretched stripes on the sides in the arc. The morph
  reads as one picture dissolving into the other, better than the mesh. **Holes:** at the end of the arc the paper
  shows through in small patches behind the wanderer and the near lupins; the mesh fills those with stretched
  background colour. The middle of a fog transition is a pale, even block of mist the shape of the picture.
- **Performance:** 60 fps (the vsync cap) in headless Chrome at 1440 × 900 (ANGLE Metal, M2 Pro) during a
  morph with the mirror on, at 65,536, 102,400, 147,456 and 262,144 splats. Not measured on a weaker GPU or the
  headset.
- **v0.1, after the first look in Chrome** (*"white snow, weird morphs, heightmaps"*): paper flecks all over the
  near ground (surface-flat splats vanish edge-on), the ground read as eroded relief (Depth Anything models every
  grass tuft; the rye looked like mountains), and morphs melted that relief. Now: the depth gets a 13 × 13 bilateral
  blur, then a ground profile (per row, the 30th percentile of depth, smoothed and made to come nearer toward the
  bottom); relief around it is cut to 15%, only things well in front of it (trees, houses, haystacks) keep full
  depth; the nearest ground sits a little further off. Splats are round across the view, stretched along their ray
  to at most 3 times their width, sigma 0.8 of a pixel, opacity 1 inside. Behind everything a backing plane at
  6.2 m carries the picture blurred to a colour wash (the same ragged edge, blended and fogged with the splats), so
  the paper never shows inside the scene. Gentler moves: dolly in 0.22 (was 0.4), crane 0 to 0.18; the mid-morph
  swell 0.04 (was 0.12). Screenshots `splat2-rye-dollyout.png`, `splat2-average-dollyin.png`, `splat2-morph.png`
  (rye into the Paunvere river, halfway): no paper-coloured pixels in the lower middle of any of them, the ground
  is a plane, the morph reads as a dissolve. The surface-flat version is kept as `room-splat.before-smooth.html`.
- **Nature sounds** (room.html and room-splat.html): the generated field recordings from
  `research/music-drift/out/nature/` (never the xeno-canto controls), loudness-normalised with ffmpeg `loudnorm`
  into `out/drift-room/sounds/` (they were -37 to -60 dB; now -17 to -22 LUFS, 25 s loops): bog-plain for the bog,
  alvar-ee for alvar, spruce-ee for birch and ash hill, meadow-ee for rye and the average. Each crossfades with the
  morph; klint, Peipsi and the film scenes keep the last one, at a third under a film's song. N turns them on and
  off; they do not drive the breathing. Checked headless through bog, the Nipernaadi road and the average.
- **No anthem** (asked 2026-11-16, *"rm anthems from experience"*): both rooms no longer play
  `fin-mix-anthem-bed-anthem.mp3`, and its copy is gone from `out/drift-room/` (the research copies stay). A landscape
  with a nature bed plays only that (the breathing now follows the nature sound too, through its own analyser); a
  film scene plays its song with the nature bed at a third; every other scene (klint, Peipsi, history) plays the
  tintinnabuli rule bed, `music/room-rule.mp3` (from `fin-mix-rule-bed-rule.mp3`, -18 LUFS). Checked headless in
  both rooms: bog, Nipernaadi road, the average, klint and a FLUX alvar; no anthem file was requested.
- **Plain dissolves** (asked 2026-11-16: *"morphs are weird and unnecessary"*), in both rooms: the point-by-point
  morph, the scatter into mist and the mirror are gone. A scene change is a 3.5 s cross-dissolve, each scene with its
  own depth (room-splat: two splat meshes, A fading out and B in; room: B's sheet drawn over A's, fading in), with a
  light mist at the midpoint; the camera move runs on through it; the hold is 8 s. The hue swing is off (H turns it
  on). The brown smear on the right was the backing plane showing past the sheet's edge in an arc; the backing now
  stops well inside the sheet, the splats' edge fades wider, and the moves are gentler: arc ±2.5° (was 12°), track
  ±0.12 (was 0.22), dolly out squares the camera up (x and arc to 0, 0.05 back). `?hold=` and `?shot=` set the hold
  and move length for tests. Screenshots `splat3-dissolve-mid.png`, `splat3-lake-dollyout.png`, `mesh3-*.png`.
- **Open:** `ExtSplats` (float centres) if the half-float centres in the packed format show steps; fill the holes
  by drawing the far side of each jump as a second layer of splats behind the near thing; try a 16-bit depth
  export from `drift-room.mjs depth` instead of the edge-aware mean.

### Landscapes in 3D: SHARP trial (2026-11-16)

Apple's SHARP (one picture in, 3D Gaussian splats out; `research/landscape-splats.md`) on the work Mac (M2 Pro
32 GB, MPS). **Licence:** code BSD, weights Apple AMLR, research only. Nothing made with it is published or shown
to students without asking first. Page: `out/drift-room/land3d.html`.

- **Install** (outside the repo, `~/visualia-local/sharp/`, 3.7 GB): `ml-sharp` at `aed6527`, a uv venv on Python
  3.13.13 with the repo's own pinned `requirements.txt` (torch 2.8.0, torchvision 0.23.0, gsplat 1.5.3, timm 1.0.20,
  numpy 2.3.3; full list in `freeze.txt`). Checkpoint `sharp_2572gikvuh.pt` from Apple's CDN, 2,809,738,232 bytes,
  sha256 `94211a75…f073d`. Torch loaded on MPS with no ThreatLocker prompt.
- **Run:** `sharp predict -i in/<scene> -o out -c sharp_2572gikvuh.pt --device mps`, one scene at a time, after the
  other agent's Ollama model had unloaded. Bog, klint, the average (nano-banana-2-lite) and the Nipernaadi lake
  (film).
- **Measured:** the model forward pass takes 7.3 s per 1024² picture (13 s for the first, cold one), plus 2 s to
  write the file. A whole call takes 36 to 39 s, because loading the checkpoint takes 23 s (64 s the first time). Batching
  pictures into one call would save that. Peak memory footprint 17.1 GB (resident 6.0 GB). GPU 54 to 69 °C. Each
  picture gives 1,179,648 splats, a 66 MB PLY in `out/drift-room/land3d/`, plus `meta.json`. With no EXIF it assumes a
  30 mm lens (54° across). Depths are metric, from 1.3 m to about 165 m (the sky).
- **Viewer:** Spark 2.4 loads the PLYs as they are (the extra SHARP elements do not trouble it), turned half a turn
  about x (OpenCV axes). Light paper, the edge fades into the paper through a radial mask, no pencil. The camera
  orbits ±20° around a point on the near ground (the 20th percentile of depth: 2 to 4.6 m), so it moves 0.7 to
  1.6 m sideways. It aims 2.5 times further than that point, so the view turns about 8°, with a dolly of up to 12%.
  Each scene holds 16 s, then crossfades over 4 s through paper fog. The nature bed plays after a click. The field
  of view is fitted to the picture's width. 57 fps headless at 1440 × 900.
- **Looked at** (`land3d-bog-0/20/-20.png`, `land3d-nipernaadi-lake-0/20.png`, `land3d-klint-20.png`,
  `land3d-average-20.png`, `land3d-fog.png`): much better than our 2.5D lift. The ground is a real plane; trees,
  haystacks and houses have volume and stay solid at +20°. The water stays flat. The klint and the average show no
  visible flaw. **Flaws:** a dark smudge fills the space a near pine uncovers on the bog (no unseen parts, as
  advertised). A thin pole on the lake corkscrews into a twisted ribbon at +20°: thin things break first.
- **How far you can move:** about 1.5 m sideways holds. At 5 m (`land3d-bog-20-pivot-15.png`, taken before the
  fitted field of view) the bog falls apart: floating water patches, holes, bushes as blobs. A full 20° turn
  of the view (`?look=1`, `land3d-bog-20-look-1.png`) shows the picture's edge. SHARP covers only the
  original frame, so we turn less than we move.
- **All backgrounds (approved 2026-11-16):** 113 pictures (every template edit and free background under `land/`,
  and the 16 film scenes; no depth maps or sheets), with the checkpoint loaded once (`~/visualia-local/sharp/batch.py`,
  stats in `stats.jsonl`): 27 min in all, including 12 waits for the GPU to cool below 72 °C, because a Chrome tab
  kept it near 80 °C. Inference 7.8 s median (11 s at most), 9.4 s with writing. GPU 75 °C at most, MPS memory up to
  14.5 GB. Every picture is 1024², so every scene has the same 1,179,648 splats. Disk was too tight for 113 × 66 MB
  PLYs, so each one went through Spark's own `transcodeSpz` in headless Chrome to SPZ (16 to 17 MB) and was deleted.
  `land3d/<source path>.spz`, 1.8 GB in all; `land3d/index.json` maps picture → spz, focal length, pivot. `land3d.html`
  reads the SPZs now.
- **In the room (`room-splat.html`, the old one kept as `room-splat.before-sharp.html`):** a picture with a SHARP scene
  loads it as its own SplatMesh (scale 0.2, so one room unit is 5 m), with its own modifier: the same mist, fade and
  hue, fog by metric depth, breathing along the rays, and a ragged soft edge from each splat's place in the picture.
  The lift's backing plane is hidden on a SHARP side. The field of view narrows to fit a SHARP picture's width and is
  blended over the dissolve. Any other picture (the old cornflowers, nature, history) falls back to the lift; `?lift`
  turns SHARP off. Headless, SHARP scenes ran at the same frame rate as lift scenes (30 fps there, capped by the
  headless browser). SHARP meshes update the breathing every third frame outside a dissolve.
- **Walk** (asked 2026-11-16, *"I am moving along the road"*): one continuous walk distance. Each picture is placed
  where the walk stood when it began to dissolve in, so the new picture starts from its own camera while the old one
  ends ahead of its own, and the dissolve happens on the move. Forward into the picture, a faint step, slow looks left
  and right, and in every third scene a slow stop and turn. Soft limits from each picture's camera, which ease back:
  SHARP 0.3 units (1.5 m) sideways, 4 m forward, ±8° of turn; the lift a third of that. C cycles walk, drive (faster,
  shorter holds, less sway) and drift (the old moves). It does not find the road's vanishing point: it walks
  straight in, which suits pictures with the path in the middle.
- **Moving in by hand:** arrows or WASD, drag (mouse or touch) to look, wheel or pinch to go forward. Any input pauses
  the automatic walk for 8 s; G turns it off and on. W is forward, so the toggle is G, and the sequence key moved from
  S to Q. Checked headless: holding forward and right ends near the limits, a 26° drag eases back to 8°, and the walk
  resumes after 8 s.
- **Waves** (the default sequence): the free backgrounds from scenes.json, seeded and shuffled: 3 or 4 from the best
  models (nano-banana-pro, gpt-image-2, flux-2-pro-preview, seedream-5-pro, qwen-image-3.0-pro), then 3 from the weak
  and old ones (flux-1-schnell, p-image, flux-2-klein-4b, the 2026-11-09 cornflowers), alternating. The caption reads
  "best models · subject · model" or "weak and old models · …". Sound follows the wave (`sounds/wave-*`, about −20
  LUFS). Best: bog-plain (BirdNET heard the asked cranes at 0.97) with ElevenLabs songs that keep õ (room-nipernaadi,
  el-regilaul-2, room-kevade, room-nukitsamees). Weak: meadow-plain (BirdNET heard a toucan) with MiniMax songs that
  drop õ (mm-room-nipernaadi, mm-regilaul-lyrics, mm-named-kevade). The first scene of a wave plays only the field
  recording; the song comes in from the second. No anthem.
- **Screenshots:** `room3d-waves-1.png` (mist bog, nano-banana-pro, mid-walk) and `room3d-waves-3.png` (Peipsi onion
  beds, seedream), `room3d-weak.png`, `room3d-test-2.png` and `room3d-test-dissolve.png` (the Nipernaadi road walking
  into the lift average), `room3d-manual.png`. The paper shows at the side the sway moves towards, as a soft edge.
- **The bad wave** (asked 2026-11-16, *"where are those bad landscapes? It's all pretty good Nano Banana"*): the waves
  now run best → bad → best → weak. Bad is the old local models, labelled "<model> · old · local": the 2026-11-09
  cornflowers (dalle-mini, sd-1.4, sd-1.5, dreamshaper-8; the only landscape in that set) and the nature tasks re-run
  on the M1 (`out/local-m1/sd-turbo-local`, `chilloutmix-local`, 29 each; `sd-1.5-local` still arriving).
  `drift-room.mjs scenes` adds them (58 new depth maps). The bad wave plays meadow-plain (the toucan) with the
  MiniMax songs (mm-room-nipernaadi, mm-regilaul-lyrics, mm-ernesaks-lyrics with its õõõ loop, mm-named-kevade). The
  weak wave now plays meadow-ee with ElevenLabs' self-written regilaul and the named Reliikvia drift song. Screenshots
  `room3d-bad.png` (sd-turbo juniper: a blurry close-up, not a landscape) and `room3d-bad-2.png`.
- **SHARP for the bad wave is unfinished:** 10 of 62 done (the 4 cornflowers and 6 ChilloutMix pictures). The Mac was
  on battery at 3%, so inference had slowed from 8 s to 60 s, and I stopped it. The rest fall back to the lift. To
  resume on mains power: `cd ~/visualia-local/sharp && .venv/bin/python batch.py visualia-local/sharp/list-old.txt`
  (it skips what is done) with `node convert-land3d.mjs` in `evals/estonian-visuals`, then `python3 index.py`.
  Rsync and add `sd-1.5-local` to the list first (`node drift-room.mjs scenes` writes its depth maps).
- **Licence:** all of this uses Apple's research-only weights. Ask before the room with SHARP scenes reaches the course
  or Arunädal.

## Figures in 3D, 2026-11-16

Real Gaussian-splat costume figures, made on the M1 (16 GB, mains, Low Power Mode off, the Visualia Pool app idle
beside it), one job at a time. Inputs: the three same-pose generated pictures
(`out/drift-room/figure/nano-banana-2-lite/` folk, muhu, kihnu; no rahvaroivad.ee photo). Everything in
`out/drift-room/figures3d/` (git-ignored).

- **Preparation:** `research/triposplat/prepare.mjs`, VAST's `preprocess_image` ported to Node (short side to
  1024, BiRefNet-lite cut-out through `rmbg.mjs`, alpha eroded 1 px, square crop at 1.2 times the box, 1024 px, on
  black). Run on the M1 (no mask model on the work Mac, and ThreatLocker blocks onnxruntime-node's native library
  there): 6.5 to 9 s a picture, 7.1 to 8.0 GB peak RSS. Cut-outs clean by eye, feet included, no wall shadow.
  `*-cut.png`, `*-prepared.png`.
- **TripoSplat:** `triposplat.mjs prepared.png out.ply 20 42` (xoshiro noise, seed 42, the stream that gave the clean
  chair), 262,144 Gaussians, Morton order kept:

  | figure | total | DiT (40 calls) | DINOv3 + VAE | octree + Gaussians | peak footprint |
  | --- | --- | --- | --- | --- | --- |
  | average (folk) | 844 s | 792 s | 14 s | 34 s | 7.3 GB |
  | Muhu | 802 s | 750 s | 14 s | 34 s | 7.2 GB |
  | Kihnu | 802 s | 750 s | 14 s | 34 s | 7.3 GB |

  Peak memory footprint as `/usr/bin/time -l` reports it (5.6 GB max RSS); faster than the chair's 917 s.
- **What came out:** all three clean, none hazy. Faces soft, embroidery and aprons readable, the Kihnu socks and
  the Muhu hat in 3D, the side view a believable body (`figures3d/figures-row.png`, `figures-orbit.png`). The
  figures stand at different sizes: each is normalised from its own crop, and Kihnu's wider skirt made its box
  wider, so it comes out a little taller. Scale them to one height if they stand together.
- **Orientation:** the PLY's y points down here (the figures and the test chair both came out upside down in
  Spark), and the face looks along +x. The viewer turns them: a half turn about x, a quarter turn about y.
- **Files:** `folk.ply`, `muhu.ply`, `kihnu.ply` (17.8 MB each) and `.splat` (8.4 MB each, from
  `research/triposplat/splat.mjs`, same order).
- **Viewer:** `out/drift-room/figures.html`, Spark 2.4, light paper, slow orbit. One figure morphs average → Muhu →
  Kihnu → average (4 s hold, 6 s change): a dyno modifier reads splat i of each figure and blends centre, log-scale,
  rotation (nlerp), colour and opacity, sweeping from the feet up, with a small twist and thinning mid-way.
  `?view=row` shows the three, `?t=` fixes the morph, `?still` stops the orbit. Index pairing holds the body:
  mid-morph it is still a standing woman, in a cloud of mixed pigment (`figures-muhu-kihnu.png`), no blob.
  Checked headless (Chrome, ANGLE), no errors; not on a weaker GPU or the headset (786,432 splats loaded).
- **Particles instead of the morph** (2026-11-17, asked: *"for figures use dissolve / fly away particles / reassemble
  fx"*, then *"dissolve: less spread, go up, appear from bottom"*; backups `figures.before-particles.html` (the
  morph) and `figures.before-rise.html` (the first, sideways cloud)). Two `SplatMesh`es on the same splats, each with a
  dyno object modifier reading its figure by index: one leaving, one arriving, so no pairing. Leaving: each splat rises
  like smoke in still air (top first but along the whole height, its own speed, an ease-in rise of about half the
  figure's height, the column widening 12 %), with a small curl wobble whose phase and rate are its own (no sheet), and
  shrinks to a round mote, greys and fades (gone by 55 % of its own flight, ease-out: *"blend particles to transparent faster"*). Arriving: from 10 % of the 4.5 s change (each splat in 17–22 % of it, mostly formed by 60 %, whole by 84 %: *"new model should appear faster"*), feet first up to the head, each
  splat rises from up to a twentieth of the figure's height below its place, fading in, and slows to rest (cubic ease).
  The new skirt stands while the old figure is still a column of smoke above it; no empty moment. Holds 4 s; Space or
  → next, ← previous (one step queued), `?speed=`, `?auto=0`, `?t=1.4`; `?fade`, or no `dyno.readPackedSplat`, or
  unequal counts give a plain cross-dissolve. Chrome on the M2 Pro: 120 fps with a window (8.4 ms mean, p95 9.3 ms),
  60 fps headless; one frame of 100 ms or more in each run, not traced. Screenshots `figures3d/fx-{0,30,60,100}.png`,
  `fx-strip.png` (10–90 %), script `shot-figures-fx.mjs`. The first arriving feet started a fifth of the figure
  below their places and floated as a patch under the old feet; now a twentieth, and the change went from 6.5 s to
  4.5 s (asked: *"start feet less far down, bit speedier"*).

## Song Festival Grounds room, 2026-11-17

`out/drift-room/lauluvaljak.html`: Tallinna lauluväljak from all 19 gateway image models (named and without the place)
and four Commons photos, as depth meshes with the room's dissolves, the anthem under the photos, Ernesaks under the
models that drew Kotli's shell (both Nano Banana models, GPT Image 2, partly Grok) and the drifted clips under the rest.
About $1.12. Details: `evals/estonian-visuals/README.md`, "Song Festival Grounds".
Later the same day: the photos out of the room, worst first by a location judge (Gemini 3.8 Flash, $0.15: named 11/19
placed in Estonia, plain 4/19, mostly from writing and flags, not the shell), a caption with the judge's answer and the
song's model, SHARP splats instead of the lift (`land3d/lauluvaljak/`), and the canvas fading into the paper at every
screen edge (no sharp corners). The lift version: `lauluvaljak.before-splat.html`.

## Pikk Hermann room, 2026-11-17

`out/drift-room/hermann.html`: Pikk Hermann with the flag, all 19 gateway image models, named and plain ("a medieval
castle tower with the national flag", no country), SHARP splats, worst first by a location judge and a flag judge, as a
slow drone flyover (a rising arc, ending on the flag), hymns underneath (the anthem last). Plain prompts: no Estonian
flag at all, British flags from four of the best models. About $1.46. Details: `evals/estonian-visuals/README.md`,
"Pikk Hermann".

## Nature slides in 3D, 2026-11-17

Asked: *"can we put land3d.html and the nature slides together? use movie-like pans, moving forward, perhaps rising."*
`out/drift-room/slides.html` (the flat version kept as `slides.before-3d.html`; `?flat=1` gives the flat pictures).

- **On a picture slide** with a SHARP scene in `land3d/index.json`, the splats take the picture's place under the same
  prompt boxes, map and sounds, with the rooms' soft breathing edge (`room-edge.js`, oval) and the splat's own ragged
  feather. The flat layers' grade (contrast .84, brightness 1.05, saturation .85) is done in the splat modifier, so a
  splat and its flat picture match. One eased move over 24 s (`?life=`), seeded by the picture: a forward dolly of
  0.75 × pivot (1.2 to 3 m), then one of push (yaw 1.2°, a little sideways), crane (0.8 × the dolly, rise up to 0.6 m,
  tilt down 1.6°) or pan (4° across, rise up to 0.25 m). Camera fixed, scenes moved (as the rooms), so the outgoing
  scene keeps its move through the 1.8 s dissolve. The edge stays while any splat is visible (the outgoing one too),
  else the canvas cuts it straight.
- **No splat:** the flat picture with a 7 % Ken Burns push-in over the same 24 s. While a splat loads the flat picture
  shows, then fades out as the splat fades in. **Title slides:** the full-bleed photo, a 6 % push-in over 36 s.
- **Loading:** only the current picture's splats and the nearest picture slide on either side (a title skipped); the
  rest disposed once faded out.
- **Checked** (Chrome, Playwright, 1440 × 900 at 2×, with existing land splats standing in for nature pictures through
  a routed index): 60 fps headless (median 16.7 ms, p95 16.8 ms) holding, in a splat-to-splat dissolve, and while the
  next splat loads; no console errors; `?flat=1` and the `i` index work.
- **Splats chosen** (asked: *"do SHARP but selectively; see that years are covered"*): per subject one 2025 picture
  (flux-2-dev or p-image) and one 2026 (flux-2-klein-4b, flux-3-image-klein or nano-banana-2-lite), the one the judge
  put furthest from Estonia; all five era pairs. 35 in `~/visualia-local/sharp/list-nature.txt`. **Not run yet:** the
  Mac was on battery at 32–35 %. On mains: `cd ~/visualia-local/sharp && .venv/bin/python batch.py
  visualia-local/sharp/list-nature.txt > batch.log 2>&1` with `node convert-land3d.mjs` in `evals/estonian-visuals`,
  then `.venv/bin/python index.py` (about 6 min of SHARP, ~600 MB of SPZ).

## The look, and the map in the corner

Asked 2026-11-16 (spoken): a map in a corner whenever results are shown; a heat map of where each picture "is",
morphing and blending in and out of its hot areas; black and white, only the outline map; edges blended. In general
*"dreamy, blurred edges, watercolory"*, so it belongs with the splats. On slides the map shows the picture on screen;
in the 3D room it follows the camera, updating as one scene blends into the next.

- **What the heat is.** Each picture's placement as points with weights: the judge's country answers (a soft blob at
  the country, size from its confidence) and, better, the nearest real photos from the neighbour test (each has
  coordinates; a kernel density over them is a true "where it looks like"). Real Estonian photos as the control
  show what "right" looks like. One file, `places.json`: picture → `[{lat, lon, w}]`.
- **The map.** Natural Earth outlines (public domain), simplified, cropped to the Baltic Sea and its neighbours
  (about 5–40° E, 50–70° N), drawn as thin grey lines on black or white.
- **The heat.** Gaussian blobs summed into a field, blurred, shown in greys only. Watercolour, not a chart: noise
  bends the edges, pigment gathers at the rim (edge darkening), a paper grain over it, soft bleed between areas.
- **Motion.** When the picture changes, the field cross-fades and drifts from the old places to the new ones over a
  few seconds, like the splats. In the room the blend factor is the same as the scene morph, so map and scene move
  together. A small mark stays on Estonia (or the place asked for), so the drift reads as distance from it.
- **Everywhere the same.** One small module used by the slides page and the room.

### Map v0 (2026-11-16)

- **Run.** `node evals/estonian-visuals/places.mjs` writes `out/drift-room/places.json` (and, the first time,
  `out/drift-room/map/outline.json` from Natural Earth 50m: world-atlas countries and the lakes, 0.9 MB fetched once
  into `out/natural-earth/`, outline 70 KB). Then `python3 -m http.server 8123 -d evals/estonian-visuals/out` and
  open `http://127.0.0.1:8123/drift-room/slides.html` (`?theme=dark` for black): arrow keys or a tap step through
  the 165 nature pictures, the real photos first in each subject; `#n` opens slide n.
- **Slides.** Warm paper grey with a faint grain. The picture on the left 60 %, its edges feathered into the paper
  with a ragged mask, contrast lowered and blacks lifted, a slow fog drifting over it; a change is a fog
  cross-dissolve (the old picture sinks into the mist, the new one rises). Words top right; the map bottom right on a
  transparent canvas at the screen's pixel ratio, fading out radially so it floats. The asked place and places off
  the map are named in the page's own type, not on the canvas. On a portrait phone: picture, words, map.
- **Module.** `out/drift-room/map/heatmap.js`, WebGL 1, one fragment shader, no dependencies.
  `createDriftMap(canvas, { theme, backdrop, edge, outline?, pixelRatio })`; `show(entry or points, { asked })`
  drifts from what is on screen to the new field over 3 s; `setBlend(t, a, b)` for the room, frame by frame; `a` and
  `b` can be `places.json` entries (their `asked` place comes along) or arrays of `{ lat, lon, w, r, name }`;
  `project(lat, lon)` and `offMap()` for words beside it. The view is 12 W to 42 E, 35 to 71 N (Ireland, Brittany,
  Iberia's north, Crimea) with a gentle radial zoom on the Baltic (Estonia about 1.4 times the edge scale).
  Coastlines and lakes only, Estonia a little stronger; `borders: true` adds land borders. 60 fps in headless Chrome
  at 979 × 979 (M2 Pro). places.json is keyed by picture path, plus one summed field per subject (`bog`, `klint`,
  `ashhill` …) for the room's scenes.
- **What the heat is made of, for now:** the judge only. Gemini Flash's unprimed answer at the region (Estonian
  counties and the regions it named near the Baltic) or the country centroid (its European part, so Russia sits west
  of the Urals), weight = confidence, spread = the region's or country's size; the map breaks each answer into five
  offset lobes so it stains rather than sits as a disc. Places beyond the view (Ecuador, the US) are a wash on the
  rim of the fade in their direction, with their name. "unknown" (14 pictures) leaves the map empty. The neighbour
  points (the 10 nearest real photos per encoder, at their geotags) are written and tested with stand-in embeddings,
  and take over in `places.json` as soon as `neighbours.mjs embed` has embedded the reference photos (klint and
  Peipsi so far); the judge's points stay in `alt`.
- **Still chart-like or open:** a judge answer is still a guess at one spot, drawn as a confident little cloud; the
  off-map wash sits over real land in that direction (Ecuador's lies over Iberia, only its name says otherwise); the
  Baltic's islands make the coast busy at phone size. Fixed on the way: a closed coastline ring (Britain) was
  simplified away to nothing, so the first East Sussex blob seemed to sit in the Channel. Screenshots:
  `out/drift-room/map/desktop-*.png` (1440 × 900) and `phone-*.png` (390 × 844), each with a mid-transition frame.

### The map flies out to the world (2026-11-17)

Asked: *"map support panning/animation/zoom to show also canada etc"*, then *"no need hand map"*, so it frames itself
and there is no drag or zoom by hand.
- **Outline.** `places.mjs outline` now also writes `map/world.json` (`places.mjs outline-world` writes only that file):
  the same Natural Earth arcs and lakes, 50m inside the old window and simplified to about 110m outside it. Small
  islands and lakes outside the window are dropped, land borders are kept only inside it, and nothing south of 60 S.
  It has 10,137 points in 105 KB. `heatmap.js` fetches it by default and falls back to `outline.json`. The slides load it.
- **Camera.** `{ lat, lon, zoom }`, where at zoom z the short side spans 360 / 2^z degrees (Europe is about 3.3). The
  old plane is unchanged at zoom 3 and closer, so the Europe view gives the same pixel positions as before (checked at
  four places on three slides). Zooming out, the plane morphs into Equal Earth, centred on 23 E and matched at the
  Baltic, between zoom 2.8 and 1.2. The radial zoom on the Baltic eases off between 3.0 and 1.6.
- **Framing.** On each `show()` the map frames the points with weight 0.1 or more, plus the asked place. If they all
  fall inside 12 W–42 E, 35–71 N, it uses the old Europe view. Otherwise it takes the closest zoom that keeps them
  inside the visible disc. The flight is van Wijk–Nuij's smooth zoom and pan (as `d3.interpolateZoom`), eased over
  2.8 s, so a long jump zooms out first. The heat is now held in lat/lon and rides along with the camera. Anything
  still outside the frame slides to the rim wash and gets its name, as before. API: `setView({ lat, lon, zoom } |
  'europe' | 'world', { duration })`, `frame(points, { asked })`, `autoFrame(bool)`, `getView()`. The header
  comment in `heatmap.js` has the details.
- **Checked** in Chrome (Playwright, GPU) at 1440 × 900. These slides fly out: 21 (Newfoundland, Canada), 113
  (Washington, US), 174 (Hokkaido, Japan), 210 (New Zealand, judged here; this one is a near-whole-world view).
  Europe-only slides (2, 30, 60) look the same as before. Over a flight the frame times are a steady 16.7 ms with
  none over 20 ms, and the map's own JS work is about 1 ms a frame. When Estonia sits near the right edge, the
  asked place's name in the slides now goes to the left of the ring.
- **Open.** On a 390 × 844 phone the map sits below the fold (`#mapbox` top at 774 px). The fixed-height caption
  and the wrapped strip push it down; this was already so before this change. In a world view the tally covers the
  top-left corner of the map.

## What moves, and with what

- **Breath:** landscape sheets displaced along their depth by slow noise, amplitude from the music's envelope.
- **Melt:** costume A → the average → costume B, the blend factor on the music's phrase length. The average is a
  costume made from the plain prompt ("Estonian folk costume"), which is the drift itself.
- **Colour drift:** hue cycling and saturation pushed past real, a classic psychedelic move; it also makes the point
  that the colours are not the real ones.
- **Mirror:** kaleidoscope by instancing the same splats mirrored (cheap: one buffer, several transforms).
- **Trails:** keep the last frames faintly (feedback on the render target), like the loopback demos in positron.
- **Tintinnabuli** as the ground: the melody voice steps, the triad voice answers; each new phrase triggers the next
  morph. Pärt's name is on nothing (`research/music-drift/README.md`).

Budget: Quest-class headset about 1 M splats in total (`research/splat-morph.md`); start with one landscape sheet
(262,144) and two figures at 65,536 each.

## Type that smokes away, 2026-11-17

Asked: *"typography treatment for large typo (large, medium headlines). want that drifty 'smoking away' effect on
edges. use dom-in-canvas chrome api and shaders. playground first. can also apply for frame edges later."* Local only,
git-ignored, not in the slides yet.

- **Files:** `evals/estonian-visuals/out/drift-room/smoke.js` (the module, `smokeText(element, options)` and
  `createSmoke(canvas)` for any texture), `type-smoke.html` (the playground, http://127.0.0.1:8123/drift-room/type-smoke.html),
  `evals/estonian-visuals/shot-type-smoke.mjs` (Playwright check), screenshots `type-smoke-drift-{0,0.5,1}.png`,
  `type-smoke-drift-1-dark.png`, `type-smoke-panel.png`.
- **API** (WICG html-in-canvas, the current explainer; the older `layoutsubtree` / `texElementImage2D` names are gone):
  `<canvas content="drawable">` with the heading as a `drawable` child; the canvas `paint` event (`onpaint`),
  `requestPaint()`, `getElementImageDefaultSize(el)` (device pixels; fractional, so round up), then
  `gl.texElementSubImage2D(TEXTURE_2D, 0, 0, 0, el)` into a texture allocated first, and
  `updateElementGeometry(el, { canvasTransform })` for hit testing. Texture rows come top first. Also present and
  unused: `captureElementImage`, `getElementTransform`, `clearElementGeometry`, `drawElementImage` (2D).
- **Chrome:** 157.0.8103.79 on the M2 Pro. Flag `chrome://flags/#canvas-draw-element` (on in the teacher's Chrome),
  feature name `CanvasDrawElement`. Playwright's Chrome had the API even without the switch;
  `--disable-features=CanvasDrawElement` removes it, which is how the fallback was checked.
- **Fallback:** `smokeSupported()` tests each method; without them the heading is left as it is and the page says so
  (`?plain` forces it, for comparing).
- **The shader:** two blurs of the snapshot's alpha, made only when the text changes (a narrow one, `width` em, for the
  erosion band; a wide one, 0.4 em, where the smoke comes from); one pass a frame: domain-warped fbm moves the edge a
  little, noise eats inward from the edge (soft both sides, so strokes thin and pale before they go), a faint wash
  stays where the edge was, wisps gather the wide field upwind with a jittered march (no stepped copies of letters),
  soft ridged filaments in patches, fade before the canvas edge, toothy grain on the eaten edge and the smoke.
  Lengths are in em, so large and medium headings look alike. At drift 0 it matches the page text by eye (the second pair of lines sits 1 px off).
- **Checked** (`node shot-type-smoke.mjs`): double-click selects a word, headings are in the accessibility tree,
  layout does not move (the canvas sits in a wrapper; negative margins on the canvas collapsed with the next margin and
  moved the medium line 43 px). GPU time a frame at 1600×900, device scale 2, four headings: about 3.5 ms (1.0 / 0.3
  ms a large / medium heading after warm-up), so 60 fps holds with room. Playwright's windows run rAF at 30 here, so the
  number comes from `bench()` (draws, then one read), not from rAF. Empty paper is skipped early; without that it was 4×.
- **Looks** (asked: *"do some presets, currently hard to choose"*): eight named looks, a row of buttons at the top
  of the panel and keys 1 to 8, each setting every slider, eased over 1.2 s so two can be compared live; the link
  keeps `#look=smoke`, and touching a slider shows "Custom". Crisp, Breath, Haze, Smoke (the default now; the first
  default was too subtle), Drifting away, Ash, Mist, Gone. A new slider, Softness, lets the crisp edge give way to
  the narrow blur (the blur now carries the ink's colour, so blue stays blue). Contact sheet
  `out/drift-room/type-smoke-presets.png` from `node shot-type-smoke-looks.mjs` (same paused moment for all). Breath is
  meant to be close to Crisp; the others are told apart at a glance. Heaviest look about 3.7 ms a frame.
- **Frame edges next:** `createSmoke(canvas).setSource(gl => gl.texImage2D(..., mask), w, h, emPx)` with the frame's
  alpha (the wash mask from `edges.js`, or a rounded rectangle) and `{ inside: 0 }`, so the picture keeps its middle and
  only the rim erodes and smokes; `em` becomes the frame's scale. The picture's colour would come from a second texture
  (not wired). `inside` is untested.

## The story: gaps filled in, 2026-11-17

The thread for the Arunädal talk (EKA, 20.11), the user's idea: at every step a machine fills a gap with the probable.
The prompt has no data, so the figure is an average one; the judge has no evidence, so it places her by the colours;
the picture had no left side, so Seedream invented one with onion domes; the figure has no back, so a model invents
one. It starts from the cover's ChilloutMix figure and comes back to her at the end. Local only, git-ignored.

- **`out/drift-room/story-open.html`** (after the cover; the cover's last → opens it, its last → opens
  `slides.html#1`): 0 the cover's last frame, 1 the map flies in beside her with the judge's Estonia (0.7) and
  "Eesti: sinine, must, valge" on the heat, 2 she rises away as smoke and leaves a soft hole, 3 the fill prompt is
  typed and sent and the fill paints itself in, 4 a pan left with Seedream's widen prompt in the box, 5 a slow push
  over the filled landscape, 6 it dissolves into the Pakri title photo.
- **`out/drift-room/story-close.html`** (the end): she gathers from the bottom up with the cover's prompt box, turns
  round (her particles move to the back's, paired by rank after sorting by height then x, the figure narrowing to
  edge-on and widening, 3.6 s), and "Selja mõtles välja masin." comes under the back's prompt box.
- **Shared:** `out/drift-room/figure-fx.js`, the particles of `era-figures.html` as a module, plus the turn.
- **Pictures** (`evals/estonian-visuals/story.mjs`, into `out/story/`): `filled.png`, Nano Banana Pro filling the
  right half (the original square) with the figure's MODNet mask grown and greyed; only the hole pasted back, the
  model's colour shift corrected by a smooth difference field from outside the hole (without it her outline showed
  as a ghost). `back-cut.png`, GPT Image 2 from the cut-out on paper, asked for "the same framing" rather than
  "full figure" so the two figures pair height for height; Nano Banana Pro's try kept as `back-nano-banana-pro-framing.png`.
  Three calls, about $0.34.
- **SHARP later:** `~/visualia-local/sharp/list-story.txt` has `filled.png`; once `land3d/index.json` has
  `story/filled.png`, step 5 shows its splats (splat-stage.js) instead of the flat push. Untested until then.

## Care

- Costume figures come from **generated** pictures only. The rahvaroivad.ee photos are research material, licence
  unconfirmed, never turned into splats for showing.
- Kihnu and Seto are living traditions (UNESCO). The room is about where AI gets them wrong; it stays in the class or
  a talk, not online, until people from those traditions have seen it.
- Regilaul is in (decided 2026-11-16: *"keep regilaul too"*); Seto leelo stays out. The music is the rule generator, the kept clips and model beds.
- Flashing and fast colour cycling: a warning at the door and a calm setting (no strobe, slow hue).

## Steps

1. Depth: pick and run a depth model on 3 generated landscapes (bog, alvar, birch forest); write the 2.5D lift; view
   in Spark.
2. One costume figure: generated Muhu picture → cut-out → TripoSplat (work Mac) → `.splat`.
3. The average figure and a second costume (Kihnu); the morph in Spark by index.
4. Tintinnabuli in WebAudio, its phrases driving the morph; a model bed under it.
5. The page in the studio; then the headset.

## Open questions

- Which depth model runs fast enough in a tab (and its licence: Depth Anything V2 small is Apache-2.0, larger ones are
  not; Depth Pro has Apple's own licence).
- TripoSplat on the work Mac: memory and whether ThreatLocker lets onnxruntime-node's native module load.
- Is it for the Arunädal demo (20.11, four days) as a backdrop loop, or for the course?
- Can the headset show splats at all (`plans/pool-3d.md`, open).
