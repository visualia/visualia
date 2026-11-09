# Estonian visuals

EKI's 10 image prompts (flag, cornflower, coat of arms, Raekoda, Tartu
university, Muhu costume, verivorst, kohuke, laulupidu, Estonian text) drawn by
each image model, then every picture judged by Clef-flash, one yes/no
criterion at a time. Plan: `plans/estonian-visuals.md`. Prompts from
`~/personal/leaderboard_old/runner/data/imagegen_prompts.json`; EKI's
free-text criteria are rewritten in `tasks.json` as 4 to 6 concrete visual
questions each.

## Run

```sh
cd evals/estonian-visuals
node run.mjs generate                 # all models, or name some: generate sdxl flux-2-dev
node run.mjs judge                    # Clef-flash, every criterion, every picture
node run.mjs report                   # model × task table, per criterion, agreement with labels.json
node run.mjs sheet flag coat_of_arms  # out/sheet-<task>.png, one row of all models
node run.mjs page                     # out/index.html, every picture with its answers
node run.mjs publish                  # apps/studio/public/visuals/estonia/ for the studio page
node run.mjs --set germany judge      # any command, for another set of prompts
```

- Sets: `--set <name>`, default `estonia`. Estonia's tasks are in
  `tasks.json`, its pictures and results in `out/` as before; any other set
  has `tasks-<set>.json`, `labels-<set>.json` and everything under
  `out/<set>/` (pictures, `results.jsonl`, `judge-cache.jsonl`,
  `index.html`). `publish` writes `apps/studio/public/visuals/<set>/`:
  each picture at 256 px (`<task>.jpg`) and 1024 px (`<task>.large.jpg`,
  longest side), and `data.json` with `set`, `country` and `aspect`.

- `GATEWAY` defaults to the local gateway, `http://127.0.0.1:8788`. Start it
  with `cd apps/gateway && npx wrangler dev --port 8788 --ip 127.0.0.1
  --compatibility-date 2026-07-08 --persist-to <dir>`.
- The key: `KEY_PERSON=<name>` takes it from `.keys.local`; without it, a
  local gateway uses the scratchpad `key.txt`, any other `eka-test-001`.
- Pictures go to `out/<model>/<task>.jpg` (1024 × 1024, design 768 × 1024,
  DALL·E mini always 256 × 256, FLUX.1 schnell always 1024 × 1024) with a `.json` beside each (time, usage). A picture that exists is not
  drawn again; delete it to redraw.
- `dalle-mini` is not on the gateway: the script serves
  `apps/pool-app/dalle-mini` over HTTP on a free port and drives its page in
  Chrome (Playwright, a visible window, WebGPU), seed 1. Run `fetch.sh` there
  first (1.06 GB).
- Judging: the picture shrunk to 512 px JPEG, one picture and one question
  per call, the answer cached in `out/judge-cache.jsonl` by picture hash and
  question, so a rerun only asks what is new or failed. `out/results.jsonl`
  has one row per picture × criterion: task, model, criterion, probability,
  judge, latency, tokens.
- Score: the share of a picture's criteria with probability at or above the
  cut-off, 0.5 unless a criterion in `tasks.json` sets `cut`.
- `labels.json`: our own yes/no by eye, for checking the judge.
- `out/` is not in git (`evals/*/out/`).

## Cost

| Model | A 1024 × 1024 picture |
|---|---|
| flux-2-klein-4b | about $0.0011 |
| flux-2-klein-9b | about $0.015 |
| flux-1-schnell | about $0.0006 |
| phoenix-1.0 | about $0.026 |
| lucid-origin | about $0.031 |
| flux-2-dev, sdxl, sdxl-lightning, dreamshaper-8-lcm | no published price in the gateway |
| dalle-mini | free, on this computer (about 8 s a picture on the work Mac) |

From the gateway's comments (pricing pages, 2026-11-09). Clef-flash: about
$0.00003 a call, about 0.3 s. A full run (100 pictures, 470 questions) cost
about $0.75 for the priced models plus about $0.015 of judging.

## How to ask the judge (lessons)

From the first Clef-flash test (worklog 2026-11-09) and this run:

- `state` names the subject only ("A picture of a flag."). Never the prompt
  or the expected answer: quoting the prompt biases Clef to yes. The gateway
  needs a non-empty `state`.
- One criterion per question, concrete and visual: "Is the top stripe of the
  flag blue?", not "Is it correct?".
- Score = probability, with a cut-off per criterion. Probabilities rank well
  but 0.5 is not always the right line.
- Small things hurt: a thin cross, a weather vane, the spelling of a word
  are where the judge misses. No cropping in v1; a crop per criterion is the
  next thing to try.
- Spelling questions have to name the word, which is the expected answer in
  the question; Clef leans to yes on them (see below).

