# Visualia

Interactive learning in the browser, since 2020. Now a shared canvas and studio
for learning and making with AI, run per school.

```
apps/gateway/     AI gateway Worker: identity, routing, usage, dashboard
apps/studio/      chat and page projects, rooms, publish
apps/board/       the shared canvas (parts ported from visualia_canvas)
packages/schema/  shared types: school, class, project, usage row, board nodes
skills/           core skills (Agent Skills format), used by every school
schools/eka/      EKA's course (ekai): docs, school skills, config
plans/            platform plans, one file per initiative (board: plans/README.md)
worklog/          monthly journal
```

Rules: student work and secrets never go in git; dependencies are pinned; a
school's deploy is pinned to a tag. See `CLAUDE.md`.

History: [visualia_original](https://github.com/visualia/visualia_original) and
[visualia_history](https://github.com/visualia/visualia_history) (2020–2022),
[visualia_canvas](https://github.com/visualia/visualia_canvas) (June 2026).
