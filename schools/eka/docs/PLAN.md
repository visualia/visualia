# EKA AI vabaaine — course plan v1

For iteration. Supersedes plan v0. The course texts in `sources/` are the
authoritative statement of intent: four blocks A–D, the partners, the themes,
3 EKAP, sessions every two weeks. This file says how the course delivers that
intent with what has been decided since. Detail lives in `INFRA.md` and
`STUDIO.md`; this plan points to them and doesn't repeat them.

No calendar here on purpose: blocks run in order A → D, about four sessions
each, one session every two weeks. How they fit into the academic year is
decided separately.

---

## 1. What the course is now

The sources ask for a curious, fearless introduction to AI in a creative
context that stays critical about ethics, cultural bias and ecological
footprint. Three things since the drafts change how we get there:

1. **Students direct agents; they don't learn to code.** A non-programmer can
   describe a page in plain language and get a working, published one. The
   skill to teach is directing: write a brief, say what done looks like,
   check the result, say no.
2. **Checking is the critical skill, and it is done by hand.** Agent output
   that *looks* right is the common failure (a made-up number behind a passing
   check, a check that could never fail, "I don't understand this" as a bug
   report). This runs through every block in LESSONS style instead of waiting
   for D.
3. **"Free local models for most tasks" doesn't hold for agent work.** The ET
   text puts free local models at the centre. Small local models can chat,
   caption and hallucinate interestingly, but can't reliably drive a coding
   agent on a 16 GB laptop. So: cheap strong open models through one course
   gateway by default, Claude capped, local models as study material and a
   measured baseline (`INFRA.md` §1, §3). The intent (free, open, aware of
   cost) stays; the means change, and the gap becomes something we measure.

## 2. Through-lines from the first session

| Thread | What it is | Detail | Where it ends up |
|---|---|---|---|
| **Levels** | Each student picks a level: 1 chat + preview, 2 editor, 3 terminal. Same gateway, models and usage at every level; move any time. We don't know the group's level, so we don't decide it for them | `INFRA.md` §4 | Usage shows who moved where |
| **Ship** | Everyone has a live URL from session 1 (level 1: studio publish; levels 2–3: own deploy) | `STUDIO.md` Architecture | Public portfolio of A–C work |
| **Usage** | Every model call logged: requester, model, tokens by type, time, money, skill versions; energy and CO₂ as low–high ranges from a versioned coefficient table; measured joules for local runs | `INFRA.md` §10 | Block D's dataset |
| **Checking** | Each project keeps a `LESSONS.md`: what the agent got wrong, how it was caught, what it cost. `verify-preview` checks with negative controls; Clef asks "does this follow the brief?" | `STUDIO.md` Skills; `INFRA.md` §6 | D's qualitative material |
| **Collective** | Mob agenting on the projector, project rooms with a shared brief, forks and variations, a class queue for the funded agent, shared skills, a class UI students reshape | `STUDIO.md` Collective features; `INFRA.md` §9 | The shared board (B), the group piece (C), the queue's spending (D) |
| **Shared skills** | One `skills/` folder used by the studio, Claude Code and OpenCode. Teacher distils class failures into skills; students draft their own for promotion | `STUDIO.md` Skills | Measurable effect in the usage record |

**Intake:** a five-minute form at registration (discipline, AI used, ever
opened a terminal, laptop and memory, what they want to make). Session 1 is
the real measure; the usage record after A adjusts B. Not only words: sketch or
screenshot to page, voice briefs (Whisper covers Estonian), clickable rubrics
(`INFRA.md` §4).

**The stack, once:** the course studio for both talking and making (a plain
chat project type plus projects that get a URL), Claude Code / OpenCode for
the projector and level 3. LibreChat is only a fallback. One gateway, one usage, one skills folder (`INFRA.md` §2, §5).

## 3. Blocks

Each block: about four sessions plus own work. Model types are new kinds
from `INFRA.md` §7, placed where they fit.

### A — Sissejuhatus: models as material

**Aim.** How LLMs work, the model zoo (commercial / open, wasteful / frugal,
text, code, image, audio, video), how well they know Estonian language and
culture, and the habit of checking.

**Sessions.**
1. Map the group's AI experience (from the intake). Everyone ships a page at
   level 1 and runs `eka-probe` on their laptop (`INFRA.md` §8). Usage starts.
   Mob agenting on the projector shows level 3.
2. The zoo: the same brief through a cheap open model, Claude and a local
   model (laptop or VR lab workstation); compare result, tokens, joules in the
   usage. Decision models introduced: Clef answers with probabilities and
   writes nothing.
