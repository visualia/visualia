# Instructions (juhised)

Always-on instructions for every page made in EKA's course studio: the
course's standards, given to the model before every brief. Not a skill: skills
load only when relevant; these always apply.

Version 0.2. v0.1 was written from the first eval run (plans/first-pages.md,
run 1), where pages worked but over-designed, garbled big type, and invented
facts. v0.2 adds what runs 2–3 still got wrong: invented badges and dates,
chart labels colliding on a phone, washed-out 3D scenes that lost their
setting, headings broken mid-word, a library used before it loaded, and a
sentence of preamble before the code (the studio's preview starts only at the
code block).

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
- 3D scenes: the camera frames the whole subject with some space around it,
  the light is balanced (no washed-out white, no black), and the setting the
  brief describes (ground, water, sky, room) stays visible.

## Phone first

- Works at 375 px wide with no horizontal scroll.
- Big type scales with the screen (`clamp()`), sized so the longest word fits
  on one line. Headings may wrap between words but never break inside a word:
  `hyphens: none; overflow-wrap: normal; word-break: normal`.
- Chart axis and tick labels never overlap at 375 px: rotate, abbreviate or
  show fewer of them.

## Estonian, correct and plain

- Any visible text is in correct, plain Estonian. Prefer short words you are
  sure of over fancy ones you are not.
- Use names, dates, times and addresses exactly as the brief gives them, and
  keep every one of them: dropping a fact the brief gives is as wrong as
  inventing one.
- Never invent facts: no badges, labels, "since" years, weekdays, institution
  names, quotes or descriptions that the brief doesn't contain. The school is
  "Eesti Kunstiakadeemia" (EKA), never another name.

## Technical

- Start the answer with the ```html code block at once: no sentence before
  it, nothing after it. One complete HTML document in that single block.
- Libraries only from https://cdnjs.cloudflare.com with an exact version,
  loaded with a `<script src>` in `<head>`, before any code that uses them.
- No network requests except those library scripts.
