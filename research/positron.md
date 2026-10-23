# What Visualia could take from positron

A read-only review of `~/personal/positron` (2026-10-23): what Visualia could
take from it, as code or as ideas. Positron is its own project now: video
rooms, a Cloudflare radio "cast", a "patchbay" model, and since 2026-10-22 an
M1 agent that drives Ableton Live and OBS. `schools/eka/docs/POSITRON.md`
(parked 2026-10-21) has the earlier note, and `visualia-writing` already came
from `positron-describe`. Paths below are in the positron repo.

## Ranked

1. **Diagram kit.**
   - **Code:** `demo/shell/diagram.mjs` (1,888 lines, no imports, tested by
     `diagram-test.mjs`), with the rules in `plans/plan-diagram.md` and
     `.claude/skills/positron-diagram`.
   - **Maturity:** works, done 2026-10-14. It now lives only at
     `/kit/diagram/`.
   - **How it works:** SVG with the text inside it, from a small JSON spec
     (nodes, children, links). No Mermaid. The pure parts are `layout`,
     `wrapLines`, `checkOverlaps` and `checkEnds`.
   - **For Visualia:** course docs, and "where a request goes" (studio →
     gateway → tab, M1 or cloud).
   - **Reuse:** copy the layout and checks into `packages/diagram`, then
     write a monochrome renderer. The tinted, rounded boxes (`TECH_HUE`)
     break `plans/style.md`.
   - **Rules to keep anyway:** every arrow is named by what crosses it, and
     a machine has one fixed name on every diagram.
2. **Patchbay vocabulary and layout.**
   - **Code:** `demo/shell/bay-layout.mjs` (255 lines, no imports, ranks and
     wire lanes), `bay.mjs` (sites, nodes, ports, links; tangled with MIDI,
     so ideas only) and `presence.mjs` (online / checking / coming / offline,
     `MISSES = 2`).
   - **For Visualia:** a live picture of the pool and the gateway's routing.
     Workers are sites, models are nodes, jobs and fallbacks are links. The
     board's remix lines are the same kind of graph.
   - **Conflict:** the wires are coloured by medium; Visualia would show the
     medium as a word.
3. **Verification practice (patterns).**
   - **Where:** `LESSONS.md` and `lessons/`.
   - **Asserts:** an assert checks the shape of an answer. A check that
     can't fail is no check, so prove a guard fires. Confirm the deploy
     landed before asking anyone to test.
   - **Tagged claims:** MEASURED / READ / INFERRED, worth using in Visualia's
     pool and model notes.
   - **Self-checks:** costly checks run only under `?selfcheck=1`
     (`selfcheck.mjs`).
   - **Shared checkouts:** `.claude/hooks/guard-tree.mjs` refuses
     `git add -A` when several agents share a checkout.
4. **The wish worker's guard pattern.**
   - **Code:** `workers/wish/src/wish.mjs` and `limit.mjs`.
   - **Pattern:** the model proposes and the page validates before anything
     happens. Around it: an Origin allowlist (not security), a per-address
     limit (Cloudflare's limiter is "permissive" and counts per location),
     and a body cap derived from cost.
   - **Measured** in `research/stt-and-patch-models-2026-10-15.md`:
     - Keep whisper-large-v3-turbo for speech.
     - Nova-3 has no Estonian.
     - Wrong patches came mostly from missing context: about 32% were right,
       71–76% once the page sent the full list.
   - **Unmeasured:** Whisper's Estonian accuracy.
   - **For Visualia:** "speak a brief" and the gateway's limits.
5. **M1 studio agent pattern.**
   - **Code:** `rig/m1/studio-agent.mjs` (a LaunchAgent dialling out to a
     relay), `obs-control.mjs` (an obs-websocket v5 client, no dependencies)
     and `demo/shell/studio-key.mjs` (HMAC-signed commands, 30 s window).
   - **Maturity:** a one-day spike, partly uncommitted there.
   - **Idea:** anything that starts something takes a signed command (the
     pool app, block C devices).
   - **Lesson** (`lessons/rig-m1.md#studio-agent`): a GUI app started from
     ssh runs outside the login session. That matters for our M1.
6. **Video rooms on Cloudflare's SFU.**
   - **Code:** `demo/room/video-room.mjs`, `sfu.mjs` (no imports) and
     `workers/sfu/worker.mjs` (WHIP live input).
   - **Maturity:** deployed 2026-10-22, lightly tested.
   - **For Visualia:** rooms and mob mode, a stage or projector in blocks B
     and C.
   - **Conflict:** positron's rooms have no teacher, class or school, so
     Visualia's identity layer would be its own.
7. **Ableton Live / OBS control** (`/remote/live/`, AbletonOSC). Low value: a
   block C demo at most (`PLAN.md` says the rig is parked).
8. **Smaller pieces:**
   - `line-chart.mjs` (162 lines), for the usage page, made monochrome.
   - `chat-ui.mjs`, now low value: Visualia has its own class chat.

## Skills (`.claude/skills/`)

| Skill | For Visualia |
|---|---|
| `positron-verify` | Adapt as a short `visualia-verify`: shape asserts, negative controls, read the build stamp |
| `positron-diagram` | Adapt with the diagram kit, without hues |
| `positron-describe`, `positron-slides` | Already in `visualia-writing`; `slides` could feed course decks |
| `positron-compose` | Pattern only |
| `positron-git` | Adapt almost as is if agents run in parallel (shared-checkout traps, deploy from a clean worktree) |
| `positron-studio-start` | Pattern for a level-3 `eka-start` (in POSITRON.md) |
| `positron-xr` | Adapt for block C (WebXR, Quest) |
| `positron-ui`, `concepts`, `streaming`, `hardware`, `cast`, `history` | Positron's internals; not usable |

The visualia repo is private, so adapted skills are frozen copies with a
source line.

## Lessons that apply here

- **Shared checkouts:** another agent deployed an uncommitted build change to
  production (`plan-agents.md` §11). Positron's fixes: `deploy.mjs`, a tree
  digest in the build stamp, deploying from a clean worktree.
- **Archived ideas:**
  - A UI built from the model's structure stayed a plan
    (`plan-connect-ui.md`).
  - WebMCP was archived because a tool call carries no user activation
    (`plan-webmcp.md`).
- **Chrome's built-in model:**
  - It needs a ~4 GB download and 22 GB of free disk.
  - It doesn't run on phones and has no Estonian (documented, not measured).
  - That supports WebLLM in the pool.
- **"I don't understand this" is a bug report**, and a readout that never
  changes teaches readers to ignore it. Both apply to the usage and pool
  pages.
- **Unknown:** whether positron's M1 agent and the Visualia Pool app fight
  over the M1's 16 GB; nothing measures both running together.