3. Estonian awareness with Krister Kruusmaa / EKI: leaderboard probes,
   EstLLM-70B as a probe target, the Estonian token premium. Creative
   hallucinations: small and old models as an aesthetic.
4. Checking: read a selection of real cases, then each other's pages with
   `verify-preview`; first `LESSONS.md` entries. Show personal projects.

**Output.** A personal creative project at a live URL, with its usage rows
and a `LESSONS.md`.

**Relies on.** Studio core (chat + preview, publish, the instructions and template
skills, verify, chat project type), gateway with per-student budgets, `eka-probe`,
the usage record. Tiny recursive models as an optional pattern-puzzle exercise.

**Partner.** Krister Kruusmaa / EKI LLM leaderboard.

**Themes.** Creative hallucinations; AI stomping on small cultures (from
footprint visualization); the "try, relate, sometimes say no" goal.

### B — Kahemõõtmeline loomepind: our own canvas

**Aim.** Understand how Figma and Miro work by building our own creative
surface; take Engelbart, Kay, Raskin and Victor as specs to build, not history
to read. Start the multiuser infrastructure that C reuses.

**What students do.**
- Fork and extend the visualia board (doesn't start from scratch; see
  `VISUALIA.md` if present). Each group picks one idea (direct manipulation,
  explorable explanation, zoom UI, …) and implements it.
