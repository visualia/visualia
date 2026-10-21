---
status: next
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
  the way.
