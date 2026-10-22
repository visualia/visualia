# Spatial interfaces: notes for the board

Written 2026-10-22 for `plans/board.md`. What other people wrote and built about
canvases, zoom and shared spaces, and what we take from it. The reading list is
`research/reading.md`. Pages were read on 2026-10-22; Wattenberger's essays
show no dates, so years come from other sources or are left out.

## Amelia Wattenberger

Formerly at The Pudding, GitHub Next and Adept
([homepage](https://wattenberger.com/),
[AI Engineer speaker page](https://ai.engineer/speakers/amelia-wattenberger)).

- **[Evolving the infinite canvas](https://wattenberger.com/thoughts/evolving-the-infinite-canvas)**.
  Today's canvases are inert: people do all the tidying themselves, like keeping
  things from overlapping, grouping and copying content out. She asks,
  "What if we could hardcode these behaviors into the canvas itself?"
  Her answer has three parts:
  - **Forces**: no overlap, and magnetic groups.
  - **Gestalt**: the canvas reads proximity, similarity and order as structure.
  - **Views**: one set of data, shown as canvas, list, grid or timeline, kept in sync.

  This is the closest source for the board.
- **[Fish eye](https://wattenberger.com/thoughts/fish-eye)** (late 2024). The
  same text at several levels of abstraction. "A fish eye lens doesn't ask us
  to choose between focus and context." Each map zoom level shows *different*
  information, not just smaller information.
- **[Our interfaces have lost their senses](https://wattenberger.com/thoughts/our-interfaces-have-lost-their-senses)**
  (March 2025). Interfaces went from knobs to the command line to the GUI to
  touch to chat, a "Great Flattening". "When you strip away too much friction,
  meaning and satisfaction go with it."
- **[Bridging the hard and the soft](https://wattenberger.com/thoughts/hard-and-soft)**.
  Interfaces are hard segments joined by soft material. Give beginners more
  structure and experienced people more freedom.
- **[Why chatbots are not the future](https://wattenberger.com/thoughts/boo-chatbots)**
  (2023) and
  **[Chat is AI's command line](https://wattenberger.com/thoughts/ai-is-still-in-its-terminal-era)**.
  A text box has no affordances. Use controls for whatever can be specified,
  and language only for the open-ended rest.
- **[Sentence lengths](https://sentence-length.netlify.app/)**. Texts drawn as
  shapes so you can compare them at a glance, while each shape still leads
  back to its text.
- Talk: *Climbing the Ladder of Abstraction*, AI Engineer Summit 2023
  ([video](https://www.youtube.com/watch?v=PAy_GHUAICw)). She has no essay by
  that name. "Semantic zoom" isn't her term either; she uses "fish eye".

## Abstraction and zoom

- **Bret Victor, [Up and Down the Ladder of Abstraction](https://worrydream.com/LadderOfAbstraction/)**
  (2011). Understanding comes from moving between levels: control one
  concrete case, step up to see every value of a parameter, then step down by
  picking one value. For the wall, time is that parameter. Step up to every
  week and every version, then step down to one work.
- **Susie Lu, [Abstractions](https://www.susielu.com/data-viz/abstractions)**
  (2019). The more abstract a view, the further it gets from the data points,
  so every level needs landmarks to orient by. Abstraction is more than
  aggregation.
- **Zooming interfaces**:
  - Perlin and Fox,
    [Pad](https://www.researchgate.net/publication/2456102_Pad_-_An_Alternative_Approach_to_the_Computer_Interface)
    (1993).
  - Bederson and Hollan,
    [Pad++](https://courses.cs.washington.edu/courses/cse510/16wi/readings/bederson1994.pdf)
    (1994).
  - Raskin,
    [The Humane Interface](https://en.wikipedia.org/wiki/The_Humane_Interface)
    (2000), ch. 6.
  - Semantic zoom changes "the representation of an object based on scale"
    ([ZUI](https://en.wikipedia.org/wiki/Zooming_user_interface)).
  - A recent catalogue:
    [prathyvsh/semantic-zoom](https://github.com/prathyvsh/semantic-zoom).

## Canvases and shared spaces

- **[tldraw](https://tldraw.dev/)**.
  - [Sync](https://tldraw.dev/docs/sync): one authoritative room per document.
    In the
    [Cloudflare template](https://github.com/tldraw/tldraw/tree/main/templates/sync-cloudflare),
    a room is a Durable Object with SQLite and assets in R2, "the same setup
    that runs tldraw.com".
  - Changes are record diffs (added, updated, removed), applied
    optimistically and rebased.
  - Shapes are DOM. [Culling](https://tldraw.dev/sdk-features/culling) keeps
    shapes off-screen ("10,000 shapes might only render 50").
  - [Image LOD](https://tldraw.dev/sdk-features/performance): the asset store
    is asked for a size rounded to a power of two, times the device pixel
    ratio, debounced while zooming.
  - [tldraw computer](https://computer.tldraw.com/)
    ([notes](https://blog.nilenso.com/blog/2024/12/30/thought-on-tldraw-computer/)):
    arrows carry data between cards. Lines as provenance.
- **Figma**,
  [How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)
  (2019).
  - The server is the authority, and the document is a map of objects to
    properties.
  - Last writer wins per property, so edits to different properties never
    conflict.
  - Order uses fractional indexing.
  - On phones, Figma is view and comment only, and FigJam can be edited only
    on iPad
    ([help](https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app)).
- **Excalidraw**,
  [P2P collaboration](https://plus.excalidraw.com/blog/building-excalidraw-p2p-collaboration-feature)
  (2020). Each element carries a version, ties break on a random nonce, and
  deletes are tombstones. The server only relays.
- **Kinopio**,
  [design principles](https://pketh.org/design-principles.html) (2023). "A
  single interface for mobile and desktop": no hover, a tappable alternative
  for every key, and room for the on-screen keyboard. Fast position updates
  go over WebSocket, and permanent changes through slower API calls
  ([how it's made](https://pketh.org/how-kinopio-is-made.html)).
- **Muse**,
  [retrospective](https://adamwiggins.com/muse-retrospective/) (2024). Nested
  zoomable boards on iPad and Mac. It never reached a phone and never grew
  enough.
- **Are.na**. Channels are grids of blocks, a block can sit in many channels,
  and "every connection was made by a human"
  ([blocks](https://help.are.na/docs/getting-started/blocks),
  [connections](https://help.are.na/docs/getting-started/connections)). The
  grid has nothing to fight over and reflows on a phone (our reading; Are.na
  doesn't say this).
- **[infinitecanvas.tools](https://infinitecanvas.tools/)**. Four marks of a
  canvas: expanse, zoom, direct manipulation, and working together in real
  time.
- **Cove** ([site](https://cove.ai/),
  [launch](https://cove.ai/blog/introducing-cove),
  [HN](https://news.ycombinator.com/item?id=41780928)). AI answers arrive as
  cards on a shared canvas, and the AI makes targeted edits instead of
  rewriting everything. The team joined Microsoft in March 2026 and the
  product closed
  ([TechCrunch](https://techcrunch.com/2026/03/18/microsoft-hires-the-team-of-sequioa-backed-ai-collaboration-platform-cove/)).
- **Observable Canvases**
  ([launch](https://observablehq.com/blog/introducing-canvases-early-access),
  2025). Branched analyses sit side by side on a canvas. Forks stay next to
  their parent. The product page blocked our fetch.

## Better UIs for AI, briefly

- Maggie Appleton:
  - [Language Model Sketchbook](https://maggieappleton.com/lm-sketchbook):
    chat is the lazy solution.
  - [Squish Meets Structure](https://maggieappleton.com/squish-structure):
    small, sharp, checkable tools.
  - [Tools for Thought as Cultural Practices](https://maggieappleton.com/tools-for-thought):
    a tool for thought is a practice, not only software.
  - [A Picture Worth a Thousand Programmes](https://maggieappleton.com/programming-pictures):
    pictures show change over time in a way text can't.
- [The Shape of AI](https://www.shapeof.ai/) and the
  [PAIR patterns](https://pair.withgoogle.com/guidebook-v2/patterns): let
  people supervise automation, and give control back to them when it fails.

## Pedagogy

- **Resnick, *Lifelong Kindergarten*** (2017,
  [MIT](https://www.media.mit.edu/publications/lifelong-kindergarten-cultivating-creativity-through-projects-passion-peers-and-play/)).
  Projects, passion, peers, play. "Playground, not playpen" is Marina Bers'
  metaphor, which Resnick quotes.
- **Tversky, *Mind in Motion*** (2019,
  [APS](https://www.psychologicalscience.org/observer/tversky-proposes-audacious-theory-of-spatial-thinking)).
  Spatial thinking is the foundation of thought. "When thought overflows the
  mind, the mind puts it back into the world."
- **Sticky dots** (from the teacher's list). Each person has a wall of
  non-competitive coloured dots, one colour per kind of learning moment, such
  as "I supported someone else's creative process" or "I tried something
  bold". What matters is the pattern over time; there are no scores.
