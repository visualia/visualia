---
status: idea
---

# Agent coders: people who already work with Claude Code or Codex, in the course

Asked 2026-11-14: *"how to incorporate students or colleagues who are using Codex or Claude already in my machines via
MCP, so we can contribute work or code or artifacts we are grading to the same dashboard. Maybe running their own local
models or whatever. It's mostly about code generation, but how to assess their energy use via MCP"*, then *"So is this
the way how we incorporate people who are already accustomed to agentic coding, etc., and how we assess their
contributions, cost?"*

Nothing here is built. It joins three plans that are: `mcp.md` (step 1, reading, built 2026-10-22), `usage-page.md`
(shipped) and `pool.md` (building), and the telemetry design in `schools/eka/docs/INFRA.md` (the diagram in section 2,
the table "Two pipelines, one usage"). It works inside `backstage.md`, a standing rule.

## In short

Someone who already codes with an agent keeps their own tool and adds two things: Visualia's MCP server, so their agent
can hand work in, and their tool's own usage telemetry, so what it used is counted. **Works are graded; process is not.**
Usage and energy belong to the person and to the class's totals, never to a grade.

## Two channels, because MCP cannot see energy

An MCP server sees only the calls an agent makes to it. It never sees the agent's own model calls, their tokens or their
energy. So the work comes in through MCP, and the usage comes in another way.

### 1. The work: MCP step 2

`mcp.md` plans step 2, Make: change a project, make a project, through the studio's own pipeline. For agent coders it
needs, at least:

- **Hand in a version**: files (code, a sketch, an image, a small archive) as a new version of a project, credited to the
  person, undoable, the same as a version made on the page.
- **Mark a version as shown**: the backstage's explicit publish step. Only shown versions are visible to the teacher and
  the class. Unshown versions stay the person's.
- **Submit for grading**: a mark on a shown version, naming the assignment. The teacher's view lists submitted versions
  per assignment, nothing else.

Sign-in stays as in `mcp.md`: the course key through OAuth, the token carries the person and the school, revoking the
key stops the tool.

### 2. The usage: three routes, by how much is measured

| The person uses | How usage arrives | Energy |
| --- | --- | --- |
| their own model on their own machine (Ollama, llama.cpp, LM Studio) | the pool's worker app (`worker-app.md`), with `only: 'mine'` routing (`research/local-multimodal.md`), which already records energy per job | **measured**: macmon on a Mac, NVML on NVIDIA, idle baseline subtracted (`INFRA.md`) |
| Claude Code, OpenCode or Cline pointed at the course gateway (`ANTHROPIC_BASE_URL` for Claude Code) | every call passes the gateway, which parses the provider's usage: fresh input, cache read and write, output, reasoning tokens | **estimated** from tokens and model, or **measured** when the gateway sends it to the school GPU box or a pool machine |
| their own Claude or Codex subscription, which the gateway cannot route | OpenTelemetry, built into both: `claude_code.token.usage` by type and model, `claude_code.api_request`; Codex's `[otel]` in `~/.codex/config.toml`. Prompt text off. Five environment variables (`INFRA.md`) | **estimated** only, as a range |

Rules carried over from `INFRA.md`: Claude Code sends the account email by default, so the Worker pseudonymises it;
deduplicate on `request_id`; for a local call count device joules or a token coefficient, never both. `ccusage --json`
weekly, opt-in, covers the other harnesses.

Not done: an MCP tool the agent calls to report its own usage. It would be self-reported, and the telemetry already
gives the real counts.

## Energy: measured or estimated, always marked

- **Measured** where the machine is ours or the person's: local models, the pool, the school GPU box.
- **Estimated** for a provider's model: tokens times a per-model range, shown as a range with its source, never one
  number. `INFRA.md` has the sources: a chat prompt about 0.24 to 0.34 Wh (Google, OpenAI); an agent session about 0.6
  kWh median, 0.25 to 1.2 (Hausfather, 2026-08, an 8-week log 96 % cache reads) against about 41 Wh in another analysis
  (Couch, 2026-01). The tenfold gap is the unknown energy of a cache read, so cache reads get their own coefficient
  range and the page says so.
- **Money**: exact through the gateway. A subscription has no per-call price: show "would have cost" at list price,
  labelled as such.

## Who sees what (backstage.md)

- **The person**: everything about their own usage, tokens, models, sessions, energy, money, and their own versions.
- **The class**: totals for the class, as the usage page shows today; works people chose to show.
- **The teacher**: submitted versions per assignment, and the class totals. **No per-student usage, no process
  dashboard, no grading of tokens, sessions or models.** A budget (when budgets exist) may stop a person's calls; it is
  infrastructure, not a grade.
- What the plan cannot do, and the rule does not ask it to: show who thought of what. Authorship is judged by the
  teacher from the work and from talking with the student.

## Joining, for an agent coder

1. Add `mcp.visualia.space` to the tool and sign in with the course key.
2. Paste the telemetry variables (or point the tool at the course gateway).
3. Optional: run their own model through the worker app, `only: 'mine'`.

## Steps

1. **One day, one person**: the teacher's Claude Code sends telemetry to a small course Worker; read back tokens by type
   and model, dedupe on `request_id`, compare with `ccusage` for the same day. INFERRED: half a day.
2. The telemetry Worker writes into the usage tables beside gateway calls, with a source column (gateway, telemetry,
   pool, local) and measured or estimated on each energy figure.
3. MCP step 2 with hand-in, show and submit; the teacher's submitted list.
4. The usage page: the person's own view of all three sources; class totals unchanged in meaning.
5. Agree with the class (as `mcp.md` and `backstage.md` both ask): what is recorded, who sees it, what is graded.

## Not settled

- Per-model energy coefficients for frontier models, cache reads above all.
- Whether Codex's telemetry carries cache-read tokens apart, as Claude Code's does.
- How a colleague who is not a student (another teacher) appears: the same rules, or a staff role.
