# Handoff

Written 2026-10-21, end of the first long session. Read this, then
`plans/README.md` (the board) and `worklog/2026-10.md`.

## What exists and is live

| Address | What | Code |
|---|---|---|
| https://studio.visualia.space (also https://visualia.space) | The studio: sign in with a course key, projects, describe → live preview → change → versions → publish; preview errors with "Fix it"; usage page at `/usage` for everyone signed in | `apps/studio` |
| https://projects.visualia.space/<person>/<slug>/ | Published projects, served with a CSP sandbox | `apps/studio` (same Worker) |
| https://gw.visualia.space | Gateway: every model call; `usage` rows in D1; `Trusted` entrypoint for the studio (service binding) | `apps/gateway` |
| https://probe.visualia.space | "What can my computer run?" + in-browser speed test (WebLLM) | `apps/probe` |

Cloudflare (personal account, Workers Paid): D1 `visualia`, R2
`visualia-projects`, AI Gateway `visualia` (logs show person/project metadata),
zone `visualia.space`. `workers_dev` is off everywhere.

Default page model: `@cf/deepseek-ai/deepseek-v4.1-flash-1017` (gateway
`DEFAULT_MODEL`); fallback Gemma 4. Instructions (always on):
`schools/eka/instructions.md` v0.3, bundled into the studio at deploy.

## Keys

Course keys are `XXXX-XXXX` (uppercase, no I/O; case and dashes ignored). Only
SHA-256 hashes are stored. The two live keys (`eka-teacher`, `eka-test-001`)
are in `.keys.local` (gitignored, chmod 600). New key:
`node apps/gateway/add-key.mjs <person> [school] [role]`, then run the printed
command. Sign-in and gateway key checks are rate-limited (10/min per address).

## How to deploy and push

- `cd apps/<app> && npm run deploy` (studio and probe copy `visualia.css`,
  `models.json`, `instructions.md` in first). Gateway: `npx wrangler deploy`;
  D1 migrations: `npx wrangler d1 migrations apply visualia --remote` from
  `apps/gateway`.
- Push needs the personal GitHub account (CLAUDE.md): switch, push, switch back.
  The repo `visualia/visualia` is private.
- Wrangler 4.151.3 with esbuild overridden to 0.28.1 (0.28.2's binary is killed
  on this Mac). In this environment, wrangler/npm/node network commands need the
  sandbox disabled.

## Gotchas met today

- DNS: new hostnames were cached as nonexistent by the teacher's network (work
  Chrome is managed, secure DNS can't be switched). `studio.visualia.space`
  exists as a second studio address for that reason. Test scripts resolve via
  1.1.1.1 with undici (scratchpad), since `sudo` can't prompt here.
- Workers static assets redirect `/x.html` → `/x`: the studio asks for clean
  paths (a loop bug came from this).
- Workers AI non-streamed calls die at 120 s (error 3046): everything streams.
- Never type course keys into the browser on the live site from an agent; test
  with scripts, or the teacher signs in.
- Think (`@cloudflare/think`) was dropped for the core (needs AI SDK v7,
  `@cloudflare/computer`, React-style client). The studio uses the plain
  `agents` SDK `Agent` and a native WebSocket. Think/Computer stay options for a
  multi-file advanced mode.

## Decisions the teacher made (keep them)

- UI: black sans on white, two sizes, two weights, two inks, three spaces, boxed
  fields; English text for now; minimal wording ("the list is the answer"); the
  probe is for students, not technical.
- "Instructions" (always on) vs "skills" (on demand); no "house rules".
- Usage is visible to every student (pseudonymous ids, no prompt text).
- Studio at `visualia.space` (subdomains per school later); student work at
  `projects.visualia.space`. "usage" not "ledger"; "footprint" for the computed
  view later.
- No timelines in plans. Positron is parked. LibreChat only a fallback.

## Open / next

1. Teacher tries the studio for real; listen to what breaks.
2. The first "Fix it" round on a real error (the "deep tunnel 3d" project's v2
   should now show its problems).
3. Run evals 2–3× per change (one run is noisy); v0.3 instructions not yet
   evaluated.
4. Before real students: AI Gateway payload logging off (counts only), proper
   login (EKA OIDC?), budgets per student.
5. Plans waiting: `local-models` (steps 2–4: use my computer, class pool),
   Clef as self-check/router, rooms and the other collective features
   (`schools/eka/docs/STUDIO.md`), the board (`schools/eka/docs/VISUALIA.md`),
   energy/CO₂ ranges on the usage page.
6. Gemma's poster overflow (run 4); 3D camera framing still too close.
