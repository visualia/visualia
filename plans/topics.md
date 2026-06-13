# Topics — the ideas behind the board

A concept-organized synthesis of *why* visualia is worth building and *what
shape* it should take, distilled from the curated [links](links.md) and deep
research into their sources. Not a link dump (that's [links.md](links.md)) and
not a chronology (that's [lineage.md](lineage.md)) — this is the argument.

The spine, in one line: **the computer is a medium for thought, not a document
viewer; thinking is spatial and built-by-making; so an infinite canvas of
live, manipulable nodes is the right substrate for explorable learning — if it
stays a playground, not a slideshow.**

The topics move from *why* (medium & cognition) → *form* (explorables) →
*pedagogy* (learning) → *how* (the spatial-UI design that follows). Each ends
with what it implies for the build.

---

## 1. The dynamic medium / tools for thought — the WHY

A ~65-year argument that the computer's real purpose is to be a new **medium
for cognition**, not a faster filing cabinet:

- **Engelbart** — intelligence isn't in the lone brain but in the *Human +
  tools* system; you augment thought by improving the external symbol-tools
  people think *through*, and the gains compound (better tools → better
  structuring → better tools). Visualia is an artifact in that loop, measured
  by what human+board can think that the human alone can't.
- **Kay** — the computer is a **metamedium**: it can *become* any medium, and
  unlike paper it is **active** (it answers back) and **manipulable** (you can
  drive the model, not just receive it). It should serve all three of Bruner's
  modes — enactive (doing), iconic (seeing), symbolic (notation) — where paper
  privileges only the symbolic.
- **Victor** — *representations are the bottleneck on thought*: a bad
  representation makes certain thoughts impossible. Media should let you **see
  all the state at once, reach in and change it, and read one system through
  several linked views.**
- **Matuschak & Nielsen** — reject **transmissionism** (the false idea that
  knowledge copies from page to reader). Understanding is *constructed*; books
  silently dump the metacognition onto the reader. Aim for *media* (expansive
  contexts for new thought), built via the **insight-through-making loop**.

**→ build:** The sharpest design test for every feature: *does it talk back?* A
node that only **displays** betrays the whole tradition; a node that **runs,
responds, and can be reached into** fulfills it. Favor **linked/coordinated
views** of one idea (text + diagram + running model, side by side). The
agent/MCP layer is Engelbart's "computer clerk" — and well-placed to *be* the
embedded feedback loop that cures transmissionism. Build the engine via the
insight-through-making loop: make real explorables on real material, let them
reshape the engine.

*Sources: [Engelbart 1962](https://www.dougengelbart.org/pubs/augment-3906.html)
· [Kay & Goldberg 1977](https://www.newmediareader.com/book_samples/nmr-26-kay.pdf)
· [Victor — Media for Thinking the Unthinkable](https://worrydream.com/MediaForThinkingTheUnthinkable)
· [Matuschak — Why books don't work](https://andymatuschak.org/books)
· [Matuschak & Nielsen — TTFT](https://numinous.productions/ttft)
· [Nielsen — Thought as a Technology](https://cognitivemedium.com/tat/index.html)*

---

## 2. Explorable explanations — the FORM

The genre that operationalizes the dynamic medium: interactive, hands-on
explanations where you understand a system by *manipulating it and watching it
respond*.

- **Victor's grammar** — *reactive documents* (change the author's assumptions,
  see consequences live), *explorable examples* (interactive figures with
  linked representations), *contextual information*. Text becomes "an
  environment to think in."
- **Show, don't tell** — the unit of explanation is a **runnable model**, not a
  paragraph. *Parable of the Polygons* doesn't assert that small biases cause
  segregation — it lets you run it and watch.
- **Nicky Case's teaching arc** — start from a question the reader *cares*
  about → climb the ladder of abstraction (teach each mechanic in isolation,
  combine via causal "but…" steps) → end in an **open sandbox** where learners
  pose their own questions. "Don't dumb the ideas down — smart the people up."
- **The gimmick test** — interactivity earns its place *only* when manipulating
  it reveals a model or lets a claim be tested. Motion that teaches nothing is
  decoration.

**→ build:** A board's node is a *model you poke*, and **edges are the reactive
dependency graph** that makes "change an input, the rest responds" legible — the
connectors backlog is what unlocks true reactive explorables. Stage Case's arc
*spatially*: concrete demo → abstracted/combined model → free-explore region,
walked by the existing **presentation fly-to**. Hold every node type to the
gimmick test: "reactive" must mean *reveals structure*, never *wiggles*.

*Sources: [Victor — Explorable Explanations](https://worrydream.com/ExplorableExplanations/)
· [explorabl.es](https://explorabl.es/) · [Case — How I make explorables](https://blog.ncase.me/how-i-make-an-explorable-explanation/)
· [Distill](https://distill.pub/) · [The Pudding](https://pudding.cool/about/)*

---

## 3. Constructionism & playful learning — the PEDAGOGY

If the board is for *learning*, the learning theory matters — and it all
refines one inversion: **you learn by making, not by being told.**

- **Constructionism (Papert)** — learning is strongest when building a *public
  entity* (a sand castle or a theory). The **object-to-think-with** (the LOGO
  turtle) makes an abstract idea tangible and personal. "Mathland": you'd learn
  math best if you could *live inside it*.
- **Low floor, wide walls, high ceiling (Papert/Resnick)** — trivially easy to
  start, *many different* paths in, no cap on sophistication. The **wide walls**
  are the argument for **multi-modal nodes**: math, code, drawing, image,
  video, geometry all first-class on one surface = many doors in.
- **The four Ps & playground-not-playpen (Resnick)** — Projects, Passion,
  Peers, Play, on the *imagine→create→play→share→reflect* spiral. A **playpen**
  permits one scripted path; a **playground** lets you set your own goals. Most
  edtech is a dressed-up playpen — the single biggest risk to guard against.
- **Feedback timing (Desmos)** — *immediate* right/wrong feedback invites
  mindless trial-and-error; a short **productive delay** forces reasoning and
  metacognition. Distinguish *dynamical* feedback (drag slider → watch curve;
  keep instant — it's the superpower) from *evaluative* feedback on a learner's
  prediction (insert a pause: **predict, then reveal**).
- **Hand-crafted vs machine-made (Brilliant)** — humans own the 90% (the
  pedagogical sequence, the "feel," the aha); the machine does the 10%
  (variation, layout, asset wiring) under review.

**→ build:** Onboard with a **low floor** — blank canvas + one obvious gesture
that puts *something on screen in 10 seconds*. **Wide walls** = the multi-modal
node library is a pedagogical necessity, not a feature list. **Make-and-share-
and-remix** is core architecture (Papert's public entity + Resnick's peers), not
a share button. Keep the canvas a **playground**: no forced win-state, user-set
goals — litmus test for any feature: *does it open the space of things to make,
or narrow onto one rail?* For the agent: **hand-craft the node types and exemplar
boards; let the agent scale the variation** — never let it invent pedagogy.

*Sources: [Papert — Mindstorms](https://www.media.mit.edu/publications/mindstorms/)
· [Resnick — Lifelong Kindergarten](https://mitpress.mit.edu/9780262536134/lifelong-kindergarten/)
· [Khan — Playful worlds of creative math](https://early.khanacademy.org/early-math)
· [Meyer/Desmos — Suspicious of immediate feedback](https://blog.mrmeyer.com/2017/desmos-design-why-were-suspicious-of-immediate-feedback)
· [Brilliant — Hand-crafted, machine-made](https://blog.brilliant.org/hand-crafted-machine-made)*

---

## 4. Embodied & spatial cognition — the GROUND

Why a *spatial* canvas (not a doc) is the right substrate at all:

- **Space is the foundation of thought (Tversky)** — spatial cognition is
  bedrock; language and abstraction are built *on top* of it. "Spatial
  thinking… is the foundation of thought." Abstract reasoning borrows the
  machinery of physical space.
- **"No mental images, only mental spaces"** — we don't hold pictures in our
  heads, we hold *spatial relations*; when the mind overflows we push them out
  as diagrams and sketches. A board **is** an external mental space — it holds
  the structure you can't hold in working memory.
- **Gesture and manipulation *are* thinking** — block people from gesturing and
  their reasoning "collapses into fumbling incoherence." Moving things is not
  packaging finished thought; it generates it. We "sort ideas into piles, stack
  them, take them apart."
- **Spatial schemas are free comprehension** — proximity = similarity,
  enclosure = category, arrows = causation, vertical = hierarchy/abstraction,
  left-right = time. These read effortlessly because abstract thought runs on
  them.

**→ build:** Position, distance, and grouping **are semantics**, not
decoration — make rearrangement cheap and lossless, because *rearranging is
re-thinking*. Map gestures onto conceptual operations (group = "belong
together," distance = "unrelated," sequence = "this then that"). Lean on the
spatial schemas users already read: containment for grouping, arrows for flow,
a vertical "ladder of abstraction" axis as a literal layout primitive. Shared
boards inherit Tversky's "it becomes *our* product."

*Sources: [Tversky — Mind in Motion](https://www.goodreads.com/book/show/42118411-mind-in-motion)
· [Tversky — Visualizing Thought](https://onlinelibrary.wiley.com/doi/10.1111/j.1756-8765.2010.01113.x)*

---

## 5. The infinite canvas & spatial UI — the SURFACE

The canvas's superpower (spatial freedom) is also its curse (it degrades into a
junk drawer). The good ones offload organization from the human to the canvas.

- **Anti-junk-drawer** — collision/overlap avoidance on drop; magnetic
  grouping; **semantic zoom** so far-out views stay legible (title-only at
  distance, full content up close).
- **Frames as triple-duty** — a frame is at once a visual group, a Gestalt
  proximity-group for structure extraction, and a presentation stop. Lean into
  that.
- **Gestalt → structured data** — proximity = grouping, order = sequence,
  color/type = category; an agent reading the board should infer structure the
  way a human eye does (the reading-order `orderedFrames()` is a first slice).
- **Comparison-by-juxtaposition is the unfair advantage** — an infinite canvas
  can place two live models side by side; no single linear explorable can. Make
  duplicate-and-vary-one-input a one-gesture move.

**→ build:** Semantic zoom and frames-as-groups are the navigation-layer
defense against mess; juxtaposition is the feature to make trivial. The four
pillars (expansiveness, zoom, direct manipulation, collaboration) are a
checklist — collaboration/multiplayer is the notable gap vs. the category
leaders.

*Sources: [Wattenberger — Evolving the infinite canvas](https://wattenberger.com/thoughts/evolving-the-infinite-canvas)
· [infinitecanvas.tools](https://infinitecanvas.tools/) · [tldraw](https://tldraw.dev/)
· [Observable Canvases](https://observablehq.com/platform/canvases)*

---

## 6. Manual + automatic structure, and the temporary lens — LAYOUT

The deepest interaction question: how manual freedom and parametric automation
coexist. (Full design in [layout.md](layout.md).)

- **Squish vs structure / hard vs soft (Appleton, Wattenberger)** — manual
  placement is the *sacred default*; automation is an **offered service**, never
  enforced. Generate *into* stable primitives (a spine of rigid vertebrae + soft
  discs) — the agent fills typed nodes, never silently reflows your structure.
- **Tidy as a temporary, reversible action** — auto-arrange on demand, and let
  it be *undoable* so spatial memory survives.
- **The fisheye / Degree-of-Interest lens** — `DOI(node) = importance −
  distance(focus)` shows focus *and* context at once: magnify and re-space one
  region while compressing (not hiding) the rest, then animate back. A
  **temporary, non-destructive** transform layer over canonical positions — the
  same render-time-resolution trick as the media proxy, applied to position.
- **Parametric multi-view** — the same nodes as canvas / grid / timeline /
  scatterplot, picked as a lens preview or committed.

**→ build:** The lens (fisheye/DOI) is the **unifying primitive** — one
`importance − distance` score drives temporary rearrangement, semantic-LOD, and
landmark preservation. Build it once; it powers focus mode, presentation
node-explode, compare, and arrange-by-X previews.

*Sources: [Appleton — Squish meets structure](https://maggieappleton.com/squish-structure)
· [Wattenberger — Hard and soft](https://wattenberger.com/thoughts/hard-and-soft)
· [Wattenberger — Fish Eye](https://wattenberger.com/thoughts/fish-eye)
· Furnas 1986 (DOI)*

---

## 7. Ladder of abstraction & semantic zoom — NAVIGATING ABSTRACTION

- **The insight is in the transitions (Victor)** — power comes from *moving
  between* concrete instances and general parameters; so animate the
  level-changes. Abstract over time (draw the whole trajectory, not the
  instant); abstract over parameters (small multiples).
- **Semantic zoom changes the *encoding*, not just the size (Susie Lu)** —
  zoomed out, a card becomes a sparkline → KPI → dot; a frame of 200 cards
  becomes one aggregate chart. Keep high-importance nodes legible as
  **landmarks** to bridge levels; cross-fade with hysteresis.

**→ build:** Add an explicit semantic **altitude** axis beyond scale: cards ↔
overlaid trace ↔ summary tile, animated with the Van Wijk easing. Extend the
existing zoom-LOD so crossing a threshold swaps the *renderer*, keeping
landmarks.

*Sources: [Victor — Ladder of Abstraction](https://worrydream.com/LadderOfAbstraction/)
· [Susie Lu — Abstractions](https://www.susielu.com/data-viz/abstractions)*

---

## 8. AI as a spatial, provisional collaborator — THE AGENT

Not a chatbot bolted on the side. (Build seam in [mcp.md](mcp.md).)

- **Output is spatial, not a chat pane** — the agent's answer is an
  *arrangement* of durable cards near their context; the whole canvas is shared
  context. Bias toward `board_insert` of result nodes over text replies.
- **Small sharp verbs, not one Magic button** — a menu of named, scoped
  transforms (summarize, cluster, find contradictions, variant, critique),
  context-sensitive to node type.
- **Watch-it-work + provisional** — camera *follows* the agent (reuse fly-to);
  touched nodes highlight; new nodes land in a predictable staging zone; output
  is additive and provisional (ghost cards you accept or let fade), never a
  silent rewrite; same undo stack; a distinct visual signature + provenance.
- **The graph thesis** — "every creative tool is becoming a node canvas."
  Connected nodes are a runnable dependency graph; keep the logic *visible*
  ("the code is the diagram").

**→ build:** The agent's mutations already go through `history.push`; add
staging-zone placement, a follow-cam, and an agent-node badge. Pair with the
constructionism lesson: **the agent scales the variation (10%); humans craft the
pedagogy (90%).**

*Sources: [Cove](https://cove.ai/blog/introducing-cove) · [tldraw computer](https://computer.tldraw.com/)
· [Shape of AI](https://www.shapeof.ai/) · [Appleton — LM Sketchbook](https://maggieappleton.com/lm-sketchbook)
· [Fuser — The graph will set you free](https://fuser.studio/blog/the-graph-will-set-you-free-why-every)*

---

## 9. Generative art, sacred geometry & creative coding — THE MATERIAL

The project's aesthetic and pedagogical roots: making math, code, and pattern
*tangible and beautiful*.

- **Math made visible** — Byrne's color Euclid (the aesthetic north star),
  immersive linear algebra, eater.net quaternions, Acko.net's live-coded
  graphics essays, domain coloring — abstract structure rendered so you can
  *see and manipulate* it.
- **Sacred geometry** — Islamic patterns (Critchlow), isohedral tilings
  (Tactile/Kaplan), Euclidea's straightedge-and-compass game — rule-based beauty
  that is also rigorous math.
- **Creative coding as a learning medium** — p5.js, Nature of Code, Programming
  Design Systems, Hydra — code as a creative material, not just engineering.

**→ build:** This is the content the multi-modal nodes exist to host, and the
generative-art / sacred-geometry node kinds (spin/mirror/tile patterns over the
geometry-as-data utils) are the lineage's lost components worth rebuilding —
"feel the math," don't read it. Ties to [design-playground.md](design-playground.md).

*Sources: [Byrne's Euclid](https://www.c82.net/euclid/) · [Nature of Code](https://natureofcode.com/)
· [Programming Design Systems](https://programmingdesignsystems.com/) · [Tactile/isohedral](http://isohedral.ca/software/tactile/)
· see [links.md](links.md) "DSLinks picks" for the full canon*

---

## 10. Color, type & design as live material — CRAFT

- **Color as a tunable, taste-laden material** — Khroma/Colormind (AI palettes
  that learn taste), Color Leap (history's palettes), the RYB↔HSL painter's
  wheel, Sinebow. Color is computed *and* curated.
- **Type & design as live specimens** — the design-playground's slider-driven
  specimen is the lineage's oldest idea (2017 kasutajaliidesed) returning as the
  newest sketch.

**→ build:** Direct to [design-playground.md](design-playground.md) — OKLCH
ramps + Google-Fonts filters + the gestalt linter, with the LLM as curator over
a deterministic base, not an oracle.

*Sources: [Khroma](http://khroma.co) · [Color Leap](https://colorleap.app/home)
· [Programming Design Systems — color](https://programmingdesignsystems.com/color/color-models-and-color-spaces/index.html)*

---

## How the topics map to the build

| Topic | Feeds |
|---|---|
| 1 Dynamic medium · 2 Explorables · 4 Embodied cognition | the *thesis* — live, manipulable, spatial nodes; the **connectors** backlog (reactive graph) |
| 3 Playful learning | low-floor onboarding, multi-modal nodes, make-and-share, playground-not-playpen |
| 5 Spatial UI · 6 Layout | [layout.md](layout.md) — the seam + the fisheye/DOI temporary lens |
| 7 Abstraction & zoom | semantic-LOD altitude axis (extends existing zoom-LOD) |
| 8 The agent | [mcp.md](mcp.md) — spatial, provisional, scoped; 90/10 hand-craft/scale |
| 2 Explorables (staging) | [presentation.md](presentation.md) — fly-to walks the curiosity→ladder→sandbox arc |
| 9 Material · 10 Craft | [design-playground.md](design-playground.md), generative/geometry node kinds |

**The whole thing in one sentence:** visualia should be a *Mathland-shaped
playground* — a low-floor, wide-walled canvas of live, manipulable
objects-to-think-with, where people build and share personally meaningful
explorables, an agent scales (not authors) the work, and spatial arrangement is
treated as what it actually is: thinking made visible.

---

## The 2019 DSLinks canon (analytical reading)

The older corpus is "Bret-Victor-adjacent explorable explanations meets
computational-design classroom." Keyword veins: explorables/reactive documents
(Distill, Nicky Case, Apparatus, Chalktalk, Seeing Theory); computational design
(Programming Design Systems, rune.js, Nature of Code); color (Khroma, Color
Leap, Sinebow); sacred geometry / math-art (Byrne's Euclid, Islamic Patterns,
isohedral tilings); history-of-ideas anchors (Alan Kay, Engelbart). The curated
gems are in [links.md](links.md) "DSLinks picks"; the direct mappings —
Apparatus ≈ reactive nodes, Chalktalk ≈ sketch-aware live canvas, explorables ≈
lesson boards — are the project's DNA.
