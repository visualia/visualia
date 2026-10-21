# Infrastructure plan: collective coding without everyone paying

Draft 5, 2026-10-21.
Companion to `PLAN.md` §4. Researched 2026-10-20–21 in seven passes; **re-check
every price and free tier before the course starts.**

How twenty art and design students direct coding agents together: which models, which tools on which machines, how one shared
agent can take requests, and how every token and watt gets counted so block D
has a year of real data.

---

## 1. Eight calls this plan makes

1. **Free tiers are a bonus, never the floor.** Gemini CLI's free tier ended
   2026-06-18, Workers AI moved strong models off free on 2026-07-28, Copilot
   Student shrank to $2 of credit a month.
2. **One course gateway, one URL per student.** Cloudflare AI Gateway plus a
   Worker. Providers change behind it; laptops never need reconfiguring.
3. **Cheap strong open models by default.** GLM-5.3-Flash and Qwen3.8-27B score
   86–92 on SWE-bench Verified, rank near the top in Estonian, cost cents per
   session.
4. **Laptops are not the compute.** 16 GB machines can't run an agent loop
   reliably; local models are study material and a measured baseline.
5. **Your subscription stays yours.** Anthropic's terms forbid serving others
   from a Pro/Max account (enforced since early 2026). The shared agent runs on
   an EKA-owned API key.
6. **Students pick a level, not a tool.** Chat and preview by default, an
   editor or a terminal when they want it; same gateway, models and ledger at
   every level, because nobody knows the group's level until S1.
7. **A decision model in front of everything.** Clef-flash answers typed
   questions with probabilities in ~40 ms with no output tokens: it routes,
   checks, triages and grades, on the free tier or a 16 GB Mac.
8. **Store raw counts, convert with ranges.** Tokens by type and measured
   joules are the record; energy and CO₂ come from a versioned coefficient
   table, always shown low–high.

## 2. The shape

```
 course studio  ─┐                          ┌─ paid open models (OpenRouter org keys)
 (OpenCode/Cline) │                          ├─ school GPU box (vLLM via Tunnel)
 shared agent  ───┼──► course gateway ───────┼─ frontier, capped (EKA Anthropic key)
 queue (issues)   │    Worker + AI Gateway   └─ free tiers (Gemini API, :free) — bonus
                  │    Clef-flash decides route
 own subscriptions┘    cap · count tokens
 (Claude Code/Codex) ── OTel ──┐      │
                               ▼      ▼
                        ledger (D1): calls · joules · probes ──► live dashboard
                               ▲
                 Shelly wall-plug watts from the GPU box
```

AI Gateway has per-user **spend limits** (open beta since 2026-06): with
Cloudflare Access in front, every student gets a daily or monthly budget keyed
to their login, and an over-budget call can fall back to a cheaper model. Two
gaps the Worker fills: `tokens_in` doesn't separate cache reads, and cache hits
log zero tokens, so the Worker also parses each provider's `usage` object.

## 3. Models right now

SWE-bench Verified is near saturation (top 93–97%) and vendors quote different
Terminal-Bench versions; treat single scores as rough.

| Machine | Model | Speed | Verdict for agent work |
|---|---|---|---|
| 16 GB laptop | Ornith-1.0-9B / Qwen3.5-9B, 4-bit (5.6 GB) | 25–35 tok/s | Demos only; GPU gets ~10.7 GB, 64k context doesn't fit |
| 32 GB laptop | Qwen3.6-35B-A3B Q4 (~21 GB) | 32–46 tok/s | First usable tier; Aider polyglot 62% |
| 32 GB, patient | Qwen3.8-27B Q4 (17 GB) | 28–40 tok/s | Strongest small; SWE-bench Verified 86 (Vals) |
| GPU box 24–32 GB | Qwen3.8-27B Q4–Q6, 64k–128k ctx | 40–75 tok/s; 150–200 batched | Class server (RTX 5090 + SGLang/vLLM) |
| 64–128 GB Mac | Qwen3-Coder-Next 80B-A3B / Qwen3.8-Flash-Next | 30–45 tok/s | OK, vendor numbers only |
| Hosted | GLM-5.3-Flash · DeepSeek-V4.1-Flash · GLM-5.3 | — | Default; GLM-5.3-Flash: SWE-bench 92, #2 in Estonian |

**Where small models break:** tool-call formatting fails before reasoning
(malformed JSON, invented tools, ignored system prompts, drift after ~10
turns). Fast-but-wrong costs more than slow-but-right. Models are tied to the
harness they were trained on (Devstral 2: 82% HumanEval+, 4% on Aider's diff
format). Gemma 4 is good at Estonian, bad at agent work.

