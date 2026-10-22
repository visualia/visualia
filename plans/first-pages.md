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

## Run 4 (2026-10-21): instructions v0.2, default and fallback

`schools/eka/instructions.md` v0.2 adds general rules for what runs 2–3 still
got wrong: start the answer with the ```html block (the studio preview starts
only there); no badges, labels or "since" years; axis labels never overlap at
375 px; 3D scenes frame the whole subject with balanced light and keep the
setting; big headings wrap between words, never inside one, sized with
`clamp()` so the longest word fits; libraries load in `<head>` before use.
v0.1 outputs kept in `out/instructions-v0.1/`.

| Model | Version | Pass | Tokens in | Tokens out (avg) | Avg time | Starts with ```html |
|---|---|---|---|---|---|---|
| DeepSeek V4.1 Flash | v0.1 | 5/5 | ~590 | 1,112 | 8.2 s | 4/5 |
| DeepSeek V4.1 Flash | v0.2 | 5/5 | ~810 | 1,267 | 10.2 s | 3/5 |
| Gemma 4 26B-A4B | v0.1 | 5/5 | ~620 | 945 | 19.0 s | 5/5 |
| Gemma 4 26B-A4B | v0.2 | 4/5 | ~855 | 1,009 | 21.0 s | 5/5 |

The longer instructions cost ~220 tokens in and ~6–14% more tokens out; still
well under a cent per page. DeepSeek's average includes one slow stream (snow,
21 s, first token 0.35 s). Gemma's poster fails **fits** (scroll width 408 px).

By eye:

| Brief | DeepSeek v0.2 | Gemma v0.2 |
|---|---|---|
| spiraal | same: clean spiral, fills the screen | slightly better: dotted spiral, more visible, still runs off the edges |
| kivid | better light (no wash-out), sand and water both there, but the camera is still close and stones are cut off at the edges | worse: stones are small, jagged and half sunk in a water plane that covers most of the beach; v0.1 was better |
| temperatuur | same quality: all 12 months, rotated labels, no overlap; adds a card frame | fixed: abbreviated months (jan, veb, mar…), no overlap; title dropped "kuude kaupa" |
| plakat | regression: no invented text, but the school name is gone (only "AVATUD USTE PÄEV", date, time, address) | half-fixed: no mid-word hyphen break any more, but "KUNSTIAKADEEMIA" is too big (`12vw`) and is clipped on both sides |
| lumi | same: snow falls, no piling visible at 3 s | regression: snow falls but no longer piles up (flakes reset at the bottom) |

No invented badges or dates on either poster. Library loading was already
right for both models (three.js in `<head>`); the gpt-oss failure it targets
wasn't rerun.

Lessons: (1) the rules that name a concrete technique took (abbreviate/rotate
labels, `hyphens: none`, balanced light); the ones that describe an outcome
("frame the whole subject", "longest word fits") didn't, and the no-break rule
without a working size turned a hyphen into an overflow. A sizing hint would
help: for a heading, `font-size` at most ~`100vw / (letters × 0.7)`, or
`clamp()` with a vw value small enough for the longest word. (2) "Start with
the code block" didn't stop DeepSeek's preamble (2/5 still start with a
sentence); the studio should extract the block itself rather than rely on the
model. (3) "Don't invent" pushed DeepSeek to drop the school name, which the
brief did give ("Kunstiakadeemia"); a rule should say to keep every fact the
brief gives as well as add none. (4) Single runs are noisy: Gemma's snow piled
up in v0.1 and not in v0.2 with no rule touching it. Rerun each version two or
three times before calling a change a win or a loss.

## Run 5 (2026-10-21): the M1 laptop, with measured energy

Instructions v0.3, through the gateway to `m1-1` (M1 Pro 16 GB, Ollama, thinking
off, 16k context). Energy measured with macmon per page.

| Model | Pass | Avg time | Net chip energy / page | Whole machine / page |
|---|---|---|---|---|
| M1 · Gemma 4 E4B | 1/5 | 36 s | 661 J (≈0.18 Wh) | 1,353 J |
| M1 · Qwen 3.5 9B | 2/5 | 92 s | 2,173 J (≈0.6 Wh) | 4,157 J |
| cloud · DeepSeek V4.1 Flash (run 4) | 5/5 | 10 s | not measurable (estimate ~0.1–1 Wh) | |

