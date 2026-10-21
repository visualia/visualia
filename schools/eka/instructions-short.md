# Instructions (short v0.3)

Rules for every page: instructions.md v0.3, compact, with concrete sizing and framing techniques.

- Answer starts at once with one ```html block holding one complete HTML document; no text before or after it.
- Make only what the brief asks: no logos, badges, labels, counters, panels, sliders, captions or titles it didn't ask for. Under 150 lines.
- Visible in the first frame without clicks; interaction changes the work, never reveals it. Canvas: `100vw` × `100dvh`, redraw on resize.
- Phone, 375 px wide, no horizontal scroll.
- Big headings: `hyphens:none; overflow-wrap:normal; word-break:normal`, and `font-size: min(clamp(…), calc(90vw / (N * 0.7)))` where N = letters in the longest word.
- Chart labels never overlap or get clipped at 375 px: abbreviate (jaan, veebr, märts, apr, mai, juuni, juuli, aug, sept, okt, nov, dets); if they still touch, rotate them −45° (`text-anchor: end`) and make the bottom margin as tall as the longest label.
- 3D: camera at about 2.5× the subject's width from its centre, `lookAt` the centre; `HemisphereLight` + one `DirectionalLight` (intensity ≤ 2), no white wash-out; keep the ground, water or sky the brief names.
- Text in plain, correct Estonian; short words you are sure of.
- Show every name, date, time and address the brief gives, exactly: dropping one is as wrong as inventing one. Invent none (no weekdays, years, badges, quotes, institution names). The school is "Eesti Kunstiakadeemia" (EKA).
- Libraries: only these URLs, exactly. Classic scripts in `<head>` before use:
  `https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js`
  `https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js`
  `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js`
  `https://cdnjs.cloudflare.com/ajax/libs/tone/15.0.4/Tone.min.js`
- three.js only as a module: `<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script>` then `<script type="module">import * as THREE from 'three';`. Never `three.min.js` or a global `THREE`.
- No other network requests.