**Hosted prices** ($/M tokens in / out): GLM-5.3-Flash $0.05 / $0.12;
DeepSeek-V4.1-Flash $0.03–0.30 / $0.12–1.20; GLM-5.3 cheapest $0.08 / $1.40,
first-party $1.40 / $4.40 (cheap listings are fp4 and low-uptime: pin a
provider); Claude Sonnet 5.5 $2 / $10, cache reads $0.10.

**Free tiers, honestly:**

| Offer | Status | What students get | Data |
|---|---|---|---|
| Gemini API key | Best free | Flash models, ~1,500 req/day (unpublished); works in OpenCode/Cline/Aider; 18+ | EEA: no training |
| OpenRouter `:free` | Fragile | 50/day; 1,000/day after one $10 purchase; list changes weekly | Free endpoints may log |
| Copilot Student | Thin | $2 credit/month, Auto model only | Students exempt from training |
| Mistral Experiment API | EU option | Free, rate-limited, Devstral 2; Vibe Education €5.99/mo | Not verified |
| Gemini CLI free | Ended 2026-06-18 | Antigravity CLI with small unpublished quota | — |
| Groq, Cerebras, Workers AI free | Too small | Groq 8k tok/min < one OpenCode turn (~7.5k) | — |
| Claude Free / Codex Free | No agent | No Claude Code on Free; Codex CLI from Plus; $100 credit US/Canada only | Consumer plans train by default |

**Estonian:** EuroEval Estonian (2026-10-08) has GLM-5.3-Flash at rank 2, in the
GPT-5.6 / Gemini 3 Pro tier. Locally, Qwen3.6-27B and Qwen3.8-27B are good at
both Estonian and agent work. TartuNLP EstLLM-70B leads 70B models in Estonian
but has no tool calling: S3 language-probe material. The Tehisaru baromeeter
hasn't added 2026 models yet; the course could contribute votes.

## 4. How students work: three levels

We don't know the group's level or needs yet, so we don't decide it for them.
Every level uses the same course key, models and ledger; students move between
levels any time; mob agenting shows level 3 to everyone.

| Level | Open models (cheap) | Claude (EKA budget) | For whom |
|---|---|---|---|
| 1. Chat + preview | The course studio: chat projects for talking, page projects for making | Claude Desktop via the gateway (optional) | Default; never sees code unless they want to |
| 2. Editor | Cline in VS Code, or OpenCode web mode | Claude Code in VS Code | Wants to see and approve changes |
| 3. Terminal | OpenCode, or Claude Code with open models (unsupported) | Claude Code CLI | Already codes, or curious |

**Finding out who they are:** a five-minute intake form at registration
(discipline, AI used, ever opened a terminal, laptop and memory, what they want
to make); S1 as the real measure (everyone ships a page at level 1, probe
results on the dashboard); read the ledger after block A and adjust block B.
**Not only words:** level 1 rewards strong verbal describers (Harvard's
finding), so offer sketch/screenshot-to-page, voice briefs (Whisper covers
Estonian) and clickable Judgement Machines rubrics.

**Clients compared:**

| Client | Through our gateway | Open models | Preview | Verdict |
|---|---|---|---|---|
| **Course studio** (ours) | Built on it | Yes | Live iframe while streaming, then a public URL | **Level 1 for everything:** chat and making, one login, one ledger (`STUDIO.md`) |
| LibreChat | Yes; student email into `cf-aig-metadata` server-side | Yes | HTML/React/SVG/Mermaid artifacts, single file | **Fallback only:** if the studio isn't ready, or students need file search and research tools |
| Claude Desktop | Yes, third-party inference mode; no Anthropic accounts | Blocked since May 2026 (rejects non-Claude names) | Artifacts, built-in browser, Code tab | Claude only; optional premium client |
| Claude Code CLI / VS Code | Yes, `ANTHROPIC_BASE_URL` | Unsupported, not prohibited; documented by Z.ai, DeepSeek, Moonshot, Qwen, Ollama | Dev server | Levels 2–3, projector |
| Claude Code on the web | No | No | — | Out: needs each student's own plan |
| Open WebUI | Yes | Yes | Inline HTML | Comparable chat; branding licence past 50 users |

**Why LibreChat is only a fallback:** the studio already has login, classes,
per-student identity at the gateway, budgets from the ledger and a better
preview with publishing; general chat is a studio project type without the
publish tool (about a day). LibreChat would add a second stack (VPS, MongoDB,
releases every 3–6 weeks), a second login, a second UI and a second budget
system, and a ready-made chat app sits oddly in a course about building and
reshaping your own tools. It stays documented in case it's needed.