Failures: Qwen ran away on the chart brief (300 s, 8,000 tokens, no HTML);
script errors (`p is not defined`, `.d is not a function`); blank renders.
First token ~1 s in most runs (the thinking switch works).

Lessons: a 16 GB laptop is not a page-maker (1–2 of 5, 4–9x slower). Its
measured energy per page is in the same range as the cloud's estimate, for
much worse pages, so "local is greener" depends on what is counted: a
block D discussion with real numbers. The M1's job is decisions (Clef-flash),
chat, Estonian probes and being the measured reference point.

## Run 6 (2026-10-21): MLX on the M1, and what Ollama already does

Question: would a dedicated MLX server make the M1 faster than Ollama (the usual
claim is 20–40% over llama.cpp)? Answer: **Ollama 0.40.5 already runs MLX.** Its
log shows `qwen3.5:9b` and `gemma4:e4b` starting an "mlx runner subprocess" (MLX
0.32.4): the library builds are nvfp4, Qwen with MTP speculative decoding,
Gemma with an assistant draft model. Only Clef-flash (GGUF) runs in llama.cpp
(`llama-server`). A trial `mlx_lm.server` (mlx-lm 0.32.2, mlx-community 4-bit
builds) behind the proxy was measured and then removed, along with its
LaunchAgent, venv and downloads.

Same prompt (the stones brief, instructions v0.3), 1,000 tokens out, thinking off,
through the proxy on the M1. Energy is chip energy from macmon.

| Build | Engine | tok/s | Prefill TTFT, 1,135 tokens in | Prefill TTFT, short file (715 in) | J per token out |
|---|---|---|---|---|---|
| `qwen3.5:9b` (default) | Ollama MLX, nvfp4 + MTP | **33–35** | 6.5 s | **4.1 s** | **0.97** |
| `qwen3.5:9b-mlx` | Ollama MLX, no MTP | 24.9 | 6.2 s | 3.9 s | 1.05 |
| mlx-community `Qwen3.5-9B-MLX-4bit` | `mlx_lm.server` | 32.9 | (cached prompt only) | | 0.73 |
| `qwen3.5:9b-q4_K_M` | llama.cpp | ~21 (the image benchmark may have overlapped) | 5.6 s | | |
| `gemma4:e4b` (default) | Ollama MLX, nvfp4 + draft | 42–54 | (cached prompt only) | | 0.43–0.47 |
| mlx-community `gemma-4-e4b-it-4bit` | `mlx_lm.server` | 42 | (cached prompt only) | | 0.47 |

Lessons: (1) the MLX win is already in: Ollama's MLX runner with speculative
decoding is ~60% faster than llama.cpp on the same Qwen and as fast as
`mlx_lm.server`, so a second server adds memory juggling for nothing. (2) The
plain `-mlx` tag (no MTP) is 25% slower: keep the default tags. (3) Reading
the prompt dominates the wait: ~175 tokens/s prefill means ~6.5 s before the
first token with v0.3 instructions whenever the prompt isn't cached. Ollama
reuses the cached prefix only while the same model stays loaded (warm TTFT
0.1 s), and with OLLAMA_MAX_LOADED_MODELS=1 every Clef decision call evicts the
page model. (4) Memory: Clef-flash alone holds 9.8 GB at 16k context of the
~12 GB GPU budget, so nothing else fits beside it. A decide call right after a
page model reloads Clef: measured at 11.6 s and 17.9 s, close to the gateway's
20 s timeout (after that it falls back to Clef on Workers AI). (5) Ollama warns
"Structured output is unavailable: xgrammar library not found" for MLX runners,
so `format` / JSON-schema output isn't enforced for the MLX page models.
Clef runs in llama-server, so `/v1/systemone` is unaffected; `/v1/decide` was
checked working after each switch.

Not done: the five-brief eval through the gateway on other builds (stopped
when the M1 was needed for an image benchmark), and an energy-per-page
comparison with run 5.

