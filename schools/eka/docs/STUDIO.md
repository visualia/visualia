# Studio: build plan

Draft 2026-10-21. The course's own "describe it, see it, publish it" platform,
inspired by Cloudflare's VibeSDK rather than forked from it (why: `INFRA.md`, "Our studio platform"). Package facts checked against the
published READMEs of `agents` 0.29.0 and `@cloudflare/think` 0.21.0
(2026-10-20).

## The two packages it stands on

**`agents`** (Cloudflare Agents SDK) is the base layer. An `Agent` is a class
that runs as a Durable Object: one instance per key (per student, per project),
with its own SQLite, that sleeps for free when idle and wakes on a request.
What it gives us:

- **State that syncs to the browser:** `this.setState()` persists and pushes to
  every connected client; the React hook `useAgent` receives it.
- **`@callable()` methods** the browser calls like local functions over the
  WebSocket.
- **Scheduling** (`this.schedule`, cron), queues, sub-agents, workflows.
- **MCP** servers and clients, email and voice channels.
- **The skills loader** (`agents/skills`): reads Agent Skills folders from a
  bundle or from R2.
- **Routing:** `routeAgentRequest()` maps `/agents/<class>/<name>` to the right
  instance.

**`@cloudflare/think`** is an opinionated chat agent built on top of `agents`
(still marked experimental, API "stable but may evolve"). Maintenance, checked
2026-10-21: official Cloudflare package in the `cloudflare/agents` monorepo
(repo pushed daily, ~5.9k stars, 180 open issues); 52 releases since
2026-03-18, a new minor every 1–3 weeks, 0.21.0 on 2026-10-20; 100+ commits to
`packages/think` since late July. Minors do break things (the README has an
"Upgrading from 0.17" section), so pin before the course and don't upgrade during it. Subclass `Think`,
return a model and tools, and it owns the whole chat lifecycle:

- **The agentic loop:** model → tool calls → model, up to `maxSteps`
  (default 10), with streaming.
- **Persistence and recovery:** messages in the agent's SQLite; streams resume
  after a browser reconnect; turns interrupted by a deploy or eviction recover
  by themselves; an opt-in watchdog for streams that stall.
- **A built-in workspace:** `this.workspace` is a file system in the agent's
  SQLite, with `read`, `ls`, `find`, `grep`, `write`, `edit`, `delete` tools
  given to the model every turn. `exec` appears only if execution backends are
  configured (e.g. JavaScript in a Dynamic Worker).
- **Agent Skills, first-class:** `getSkills()` returns sources (bundled, or
  `skills.r2(bucket, {prefix})`); Think adds the catalogue to the prompt and
  exposes `activate_skill` and `read_skill_resource` tools. First source to
  register a name wins.
- **Lifecycle hooks** — the places we plug in:

  | Hook | We use it for |
  |---|---|
  | `beforeTurn(ctx)` → `TurnConfig` | Clef-flash decision: pick the model tier for this turn (`model`), refuse out-of-brief requests, inject strongly matching skills, set `headers` (per-student `cf-aig-metadata`), `maxOutputTokens` |
  | `beforeStep(ctx)` | Budget check before every model step; switch to a cheaper model mid-turn if needed |
  | `beforeToolCall(ctx)` | Self-check: "is this edit within the brief?"; block writes outside `public/` |
  | `onStepFinish(ctx)` | **Ledger row** per step: `usage` incl. cached input tokens, model, latency, provider metadata |
  | `onChatResponse` | Run verify checks on the result; publish |
  | `onChatError` | Log, classify, friendly message in Estonian |

- **Also there:** client tools, MCP tools merged in automatically, sub-agents
  as tools (`agentTool`), scheduled prompts, context compaction, a React hook
  `useAgentChat`.

What this means for us: the hard parts of a chat-to-code platform (loop,
streaming, persistence, recovery, workspace, skills) are package code. Our code
is the course parts: gateway and identity, ledger, budgets, Clef, verify,
publish, gallery, Estonian.

## Architecture

