---
status: shipped
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

## Run 3 (2026-10-21): five models, all with the instructions

| Model (Workers AI) | Pass | Avg time | First token | Tokens out | Cost / page |
|---|---|---|---|---|---|
| **DeepSeek V4.1 Flash** | 5/5 | **8 s** | 1–3 s | 1,112 | $0.0014 |
| Gemma 4 26B-A4B | 5/5 | 19 s | 0.2–0.6 s | 945 | **$0.0003** |
| Qwen 3.8 27B (run 2) | 5/5 | 41 s | 0.4–3 s | 1,270 | ~$0.004 |
| gpt-oss-120b | 4/5 | 16 s | 3–14 s | 1,390 | $0.0013 |
| GLM-5.3-Flash | 3/5 | 162 s | up to 268 s | 6,014 | $0.0031 |

By eye (contact sheet of all 25 pages):

- **DeepSeek V4.1 Flash:** the best set. Clean spiral; beach stones with sand
  and shadows; chart with all 12 months, values on bars; strongest poster
  ("EESTI KUNSTIAKADEEMIA", big date, correct address); snow.
- **Gemma 4:** close second and by far the cheapest. Good stones and chart; the
  only one whose snow visibly piles up; the spiral runs off-screen; the poster
  breaks "KUNSTIAKA-DEEMIA" mid-word.
- **Qwen 3.8:** good spiral, chart and poster, but the stones scene is washed
  out.
- **gpt-oss-120b:** the 3D page failed (`THREE is not defined`); chart title
  clipped; plain poster.
- **GLM-5.3-Flash:** good where it finished, but it thinks for minutes before
  writing (first token up to 268 s) and twice ran out of its 8,000-token budget
  before any HTML. Turning thinking off didn't take for this model.

**Decision: DeepSeek V4.1 Flash is the default page model.** Best pages, and
at ~8 s per page a student can iterate live in class. **Gemma 4 is the
fallback** (5/5, a fifth of the cost, fast first token). One run of five
briefs each, so this is a strong hint, not a verdict; rerun when briefs or
instructions change.