## Run 7 (2026-10-21): shorter instructions

`schools/eka/instructions-short.md`: the same rules as v0.3 in ~440 tokens
(v0.3 is ~880: a third of it is history the model doesn't need), every rule
phrased as a technique: a heading size formula
(`calc(90vw / (N * 0.7))`), Estonian month abbreviations, camera at ~2.5× the
subject's width with `HemisphereLight` + one `DirectionalLight`. `run.mjs`
takes `--instructions-file <path>` and `--tag <name>`. DeepSeek V4.1 Flash,
two runs per variant (v2 of the short file adds "dropping a fact is as wrong as
inventing one" and an unclipped-label rule after short v1).

| Variant | Pass | Tokens in | Tokens out (avg) | Avg time | Starts with ```html | Poster keeps school name |
|---|---|---|---|---|---|---|
| v0.3 full, run 1 | 4/5 (spiral load timed out; reloads fine: 5/5) | 1,191 | 1,217 | 7.5 s | 4/5 | yes |
| v0.3 full, run 2 | 5/5 | 1,191 | 1,248 | 6.8 s | 4/5 | yes |
| short v1, run 1 | 5/5 | 754 | 1,122 | 6.9 s | 4/5 | yes |
| short v1, run 2 | 5/5 | 754 | 1,298 | 9.3 s | 4/5 | **no** |
| short v2, run 1 | 5/5 | 783 | 1,307 | 5.8 s | 2/5 | yes |
| short v2, run 2 | 5/5 | 783 | 1,137 | 4.9 s | 4/5 | **no** |

By eye (all 30 screenshots): spirals fine everywhere. Stones: sand and water in
every run; the short file's framing rule helped once (short v1 run 2, the best
framing so far) and failed once (short v2 run 1, camera inside the stones);
short v2 run 2 added an invented title "Rannakivid". Charts: all 12 months
everywhere; the short file's abbreviations sometimes touch ("veebrmärts") and
once its rotated labels were clipped at the bottom; the full file's charts were
clean. Posters: all facts and three colours, but the short file dropped the
school name in 2 of 4 runs; the full file kept it in 2 of 2. Snow: falls and
piles in all runs.

Cost: Workers AI caches the prompt prefix for DeepSeek: after the first call,
576–1,152 of the input tokens are cache reads. The bill follows tokens out, so
the long instructions cost well under $0.0002 per page in the cloud. On the M1
the short file cuts uncached prefill from 6.5 s to 4.1 s per page (run 6).

Lessons: (1) the short file is no win for the cloud default: the same pass rate and
time, a negligible saving, and more small slips (school name, label spacing,
an invented title). The full file's redundancy (each rule said twice, with
reasons) seems to make rules stick. (2) For the M1 the 2.4 s faster first token
is real, but the M1 makes 1–2 good pages in 5 anyway (run 5). (3) Keep v0.3 as
the instructions; borrow the short file's concrete techniques (heading formula,
month abbreviations, camera distance) into a v0.4 of the full file and test
that 2–3 times.

## Run 8 (2026-10-22): instructions v0.4

`schools/eka/instructions.md` v0.4: v0.3 with the short file's concrete
techniques written into the full file's rules, about the same length (99
lines and ~850 words; v0.3 with Pictures was 93 and ~750). Method: v0.4 draft,
DeepSeek V4.1 Flash ×3 and Gemma 4 ×1 (`--tag r8-v04-*`); a fix for what the draft got wrong; the
fixed v0.4 again DeepSeek ×3 and Gemma ×1 (`--tag r8-v04b-*`). Compared by eye
with run 7's v0.3 (`r7-full-*`) and run 4's Gemma.

Draft → fix: the draft's camera rule divided the distance by the aspect ratio
on a portrait screen; with the fog the models add anyway, the stones vanished
(1 run blank, 1 tiny, Gemma's lost in `FogExp2`). The fix: FOV 45–50, ~3× the
subject's width, **no fog**. The draft also let a chart put its month labels on
the zero line, over the negative bars (fix: label axis at the bottom); a poster
used the heading formula with 0.62 instead of 0.75 and touched the edge (fix:
"keep the 0.75"); Gemma wrote "USTE PÄEVAD", dropping "Avatud" (fix: "copy them
word for word: no word dropped, no ending changed").

| Variant | Model | Pass | Tokens in | Tokens out (avg) | Avg time | Starts with ```html |
|---|---|---|---|---|---|---|
| v0.3, run 7 ×2 | DeepSeek | 9/10 (one load timeout) | 1,170 | 1,232 | 7.2 s | 8/10 |
| v0.4 draft ×3 | DeepSeek | 15/15 | 1,624 | 1,084 | 7.2 s | 14/15 |
| v0.4 final ×3 | DeepSeek | 14/15 | 1,679 | 1,019 | 5.9 s | 14/15 |
| v0.2, run 4 | Gemma | 4/5 (poster overflow) | ~855 | 1,009 | 21.0 s | 5/5 |
| v0.4 draft | Gemma | 5/5 | 1,748 | 1,013 | 16.7 s | 5/5 |
| v0.4 final | Gemma | 5/5 | 1,810 | 1,088 | 23.2 s | 5/5 |

Tokens in grew ~500 since run 7, mostly the Pictures section (added after run
7), not v0.4. Tokens out are 12–17% lower than v0.3, and DeepSeek is
slightly faster. The one failure: v0.4 final run 2's poster (scroll width 449 px).

By eye (all 40 screenshots, final v0.4 unless marked):

| Check | v0.3 (run 7) | v0.4 |
|---|---|---|
| School name kept (poster) | 2/2 | **8/8** (draft and final, both models) |
| Chart labels clear | 2/2, but run 2 used made-up "jaa, vee, mär" | **4/4** final: correct abbreviations, rotated, at the bottom (draft: 1 on the zero line) |
| Headings not broken | 2/2 | 3/3 DeepSeek; Gemma's poster no longer overflows (run 4 clipped "UNSTIAKADEEMI"), but an orange triangle covers the "D" of "AVATUD" |
| Nothing invented | 2/2 | 2/3 DeepSeek: run 2 added "Tule vaata / Avatud uksed" and joined it with `&nbsp;`, so the formula's N was wrong and it overflowed |
| 3D framing | close, stones cut at the edges (2/2) | **unchanged**: stones sharp, sand everywhere, water and sky in 2/3, but still cut at the edges; Gemma's stones half-sunk in water as in run 4 |
| Spiral, snow | fine | fine; Gemma's snow piles up |

Why 3D didn't move: the models write a fixed radius (8.5–15) and scatter the
stones over ~6–8 units, so "3× the subject's width" is never computed. The
fog ban took (no fog in any final run). Next to try: measure, don't estimate.
`new THREE.Box3().setFromObject(group)`, then set the radius from its size.

Decision: **keep v0.4.** It is better on the school name, the chart labels and
Gemma's poster, equal on 3D, and has one invented line in six DeepSeek
posters (v0.3 had none in two, so too few to call). Not deployed: the studio
bundles the file at its next deploy.

## Run 9 (2026-10-22): the M2 locally

Can the teacher's work Mac (M2 Pro, 32 GB, Ollama 0.40.8, MLX runner) make
pages without the cloud? `run.mjs --local <ollama url>` calls Ollama's OpenAI
endpoint directly with the same briefs and instructions (v0.4), thinking off,
and meters each page with macmon (`apps/pool/meter.mjs`, the m1-1 proxy's
method). It loads the model and caches the instructions before the first page,
waits a minute and for the GPU to be under 60 °C before each page, stops above
85 °C, and starts Chromium only between pages. The GPU memory limit is the
default (`iogpu.wired_limit_mb` = 0, about 2/3 of 32 GB, ~21 GB).

**Energy per token first** (`node apps/pool/meter.mjs`: the stones brief with
v0.4, 1,670 tokens in, 1,000 out, prompt cached; 11 runs, 3 of them after
cooling to under 60 °C):

| | tok/s | Chip power | Chip J / token | Net J / token | Whole machine |
|---|---|---|---|---|---|
| M2 · Qwen 3.5 9B (cooled ×3) | 35–36 | 23–28 W | 0.67–0.81 | 0.59–0.74 | 60–71 W, 1.7–2.1 J / token |
| M2 · Qwen 3.5 9B (all 11, median) | 33–37 | ~28 W | 0.79 | 0.65 | ~2.0 J / token |
| M1 · Qwen 3.5 9B (run 6) | 33–35 | | 0.97 | | |

Same speed as the M1 Pro (both have ~200 GB/s memory bandwidth), ~20–30%
less chip energy per token. Caveats: macmon 0.10.0 reports `ram_power` and
`gpu_ram_power` as 0 on this M2 Pro, so its chip figure leaves out memory
power; the whole-machine figure includes the display and the teacher's
running apps (Chrome, Teams, OrbStack: ~15–21 W at idle); two of the 11 runs
read 1.2 and 2.0 J / token while something else on the machine was busy, and
once that load also corrupted the idle baseline (net 0). The GPU went from
46 °C to 70–80 °C in each 28 s run.

**The pages: Gemma 4 26B-A4B** (`gemma4:26b`, the library's default build:
MLX, 16 GB pulled, with a draft model). One run, at the teacher's request to
keep the machine cool; Qwen 3.8 27B (18 GB, dense, ~4× the active weights)
was not tried.

| Model | Pass | Avg time | First token | Tokens out | tok/s | Net chip / page | Whole machine / page |
|---|---|---|---|---|---|---|---|
| **M2 · Gemma 4 26B-A4B** | **5/5** | **29 s** | 0.7–0.8 s (4.5 s first page) | 1,131 | ~39 | 503 J (0.14 Wh) | 1,068 J (0.30 Wh) |
| M1 · Qwen 3.5 9B (run 5) | 2/5 | 92 s | ~1 s | | | 2,173 J (0.6 Wh) | 4,157 J |
| M1 · Gemma 4 E4B (run 5) | 1/5 | 36 s | | | | 661 J (0.18 Wh) | 1,353 J |
| cloud · Gemma 4 26B-A4B, v0.4 (run 8) | 5/5 | 23.2 s | | 1,088 | | not measurable | |
| cloud · DeepSeek V4.1 Flash, v0.4 (run 8) | 14/15 | 5.9 s | | 1,019 | | not measurable (estimate ~0.1–1 Wh) | |

Pages of 21–38 s; the GPU ended each at 62–73 °C. Chip energy net of idle is
close to gross here (idle ~0.3 W on a quiet chip).

By eye (all 5 screenshots, `out/r9-m2-local/local_gemma4_26b/`):

| Brief | M2 · Gemma 4 26B |
|---|---|
| spiraal | good: a clean dotted spiral on black, fills the screen, one arm runs off the left edge (as cloud Gemma's did in runs 3–4) |
| kivid | weak: jagged low-poly stones on a flat teal plane under a pale sky; no sand, no morning light; framing fine (one stone cut at the right) |
| temperatuur | values and title right, all 12 bars; but the month labels sit on the zero line over the negative bars and collide ("jaanveebmärts"); odd abbreviations ("veeb", "dets") |
| plakat | poor: "AVATUD ÜSTEVEAD" (garbled "uste päev"), the school name dropped, a navy circle covers the address ("Põhja pst 7, Talli…") |
| lumi | good: snow falls and piles into drifts at the bottom |

Lessons: (1) **yes, this Mac can make pages locally**: 5/5 on the checks at
~30 s a page, 3× faster than the M1's best and close to cloud Gemma's time,
for ~0.14 Wh of chip energy (0.3 Wh whole machine), a quarter of the M1's
Qwen page. (2) Quality is cloud Gemma's, not DeepSeek's: 2 of 5 good by eye,
the chart breaks the v0.4 label rule, the poster garbles Estonian and drops
the school name. For students the cloud default stays; the M2 is a fair
fallback and a measured reference. (3) It serves through the pool as
`pool/gemma4-26b` (`plans/pool.md`), with 8.4 s to load the model cold. (4)
One run: rerun before trusting the by-eye verdicts, on a cool machine.
