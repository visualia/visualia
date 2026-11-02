# Canvas agents: how agents see a canvas, and design sense

What other tools do when an agent works on a canvas (Claude, Figma, tldraw), what
the research says about seeing and editing one, and how much design sense
models have. Background for `plans/board-sight.md`.

Gathered 2026-10-24 to 2026-11-02 in a claude.ai chat and brought in with the
handoff of 2026-11-02. Prices, benchmarks and release claims are as published
by their makers unless marked otherwise and were not checked here; check them
before relying on them.

## The landscape in October 2026

### Claude: artifact types

- **Claude Dashboards** (beta, paid plans) and **Claude Motion** (beta, Team
  and Enterprise) launched 8 October 2026. Dashboards turn connected data into
  live dashboards; Motion turns reports and charts into short animations
  written as code and exported as MP4.
- Docs, Slides and Design left beta on every plan, Free included.
- The standalone Claude Design site (claude.ai/design) closes 14 December
  2026; conversations and comments there are not migrated.
- Enterprise: Dashboards and Motion off until an owner enables them
  (Organization settings > Artifacts); Docs, Slides and Design on by default
  from 15 October.

### Figma: agents on the canvas

- **March 2026:** the canvas opened to outside agents through Figma's MCP
  server and the `use_figma` tool (Claude Code, Codex, Cursor and others can
  write to files). **Skills** (markdown instructions) shape how agents work;
  agents can screenshot their output and fix what doesn't match.
- **May 2026:** a built-in Figma design agent on the canvas and in the left
  rail, fine-tuned for editing Figma files, with design-system context
  (components, tokens). Prompts start from any layer, run in parallel, and
  are steered with @-mentions of tokens, variables and components. Bulk edits,
  design-system documentation, feedback summaries.
- Figma's split: the agent for canvas work; MCP + `use_figma` for moving
  between code and canvas.
- Availability: Full seats on Professional, Organization, Enterprise.
  **Starter, Education and Government plans are excluded**, which matters for
  students on education licences.

### tldraw: how an agent sees the canvas

- Context sent to the model: a screenshot of the viewport, simplified shape
  records (text, type, position, bounds), shapes outside the viewport, the
  selection and recent actions, and the conversation. The image gives layout;
  the records give exact values.
- The model acts through **typed canvas actions**, which the Agent starter kit
  validates and cleans (duplicate ids, missing shapes, bad coordinates).
- Agent modes: planning (read only), working (edit), review (critique, most
  editing tools removed).
- **Fairies** (December 2025): visible, multiple agents on the canvas.
- **"Agents can't point"** (August 2026): agents are bad at deictics ("this",
  "here"). Notes and shapes from agents are anonymous and clutter the board;
  **comments** (`@tldraw/commenting`, SDK 5.3) are separate records pinned
  into the canvas, threaded, attributable and resolvable, and work well for
  coordinating several agents.
- **tldraw Offline:** local `.tldraw` files with embedded scripts; installs
  agent skills for Claude Code, Codex and Cursor.
- **Licence:** the SDK is source-available; production needs a trial,
  commercial or hobby key.

Sources:
- https://www.claude.com/resources/articles/dashboards-and-motion
- https://www.figma.com/blog/the-figma-canvas-is-now-open-to-agents/
- https://www.figma.com/blog/the-figma-agent-is-here/
- https://tldraw.dev/docs/ai
- https://tldraw.dev/starter-kits/agent
- https://tldraw.dev/blog/agents-cant-point
- https://flaviocopes.com/tldraw/

## How agents see and operate a canvas

The research and the tools agree: **pixels for the gist, structure for
precision, code for checking.**

1. **Give the agent both views, structure first.** Rasterised views lose the
   object and style structure that precise editing needs (PPTArena). Layout
   reasoning works over a structured text description of the canvas (LaySPA).
   Decoupling perception from reasoning, with geometric query tools over an
   explicit scene graph, helps spatial reasoning (RieMind).
2. **Set-of-Marks.** Draw an id on every element in the screenshot; the model
   refers to ids, not coordinates (VisualWebArena). Render a symbolic
   hypothesis back onto the pixels to verify it before acting (Probe to Act):
   on a canvas, highlight the shapes the agent means to change, screenshot,
   confirm, then edit.
