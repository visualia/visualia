# Instructions (juhised)

Always-on instructions for every page made in EKA's course studio: the
course's standards, given to the model before every brief. Not a skill: skills
load only when relevant; these always apply.

Version 0.4. v0.1–v0.3 came from eval runs 1–4 (plans/first-pages.md):
over-design, garbled big type, invented facts, colliding chart labels,
washed-out 3D, a sentence before the code, and library URLs that don't exist.
v0.4 (run 8) swaps rules that only named an outcome for concrete techniques
from the short file (run 7): a heading-size formula (Gemma's poster overflowed,
DeepSeek's broke mid-word), Estonian month abbreviations rotated at 375 px, and
a 3D camera distance with fixed lights and no fog (the camera was still too
close). It also spells out which facts a poster keeps, word for word, since
the school name went missing.

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
- 3D scenes frame the whole subject with space around it: field of view
  45–50, camera about 3× the subject's width from its centre and a little
  above, `lookAt` the centre; an orbit keeps that radius. No fog: it hides the
  subject at that distance. Light: `HemisphereLight` + one `DirectionalLight`,
  intensity ≤ 2, no washed-out white, no black. Keep the setting the brief
  names (ground, water, sky, room) visible.

## Phone first

- Works at 375 px wide with no horizontal scroll.
- Big headings fit their longest word on one line:
  `font-size: min(clamp(…), calc(90vw / (N * 0.75)))`, N = letters in the
  longest word ("KUNSTIAKADEEMIA" is 15); keep the 0.75. They may wrap
  between words, never inside one:
  `hyphens: none; overflow-wrap: normal; word-break: normal`.
- Chart labels never overlap or get clipped at 375 px. Months: jaan, veebr,
  märts, apr, mai, juuni, juuli, aug, sept, okt, nov, dets. Twelve labels don't
  fit side by side on a phone: rotate them −45° (`text-anchor: end`) and make
  the bottom margin as tall as the longest label. The axis with the labels
  sits at the bottom of the chart, below the lowest bar, never on the zero
  line.

## Estonian, correct and plain

- Any visible text is in correct, plain Estonian. Prefer short words you are
  sure of over fancy ones you are not.
- Use names, dates, times and addresses exactly as the brief gives them, and
  keep every one of them: dropping a fact the brief gives is as wrong as
  inventing one. Copy them word for word: no word dropped, no ending changed.
  A poster for an EKA event shows who (the school), what, when and where.
- Never invent facts: no badges, labels, "since" years, weekdays, institution
  names, quotes or descriptions that the brief doesn't contain. The school is
  "Eesti Kunstiakadeemia" (EKA), never another name.

## Technical

- Start the answer with the ```html code block at once: no sentence before
  it, nothing after it. One complete HTML document in that single block.
- Use only these library URLs, exactly as written (checked 2026-10-21; any
  other version or path may not exist and the page breaks):
  - p5: `<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js"></script>`
  - d3: `<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>`
  - GSAP: `<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>`
  - Tone.js: `<script src="https://cdnjs.cloudflare.com/ajax/libs/tone/15.0.4/Tone.min.js"></script>`
  - three.js, as a module with an import map:
    `<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script>`
    then `<script type="module">import * as THREE from 'three'; import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; …</script>`.
    Never `three.min.js`, never a global `THREE` without the import.
- Classic `<script src>` libraries go in `<head>`, before any code that uses
  them.
- No network requests except those library URLs and the page's own pictures
  (below).

## Several files

For multi-file projects only (added 2026-10-22, plans/multi-file.md); the
studio leaves this section out for single pages.

- Link files with relative paths only: `href="style.css"`, `src="main.js"`,
  `href="about.html"`; the home page is `href="index.html"`. Never a path
  starting with `/`: the site is published inside a folder.
- Pictures, sounds and other assets go in one folder, `assets/`.
- Libraries as ES modules through an import map in each page's `<head>` (as
  three.js above, or `https://esm.sh/<package>@<exact version>`), used from
  `<script type="module" src="main.js">` with `import`.
- Shared look in `style.css`, shared code in `main.js`; every page links them.
- Write all the files in one step, one `write` per file, each under about
  20 KB. Change files with `edit`.

## Pictures

- A page gets a picture only when the brief asks for one (a photo, an
  illustration, a picture of …). Never stock-photo or other image links.
- Write a placeholder and the studio draws the picture:
  `<img data-generate="what the picture shows, in English: subject, setting, light, style" data-size="768x1024" alt="short Estonian description">`.
  `data-size` is width x height, each up to 1024 (default `1024x1024`;
  `768x1024` for a portrait poster, `1024x768` for a landscape). At most 3
  pictures per page.
- The description is the picture only: no words, letters or numbers in it.
  Text goes in HTML, over or beside the picture.
- Style it like any image: size it in CSS and use `object-fit: cover`. For a
  photo behind a poster's text, position the `img` absolutely behind it and
  keep the text readable (contrast, a shade).
- When changing a page, keep existing pictures exactly as they are
  (`<img src="1-1.jpg" …>`). Write a new `data-generate` only for a new or
  changed picture.
