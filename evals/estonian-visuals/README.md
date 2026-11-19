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
node nature.mjs commons               # nature set: real photos from Wikimedia Commons (control)
node nature.mjs judge [flash sonnet]  # nature set: "which country?" for every picture
node nature.mjs report                # nature set: generated vs real, by prompt and model
node run.mjs --set history --variant named --kind film generate nano-banana-2-lite  # filters for generate
node history.mjs commons|judge|deport|report|sheet  # history set: control photos, judge, text probe, tables, sheets
node neighbours.mjs fetch|embed|report  # where generated pictures land among real photos (local encoders)
node landmarks.mjs fetch|sheet|embed|judge|report  # Tallinn: landmark checks and same-viewpoint neighbours
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

## Nature, first run, 2026-11-16

The question for the value drift demo: ask a model for Estonian nature, and does
a strong judge place the picture in Estonia, or somewhere else in the north? Can
the same judge place real Estonian photos? `--set nature`, `tasks-nature.json`:
15 subjects (Viru-type raised bog with a boardwalk, Saaremaa alvar with
junipers, Pakri klint, Peipsi onion village, Ida-Viru ash hills, Lasnamäe,
Setomaa village, Hiiumaa lighthouse, birch forest in spring, rye with
cornflowers, Matsalu, Tallinn from Toompea, Saaremaa eyebright, juniper,
cornflower), each written as a person would ("A photo of a typical Estonian
raised bog with a wooden boardwalk.") and, for 14 of them, a neutral twin
without the country ("A photo of a raised bog with a wooden boardwalk."). 29
prompts × 5 models on the live gateway (`GATEWAY=https://gw.visualia.space
KEY_PERSON=eka-teacher`): flux-2-klein-4b, flux-3-image-klein, p-image,
nano-banana-2-lite, flux-2-dev. 145 pictures, no failures.

**Control:** 20 photos from Wikimedia Commons, at least one per subject
(`node nature.mjs commons`: search API, one request a second, 1024 px
thumbnails, metadata stripped so the judge sees pixels only). Title, author,
licence, URL, coordinates and county (OpenStreetMap Nominatim from the
coordinates) in `out/nature/real/photos.json`. 15 are geotagged; 5 good ones
have no coordinates and name the place in the title (two Saaremaa alvars, the
eyebright, Matsalu reeds, a rye field), listed in `MANUAL`. Research use only,
kept in `out/`, not published.

**Judge:** `google/gemini-3.8-flash` through Cloudflare's catalog (REST,
`ai/v1/chat/completions`, gateway `visualia`), one picture per call: country,
confidence 0 to 1, region within that country, one reason, as JSON.
`anthropic/claude-sonnet-5.5` on a fixed sample of 10 for comparison.

### Placed in Estonia

| pictures | in Estonia | placed instead |
|---|---:|---|
| real photos (Commons) | **55 %** (11/20) | Sweden 2, Germany, Poland, Ukraine, Russia, UK, Lithuania, unknown |
| generated, prompt names Estonia | **31 %** (23/75) | Russia 11, Sweden 10, unknown 6, Germany 4, Czechia 4, Ukraine 4, UK 3, 10 others |
| generated, no country in the prompt | **9 %** (6/70) | Russia 11, UK 10, Germany 7, US 7, unknown 7, Canada 4, 14 others |

Finland came up once in 145 generated pictures, Latvia never; the "north" a
model draws reads to the judge as Russia or Sweden.

| model | named | neutral |
|---|---:|---:|
| nano-banana-2-lite | 47 % (7/15) | 0 % (0/14) |
| flux-2-klein-4b | 27 % (4/15) | 7 % (1/14) |
| flux-3-image-klein | 27 % (4/15) | 7 % (1/14) |
| p-image | 27 % (4/15) | 7 % (1/14) |
| flux-2-dev | 27 % (4/15) | 21 % (3/14) |

| subject | named (of 5) | neutral (of 5) | real | where the misses went |
|---|---:|---:|---:|---|
| Peipsi onion village | 5 | 1 | 0/1 | neutral: Russia 4 ("izbas", "onion domes") |
| raised bog | 3 | 2 | 2/2 | Czechia, Slovenia, Canada, Ireland |
| Hiiumaa lighthouse | 3 | 0 | 1/1 | neutral: Canada 3, US 2 |
| Tallinn from Toompea | 3 | 0 | 2/2 | neutral: UK 2, Germany 2 |
| ash hills | 2 | 0 | 0/1 | Russia, Ukraine; the real one: Donbas |
| rye with cornflowers | 2 | 2 | 0/1 | Sweden, Germany, Poland |
| cornflower | 2 | 1 | 0/1 | unknown, Germany |
| Lasnamäe | 1 | 0 | 2/2 | Germany, Russia, Poland |
| Matsalu | 1 | 0 | 1/2 | Sweden 2, Japan, UK, US |
| eyebright | 1 | 0 | 0/1 | Sweden, Finland, Canada, Russia |
| alvar with junipers | 0 | 0 | **0/2** | Sweden (Öland, Gotland), Crimea, Vercors, Ecuador |
| Pakri klint | 0 | 0 | 1/1 | Brittany, Dover, Black Sea, Höga Kusten |
| Setomaa village | 0 | – | 1/1 | Czechia 2, Russia 2, Slovakia |
| birch forest | 0 | 0 | 0/1 | Russia 7 (and the real one) |
| juniper | 0 | 0 | 1/1 | Sweden, US, Denmark |

What gets a picture into Estonia, from the judge's reasons:

- **Words and flags painted in.** 7 of the 23 named-prompt placements cite
  them: "SIBULAAED" on onion-bed markers (flux-2-klein-4b/peipsi),
  "SIBULATALU" on a house (nano-banana-2-lite/peipsi), "Hiiumaa Tuletorn" on
  a sign (flux-2-klein-4b/lighthouse), a "Lasnamäe" district sign
  (flux-3-image-klein), "MATSALU RAHVUSPARK" (nano-banana-2-lite), an Estonian
  flag on the lantern (nano-banana-2-lite/lighthouse), a blue-black-white
  ribbon behind the cornflowers (flux-3-image-klein). The landscape itself
  doesn't carry it; the label does. 3 of Nano Banana's 7 are signs or a
  flag.
- **Landmarks.** St Olaf's and the walls for Tallinn (3 models).
- **Never the land.** No model's alvar, klint, Setomaa, birch forest or
  juniper was placed in Estonia. Setomaa came out as Czech or Slovak
  chalupas (p-image a red-roofed Alpine town); Pakri as Brittany or Dover;
  every alvar as Öland, Gotland, Crimea or the Andes.

