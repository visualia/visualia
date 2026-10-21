# Positron in the course

**Status: parked (2026-10-21).** Kept for later; nothing here is planned
work until it's picked up again.

Draft 2026-10-21. How `~/personal/positron` (positron.studio, public at
`positron-studio/positron`) could feed the course and the studio. Based on
the repo as of 2026-10-21 (last build that day).

## What positron offers today

Its "API" is, as you say, mostly implicit: skills and source.

| Asset | What it is now | Shape |
|---|---|---|
| **Kit** (`demo/shell/*.mjs`, `/kit/<part>/`) | Vanilla ES modules: `chat-ui.mjs` (chat log, compose, columns, grids), layout, status, share, slides, timeline, icons, devices, input | No framework; one HTML file per page; unversioned |
| **Patchbay model** (`demo/shell/bay.mjs`) | `createBay`: sites, nodes, ports, links. Media `midi, audio, clock, value, video, program, file, state`; node kinds include `person`; `chooseTransport` picks HLS/MoQ/WHIP/relay by medium and distance | A data model plus drawing (`createPatchbay`) |
| **Skills** (14, `.claude/skills/`) | 50–2,174 lines each; all marked `metadata.internal: true` | Agent Skills format; written for working *on positron*, and probably partly out of date |
| **Verify harness** (`positron-verify`, `verify.mjs`, evals) | Asserts, stand-ins, negative controls, "what counts as evidence" | Code plus a 1,693-line skill |
| **LESSONS.md + `lessons/`** | ~320 lesson files on what agent-built pages got wrong | Prose |
| **Rig** (`positron-hardware`, `rig/`, workers) | Raspberry Pi board, Novation Circuit (with consent rules), Ableton, WebMIDI, streaming relay, cast | Live hardware and workers |
| **Onboarding** (`positron-studio-start`) | The paste-one-prompt setup that builds someone their own positron-shaped site on Cloudflare | 1,264-line skill |

## Where each fits

### 1. The kit is the studio's UI

The studio needs a UI, and React isn't required (`AgentClient` from
`agents/client` is plain JS). Positron's kit already has a vanilla chat UI,
layout, status and share parts in the same one-file-per-page style. Build the
studio's pages from it: chat from `chat-ui.mjs` wired to `AgentClient`, preview
as an iframe, status and share from the kit. Same conventions in both projects,
no second design system.

### 2. The patchbay is the collective model

The bay's vocabulary already covers what the collective studio needs to draw:
a `person` node kind, `state` and `file` media, `where` (machine to
internet-many). A class can be shown as a bay: students as person nodes,
projects as nodes, forks and shared briefs as links, the shared queue as a
heavy link with its cost. That gives the visualia board (block B) a ready
vocabulary, and connects naturally to block C, where the same links carry MIDI,
audio and video to real devices.

### 3. Skills: split into general and positron-only

Every skill is `internal: true` and written for working on positron itself.

| Becomes a course skill (adapted, stripped of positron specifics) | Stays positron-only |
|---|---|
| `positron-compose` → layout without nudging numbers (air, alignment, phone) | `positron-cast` (radio stations) |
| `positron-describe` → writing the words a visitor reads, checked against the page | `positron-history` (renames, retired routes) |
| `positron-verify` → evidence rules, negative controls → feeds `verify-preview` | `positron-git` (shared checkout traps) |
| `positron-slides` → plain explanatory voice for talks and lessons | `positron-streaming` (transport internals) |
| `positron-diagram` → diagrams that say something | `positron-concepts` (concept page internals) |
| `positron-xr` → WebXR, passthrough, the way out of a headset page (block C) | `positron-hardware` (until the rig API below exists) |
| `positron-ui` (the general parts) → page furniture, controls as ports | `positron-studio-start` (stays, see 6) |

The adapted versions live in the course `skills/` folder with
`metadata.source: positron/<skill>@<commit>`, so it's clear where they came from
and how stale they are. Rule: a course skill is a frozen, reviewed snapshot; it
doesn't follow positron's head.

### 4. The rig is block C's hardware

The Pi board, the Circuit and the streaming relay are exactly "AI software
controlling hardware". Today a student can only reach them by editing positron.
A small, explicit surface would let studio pages and agents use them:

- **Rig MCP server / HTTP endpoints:** list devices, send a note or CC, start
  and stop a stream, read status. Consent rules from `positron-hardware` (the
  Circuit accepts, never on its midi-in) enforced server-side, not by trust.
- **Rate limits and a queue:** one instrument, twenty students — the same
  scarcity lesson as the shared agent queue.
- **Bay endpoints:** a student page declares a bay with a `midi-out` port and
  links it to the board's Circuit; positron's transport choice does the rest.

### 5. Verify and LESSONS are teaching material

- `positron-verify`'s idea of evidence (shape-checked asserts, negative
  controls, "a check that can't fail is no check") becomes the studio's
  `verify-preview`, and a block A session on checking agent output.
- `LESSONS.md` is a year of real cases of agent-built pages looking right and
  being wrong (fabricated green numbers, checks that never ran, "I don't
  understand this" as a bug report). Read a selection in block A; it's the
  practical half of "critical AI".

### 6. studio-start is the level-3 onboarding

Its paste-one-prompt pattern, including the line that makes an agent stop when
it can't read the file, is how a level-3 student sets up their own site. A
course variant, `eka-start`, points at the course gateway instead of the
student's own Cloudflare account.

## Making the "API" explicit

To be dependable for a course, positron needs a public surface that doesn't
move under students:

| Surface | Form | Versioning |
|---|---|---|
| Kit | ES modules at a versioned URL, e.g. `positron.studio/kit/v1/<part>.mjs`, with a short doc per part | Frozen `v1` for the course; positron keeps moving on `main` |
| Bay schema | A JSON description of sites, nodes, ports, links and media | Versioned with the kit |
| Course skills | Adapted snapshots in the course repo | `metadata.source` with a commit |
| Rig | MCP server + HTTP, authenticated per student through the course gateway identity, consent enforced | Documented endpoints, changes announced |
| Lessons | A curated reading list (not the whole folder) | Picked once per block |

## Risks

- **Positron moves fast** (a build today; skills of 1,000–2,000 lines change
  often). Anything the course depends on must be a frozen snapshot.
- **Two projects, one person:** every surface above is maintenance. Start with
  the kit and the adapted skills, which cost least; the rig API only if block C
  needs it.
- **Hardware and consent:** a shared instrument needs server-side consent and
  rate limits before any student agent can reach it.
- **Public by default:** positron is public; course material and student data
  are not. Keep them in separate repos.

## Open questions

1. Is positron allowed to be course infrastructure (a dependency students rely
   on), or only an example to learn from?
2. Freeze a `kit/v1` now, or let the studio vendor a copy?
3. Does block C use the real rig (Pi, Circuit) or a stand-in students can't
   break?
