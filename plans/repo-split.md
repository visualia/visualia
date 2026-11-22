---
status: building
---

# Repo split: pool, platform, research

Asked 2026-11-22: *"break Visualia packages and stuff into subparts so people can review them in GitHub separately ...
pool is something which IT wants to audit separately, but at the same time we also want to see what it sends and
receives from a server ... at the same time I want the system easy to run locally"*. Then: *"look harder at lab,
perhaps we just need to take important and leave other to md files"*, *"or just visualia/research?"*, *"also
kristjanjansen/talks"*, *"add readmes how to run"*, *"local pool client compilation or we do it in gh actions?"*

## The three repos

| Repo | Visibility | What | Reviewer's question |
|---|---|---|---|
| `visualia/pool` | public | the app and CLI (Rust), the pool Worker (`pool.visualia.space`), the wire protocol | what does this run on my computer, and what does it send and receive |
| `visualia/visualia` | public | gateway, studio, mcp, probe, `packages/`, D1 migrations, `skills/`, `schools/`, plans, the studio's own eval (`evals/multi-file`) | the platform |
| `visualia/research` | **private** | `research/`, the finished and running evals, the early image engines, `m1-worker` | how was this measured |

Talk material (Arunädal research, the white-out replay, the talk's model runs) goes to `kristjanjansen/talks`
(private), next to `harno/`, as `research/harno/` did on 2026-11-21.

Checked out side by side: `~/personal/visualia`, `~/personal/visualia-pool`, `~/personal/visualia-research`,
`~/personal/talks`.

## Why the pool holds the server too

The app talks to one address, `pool.visualia.space`. With the client and that Worker in one repo, one PR shows both
ends of any change to what goes over the wire. The gateway reaches the pool only through the `ForGateway` service
binding, and that entrypoint is the contract with the platform.

## The pool keeps no data (no D1)

Measured 2026-11-22: the pool Worker made two read-only queries on the shared `visualia` D1, both about sign-in
(`apps/pool/src/index.js` `login`: key hash to person; `session`: the person still holds a key that isn't revoked,
and their school). It wrote nothing (usage rows are the gateway's, from the `usage` the pool returns), and the Pool
Durable Object stores nothing.

So the pool asks the gateway instead, through a new service binding `GATEWAY` (entrypoint `ForPool`):
`signIn(key)` and `person(id)`. The key normalising and hashing then lives in one place (it was in the gateway, the
studio and the pool). The pool repo has no database binding, no schema, no keys table.

The other way round, the gateway's pool model names came from importing `apps/pool/src/models.js` across folders.
Now the gateway asks the pool for the list through `ForGateway` (`models()`, an RPC method) and keeps it for a minute. The pool
owns its list.

## What else crossed the line, and how each is cut

| From | To | Was | Now |
|---|---|---|---|
| pool Worker | D1 `visualia` | 2 SELECTs | `GATEWAY` binding, `ForPool` |
| gateway | `apps/pool/src/models.js` | import | `models()` through `ForGateway` |
| studio `src/prompts.js` | `apps/pool/src/models.js` | import, for the ChilloutMix default negative prompt shown on `/prompts` | a literal copy with a pointer (the app applies its own copy) |
| pool build, app build | `packages/style`, `packages/text` | copied at build | vendored in `vendor/` with the source commit; `vendor/sync.mjs` refreshes from `../visualia` |
| `apps/pool/meter.mjs` benchmark | `schools/eka/instructions.md`, `evals/first-pages/briefs.json` | read by path | `INSTRUCTIONS`, `BRIEFS` env, defaults point at the sibling checkouts |
| depth tests | `evals/estonian-visuals/out/` | read by path | `DEPTH_DATA` env, default `../visualia-research/evals/estonian-visuals/out/` |
| `upscale/build-web.sh`, `publish-weights.mjs` | `apps/pool` | relative path | `worker/` in the same repo |

## What goes where

**visualia/pool**
```
protocol/frames.md   every frame, both directions (moved out of the comment in worker/src/index.js)
app/                 apps/pool-app: pool-core, src-tauri, ui, upscale (pool-core links it by default)
worker/              apps/pool: the Worker, join.html, models.js, meter.mjs, tests
vendor/              visualia.css, pool.css, text.js, check-text.mjs from visualia/packages
```

**visualia/research** (`git filter-repo` keeps each file's history)

| Path | Why it's here |
|---|---|
| `research/` (all, plus the untracked notes) | reading and findings, not code the platform runs |
| `evals/estonian-visuals`, `embeddings`, `first-pages`, `svg` | finished or running studies; nothing in the platform imports them |
| `engines/biggan`, `stylegan`, `dalle-mini`, `sd-web` (from `apps/pool-app`) | excluded from the app's Cargo workspace; the app does not link them |
| `m1-worker` | image generation on the M1 (Python, mflux), research runs |

Finished work already has a write-up with its numbers (`research/*.md` or a visualia plan); the research README
indexes each folder against it. The finished code stays in place so a run can be repeated: in a private repo it costs
no reviewer anything. Running work (estonian-visuals, costumes, the drift room) stays as code.

**kristjanjansen/talks** `arunadal/research/`: `arunadal-2026.md`, `arunadal-demo.md`, `talk-model-runs.md`,
`talk-white-2026-11-20.md` and its folder. The deck itself is still in `evals/estonian-visuals/out/` (git-ignored,
12 GB with the media); moving it is `stage.md` and `talks-online.md`, not this plan.

**The studio's 803 visuals pictures** (118 MB of JPGs in `apps/studio/public/visuals`) stay for now. They go to R2
with `talks-online.md`'s manifest approach; that is its own change.

## Running it locally

- `visualia/scripts/setup.mjs`: clones the siblings that are missing and links `research` and the moved evals back
  into this checkout (git-ignored links), so every `research/...` and `evals/<name>/...` path in plans and handoffs
  still opens.
- `npm run dev` in visualia (`scripts/dev.mjs`): one `wrangler dev` each for the gateway (8791), the studio (8790) and the
  pool (8788), bound through wrangler's dev registry, one local D1 and R2 in `.wrangler/state`, D1 migrations applied
  first, `--compatibility-date 2026-07-08` for the workerd override. (Not one session with several `-c` configs: as
  documented, only the first worker gets the port there, so the pool's socket would be unreachable; read, not tried.) Port 8787 is left free: another project uses it.
- `visualia-pool-cli` against it: `POOL=http://127.0.0.1:8788`. wrangler dev rewrites the Origin header to the route's
  host, so the pool's `.dev.vars` has `ORIGIN=http://pool.visualia.space`.
- Each repo's README says how to run it.

## Building the app: GitHub Actions for releases, local for development

Already decided in `worker-app.md` step 3. What that means here:
- **Every PR:** Actions runs `cargo test -p pool-core --no-default-features`, the core built as WebAssembly, and the
  Worker's node tests. That needs no secret.
- **A release (tag `pool-<version>`):** Actions builds on macOS (later Windows), signs the update with the updater
  key (an Actions secret in a `release` environment that only the owner approves), attests the build
  (`actions/attest-build-provenance`), and publishes to R2. IT can then check that the binary came from the tagged
  commit they read, which a build on the teacher's Mac can't show.
- **Local `cargo build`** stays for development. On the managed work Mac ThreatLocker has killed new binaries
  before (`worker-app.md`); a CI build avoids that for everyone else.
- **Open:** a Developer ID (Apple, 99 USD a year) for notarisation, and Windows signing (EKA's PCs). Until then
  releases are ad-hoc signed, as now. The updater key leaves the work Mac only when the release workflow exists,
  after a backup.

## Steps

1. ~~Plan.~~
2. `ForPool` in the gateway, `GATEWAY` binding in the pool, `models()` on `ForGateway`. Built and tested locally
   2026-11-22 (`npm run dev`: a wrong key goes back to `/join?wrong`, a right one signs in, `/me` answers, revoking the
   key signs the person out, the socket opens with 101, the gateway lists the pool's models). Deployed 2026-11-22
   (gateway `32176521`, pool `ed016398`; the pool's `wrangler.jsonc` pins the account now). Live: a wrong key goes to
   `/join?wrong`, eka-teacher signs in, the gateway lists the pool's models.
3. ~~`visualia/pool` locally: filter-repo, layout, paths, vendor, protocol, README, check workflow.~~ Pushed. The Rust half of the check first runs in Actions (no Rust on the work Mac).
4. ~~`visualia/research` locally: filter-repo, package.json, README, paths to the siblings.~~ Pushed.
5. ~~Talk material to `kristjanjansen/talks` (`arunadal/`).~~ Pushed, and the talk itself with it (`arunadal/talk/`, its media out of git, research `out/`
   linking to it).
6. ~~visualia: what moved removed, `setup.mjs`, `npm run dev`, README and `CLAUDE.md`.~~ The 12 GB of untracked outputs
   moved with their folders (renames, same disk); links at the old paths keep the running `serve.py` and every old
   path working.
7. Later: the release workflow (needs the updater key as a secret); protocol fixtures parsed by both the Rust and the
   JS tests; a `--trace` flag on `visualia-pool-cli` that prints each frame in and out (types, sizes, models; never
   prompts unless asked); a LICENSE for the public repos (`pool.md` says open source, neither has one).
