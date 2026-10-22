---
status: building
---

# Studio core

The smallest studio a student can use: describe a page, watch it being written
and rendered live, change it by asking, publish it to a URL. One person per
project, no rooms yet. Everything later (rooms, shared brief, mob mode, Clef,
budgets, board) builds on this.

## What a student does

1. Opens the studio, signs in with their course key (proper login later).
2. Creates a project: a name and a first brief ("a slowly rotating colourful
   spiral that follows the mouse").
3. Watches the page appear: the preview renders while the model is still
   writing (DeepSeek V4.1 Flash, ~8 s per page in first-pages run 3).
4. Asks for changes in plain words ("bigger", "make it red", "add a title").
   Each answer replaces the page; every version is kept.
5. Publishes: the current version gets a stable public URL.
6. Sees their projects in a list.

## Shape

```
visualia.space  (one Worker, static pages on visualia.css)
  ├─ GET /                      project list
  ├─ GET /p/:project            project view: conversation + live preview
  ├─ /agents/studio-agent/:id   WebSocket to the project's agent
  └─ POST /publish/:project     copy current version to R2
StudioAgent extends Think       one Durable Object per project
  getModel()       → gateway via a service binding, with the person attached
  configureContext → schools/eka/instructions.md (always on)
  workspace        → public/index.html, every version kept
  onChatResponse   → extract the HTML, store a version
D1 (shared with gateway): projects, versions
R2: projects/<id>/<version>/index.html
Published pages: projects.visualia.space/<student>/<slug>/, served from R2 with
`Content-Security-Policy: sandbox allow-scripts` (an opaque origin: no cookies,
no storage, nothing to reach the studio with)
```

**Model calls go through the gateway, always.** The studio calls the gateway
through a Cloudflare service binding with the student's identity, so every turn
lands in `usage` with the right person, and the gateway's routing and (later)
budgets apply. The studio holds no model keys.

**Live preview without a sandbox.** The browser receives the answer as it
streams, takes everything after the opening ```html, and renders it into a
sandboxed `iframe srcdoc` (no same-origin, scripts allowed), throttled to a few
renders a second. When the answer ends, the final HTML becomes a version.

## Packages

`@cloudflare/think` 0.21.0 and `agents` 0.29.0, pinned (Think is experimental;
no upgrades during a school's sessions, see CLAUDE.md). Model via the AI SDK's
OpenAI-compatible provider with a custom `fetch` that goes through the service
binding.

## Done when

- A student key opens the studio; a wrong key doesn't.
- A new project's first page starts rendering within a few seconds and is
  complete in about 10.
- A follow-up request changes the page; earlier versions stay reachable.
- Publish gives a URL on `projects.visualia.space` that works logged out and is
  served sandboxed (check: `document.cookie` throws, `localStorage` throws).
- Every turn shows up in `usage` with the student and project.
- Works on a phone (conversation above, preview below).

## Not in it

Rooms and collective features, Clef routing, budgets, skills beyond the
instructions, verify checks, the board, proper login, Estonian UI. Each is its
own plan on top of this.

## Decided (2026-10-21)

- **Studio at `visualia.space`** for now; it moves to `eka.visualia.space` when
  more schools join.
- **Student pages at `projects.visualia.space/<student>/<slug>/`**, not a path on
  `visualia.space`: a path would be the studio's own origin, so a student's
  script could read its cookies and storage. The subdomain is a different
  origin; on top, pages are served with a CSP sandbox (opaque origin), the
  studio's session cookie is `__Host-` (subdomains can't overwrite it), and the
  studio checks `Origin` on every write. `visualia.page` stays an option for
  later.
- **Think first**; fall back to a plain streamed call per turn if it gets in
  the way. **It did:** Think 0.21 requires the AI SDK v7, `@cloudflare/computer`
  and a React-oriented chat protocol on the client. The core uses the plain
  `agents` SDK `Agent` (one Durable Object per project), our own streaming
  (proven in the eval) and a native browser WebSocket: no bundler, no React.
  Think stays an option for a multi-file advanced mode.

## Built (2026-10-21)

- `apps/studio`: Worker at `visualia.space` and `projects.visualia.space`.
  Sign in with a course key (signed `__Host-` cookie); Origin checked on every
  write; `onBeforeConnect` checks the person owns the project before any
  WebSocket opens.
- `StudioAgent`: one per project; runs requests one at a time through the
  gateway's `Trusted` entrypoint (service binding, person and project attached,
  so every turn lands in `usage`), streams deltas to the browser, stores each
  page as a version in R2 (`projects/<id>/<n>.html`).
- Pages: sign in, project list, project view (requests and versions on one
  side, live sandboxed preview on the other; stacked on phones). Publish serves
  the chosen version at `projects.visualia.space/<person>/<slug>/` with a CSP
  sandbox.
- Gateway: `Trusted` entrypoint; `usage.project_id`; D1 `projects` table.


## Match score fixed (2026-10-22)

- **What:** "matches the request %" after each version (HANDOFF open 0).
- **Cause:** there was no bug in the check. Of the two tests on 2026-10-21, the
  first (18:51:30) ran 22 s after the deploy (18:51:08) and its new Durable
  Object still got the previous version, which had no `check()`: no decide row.
  The second (18:54) worked: decide row 71 (M1, 2.7 s), `fit: 0.898` stored in
  the agent's state; the test script didn't print the message. The deployed
  copies of both versions (Workers versions API) confirm it. After a deploy,
  wait ~30 s before testing.
- **Changed:** `check()` reports `check-failed` with the reason (scripts see it,
  students don't); the gateway's M1 decide timeout is 8 s instead of 20; Clef-flash
  is priced in `prices.js` ($0.038 per M input tokens; its rows had no cost before).
- **M1 fallback, measured** (`wrangler dev --remote` with `M1_URL` pointed
  elsewhere): M1 host gone → cloud answer in 1.1 s; M1 hanging → 3.0 s (the 2 s
  `/v1/loaded` cap, then the cloud). M1 up: 2.3–5.3 s, cloud alone 0.5–0.8 s.

## The checker sees the page (2026-10-22)

- **What:** after each version the agent takes a screenshot and Clef-flash
  judges it with the HTML. Workers AI's Clef-flash takes `images` (up to 4
  data URLs, checked in the model schema), so no second vision model is needed.
  The M1's Clef (llama.cpp, no vision encoder) is skipped when there's a picture.
- **How:** Browser Rendering (`browser` binding, `@cloudflare/puppeteer`
  1.4.0) in the agent: `setContent` with the version's HTML (pictures inlined),
  375 x 812 at 2x, `load` (10 s cap) + 1.5 s for scripts and canvas. A phone,
  because the instructions are phone first and the narrow screen is where
  pages break. Stored at `projects/<id>/<n>.png` for thumbnails. A second,
  `choice` question picks what's most off from seven one-sentence reasons
  (Clef answers typed choices, not prose); the sentence is kept in the turn as
  `off`, not shown, for "Fix it" later. Students see only the score line.
- **Measured** (3 runs): screenshot 3.1–3.9 s, whole check 5.3–6.1 s after the
  page is done; Clef with the picture 1,600–2,300 input tokens, 0.9–2.1 s,
  $0.00006–0.00009. Browser time ~3.5 s a check: inside the 10 free hours a
  month (~10,000 checks), $0.0001 a check beyond them. Scores run a little
  lower than HTML-only (red circle: 74% seen vs ~90% from HTML).

## Pictures in pages (2026-10-22)

- **What:** a page can ask for pictures; the studio draws them in the cloud.
- **How:** gateway `POST /v1/images` `{ prompt, size }` → `{ data: [{ b64_json }] }`,
  public (course key) and through `Trusted`; FLUX.2 klein 4B
  (`@cf/black-forest-labs/flux-2-klein-4b`, in the catalogue). It goes to Workers
  AI directly, not through AI Gateway (AI Gateway refuses the streamed form and
  drops the fields of a buffered one); the usage row is written as for chat,
  neurons counted from the price list (26.05 per output 512² tile). The page
  model writes `<img data-generate="…" data-size="768x1024">` (instructions,
  "Pictures" section); the agent draws up to 3 in parallel, stores them as
  `projects/<id>/<n>-<k>.jpg` (klein answers in JPEG, so `.jpg`, not `.png`),
  and sets `src="<n>-<k>.jpg"`. The studio serves them at
  `/api/projects/<id>/files/<name>` (signed in, owner only); the preview
  inlines them as data URLs (a sandboxed iframe has no cookie); the published
  page loads them relatively from `projects.visualia.space/<person>/<slug>/`.
  CSP sandbox unchanged.
- **Measured:** 10–11 s and 104 neurons ($0.0011) per picture at 768x1024 or
  1024². "Plakat: Kevadnäitus 2027, foto udusest rabast": page done in 22.7 s
  (picture 11.2 s of it), 77%; a follow-up change kept `1-1.jpg` and drew
  nothing new. Checked by eye in a local Playwright render of the preview and
  the published page.

## Words in text.json (2026-10-22)

Every word the studio's pages show is in `apps/studio/public/text.json` (111
keys): the sign-in page, the home page (chat, everyone's work, private
projects), the project page, the usage page, and the wall's own words
(`packages/board/src` takes a `t` option, default: the key itself, so its Node
tests need no text). The shared helper `packages/text/text.js` finds
`text.json` next to itself, so `/p/<id>` pages load `/text.json`; the studio
serves `.json` before the sign-in check like the stylesheet. The build runs
`packages/text/check-text.mjs` over the pages and the board code.

**Follow-up: texts still in server code** (shown to people as they are):
- `agent.js`: "Project not found.", "The answer had no page in it. Try again.",
  "Nothing was changed. Try saying it another way.", and raw error messages
  passed through (`String(err)`).
- `index.js` API errors the pages show in their status line: "Only the owner can
  change this.", "Nothing to remix yet.", "Only the owner can publish.",
  "nothing to publish yet", "a title is needed", "not found", "sign in first".
- The preview's error reporter writes "Could not load …" inside the student's
  page; it also goes to the model as a problem, so it stays English in code.
To move them: send a key (and slots) instead of the sentence, and let the page
call `t()`.
