---
status: idea
---

# Local coding: local models in the page creator, and other harnesses on a studio project

Written 2026-11-22. Nothing built, installed, downloaded or run for it. **READ** = read on the cited page.
**VERIFIED (code)** = checked in this repository's files today. **INFERRED** = reasoned from those. Nothing about a
harness or a model was tried on a machine here.

## In short

The page creator already is a coding harness: a tool loop over a file system, always-on instructions, a check after
every version, a fix request from the preview's errors, versions in R2 and a usage row per model call. So no other
harness goes inside it. Local coding joins the studio in four places:

| Join | What | Blocked on |
| --- | --- | --- |
| A | a local model inside the studio's own loop, through the pool and "my computer" | the pool passes plain text only, no tools |
| B | an outside harness (OpenCode, Claude Code, Codex...) works on a studio project and hands it in as a version | MCP step 2, which waits for the class |
| C | the studio's page checks as an MCP tool, so any harness gets the same verification | the four checks exist only in the eval |
| D | one source for instructions and skills, given to the studio and exported to every harness | the instructions live in three places; no skills yet |

Recommended outside harness for students: **OpenCode**, with Cline for those who want VS Code. Reasons in section 6.
The first thing worth doing is A's eval on the M2, because it needs no install and the harness for it already exists.
Kapitsa, a Mac-only model server that also speaks the Ollama API with tools, is a candidate engine beside Ollama once
its signing is known; six of its design choices are worth copying either way (section 2).

## 0. What is already there (checked today)

- **The loop.** `apps/studio/src/agent.js`: `createPiTools({ workspace, root, exec: {} })`, at most `MAX_STEPS = 6`
  model calls a turn, each a streamed `/v1/chat/completions` call through the gateway with `tools`, `tool_choice` and
  `parallel_tool_calls: true`, thinking off; a write-only step ends the turn; 429 on `PAGE_MODEL` falls back to
  `@cf/google/gemma-4-26b-a4b-it` with `tool_choice: required` on the first step, and Gemma's `edit` calls are guarded.
  VERIFIED (code).
- **The words.** The system message is `page-system` plus `page-instructions` from `promptsFor(env, school)`
  (`apps/studio/src/prompts.js`): the course default, or the school's own text from D1 `prompts` when the teacher has
  changed it (`plans/prompts.md`). The default is `apps/studio/src/instructions.md`, a copy of
  `schools/eka/instructions.md` (identical today, `diff` clean; a copy, not a link). VERIFIED (code).
  `studio-core.md` still says `configureContext`; that was the Think design, the code no longer uses it.
- **Skills.** `skills/README.md` says course skills live there in the Agent Skills format, "usable as-is in Claude
  Code and OpenCode". The folder holds only the README; `schools/eka/skills/` is empty. The studio loads no skills
  (`studio-core.md` "Not in it"). VERIFIED (code).
- **Checks.** The four page checks (html, clean, visible, fits) run only in `evals/first-pages/run.mjs`, in headless
  Chromium. The studio has its own: the preview reports errors back (fix requests), and after each version a Browser
  Rendering screenshot at 375 x 812 goes to Clef-flash for the match score (`studio-core.md`). VERIFIED (code, plans).
- **The pool takes no tools.** `cleanMessages` in `apps/pool/src/index.js`: "Plain text chat only: images, tools and
  other parts stay with the cloud"; any message that is not a string `system`, `user` or `assistant` makes the job
  go to the cloud. `pool-core` (the Rust app) has no tool handling either. `gemma4-26b` jobs are capped at 48,000
  characters in and 8,000 tokens out; the studio asks for 16,000. VERIFIED (code).