## First run, 2026-11-09

All 10 models, 10 prompts, local gateway, Clef-flash on Workers AI. Score in
%, cut-off 0.5:

| model | flag | corn | coat | raekoda | tartu | muhu | verivorst | kohuke | laulupidu | text | all |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| flux-2-dev | 100 | 100 | 80 | 80 | 100 | 40 | 75 | 100 | 75 | 100 | 85 |
| flux-2-klein-9b | 100 | 100 | 60 | 20 | 100 | 40 | 100 | 100 | 75 | 83 | 77 |
| flux-2-klein-4b | 100 | 100 | 60 | 60 | 80 | 40 | 50 | 75 | 100 | 83 | 74 |
| flux-1-schnell | 60 | 75 | 60 | 60 | 80 | 40 | 75 | 75 | 100 | 67 | 68 |
| lucid-origin | 100 | 50 | 60 | 20 | 80 | 40 | 50 | 100 | 75 | 100 | 68 |
| phoenix-1.0 | 60 | 50 | 40 | 20 | 100 | 60 | 50 | 75 | 100 | 100 | 66 |
| sdxl | 20 | 100 | 40 | 40 | 100 | 40 | 50 | 100 | 50 | 67 | 60 |
| sdxl-lightning | 40 | 75 | 20 | 20 | 80 | 60 | 50 | 75 | 50 | 33 | 49 |
| dalle-mini | 40 | 25 | 20 | 0 | 60 | 100 | 75 | 50 | 0 | 50 | 43 |
| dreamshaper-8-lcm | 60 | 25 | 0 | 0 | 60 | 0 | 25 | 0 | 0 | 33 | 21 |

The order is close to EKI's (Sonnet 4, 0 to 5): FLUX.2 dev first, the
SDXL-era models last.

**Judge against our eye labels** (`labels.json`, flag and coat of arms, all
10 models, 100 criteria): flag 42/50 (84%), coat of arms 47/50 (94%), 89%
in all. Where it went wrong:

- lucid-origin and flux-1-schnell drew a Nordic cross flag (blue, black,
  white). Clef said yes to "free of any cross" for lucid (0.79), only 0.45
  for schnell, and yes to "exactly three stripes" for lucid (0.74). The cross
  is the one error that matters, and it is the one it misses, as in the
  first test.
- phoenix-1.0's five stripes (blue white black white blue) passed "exactly
  three" (0.91).
- Counting is weak: "exactly three lions" passed on sdxl (2 lions, 0.52) and
  sdxl-lightning (1 lion, 0.77).
- Dreamshaper's cyan blur passed "top stripe blue" and "bottom white".

Not labelled, but seen on the sheet: Estonian text. Only flux-2-dev and
lucid-origin wrote "Tere tulemast Eestisse" right. Clef said yes to
"Eestisse, spelled exactly so" for "Esttise" (0.60), "Èstisse" (0.86),
"EESTISE" (0.92) and "EESTISSSE" (0.78): it checks whether the text is
about there, not the letters. "Tere tulemast" did better (it caught "ere"
and "Tcere"). Spelling needs another judge, or OCR.

Other things seen:

- dreamshaper-8-lcm gave plain black pictures for coat of arms, Muhu costume
  and kohuke (likely its safety filter); they score 0, as they should.
- flux-2-klein-9b failed with "3043: Internal server error" on 2 of 100
  calls even after 3 tries each; a second run drew them.
- sdxl took 20 to 90 s a picture, the rest 2 to 13 s.
- Criteria every model fails (oak branches, battlements, Muhu yellow) say as
  much about the questions as the models; read them before trusting a task
  score.

## Germany, first run, 2026-11-09

`--set germany`: 10 prompts in `tasks-germany.json` (flag, coat of arms,
Brandenburg Gate, Cologne Cathedral, Neuschwanstein, Bavarian Tracht, Brezel,
Currywurst, Oktoberfest tent, "Schöne Grüße aus Köln" on a sign), 52
questions, the same 10 models, local gateway, Clef-flash. Written by us, not
EKI, with the lessons above: neutral `state`, one visual fact per question,
no counting except "a single head, not two". The text task keeps spelling
questions on purpose ("Köln, with two dots over the o?") so the judge's
spelling weakness shows in the scores. Score in %, cut-off 0.5:

| model | flag | coat | brandenburg | cologne | neuschwanstein | tracht | brezel | currywurst | oktoberfest | text | all |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| flux-2-klein-4b | 100 | 100 | 100 | 80 | 100 | 80 | 80 | 100 | 83 | 83 | 90 |
| flux-2-klein-9b | 100 | 100 | 80 | 60 | 100 | 60 | 80 | 100 | 100 | 83 | 87 |
| lucid-origin | 100 | 100 | 100 | 100 | 100 | 80 | 80 | 100 | 67 | 50 | 87 |
| flux-2-dev | 100 | 100 | 60 | 100 | 100 | 40 | 80 | 75 | 67 | 100 | 83 |
| phoenix-1.0 | 80 | 100 | 80 | 80 | 100 | 40 | 80 | 75 | 67 | 83 | 79 |
| flux-1-schnell | 100 | 83 | 80 | 80 | 100 | 60 | 60 | 75 | 83 | 33 | 75 |
| sdxl | 60 | 83 | 80 | 100 | 100 | 100 | 80 | 50 | 100 | 0 | 75 |
| sdxl-lightning | 80 | 50 | 60 | 100 | 100 | 60 | 40 | 50 | 50 | 0 | 58 |
| dalle-mini | 40 | 17 | 100 | 80 | 80 | 60 | 20 | 25 | 33 | 0 | 44 |
| dreamshaper-8-lcm | 40 | 33 | 40 | 80 | 40 | 20 | 0 | 25 | 0 | 0 | 27 |

Scores sit higher than Estonia's (the top four at 83 to 90): Germany is
better known to the models, and the questions are easier. Same order at
the bottom.

**Judge against our eye labels** (`labels-germany.json`, flag and coat of
arms, all 10 models, 110 criteria): flag 43/50 (86%), coat of arms 54/60
(90%), 88% in all. Where it went wrong:

- The first wording of a flag question, "Do the stripes run from side to
  side, not from top to bottom?", came out backwards: 0.04 to 0.19 on six
  correct flags, 0.80 on dreamshaper's blur. Flag agreement was 78% with it.
  "Are the stripes horizontal, lying one above another?" fixed it. A
  question with "not" in it is a risk; say the thing plainly.
- Now it leans to yes on "horizontal" for anything stripy (sdxl-lightning's
  diagonal swoosh 0.90, dreamshaper 0.89, DALL·E mini 0.71).
- phoenix-1.0 drew four stripes (black red gold black): "bottom gold" was
  caught (0.05) but "middle red" passed (0.62). sdxl's wavy black, red and
  yellow pattern passed "bottom gold" (0.90).
- Coat of arms: flux-1-schnell's white shield with a thin gold rim passed
  "golden shield" (0.90); sdxl's golden beak and claws passed as red (0.86).

German text, by eye: only flux-2-dev wrote "Schöne Grüße aus Köln" right.
Clef caught missing dots (klein 9B's and phoenix's "Koln", 0.06 and 0.07)
and klein 4B's "GRÜSSE" without ß (0.13), but passed lucid-origin's
"Köloln" as Köln (0.80), flux-1-schnell's "Grüze" as Grüße (0.80) and
phoenix's "GRÜSSE" as having ß (0.89). As with Estonian: it sees the
shape, not the letters.

Other things seen:

- Every model drew the soft American pretzel; "bottom thick, arms
  thinner" (the Swabian Brezel) passed none.
- Weak questions, or weak models, worth a look before trusting the task
  score: knee socks passed 3 of 10, sliced Currywurst 4, Oktoberfest
  ceiling decorations 4, the Brandenburg Gate's flat top 3.
- flux-2-klein-9b's "3043" failures came back: 4 of its 10 pictures
  needed the third try (8 failed calls); none failed outright.
- dreamshaper-8-lcm gave no black pictures this time; DALL·E mini drew a
  football match for the sign.

Cost: pictures about $0.74 (the 40 from flux-2-dev, sdxl, sdxl-lightning and
dreamshaper have no published price), judging about $0.016 for 520 calls.
Published to `apps/studio/public/visuals/germany/`.

## Design classics, first run, 2026-11-09

`--set design`: 10 prompts in `tasks-design.json` from
`plans/design-classics.md` (Bauhaus, Swiss style, Constructivism, De Stijl,
Art Nouveau, a 1950s cut-paper film poster, the three-band paperback, sports
pictograms, wood type, an Estonian 1930s travel poster), 50 questions. The
prompt names the movement; the questions never do, they name what to look
for. No designer's name, no logos, no counting, no spelling. The Estonian
prompt is our draft, for the teacher to rewrite.

Pictures are 768 × 1024 (portrait, like a poster). SDXL, SDXL Lightning and
Dreamshaper took that size through the gateway. FLUX.1 schnell is always
1024 × 1024 (the gateway fixes it), DALL·E mini 256 × 256. The M1 models
were not run. Score in %, cut-off 0.5:

| model | bauhaus | swiss | constructivist | de_stijl | art_nouveau | cutpaper_film | penguin | pictograms | letterpress | estonian_1930s | all |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| flux-2-dev | 100 | 80 | 80 | 40 | 80 | 80 | 40 | 40 | 60 | 100 | 70 |
| flux-2-klein-4b | 80 | 40 | 80 | 80 | 80 | 60 | 20 | 40 | 80 | 80 | 64 |
| lucid-origin | 80 | 20 | 40 | 60 | 80 | 80 | 40 | 80 | 60 | 100 | 64 |
| sdxl | 60 | 20 | 100 | 80 | 40 | 60 | 40 | 60 | 60 | 80 | 60 |
| sdxl-lightning | 40 | 40 | 60 | 60 | 80 | 40 | 0 | 60 | 80 | 60 | 52 |
| flux-2-klein-9b | 80 | 20 | 60 | 40 | 60 | 80 | 60 | 40 | 20 | 40 | 50 |
| dalle-mini | 40 | 0 | 60 | 100 | 40 | 40 | 0 | 80 | 80 | 60 | 50 |
| flux-1-schnell | 40 | 20 | 60 | 20 | 20 | 60 | 40 | 60 | 60 | 60 | 44 |
| phoenix-1.0 | 40 | 0 | 40 | 60 | 20 | 20 | 40 | 60 | 40 | 40 | 36 |
| dreamshaper-8-lcm | 20 | 60 | 20 | 40 | 20 | 80 | 20 | 40 | 0 | 20 | 32 |

Lower and flatter than Estonia and Germany: the models know these styles
less well than flags and buildings, and the questions are harder to judge.

**Judge against our eye labels** (`labels-design.json`, Bauhaus, De Stijl
and the paperback, all 10 models, 150 criteria): Bauhaus 43/50 (86%), De
Stijl 45/50 (90%), paperback 38/50 (76%), 84% in all. Where it went wrong:

- No model drew the three-band paperback. Most drew an old illustrated
  hardback, some on a shelf. Clef still said yes to "Is the title in the
  middle band?" on 6 covers with no bands (0.64 to 0.90): it reads it as
  "in the middle". A question that assumes a thing exists passes without
  it; ask for the bands first, or make the later ones depend on it.
- "Flat, no shading or 3D" passed perspective halls (flux-1-schnell 0.72,
  phoenix 0.74) and DALL·E mini's painterly blobs (0.92).
- "Thick and black lines" passed thin black lines (klein 9B 0.85, sdxl
  0.70). Thickness is a judgement call for the eye too.
- It missed sdxl-lightning's grid of rectangles as "simple shapes" (0.10)
  and lucid-origin's red, black and cream as primary colours (0.40).

Other things seen:

- On the Bauhaus poster, flux-2-dev, flux-1-schnell, phoenix and lucid
  wrote "BAUHAUS" right, the klein models "BAUBIPS" and "BAUHAHS". Phoenix
  and schnell drew an exhibition hall in perspective, not a poster.
- De Stijl: klein 4B, lucid and DALL·E mini kept to horizontal and vertical
  lines; flux-2-dev, klein 9B, schnell, the SDXL pair and Dreamshaper added
  diagonals.
- Weak questions worth a look before trusting the scores: pictogram
  figures "made of straight segments" passed none, "white space" on the
  Swiss poster 1, "orange or green bands" 1.
- flux-2-klein-9b's "3043" failures again: 3 pictures needed the third
  try, 1 failed three times and was drawn on a rerun.

Cost: pictures about $0.74 (the 40 from flux-2-dev, sdxl, sdxl-lightning
and dreamshaper have no published price), judging about $0.015 for 500
calls. Published to `apps/studio/public/visuals/design/` (`aspect` 3/4);
Estonia and Germany published again for the large copies.

## Older models on the M1 (2026-11-09)

stable-diffusion.cpp (C++, Metal, no Python) on the M1, 512x512, seed 1,
`local-sd.sh`, brought in with `node run.mjs import <dir> [--set germany]`.
Weights: SD 1.4 (CompVis, `sd-v1-4.ckpt`), SD 1.5 (`v1-5-pruned-emaonly`),
Dreamshaper 8 (Lykon, `DreamShaper_8_pruned`), SD-Turbo (1 step). SD 2.1
base needs a Hugging Face login now; left out. Seconds a picture on the M1,
with loading: SD-Turbo 10, SD 1.x and Dreamshaper about 25 to 100.

| model | Estonia | Germany |
|---|---:|---:|
| SD-Turbo | 51 | 62 |
| Dreamshaper 8 (512, M1) | 49 | 60 |
| SD 1.5 | 40 | 60 |
| SD 1.4 | 40 | 52 |
| Dreamshaper 8 LCM (1024, Cloudflare) | 21 | 27 |

The same Dreamshaper at its own 512 size scores about twice what it scored
on Cloudflare at 1024: most of its low score was our size, not the model.