**LibreChat details (if used):** endpoint headers take placeholders
(`cf-aig-metadata: '{"user":"{{LIBRECHAT_USER_EMAIL}}"}'`), set server-side so
unspoofable; per-user credits with weekly auto-refill (1M credits = $1; every
model needs a `tokenConfig` price or is charged $6/M); `modelSpecs` with
`enforce: true` for a curated menu with its own artifact prompt. Limits:
single-file artifacts rewritten whole every turn; no publish button
([#14306 Standalone Artifact Publishing and Sharing](https://github.com/LibreChat-AI/LibreChat/pull/14306)
is an untested open PR);
[#16841 Tailwind preflight overrides the page's own CSS](https://github.com/LibreChat-AI/LibreChat/issues/16841);
previews use CodeSandbox's public bundler by default. Hosting: Node + MongoDB,
not Cloudflare — one 4–8 GB VPS (~€8–15/month) behind a Tunnel; pin one release
for the semester; skip the code interpreter. Untested: GLM/Qwen/DeepSeek with
the artifact format — pilot on ten course prompts.

**Claude Desktop via the gateway:** supported for Claude traffic (Commercial
Terms, no seat licences, Developer Mode or pushed config, prompts only to our
gateway). Settings: `inferenceProvider: gateway`, explicit `inferenceModels` of
Claude IDs, `chatTabEnabled: true`, per-user token cap, a web search provider.
Disguising open models as Claude (Ollama's workaround) bypasses a deliberate
check that already broke once — don't build on it.

## 5. Our studio platform

Built by us, inspired by VibeSDK, not forked. Full build plan: `STUDIO.md`.

**Why not fork:** the code no longer matches Cloudflare's blog — since July 2026
the default path is "Think" (one `@cloudflare/think` loop, a Durable Object
workspace per app, Dynamic Worker previews, no containers) and ~80% of 150k
lines is legacy; the rewrite has no release tag (last
[v1.5.0](https://github.com/cloudflare/vibesdk/releases/tag/v1.5.0), Feb 2026)
and lags its dependencies (Think 0.8 vs 0.21); model hardcoded to Gemini 3.6
Flash, step-counting "credits", no per-student identity, no roles, no Estonian
([#383 Add support for multiple languages](https://github.com/cloudflare/vibesdk/issues/383)
closed as "raise a PR"). Fork ≈35–45 days vs own ≈32–40, usable single-file
version after ≈15.

**Ours:** one Worker; D1 (users, classes, projects, versions, ledger, skills);
R2 for `projects/<id>/<sha>/index.html`; one Think agent per student project.
Default mode without a sandbox: Clef-flash decides tier / in-brief / clear, a
cheap model streams one `index.html` rendered live in an iframe, saved to R2 and
published at `/p/<student>/<slug>/` on a separate user-content domain. Checks in
a real browser (no console errors, canvas not blank, fits 375 px) with one
auto-fix. Advanced multi-file mode only on request. Running cost: platform
~$5–40/month; models ~$10/month single-file, $40–300/month if everyone uses the
agent loop on cheap models.

**Skills, positron-style:** Think uses the Agent Skills format, so one
`skills/<name>/SKILL.md` folder (synced to R2) works in the studio, Claude Code
and OpenCode. `eka-house` always on; Clef-flash scores the rest per request;
template skills `p5-sketch`, `three-scene`, `d3-dataviz`, `interactive-poster`;
`verify-preview` with negative controls; teacher distils class failures into
skills, students draft their own for promotion; the ledger records skill
versions per turn.

**The stack:** course studio (chat and making) + Claude Code / OpenCode
(projector, advanced); LibreChat only as a fallback — one gateway, one
ledger, one skills folder.

**Risks:** cheap models in Estonian; platform churn (Think, Dynamic Workers,
Clef all beta or 0.x — pin before the course); student code on public URLs (separate
domain, abuse controls, GDPR, OIDC availability).

## 6. Decision models

A new category: TypeSafe's Jev live 2026-09-15, Cloudflare's **Clef**
2026-10-01 (https://blog.cloudflare.com/clef-decision-models/), request format
(`/v1/systemone`) a de facto standard within weeks.

A decision model doesn't write. Give it a situation (text, JSON, images;
Clef-omni also audio and video) and typed questions — **yes/no** (`noul`),
**pick one** (`choice`), **score** (`score`) — and it returns a probability for
every allowed option from one forward pass. No output tokens, tens of ms.

| Model | Size | Hosted latency | $/M input | Free 10k neurons/day ≈ | Local |
|---|---|---|---|---|---|
| **Clef-flash** | 9B (Qwen3.5) | 39 ms median | $0.038 | 2.9M tokens | 16 GB Mac (MLX 4-bit, 7 GB peak) |
| Clef | 27B (Qwen3.8) | 150–210 ms | $0.24 | 460k | 32 GB Mac (MLX 4-bit, 16 GB) |
| Clef-omni | 30B MoE, 3B active | 20–300 ms | $0.15 | 730k | text, image, audio, video |
| Clairic (preview) | — | — | $0.10 | 1.1M | extracts typed values (numbers, dates, p10–p90) |

All Apache-2.0 on Hugging Face; latencies are Cloudflare's. Up to 64 questions
and 4 images per request. Trained at 16k context, so hosted 64k is probably
beyond the tested range. Fine-tuning: design-partner RL programme only.

**Local:**
- Ollama ≥ 0.35.1: `ollama pull clef-flash`, POST to `/v1/systemone` (chat
  endpoint gives no decisions).
- llama.cpp ≥ b11430: `llama-server -hf bartowski/Cloudflare_clef-flash-GGUF:Q4_K_M`
  (5.3 GB); a Q5 build runs on an 8 GB GPU at 99.8% agreement with bf16.
- MLX: `mlx-community/clef-flash-4bit` + bundled `clef_mlx.py` (0.3 s at 1k
  tokens on M5 Max). Plain `mlx_lm.generate` gives meaningless text.
- Any other model: one-token answer + next-token logprobs of the options
  (llama.cpp `n_probs`, Ollama `logprobs`). Cheap, not calibrated.

```ts
const r = await env.AI.run("@cf/cloudflare/clef-flash", {
  state: "Request: 'Make the poster more brutalist, keep the palette.' Brief: A2 poster, EKA open day, #111/#F2E600.",
  questions: {
    in_brief: { type: "noul",   instructions: "Is the request within the brief?" },
    tier:     { type: "choice", instructions: "Which model is needed?",
                criteria: { small: "Simple edit or lookup", frontier: "Multi-step reasoning or large change" } },
    clarity:  { type: "score",  instructions: "How clear is the request?",
                criteria: ["Unclear", "Partly clear", "Clear"] }
  }
}, { gateway: { id: "course" } });
// r.answers.tier.probabilities → { small: 0.88, frontier: 0.12 }
```
Assembled from the docs, not yet run.

**Evidence:** the one independent study (Ibrahim & Zaki, arXiv 2609.24574,
2026-09, on the first commercial decision model) found it trailed the best LLM
on 14 of 15 annotation tasks by a median 11.6 F1, at 44× lower cost; its
confidence was better calibrated than 16 of 19 LLMs' self-reports; on empathy
it was confidently near chance. Best pattern: decision model as gatekeeper,
escalating uncertain items to an LLM — LLM-level quality at 25–50% of the cost.
Clef has no published calibration curve and nothing on Estonian.

**Where it goes:**

| Job | Questions | Default |
|---|---|---|
| Gateway routing | Which tier? How hard? Escalate only on low confidence | Clef-flash, free tier |
| Policy checks | Course policy as yes/no; Llama Guard 3 or Qwen3Guard (119 languages) as backstop | Clef-flash + guard |
| Agent self-check | "Is this edit within the brief?" before each tool call | Clef-flash |
| Queue triage | Clear? In scope? Duplicate (embeddings first, Clef on top 3)? | Clef-flash |
| Probe grading | Rubric scores for `eka-probe` and Estonian probes | Clef 27B after an Estonian calibration set |
| Ledger tagging | Task type for the labour analysis; Clairic extracts minutes, cost, dates | Clef-flash + Clairic |

**Exercise — Judgement Machines:** students write a decision schema (critique
rubric, "is this AI-made?", "is this kitsch?", "does this follow the brief?"),
run it over their own and each other's work (images via Clef, video via
Clef-omni), draw the probability distributions on the shared canvas, and find
where it is *confidently wrong*. Free on the free tier.

**Alternatives:**

| Model | Open | Size | Laptop | Questions | Note |
|---|---|---|---|---|---|
| Liquid d1-3B / d1-omni-600M | LFM licence | 3.1B / 0.6B | yes, also Pi/Jetson | any | ~8 ms on 4090; omni takes voice; block C |
| AWS Strands Decider 2B | Apache-2.0 | 2B | yes | any | training data published |
| Kev | Apache-2.0 | 0.8–27B | yes | any | 51 ms at 9B |
| OpenAI Decisions API | no | — | no | any | public beta, $0.10/M input |
| TypeSafe Jev | no | — | no | any | the original; 262k context; waitlist |
| Qwen3Guard / Granite Guardian | Apache-2.0 | 0.6–8B | yes | fixed / own criteria | safety only |
| Arch-Router, RouteLLM | yes | 1.5B | yes | route labels | routing only |

Pin versions: runtimes and APIs are weeks old. Claims beyond Clef come from
vendor posts and one roundup, not all re-verified.

## 7. Other new kinds of models

| Kind | What it is | Try it with | Exercise |
|---|---|---|---|
| Diffusion text | Whole answer refined from noise; >1,000 tok/s | DiffusionGemma 26B-A4B (open, MLX, 32 GB); Mercury 3 via OpenRouter | Text emerging step by step as typography (B) |
| World models | Playable video world, frame by frame | Odyssey-3 free preview; HY-World 2.0 (open) on GPU box; Decart Lucy via fal | Export to WebXR; critique physics hallucinations (C) |
| Hybrid / state-space | Running memory instead of full attention; long context, less energy | Qwen3.8, Nemotron 3 (Workers AI), Liquid LFM2.5 | Memory vs context length, hybrid vs transformer (D) |
| Tiny recursive | 7M-param net that thinks in loops | Samsung TRM on GPU box | Train on student pattern puzzles; animate passes (A, B) |
| Voice and music | Realtime voice agents; open music | `@cloudflare/voice` + Whisper (Estonian STT); ACE-Step 1.5 (<4 GB) | Voice persona; missing Estonian TTS as a lesson (C) |
| Tokenizer-free | Reads bytes, no Estonian token premium | Meta BLT | ET vs EN tokens across tokenizers vs bytes (D) |
| JEPA | Predicts meaning in embedding space | V-JEPA 2 (open) | Concept talk |

**Cloudflare gaps:**
- No GPU in Containers/Sandbox (CPU only, ≤4 vCPU, 12 GiB): the school box
  stays necessary for own models.
- No video generation, diffusion text or world models on Workers AI; AI Gateway
  routes to fal, Replicate, OpenRouter.
- FLUX.2 klein 4B is on the free tier, roughly 100 images/day per account (my
  estimate).
- No Estonian TTS on Workers AI; Whisper handles Estonian STT.
- Cloudflare for Students is US .edu only: budget Workers Paid at $5/month per
  account needing paid-only models, or prepaid AI Gateway credits.

## 8. What to install, where

| Where | Install | Why |
|---|---|---|
| Every laptop | A browser | Level 1: the studio is a web page |
| Levels 2–3 | git, Node LTS, Cline or **OpenCode** | Deploys (`npx wrangler`), projects, editor or terminal harness |
| Laptops ≥ 32 GB | Ollama, `OLLAMA_CONTEXT_LENGTH=64000`, Qwen3.6-35B-A3B | Local agent work, S2 comparison |
| Laptops 16 GB | Ollama ≥ 0.35.1 with `clef-flash`, optionally a 9B chat model | Decision models run well; demos, Estonian probes |
| Macs that measure (opt-in) | `macmon` as a LaunchAgent | Package power without sudo |
| No-install fallback | Browser + per-student cloud sandbox | Works from week 1 on any laptop |
| School GPU box | vLLM or SGLang (patched), `cloudflared`, Zeus, Shelly plug | Serves the class; measured at the wall |

**Is OpenCode needed?** Only at level 3, for those who choose it; level 1 installs nothing. For level 3 any harness with a custom
OpenAI-compatible base URL works. What matters is one harness for everyone at
that level. OpenCode: open source, any provider, server/web mode for the fallback,
and its $10/month Go plan (GLM-5.3, Kimi K3, Qwen3.8, DeepSeek V4.1 Flash) as a
ready backup. **Cline** in VS Code for a group that finds a terminal too much.
Final choice from the probe: same six tasks, OpenCode vs Cline, same two models.

**Runtime pitfalls:**
- Ollama's default context is 4k under 24 GB VRAM; a context size sent via the
  OpenAI endpoint is silently ignored. Set the env var; check `ollama ps`.
- llama.cpp needs `--jinja` or there are no tool calls; Qwen XML tool-call
  parser bugs are open.
- LM Studio can't override broken chat templates (breaks Qwen3-Coder-Next with
  OpenCode).
- vLLM: most reliable tool calls, right class server; its `qwen3_coder` parser
  had an RCE advisory — run a patched version.

**`eka-probe`** (S1, every student; reuses `leaderboard-runner` and positron's
`evals/`): machine profile; what fits (~0.6 GB per B params at 4-bit +
context); prompt/generation tok/s on 2–3 candidates; six machine-checked tasks
(button colour; fix a broken page from its error; Estonian cultural question;
two-step plan without wandering; **say "I can't" when the file doesn't exist**;
valid tool-call JSON ten times); joules per task (macmon / NVML).

## 9. The shared agent

Nobody has done this in an art school: Harvard, Brown and Cooper Union gave
each student their own account.

**Not on a Pro/Max subscription.** Claude Code's compliance page: Anthropic
does not permit routing requests through Free/Pro/Max credentials on behalf of
other users; consumer terms bar making an account available to anyone else;
enforced since 2026-01. Sanctioned: an API key billed to its owner, used by the
owner's own authorised users — an **EKA-owned Console account for EKA
students**. A key in Kristjan's name serving students is close to the
"intermediate usage" clause: ask Anthropic first.

| Form | Runs on | How | Verdict |
|---|---|---|---|
| Mob agenting | Own subscription | Claude Code on the projector; class writes the brief, argues over the diff | From S1 |
| Issue queue | EKA API key, capped | GitHub issues / `/slash` comments; GitHub Agentic Workflows (gh-aw) under daily credit caps, writes via safe outputs, opens PRs | Once funded; restrict triggers to class |
| Room agent | EKA API key | Durable Object queue + chat, Sandbox SDK runs headless Claude Code, AI Gateway caps; VibeSDK as start | Block B student project |

**Borrow from:** GitHub Next's **Ace** (session = branch on a cloud VM; many
people, one agent, one chat; shared plan edited *before* acting — apply for
early access: https://forms.office.com/r/GTNAYXrWg8); **Claude Tag** (one Claude
per Slack channel, Team plan beta); **Replit Agent 4** (per-person forks,
shared Kanban, merge after review); **Cursor's warning case** (follow-ups run
as the starter's identity — the queue must record who asked); **Claude Code
GitHub Action** (2026 hijack flaw fixed in v1.0.94 — public queues need trigger
allowlists).

## 10. Measuring the impact we promise

The year's footprint will be dominated by agent sessions and laptop
manufacture, not chat. Rough course-year ranges (kg CO₂e, my synthesis):
agentic coding 100–1000; GPU box 70–300; laptop manufacture share 80–250; chat
and local 1–30.

**Why agent sessions dominate:** a chat prompt is ~0.24–0.34 Wh (Google,
OpenAI). An agent session re-reads its context every step: one 8-week log of
3.2B tokens was 96% cache reads, 0.4% output, ~0.6 kWh per median session
(0.25–1.2), ~600 chat prompts (Hausfather, 2026-08). Another analysis: ~41 Wh
per session (Couch, 2026-01). The 10× gap is the unknown energy of a cache read.

**Two pipelines, one ledger:**

| Source | Captured by | What we get |
|---|---|---|
| Gateway calls | Worker logs + parses provider `usage` | Fresh input, cache read/write, output, reasoning tokens |
| Claude Code subscriptions | OpenTelemetry → Worker | `claude_code.token.usage` by type/model; `claude_code.api_request`; prompt text off |
| Codex subscriptions | `[otel]` in `~/.codex/config.toml` | `codex.api_request`, token counts |
| Audit, all harnesses | `ccusage --json` weekly, opt-in | OpenCode, Gemini, Goose + 16 more |
| Local, Macs | macmon per request, idle baseline subtracted | Measured joules |
| School GPU box | NVML energy delta + Shelly plug every 2–5 s | Measured joules, whole-box truth |

```sh
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_PROTOCOL=http/json
OTEL_EXPORTER_OTLP_ENDPOINT=https://<course-worker>
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <student-key>"
```
Claude Code sends the account email by default: pseudonymise in the Worker.
Deduplicate on `request_id`; for a local call count device joules *or* a token
coefficient, never both.

**Coefficient table v1** (Wh per 1k tokens, low / central / high, incl.
datacentre overhead; versioned, recompute on change — EcoLogits changed its
models 2025-11 and 2026-03):

| Class | Output | Fresh input | Cache read |
|---|---|---|---|
| Small open (≤10B active) | 0.02 / 0.05 / 0.2 | ~1/10 of output | ~1/10 of input |
| Mid open (30–70B or MoE ~30B active) | 0.1 / 0.2 / 0.5 | 1/10–1/5 of output | ~1/10 of input |
| Frontier closed | 0.3 / 1 / 10 | 0.05 / 0.2 / 0.4 | 1–25% of input |
| Agentic session, blended | 0.02–0.1 Wh per 1k processed · 40–600 Wh per session | | |

CO₂: Estonia ~320–370 g/kWh (2025) but hourly swings are large — use hourly
Electricity Maps data for local inference (free non-commercial key, academic
access on request). Cloud location unknowable: assume US-East 350–400 g with a
range. Lead with location-based; market-based runs ~3× lower.

**Beyond energy:**

| Impact | Measure | Why |
|---|---|---|
| Money | Gateway cost + API-equivalent of subscriptions (ccusage) | Flat fee vs real cost |
| Time | METR-style paired tasks with/without AI; forecast then record | METR 2025: 19% slower while feeling 20% faster |
| Learning | Concept quiz after AI and no-AI tasks | Anthropic RCT 2026-01: 17% lower scores with AI |
| Estonian | Token premium on FLORES-200 ET vs EN per model | A "small culture tax" students compute |
| Deciding vs writing | Joules for one Clef pass vs a generated answer, same input, on a Mac | Gatekeeper pattern as energy strategy, our numbers |
| Labour | Classify our logs by task, Economic Index style | Block D's "AI doing the dishes" from our own data |

**Dashboard rules:** ranges, never precise numbers (1–2 significant figures);
totals beside per-prompt figures; our own comparisons (idle laptop hour, GPU
box day, Tallinn tram ride), not kettles; show the unmeasured share; label the
scope of every figure; everything in UTC.

## 11. Budget scenarios

About 1,200 sessions a year (20 students × 2/week × 30 weeks).

| Budget | Buys | Risk |
|---|---|---|
| €0 | Gemini API free keys, OpenRouter `:free`, mob agenting, local where it fits | High |
| ~€300 | Course OpenRouter org, per-student key limits; GLM-5.3-Flash / DeepSeek-V4.1-Flash at ~$0.05–1 per session (~$60–600/yr); Shelly plugs | Medium (pin providers) |
| ~€1,500 | + capped frontier budget (Sonnet 5.5, $1–3/session) for group builds via the issue queue: ~150–450 runs | Low (spend limits) |
| ~€6,000+ | + school GPU workstation (RTX 5090, 32 GB) serving Qwen3.8-27B (price my estimate) | Low |

Fixed costs on every tier: studio on Cloudflare ~$5–40/month (plus a
LibreChat VPS ~€8–15/month only if the fallback is used).

Data protection: Anthropic's direct API has no EU processing — DPA with SCCs,
or Bedrock Frankfurt. Students 18+ (Anthropic and Google). Metadata-only logs by
default, pseudonymous IDs via Access, opt-out without grade effect.

## 12. Open questions

1. Budget tier.
2. EKA IT: VR lab GPUs; install rights and outbound tunnels.
3. Who owns the API account: EKA (clean) or Kristjan (ask Anthropic).
4. Logging policy: counts only, or prompt content by opt-in; who sees
   per-student rows.
5. Public or class-only dashboard.
6. EKA login: does it offer OIDC?
7. Any students under 18.

## Sources

Gathered 2026-10-20–21. Vendor benchmark claims are marked as such in the
tables; items marked "not verified" were not confirmed against a primary source.

**Models and free tiers**
- [Vals AI SWE-bench Verified](https://www.vals.ai/benchmarks/swebench) (updated 2026-09-01)
- [EuroEval Estonian leaderboard](https://euroeval.com/leaderboards/Monolingual/estonian/) (2026-10-08) · [Tehisaru baromeeter](https://baromeeter.tartunlp.ai) · [EstLLM-70B](https://huggingface.co/tartuNLP/Llama-3.1-EstLLM-70B-Instruct-0826)
- [LLMKube: Aider polyglot on M5 Max](https://llmkube.com/blog/m5-max-aider-polyglot-and-finops) · [failure modes on a 24 GB GPU](https://gist.github.com/hungson175/61a805368649c225026a69adf2ad87e0) · [16 GB Mac guide](https://modelfit.io/blog/best-llm-for-16gb-mac/)
- [OpenRouter limits](https://openrouter.ai/docs/api/reference/limits) · [Groq limits](https://console.groq.com/docs/rate-limits) · [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Gemini CLI free tier ending](https://github.com/google-gemini/gemini-cli/discussions/27274) · [Gemini API terms](https://ai.google.dev/gemini-api/terms) · [Copilot training exemption](https://github.com/orgs/community/discussions/188488)
- [Ollama context length](https://docs.ollama.com/context-length) · [llama.cpp Qwen tool-call bug #21158](https://github.com/ggml-org/llama.cpp/issues/21158) · [vLLM advisory](https://github.com/vllm-project/vllm/security/advisories/GHSA-79j6-g2m3-jgfw)

**Decision models and new model types**
- [Introducing Clef](https://blog.cloudflare.com/clef-decision-models/) (2026-10-01) · [Clef-omni and price cut](https://developers.cloudflare.com/changelog/post/2026-10-09-clef-omni-workers-ai/) · [Clef-flash model card](https://huggingface.co/Cloudflare/clef-flash)
- [Ibrahim & Zaki: decision model vs 19 LLMs](https://arxiv.org/abs/2609.24574) · [How decision models became a category](https://www.kai-waehner.de/blog/2026/10/20/how-decision-models-became-a-new-ai-category-after-jev/)
- [llama.cpp #29831 model: add support for clef decision model (text-only)](https://github.com/ggml-org/llama.cpp/pull/29831) · [Ollama clef-flash](https://ollama.com/library/clef-flash) · [MLX 4-bit port](https://huggingface.co/mlx-community/clef-flash-4bit) · [Liquid d1](https://www.liquid.ai/blog/d1-open)
- [DiffusionGemma](https://ai.google.dev/gemma/docs/diffusiongemma/model_card) · [HY-World 2.0](https://github.com/Tencent-Hunyuan/HY-World-2.0) · [TRM](https://github.com/SamsungSAILMontreal/TinyRecursiveModels) · [Workers AI models](https://developers.cloudflare.com/workers-ai/models/)

**Clients and platforms**
- [Claude Desktop gateway](https://claude.com/docs/third-party/claude-desktop/gateway) · [configuration](https://claude.com/docs/third-party/claude-desktop/configuration) · [#56990 Desktop 1.6259.1 adds model name validation that rejects non-Anthropic model names](https://github.com/anthropics/claude-code/issues/56990)
- [Claude Code LLM gateway](https://code.claude.com/docs/en/llm-gateway) · [Ollama Claude Desktop integration](https://ollama.com/blog/claude-desktop)
- [LibreChat](https://github.com/LibreChat-AI/LibreChat) · [artifacts](https://www.librechat.ai/docs/features/artifacts) · [token usage and balance](https://www.librechat.ai/docs/configuration/token_usage)
- [VibeSDK](https://github.com/cloudflare/vibesdk) · [launch post](https://blog.cloudflare.com/deploy-your-own-ai-vibe-coding-platform/) (describes the pre-Think architecture) · [cloudflare/agents](https://github.com/cloudflare/agents) (agents, Think)

**Shared agents, terms, teaching**
- [Claude Code legal and compliance](https://code.claude.com/docs/en/legal-and-compliance) · [Anthropic consumer terms](https://www.anthropic.com/legal/consumer-terms) · [Commercial terms](https://www.anthropic.com/legal/commercial-terms)
- [GitHub Next: zero alignment](https://githubnext.com/talks/one-developer-two-dozen-agents-zero-alignment/) · [Maggie Appleton on Ace](https://maggieappleton.com/zero-alignment) · [GitHub Agentic Workflows](https://github.github.com/gh-aw/)
- [AI Gateway spend limits](https://developers.cloudflare.com/ai-gateway/features/spend-limits/) · [Sandbox SDK + Claude Code](https://developers.cloudflare.com/sandbox/coding-agents/claude-code/)
- [Harvard T564A](https://news.harvard.edu/gazette/story/2026/04/vibe-coding-may-offer-insight-into-our-ai-future) · [Brown Agentic Studio](https://www.brown.edu/news/2026-06-11/agentic-studio-ai-programming) · [Type@Cooper](https://coopertype.org/events/designing-with-coding-agents)
- [GWDG/KISSKI Chat AI](https://gwdg.de/en/news/2026-04-aktualisierung-unserer-ki-dienste/) · [HAWKI](https://hochschulforumdigitalisierung.de/hawki-interaktion-mit-ki-systemen/)

**Impact measurement**
- [Hausfather: the real energy use of agentic AI](https://www.theclimatebrink.com/p/the-real-energy-use-of-agentic-ai) (2026-08) · [Couch: Claude Code impact](https://simonpcouch.com/blog/2026-01-20-cc-impact/) (2026-01)
- [Google: Gemini per-prompt footprint](https://arxiv.org/abs/2508.15734) · [Epoch AI](https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use) · [Mistral LCA](https://mistral.ai/news/our-contribution-to-a-global-environmental-standard-for-ai)
- [EcoLogits methodology](https://ecologits.ai/latest/methodology/llm_inference/) · [ML.ENERGY](https://ml.energy/leaderboard/) · [AI Energy Score v2](https://huggingface.co/blog/sasha/ai-energy-score-v2)
- [macmon](https://github.com/vladkens/macmon) · [Zeus for Apple Silicon](https://github.com/ml-energy/zeus-apple-silicon) · [Shelly local API](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch/)
- [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage) · [ccusage](https://github.com/ryoppippi/ccusage) · [AI Gateway logging](https://developers.cloudflare.com/ai-gateway/observability/logging/)
- [METR uplift update](https://metr.org/blog/2026-02-24-uplift-update/) · [Anthropic coding-skills RCT](https://www.anthropic.com/research/AI-assistance-coding-skills) · [Electricity Maps API](https://app.electricitymaps.com/docs)
