---
status: idea
---

# Graphic design classics: a visual test

A third set for the visuals harness (`evals/estonian-visuals`, `--set
design`), beside Estonia and Germany: do picture models know the classics an
art and design student studies, and can they draw in a movement's language
without copying one famous work? Same page (`/visuals`, a third tab), same
judge, same rows of models. Nothing built yet.

## Why it fits the course

- The students are designers: this is the knowledge they will lean on, and
  where models are confidently wrong in instructive ways (Swiss posters with
  centred serif type, Bauhaus as beige minimalism).
- It turns "make it look like Bauhaus" into a question with an answer per
  model, and shows the old models next to the new.
- It raises the rights question on purpose (`schools/eka/docs/RIGHTS.md`):
  style versus a particular work, a living designer's name in a prompt.

## The ten prompts (draft)

Movements and methods, not single famous works, and no trademarks:

| id | prompt (short) | questions (concrete, visual) |
|---|---|---|
| bauhaus | a Bauhaus exhibition poster, 1923 | primary colours only (red, yellow, blue, black); circles, squares, triangles; sans-serif lettering; asymmetric |
| swiss | a Swiss International Style concert poster | strict grid; flush-left, ragged-right text; sans-serif; a large photo or simple geometry; lots of white space |
| constructivist | a Soviet Constructivist poster | red, black and off-white only; diagonal composition; bold block letters; photomontage or flat shapes |
| de_stijl | a De Stijl composition | only horizontal and vertical black lines; rectangles in red, yellow, blue; white ground |
| art_nouveau | an Art Nouveau theatre poster | curving organic lines; a woman with flowing hair; decorative border; hand-drawn lettering |
| saul_bass_style | a 1950s film poster with cut-paper shapes | flat cut-out shapes with rough edges; two or three colours; a single symbolic figure |
| penguin | a classic three-band paperback cover | three horizontal bands, the middle one white; title in the middle band; orange or green bands |
| pictograms | sports pictograms for an Olympic Games | figures made of straight segments at fixed angles; one colour on a plain ground; no faces |
| letterpress | a wood-type letterpress poster | several typefaces, large bold letters; visible ink texture; mostly black and one colour |
| estonian_1930s | an Estonian poster from the 1930s | for EKA: national romantic or functionalist; to draft with the teacher |

Each criterion is one visual fact the judge can see. No counting ("exactly
three bands" fails, see the judge's limits) and no spelling: the text
criteria stay "Is the lettering sans-serif?", not "Is the word spelled
right?".

## Judging

- Clef-flash as now, neutral `state` ("A poster."), one fact per question,
  cut-off per criterion from labels.
- **Style words are the risk:** Clef may not know what "Swiss style" looks
  like, so every question names what to look for, never the movement.
- **Labels from the teacher**, not by eye from a script: 2 or 3 tasks for
  every model, to check the judge before the numbers go on the page.
- Spelling and type identification (serif or sans, which family) may need a
  second judge (a general vision model, or OCR); left out of v1.

## Rights and wording

- No logos or trademarks (IBM, I♥NY, the London Underground roundel), and
  no living designer's name in a prompt; the page says why.
- The page shows pictures made by models from our prompts, credited by
  model, as now. If a model reproduces a known work closely, that is a
  finding to show, not to hide.

## Cost and time

Like Germany: about $0.75 for the priced cloud models, under $0.02 for the
judge, and the M1's stable-diffusion.cpp models free (about 30 minutes for
four models, 10 prompts).

## Open

- The teacher picks or rewrites the ten (and the Estonian one or two).
- Whether students add their own classic with criteria (the playground idea
  in `plans/estonian-visuals.md`).
