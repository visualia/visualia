---
status: idea
---

# Small data: tiny models from your own material

A proposal from a claude.ai chat (2026-10-28, brought in 2026-11-02). INFERRED
unless marked; times are estimates. Research behind it: `research/small-data.md`
(including how training could run on the pool).

**Goal.** Students train small models on material they collected, in the
browser or on the pool, with a dataset card for every set.

## 1. Models by amount of material

| Material | Model | Where |
|---|---|---|
| 1 image | texture neural cellular automaton | browser |
| a few hundred KB of text | char-rnn or a tiny GPT; or no training: Markov chains and Tracery grammars | browser |
| 50–500 images | FastGAN-style small GAN | pool worker |
| hundreds of labelled photos | small classifier (e.g. for a camera board) | any machine |

From-scratch small models know only the student's material. That is the point.

## 2. The dataset card

What, from where, who agreed, licence, what is missing. One short file beside
the data. Rights levels (`schools/eka/docs/RIGHTS.md`): free (public domain,
CC0), semi-free (teaching and TDM exceptions: class use, no republishing), not
free (link and discuss).

## 3. Engines

- Browser: Burn compiled to WebAssembly with WebGPU, or plain JS for the
  smallest models.
- Pool: the same Burn code in the Rust worker (`worker-app.md`) as a
  `train-small` job (section 4). Members need only the worker app, no Python.
- Training texture models uses a large pretrained image network for the loss;
  the finished model is tiny.

## 4. Pool jobs survive members leaving

- Training runs in short chunks (for example 50 steps), each ending in a
  checkpoint in R2.
- The pool's coordinator leases the next chunk to a capable member; an expired
  lease goes to someone else from the last checkpoint.
- Pin model and data versions per job; log seed and settings with every chunk.
- Each job's energy in the usage rows, as model calls already are.
- Untrusted members: cross-check a sample of chunks on a second member.

## 5. In the studio and on boards

Datasets, models and outputs as types on a board, so the lineage is visible:
material, model, work, with credit.

## 6. Order

1. Texture NCA in the browser, one photo in.
2. Markov and Tracery text exercise ("computation, not AI").
3. Dataset card format and checks.
4. char-rnn in the browser.
5. Small GAN as a `train-small` pool job.
6. Classifier for a camera board.

## 7. Risks

Memorisation with very little data (the model copies back); unstable GAN
training; rights of street and community material (consent, panorama).
