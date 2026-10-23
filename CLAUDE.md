# visualia

The Visualia platform: a shared canvas and studio for learning and making with
AI, run per school. EKA's course (ekai) is the first school. Start with
`HANDOFF.md` (current state), then `plans/README.md`.

# Docs contract

- `plans/` = one file per initiative, flat. Frontmatter `status: idea | next |
  building | shipped | dropped | standing` is the only lifecycle; a file never
  moves, only its status changes. `plans/README.md` is the board.
- `worklog/YYYY-MM.md` = the only journal: append-only, newest entries at the
  bottom of the current month's file.
- `schools/<slug>/docs/` = a school's course material (EKA: `schools/eka/docs/`,
  start with `PLAN.md`). Course decisions live there, platform decisions in
  `plans/`.
- `research/` = general material, not tied to one school: reading lists,
  references, notes on other people's work (start with `reading.md`).
- This file = runbook. Keep it short; put detail in plans.

# Conventions

- Vanilla JS, one HTML file per page, no framework unless a plan says why.
- Every page uses `packages/style/visualia.css` (see `plans/style.md`).
- UI text in English only; no Estonian translation (decided 2026-10-23).
- Load the `visualia-writing` skill before writing any text people read (UI
  copy, status lines, errors, notes for students, teachers or IT).
- Cloudflare Workers, Durable Objects, D1, R2. One gateway for every model call.
- Dependencies pinned exactly (`.npmrc` has `save-exact`). Upgrades are a
  deliberate commit, never a side effect, and never during a school's sessions.
- A school's deploy is pinned to a tag (`<school>-<n>`).
- **esbuild is overridden to 0.28.1** (`package.json` `overrides`). Wrangler
  4.149+ asks for 0.28.2, whose macOS binary is killed on this machine
  (exit 137 at install, checked 2026-10-21); 0.28.1 runs. Re-test before
  removing the override: `node_modules/esbuild/bin/esbuild --version` after a
  clean install. Other local projects used `npm:esbuild-wasm@latest` instead;
  that works too but is slower and unpinned.
- **workerd is overridden to 1.20260701.1** (the version `../trip` runs):
  newer builds (1.20261006+, 1.20261019) are killed here (exit 137), which
  breaks every local wrangler command (`d1 --local`, `r2 --local`, `dev`).
  It supports compatibility dates up to 2026-07-08, so local dev needs
  `--compatibility-date 2026-07-08`. Deploys are unaffected (they don't run
  workerd). Re-test as for esbuild: `node_modules/workerd/bin/workerd --version`.
- Student work and secrets never go in git.

# Pushing

Origin is `https://github.com/visualia/visualia.git`, in the `visualia` org
owned by the personal GitHub account (`kristjanjansen`). The work account
(`Kristjan-Jansen_enefit`) is usually active and gets a 404 here. Switch,
push, switch back:

```sh
gh auth switch -u kristjanjansen
git push origin main
gh auth switch -u Kristjan-Jansen_enefit
```