- **`only: 'mine'`** (a job only for the asker's own computer, `research/local-multimodal.md` section 3) is not built.
  VERIFIED (code: no match in the pool or gateway).
- **The gateway speaks OpenAI only**: `POST /v1/chat/completions`. No `/v1/messages`, so Claude Code cannot point at
  it as it stands. VERIFIED (code).
- **The MCP server is read-only** (`list_work`, `get_project`, `read_chat`, `usage_summary`) and registers no MCP
  prompts. VERIFIED (code, `plans/mcp.md`).
- **Local Gemma already did multi-file tool calls once.** `evals/multi-file/capture.mjs --local` on the M2 (Ollama
  0.40.8, `gemma4:26b`, 2026-10-22): every finished call parsed as valid JSON, all four files in one reply, each call arriving whole
  at the end rather than streamed; one of two edits wrong (it replaced `main {...}` with `main h1 { color: red; }`);
  the big page stopped when the GPU reached 85 °C after 217 s; a four-file turn 19 to 33 s, 351 to 848 J net
  (`plans/multi-file.md`, Capture). READ (plan and `out/local-turns.json`).

## 1. Why not put OpenCode (or any harness) inside the studio

- **It would be a second loop around the first.** Everything that makes the studio worth using sits in the loop:
  the school's prompts, versions per turn, usage per call with the person and project, the fix request, the checker,
  live file deltas to every viewer. A harness inside would either replace those or be wrapped by them. INFERRED.
- **It needs a shell and a disk.** OpenCode, Codex, Claude Code and Goose are local programs with their own file tools
  and a shell. The studio's agent is a Durable Object with a Workspace in SQLite and `exec: {}` (no execution). Running
  a harness there means a container or sandbox per project, a new cost and a new attack surface for a class.
  INFERRED (from `multi-file.md` section 1, Execution backends).
- **Where the harness helps is on the student's machine.** That is join B, through MCP, not embedding.
- **What to take from them instead:** their file formats (AGENTS.md, SKILL.md) and their habits (read before edit,
  check after write). That is join D.

## 2. Join A: a local model inside the studio's loop

The design in `local-models.md` holds: **the agent hands out jobs; whoever is connected does them.** What is missing is
tools on the way to a local model.

**Route.** The studio already calls the gateway with OpenAI `tools`. The gateway sends `pool/<model>` to the Pool. Today
the Pool drops anything with tools to the cloud. Change, in order:

1. **Pool:** let `tools`, `tool_choice` and `tool` / `assistant.tool_calls` messages through for node workers (never
   tabs: a tab has a 4,096-token context). Raise the `gemma4-26b` caps to what a turn needs (16,000 tokens out; the
   prompt plus four files is 20 to 60 KB). INFERRED effort: half a day.
2. **Worker app (`pool-core`):** pass them to Ollama's `/api/chat` (`tools` is part of Ollama's native chat API), and
   send the reply's `tool_calls` back whole in OpenAI shape. Ollama sends each call complete, so the studio renders
   the file on `tool-done` instead of streaming it (already noted in `multi-file.md` Next). INFERRED effort: one day,
   plus a signed release.
3. **Studio:** a page model setting per project or per person (cloud default, `pool/gemma4-26b`, later `mine/...`);
   keep the 429 fallback and add "worker left" fallback to the cloud mid-turn, as the Pool already does for text.
   The edit guard applies to every Gemma, local or cloud. INFERRED effort: half a day.
4. **`only: 'mine'`** so a student's own computer serves only that student, with no paid fallback
   (`local-multimodal.md` section 3). INFERRED effort: half a day in Pool and gateway.

**Usage and energy** come for free on this route: the pool part's usage row already carries `energy_j`,
`energy_net_j`, `sys_energy_j` from the worker's macmon meter (`pool.md`). One row per step, as for the cloud.

**Which local model.** The eval in section 7 decides. Today's facts:

| Model | Size, active | Tool evidence | On the M2 (32 GB, ~21 GB GPU share) |
| --- | --- | --- | --- |
| Gemma 4 26B-A4B (`gemma4:26b`) | 25.2B, 3.8B active, 256K; Apache 2.0 | card: "native support for structured tool use", tau2 68.2 % (31B: 76.9 %), no BFCL. READ ([card](https://huggingface.co/google/gemma-4-26B-A4B-it)). Ours: tool calls valid, edits unreliable (section 0) | installed, 16 GB; pages 5/5 at ~30 s (`first-pages.md` run 9) |
| Qwen3-Coder-30B-A3B (`qwen3-coder:30b`) | 30.5B, 3.3B active, 256K, non-thinking only; Apache 2.0 | card claims agentic coding and tool calling, gives no BFCL or tau figure. READ ([card](https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct)) | not installed; about 19 GB at Q4 (INFERRED), so tight beside a KV cache |
| Qwen3.8 27B (`qwen3.8:27b`) | dense, 262K; Apache 2.0 | Ollama tags it tools, vision, thinking (READ, [Ollama](https://ollama.com/library/qwen3.8)); Unsloth's GGUFs fix nested-object tool parsing (READ, [Unsloth](https://unsloth.ai/docs/models/qwen3.8)); no BFCL found | not installed; 17 GB at Q4 (`INFRA.md`), dense so about 4x slower per token than the MoE models; cloud Qwen 3.8 was cut at 300 s on big pages |
| Inkling 2 Mini (`inkling-2-mini`) | 26.4B, 3.4B (card) or 5.4B effective (Ollama) active; Apache 2.0 | Ollama: "agent tool use 82.7 %", benchmark unnamed (READ, [Ollama](https://ollama.com/library/inkling-2-mini)); the card warns it is "less reliable than larger models at following detailed instructions" with tools and "may perform destructive actions without confirmation" (READ, [card](https://huggingface.co/thinkingmachines/Inkling-2-Mini)) | not installed; 20 GB, fits only alone (`research/inkling-2-mini.md`) |

No BFCL figure was found for any of the four. INFRA.md's warning stands: small models break on tool-call format first,
and the only measure that counts is our own tasks in the harness students will use.

**Context.** Ollama's default context depends on GPU memory: 4k under 24 GiB, 32k from 24 to 48 GiB, 256k from 48 GiB
(READ, [Ollama context length](https://docs.ollama.com/context-length)). The M2's GPU share is about 21 GB, so 4k unless
raised. A studio turn is 2,000 to 3,100 tokens in today (capture), which fits; a turn that reads four files does not.
The worker app already makes its own tags with a context length (`create()` in `pool-core/src/native.rs`, `ollama
create` with `num_ctx`), so the pool tag for page turns gets 16k or 32k there. VERIFIED (code). Over `/v1` the context
cannot be set per request (READ, [OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)).

### Kapitsa: a second model server beside Ollama

Added at the coordinator's request. [Kapitsa](https://github.com/nace-ai/kapitsa) is a local inference engine for Apple
silicon from people at nace.ai. Read today from the README [kp-readme], `docs/usage.md` [kp-usage], the release
notes [kp-rel, kp-232], the Homebrew formula [kp-brew] and `packaging/release/build.sh` [kp-build]. Nothing installed.

| Fact | Value | Source |
| --- | --- | --- |
| Licence, platform | Apache 2.0; Apple silicon M1 or newer, macOS 14 or later | READ [kp-readme] |
| Version | 0.2.39, 2026-11-20; about 850 stars | READ [kp-rel, kp-readme] |
| Install | `brew install nace-ai/tap/kapitsa` installs a prebuilt `darwin-arm64` tarball from GitHub releases ("nothing compiles"); or a `curl ... install.sh \| bash` into `/opt/homebrew/bin` or `~/.local/bin` | READ [kp-brew], install.sh |
| APIs | OpenAI `/v1/chat/completions`, Anthropic `/v1/messages`, a chat page, on `127.0.0.1:8000`; **and an Ollama-compatible API** (`/api/chat`, `/api/generate`, `/api/tags` and more) since 0.2.32, best on `--port 11434` so Ollama clients find it | READ [kp-usage, kp-232] |
| Tool calls | yes, in all three APIs: OpenAI `tools` and `tool_choice`; Anthropic `tool_use` with `tool_choice` `any` or a named tool; Ollama `/api/chat` `tools`. "Tool calls stream in all APIs", the format enforced by masked sampling | READ [kp-usage]. Not on the README, which is why it looked undocumented |
| Context | `--context 128k`, `1m` or `max`; default "the model's limit (256K, 1M), less where memory is tight" | READ [kp-usage] |
| Models | Qwen 3.5 4B and 9B, Qwen3.8 27B, Qwen3.6 35B-A3B, Nemotron, Inkling, DeepSeek, Hy4 and others, its own quantisations; **no Gemma** | READ [kp-readme, kp-usage] |
| Launchers | `kapitsa claude`, `codex`, `opencode`, `pi`, `hermes`, `aider`, `goose`, `copilot` | READ [kp-readme] |
| Speed claim | fastest decode in 33 of 38 Mac and model pairs, its own benchmark; 351 tok/s on Qwen3.6 35B-A3B on an M5 Max | READ [kp-readme], self-reported |
| Models stored | `~/.cache/kapitsa/models` (`KAPITSA_HOME`) | READ [kp-usage] |

**Signing: not settled, and it decides whether it can run on the work Mac.** `build.sh` signs "ad hoc, unless
`KAPITSA_SIGN_IDENTITY` names a 'Developer ID Application' certificate", and notarises only when a notary profile is
set. READ [kp-build]. So the script can make either, and neither the README, the release notes nor the formula says
which the published 0.2.39 tarball is. The release commits are GPG signed on GitHub, which says nothing about the
binary. READ [kp-rel]. The way `research/local-runners.md` checked the other runners (`codesign -dv` on the installed
binaries) needs the tarball on disk, which is a download: for the owner to approve. Until then: **treat it as ad hoc
signed**, and on ThreatLocker an ad hoc binary is the kind that was killed before (esbuild, workerd). INFERRED. A
Homebrew formula (not a cask) also leaves no quarantine flag, so Gatekeeper will not ask; that does not help with
ThreatLocker, which decides on its own. INFERRED.

**What it means for the pool.** The worker app speaks Ollama's native API at a configurable address (`OLLAMA`,
default `http://127.0.0.1:11434`, `pool-core/src/main.rs`; VERIFIED (code)). Kapitsa answers `/api/chat` and
`/api/tags`, so pointing the worker at it may work for text jobs with no code change. INFERRED, with known gaps:

- Its Ollama route takes `/api/chat` with `tools`, `think` and `format`, plus `/api/tags` and `/api/ps`; it has **no
  `/api/pull`** (READ [kp-usage], as relayed by the coordinator). So chat and tool jobs should work unchanged, and
  model downloads would not: the worker pulls through Ollama and makes tags with `num_ctx` through `/api/create`
  (`native.rs`, VERIFIED (code)). Models would be Kapitsa's catalogue names (`qwen3.6-35b-a3b-4bit`) fetched by
  Kapitsa itself.
- Documented is not measured: `research/local-runners.md` found Lemonade's and LocalAI's Ollama routes ignored
  `think: false` and `format`. The same two calls are the first test here.
- One server on 11434 at a time: Kapitsa there means Ollama elsewhere.
- Energy is metered by the worker app around the job (macmon), so it does not care which server runs the model.
- No Windows: the EKA lab's RTX 4080 workstations stay on Ollama or llama.cpp.

So Kapitsa is a candidate engine for join A on Macs and for OpenCode on a student's Mac (`kapitsa opencode`), and it
is worth one column in the eval if it is signed or the owner approves an ad hoc binary on the M1 (which has no
ThreatLocker, `local-models.md`).

**What fits** (Kapitsa's own table [kp-usage], plus INFERRED where marked):

| Machine | Kapitsa says | Note |
| --- | --- | --- |
| M1 Pro 16 GB | Qwen 9B at 4-bit; Qwen 35B-A3B only in its "16gb" (2-bit) variant | 2-bit is a large quality loss to measure before trusting it (INFERRED); no Gemma, so no like-for-like with today's pages |
| M2 Pro 32 GB | Qwen3.8 27B at 5-bit or Qwen3.6 35B-A3B at 4-bit | its planner's table (relayed by the coordinator from `usage.md`); the README also marks 27B 4-bit in a smaller column with a dagger ("24 GB+"). With the teacher's apps open and a 64k window it is at the limit (INFERRED). Disk: the same 30 GB floor applies |

### What to take from Kapitsa even without installing it

From `docs/usage.md`: the numbers and behaviours below were read there by the coordinator today and relayed, and not
re-fetched here. Each one is a design idea for join A and the worker app, not a decision.

1. **A launcher per run, not a config edit.** It starts a harness for one run with the context window and compaction
   set to the server's real context, cloud-only tools (web search) off, and the key passed through a helper so a
   cloud login is never sent. For join B: a `visualia opencode` (or a page of copyable commands) that starts OpenCode
   against the gateway's `mine/` route with the school's AGENTS.md, and never rewrites the student's own config.
   INFERRED effort: one day.
2. **A memory planner per Mac and model.** Weights plus KV cache per token (68 KB a token on Qwen3.8 27B, 36 KB on
   the 4B, 22 KB on 35B-A3B) plus buffers decides precision and context. At 68 KB a token, a 64k window is about
   4.4 GB of KV cache on top of the weights; at 22 KB, about 1.4 GB (INFERRED arithmetic). The worker app already
   picks a context when it makes a tag (`create()`); it should compute it from free GPU memory instead of a fixed
   number, and announce the context with the model so the Pool sends only jobs that fit. INFERRED effort: one day.
3. **Prefix caching across tool-loop turns**, also on SSD, with cached tokens in the usage. Their example: a compacted
   agent prompt from 74 s to 42 s. The studio's loop resends the same system prompt and files every step; on the M2
   the capture saw 3 to 16 s of prompt processing per call and almost no caching (`multi-file.md`). Ollama keeps the
   last prompt's cache per loaded model; keeping one model per worker and the system message byte-identical across
   steps is the cheap half. Usage rows already have `tokens_cache_read` (`STUDIO.md`). INFERRED.
4. **A keepalive during long prefill** (every 15 s) and optional prefill progress. A local turn with four files can sit
   silent for many seconds before the first token; the Pool and the studio's socket should not take that for a dead
   worker, and the student should see "reading the files" rather than nothing. INFERRED effort: half a day.
5. **The reply cap and thinking.** Its default cap is 16,384 tokens, which a reasoning model can spend entirely on
   thinking, so it sends an explicit "cut off" message. The studio sends `max_tokens` 16,000 with thinking off and
   already has a cut-off message (`prompts.md`); the pool must make sure thinking is really off (Ollama once ignored
   the switch, `local-models.md`) and pass the cut-off through, not an empty reply. INFERRED.
6. **Several Macs on a LAN serving each other.** That is the pool's idea, done by opening ports on the network. The
   pool's rule stays "connect out, never open in" (`pool.md`), for the same reasons `local-multimodal.md` gives for
   exo and llama.cpp RPC.

A user report (relayed by the coordinator, not read here): a Mac mini M4 24 GB running Kapitsa with Qwen3.8 27B for
coding.

Sources: [kp-readme](https://github.com/nace-ai/kapitsa), [kp-usage](https://github.com/nace-ai/kapitsa/blob/main/docs/usage.md),
[kp-rel](https://github.com/nace-ai/kapitsa/releases), [kp-232](https://github.com/nace-ai/kapitsa/releases/tag/v0.2.32),
[kp-brew](https://github.com/nace-ai/homebrew-tap/blob/main/Formula/kapitsa.rb),
[kp-build](https://github.com/nace-ai/kapitsa/blob/main/packaging/release/build.sh). Read through a summarising fetch.

## 3. Join B: an outside harness works on a studio project

`agent-coders.md` already plans the hand-in (MCP step 2: hand in a version, mark it shown, submit). This adds how the
files travel.

**Two ways, and the first is the main one.**

| Way | How | For |
| --- | --- | --- |
| **Pull, work, hand in** | `get_project` (exists) gives the files of a version; the harness works on a local folder with its own tools; `hand_in { project, files, note }` makes version n+1 | OpenCode, Claude Code, Codex, Aider, Cline, Goose: anything with a disk |
| **Remote Workspace tools** | `read`, `ls`, `write`, `edit`, `delete` over MCP on the project's working copy in the `StudioAgent`, then `hand_in` snapshots it | Claude Desktop, ChatGPT, a phone: tools with no local folder |

Why the first is the main one, which changes the session's starting view of "MCP tools that mirror the Workspace":
a harness's model is tuned on that harness's own file tools (`INFRA.md` section 3: models are tied to the harness they
were trained on). Giving it a second set of `read` and `write` tools on a remote disk invites the wrong tool and two
copies of the truth. Mirrored tools stay for clients without a disk, and they are cheap because `createPiTools`
already has the schemas and `execute()`: the MCP server forwards to the agent. INFERRED.

**What still applies.** A hand-in is an ordinary version: in R2, credited to the person, undoable, checked (join C),
unshown until shown (`backstage.md`). **Model usage does not arrive through MCP** (`agent-coders.md`: an MCP server
sees only its own calls). It arrives through the gateway when the harness points there, through OpenTelemetry for
Claude Code and Codex on a person's own plan, or not at all.

- **A harness pointed straight at the person's own Ollama is not counted anywhere.** It never touches the gateway or
  the worker app. To count it, point the harness at the gateway with a `mine/<model>` name: gateway, Pool, the
  person's own worker app, their own Ollama. The call leaves the machine and comes back, but the row and the measured
  energy are written as for any pool job. This needs join A's tool passing and `only: 'mine'`. INFERRED.
- **Claude Code needs `/v1/messages`** (Anthropic shape) in the gateway before it can point there. Ollama has one
  locally (no `tool_choice`, no prompt caching, READ [o-anth] in section 6), so Claude Code on Ollama works without
  us, uncounted. INFERRED effort for the gateway route: one day, with streaming and tool use translation.

**Effort.** `hand_in` with files (text and pictures, the same caps as an upload), the snapshot through the agent, the
same OAuth with a new `make` scope: two days. Remote tools: one more day. INFERRED. Both wait for the class to agree
to step 2 (`mcp.md`).

## 4. Join C: the page checks as an MCP tool

`check_page { project, version? }` answers what the studio would show:

| Field | From |
| --- | --- |
| `html` | a complete document in `index.html` |
| `clean` | console errors and uncaught errors within 3 s |
| `visible` | the screenshot is not blank (distinct colours) |
| `fits` | no horizontal scroll at 375 px (`scrollWidth`) |
| `screenshot` | the 375 x 812 PNG, as an MCP image |
| `match` | the Clef-flash score against the brief, when there is one |

- **Where it runs: in the studio, with Browser Rendering**, which already takes the screenshot. The four checks move
  from `evals/first-pages/run.mjs` into that step, so the studio itself gains them too (`STUDIO.md` planned this as the
  `verify-preview` skill). ~3.5 s of browser time a check, inside the 10 free hours a month (`studio-core.md`).
- **Why not a local script:** it would need headless Chromium on every student's laptop, and on the managed one
  here it is not allowed. One server-side check means every harness and the studio grade a page the same way.
- **Loop for a harness:** write locally, `hand_in` as an unshown version, `check_page`, fix, hand in again. Unshown
  versions cost an R2 object each; that is fine. INFERRED.
- **A check is not a grade.** It is the same "is it broken" floor as `first-pages.md`'s "Not in it": beauty and fit to
  the brief stay a person's job.

INFERRED effort: one day for the checks in the studio, half a day for the MCP tool.

## 5. Join D: one source for instructions and skills

**Today three places hold the instructions** (section 0). The one that counts for a request is D1's school text over
the course default. So the source for every harness is the studio's own effective text, `GET /api/prompts`, not the
file.

| Who | Gets the instructions as | Gets skills as |
| --- | --- | --- |
| the studio's agent | system message (today) | the catalogue (name, one line) in the system message; a matching skill's body added by the Clef decision (`STUDIO.md`: p >= 0.6 injected, cheap models rarely activate skills themselves) |
| a harness through MCP | an MCP prompt `instructions`, and a `get_instructions` tool for clients that ignore prompts | MCP prompts, one per skill |
| a harness on disk | `AGENTS.md`, generated from the school's text, inside every `get_project` download | `skills/<name>/SKILL.md` folders, the same files |

- **Steps.** Make `apps/studio/src/instructions.md` the build's copy of `schools/eka/instructions.md` (a build step or
  an import path) so the two cannot drift. Write the first three skills from known failures, in the
  `first-pages.md` and `multi-file.md` findings: `p5-sketch`, `three-scene` (camera distance, lights, no fog),
  `estonian-text` (month abbreviations, keep facts word for word). Then the exports. INFERRED effort: one day for the
  plumbing, half a day per skill with the teacher.
- **What a teacher's change does:** it reaches the studio on the next request (as today), and a harness on its next
  `get_project` or MCP prompt read. A downloaded AGENTS.md goes stale; it carries its date and the school's prompt
  version.

## 6. Which outside harness for students

Web reading today (2026-11-22). Each fact READ at the page linked under the table unless marked.

| Harness | Local models | AGENTS.md | SKILL.md | MCP client | Runs as a job | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| **OpenCode** | `ollama launch opencode`, or an `@ai-sdk/openai-compatible` provider at `localhost:11434/v1` [o-oc] | yes; falls back to CLAUDE.md [oc-rules] | yes: `.opencode/skills`, `.claude/skills`, `.agents/skills` [oc-skills] | yes (INFERRED, not read today) | `opencode run "<prompt>"`; a server mode [oc-cli] | MIT (INFERRED, not read today) |
| **Codex CLI** | `codex --oss`, `--local-provider ollama`, or `ollama launch codex` [o-cx] | yes [agents.md] | yes: `.agents/skills` [cx-skills] | yes, stdio or streamable HTTP (search summary) | `codex exec` with `--json`, `--output-schema`; an SDK [cx-exec] | Apache 2.0 [cx-gh] |
| **Claude Code** | `ANTHROPIC_BASE_URL=http://localhost:11434` against Ollama's `/v1/messages` [o-cc]; Anthropic "doesn't support routing Claude Code to non-Claude models through any gateway" [cc-gw] | yes [cc-mem] | yes [cc-headless] | yes, `--mcp-config` [cc-headless] | `claude -p`, `--output-format stream-json`; Agent SDK [cc-headless] | proprietary [cc-lic] |
| **Aider** | `--model ollama_chat/<model>`, `num_ctx` in a settings file [ad-oll] | only with `--read AGENTS.md` [ad-conv] | no | no; [#4506 Add native MCP server and Agent Mode support to Aider CLI](https://github.com/Aider-AI/aider/issues/4506) still open | `aider --message`, `--yes` [ad-script] | Apache 2.0 (INFERRED) |
| **Cline** | Ollama is a built-in provider [cl-gh] | yes [cl-rules] | yes: `.cline/skills` [cl-skills] | yes [cl-gh] | Cline CLI: `cline -y "<task>"`, `--json` (search summary) | Apache 2.0 [cl-gh] |
| **Continue (`cn`)** | Ollama in `config.yaml` (search summary) | yes (search summary) | yes (search summary) | yes, `--mcp` [ct-qs] | `cn -p` [ct-qs] | Apache 2.0; **the repository is now "no longer actively maintained and is read-only"** [ct-gh] |
| **Goose** | Ollama, or models loaded inside Goose [gs-gh] | yes, with `.goosehints` (search summary) | yes: `.agents/skills` [gs-skills] | yes, its "extensions" [gs-gh] | `goose run -t`, `--output-format stream-json` [gs-run] | Apache 2.0; moved to the Linux Foundation [gs-gh] |

**Ollama's surfaces** (READ): native `/api`; OpenAI-compatible `/v1` with `chat/completions` (tools) and
`/v1/responses` [o-oai]; Anthropic-compatible `/v1/messages` with streaming, tools, tool results, thinking and base64
images, but no `tool_choice` and no prompt caching [o-anth], added in v0.14.0 (search summary, [Ollama blog](https://ollama.com/blog/claude)).
Every coding harness integration page asks for a context of 64k or more [o-ctx, o-cc, o-cx, o-oc]. INFERRED from that
and the GPU share: on the M2, a 26B model with a 64k window is at or past the limit, so a harness with a long system
prompt is the harder case for local models than the studio's short loop.

**Recommendation: OpenCode** as the course's terminal harness, Cline for students who want VS Code. This is what
`INFRA.md` sections 4 and 8 already chose, and today's reading supports it:

- It reads AGENTS.md and skills from `.agents/skills` and `.claude/skills`, so the files from join D work unchanged.
- One config for any provider: the course gateway (OpenAI shape, works today), Ollama, or OpenCode's own plan as a
  backup (`INFRA.md`).
- `opencode run` makes it scriptable for the eval, and the server mode is the no-install fallback.
- Open source (MIT, to confirm), so students can read what it sends, as the course asks of the pool.

Against the others: Claude Code is proprietary and its maker does not support it with open models; it stays for those
on a Claude plan, through telemetry (`agent-coders.md`). Codex is a fair second (Apache 2.0, AGENTS.md, skills, MCP,
`codex exec`); it loses on nothing read today except that OpenCode is the one already in `INFRA.md` and its probe.
Aider has no MCP and no skills, so joins B to D reach it only through files. Continue is archived. Goose has
everything and is the one to watch; it has no course history yet. The probe's comparison (`INFRA.md` section 8:
"same six tasks, OpenCode vs Cline, same two models") still decides between OpenCode and Cline.

Sources: [o-oc](https://docs.ollama.com/integrations/opencode), [o-cx](https://docs.ollama.com/integrations/codex),
[o-cc](https://docs.ollama.com/integrations/claude-code), [o-anth](https://docs.ollama.com/api/anthropic-compatibility),
[o-oai](https://docs.ollama.com/api/openai-compatibility), [o-ctx](https://docs.ollama.com/context-length),
[agents.md](https://agents.md/), [oc-rules](https://opencode.ai/docs/rules/), [oc-skills](https://opencode.ai/docs/skills/),
[oc-cli](https://opencode.ai/docs/cli/), [cx-gh](https://github.com/openai/codex),
[cx-skills](https://learn.chatgpt.com/docs/build-skills), [cx-exec](https://learn.chatgpt.com/docs/non-interactive-mode),
[cc-mem](https://code.claude.com/docs/en/memory), [cc-headless](https://code.claude.com/docs/en/headless),
[cc-gw](https://code.claude.com/docs/en/llm-gateway), [cc-lic](https://github.com/anthropics/claude-code/blob/main/LICENSE.md),
[ad-oll](https://aider.chat/docs/llms/ollama.html), [ad-conv](https://aider.chat/docs/usage/conventions.html),
[ad-script](https://aider.chat/docs/scripting.html), [cl-gh](https://github.com/cline/cline),
[cl-rules](https://docs.cline.bot/features/cline-rules), [cl-skills](https://docs.cline.bot/features/skills),
[ct-gh](https://github.com/continuedev/continue), [ct-qs](https://docs.continue.dev/cli/quickstart),
[gs-gh](https://github.com/aaif-goose/goose), [gs-skills](https://goose-docs.ai/docs/guides/context-engineering/using-skills),
[gs-run](https://goose-docs.ai/docs/guides/running-tasks). The pages were read through a summarising fetch; spot-check
exact numbers on the page before building on them.

## 7. The eval: five visualia tasks, harness by model

Extends `evals/multi-file/capture.mjs` (which already has `--local`) rather than starting a new one.

**Tasks** (each starts from a fixed project folder; Estonian briefs as in `first-pages`):

| # | Task | Passes when |
| --- | --- | --- |
| 1 | New multi-file page: the spiral brief as `index.html`, `style.css`, `main.js` | the four checks; relative links |
| 2 | Edit: "make the heading red on both pages" on the four-file site | the four checks; the rest of `style.css` unchanged (the check the capture lacked) |
| 3 | Fix from errors: a page with a known console error, given the error text | `clean` passes; nothing else lost |
| 4 | Library: a three.js scene with an import map from a pinned CDN | the four checks; the import map resolves |
| 5 | Estonian poster: the poster brief, facts kept word for word | the four checks; every fact string present (a string match) |

**Grid.** Harness: the studio's loop (through the pool once join A lands, before that `capture.mjs --local` straight to
Ollama) and OpenCode (`opencode run`, non-interactive). Model: `gemma4:26b` (on the M2 now), one Qwen MoE coder
(`qwen3-coder:30b` or Qwen3.6-35B-A3B), Inkling 2 Mini; DeepSeek V4.1 Flash in the cloud as the reference. Two runs
each.

**Measured per run:** pass, wall time, model calls, broken tool calls (unparsed, invented tool, wrong arguments),
tokens in and out, and energy: in the pool route from the usage row; on a direct run with `apps/pool/meter.mjs`
around the whole task, the method `first-pages.md` run 9 used (chip net of idle, plus whole machine). Cool to under
60 °C before each run, stop above 85 °C, as run 9 did.

**Cost and time.** 5 tasks x 2 harnesses x 3 local models x 2 runs = 60 runs at about 1 to 3 minutes plus a minute of
cooling: four to six hours of M2 time, so two sittings. INFERRED.

**What would change the plan:** if OpenCode with a local model passes clearly more tasks than the studio's loop with
the same model, the studio's short loop and prompt are the problem, and the fix is in our prompt and tools, still not
in embedding a harness.

## 8. Needs the owner's approval

| What | Why | Size |
| --- | --- | --- |
| Any model pull on the M2 | 36 GB free when last measured, 30 GB floor: about 6 GB of room. `gemma4:26b` (16 GB) is already there; Inkling 2 Mini is 20 GB and a Qwen 30B MoE coder about 19 GB at Q4, so each needs another model removed first | 19 to 20 GB each |
| An Ollama upgrade on the M2 | 0.40.8 may not know Inkling 2 Mini (`research/inkling-2-mini.md`); a new binary on a ThreatLocker machine may be killed | one install |
| OpenCode on the M2 or the M1 | a new program on a managed machine (memory: ask first) | one install |
| Kapitsa: download the 0.2.39 tarball to read its signature (`codesign -dv`), then, if approved, install on the M1 first | signing unknown; ad hoc binaries were killed by ThreatLocker before | one download, one install, models of its own in `~/.cache/kapitsa` |
| Raising Ollama's context on the M2 | harness prompts need a large window; KV cache shares the ~21 GB GPU limit with 16 to 20 GB of weights | a setting, but it changes what the pool serves |
| A worker app release with tools | a signed update to every installed app | one release |
| MCP step 2 (hand-in) | the class agrees first (`mcp.md`, `agent-coders.md`) | a class decision |

The M1 (16 GB) is no help for the 26B class: neither Gemma 4 26B nor Inkling fits in its GPU share.

## 9. Steps

| # | Step | Effort (INFERRED) | Needs |
| --- | --- | --- | --- |
| 1 | Tasks 1 to 5 as fixtures in `evals/multi-file/`, with the "rest unchanged" and fact-string checks | half a day | nothing |
| 2 | Run them through `capture.mjs --local` on the M2 with `gemma4:26b` | one sitting | M2 time |
| 3 | Pool and worker app pass tools (join A, items 1 and 2) | one and a half days plus a release | approval for the release |
| 4 | The studio's page model setting, `pool/gemma4-26b` for multi-file turns, worker-left fallback | half a day | step 3 |
| 5 | The four checks into the studio's Browser Rendering step | one day | nothing |
| 6 | One instructions file, three skills, the exports (join D) | two days | the teacher for the skills |
| 7 | OpenCode in the grid, and one more local model; Kapitsa as an engine column if approved | one sitting, plus one for Kapitsa | approvals in section 8 |
| 8 | MCP `make` scope: `hand_in`, `check_page`, prompts; remote tools after | three days | the class's agreement |
| 9 | `/v1/messages` in the gateway, if Claude Code through the gateway is wanted | one day | a decision that it is |

## Not settled

- Whether Ollama's MLX runner on 0.40.8 keeps tool calls valid on long turns (the 501 on structured output shows the
  MLX path lacks some features; tool calls parsed in the capture, on four small files only).
- How much context a harness needs with a local model, against the M2's GPU limit with a 16 to 20 GB model loaded.
  Not measured.
- Whether a student's own laptop can do any of this: a 16 GB laptop runs the 9B class, which `INFRA.md` calls demos
  only. Join A with a local model is for the M2, the lab's RTX 4080 workstations (not tried) and 32 GB laptops.
- Estonian quality for Inkling 2 Mini and the Qwen coders: unknown.
- Kapitsa: whether 0.2.39 is Developer ID signed and notarised; whether its Ollama route really honours `think: false`
  and `format`, and answers `/api/version` and `/api/create`; whether its speed claims hold on an M1 Pro or M2 Pro.
- Whether MCP prompts reach the model in each harness, or only show as slash commands for the person. To check per
  harness before relying on them for instructions; AGENTS.md on disk is the safe route.
- Whether a hand-in should run the studio's checker (Clef-flash, a few tenths of a cent) automatically, or only on
  `check_page`.
