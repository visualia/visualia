---
status: idea
---

# Estonian visuals: a judge playground

A playground for how well AI models know Estonia, with numbers behind it.
Generate a picture of something Estonian, let one or more vision models
judge it against written criteria, show everything side by side. The point
is not a leaderboard. It is one more thing to weigh when picking a model
(beside price, speed and energy) and a way to show where models are weak.
Builds on the EKI leaderboard work (moodupuu.eki.ee) and runs through
Visualia's own gateway and pool. Researched 2026-11-09, nothing built yet.

## What exists already (EKI)

- **New runner** (`~/personal/leaderboard/leaderboard-runner`, Python, 851
  lines, OpenRouter): text benchmarks `trivia-bench-2` (1000 items),
  `propa-bench` (225), `bib-bench` (64), `screen-bench` (5; no results).
  Results for 3 models only (2026-03-26): Gemini 2.0 Flash, Claude 3.5
  Haiku, DeepSeek V3. An image benchmark (`culture-symbols-generate`, 50
  prompts, yes/no per criterion) is planned in its `plans/benchmarks.md`,
  not built.
- **Old runner** (`~/personal/leaderboard_old`, 1052 lines; the HF space
  `kristjanjansen/leaderboard-ui` and dataset `leaderboard-data`, which is
  byte-identical to `data/latest`): 14 text models at n=10 per benchmark,
  and the **imagery** page: 10 prompts (flag, cornflower, coat of arms,
  Raekoda, Tartu university, Muhu costume, verivorst, kohuke, laulupidu,
  Estonian text), judged 0–5 by Claude Sonnet 4. Gemini 3 Pro 80, FLUX.2 dev
  75, FLUX.1 schnell 72.5, Gemini 3.1 Flash 72, Gemini 2.5 Flash 68, Lucid
  Origin 66, Phoenix 65, SDXL 58.3, SDXL Lightning 55, Dreamshaper 8 LCM 50.

**Against the models Visualia uses:** almost no overlap. Reusable as-is:
the three Workers AI image scores (FLUX.2 dev, Lucid Origin, Phoenix). No
result for DeepSeek V4.1 Flash (the default for everything), FLUX.2 klein 4B
(our only image model), qwen3.5-9b, gemma4-26b or Clef-flash. Those are the
gaps that matter.

**Weak points to fix, not copy:** n=10 samples (DeepSeek trivia 90 at n=10,
38.2 at n=1000); a model judging itself when a scorer names no judge
(`runner.py:251`); propa judged by Sonnet 4 then 4.5, so old and new do not
compare; unparseable judge replies dropped in one runner and scored 0 in
the other; first-letter answer parsing ("VASTUS" reads as A); failed calls
counted as wrong answers; image scores that 10 items on a 0–5 scale can't
produce (72.5, 58.3), and Cloudflare models marked in data the code has no
path for; per-topic breakdowns thrown away.

## Where each step runs

| Step | Local | Half local (first) | Cloud |
|---|---|---|---|
| Generate | pool job `kind: 'image'` | the gateway's `/v1/images` with a `model` choice (Workers AI), the pool later | Workers AI, catalog models |
| Judge | pool `gemma4-26b`, `qwen3.5:9b` (vision) | a cloud judge as the reference plus a local judge, and their agreement | Gemini Flash, Claude |
| Score, store | in code; R2 + D1 | same | same |

- **Image generation locally today:** none in the product. Ollama still has
  no image generation (removed in 0.32.6; still unsupported in 0.40.15). The
  M1 ran mflux (Python) only to measure (`local-images.md`). Options for the
  pool, best first: stable-diffusion.cpp as a sidecar (C++, Metal, CUDA,
  Vulkan: one engine for Macs and GeForce PCs); a Burn port of SD-Turbo
  (ONNX exports exist, burn-onnx imports UNets; needs a CLIP tokenizer and a
  1–4 step scheduler; runs in tabs too; about a week, unchecked); mflux as an
  outside program on the teacher's Mac. FLUX.2 klein has no ONNX export and
  needs ops burn-onnx lacks.
- **Judges:** Workers AI has vision models (Gemma 4, Llama 3.2 Vision,
  Moondream). Gemini and Claude can be paid through Cloudflare's unified
  billing (credits plus 5%; provider prices pass through), one model name
  away in the gateway, once billing is switched (`research/models-2026-10.md`,
  recommendation 1). About $0.002 a judgement with Gemini Flash, about $0.0002
  with Gemma 4 (estimates).
- **Old models run out soon:** SDXL base, SDXL Lightning and Dreamshaper 8
  LCM are due to leave Workers AI on **2026-11-20** (pricing page, not
  checked by us). Run them first. FLUX.1 schnell stays.

### First look (2026-11-09, one prompt)

"The flag of Estonia waving on a pole, blue black white horizontal stripes",
512×512. Locally on the M2 with stable-diffusion.cpp (built from source,
Metal; models in `~/visualia-local/models`), in the cloud through the
gateway's `/v1/images`:

| Model | Where | Time | Flag |
|---|---|---|---|
| FLUX.2 klein 4B (Q8) | M2, sd.cpp | 30 s (36 s with loading), 8.3 GB | right |
| FLUX.2 klein 4B | Workers AI | 5 s | right |
| SD-Turbo, 1 step | M2, sd.cpp | 0.7 s drawing, 6 s in all, 3.7 GB | wrong: blue and white with a cross, like Greece's, no black |
| Dreamshaper 8 LCM | Workers AI | 2 s | broken: cyan blur (our settings, 8 steps, may be to blame) |

sd.cpp ran klein about 2× slower than mflux on the M1 (12.7 s): fine for
old small models, slow for FLUX on Macs.

## The harness, in JavaScript

`evals/estonian-visuals/run.mjs`, in the style of `evals/first-pages/run.mjs`
(against `gw.visualia.space`, keys from `.keys.local`), about 250 lines:

- tasks in EKI's format (`benchmark.yaml` + data), so results flow both ways;
- generate, then judge with fixed judge models, never the model under test;
- per-criterion yes/no (EKI's own plan), score = yes / total, plus "Estonian
  text spelled right"; keep the breakdown and the judge's reason;
- `results.jsonl` in EKI's record shape plus `n`, judge and breakdown;
- a response cache so reruns cost nothing; a failed call is a failure, not
  a wrong answer.

The text benchmarks port the same way (trivia and screen in about 20 lines
of scorer each; propa about 60; bib stays on its `score.py`). Rust only
inside the pool app for offline multiple-choice runs on Ollama with
measured energy (about 100 lines).

## The playground

One studio page over the same data: a grid of prompts × models, each cell
the picture, its score, the judges' yes/no per criterion and their reasons,
and where the judges disagree. Filters by model, price and energy. A student
can add a prompt with criteria, run it on two or three models, and argue
with the judge. Numbers stay visible; the fun is in the pictures and the
disagreements.

## Estonian folk costumes

The well-documented, sensitive corpus to measure drift on: identify a
costume, generate it, identify the generated one again.

- **rahvaroivad.ee** (MTÜ Rahvarõivas): 109 parish pages in 4 regions,
  about 4,200 photos of modern reproductions with the parish, wearer and
  garment type, open WordPress API (`cms.rahvaroivad.ee/wp-json/wp/v2/`),
  originals by IIIF. **Licence unclear:** the terms say CC BY-NC-ND 3.0 EE,
  a sampled IIIF manifest says CC BY 4.0. Ask info@rahvaroivas.ee before
  using it, and tell them about the class.
- Held-out real garments: MuIS (open data, per-object rights), Europeana
  (search returns mostly Ukrainian items; about 260 Estonian, mixed rights),
  Wikimedia Commons (festival photos, poor labels).
- **Labels:** region (Põhja, Lääne, Lõuna, Saared, and Setomaa on its own),
  parish (109), wearer (naine, mees, tüdruk, poiss).
- **First set, class-internal:** 12 women's costumes in pairs that are easy
  to confuse (Muhu and Kihnu; Halliste and Tarvastu; Emmaste and Kihelkonna;
  Setomaa and Räpina; Vormsi and Noarootsi; Tõstamaa and Kadrina), 8
  reference views each, 2 held-out real photos each, about 100 MB.
- **Fetched (2026-11-09, class-internal, not in git):**
  `evals/estonian-visuals/fetch-costumes.mjs` took 31 women's costume photos
  from 11 of the 12 parishes (3 each; Tarvastu 1; Räpina has none of women),
  the site's 768 px copies or older ~1700 px ones shrunk to 1024 px, 5.6 MB,
  with title, link and photographer in `out/costumes/index.json`. Newer
  uploads name the photographer (Sandra Urvak); older ones don't, so
  attribution needs the site's help. Labels and photos checked by eye on
  Muhu and Kihnu.
- **Care:** Kihnu and Seto are living traditions (UNESCO). Frame the work as
  "where AI gets it wrong", never "AI folk costume"; keep references and
  generated costume images inside the class; prefer local judges or gateway
  models that keep no data for the reference photos. No documented study of
  AI drift on Estonian costumes was found: the confusions are hypotheses for
  the class to test.

## First version

1. The gateway's `/v1/images` takes a `model` from a short list (FLUX.2
   klein, FLUX.1 schnell, SDXL, SDXL Lightning, Dreamshaper, Phoenix, Lucid
   Origin). Deploy.
2. `evals/estonian-visuals` with the 10 EKI prompts rewritten as yes/no
   criteria; run the soon-retired models before 2026-11-20.
3. Two judges (Gemma 4 on Workers AI, and Gemini Flash once unified billing
   is on), checked against Claude Sonnet on 20 images for comparison with
   EKI's numbers.
4. The playground page reading `results.jsonl`.

Then: costumes (after rahvaroivad.ee answers), a pool `image` job, a Burn
SD-Turbo spike.

## Open questions

- rahvaroivad.ee's licence, and their blessing.
- Switch the gateway to unified billing (also needed for Gemini or Claude).
- Whether third-party models through `env.AI.run` take images (not tested).
- Run EKI's text benchmarks on our models, and give the results back?