- Reshape the studio's own UI: theme → layout → widgets → fork, individually
  by default, the class UI by proposal and vote (`STUDIO.md` "A UI students
  can reshape"). Designing the UI contract is a discussion: what should a tool
  let its users change?
- **Judgement Machines:** write decision schemas (critique rubric, "is this
  AI-made?", "is this kitsch?", "does this follow the brief?"), run them over
  each other's work, draw the probability distributions on the board, find
  where the model is confidently wrong (`INFRA.md` §6).
- Collective forms in practice: shared brief before acting, forks and
  combines, class queue for bigger builds. A room agent is an optional group
  project (`INFRA.md` §9).
- Diffusion text as material: text emerging from noise as typography.

**Output.** Group extensions merged into the shared board, which becomes the
course's place for materials and projects.

**Relies on.** Studio collective features (rooms, shared brief, mob mode,
forks, `ClassAgent` queue), reshapeable UI, shared canvas via visualia's MCP
package, Clef / Clef-omni, advanced multi-file mode for those who want it.
Workshop UI and its realtime pieces for the multiuser layer (see
`WORKSHOP.md` if present).

**Partner.** Own projects (visualia, Workshop UI, Fachwerk); no external
partner named in the sources.

**Themes.** Coming back to our senses (what input the canvas accepts beyond
mouse and keyboard; hard and soft interfaces); AI-based data visualization.

### C — Kolmemõõtmeline loomeruum: body, room, hardware

**Aim.** From the 2D surface into physical space, the body, VR and AR. AI
interprets movement, sound and speech and builds and responds to virtual and
hybrid worlds; agents write software for real devices, not only browsers.

**What students do.**
- With Taavet Jansen and Liis Vares: body-based staging, mixed reality,
  real-time worldbuilding with agent-written code. EKA VR lab devices and 3D
  scanners.
- With Rene Rebane: breadboard and microcontroller, firmware written and
  debugged by AI; what goes wrong when it reaches the physical world.
- Speculative design (Nesli & co): utopias and dystopias of "the world is
  built on AI software".
- New model types: world models exported to WebXR (critique physics
  hallucinations); realtime voice agents and open music models, and the
  missing Estonian TTS as a lesson; Clef-omni or Liquid d1-omni for
  interpreting voice and video input.
- Checking moves into the room: physical failure cases go into `LESSONS.md`.

**Output.** One virtual-reality experience made by the whole group.

**Relies on.** The multiuser layer and board from B; rooms and mob mode for
group building; advanced mode and levels 2–3 for device code; school GPU box
for world and local models; usage including measured watts from the box.
Positron's rig (Pi, synth, WebMIDI) is parked and not assumed.

**Partners.** Taavet Jansen & Liis Vares (Held In Human); Rene Rebane; EKA VR
lab; Nesli / speculative design.

**Themes.** Hardware controlled by AI software; coming back to our senses
(the body-centred and surveillance angles).

### D — Kainestav kokkuvõte: read the usage record

**Aim.** A–C treated AI as a co-creator. D looks at its cost to environment and
society and asks whether responsible, creative AI exists at all, using the
course's own data rather than reconstructing it afterwards.

**What students do.**
- Visualise the usage record with agents: energy and CO₂ as ranges, the unmeasured
  share shown, our own comparisons (idle laptop hour, GPU box day, Tallinn
  tram ride) (`INFRA.md` §10 dashboard rules).
- Beyond energy: money (flat fee vs real cost), time (paired tasks with and
  without AI), learning, the Estonian token premium, deciding vs writing
  (joules for a Clef pass vs a generated answer), labour (our logs classified
  by task).
- Scarcity: the class queue's spending, what it bought, who used it.
- Read the `LESSONS.md` files together: where did the agent lie, flatter or
  give up? What did class skills change?
- Sustainable alternatives: hybrid / state-space models and tokenizer-free
  models measured against transformers.

**Output.** Group data visualisations and a public presentation of the
course's results.

**Relies on.** Usage and coefficient table, live dashboard, Clef / Clairic
for tagging, the gallery and board as the presentation surface.

**Partners.** Elise Rohtmets (Tehnikakõrgkool; ethics and technology
transfer); Silver Keskküla (scamguardian.ai; deception, vulnerability, real
stakes).

**Themes.** AI footprint visualization; AI doing the dishes (which jobs
disappeared from our own process, which new ones appeared).

## 4. Infrastructure, in one paragraph

Course gateway (Cloudflare AI Gateway + Worker) with per-student spend limits;
GLM-5.3-Flash, Qwen3.8 and DeepSeek V4.1 Flash by default; Claude on an
EKA-owned API key, capped; Clef-flash in front for routing, brief checks,
queue triage and grading. Laptops are not the compute; a school GPU box is the
step up. The shared agent never runs on a personal subscription. Budget tiers
and what each buys: `INFRA.md` §11. Studio build order, scope (≈30–35 days)
and the experiments that decide what to cut: `STUDIO.md` "First experiments",
"Scope".

## 5. Open questions

1. **Budget tier** (€0 / ~€300 / ~€1,500 / ~€6,000+); sets the realistic
   ambition of every block.
2. **API account owner:** EKA (clean) or Kristjan (ask Anthropic first).
3. **3 EKAP for the whole course or per part?** Changes how much a block asks.
4. **Course language:** Estonian with English materials, or bilingual
   (exchange students, the EKI thread)?
5. **Structure:** keep the four blocks, or let the EN themes lead with A–D as
   sequence only?
6. **Partner status:** who has said yes (Kruusmaa, Jansen/Vares, Rebane,
   Rohtmets, Keskküla, Nesli)?
7. **EKA IT:** VR lab still there and which GPUs; install rights and outbound
   tunnels; OIDC login; a separate user-content domain; GDPR contact.
8. **Data:** counts only or prompt content by opt-in; who sees per-student
   rows; public or class-only dashboard; any students under 18.
9. **Cheap models in Estonian:** do they produce working pages from Estonian
   briefs, and hold tool calling over 10+ steps? (Studio experiments 1 and 3.)
10. **Collective rooms:** brief edit conflicts, moderating a disruptive
    member, how collective authorship is credited and whether students can opt
    out of being named.
11. **Positron (parked):** infrastructure or only an example; does C ever use
    the real rig?

## 6. Documents

| File | What it holds |
|---|---|
| `PLAN.md` | This course plan: through-lines, blocks A–D, open questions |
| `INFRA.md` | Gateway, models, levels and clients, decision models, new model types, installs, shared agent, impact measurement, budget |
| `STUDIO.md` | Build plan for the course studio: architecture, data model, skills, collective features, reshapeable UI, experiments, scope |
| `WORKSHOP.md` | The January 2026 workshop app: what worked, what to bring into the studio (room chat vs agent requests, stage and lock, card wall, preview harness), ~10 days of porting |
| `VISUALIA.md` | Visualia reassessed as the class board: evolve it (DOM-first, Durable Object sync, D1/R2, studio project nodes, hosted MCP), ~14 days to usable |
| `STRUCTURE.md` | Repos, names and domains: visualia as the platform (repo, `visualia.space`), ekai as EKA's instance, school → class → project tenancy |
| `POSITRON.md` | Parked: how positron's kit, patchbay, skills and rig could feed the course |
| `sources/eka-ai-vabaaine-et.md` | Original course description (ET): blocks A–D, partners, outputs |
| `sources/ekai-course-concept-en.md` | Original concept (EN): goal, themes, partners, related projects and courses |
