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
```

- `GATEWAY` defaults to the local gateway, `http://127.0.0.1:8788`. Start it
  with `cd apps/gateway && npx wrangler dev --port 8788 --ip 127.0.0.1
  --compatibility-date 2026-07-08 --persist-to <dir>`.
- The key: `KEY_PERSON=<name>` takes it from `.keys.local`; without it, a
  local gateway uses the scratchpad `key.txt`, any other `eka-test-001`.
- Pictures go to `out/<model>/<task>.jpg` (1024 × 1024, DALL·E mini 256 ×
  256) with a `.json` beside each (time, usage). A picture that exists is not
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
