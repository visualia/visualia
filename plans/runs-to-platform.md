---
status: next
---

# From the talk's model runs to the platform

Asked 2026-11-20: *"look also into all the model running we did for talk. what of it needs to land on the pool work /
visualia infra, what is oneoff. full plan"*.
The full inventory (about 35 kinds of run, scripts, models, counts, cost and energy) is `~/personal/talks/arunadal/research/talk-model-runs.md`,
read from the repo on 2026-11-20. This plan sorts it into what lands on the platform and what goes into the archive.

## First: the live service is ahead of git

The gateway and studio changes were deployed on 2026-11-16 and never committed. They are in the working tree now:
- **`apps/gateway/src/index.js`** (+225 lines):
  - the judges, Gemini 3.8 Flash and Sonnet 5.5;
  - six catalog image models with prices;
  - `references` on `/v1/images`;
  - `/v1/cutout` to the pool.
- **`apps/gateway/src/prices.js`.**
- **`apps/pool`:** the `/cutout` route and `birefnet-lite` in `models.js`.
- **The studio's `/cutout` page and Generate's new models.**

Commit these as they are, in their own commits, before anything else touches those files. The pool-core `cutout.rs` is
written but not built (ThreatLocker here, the M1 unreachable), so commit it as work in progress, marked as such.

## What the talk ran, by where it belongs

### A. Already on the platform

Leave these as they are:
- every cloud picture call through the gateway (19 models; `references` for edits);
- the Gemini and Sonnet judges, Clef-flash `/v1/decide`;
- `pool/chilloutmix`, with measured energy in its usage rows.

### B. Pool and worker app jobs

Local, repeatable and useful to students, under clean licences:

| Job | Model | Licence | State | Why |
|---|---|---|---|---|
| Remove background | BiRefNet-lite | MIT | gateway and pool written; pool-core `cutout.rs` not built | every figure step starts with it; students cut out their own pictures |
| Picture to 3D | TripoSplat, our fp16 ONNX | MIT | export works in Node (202 s at 4 steps on the M1); no job | figures from a student's picture; `plans/pool-3d.md` |
| Local Stable Diffusion | SD 1.4/1.5, SD-Turbo, Dreamshaper 8, FLUX.2 klein 4B, via sd.cpp | per model | `local-sd.sh` by hand on the M1 | SDXL, SDXL Lightning and Dreamshaper 8 LCM leave Workers AI on 2026-11-21, so the M1 is the only place they run; the era ladder needs them |
| DALL·E mini | in a tab | Apache | runs in a tab (`early-imagegen`) | the 2021 rung of the era ladder; zero install |
| Depth | Depth Anything V2 small | Apache | Node, WebAssembly | needed for landscape splats made our own way (the SHARP replacement, `research/landscape-splats.md`) |
| Embeddings, later | DINOv2 small, SigLIP base | Apache | Node, WebAssembly | a "where did it drift" tool; only once a student use is clear |

**Not on the pool:** MusicGen (CC BY-NC weights) and BirdNET (CC BY-NC-SA). If students need local music, try
ACE-Step (MIT) or Stable Audio Open Small first.

### C. Gateway and studio

| What | Today | Lands as |
|---|---|---|
| Music: ElevenLabs Music v2, MiniMax Music 2.6 | REST with a wrangler OAuth token, outside the gateway; cost entered by hand ($10.51 of outside rows) | `/v1/music`, billed per second or per track, a usage row like any other; a studio page later |
| Transcription: Whisper large-v3-turbo | REST, by hand | `/v1/audio/transcriptions` (also the "speak a brief" backlog line) |
| Unpriced models: Nano Banana 2 lite, GPT Image 2, Recraft | estimated ($10.85 of estimates) | real prices in `prices.js` |
| Picture edits with references | gateway only | Generate gets a references field (the drift-room edits used it a lot) |
| Retire SDXL, SDXL Lightning, Dreamshaper 8 LCM | on Generate and in `IMAGE_MODELS` | removed on 2026-11-21 (already on the backlog) |

**Check the music terms before students publish anything:** the ElevenLabs and MiniMax output terms through
Cloudflare's billing. ElevenLabs already refused prompts naming Pärt and Grünberg.

### D. Shared infra

Six scripts (`run.mjs`, `films.mjs`, `lauluvaljak.mjs`, `hermann.mjs`, `era.mjs`, `costume-era.mjs`) each reimplement
the same loop: a prompt set × N models, resumable, stopping on the budget or on a 402, with a refusal log. And every
output is kept only on this Mac.

1. **A run record, one per output:**
   - prompt, model, seed, references, refusal, cost, energy (measured or estimated, and which), sha256, the script and
     its git commit;
   - JSONL beside the output today;
   - the same shape the gateway's usage row could carry later.
2. **One shared module, `evals/lib/runset.mjs`:** the loop the six scripts share, with the budget, resume and refusal
   handling. The scripts become prompt sets plus a call to it.
   - It stays a script, not a server job, until a student needs it. Then it becomes a studio "try this prompt on N
     models" page, with the same loop behind the gateway.
3. **Outputs in R2:** `visualia-research`, private (`plans/talks-online.md`), keyed by sha256 from the run records.
   The local `out/` stays the working copy.
4. **Cost and energy in one place:**
   - `costs.mjs` also reads the measured local energy (`energy.json`, `meter.jsonl`, local-nature's macmon rows, the
     pool's `energy_j`), so measured beats estimated wherever both exist.
   - The missing about $4 goes in: the 11-09 local-gateway runs, which sit in a local D1 (about $2.3, and no Clef-flash
     in the list at all); the nature REST judge ($1.26); and the pilot's reference pictures (about $0.5).
   - From now on nothing runs outside the gateway. Music and transcription go through C, judges already do.
   - Local runs go through `energy.mjs`, so they are measured (`memory: measure-energy`).
5. **A judge cache shared by every script** (`judge-cache.jsonl` is the pattern): the same picture, question and
   judge never costs twice.

### E. One-off research, archived

These are kept in `visualia-research`, not developed further:
- **SHARP and everything made with it** (330 `.spz`): research-only weights.
- **rahvaroivad.ee scrape and the costume drift study:** licence unclear, deletion planned.
- **MODNet, Demucs, BirdNET, the local Gemma comparison.**
- **The TripoSplat export and bench tooling:** kept as the source of the B job.
- **`keyfit.mjs`, tintinnabuli:** key and tempo analysis belongs to positron (CLAUDE.md); import positron's when needed.
- **The edit scripts** (`widen-*`, `story.mjs`).

## Steps

1. Commit the deployed but uncommitted gateway, pool and studio work (first section).
2. On 2026-11-21, retire the three Workers AI models.
3. Run records and `runset.mjs`; port the six scripts one at a time, each rerun on one model to compare.
4. Cost and energy: `costs.mjs` reads the measured files and the missing rows.
5. Gateway `/v1/music` and `/v1/audio/transcriptions`; prices for the three unpriced models.
6. Pool:
   - build and test `cutout.rs` on the M1;
   - then the TripoSplat job (`plans/pool-3d.md`);
   - then sd.cpp image models beside ChilloutMix.
7. The `visualia-research` bucket and its upload (`plans/talks-online.md` step 4), with the run records as its index.
8. Archive E with a README listing what is there and why it stopped.

## Questions for the user

- Keep the ChilloutMix pool job, given the nudity question open with the teacher?
- Local music for students at all, and if so which model?
- Embeddings: a student tool, or research only?
