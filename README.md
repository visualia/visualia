<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg">
  <img src=".github/logo.svg" alt="Visualia" width="96">
</picture>

# Visualia

Interactive learning in the browser, since 2020. Now a shared canvas and studio
for learning and making with AI, run per school.

```
apps/gateway/     AI gateway Worker: identity, routing, usage, dashboard; every model call goes through it
apps/studio/      chat and page projects, rooms, publish
apps/mcp/         mcp.visualia.space: your own AI tool reading Visualia, read-only
apps/probe/       what can my machine run
packages/         the style sheet, the text helper, shared types, prompts, the model table
skills/           core skills (Agent Skills format), used by every school
schools/eka/      EKA's course (ekai): docs, school skills, config
evals/multi-file/ the studio agent's eval
plans/            platform plans, one file per initiative (board: plans/README.md)
worklog/          monthly journal
```

Two more repositories, checked out beside this one (`plans/repo-split.md`):

| Repository | What |
|---|---|
| [visualia/pool](https://github.com/visualia/pool) | Visualia Pool: the app and program that put a computer in the pool, and `pool.visualia.space`. Kept apart so school IT can audit it |
| [visualia/research](https://github.com/visualia/research) | private: research notes, the evals, the early image engines |

Rules: student work and secrets never go in git; dependencies are pinned; a
school's deploy is pinned to a tag. See `CLAUDE.md`.

## Run it on your computer

You need Node 22 or newer.

```sh
npm install
npm run setup     # clones visualia-pool (and visualia-research, if you have access) beside this checkout
npm run dev       # the gateway, the studio and the pool, each its own wrangler dev
```

| | Address |
|---|---|
| studio | http://127.0.0.1:8790 |
| gateway | http://127.0.0.1:8791 |
| pool | http://127.0.0.1:8788/join |

The three find each other through wrangler's dev registry (the service bindings in each `wrangler.jsonc`) and share
one local D1 and R2 in `.wrangler/state`. `npm run dev` applies the D1 migrations first. Model calls still go to
Workers AI, so they need a Cloudflare login and cost the same as deployed ones.

A course key for local use: `node add-key.mjs <person> eka` in `apps/gateway`, then run the command it prints with
`--local --persist-to ../../.wrangler/state` instead of `--remote`.

Put a computer in the local pool: build `visualia-pool-cli` in the pool checkout (its README), then
`POOL=http://127.0.0.1:8788 VISUALIA_KEY=<key> target/release/visualia-pool-cli`. The pool needs
`apps/pool/.dev.vars` with `SESSION_SECRET=<any long random text>` and `ORIGIN=http://pool.visualia.space` (wrangler dev
rewrites the Origin header to the route's host).

Deploy one part: `npm run deploy -w apps/<name>` (the pool: `npm run deploy -w worker` in visualia-pool).

History, private: visualia_original and visualia_history (2020 to 2022), visualia_canvas (June 2026).
