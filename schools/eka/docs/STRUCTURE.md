# Structure: visualia as the platform, ekai as EKA's instance

Draft 2026-10-21. How the repos, names and domains fit together if the
platform may later serve other schools.

**Update 2026-10-21:** done differently from the steps below. Instead of
moving into the June canvas repo, that repo was renamed `visualia_canvas`
(kept as a playground) and `visualia` was started fresh from `ekai/`. The
engine is ported part by part, not inherited. The layout and domain sections
still apply.

## The decision in one paragraph

**visualia** becomes the name of the platform: the repo, the domain
(`visualia.space`) and the product. It holds everything reusable: the canvas
engine and board, the studio, the gateway and usage, the shared schema and the
core skills. **ekai** becomes the name of EKA's course running on it: its plans,
its skills, its configuration, at `eka.visualia.space`. Other schools later are
more instances, not more infrastructure. **positron** stays separate and parked.

## Why

- **Other schools.** A platform named after EKA can't comfortably serve Tartu or
  Tallinn; a course named after EKA is exactly right.
- **One repo instead of two.** The course plan already depends on the visualia
  engine. As separate repos, that means pinning a commit across repos and two
  release cycles. In one repo, board, studio and gateway share the schema,
  skills and deploys, and a change that touches all three is one commit.
- **The name fits the idea.** A visual surface people shape themselves, with
  agents inside it, is the course's core idea and visualia's original one.

## Target layout

```
visualia/                       github.com/visualia/visualia (public today)
  packages/
    engine/                     canvas engine (DOM-first, GL optional; see VISUALIA.md)
    mcp/                        becomes a Cloudflare-hosted MCP server
    three/                      3D node kind
    schema/                     NEW: shared types: school, class, project, version,
                                brief, usage row, board node kinds
  apps/
    board/                      the canvas, evolved per VISUALIA.md
    studio/                     NEW: chat and page projects, rooms, publish (STUDIO.md)
    gateway/                    NEW: gateway Worker, usage, dashboard (INFRA.md)
    eka-sitemap/                stays: EKA website work, unrelated to the course
    lab/                        optional: experiments that must not affect the course
  skills/                       core skills, used by every school
  schools/
    eka/
      docs/                     today's ekai/docs (PLAN, INFRA, STUDIO, …, sources/)
      skills/                   EKA-specific skills (Estonian copy, EKA house rules)
      config.json               school settings: name, language, login, budget, models
  plans/                        visualia's own design notes (as today)
```

`packages/react` and `packages/shadcn` go when React is dropped (VISUALIA.md).

## Domains

| Address | What |
|---|---|
| `visualia.space` | Platform home: what it is, which schools use it |
| `eka.visualia.space` | EKA's instance: studio, board, gallery |
| `<school>.visualia.space` | Other schools, later |
| `gw.visualia.space` | Gateway API, shared, with per-school keys and budgets |
| `visualia.page` (later) | Student pages for all schools: `visualia.page/<school>/<student>/<slug>/` |