```
Browser (one HTML page per view, Estonian)
  │  WebSocket via useAgentChat / useAgent
  ▼
studio Worker  (routeAgentRequest + static pages + /p/<student>/<slug>/ publish route)
  ├─ Auth: EKA OIDC if available, else GitHub + email magic link
  ├─ D1: users, classes, memberships, projects, versions, ledger, skills, budgets
  ├─ R2: projects/<projectId>/<sha>/index.html · skills/course/* · skills/students/<uid>/*
  └─ StudioAgent (extends Think) — one instance per student project
        getModel()      → course gateway (tier chosen per turn)
        getSkills()     → [bundled eka-house, r2 course skills, r2 student skills]
        workspace       → public/index.html (+ more files in advanced mode)
        tools           → workspace tools + publish + verify
        hooks           → Clef in beforeTurn · budget in beforeStep · ledger in onStepFinish
  ▼
Course gateway (AI Gateway + Worker): GLM-5.3-Flash / Qwen3.8 / DeepSeek V4.1 Flash · Claude capped · Clef-flash
Browser Rendering: verify checks against the preview
User-content domain (separate from the studio's): published pages, sandboxed
```

**Preview:** while the model writes `public/index.html`, the browser renders the
stream into an `iframe srcdoc` (sandboxed, no same-origin). No container, no
Dynamic Worker needed for single-file mode.

**Publish:** copy the workspace file to R2 under a content hash, insert a
version row, serve at `/p/<student>/<slug>/` on the user-content domain.

**Advanced mode** (block B onward, opt-in): give the agent an `exec` backend and
multi-file workspace (`@cloudflare/computer` JavaScript backend, or
`@space-do/space`), build with `@cloudflare/worker-bundler`, preview via
Dynamic Worker. Only after the single-file mode is solid.

## Project types

- **Chat:** a plain conversation with an agent for questions, writing,
  explaining and planning. Same agent class with no workspace writes and no
  publish tool; same rooms, ledger and budgets. This is what replaces a
  separate chat app (LibreChat stays a documented fallback in `INFRA.md`).
  About a day on top of the core.
- **Page:** the describe → preview → publish loop, single file by default,
  advanced multi-file on request.
- A chat can turn into a page ("make this into a page"): the conversation stays,
  the project type changes.

## Data model (D1)

| Table | Key fields |
|---|---|
| `users` | id, email, display_name, role (student/teacher), level (1–3), locale |
| `classes`, `memberships` | class id, user id, role |
| `projects` | id, owner, slug, title, brief, type (chat/page), visibility (private/class/public), mode (single/advanced), forked_from |
| `project_members` | project, user, role (owner/collaborator/viewer) |
| `versions` | project, sha, r2_key, created_at, verify_result, published |
| `ledger` | ts (UTC), user (the requester), project, turn, step, model, provider, tokens_in, tokens_cache_read, tokens_cache_write, tokens_out, tokens_reasoning, latency_ms, cost_usd, skills_fingerprint, clef_decision (JSON), coefficient_version |
| `skills` | name, scope (course/student), owner, version, sha, status (draft/approved) |
| `budgets` | user, period, limit_usd, spent_usd, tier caps |

## Skills

Same folder format as Claude Code and OpenCode (`skills/<name>/SKILL.md`,
course fields under `metadata`), kept in the course repo, synced to R2.

- **Always on:** `eka-house` (Estonian copy, single-file conventions,
  accessibility basics, no external fetch without CORS).
- **Templates:** `single-file-html`, `p5-sketch`, `three-scene`, `d3-dataviz`,
  `interactive-poster` — pinned CDN URLs, a canonical skeleton, known pitfalls.
- **`verify-preview`:** declares checks (no console errors, canvas not blank,
  fits 375 px, frame rate) with negative controls, as `positron-verify` does.
- **Selection:** Think lists the catalogue; additionally Clef-flash scores each
  skill against the request in `beforeTurn` — p ≥ 0.6 injected directly,
  0.2–0.6 left for the model to activate, < 0.2 hidden. Cheap models rarely
  activate skills themselves.
- **Authorship:** teacher distils class failures into course skills
  (LESSONS.md style); students draft their own (own projects only), teacher
  promotes to class scope.

## Collective features

