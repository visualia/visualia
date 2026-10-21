---
status: building
---

# Style: one small sheet, shaped by its users

Every Visualia page (probe, studio, board, usage, gallery) uses one stylesheet,
`packages/style/visualia.css`. It is deliberately minimal and deliberately
small enough to read in a minute, because shaping it is part of the course:
change a variable, and every tool changes.

## Principles

- **Black sans on white.** One typeface: the system sans (no web font to load).
  Dark mode is the same page inverted, not a second design.
- **Hierarchy only from size, weight, opacity and whitespace.** No colours, no
  cards, no borders, no badges, no shadows, no rounded boxes. A hairline at
  low opacity is the only rule allowed, and rarely.
- **Two sizes** (text, and a large one for the page title only), **two
  weights** (regular, bold), **two inks** (full, quiet), **three spaces**
  (within a group, between items, between sections). Headings are text-size
  bold; notes are quiet, not smaller.
- **State is a word, not a colour:** *yes* in bold ink, *not yet* in quiet
  ink. Readable in greyscale, on a projector, and by colour-blind readers.
- **Whitespace does the grouping.** Space between groups is larger than space
  within them, on one scale.

## Shaping it

- All decisions are CSS custom properties at the top of the file: type scale,
  weights, ink opacities, spacing scale, measure (line length).
- A student can override them on their own page, or propose a change to the
  class sheet (the same propose / vote / merge flow as the studio UI, see
  `schools/eka/docs/STUDIO.md`, "A UI students can reshape").
- The sheet is served next to each page (copied in at deploy, like
  `models.json`), so a fork is just a different file.

## First use

The probe (`apps/probe`), restyled from its first coloured-card version and
deployed. Models that run show their verdict in bold; those that don't fit fade
to faint ink with the reason underneath.