**Student pages need a separate site.** They run unreviewed JavaScript, and
browsers treat everything under one registrable domain (`visualia.space`,
`x.visualia.space`, `studio.visualia.space`) as one site. A page on any
subdomain could set cookies the studio receives (cookie tossing: overwriting or
fixing a student's session), send requests to the studio that carry the
student's login, and show a fake login on a genuinely official-looking address.
That's why GitHub uses `github.io` and Google `googleusercontent.com`.

| Option | Cost | Catch |
|---|---|---|
| Two domains (`visualia.space` + `visualia.page`) | one more domain, ~€10–30/year | none: the clean way |
| `workers.dev` for pages | free | unbranded URLs; swappable later |
| One domain, done carefully | free | every detail must be right (`__Host-` cookies, Origin checks on every studio request, sandboxed iframes); phishing stays; one mistake exposes all sessions |

**Decision:** buy `visualia.space` now; serve student pages from `workers.dev`
while building and testing; buy `visualia.page` once students publish work they
want to share. Moving pages is configuration only, since the studio generates
page URLs.

Availability checked 2026-10-21 by registry lookup (confirm at the registrar):
`visualia.space`, `visualia.page`, `visualia.gallery`, `visualia.work`,
`visualia.site`, `visualia.dev` had no registration; `visualia.art`,
`visualia.studio`, `visualia.app` are taken.

## Tenancy: one more level in the data model

school → class → project. A `schools` table (id, slug, name, language, login
provider, budget, default models, skills prefix) and a `school_id` on classes,
users and the usage record. Each school gets:

- its own login (EKA OIDC if available, another school's own, or GitHub),
- its own budget and gateway key, so costs never mix,
- its own skills prefix in R2 on top of the core skills,
- its own language for UI and prompts (Estonian first).

Cheap to add now (one table, a few columns), painful to retrofit later.

## Visualia stops being only a playground

Today visualia is your free research space. Once a course depends on it, `main`
has to stay working. The rules:

- **`main` is what schools run.** Changes land through short branches and pass
  typecheck and the tests (which VISUALIA.md says don't exist yet: they become
  a prerequisite).
- **Experiments** live on branches or in `apps/lab`, never in what a school
  deploys.
- **Course-time freeze:** a school's deploy is pinned to a tag
  (`eka-<n>`); upgrades happen between blocks, not during sessions.
- **The architecture changes** from VISUALIA.md (DOM-first, Durable Object
  sync, D1/R2, hosted MCP) are needed anyway for the class board.

## Public or private

The visualia repo is public in the `visualia` GitHub org. Moving
`schools/eka/docs` into it publishes the course plans: budget tiers, partner
names, open questions, the research. That's probably fine (it's teaching
material, and open plans suit the course), but decide before moving. If not,
`schools/eka/` can be a small private repo checked out into that path, or the
docs stay in a private repo and only `config.json` and the EKA skills go into
visualia. Secrets and student data are never in either repo.

## Steps, in order

1. **Domains.** Check the `visualia` name for conflicts in education and
   software; buy `visualia.space` (your purchase). Student pages start on
   `workers.dev`; `visualia.page` comes later.
2. **Decide public vs private** for EKA's docs (section above).
3. **Move.** `ekai/docs` → `visualia/schools/eka/docs`; `ekai/README.md` rules
   → visualia's README; remove the empty `ekai/` folder. Nothing is lost:
   `ekai` has no commits.
4. **Skeleton.** Add `packages/schema`, `apps/studio`, `apps/gateway`,
   `skills/`, `schools/eka/skills`, `schools/eka/config.json`; rename the root
   package from `visualia-board` to `visualia`.
5. **Fix references.** Docs that say `ekai`, `apps/board` in "the ekai repo" or
   "the course repo" point to the visualia paths; VISUALIA.md's "pin the engine
   from another repo" becomes "same repo, tagged release".
6. **Tests first.** Before the class board work starts, add the test runner and
   the first tests VISUALIA.md lists, so `main` can be trusted.
7. **Then build** in the order STUDIO.md, VISUALIA.md and WORKSHOP.md describe:
   gateway and usage, studio core, board as DOM-first with sync, then the
   collective features.

## Risks

- **Playground vs product:** the discipline above costs some freedom; `apps/lab`
  and branches are the release valve.
- **Public repo:** every plan and every rough edge is visible. Mostly a
  feature, occasionally awkward.
- **Name conflicts:** "Visualia" is used by other companies; check before buying.
- **One-person platform for several schools:** multi-school is a design
  allowance, not a promise. Build for EKA first; other schools only once EKA
  has run.

## Open decisions

1. Platform name: `visualia` (recommended) or another neutral word?
2. EKA docs: public inside visualia, or private?
3. When to buy `visualia.page` (or `visualia.gallery`): when students start
   sharing published work.
