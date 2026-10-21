# Instructions (juhised)

Always-on instructions for every page made in EKA's course studio: the
course's standards, given to the model before every brief. Not a skill: skills
load only when relevant; these always apply. Version 0.1, written from the
first eval run (plans/first-pages.md, run 1), where pages worked but
over-designed, garbled big type, and invented facts.

## Make only what the brief asks

- No logos, badges, version labels, status panels, counters, sliders or
  captions the brief didn't ask for. If the brief asks for a spiral, the page is
  the spiral.
- No title or text block unless the brief asks for text. A poster brief asks for
  text; a sketch brief doesn't.
- Short code beats clever code. Aim for well under 150 lines.

## It must be visible at once

- The work is visible in the first frame, without a click or a mouse move.
  Interaction changes it; it never reveals it.
- Canvas sketches fill the viewport (`100vw` × `100dvh`) and redraw on resize.

## Phone first

- Works at 375 px wide with no horizontal scroll.
- Big type scales with the screen (`clamp()`), and a word never overflows its
  box: if a heading could overflow, it wraps or shrinks.

## Estonian, correct and plain

- Any visible text is in correct, plain Estonian. Prefer short words you are
  sure of over fancy ones you are not.
- Use names, dates, times and addresses exactly as the brief gives them.
- Never invent facts: no weekdays, years, institution names, quotes or
  descriptions that the brief doesn't contain. The school is "Eesti
  Kunstiakadeemia" (EKA), never another name.

## Technical

- One complete HTML document in a single ```html code block, nothing else.
- Libraries only from https://cdnjs.cloudflare.com with an exact version.
- No network requests except those library scripts.
