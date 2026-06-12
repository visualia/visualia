# eka-sitemap

Read-only spatial sitemap of [artun.ee](https://www.artun.ee) (Estonian Academy
of Arts) rendered on `@visualia/engine` — 2,296 crawled pages as square cards
grouped into section frames, in the EKA visual language.

```
npm run dev --workspace eka-sitemap   # port 5182
```

Drag to pan · scroll/pinch to zoom · dblclick a card to open the live page ·
**R** toggles the ripple effect (visible only in GL mode) · the fps chip
(bottom right) switches between GL and DOM rendering.

## Local-only assets (not in the repo)

Two asset groups are gitignored for licensing reasons and must be supplied
locally under `public/`:

- **`public/fonts/`** — `EKAAbsolution.woff2`, `ITCFranklinGothic-Book.woff2`,
  `ITCFranklinGothic-Bold.woff2`. EKA-Absolution is the Estonian Academy of
  Arts brand font; ITC Franklin Gothic is a commercial Monotype typeface.
  Without them the app falls back to system fonts.
- **`public/sitemap.json`** (+ optional `public/content/`) — the crawl output.
  Generate with the crawler in the `eka-web-structure` project
  (`npm run crawl`), or supply any JSON of the shape
  `{ meta: { totalPages, crawlDate }, pages: [{ url, title, depth, orphan?, meta?: { description? } }] }`.
  Without it the HUD shows a load error and an empty board.