**The judge has the same blind spot.** Real photos are placed by landmarks
and signs (Kõpu lighthouse, St Olaf's, Pikk Hermann's flag, "SETO KUNSTIQ"
over a door, and a juniper macro it says is "a well-known photograph taken in
Keila"). Real land with nothing written on it goes elsewhere: both real
Saaremaa alvars to Öland (0.85), the Kiviõli ash hill to the Donbas, Matsalu
reeds to the Curonian Lagoon, Kolkja to Poland, the birch wood to Russia.
55 % is the ceiling the measuring stick allows, not the truth about the photos.
When it did say Estonia, the county matched the coordinates for 8 of the 10
real photos it gave one for (Pakri went to Ida-Viru, the other end of the
klint; a Matsalu photo just over the Pärnu line went to Lääne), and the
expected county for every named generated one.

**Priming.** The first wording asked "region: the county (maakond), if the
country is Estonia". That one mention moved real photos to 95 % (19/20),
named prompts to 63 % and neutral prompts from 9 % to 26 % (a generic rye
field, a cornflower, a lighthouse all became Estonian). Kept in the cache as
`#primed`; the numbers above use a question that names no country. A judge
question that mentions the expected answer leans to it, as Clef did on
spelling.

**Sonnet** (10 pictures): same country as Flash on 6. Sonnet is less sure
(real Lasnamäe 0.45 to Flash's 0.98) and says "Finland, Sweden, the Baltics
and Russia all look much the same" for a birch wood Flash called unknown.
It agreed on the alvar (Gotland), sent flux-2-klein-4b's lighthouse to
Scotland (Flash: Estonia) and flux-3-image-klein's Matsalu to the Wadden Sea
(Flash: Japan). Flash said "AI-generated, not a real place" 6 times and
answered unknown; Sonnet never did.

Sheets: `out/nature/sheet-<task>.png` for alvar, klint, peipsi,
peipsi_neutral, lighthouse, lasnamae, setomaa, birch, eyebright,
old_town_neutral (order: flux-2-klein-4b, flux-2-dev, flux-3-image-klein,
nano-banana-2-lite, p-image).

**Cost:** pictures about $2.5 (flux-2-dev $0.96, flux-3-image-klein $0.26,
p-image $0.15, flux-2-klein-4b $0.03 from the gateway's prices;
nano-banana-2-lite about $1.1, estimated from $30 per M output tokens, as the
gateway records no price for it). Judging $1.26 for 340 answers (Flash about
$0.004 a picture, most of it thinking tokens; the primed run is half of it;
Sonnet about $0.035 for its 10). About $3.8 in all.

## Folk costumes, pilot, 2026-11-16

Plan: `plans/folk-costumes.md`. Research only: the rahvaroivad.ee texts and
photos, the extracted records and every generated picture stay in
`out/rahvaroivad/` (git-ignored), nothing is published, the licence is still
to ask. Muhu reference and held-out photos: Sandra Urvak (2026 set worn by
Reine Ülem-Truuts); Kihnu photos: no photographer named on the site.

```sh
node costume-extract.mjs --pairs                      # 12 women's entries -> out/rahvaroivad/extracted/<parish>-naine.json
KEY_PERSON=eka-teacher node costume-pilot.mjs generate  # out/rahvaroivad/pilot/
node costume-pilot.mjs judge                           # judge.jsonl
node costume-pilot.mjs report
```

**Extraction.** `costume-extract.mjs` sends one entry (the longest women's
entry per parish, 2,300 to 44,000 characters of Estonian) to Claude Sonnet
5.5 (`anthropic/claude-sonnet-5.5`, Cloudflare REST, gateway `visualia`). It
picks the latest fully described festive costume, lists the other variants,
and returns garments (type, colours, materials, techniques, period, museum
numbers, source sentence) and 5 to 8 yes/no criteria. All 12 parishes of the
confusable pairs done: 6 to 11 garments and 6 to 8 criteria each, and every
one of the 92 criteria's source sentences was found verbatim in the text.
One answer needed a second ask (a quotation mark broke the JSON).

**Pilot.** Muhu and Kihnu women, two pictures per cell:

- plain: "Muhu women's folk costume", flux-3-image-klein and
  nano-banana-2-lite through the live gateway.
- text: a prompt built from the extracted garments (about 1,800
  characters), the same two models.
- refs: the text prompt plus reference photos, nano-banana-2-lite by REST
  (data URLs). It takes at most 3 references. FLUX.3 klein's `images` field
  takes only http(s) URLs, not base64, so it was left out of this variant.
- real: two held-out photos per parish, never shown to the picture model.
  Muhu's are other views of the same 2026 set as its references; Kihnu had
  only the three photos of 2026-11-09 (one reference, two held out). The
  site's other Kihnu photos had not arrived yet.

The judge (Sonnet 5.5, 768 px) answered both parishes' criteria for every
picture and, in a separate call that saw no criteria, named the parish.

| parish | variant | model | own criteria % | other parish's % | judge named it |
|---|---|---|---:|---:|---:|
| Muhu | real | photo | 31 | 29 | 0/2 (Karksi, Halliste) |
| Muhu | plain | flux-3-image-klein | 0 | 29 | 0/2 |
| Muhu | plain | nano-banana-2-lite | 19 | 36 | 2/2 |
| Muhu | text | flux-3-image-klein | 31 | 50 | 2/2 (one "no confident match, closest Muhu") |
| Muhu | text | nano-banana-2-lite | 44 | 50 | 1/2 |
| Muhu | refs | nano-banana-2-lite | 31 | 21 | 1/2 |
| Kihnu | real | photo | 64 | 13 | 1/2 |
| Kihnu | plain | flux-3-image-klein | 50 | 13 | 0/2 |
| Kihnu | plain | nano-banana-2-lite | 50 | 6 | 1/2 |
| Kihnu | text | flux-3-image-klein | 86 | 13 | 2/2 |
| Kihnu | text | nano-banana-2-lite | 86 | 13 | 1/2 (the other "Setomaa, closest Kihnu") |
| Kihnu | refs | nano-banana-2-lite | 57 | 13 | 2/2 |

What it shows, by eye and by the numbers:

- **The text pulls the picture back.** Plain prompts drew the average
  "Baltic folk costume": a dark bodice over a white blouse, a red skirt, a
  white headcloth, often a thatched house. With the expert text, both models
  drew Muhu's orange striped skirt and a small embroidered cap, and Kihnu's
  red striped kört, patterned headscarf, grey jacket and blue-and-red belt.
  Kihnu's own criteria went from 50% to 86% on both models, Muhu's from 0 and
  19% to 31 and 44%. The judge named Kihnu in 1 of 4 plain pictures and 3 of
  4 text ones.
- **References copy.** nano-banana-2-lite with one Kihnu reference redrew
  the reference photo: the same room, wall and pose. The Muhu ones kept the
  forest and the burgundy apron. References give the look, but a held-out
  photo of the same set is then no longer a fair test: the next run needs
  held-out photos of another maker's reproduction.
- **The criteria describe the text, not the photos.** Text-prompted Kihnu
  pictures scored higher than the real Kihnu photos (86 against 64): the
  pictures were drawn to the text the criteria come from. Real Muhu photos
  passed only 31%: the 2026 reproduction has a burgundy damask apron, no
  cardigan, a red crown-like cap and one brooch, while the criteria ask for a
  striped apron, a black cross-stitched hem, a boat-shaped cap and two
  brooches (the text gives several variants; the extractor picked one).
  "Apron the same colour as the skirt" passed no picture and no photo in
  either parish. Criteria have to be checked on reference photos before they
  score anything.
- **Kihnu's criteria tell it apart, Muhu's don't.** Real Kihnu passed 64% of
  its own and 13% of Muhu's; real Muhu passed 31% of its own and 29% of
  Kihnu's. Kihnu's questions (striped skirt, patterned scarf) also fit the
  Muhu text pictures (50%): "striped skirt" is shared by both.
- **Can the judge tell Muhu from Kihnu?** Not reliably. On the four real
  photos it named the right parish once (a Kihnu side view, 0.6), and gave
  the two front views of Muhu to Mulgimaa (Karksi, Halliste), at confidence
  0.25. It never confused Muhu with Kihnu as its first guess on a real photo,
  but it named Muhu for both plain nano-banana pictures, which look nothing
  like the real Muhu set: it recognises the stereotype better than the
  costume. Confidence stayed at 0.2 to 0.35 except on reference copies (0.8).

Cost, about $1.9 of the $6: extraction $0.87 (148k tokens in, 57k out, at
$2 and $10 per M), judging about $0.5 (80 calls), flux-3-image-klein $0.07
(8 pictures), nano-banana-2-lite about $0.5 (12 pictures, estimated at $30
per M output tokens; the gateway records no price for it).

Next: criteria checked against the reference photos (keep those the real
set passes), held-out photos of a second reproduction per parish once the
photo fetch finishes, the other 10 parishes of the pairs, and a person who
knows the costumes to check the criteria.

## History and films, first run, 2026-11-16

How do image models draw Estonian historical events and scenes from Estonian films? Do they
substitute a neighbour, fall back on a generic Soviet or Hollywood template, or invent details?
Research only: everything is in `out/history/` (git-ignored), nothing published.

```sh
GATEWAY=https://gw.visualia.space KEY_PERSON=eka-teacher node run.mjs --set history generate flux-3-image-klein
node history.mjs commons   # 6 archival photos, 512 px, metadata stripped
node history.mjs judge     # Gemini 3.8 Flash through the gateway's /v1/chat/completions
node history.mjs deport    # the text-only deportations probe
node history.mjs report    # out/history/report.md
node history.mjs sheet     # out/history/sheet-<subject>.jpg
```

**Prompts** (`tasks-history.json`, 38): 7 events and 11 films, each with the name and as a
neutral description of the same scene without names, places or the country.

- Events: the Baltic Way (23.8.1989), the Singing Revolution at the Tallinn Song Festival
  Grounds (1988), the declaration of independence read from the Endla theatre balcony in Pärnu
  (February 1918; read in Pärnu on the 23rd, Tallinn on the 24th), the Tartu Peace Treaty
  signing (2.2.1920), 20 August 1991 at Toompea, the first song festival (Tartu, 1869), the
  Great Flight by boat to Sweden (1944).
- Films: Kevade (1969; in class, by the river, and once by its English title "Spring"), Suvi
  (1976), Nipernaadi (1983), Nukitsamees (1981, at a forest farm), Siin me oleme! (1979),
  Tõde ja õigus (2019), Viimne reliikvia (1969), Hukkunud Alpinisti hotell (1979), November
  (2017), Suur Tõll (1980, Rein Raamat). The countryside films (Kevade, Suvi, Nipernaadi,
  Nukitsamees, Siin me oleme!, Tõde ja õigus) are the focus.
- Kalevipoeg: there is no 1980s Kalevipoeg animation by Priit Pärn (a 2015 Kalevipoeg is a
  Baltic Film and Media School short by Jürgen Moor), so its prompt names one on purpose, to see
  what a model does with a film that does not exist. Suur Tõll took its place as the animation.

Each prompt also has yes/no facts (flags in the right order, Soviet-era cars, period clothes,
the arched song stage, a men-only choir in 1869, log farms, ...) and "markers" of a template
(an American flag, a hammer and sickle, a rock concert, Pixar-style 3D, a Viking helmet).

**Models**, live gateway, one picture each: `flux-3-image-klein` on all 38;
`flux-2-pro-preview` (in place of gpt-image-2, whose price the gateway can't record) and
`nano-banana-2-lite` on every film prompt and the named events. The neutral events were drawn
by klein only, to stay within the budget. 81 pictures.

**Judge:** `google/gemini-3.8-flash` through the gateway (`reasoning_effort: low`, the picture
at 512 px, no metadata), three separate calls, so the first one has no hints:

1. "What does this picture show? If a particular event or film, name it": what, country,
   place, when, confidence, reason.
2. The yes/no facts and markers, as one JSON answer.
3. Named films only: "This is meant to be a still from the Estonian film X. Is it
   recognisably a scene from it?", and whether it knows the film.

**Control:** 6 archival photos from Wikimedia Commons, judged with the same first question:
three of the Baltic Way (Jaan Künnap, 1989, CC BY-SA 4.0: `Balti kett 66`, `19`, `28`),
two of the Tartu signing (Armin Lomp, 1920, public domain: Joffe and Poska signing), one of
the 1918 declaration in Pärnu (unknown author, public domain). Metadata in
`out/history/real/photos.json`.

### Refusals

The Black Forest Labs models refused almost every named film with "2017: Content
moderation error" (502), three tries each; Nano Banana refused nothing.

| model | named film prompts drawn | refused |
|---|---:|---:|
| flux-3-image-klein | 3 of 13 (Suur Tõll, Kalevipoeg, Suvi) | 10 |
| flux-2-pro-preview | 4 of 13 (Suur Tõll, Kalevipoeg, Suvi, Nipernaadi) | 9 |
| nano-banana-2-lite | 13 of 13 | 0 |

- No neutral description of the same scene was refused, and no event was refused. The filter
  reacts to the film's title, not the content: it guards against copying a film still, as
  with the Koidula poem refused as "copyrighted" earlier today.
- **The filter is not stable.** klein drew Suvi on its third try, flux-2-pro Suur Tõll on its
  third; klein drew Nukitsamees the first time it was asked (a forest scene) and refused it
  when the prompt said "a forest farm in the Estonian countryside". A refusal is a coin flip
  weighted by the title, not a rule.
- The result is lopsided: a student asking for "Kevade" gets nothing from FLUX and a
  confident pastiche from Nano Banana.

### Events: what each model drew

With the name, the judge named the right event for 15 of 21 named-event pictures. Most of
that is text painted into the picture, as with the nature set: "MANIFEST KÕIGILE EESTI
RAHVALE" and "ENDLA TEATER" (klein, 1918), "TARTU RAHULEPING 2. VEEBRUAR 1920" with
"ДОГОВОР О МИРЕ" (klein, Nano Banana), "BALTI KETT VABA EESTI!" (Nano Banana), "EESTI
VABAKS" (flux-2-pro, 1991), "LAINE - EESTI" on the boat's side (Nano Banana, 1944),
"EESIMENE EESTI LAULU PIDU TARTUS 1869" (Nano Banana, misspelt "Eesimene"). The judge cites
the sign in its reason every time.

| event | named: judge says | neutral (klein): judge says |
|---|---|---|
| Baltic Way | Baltic Way, 3 of 3 (klein's country "unknown") | **Pan-European Picnic, Hungary/Austria 1989** (red-white-red flags) |
| Singing Revolution | Singing Revolution, 3 of 3 | **"Stebuklas", Lithuania** (a festival with many nations' flags) |
| 1918 declaration | Estonian declaration 3 of 3, but klein's "a 1989 re-enactment", flux-2-pro's "a 1930s commemoration" | **Finland: the film "1918" (1957)** |
| Tartu Peace 1920 | Tartu 2 of 3 (klein, Nano Banana: the signs); **flux-2-pro: the Porkkala handover, Finland 1956** | nothing in particular |
| 20 August 1991 | **"Singing Revolution", 3 of 3** (1988–1990); the restoration itself never named | **Gorizia-like border town, Croatia** |
| Song festival 1869 | Nano Banana right (its banner); **klein: a Moravian gathering, Germany; flux-2-pro: Sortavala song festival, Finland 1896** | nothing in particular |
| Great Flight 1944 | Great Flight, 3 of 3 | **Rescue of the Danish Jews, 1943** |

Substitutions and templates:

- **The neutral event goes to a neighbour's history.** Without the name, the same scenes
  became the Pan-European Picnic, a Lithuanian film, Finland's 1918, the Danish Jews' crossing
  to Sweden, a Croatian square. None was placed in Estonia. The scenes are drawn
  well; nothing in them is Estonian except what a prompt spells out.
- **The Baltic Way's flags:** klein and Nano Banana drew all three flags in the right order
  (fact check 8/8); flux-2-pro drew red, black and white flags and failed all three (5/8).
  Every model put Ladas and Moskviches by the road. No model made it a generic protest with
  police; Nano Banana added banners.
- **The song stage** is a symmetric shell, like the Hollywood Bowl, in the two named
  pictures that show it (flux-2-pro, Nano Banana); Tallinn's asymmetric arch is not drawn.
  Flags right on all three.
- **1918:** no American scene (no stars and stripes, 0 of 4); all four drew a northern
  winter crowd under a balcony, the right picture. klein and flux-2-pro made it look like a
  later commemoration (banners, plaques).
- **1869:** all three named pictures have women singing, flux-2-pro's and Nano Banana's in
  folk costume (by eye; the judge's folk-costume marker missed them); the first festival had
  men's choirs only (fact "only men" 0 of 3). The modern song festival is drawn
  back onto 1869. flux-2-pro added an onion-domed church.
- **Tartu 1920:** the judge saw a hammer and sickle or a red star in two of three
  (flux-2-pro, Nano Banana: a red flag beside the Estonian one); klein's delegates wear what
  look like 1940s officers' uniforms.
- **1991:** flux-2-pro and Nano Banana drew a square tower with the flag (Pikk Hermann's
  shape), klein a neo-Gothic château. No barricades in any named picture, no tanks: the
  judge reads them all as 1988–1990 rallies. 20 August looks the same as the Singing
  Revolution.

**The real photos:** 5 of 6 named right: both Tartu photos (with Joffe and Poska by name),
two Baltic Way photos (a banner, "NÕUAME SÕLTUMATUID BALTIMAID!"), Pärnu 1918 ("a
celebration"). The third Baltic Way photo, people waving from a car, went to **East
Germans crossing the border, November 1989**, 0.85. The judge recognises famous photos
and signs; a plain Estonian scene from 1989 turns German.

### Films: what each model drew

| film | named (Nano Banana): judge says | "is it that film?" | neutral: judge says (klein / flux-2-pro / Nano Banana) |
|---|---|---|---|
| Kevade, in class | Kevade ("Paunwere" on the blackboard) | yes | **The White Ribbon** (Germany) / Finland 1940s / UK 1940s |
| Kevade, English title "Spring" | nothing in particular, **Russia 1950s** (Cyrillic on the board) | yes | – |
| Kevade, by the river | **"Here's Your Life" (Troell, Sweden 1966)** | no | **The Brothers Lionheart** (Sweden) / Sweden 1940s / UK 1940s |
| Suvi | **Páni kluci (Czech, 1975)**; klein: Tõde ja õigus; flux-2-pro: "1944" (2015) | no, no, partly | **The Emigrants** (Sweden) / – / The Emigrants |
| Nipernaadi | **Kõrboja peremees** (Soviet Union 1979); flux-2-pro: **The Emigrants** (Sweden) | yes, partly | The Emigrants / Finnish war photo, Karelia / **Rasmus på luffen** (Sweden) |
| Nukitsamees | Nukitsamees | partly | **Yohan** (Norway) / – / **Astrid Lindgren** (Sweden) |
| Siin me oleme! | Siin me oleme! (its "KÜLA SAAREMAA" sign) | no | Germany ("FISCHERHÄFEN") / Sweden / **Skåne, Sweden** |
| Tõde ja õigus | Tõde ja õigus | partly | **Bastarden (Denmark)** / – / – |
| Viimne reliikvia | Viimne reliikvia | yes | **Leonardo** (Italy) / **Ever After** (France) / Italy |
| Hukkunud Alpinisti hotell | Dead Mountaineer's Hotel (sign "HUKKUNUD ALPINISTI HOTELL") | no (a chalet, not the modernist hotel) | – |
| November | nothing in particular | partly | – (all "AI-generated") |
| Suur Tõll | Suur Tõll (all three; Nano Banana wrote "SUUR TÕLL, REIN RAAMAT, 1980") | no, 3 of 3 | – |
| Kalevipoeg (no such film) | – | no, 3 of 3 | – |

"–" is "nothing in particular" with no country, mostly "an AI-generated image".

- **The countryside goes to Sweden.** Of the 18 neutral countryside pictures (Kevade by the
  river, Suvi, Nipernaadi, Nukitsamees, Siin me oleme!, Tõde ja õigus) the judge placed 9 in
  Sweden (The Emigrants three times, Lindgren, Lionheart, Rasmus på luffen, Skåne, and two
  with no film named), one each
  in the UK, Norway, Denmark, Germany and wartime Karelia, 4 nowhere; Estonia never. Of the
  11 named countryside pictures, 4 were the right film (Kevade and Siin me oleme! by a sign),
  3 were Estonia but another film (Suvi as Tõde ja õigus and as "1944", Nipernaadi as
  Kõrboja peremees), 4 went abroad (Sweden twice, Czechia, Russia). The pictures have the markers: falu-red Swedish houses (flux-2-pro's
  Nipernaadi), white Lutheran churches with a thin spire for Paunvere (every Kevade by the
  river and every Suvi; Palamuse church is a stone church with a squat tower), half-timbering
  (Nano Banana's Suvi). This is the nature set's finding again, for people and films: the
  "north" a model draws is Swedish.
- **The judge invents.** It named films with actors, confident: Mads Mikkelsen in Bastarden,
  Burghart Klaußner in The White Ribbon, Max von Sydow in The Emigrants, Lembit Ulfsak as Katku
  Villu, Uldis Pūcītis as Glebsky, at 0.9 to 0.95. Whatever a picture looks like, it finds a
  film it knows. A second-pass question ("is it that film?") was more careful: it said it knew all 11
  films, said "not the real cast, an AI image" for most, and said Priit Pärn never made a
  Kalevipoeg.
- **No generic Soviet school.** Kevade by name came out right (Nano Banana: 19th-century
  village school, black and white, no pioneers or Lenin). By its English title the same
  model gave the blackboard Cyrillic: "Spring" alone pulls it toward Russia. The neutral
  classroom moved to the 1940s (fact "19th-century peasant boys" 0 of 3) and to Germany,
  Finland, the UK.
- **Templates in the animation:** without the name, Suur Tõll became a giant on a tropical
  island against modern gunboats (klein), a Conan-like barbarian (flux-2-pro), dark fantasy
  (Nano Banana). With the name, a soft storybook giant; the judge, which knew Jüri Arrak
  designed the film, said none matched. For the film that doesn't exist, flux-2-pro drew a
  grotesque Pärn-like cartoon, Nano Banana a Viking battlefield, klein a Ghibli-style youth.
  Nukitsamees' horns became a horned helmet (klein); November's kratt became a robot or
  scarecrow in 3 of 4.

### Deportations: a text probe, no pictures

No pictures were made of the 1941 and 1949 deportations, or of any execution or atrocity.
A synthetic photo of an atrocity is the most harmful kind of synthetic history: it looks like
evidence, it travels without its prompt, it can be used to deny the real photos ("that one
is AI too") or to fake new ones, and the people in it stand for real victims and families
who are alive. The deportations are documented in archives, testimony and the real photos;
a model adds nothing to that and can only add errors. The Great Flight was drawn because it
shows people leaving, not people harmed.

Instead the judge model was asked, in English and in Estonian, what happened in June 1941
and March 1949 (`out/history/deportations.json`), and the answers checked against
Wikipedia's "June deportation" and "Operation Priboi":

- Right in both: 14 June 1941, about 10,000 people, the political, military and cultural
  elite and their families; 25–29 March 1949, Operation Priboi, about 20,700, mostly women
  (Wikipedia: 48 %) and children (29.5 %), "kulaks" and relatives of Forest Brothers, to
  force collectivisation; cattle wagons, Siberia; return from the later 1950s.
- Wrong in both: **both say the men were separated and sent to Gulag camps as a part of
  1949**. That was 1941; in 1949 families were not separated. The 1941 men's fate
  (about 60 % of deportees died, Wikipedia) becomes "most were executed", which overstates
  executions against deaths from hunger and labour.
- English only: Kirov oblast among the 1949 destinations, and Irkutsk and Tomsk left out
  (Irkutsk had the most); the Estonian answer gave Tomsk, Omsk, Novosibirsk, Irkutsk and
  Krasnoyarsk, which is right. Here the Estonian answer was the better one.
- "Over 2,500 children" in 1941 was not checked.

The text is mostly right, and the errors are the kind that matter: two events merged into
one.

### What it shows

- A name is not knowledge. Of the named pictures that were recognised, nearly all were
  recognised by a sign, a banner or a title the model painted in. Take the words away and
  every event and every film moved to a neighbour: Sweden for the countryside, Finland,
  Denmark, Germany or Austria for history.
- The refusals belong to the finding: the BFL models won't draw Estonian films by name at
  all, unsteadily; Nano Banana draws anything and labels it.
- The judge invents films and actors with high confidence. It's a good reader of signs and
  a poor witness of what a picture is. The second, named question was more honest than the
  first, open one.

Sheets: `out/history/sheet-<subject>.jpg`, a row per variant (named, english, neutral, then
real photos), columns flux-3-image-klein, flux-2-pro-preview, nano-banana-2-lite; dark
grey = refused, light grey = not drawn. Full table: `out/history/report.md`.

**Cost:** about $2.4 of the $2.50. Pictures about $1.98: flux-3-image-klein $0.27 (30),
flux-2-pro-preview $0.66 (22), nano-banana-2-lite about $1.05 (31, estimated at $30 per M
output tokens, the gateway records no price); refused calls are not charged as far as the
gateway shows. Judging $0.43 for 188 answers (about $0.0023 each at low effort); the
deportations probe $0.003.

## Folk costumes, round two, 2026-11-16

All 12 women's costumes of the confusable pairs. Same rules as the pilot: research only, every
photo, criterion and picture stays in `out/rahvaroivad/round2/` (git-ignored), nothing published,
licence still to ask. Script: `costume-round2.mjs` (its header lists the commands; the photo
split per parish is the `SETS` table in it, chosen by eye). Judges through the live gateway
(`/v1/chat/completions`, key eka-teacher), pictures through `/v1/images` with the `references`
field. Cost by the script's own count: $4.75 (Gemini 3.8 Flash $1.20, Sonnet 5.5 $0.78,
nano-banana-2-lite about $2.42 at an estimated $0.039 a picture, flux-3-image-klein $0.36).

**The photos are thin.** Most rahvaroivad.ee photos have only a full-size file, and on 4G at most
10 a parish were fetched for those (shrunk to 1024 px). Women's full-length photos on disk, by
reproduction (one garment set, all its views):

| parish | photos used | reproductions | split |
|---|---:|---|---|
| Muhu | 8 | 1 (Reine Ülem-Truuts 2026) | by view |
| Kihnu | 5 | 2 (red kört / half-red kört) | by reproduction |
| Halliste | 0 | only a summer skirt on a stand | none: no photo of a woman |
| Tarvastu | 1 | 1 (from behind, on a stand) | calibration only, no held-out |
| Emmaste | 5 | 1 (Liisa Johanna Lukk 2026) | by view |
| Kihelkonna | 5 | 1 (with and without the long coat) | by view |
| Setomaa | 2 + 2 | married woman in blue / young woman in white | by view; references from the white one |
| Räpina | 4 | 1 (with cardigan, with long coat) | by view |
| Vormsi | 7 | 1 (Veronika Isberg 2025) | by view |
| Noarootsi | 3 | 1 | by view |
| Tõstamaa | 5 + 3 | summer (Jana Tamm 2025) / winter (Anu Randmaa 2026) | by view; references from the winter one |
| Kadrina | 5 | 1 wearer, two shoots (2024; 2026 with the pottmüts) | by shoot |

So for 8 of the 11 parishes with photos, "held out" means other views of the same garments, and
the references for those 8 also come from that set. Only Kihnu, Setomaa and Tõstamaa have
references from another reproduction than the held-out photos. Halliste and Tarvastu have no
held-out ceiling at all. Räpina's photos carry no wearer tag; their title says woman.

**1. Calibrating the criteria.** Every extracted criterion was put to Gemini and Sonnet on the
calibration photos, with three answers: yes, no, hidden. A criterion that failed most of the
visible answers was looked at by eye, then rewritten to allow a variant the text names (with the
second source sentence added), loosened where the judge failed, or dropped. The files are
`round2/criteria-v2/<parish>.json`: every criterion keeps its source sentence and records `was`,
`why` and the calibration answers. Of 90 criteria, 54 kept, 18 rewritten, 18 dropped (Halliste:
one dropped by analogy, uncalibrated). The causes:

- **Variant in the text, another in the reproduction** (the main cause). Vormsi is the extreme:
  the extractor took the 20th-century costume (checked headscarf, dark blue jacket, checked shawl),
  the site's reproduction is the 19th-century one (white tanu, black pleated skirt, white apron,
  black jacket). 4 dropped, 2 rewritten as "either" (head: checked scarf or white cap; dark blue or
  black jacket). Also Muhu's apron (skirt cloth in the text, burgundy in the set), Kihelkonna's skirt
  (crosswise stripes, or the older black skirt with red hem bands, kalukad), Kadrina's cap
  (pottmüts, or the white flower-embroidered tanu), Emmaste's short apron, Noarootsi's short sleeves.
- **Outer layers** the photos don't show: Muhu's cardigan, Räpina's sõba, Noarootsi's jacket,
  Tarvastu's and Halliste's long coats: dropped.
- **Judge failure**: details too small at full length (Emmaste's buttons, Räpina's lace edge,
  the green in Noarootsi's belt), wording too exact ("leans back in an arc", "between two
  brooches", "coat-like" for the Seto sukman), Kihelkonna's tall tanu so densely embroidered it
  reads red, not white. Gemini also said no to Kadrina's flower embroidery, which Sonnet saw.
- **Hidden**: Kihnu's belt under the jacket, Tõstamaa's sash under apron and shawl: dropped.

Held-out real photos, share of criteria answered yes among those the judge could see (Gemini).
Cross = the same photos on the partner parish's criteria:

| parish | held-out | before (v1) | cross before | after (v2) | cross after |
|---|---:|---:|---:|---:|---:|
| Muhu | 4 | 56 | 29 | 95 | 33 |
| Kihnu | 2 | 75 | 17 | 73 | 33 |
| Emmaste | 3 | 57 | 13 | 71 | 5 |
| Kihelkonna | 3 | 64 | 13 | 80 | 7 |
| Setomaa | 1 | 50 | 25 | 100 | 43 |
| Räpina | 2 | 60 | 25 | 79 | 10 |
| Vormsi | 4 | 18 | 40 | 80 | 59 |
| Noarootsi | 2 | 46 | 21 | 90 | 43 |
| Tõstamaa | 3 | 81 | 45 | 83 | 44 |
| Kadrina | 3 | 40 | 14 | 73 | 17 |

The ceiling went up everywhere but Kihnu (unchanged; its held-out set is the other reproduction,
so it is the fairest number here) and stays well above the cross-rate in four pairs. Vormsi and
Noarootsi are the exception: the two costumes really are alike (black pleated skirt, white
apron, white shirt), and with the "either" questions Vormsi's criteria pass 59% of Noarootsi's
photos. Before calibration Vormsi's own photos passed fewer of its own criteria than of
Noarootsi's (18 against 40). Calibrating on the held-out set's own garments (8 parishes) flatters
the "after" column; Kihnu's 73 is the one that is not flattered.

**2. Judge test on held-out photos.** 27 photos, 10 parishes. Region from five, parish from a
closed list of the 12 plus "other", no hints. Few-shot: the same question after 2 labelled
calibration photos of each parish of the pair (1 for Noarootsi and Setomaa).

| judge | region | parish | named the pair partner |
|---|---:|---:|---:|
| Gemini 3.8 Flash, alone | 20/27 | 15/27 | 2 |
| Sonnet 5.5, alone | 11/27 | 5/27 | 3 |
| Gemini, few-shot | 23/27 | 27/27 | 0 |
| Sonnet, few-shot | 23/27 | 27/27 | 0 |

- Alone, with a closed list, Gemini does much better than in the pilot's open question: all of
  Muhu (4/4), Kihnu, Tõstamaa and Kadrina, and 2 of 3 Kihelkonna. It fails Vormsi (4/4 called
  Emmaste), Noarootsi, Räpina (Kadrina) and Setomaa (Räpina). Sonnet alone is weak: 5 of 27, and
  it names Kihelkonna for Kihnu and Muhu for Kadrina. Sonnet also costs about 4 times as much a
  call (it thinks before answering).
- **Few-shot looks perfect but is mostly matching.** For 8 parishes the examples show the same
  garments as the test photo, so 27/27 says the judge can match a set, not that it knows the
  costume. The honest case is Kihnu, examples from the red kört set, test photos from the
  half-red one: 2/2 with both judges (Sonnet had 0/2 alone). One pair, two photos: a hint, not a
  result. Few-shot did not fix the region (23/27): Kihnu and Vormsi are still put on the
  mainland or vice versa.

**3. Generation, all 12.** Two pictures per cell: plain ("<Parish> women's folk costume"),
text (prompt from the extracted garments) on flux-3-image-klein and nano-banana-2-lite, and text
plus up to 3 references on nano-banana-2-lite ("a different woman, in a different place and
pose"). gpt-image-2 and nano-banana-pro were left out for the budget. Halliste has no references.
The pilot's Muhu and Kihnu plain and text pictures were reused (same prompts). Scored with the v2
criteria (own %, Gemini) and named by Gemini alone with the closed list. Cells: klein / nano.

| parish | real held-out | plain | text | text+refs (nano) |
|---|---|---|---|---|
| Muhu | 95, named 4/4 | 20 / 50, named 0/2, 2/2 | 75 / 83, 2/2, 2/2 | 83, 2/2 |
| Kihnu | 73, 2/2 | 50 / 67, 0/2, 0/2 | 83 / 100, 2/2, 2/2 | 100, 2/2 |
| Halliste | no photo | 25 / 33, 0/2, 0/2 | 100 / 83, 1/2, 2/2 | no references |
| Tarvastu | no held-out | 50 / 50, 1/2, 0/2 | 90 / 100, 0/2, 2/2 | 100, 2/2 |
| Emmaste | 71, 1/3 | 25 / 21, 0/2, 0/2 | 79 / 71, 2/2, 0/2 | 71, 0/2 |
| Kihelkonna | 80, 2/3 | 14 / 13, 0/2, 1/2 | 63 / 63, 0/2, 0/2 | 69, 0/2 |
| Setomaa | 100, 0/1 | 20 / 30, 0/2, 1/2 | 80 / 78, 2/2, 2/2 | 70, 2/2 |
| Räpina | 79, 0/2 | 7 / 43, 0/2, 0/2 | 71 / 86, 0/2, 2/2 | 50, 0/2 |
| Vormsi | 80, 0/4 | 0 / 38, 0/2, 1/2 | 75 / 75, 0/2, 1/2 | 75, 1/2 |
| Noarootsi | 90, 0/2 | 0 / 42, 0/2, 0/2 | 92 / 92, 0/2, 0/2 | 92, 0/2 |
| Tõstamaa | 83, 3/3 | 0 / 17, 0/2, 1/2 | 75 / 75, 0/2, 2/2 | 75, 1/2 |
| Kadrina | 73, 3/3 | 25 / 18, 0/2, 0/2 | 83 / 83, 0/2, 0/2 | 75, 2/2 |

Pair separation (partner's criteria on the same pictures) is in `node costume-round2.mjs report`;
it mostly stays at 0 to 36% for text pictures, except Noarootsi (75% of Vormsi's criteria on nano
text and refs pictures: the pair that the criteria cannot split).

What it shows:

- **The text pulls every parish back.** Plain prompts pass 0 to 50% of the criteria (average
  about 27%), text prompts 63 to 100% (about 81%), on both models, in all 12 parishes. Plain
  pictures are the average: flux-3-image-klein in particular draws a generic "folk dress" (0% for
  Vormsi, Noarootsi, Tõstamaa) and the judge names the right parish for 7 of 48 plain pictures,
  against 24 of 48 text ones (refs: 12 of 22).
- **Text pictures beat the real ceiling on the criteria.** Text pictures reach or pass the real
  photos in several parishes (Kihnu 100 against 73, Halliste and Tarvastu 100 with no photo to
  compare, Noarootsi 92 against 90): the pictures are drawn to the text the criteria come from.
  Passing the criteria is necessary, not sufficient; the parish guess and an expert are the
  other half.
- **References add little on top of the text, and no longer copy.** With "a different woman, in a
  different place and pose" nano-banana-2-lite drew new scenes, not the reference room (round
  one's problem), keeping the garments. Scores are about the same as text alone (refs 50 to 100,
  same or 1 to 2 criteria lower), but the judge names the parish more often for Kadrina (0/2 text,
  2/2 refs). Where the references are another variant (Tõstamaa's winter coat, Seto's white
  dress), the text won: the pictures show the summer costume and the dark sukman, not the coat or
  the white dress.
- **The identifying judge has blind spots that the pictures inherit.** Vormsi, Noarootsi,
  Emmaste and Räpina are hard to name on real photos too (0 to 1 of 2 to 4); Kihelkonna text
  pictures are taken for Tõstamaa (red striped skirt, tall white cap). The judge's "parish named"
  is a check against the stereotype, not a ground truth.

Next: more reproductions per parish (the full-size photos, once on a fixed line), so held-out and
references are always another set; a Halliste photo of a woman; a second extraction per variant
(Vormsi's older costume) instead of "either" questions; and a person who knows the costumes to
read `criteria-v2/`.

## Neighbours, 2026-11-16

Where did a generated picture drift, measured without a judge: its nearest
neighbours among real photos of the same kind of place, in Estonia and in the
countries it could be mistaken for. `neighbours.mjs`, everything in
`out/neighbours/` (report.md with every table, summary.json, maps). No model
credits.

```sh
node neighbours.mjs fetch klint peipsi costume alvar setomaa  # Commons, 1 request a second, 512 px
node neighbours.mjs exclude <id> ...                          # photos checked by hand on contact sheets
node neighbours.mjs embed                                     # both encoders, cached
node neighbours.mjs report
```

**Encoders.** DINOv2 small (`onnx-community/dinov2-small`, CLS token) and
SigLIP base (`Xenova/siglip-base-patch16-224`, image tower), in Node with
transformers.js 4.3.2. It is installed in `neighbours/`, a package of its
own outside the root workspaces. onnxruntime-node's binary is refused on
this machine (`mmap` EPERM on `libonnxruntime.1.dylib`), so
`neighbours/package.json` overrides it with onnxruntime-web, and the models
run as WebAssembly (4 threads, about 0.1 s and 0.2 s a picture).

**References.** Wikimedia Commons, by category and search: 25 a country
fetched, then checked by hand on contact sheets. 482 were dropped as not the
subject: maps, paintings, portraits, people named Alvar, waterfalls, a
mushroom, single garments, black-and-white archive photos. Kept (title,
author, licence, URL, coordinates in `refs/refs.json`):

| subject | Estonia | others |
|---|---:|---|
| klint | 25 + 1 control | England 19 (Dover, Seven Sisters, Beachy Head), France 19 (Étretat), Ireland 25 (Moher), Sweden 15 (raukar, cliffs), Finland 17, Latvia 18 (Jūrkalne and others); Russia 4, left out |
| Peipsi village | 25 + 1 | Russia 19 (Pskov oblast), Finland 16 (Saimaa), Latvia 23 (Lubāns, Latgale), Poland 24 (Podlasie), Belarus 24 |
| alvar | 13 | Sweden 20 (Öland, Gotland), Ireland 22 (Burren, no dolmens) |
| Setomaa village | 15 + 1 | Russia 21 (Pechory, Pskov), Latvia 17 (Latgale), Czechia 21 (Holašovice), Slovakia 21 (Vlkolínec, Čičmany) |
| costume | 22 Commons + 375 rahvaroivad.ee | Latvia 16, Finland 20, Ukraine 12, Poland 11, Belarus 12, Russia 13 (people or mannequins in full costume, in colour) |

The rahvaroivad.ee photos are the full-figure ones already on disk (portrait
format, parish and wearer tagged), plus the 33 of 2026-11-09. Russian Baltic
klint photos on Commons are almost all forest and lakes around Sablino and
Lopukhinka. Bog and the ash hills were not fetched (4G).

**Method.** k = 10 nearest references by cosine, each country capped at the
size of the smallest set (at least 15), so a big set doesn't win by number.
Control: a third of each country's photos held out by photographer (by
costume set for rahvaroivad.ee), voted against the rest. Drift arrow: the
mean generated embedding minus the mean real Estonian one, projected on the
direction from Estonia to each country (0 = Estonia's mean, 1 = that
country's mean). Maps: PCA, `map-<subject>-<encoder>.png`.

### Control first

| subject | Estonian held-out photos voted Estonia, DINOv2 / SigLIP | does it separate? |
|---|---|---|
| klint | 10/12 / **12/12** | yes, but Estonia also pulls in Latvian and Finnish coasts: of the photos voted Estonia, 48 % / 44 % are Estonian |
| Setomaa | 2/6 / 4/6 | weakly (Czech and Slovak photos are told apart, 7/7 and 6/7) |
| Peipsi | 3/11 / 3/11 | **no**: Estonian, Latvian and Russian villages mix |
| alvar | 0/7 / 0/7 | **no**: Estonian alvars land on Öland and the Burren (the judge did the same) |
| costume, rahvaroivad.ee | 123/130 / 129/130 | it matches the site's photos, not Estonia: Commons photos of Estonian costumes 2/8 / 0/8 |
| costume, Commons only | 1/8 / 2/8 | **no** |

So the method can say where the klint drifted, can hint for Setomaa, and
can't say anything about Peipsi, alvar, or costumes at the country level
from photos in the wild. The judge's 55 % on real photos was the same kind of
ceiling: these two encoders see the kind of place, and an Estonian village or
alvar is the same kind of place as its neighbours.

### Where the pictures landed

**Pakri klint: not in Estonia.** None of the 10 klint pictures (5 models,
named and neutral) has Estonia as its first vote, in either encoder, although
the vote leans to Estonia on real photos. Encoders agree on 7 of 10.

| prompt | neighbours (DINOv2): England / France / Ireland / Estonia / Sweden / Finland / Latvia | arrow to France, England, Ireland (DINOv2 / SigLIP) |
|---|---|---|
| names Pakri, Estonia | 22 / 14 / 34 / 14 / 4 / 10 / 2 % | 0.76 / 0.56, 0.53 / 0.44, 0.41 / 0.43 |
| no country | 32 / 24 / 34 / 8 / 0 / 2 / 0 % | 0.84 / 0.80, 0.67 / 0.70, 0.45 / 0.54 |

By model: flux-3-image-klein and nano-banana-2-lite drew the Cliffs of Moher
(Ireland 8 to 10 of 10 neighbours), flux-2-dev and flux-2-klein-4b mostly
Dover and Étretat. Only p-image's named klint went north (Finland and Sweden, both
encoders). Naming Estonia moves the picture a little: SigLIP's arrow toward
Sweden and Finland is 0.5 named, and Estonia's share of neighbours goes from
8 to 14 % (DINOv2). It is still a tall chalk or sandstone sea cliff, not a
low limestone step under forest.

**Setomaa: Czech and Slovak.** 0 of 5 voted Estonia in either encoder.
DINOv2 puts 4 of 5 with Slovakia (Vlkolínec, Čičmany: 54 % of neighbours),
SigLIP 3 of 5 with Czechia (Holašovice: 48 %); both agree it is the central
European village with white walls and red roofs the judge saw too. The
control is weak (2 and 4 of 6), so read it as a direction, not a number.

**Peipsi: can't say.** The control fails. The pictures' neighbours are
mostly Belarusian and Polish wooden houses (DINOv2 34 % named, 50 % neutral),
but Estonian Peipsi photos land there too.

**Alvar: can't say.** Every alvar picture is nearest Estonian photos (5/5),
but no held-out Estonian alvar photo is: 13 Estonian photos are too few to
stand for a place.

**Costumes: style, then parish.** Against Commons only, the pilot and the
2026-11-09 "Muhu costume" pictures spread over every country (SigLIP: 0 of
35 voted Estonia; Russia 34 to 46 % of the pilot's neighbours), and so do the
real Estonian ones. With the rahvaroivad.ee photos in, the expert-text and
reference pictures land with them (text 7/8 and 8/8, refs 2/4 and 4/4),
plain prompts less (2/8 DINOv2, 6/8 SigLIP), the 15 older models of
2026-11-09 least (5/15 and 4/15, arrows 0.35 to 0.5 toward every other
country). Within Estonia, the share of Muhu photos among the 10 nearest
Estonian photos (Muhu is 5 % of them): plain 0 % and 12 %, text 20 % and
33 %, refs 50 % and 55 % (copies of the references, see the pilot),
2026-11-09 12 % and 13 %. Kihnu has 3 photos on disk: only the reference
copies find them (4 of 20). The text moves a costume toward its parish; a
plain prompt does not.

**Encoders agree** on the first country for 7/10 klint, 2/5 Setomaa, 4/10
Peipsi and 18/35 costume pictures (8/35 against Commons only): they agree
where the control works and not where it fails.

Next: Mapillary or geotagged street photos for the villages (the same
framing in every country), Estonian alvar and bog photos by hand, a costume
set of festival photos from Estonia to match the other countries', and the
Russian Baltic klint from somewhere other than Commons.

## Local models, 2026-11-16

The course's point: the same work done on a computer in the room, and counted.
`local-nature.mjs`, on the work Mac (M2 Pro, 32 GB). Energy is measured the
way the pool measures it: macmon, 4 samples a second; chip = CPU + GPU + ANE +
memory power summed over the job, net = minus the chip's idle baseline,
whole Mac = macmon's system power. One heavy run at a time; each job waits
until the chip is under 72 °C, and a run stops above 85 °C (it did once,
at 86 °C, while another job was running on the Mac; resumed later).

**Pictures: not made.** stable-diffusion.cpp's `sd-cli` is killed on start
(exit 137, no output, even `--version` prints nothing) on 2026-11-16:
ThreatLocker is running again and blocks the binary that ran on 2026-11-09.
No other image runtime was set up around it. `local-nature.mjs draw
flux-2-klein-4b-local | sd-turbo-local` is ready for when the binary is
allowed again (or for the M1, with `SD` pointed at its build).

**Judge: Gemma 4 26B through Ollama**, the same question as `nature.mjs`
word for word (no country named), on the same 1024 px copies Flash saw,
`think: false`, temperature 0. Asked about the 20 real photos and the cloud
pictures of flux-2-klein-4b, nano-banana-2-lite and flux-2-dev (87; 5 of
flux-3-image-klein from a run cut short by the heat rule). 111 answers, one
unparseable JSON (flux-2-klein-4b/alvar_neutral, not retried).

| pictures | judge | named | neutral |
|---|---|---:|---:|
| real photos | Flash | **55 %** (11/20) | |
| real photos | Gemma, here | **15 %** (3/20) | |
| flux-2-klein-4b | Flash / Gemma | 27 % / 7 % | 7 % / 0 % |
| nano-banana-2-lite | Flash / Gemma | 47 % / 27 % | 0 % / 0 % |
| flux-2-dev | Flash / Gemma | 27 % / 13 % | 21 % / 0 % |

**Gemma mostly won't guess:** "unknown" for 62 of 111 pictures, 15 of the 20
real photos. It placed only Kõpu lighthouse (Saaremaa, the wrong island) and
both Toompea views (one in Narva). Real Lasnamäe went to Lithuania, Setomaa
to Latvia.

| Gemma vs Flash, same pictures | same country | same in or out of Estonia |
|---|---:|---:|
| real photos | 4/20 | 12/20 |
| cloud pictures | 33/91 | 77/91 |
| all | 37/111 | 89/111 |

Most of the disagreement is Flash naming a country and Gemma saying unknown
(Estonia → unknown 15, Russia, Germany, Sweden → unknown 19). Only one
picture is Estonian to Gemma and not to Flash: nano-banana-2-lite's alvar
(Flash: Sweden). When Gemma does name a country it keeps the same northern
drift: klein's Pakri cliff to Norway (Flash: Brittany), its bog to Finland,
nano-banana's Peipsi village to Russia. So the local judge agrees with Flash
that the pictures are mostly not Estonia, but it is a weaker measuring stick:
the 55 % ceiling on real photos drops to 15 %.

**Counted:**

| job, this Mac | n | s each (median) | chip J each (mean) | net J | whole Mac J | all |
|---|---:|---:|---:|---:|---:|---:|
| answer, Gemma 4 26B | 111 | 4.8 | 129 | 123 | 208 | 4.0 Wh chip |
| answer, Gemini Flash (rented data centre) | 165 | 7.7 (round trip) | not known | | | about $0.004 each |

About 130 J is 0.036 Wh: 111 answers took about 6.4 Wh for the whole Mac,
under a tenth of a cent of electricity. Loading the model once took 8.5 s.
The idle baseline moved between 1 and 9 W as the Mac cooled from other work,
so the net figure is rougher than the chip figure.

Slides: `out/drift-room/slides.html` has a second section, "Judged here"
(slide 181 on, 64 pictures: the 20 real photos and every cloud picture Gemma
named a country for), each with Gemma's answer, its seconds and joules, and
Flash's answer beside it; `node places.mjs` writes them as `here:<file>`
entries. Screenshots: `out/drift-room/local-slide-{181,186,205}.png`
(`node shot.mjs <dir> <slide n ...>`).

## Tallinn landmarks, 2026-11-16

Does a picture of Tallinn show Tallinn's landmarks, or a plausible old town? Three subjects: the
old town seen from Toompea (nature set `old_town`, `old_town_neutral`, 5 models), the Town Hall
(Estonia set `raekoda`, 15 models of 2026-11-09) and Toompea Castle (history set
`restoration_1991`, 3 named + 1 neutral). `landmarks.mjs`; photos, cache and `report.md` in
`out/landmarks/`, per-picture data for the drift room in `out/drift-room/landmarks.json`. Research
use only, nothing published.

**Checks.** 8, 8 and 6 yes/no questions, each written from a source quoted in the script (and in
`landmarks.json` under `checks`): St Olaf's spire, 123.8 m, rising above every other tower; a
Baroque galleried spire (St Nicholas, 105 m); the Town Hall tower among the houses; wall towers
with conical roofs; red roofs; the sea and port behind; looking down from a hill; high-rises
beyond (Wikipedia; visittallinn.ee for Kohtuotsa; a Patkuli guide). Town Hall: grey limestone,
ground-floor arcade, octagonal tower at one end, slender spire, Old Thomas on top, battlements,
dragon-head spouts, on the square (Wikipedia, Tallinn Town Hall). Toompea: a tall tower over the
castle wall, a flag on it, blue-black-white, the pink Baroque palace, walls on a slope, onion
domes (Wikipedia; Lonely Planet for the pink). Gemini 3.8 Flash through the live gateway, one
question a call (`reasoning_effort: low`), answer plus confidence; `prob` is the probability of
yes. Then one open question: "Which real landmarks can you identify by name? Which look
invented?" 701 calls, $1.25.

**Real photos.** Wikimedia Commons, by category, at most 5 a photographer, checked by hand on
contact sheets (76 dropped: night, interiors, building sites, close-ups, postcards). Tallinn:
30 from Kohtuotsa and Patkuli, 30 of the Town Hall, 10 of Toompea Castle. Confusers, 10 a town
for each subject: Riga (St Peter's spire; Town Hall, Blackheads), Gdańsk (St Mary's tower; Main
Town Hall), Lübeck (St Petri tower; Rathaus, 9), Stockholm (Monteliusvägen; City Hall), Prague
(from the Castle; Old Town Hall). Title, author, licence and URL in `refs/refs.json`. A third of
Tallinn's photos held out by photographer as the control.

**Neighbours.** DINOv2 small + SigLIP base as in Neighbours, k = 10, towns capped at the smallest
reference set (Tallinn's surplus rotated over 5 draws), the two encoders averaged. Control: held-out
Tallinn photos land on Tallinn 12/12 (skyline, mean share 0.61) and 10/10 (Town Hall, 0.66);
other towns, leave one out, land on themselves 40/50 and 47/49, on Tallinn 3 and 2. Chance is 0.17.

| | checks passed, real Tallinn | other towns | generated, named | generated, neutral | nearest town of generated |
|---|---:|---:|---:|---:|---|
| old town from Toompea | 64 % (12) | 39 % (10) | 60 % (5) | 33 % (5) | Tallinn 7 of 10, Lübeck 2, Prague 1 |
| Town Hall | 78 % (10) | 22 % (10) | 30 % (15) | – | Tallinn 6, Gdańsk 5, Lübeck 2, Prague 2 |
| Toompea | 35 % (10) | – | 39 % (3) | 17 % (1) | not run |

What it shows:

- **No generated Town Hall is the Town Hall.** 30 % of the checks, nearer the other towns' town
  halls (22 %) than the real one (78 %). Not one of 15 has the dragon spouts, one (sdxl) the
  arcade, two the battlements; nearly all have "a tall slender spire" (93 %), which half the
  other town halls pass too. The open question names Wrocław for flux-1-schnell, Mühlhausen for
  flux-2-dev, Riga for sd-1.4, and Tallinn for three (sd-1.5, sdxl, sdxl-lightning) by St
  Nicholas's spire, never by the Town Hall. The best on the checks, flux-2-klein-4b (5/8), is
  "a neo-Gothic town hall ... with a knight weather vane", invented, and its nearest real photos
  are Prague's.
- **The old town passes on the generic checks.** p-image and nano-banana-2-lite (named) are
  identified as Tallinn with St Olaf's, the walls and Patkuli by name, and land among Tallinn
  photos (0.58, 0.60). flux-2-dev was placed in Harju at 0.99 by the nature judge, passes 5/8,
  and its nearest photos are Tallinn's (0.48), but the open question names no landmark ("the
  entire cityscape is AI-generated") and it fails St Olaf's spire. flux-2-klein-4b named: Germany
  0.95 earlier, 3/8, neighbours Lübeck 0.50. Wall towers are the sharpest check (real Tallinn
  67 %, other towns 0, generated 10 %); high-rises are useless (other towns 80 %, Tallinn 17 %:
  the platforms' trees and framing hide the centre).
- **The neighbours partly measure the viewpoint.** 4 of 5 neutral skylines (no country in the
  prompt) land nearest Tallinn too: Tallinn's photos are from a low hill with trees in front,
  most confusers from church towers looking straight down. Read the skyline shares as "looks
  like a view from Toompea", not as "is Tallinn"; Stockholm (also a hillside) is the fair
  comparison and draws almost nothing. The Town Hall photos are all from the square, so there the
  shares mean more.
- **Toompea checks don't fit the photos.** Commons photos of Toompea Castle face the pink palace
  on Lossi plats (pink 70 %, the tower 20 %); the generated 1991 pictures show the tower with a
  flag and no palace (tower 100 %, pink 0). A check list per viewpoint, not per place, is needed.
  The flag check passes on the palace's roof flag. Only nano-banana-2-lite drew the blue-black-white
  on the tower; the judge notes it is square, where Pikk Hermann is round.


## Folk costumes, drift measured (2026-11-16)

The question: prove drift with national costumes. Drift is measured as distance from the real
costume: the share of a parish's checks a picture passes. The checks come from the parish's
expert text on rahvaroivad.ee and are calibrated on real photos. Research only. Every photo,
check and picture stays in `out/rahvaroivad/drift/` (git-ignored); nothing is published.
Scripts: `costume-drift.mjs` (its header lists the steps) and `costume-drift-chart.mjs`. The
chart is `out/drift-room/costume-drift.png`; detail per parish is in
`out/rahvaroivad/drift/drift.json`. Judge and extractor: Gemini 3.8 Flash through the live
gateway. Cost: $4.72 by the script's own count.

**Headline.** With a plain prompt ("<Parish> women's folk costume, full figure"), the seven
cloud models drew 0 to 26 % of the real costume, about 17 % on average. Real held-out photos of
the same parishes pass 90 %. The same models, given the expert text, reach 85 to 88 %. Across
three years of models the gap barely closes: 14 % for FLUX.1 schnell (2024), 22 to 26 % for the
2026 models. FLUX.2 klein 4B drew nothing of any of the seven parishes (0 %).

| model (by year) | parishes | plain prompt | range | expert text |
|---|---:|---:|---|---:|
| SD-Turbo, local M1 (2023) | 1 (Setomaa) | 60 | | |
| FLUX.1 schnell (2024) | 7 | 14 | 0–50 | |
| FLUX.2 klein 4B (2025) | 7 | 0 | 0–0 | |
| FLUX.2 dev (2025) | 7 | 16 | 0–60 | 85 |
| P-Image (2025) | 7 | 19 | 0–60 | |
| Nano Banana Pro (2026) | 7 | 26 | 0–80 | |
| Nano Banana 2 Lite (2026) | 7 | 24 | 0–50 | 88 |
| GPT Image 2 (2026) | 7 | 22 | 0–80 | |
| **real photos, held out** | 7 | **90** | 80–100 | |

One picture per model and parish, so a cell is 4 to 6 yes/no answers: read the means, not one
parish. Paistu and Reigi got 0 % from every model with the plain prompt, and 75 to 100 % with
the text. Setomaa is the one parish the models know (40 to 80 %). The only local picture that
fits a usable parish is SD-Turbo's Setomaa (60 %). ChilloutMix and SD 1.5 have none, so the
local models are not on the main line.

**Method.**

1. *Photos.* All 4,170 photos, women only, full figure. Left out: detail shots, men, girls,
   brides, and photos tagged with another parish. 96 files are HTML error pages and were skipped.
   Photos are grouped into reproductions by the maker's name in the file name, else by title and
   caption. Then each split was checked by eye on contact sheets (`drift/sheets/`). That check
   dropped crops, a bride's set, a shoe close-up and one photo of the same set (Setomaa). It also
   moved calibration off coat-only sets (Kihnu, Karja, Kodavere, Jõelähtme). One reproduction
   calibrates; the others are held out and only ever shown to the judge.
2. *Checks.* For 48 parishes Gemini read the longest women's entry. The extractor was told which
   variants the photos show and how many reproductions each has, and kept to that variant. It
   wrote 7 to 8 checks, each quoting its sentence (3 of 352 quotes were not found verbatim).
3. *Calibration* on the calibration reproduction (yes / no / hidden). A check that failed was
   rewritten, by Gemini seeing the photos and the text, to a variant the text also names (with
   the second sentence quoted), or loosened, or dropped. Rewrites that still failed were dropped.
   Checks hidden on every calibration photo were dropped too.
4. *Telling neighbours apart.* Each parish has 3 confusables: parishes of the same region whose
   checks share the most words. Its checks were put to its neighbours' *calibration* photos. The
   checks that passed them most often were dropped, keeping at least 4. Before this step only 6
   rulers separated; most checks described what the whole region wears (white apron, striped
   skirt, white cap).
5. *Ruler validity* on the held-out reproductions, with own and confusables' checks mixed and
   shuffled in one question list. A ruler is kept when its own checks pass 70 % or more and the
   confusables' checks pass 45 % or less.
6. *Generation and judging.* The plain prompt on 7 cloud models, 1 picture each, 768×1024. The
   expert text (the prompt round two used) on 2 models. Each picture went through the same mixed
   question list as the held-out photos.

**Which parishes count.** 39 parishes got calibrated checks; 7 rulers separate:

| parish | checks | held-out own % | confusables % |
|---|---:|---:|---:|
| Äksi | 4 | 88 (7/8) | 38 |
| Jämaja | 4 | 100 (8/8) | 20 |
| Kärla | 4 | 100 (3/3) | 0 |
| Paistu | 6 | 83 (10/12) | 8 |
| Reigi | 4 | 80 (4/5) | 15 |
| Setomaa | 5 | 80 (8/10) | 26 |
| Tori | 4 | 96 (23/24) | 27 |

- *Ruler too weak* (28): own below 70 % (Halliste, Helme, Jõelähtme, Jüri, Kanepi, Kursi, Muhu,
  Püha, Pühalepa, Rapla, Suure-Jaani, Torma, Tõstamaa). Usually the held-out set is another cut
  or is under a coat. Or the confusables pass above 45 % (Emmaste, Harju-Jaani, Jõhvi, Kaarma,
  Kadrina, Karja, Laiuse, Otepää, Rakvere, Saarde, Tartu-Maarja, Väike-Maarja, Vaivara, Valjala,
  Viljandi). In North Estonia (Kadrina, Rakvere, Väike-Maarja, Jõhvi) neighbours pass 90 to
  100 % of each other's checks: on photos the costumes differ less than the texts do.
- *Fewer than 4 checks survived calibration:* Kihnu, Kodavere, Pärnu, Vormsi.
- *Left out before checks.* No women's entry: Alutaguse, Kambja, Karula, Nõo, Risti, Võnnu.
  Under 4 usable photos: 38 parishes, among them Kihelkonna, Tarvastu, Mustjala and Lihula.
  A single reproduction, or a single one of the variant: 26 parishes, among them Noarootsi,
  Räpina, Karksi and Ambla. Ruhnu was left out because its held-out photos are the everyday
  costume. Vändra was left out because its calibration photos are fur-coat close-ups.

**Limits.** The judge is one model. Rulers are short (4 to 6 checks) and held-out sets small
(2 to 6 photos), so a parish's ceiling moves by 10 to 20 points with one answer. The expert-text
pictures are drawn from the text the checks come from, so their 85 to 88 % is a "can do it when
told" reference, not proof of a faithful costume. An expert still has to read `drift/checks/`.

**Slide line.** Asked plainly for a parish's folk costume, today's image models draw about a
fifth of it (17 %, at most 26 %); the real costume scores 90 %, and the expert text brings the
models back to 85–88 %.

## Song Festival Grounds, 2026-11-17

Asked: *"work with tallinn lauluväljak. generate all models by image, 3d them, apply estonian hymn / ernesaks"*.
`lauluvaljak.mjs` (usage at the top), live gateway, `KEY_PERSON=eka-teacher`. Every image model the gateway lists
drew two prompts at 1024²: **named** "Tallinn Song Festival Grounds, Estonia, the song festival with the crowd,
photo" and **neutral**, the same words without Tallinn and Estonia. Pictures, `runs.json` and the contact sheet
`sheet.jpg` in `out/lauluvaljak/` (git-ignored). Four real photos from Commons in `real/` with author and licence in
`photos.json` (Metsavend CC BY-SA 2.5, Ivo Kruusamägi CC BY-SA 4.0, Dennis G. Jarvis CC BY-SA 2.0, Diego Delso
CC BY-SA 3.0; the first three from the festivals or with the fire tower). Picked by eye; four others dropped (snow,
an empty slope, graffiti, the 1928 stage).

**38 pictures, 19 models, none failed.** `pool/chilloutmix` answered 503 (no pool computer online). Cost: $0.84
recorded by the gateway, plus about $0.28 estimated for the four pictures it records no price for (Recraft,
Nano Banana 2 lite, GPT Image 2): **about $1.12**.

What came back, by eye (the shell: Alar Kotli's 1960 concave arch leaning over the choir stands; the fire tower: a
square concrete shaft with a bowl; the crowd on the slope):

| Model | Named | Neutral |
| --- | --- | --- |
| nano-banana-pro | the shell, choir, flags, crowd: right | **the shell again**, at dusk, Estonian flags, Old Town behind |
| nano-banana-2-lite | the shell, "XXVII EESTI LAULUPIDU" banner; the fire tower as a round stone tower, St Olaf's spire put behind it | **the shell**, "XXVII laulupidu" banner |
| gpt-image-2 | the shell and the crowd right; a TV-tower mast for the fire tower | a Eurovision stage |
| grok-imagine-image-quality | a cantilevered concrete wedge of the shell, "LAULUPIDU 150" | a flat stage labelled "LAULUVÄLJAK" |
| qwen-image-3.0-pro | a symmetric half-dome, singers in folk costume in front, a TV tower | a rock festival ("AURORA MUSIC FESTIVAL") |
| flux-2-pro-preview | a white tent dome, **blue-and-yellow flags** | a rock festival at sunset |
| seedream-5-pro | a flat concrete stage, a large crowd | a rock stage |
| flux-3-image-klein | a neo-classical palace with flags in rows | a pop stage with a "SONG FESTIVAL" sign |
| recraft, p-image, klein 4B/9B, flux-2-dev, schnell, phoenix, lucid | rock and pop stages; klein 4B a wooden barn stage with a "Laulppidu Tallinnn 2024" sign; p-image a church; lucid a red castle | festivals, a folk circle on grass (p-image) |
| sdxl, sdxl-lightning, dreamshaper-8-lcm | a crowd and tents; stage lights in the dark | the same |

So the shell is known to the two Nano Banana models, GPT Image 2 and (partly) Grok, and to nobody else. The Nano
Banana pair draw it even unasked: "song festival" alone is Estonian to them, which is the opposite of the nature
set, where the plain prompts lost the country. The fire tower is never right: a stone tower, a TV mast, or missing.

**Room:** `node lauluvaljak.mjs depth` crops every picture to its middle square (1024 px JPEG) and takes depth with
Depth Anything V2 small (q8, WebAssembly, about 1.3 s each) into `out/drift-room/lauluvaljak/`, with
`scenes.json`. `out/drift-room/lauluvaljak.html` is a copy of `room.html` (the mesh, the dissolves, the camera
moves; no map, no nature sounds) in waves: the photos, the old models, the cheap ones, the strong ones that drifted,
the shell (Nano Banana Pro last), and back. Music from `research/music-drift/out` through `out/sounds-research`,
each clip at about −20 LUFS: under the photos `fin-anthem-plain` (the whole first verse, rõõm kept), under the shell
`el-ernesaks-1` (Koidula's words heard right), under the drifted waves the clips that lost the words
(`el-anthem-1`/`-2`, `el-ernesaks-2`, `mm-anthem-lyrics` from 0:41, `mm-ernesaks-lyrics`), two scenes each. No music
was generated. Serve `out/` on 8123 and open `http://127.0.0.1:8123/drift-room/lauluvaljak.html`; checked in Chrome
(Playwright), no console errors, music plays: `out/drift-room/lauluvaljak-shot-*.png`.

### Where the judge put it (2026-11-17)

`node lauluvaljak.mjs judge`: the nature set's question word for word ("Which country was this photo most likely
taken in? …", country, confidence, region, reason) to Gemini 3.8 Flash through the live gateway, on the square crop
the room shows (768 px, no metadata); cached in `out/lauluvaljak/judge.jsonl`, answers and a score in
`out/lauluvaljak/places.json`. 42 calls (38 generated, the 4 photos as a control), none failed, **$0.15**.

| | Placed in Estonia | of which Harju/Tallinn | Elsewhere |
| --- | --- | --- | --- |
| Real photos | 3/4 | 3 | Diego Delso's close view of the shell: **Lithuania**, "the song festival amphitheater in Vingis Park, Vilnius", 0.95 |
| Named | 11/19 | 8 | Germany 1, Sweden 1, Denmark 1, Russia 1, Lithuania 1 (flux-2-pro), Latvia 1 (seedream, "Riga", 0.95), can't tell 2 |
| Plain (no place) | 4/19 | 3 | UK 2, Germany 1, Czechia 1, Australia 1, Ireland 1, Spain 1, Argentina 1 (gpt-image-2), can't tell 7 |

- **The judge reads the writing, not the building.** Of the 15 generated pictures placed in Estonia, 11 give a
  sign, banner or flag as the reason ("the foreground sign references 'Laulppidu Talllnnn'", klein 4B, 0.95;
  "the large stage screen prominently displays the city name 'TALLINN'", klein 9B). Only gpt-image-2 and
  nano-banana-pro (named) are placed by "the distinctive acoustic shell". Several rock stages count as Estonia
  because the model wrote the name on them.
- **Plain prompts lose the country** as in the nature set (4/19 against 11/19), except where the model draws Estonia
  unasked: both Nano Banana models and Grok (it wrote "LAULUVÄLJAK" on the stage). p-image's plain picture was read as
  Seto Kingdom Day in Võru County, 0.92.
- **The control is not perfect either:** a real photo of the shell alone went to Vilnius.

**The room's order** (asked 2026-11-17, worst first): score = the judge's confidence when it says Estonia (+0.5 when
it names Tallinn or Harju), minus its confidence when it says elsewhere, 0 for "can't tell", plus the by-eye shell
check (up to 0.5). From flux-1-schnell's rock stage ("Thuringia, Germany, sure") to nano-banana-pro's shell, last.
The real photos are no longer shown. The caption gives the model, named or plain, the judge's answer, and what is
playing ("♪ Mu isamaa on minu arm, Koidula's words, made by ElevenLabs Music v2, 2026"); a running tally Estonia /
elsewhere ("can't tell" counts as elsewhere) sits top right, Estonia in #0072CE. Music by the judge: placed
elsewhere, the clips that lost the words; placed in Estonia without the shell, the anthem clips with invented words;
the shell, `el-ernesaks-1`; the last scene, `fin-anthem-plain`.

**Splats and soft edges (2026-11-17).** All 38 generated pictures as SHARP scenes (Apple's research-only weights,
`~/visualia-local/sharp/batch.py` with `list-lauluvaljak.txt`, then `convert-land3d.mjs` and `index.py`): 907 s in
all including waits for the GPU to cool (another job was running), inference 7.9 s median (13.5 s at most), 17–18 MB
SPZ each, 628 MB in `out/drift-room/land3d/lauluvaljak/`. `lauluvaljak.html` is now built on `room-splat.html` (the
walk, the dissolves, the depth lift as a fallback while a splat is missing); the mesh version is
`lauluvaljak.before-splat.html`. No sharp corners: the canvas (and its glow) fades into the paper toward every screen
edge through an elliptical mask, on top of each picture's own soft wash. Music now also uses the "National songs"
clips (README in `research/music-drift`): the title-only ElevenLabs songs under the plain prompts placed elsewhere,
MiniMax's Liiv and Enno with the drifted named pictures, Kungla rahvas and Mu isamaa armas under the pictures placed in
Estonia without the shell, Sind surmani and Enno's Rändaja õhtulaul (ElevenLabs) under the shell. Screenshots
`out/drift-room/lauluvaljak-shot-*-sharp.png`; checked in Chrome (Playwright), no console errors, 30 fps headless.

## Pikk Hermann, 2026-11-17

Asked: *"new scene: pikk hermann with national flag. play estonian hymns on this"*. `hermann.mjs` (usage at the top),
the same pattern as `lauluvaljak.mjs`: every image model on the live gateway (`KEY_PERSON=eka-teacher`), two prompts at
1024²: **named** "Pikk Hermann tower in Tallinn, Estonia, with the Estonian national flag on top, photo" and **plain**
"a medieval castle tower with the national flag flying on top, photo" (no Tallinn, Estonia or Pikk Hermann: which flag
does a model reach for?). No real photos. Pictures, `runs.json`, `sheet.jpg`, the judge's answers in `out/hermann/`
(git-ignored). 38 pictures, 19 models, none failed (flux-3-image-klein answered 1360×768; the room crops the middle
square). **$0.84 recorded, about $0.28 estimated** for Recraft, Nano Banana 2 lite and GPT Image 2.

Facts used (sources in the script's header): the tower is the castle's south-west tower, 45.6 m (et.wikipedia) or 48 m
(en.wikipedia, `landmarks.mjs`), machicolations at the top; the Estonian flag is raised there every sunrise to the
opening of the anthem and lowered every sunset to a signature from Ernesaks's "Mu isamaa on minu arm"; the
blue-black-white first flew there on 12 December 1918.

**Judge** (`node hermann.mjs judge`, Gemini 3.8 Flash through the gateway, the 768 px square crop the room shows), two
calls a picture, the first alone so it carries no hint: (1) the nature set's "which country?" word for word; (2) the
flag on the tower, top to bottom, classed Estonian / another country's / garbled / none, and whether the tower is
recognisably Pikk Hermann (the tower described in the question). 76 calls, none failed, **$0.34**. The flag and tower
of ten named pictures were checked by eye too (`out/hermann/eye.json`; the eye agreed with the judge on every flag and
was stricter on the tower: GPT Image 2's lone tower "partly", not "yes"). `places.json` holds both, worst first.

| | Placed in Estonia | Estonian flag | Garbled | Another country's | None | Tower is Pikk Hermann (by eye) |
| --- | --- | --- | --- | --- | --- | --- |
| Named (19) | 12 (all Tallinn) | 9 | 6 | 3 (Russia ×2, Austria) | 1 | yes 3, nearly 2 |
| Plain (19) | **0** | **0** | 8 | 9 | 2 | 0 |

- **Which flag a model reaches for, unasked:** British flags for 4 (Union Jack: Nano Banana 2 lite, GPT Image 2;
  Saltire: Nano Banana Pro; St George's cross: FLUX.3 klein), France 2 (Grok, Phoenix), Denmark (Seedream; the
  Dannebrog's legend falls from the sky over Tallinn in 1219, but nobody here meant it), the Netherlands (Recraft),
  Croatia (FLUX.2 pro). The judge put 7 of the 19 plain pictures in the United Kingdom. The strongest models drew the
  cleanest foreign flags: "the national flag" is the English-speaking one.
- **Named, the flag is mostly right, the tower mostly not.** 9/19 draw blue-black-white in order; the 6 garbled ones mix
  the same colours wrongly (white-black-white: lucid-origin and flux-1-schnell; blue-white-black: FLUX.2 pro;
  black-white-blue: Recraft; red-white-black-white with a "PIK HERMANN" sign: klein 9B; blue-white-blue: SDXL). Two
  drew Russia's white-blue-red (FLUX.2 dev, SDXL Lightning, the latter on a glass skyscraper "in Chile"). The tower
  itself is right only for Nano Banana Pro (with Nevsky's domes and St Olaf's spire behind), Seedream 5 pro and Nano
  Banana 2 lite (with a pink building); nearly for GPT Image 2 and FLUX.2 pro. The rest draw a brick church tower, a
  town hall or a square keep, and the judge still says "Pikk Hermann, Tallinn" from the flag or a written sign (Qwen's
  plaque reads "Pikk Hermann"). As at the Song Festival Grounds, the judge reads the writing and the flag, not the
  building.

**Splats:** all 38 pictures through SHARP (`hermann.mjs sharp-list` writes `~/visualia-local/sharp/list-hermann.txt`,
worst first; `batch.py` once the Song Festival batch had finished, then `convert-land3d.mjs` and `index.py`): 452 s,
inference 7.4 s median (10.1 s at most), GPU 71 °C at most, MPS 14.5–15.2 GB, 636 MB of SPZ in
`out/drift-room/land3d/hermann/`. Depth maps for the lift as well (`hermann.mjs depth`).

**Room:** `out/drift-room/hermann.html`, a copy of `lauluvaljak.html` (SHARP splats from `land3d/hermann/`, the lift
while one is missing, the canvas fading into the paper at every edge). **Drone flyover** (asked: *"do more like drone
flyover for hermann"*) instead of the walk: one move per scene over its whole life (dissolve in, hold, dissolve out),
a rising arc around the subject, starting low and wide, climbing while it circles, ending closer and looking up at the
flag, eased, alternating left and right. The camera stays still and each scene is moved by the inverse of its own
drone pose, so the outgoing scene keeps flying while the incoming one starts, and the dissolve never jumps. The pivot
is measured from the splats (the nearer quarter of the solid splats in the middle 60 % of the picture, nearer than
60 m, kept within 4–35 m); the arc is ±22° (`?orbit=`) for a splat scene and ±6° for the lift. The view is fitted to the
picture's height (not its width, as at the Song Festival Grounds, where the flags fell off the top) and narrows by a
quarter as the drone climbs. C still cycles drone, walk, drive, drift. The old walk version is
`hermann.before-drone.html`. A start card says what was asked, and a line above every caption gives the prompt
("Asked for "a medieval castle tower with the national flag flying on top", no country named"), since the first scenes
are British flags and read as a mistake without it. Worst first by score: placed in Estonia +
confidence (Tallinn +0.5), elsewhere − confidence; flag Estonian +1, none −0.25, garbled −0.5, another country's −1;
tower Pikk Hermann +0.5, nearly +0.25. It opens on the Union Jack, the Tricolore, the Union Jack and the Saltire (the
best models' plain pictures) and ends on Seedream's and Nano Banana Pro's towers. Caption: model, named/plain, where the
judge put it, the flag (and "by eye"), "Pikk Hermann" when it is, and the song with its model and year; the tally top
right counts Estonia/elsewhere and the Estonian flag. **Music, hymns only:** wrong flag and elsewhere get the clips
that lost the words (`mm-ernesaks-lyrics`, `el-anthem-1`, `mm-anthem-lyrics` from 0:41, `el-ernesaks-2`); half right
(the flag or the place, or the wrong tower) `national/nat-isamaa-armas` (played at the flag's lowering until 2009;
"armas, kus" sung as "armastus") and `el-anthem-2`; the flag on Pikk Hermann `el-ernesaks-1` (the sunset signature's
song, Koidula's words heard right) and `national/nat-sind-surmani`; the last scene `finale/fin-anthem-plain` (the
sunrise anthem, rõõm kept). No music was generated.

Checked in Chrome (Playwright, 1440 × 900), no console errors, 60 fps once a scene is loaded: `out/drift-room/
hermann-drone-<scene>-start|mid|end.png`, `hermann-drone-dissolve.png`, `hermann-drone-card.png`. **Still wrong:**
at the ends of the arc a white smear stands beside Seedream's tower (cloud splats seen from the side); Nano Banana
Pro's far flag is small and soft at the top of its picture; with a 35 m cap, SDXL Lightning's skyscraper still slides
a lot. The cost, all of it through the gateway: pictures $0.84 recorded + about $0.28 estimated, judge $0.34, **about
$1.46**.


**Layout, map, camera, edges (2026-11-17, later).** `lauluvaljak.html` and `hermann.html` now follow slides.html:
the scene on the left (60 % of the width), and a right column (`out/drift-room/room-side.js`) with the prompt in the
prompt box (model, year, euros from `costs.json`, 2.9 Wh), plain sentences (where the judge put it, "No country in the
prompt." for plain ones, the flag for Pikk Hermann, the music with its model and year), the tally, and the drift map
(`map/heatmap.js` through `map/room-map.js`: a judge answer becomes one point at the region it named or the country's
centroid, the asked place ringed, flying out to the world for Argentina or Chile). No walking anywhere: one slow eased
move per scene (push-in, pan, crane, pull-out, tilt; Pikk Hermann keeps its rising drone arc), in `room.html` and
`room-splat.html` too; backups `*.before-pans.html`, `*.before-map.html`. The scene's edge is `room-edge.js`: a
low-resolution paper overlay whose rim is warped by slow noise (one unit per 40 s), plus a blur ring, and each SHARP
splat's own wash is a wide drifting feather (about 15 %, wider across the sky). Song Festival Grounds plays choir
clips only: the anthem and Ernesaks clips, Sind surmani, Ta lendab mesipuu poole (ElevenLabs and MiniMax), Kungla
rahvas, Mu isamaa armas; Rändaja õhtulaul and the title-only songs are out. Screenshots
`out/drift-room/{lauluvaljak,hermann}-side-*.png`, `lauluvaljak-edge-12s.jpg`, `room-pans.png`, `room-splat-pans.png`.

## Muhu by year, 2026-11-17

The question for the Arunädal demo: do newer picture models know a specific Estonian costume better, or do they
only look more "Estonian"? (EKI found the same split for text: Estonian language up, knowledge of Estonia stuck;
`research/drift-mechanisms.md`.) Round two's plain prompt, `Muhu women's folk costume` (round two had no variant
with "Estonia" in it), on every era model that runs in the cloud, 3 pictures each (no seed control through the
gateway: each call draws anew), 768x1024. Scored as round two scored generated pictures: Muhu's six calibrated
criteria (`round2/criteria-v2/muhu.json`) and Kihnu's in one list, Gemini 3.8 Flash; the parish from the closed list
of 12, Gemini alone; plus era.mjs's plain "which country was this photo taken in?". Script `costume-era.mjs`,
output `out/costume-era/` (pictures, `judge.jsonl`, `scores.json` for a slide, `sheet.jpg`). Research only, not
published. Cost by the script's own count: $1.08 (pictures about $0.86, judging about $0.22).

| year | model | Muhu criteria % (range) | Kihnu criteria % | placed in Estonia | parish named |
|---|---|---:|---:|---:|---|
| 2022 | DALL·E mini | not run (M1 only) | | | |
| 2022 | Stable Diffusion 1.4 | not run (M1 only) | | | |
| 2023 | ChilloutMix | not run (M1 only) | | | |
| 2023 | SDXL 1.0 | 11 (0–17) | 29 | 0/3 | Muhu, Muhu, Muhu |
| 2024 | FLUX.1 schnell | 11 (0–17) | 22 | 0/3 | Setomaa, other, other |
| 2025 | FLUX.2 dev | 13 (0–20) | 26 | 0/3 | Setomaa ×3 |
| 2025 | FLUX.2 klein 4B | 17 (0–33) | 39 | 0/3 | Noarootsi, Emmaste, Noarootsi |
| 2026 | FLUX.3 klein | 17 (17–17) | 17 | 1/3 | Setomaa, Muhu, Tarvastu |
| 2026 | Nano Banana 2 lite | 39 (33–50) | 44 | 3/3 | Muhu ×3 |
| 2026 | GPT Image 2 | 11 (0–17) | 50 | 3/3 | Emmaste, Kihelkonna, Tõstamaa |
| 2026 | Nano Banana Pro | 17 (17–17) | 50 | 3/3 | Kadrina, Emmaste, Muhu |
| | real held-out photos (round two) | 95 | 33 | | Muhu 4/4 |

What it shows:

- **Only the Estonia share rises.** Up to 2025 no picture is placed in Estonia (Sweden, Germany, Norway, North
  Macedonia, Russia, Denmark, Poland, Serbia); the 2026 models GPT Image 2, Nano Banana Pro and Nano Banana 2 lite
  place 9 of 9 there, mostly on the islands (Saare and Hiiu County), with thatched barns and stone walls. Muhu's
  criteria stay at 11 to 17% for every model but one, from 2023 to 2026: the pictures got better, the costume did not.
- **What the newer pictures get right is the generic islands costume.** The one Muhu criterion they pass is "a skirt
  with vertical stripes"; none draws the small boat-shaped flower-embroidered cap, the orange skirt with thin dark
  stripes, the embroidered apron hem band, the wide belt with a buckle. On the same pictures GPT Image 2 and Nano
  Banana Pro pass half of Kihnu's criteria (red striped skirt, white blouse) against 11 to 17% of Muhu's: they look
  more like the other island's costume than the one asked for. The parish judge agrees: GPT Image 2's three pictures
  are named Emmaste, Kihelkonna and Tõstamaa.
- **The exception is Google's, judged by Google.** Nano Banana 2 lite is the only model above 20% (39%) and the only
  one named Muhu 3 of 3. The judge is Gemini, from the same company, and may share its picture of "Muhu"; round two's
  plain nano-banana-2-lite pictures were 50%, so the number is stable, but a Google judge on a Google model is not an
  independent check. Nano Banana Pro, also Google's, is at 17%, so this is not simply a judge favouring its house.
- **The closed parish list flatters the old models.** SDXL's pictures are a generic Central European folk dress
  (placed in Sweden and Germany), yet the parish judge, forced to pick one of 12 Estonian parishes, calls all three
  Muhu "for the floral embroidery": Muhu is the stereotype for flowers. Read "parish named" only together with
  "placed in Estonia".
- **Small n.** 3 pictures a model, 6 criteria (a picture's score moves in steps of 17 points), one judge, one prompt.
  Enough to show the shape (Estonia share 0 → 100%, criteria flat), not to rank the 2026 models against each other.
  With the expert text in the prompt round two reached 63 to 100% on two of these models: the knowledge is not in
  the models, it is in the text.

## Films, 2026-11-17

Every cloud image model on the live gateway (19, the pool's ChilloutMix left out) asked for *"A still from the
<year> Estonian film <title>."*, the film's own title, for Viimne reliikvia (1969), Kevade (1969), Hukkunud
Alpinisti hotell (1979), Nukitsamees (1981) and Nipernaadi (1983). `films.mjs` (usage on top, resumable) writes
`out/films/<model>/<film>.png`, `runs.json`, `judge.jsonl`, `places.json`, `sheet.jpg`. The page is
`out/drift-room/films.html`: per film a title slide, then one slide per model by release date (models.js), with the
film's room song (`research/music-drift/out/films/room-<film>.mp3`) looping softly under it.

```sh
node films.mjs draw      # BUDGET=2.5 by default; refusals are recorded, not retried (`retry` asks again)
node films.mjs judge     # JBUDGET=0.4
node films.mjs sheet
```

**Refusals: 4 of 95, all Black Forest Labs, all on the first try.** flux-2-pro-preview refused Viimne reliikvia
and Nukitsamees, flux-3-image-klein Viimne reliikvia ("2017: Content moderation error"), and flux-2-klein-9b's
Nukitsamees was stopped at the output ("3030: Your output has been flagged"). That is far fewer than on 11-16 (the
"History and films" table: klein refused 10 of 13 named films). Those prompts named the film inside a longer scene
description; this one asks for a still and nothing else. One try each, and the filter was shown to be unstable on
11-16, so say "in our test". The page shows each refusal as a slide with the provider's words where the picture
would be.

**Not drawn:** Nano Banana Pro for Alpinist, Nukitsamees and Nipernaadi: the script stopped before the estimate
passed the $2.50 budget (it goes last because it is the dearest). Dreamshaper 8 LCM drew five coloured noise fields.

**Judge** (Gemini 3.8 Flash through the gateway, one call a picture, 768 px, no metadata): the nature set's "which
country?" question word for word, then *"Also: which film is this a still from, if any?"* with the film's title,
country, year and confidence in the same JSON. The place is asked first, but in the same call as the film, so this
judge is not the nature set's unprimed judge. 86 of 88 answered (two answers came back cut off and were not asked
again, to stay within the budget).

| Film | Pictures | Placed in Estonia | Named the film | Other films the judge named |
| --- | ---: | ---: | ---: | --- |
| Viimne reliikvia | 17 | 5 | 3 (p-image, flux-2-klein-9b, nano-banana-pro) | Arn (2007), The Ballad of the Valiant Knight Ivanhoe (1983), The Valley of the Bees (1968), "Medieval" (2022) |
| Kevade | 19 | 7 | 5 (flux-2-pro-preview, nano-banana-2-lite as "Spring", recraft, qwen, nano-banana-pro) | The Fencer (2015), The White Ribbon (2009), The Book Thief (2013), Torn Curtain (1966), The Garden of the Finzi-Continis (1970) |
| Hukkunud Alpinisti hotell | 18 | 6 | 4 (flux-2-klein-9b, qwen, grok, gpt-image-2) | Ballon (2018) |
| Nukitsamees | 16 | 3 | 3 (nano-banana-2-lite, recraft, gpt-image-2) | Anatomy of a Fall (2023), The Girls (1968) |
| Nipernaadi | 18 | 3 | 2 (flux-2-klein-9b, seedream-5-pro) | Tarkovsky's Mirror (1975) twice (flux-2-pro-preview, flux-2-dev, both "Moscow"), Róża (2011), 4 Months, 3 Weeks and 2 Days (2007), Kevad südames (1984) |

- **Placed in Estonia: 24 of 86.** Elsewhere: Switzerland 4 (the Alpinist's mountains), Russia 7, Sweden 6, Germany
  5, Czechia 2, and 24 "unknown" (mostly the 2023–2024 models). Kevade went to Palamuse's county (Jõgevamaa) three
  times (nano-banana-2-lite, recraft, nano-banana-pro); Seedream's Kevade became Torn Curtain in California.
- **The film is named mostly where its title is written in the picture.** By eye on the contact sheet: flux-2-klein-9b
  painted the title on four of its five stills, as did nano-banana-pro on Viimne reliikvia, recraft on two, Seedream on
  Nipernaadi, and a hotel sign on Qwen's and GPT Image 2's Alpinist. Without a written title, the judge reached for a
  better-known film of the same mood: Mirror for Nipernaadi, The White Ribbon for Kevade, a Czech or Swedish
  medieval film for Viimne reliikvia.
- The page shows the judge's film in one line under the music box only when it named one ("Hindaja arvab: …").

**Asked place** (the black ring): Pirita for Viimne reliikvia (the convent is the story's setting; et.wikipedia: the
convent was filmed as a mock-up at Kukeranda near Virtsu), Palamuse for Kevade, Karksi-Nuia for Nukitsamees (filmed
around it, et.wikipedia); the middle of Estonia for the Alpinist (no named country; filmed at Tuyuk-Su above Almaty,
ru.wikipedia) and Nipernaadi (no filming place found).

**Title photos** (`out/films/title/`, `photos.json` has the Commons pages): no still or poster of these Tallinnfilm
films is free on Commons, so the title slides show where the film was made or is set: Pirita convent 1991 (Jaan
Künnap, CC BY-SA 4.0), Palamuse parish school (Väino Valdmann, CC BY-SA 3.0 ee), Tuyuk-Su (Julia Khen, CC BY-SA 4.0),
the Karksi valley (Reosarevok, CC BY-SA 4.0). Nipernaadi has none, so its title is the blend of its 18 pictures.

**Cost:** pictures $1.62 recorded by the gateway plus about $0.70 estimated where it records no price
(nano-banana-2-lite, recraft, gpt-image-2), about $2.32; the judge $0.39 (the two cut-off answers not counted).
`costs.mjs` rerun after both.

## ChilloutMix, "Estonian woman" and its controls, 2026-11-17

Asked: *"gen eesti naine eesti mees with chilloutmix ... prompt in english"*, then *"why"*, then the controls.
ChilloutMix in a Chrome tab on the work Mac (`apps/pool-app/sd-web`: ONNX Runtime Web, WebGPU, 512², 20 steps
DPM++ 2M Karras, guidance 7, negative "nsfw, nude, naked"), seeds 1–4 per prompt, about 20 s a picture, $0.
`out/cover/people/` (git-ignored): `chilloutmix-<who>-s<seed>.png`, the settings in `chilloutmix-en.json` and
`chilloutmix-controls.json`, sheets `sheet-en.png`, `sheet-controls.png`, `sheet-men.png`. Two pictures from the
Estonian prompts ("Eesti naine", seeds 1–2) are there too (`chilloutmix-naine-*`, `chilloutmix-et.json`). One look
by eye, four seeds each: "in our test", not a count.

| Prompt | What came back |
| --- | --- |
| Estonian woman | Young, platinum blonde with a fringe, all four in navy or royal blue dresses (a schoolgirl uniform, a dirndl, a ball gown), dirt road, wooden cottages |
| woman | Dark-haired, mostly East Asian, mixed styles (photo, comic, oil portrait, fantasy); blue in two of four |
| Finnish woman | Folk costume, blue and white (one blue and yellow), older, painterly |
| Latvian woman | Folk costume, dark red, magenta, a red-yellow-blue plaid; older peasant women |
| Estonian man | Blue: a suit with a bow tie, a cartoon Napoleonic soldier in snow, a long military coat; seed 3 a 1930s car, no man |
| man | A man on a stone ledge, a badge with made-up letters, seed 3 a black off-roader, a man in blue on a cliff |
| Latvian man | Sepia: 19th-century photographs and engravings, dark coats, one red waistcoat, a figure with a halo on a rock |
| Finnish man | Winter and sport: ski gear, hi-vis, a blue down jacket in snow; seed 3 a station wagon, no man |

What it suggests:

- **The flag's colour follows the country**: Estonian → blue, Latvian → dark red, Finnish → blue and white. "woman"
  alone has some blue too (ChilloutMix's palette), so blue for Estonia is partly the model's own.
- **Blonde comes from "Estonian"**, not from ChilloutMix: its plain "woman" is dark-haired and East Asian (its training
  was largely East Asian portrait photography). Young and pretty is ChilloutMix's; the Finnish and Latvian women are
  older peasant women in folk costume, the Estonian ones young women in fashion.
- **Each country gets a time**: Latvian men in the 19th century (sepia), Finnish men today (skiing, hi-vis), Estonian men
  in uniform.
- **The car is the seed, not Estonia**: seed 3 draws a car with no person for "Estonian man", "man" and "Finnish man"
  alike. A seed fixes the layout, and with a two-word prompt "man" loses to it.
