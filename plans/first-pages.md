---
status: building
---

# First pages

Can cheap models make working pages from Estonian briefs? Everything in the
studio depends on the answer, and the gateway can find out before any UI exists.

## What it is

`evals/first-pages/`: 5 Estonian briefs (p5 sketch, three.js scene, d3 chart,
poster, interactive generative piece) × several models, all through the course
gateway with a test student key, so every call also lands in `usage`.

Each result is opened in headless Chromium at phone width (375 px) and checked:

1. **html:** the answer contains one complete HTML document.
2. **clean:** no console errors and no uncaught page errors within 3 s.
3. **visible:** the screenshot isn't blank (enough distinct colours).
4. **fits:** no horizontal scroll at 375 px.

A page passes when all four hold. Results: a table of pass rate, tokens, cost
(from the gateway's `usage`) and time per model, plus every HTML file and
screenshot under `evals/first-pages/out/` (gitignored) for eyeballing.

## Models

Workers AI through AI Gateway: `@cf/qwen/qwen3.8-27b` (default),
`@cf/google/gemma-4-26b-a4b-it`, `@cf/openai/gpt-oss-120b`,
`@cf/zai-org/glm-5.3-flash`, `@cf/deepseek-ai/deepseek-v4.1-flash-1017`. Some
may be paid-only on this account; a refusal is recorded as a result, not hidden.

## Not in it

No judgement of beauty or of how well the page matches the brief: that's a
person's job (and later Clef's). These checks only catch what's broken.

## Run 1 (2026-10-21): Qwen 3.8 27B, streaming, thinking off

All 5 pass the automatic checks; avg 5,544 tokens out, 153 s, first token
~0.5 s, ~$0.015 per page (~1,400 neurons). Looking at the screenshots:

| Brief | Verdict |
|---|---|
| kivid (three.js) | good, matches the brief |
| lumi (snow) | good; odd Estonian ("Lõksata" for "Klõpsa") |
| temperatuur (d3) | values right, but Nov–Dec cut off; title "kuused" (spruces) for "kuu-" |
| plakat (poster) | giant title renders garbled; calls EKA "Tallinna Kõrgekool"; invents text and a weekday (14 March 2026 is a Saturday) |
| spiraal (p5) | spiral not visible after 3 s; only the added UI is |

Lessons: (1) the checks catch broken, not bad: verify needs a judgement layer
(Clef against the brief, and people); (2) Qwen over-designs (badges, panels,
logos nobody asked for), which drives tokens and time; a tighter house prompt
should cut both; (3) Estonian copy is the weak spot (wrong words, wrong school
name, invented facts); (4) 2–3.5 min per page is fine to watch, slow to iterate.
Before this run, non-streamed calls hit Workers AI's 120 s limit (error 3046);
the gateway now streams.

## Run 2 (2026-10-21): same model, with the instructions

`schools/eka/instructions.md` v0.1 (the course's always-on instructions, then
called house rules) added to the system prompt. Still 5/5 on the checks.

| | Run 1 (plain) | Run 2 (instructions) | Change |
|---|---|---|---|
| Tokens out (avg) | 5,544 | 1,270 | −77% |
| Time per page (avg) | 153 s | 41 s | −73% |
| Cost per page | ~$0.015 | ~$0.004 | ~−75% |

By eye:

| Brief | Run 2 |
|---|---|
| spiraal | fixed: a clear spiral fills the screen, nothing else |
| plakat | fixed: clean big type, correct text and address; still invents one badge ("Eest 2005") |
| temperatuur | fixed: all 12 months, correct title; month labels overlap at 375 px |
| lumi | fine: snow falling, nothing extra (accumulation not visible at 3 s) |
| kivid | worse: camera too close, washed-out white stones, sand and sea gone |

Lessons: instructions are the cheapest big lever: same model, a quarter of the
cost and time, and three of five pages fixed. Next fixes for v0.2: no badges or
"since" dates at all; axis labels must not collide at 375 px; 3D scenes keep
the camera far enough to show the whole scene with balanced light.
