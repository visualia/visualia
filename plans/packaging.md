# Packaging — what's engine, what's a feature package, what's an app

Sketch, 2026-06-13. The board app has grown reusable behaviour — croppable
media, website capture, local-file import, the agent verbs — that eka-sitemap
(and the apps coming after it) want too. Time to draw the package/app lines
before the board app becomes a junk drawer.

## The principle

Three tiers, mirroring the seams the engine already has (`Tool`, `NodeKind`,
`Layout`):

- **engine** (`@visualia/engine`) — the framework-free **substrate**: board,
  camera, store, history, input/tools, GL + DOM content layers, renderer, the
  kind/content/layout interfaces, the builtin **text/frame/video** kinds, the
  layout strategies, snap, interaction caps. *No app policy, no opinion on which
  kinds exist or where a node lands beyond the seam.*
- **feature / kind packages** — reusable behaviours a *subset* of apps want,
  composed in like `tools: [...]` / `kinds: [...]`. Peers of the existing
  `@visualia/three` and `@visualia/shadcn`.
- **apps** — the specific **composition** (which kinds, the palette, board
  policy) **plus their own UI**.

**Rule of thumb: package at the second consumer.** eka-sitemap exists and more
are coming, so the genuinely cross-app pieces qualify now. App-specific UI (the
command menu) does not. Don't over-package — a one-app abstraction is a liability.

## Inventory — `apps/board/src` today

| file | verdict |
|---|---|
| `app.ts`, `main.ts`, `node-types.ts` | **app** — the composition + boot |
| `ui/*` (command-menu, banner, styles) | **app** — board-specific UI |
| `croppable.ts`, `image-kind.ts` | **package** — croppable media |
| `website-kind.ts` + `vite-capture.ts` | **package** — website capture (heavy Playwright dep) |
| `idb-store.ts`, `import.ts` + `vite-import.ts` | **package** — local-file import |
| agent verbs in `app.ts` (`snapshot/insert/patch/delete/zoom/layout/view`) | **package** — the *generic* ones; kind-specific (`capture/crop/import`) ride with their feature |

Already packaged: `@visualia/engine`, `@visualia/mcp` (bridge/relay/server),
`@visualia/three`, `@visualia/shadcn`.

## Proposed boundaries

- **`@visualia/engine`** — unchanged core (it already absorbed the layout seam
  and the `resizeConstrain` crop hook this session).
- **`@visualia/media`** — croppable **image** kind + `croppable.ts` crop geometry
  + `idb-store` (local-bytes) + **drop import** (client) + the `/import` sidecar
  as `@visualia/media/vite` (fs, light). The general "media nodes + crop + local
  bytes" package. (Open: move `video` here from engine, or leave it.)
- **`@visualia/capture`** — the **website** kind + paste-to-capture handler + the
  `/capture` sidecar as `@visualia/capture/vite`. **Isolated because of the
  Playwright dep** — apps that don't capture websites shouldn't pull a browser.
  Depends on `@visualia/media` (a capture renders through the same canvas window).
- **`@visualia/mcp`** — gains a generic **`boardVerbs(board)`** that implements
  `snapshot/insert/patch/delete/zoom/layout/view` straight from the engine
  `Board`, so **any** app becomes agent-drivable for free. Feature packages export
  their own verb mixins (`captureVerbs`, `importVerbs`) to compose in — the app
  just spreads them into `connectAgentBridge`.
- **`apps/board`** — thin composition (choose kinds, wire the sidecar plugins,
  build the palette) + the command-menu UI + board policy.
- **`apps/eka-sitemap`** — composition (its `page-kind` + the layout strategies);
  picks up agent-drivability via `boardVerbs` for free.

## The vite-plugin pattern is already set

Sidecars ship as **subpath exports**: `@visualia/engine/vite → mediaProxy`
exists. Follow it — `@visualia/capture/vite → captureServer`,
`@visualia/media/vite → importServer`. An app's `vite.config` just lists the
plugins for the features it uses; the Playwright dep travels with
`@visualia/capture` only.

## Migration order (low-risk first, verify each)

1. **`@visualia/media`** — move `croppable.ts` / `image-kind.ts` / `idb-store` /
   `import.ts` + the import sidecar. Pure move; board re-imports. Verify board.
2. **`@visualia/mcp` `boardVerbs(board)`** — extract the generic agent verbs;
   board keeps only its kind-specific ones; eka adopts `boardVerbs`.
3. **`@visualia/capture`** — move `website-kind` + `vite-capture` (Playwright
   isolation), with `captureVerbs`.
4. **Trim `apps/board`** to composition + UI.

Low risk: these are moves, not rewrites — the seams (`kinds`, `tools`, `layouts`,
the vite-plugin subpath, the `AgentVerbs` interface) already exist, so each piece
slots into a port that's already there.

## Open questions

- **Granularity**: one `@visualia/media` (image + crop + idb + import) vs
  splitting import out. Lean: one media package; **capture separate** for the
  heavy dep. Revisit if media itself bloats.
- **Where does `video` live** — engine ships text/frame only and media owns
  image/video? Or engine keeps the simple media kinds and `media` adds *croppable*
  on top? (The croppable image already replaced engine's plain one.)
- **`view` (canvas raster, [seeing.md](seeing.md))** reads node content canvases —
  it's engine-aware, so the generic `boardVerbs` (and thus `@visualia/mcp`)
  depend on `@visualia/engine`. Fine — mcp already does.
- **Verb-mixin contract**: how feature packages contribute MCP verbs without the
  app hand-wiring each (a registry, or just object-spread of mixins).
- **Restraint**: hold each extraction until its second consumer is real. eka +
  "more coming" justifies media/capture/boardVerbs; it does **not** yet justify
  packaging the palette, the command menu, or board policy.

Cross-links: [layout](layout.md), [seeing](seeing.md), [images](images.md),
[document](document.md), [import](import.md), [mcp](mcp.md).