3. **Close the loop.** Render, critique, fix (ReLook; tldraw-skill's
   two-round self-check). Self-verification is limited by the output type, not
   the model: DOM and text close the loop, a 3D mesh from one screenshot does
   not.
4. **Pointing.** Comments, selection and cursors as the deixis layer.

### For a DOM/WebGL canvas

- **Observation API:** `view()` (low-res screenshot with id labels),
  `records(viewport)` (rounded coordinates), query tools (`overlaps`,
  `neighbors`, `find`).
- **WebGL:** render an offscreen picking buffer where each object's colour
  encodes its id; that gives Set-of-Marks labels and hit-testing for free.
- **Semantic actions** ("place below X", "align", "connect"); a constraint
  solver computes coordinates. Never let the model compute pixels.
- **Verification:** lint in code (overlap, clipping, off-canvas); the vision
  model only for aesthetic critique. Crop and zoom rather than sending full
  screenshots (cost).

### Backend on Cloudflare

- One **Durable Object per board** holds the authoritative record store
  (shapes, bindings, comments, presence) and broadcasts over WebSockets.
- **Agents SDK:** state sync, `@callable` RPC over WebSocket, broadcast,
  scheduling, durable fibers, `McpAgent` for an MCP server, human-in-the-loop
  approval.
- Agents are peers: cursor, presence, name; they talk through comments.
- Per-actor undo, so an agent's changes can be reverted alone.

Sources:
- https://arxiv.org/pdf/2512.03042 (PPTArena)
- https://arxiv.org/html/2602.13912v2 (LaySPA)
- https://arxiv.org/pdf/2603.15386 (RieMind)
- https://arxiv.org/html/2401.13649v2 (VisualWebArena)
- https://arxiv.org/pdf/2609.33646 (Probe to Act)
- https://arxiv.org/pdf/2510.11498 (ReLook)
- https://github.com/Agents365-ai/tldraw-skill
- https://www.digitalapplied.com/blog/agent-self-verification-limits-by-output-modality-2026
- https://www.claudepluginhub.com/skills/cloudflare-cloudflare/agents-sdk

## Design sense: gestalt, composition, typography

### What the benchmarks show

- **AesEval-Bench (ICLR 2026):** 12 indicators in four dimensions:
  typography (legibility, hierarchy), layout (balance, layering, whitespace,
  alignment), colour (harmony, contrast, appeal, psychology), graphics
  (quality, relevance). Existing VLMs, including reasoning models, perform
  poorly at design aesthetics.
- **GraphicDesignBench (GDB):** frontier models "mostly solved" 2 of 49
  tasks. Spatial reasoning over complex layouts, vector generation,
  fine-grained typographic perception and animation remain largely unsolved.
- **PosterIQ:** models struggle with complex spatial relations and whitespace.

### What works: design knowledge in code

1. **Tokens as hard constraints:** a modular type scale, a spacing scale and a
   grid. The agent picks from tokens, never free pixel values.
2. **Computable metrics:** balance, uniformity, whitespace fraction and
   free-flow, alignment, regularity (decades of document-layout research).
   Balance compares the centre of visual weight with the page's visual
   centre. Combine non-linearly so one bad metric dominates. Type-aware and
   relation-aware alignment.
3. **Gestalt as data** (Wattenberger): proximity → groups, similarity →
   roles, reading order. Check that visual weight order matches semantic
   importance.
4. **A solver places elements:** aesthetic measures in an optimisation
   objective; the LLM supplies intent, the solver the coordinates.
5. **VLM as region-grounded critic only:** abstract indicators tied to
   specific bounding boxes; code verifies what it can.
6. **Typography lint:** measure 45–75 characters, leading relative to size,
   at most two families and three or four sizes, WCAG contrast, optical
   alignment, widows and orphans.
7. **Taste stays human:** variants and sliders (density, contrast, tension).

Pipeline: intent (LLM) → tokens and constraints → solver → metrics and lint →
VLM critique on regions → human nudges → decisions back into tokens.

Sources:
- https://arxiv.org/html/2603.01083v1 (AesEval-Bench)
- https://arxiv.org/html/2604.04192 (GraphicDesignBench)
- https://github.com/lica-world/GDB
- https://arxiv.org/html/2603.24078 (PosterIQ)
- https://arxiv.org/pdf/2509.07473 (SheetDesigner metrics)