Most of this comes from one fact: a Think agent is a Durable Object, and Think
already broadcasts the live stream to every connected client ("multi-tab
broadcast"). Several people connected to the same project agent are, without
extra work, in one room watching one agent. What we add is identity, turn-taking
and a few shared objects.

### Rooms: a project can have many people

- `projects` gets a `members` table (owner, collaborators, viewers). Anyone
  with access connects to the same `StudioAgent` instance.
- **Every message carries its author.** The Worker authenticates the WebSocket;
  the agent stamps `author` on each user message and, via
  `TurnConfig.messageMetadata`, on the assistant reply it caused. The ledger's
  `user` is the **requester**, not the project owner. This is the fix for the
  Cursor problem, where a teammate's follow-up ran under the starter's identity.
- **Turn-taking:** one turn runs at a time; further requests wait in a queue in
  agent state (`setState`, synced to everyone), shown with author and an
  estimated cost. Owner or teacher can reorder or drop.
- **Budget:** charged to the requester by default; a project or class pool can
  be switched on for group work.

### The brief as a shared document (plan before act)

Borrowed from GitHub Next's Ace: the team agrees what to make *before* the agent
acts.

- Each project has a **brief** in agent state, co-edited live by members.
- It goes into the prompt as a context block (`configureContext()`), so the
  agent always works against the current brief.
- Clef-flash checks every request against it (`in_brief`) in `beforeTurn`, and
  every write in `beforeToolCall`. Out-of-brief requests are bounced back to the
  room with the probability shown, not silently executed.
- Optional "brief locked" switch: requests run only after the group agrees
  (owner approves, or a simple vote).

### Mob mode

The teacher's projector view is just another client in a project room, with a
"suggestions" panel: students submit prompts from their own laptops, the room
sees them, the teacher (or a vote) picks which one runs. Same mechanics as
turn-taking, with the teacher as gatekeeper.

### Forks and variations

- **Fork** = a new project agent seeded from a published version (R2 copy plus
  brief). Lineage is recorded (`forked_from`).
- A class assignment can fan out: one brief, each student forks, each directs
  their own variation. The gallery shows them side by side.
- **Combine:** ask an agent to merge versions ("A's palette with B's motion");
  the result credits both sources. Curation, not code merging.

### Class room and shared queue

- One `ClassAgent` (an `Agent`, one per class) holds the class-wide state:
  members, the shared request queue for the funded agent, the budget pool,
  and the gallery index.
- Shared-queue requests are dispatched to a project agent as a sub-agent
  (`agentTool` / `runAgentTool`), so the class sees each run live, with author,
  cost and result.
- The queue and its spending are visible to everyone, which makes scarcity a
  topic for block D rather than a hidden limit.

### Shared canvas

Published versions and live previews appear on the visualia board (block B).
visualia already has an MCP package, so the studio agent can place results on
the board through MCP tools, and the board can show Clef's probability charts
from Judgement Machines next to the work they judge.

### Shared skills

The class's craft accumulates as skills: students draft skills from what went
wrong in their projects, the teacher promotes them to class scope, and every
agent in the class (studio, Claude Code, OpenCode) gets better. The ledger
records which skill versions each turn used, so the effect of a new class skill
is measurable.

### What's still open

- **Conflicts:** two people editing the brief at once (last-write-wins is
  probably fine for a class; CRDT if not).
- **Moderation:** a shared room needs a way to mute or remove a disruptive
  member.
- **Credit:** how authorship of a collective piece is shown publicly, and
  whether students can opt out of being named.

## A UI students can reshape

You provide a rough studio UI; students change it, individually and
collectively, using the studio itself. This is block B's subject (Engelbart,
Kay, Raskin, Victor: tools people shape for themselves) applied to the tool
they use every day.

### The idea: the UI is a studio project

The chat UI is an ordinary studio project: one HTML file (plus CSS), with a
brief, versions and a gallery entry. To change it, a student forks it and asks
the agent ("put the preview on the left", "show what each turn cost", "make the
chat look like a zine"). Their fork becomes *their* studio.

### Layers, from safe to deep

| Layer | What changes | How |
|---|---|---|
| Theme | Colours, type, spacing | CSS tokens only; can't break anything |
| Layout | Which panels exist and where (chat, preview, brief, queue, costs, gallery) | A small layout description the UI reads |
| Widgets | New panels: a live cost meter, Clef probability charts, a mood board, a voice button | New components that use the UI contract |
| Fork | Anything | The whole file |

### Individual and collective

- **Individually by default:** each student picks which UI version is "my
  studio" (their fork, the default, or someone else's). Changing your own UI
  never affects anyone else.
- **Collectively by proposal:** the class UI is a shared project with a room and
  a brief. Anyone can propose a change (a fork with a diff and a preview);
  the class discusses and votes, the teacher merges. Merged changes reach
  everyone using the class version.
- **Borrowing:** a gallery of UI forks; adopt someone's whole UI or copy one
  widget into yours. Lineage is recorded, so good ideas spread visibly.

### The UI contract (what makes this safe)

A custom UI could otherwise read a student's session and spend their budget, so:

- **Custom UIs run sandboxed** in an iframe on the user-content domain, never on
  the studio's own origin.
- **They talk to the agent only through a narrow bridge** (`postMessage`):
  send a message, receive the stream, read project state and brief, request a
  publish, read the ledger summary. No tokens, no direct network access to the
  studio.
- **An escape hatch outside the custom UI** always resets to the default, so a
  broken fork can't lock anyone out.
- **The contract is versioned and documented** as a course skill
  (`studio-ui`), so the agent knows how to change the UI correctly when asked.
  Designing what goes into the contract is itself a good block B discussion:
  what should a tool let its users change?

### What it adds to the studio

- Bridge + sandbox host for custom UIs, version picker, "reset to default":
  ≈3–4 days.
- Proposal/vote/merge flow for the class UI: reuses rooms, forks and the
  gallery from the collective features, ≈1–2 days.
- The ledger records which UI version each turn came from, so the class can see
  whether a UI change (say, a visible cost meter) changes how people work.

## First experiments

1. **Single-file loop.** `StudioAgent extends Think`, one Worker, R2, D1 ledger
   via `onStepFinish`. 20 Estonian briefs (p5, three, d3, poster) × 3 cheap
   models + Claude via the gateway. Record pass/fail (console clean, canvas not
   blank), tokens, cost, latency. Success: ≥ 80% pass on at least one cheap
   model.
2. **Clef-flash router.** 50 labelled requests; questions `tier`, `in_brief`,
   `clarity`; measure calibration and latency; wire into `beforeTurn`.
3. **Think on open models.** Does tool calling through the gateway hold up with
   GLM / Qwen / DeepSeek over 10+ steps? Decides whether advanced mode is
   realistic.
4. **EKA IT.** OIDC available? User-content domain? GDPR contact.

## Scope

- **Core (≈15 days):** auth, classes, teacher role; chat and page project
  types; chat + live preview,
  versions, publish; budgets from the ledger; `eka-house` + five template
  skills + verify with one auto-fix; class gallery; Estonian UI; pinned
  dependencies.
- **Collective (≈6–8 days):** project rooms with members and authored
  messages, turn queue, shared brief with Clef checks, mob mode, forks;
  `ClassAgent` with the shared queue.
- **Reshapeable UI (≈4–6 days):** sandboxed custom UIs behind a narrow bridge,
  version picker, reset, class UI proposals and votes.
- **Later (≈10–15 days):** student-authored skills with approval; advanced
  multi-file mode; sketch/screenshot-to-page and voice briefs (Whisper for
  Estonian); published pages onto the visualia board; class dashboards.

## Risks

1. **Cheap models in Estonian:** working p5/three pages from Estonian briefs is
   unproven — the first experiment answers it.
2. **Experimental packages:** Think is experimental and moves fast (0.8 → 0.21 in
   months); Clef and Dynamic Workers are new. Pin before the course starts.
3. **Student code on public URLs:** separate domain, sandboxed iframes, abuse
   reporting, takedown, GDPR decision.
4. **Teacher time:** ~30–35 days of build before and during the course is
   significant; the first experiments should also decide what to cut.
