---
status: next
---

# Talks online: a shareable link to the deck

Asked 2026-11-20 after the Arunädal talk:
*"getting the assets online so i can share the pres (right arrow = space), no sound hotkeys, legend on frontpage …
splitting web assets git or r2able. how it fits to visualia 'personal project'? split research assets to separate
r2-capable place"*.
Nothing has been built. Numbers come from a crawl of talk.html on 2026-11-20 (Space through all 118 steps, every
request logged). Parts can go ahead before `plans/stage.md`; the rest is said below.

## Blockers to settle first (the user's call)

1. **SHARP scenes:** 14 `.spz` files, 228 MiB, the whole 3D walk and Setomaa.
   - Apple's weights are for research only, and `plans/drift-room.md` says nothing made with them is shown without
     asking first.
   - Online the choices are:
     - (a) drop them and show the source pictures flat;
     - (b) remake the scenes with our own 2.5D depth sheets (`research/landscape-splats.md`);
     - (c) keep the link private (Cloudflare Access, named people) and call that research use.
2. **Kihnu and Seto care rule** (`plans/drift-room.md`): the room stays in the class or a talk, not online, until people
   from those traditions have seen it. The talk has Setomaa slides, the 3D and the costume figurines.
   - Either they see it first, or the online cut leaves those parts out.
3. **Songs with lyrics and named film themes.**
   - The songs are ElevenLabs or MiniMax (the files disagree with HANDOFF), and their terms decide whether they may be
     published.
   - `mm-named-kevade` was asked for as "the theme song of Kevade (1969)". Listen for closeness to the real tune.
4. **Photoreal generated people** (ChilloutMix grids, figurines): fine in a talk about bias, but say so on the page.

Until 1 and 2 are answered, the honest default is (c): a private link to named people.

## What goes where

| What | Size | Where | Why |
|---|---|---|---|
| Deck code: talk.html, 6 pages, 15 shared modules, CSS | ~1.8 MB | **git** (`apps/talks/`) | hand-written, now git-ignored under `out/` with the only backup in `~/plans` |
| Vendored three.js, Spark | 4.8 MB | git, pinned exactly | same rule as npm deps |
| Small generated JSON (places, runs, map/world*, costs, energy, scenes) | 1.4 MiB | git, copied in by a script | small, changes with the talk, diffable |
| Talk media: `.spz`, `.splat`, `.png`, `.jpg`, `.mp3` | ~497 MiB, 210 files | **R2 `visualia-talks`** (served through the Worker) | too big and binary for git |
| Index picks (`dx-out`, `dx-picks` in localStorage) | tiny | git, `picks.json` | online viewers otherwise get every film picture |
| Research outputs: the rest of `out/`, `research/music-drift/out` | ~12.5 GB, ~13k files | **R2 `visualia-research`**, private | backup and sharing between Macs; never public |

- **Media manifest in git** (`apps/talks/media.json`): path, bytes, sha256 for each file. A sync script uploads only
  what changed. The manifest is also the asset closure the node tests check (`plans/stage.md`).
- **Thumbnails:** films ship full-size PNGs as index thumbnails (about 115 MiB). Make 512 px JPEGs and the talk drops
  to about 380 MiB.
- **Research bucket:** upload with rclone through R2's S3 API, not wrangler one object at a time. The local `out/`
  stays the working copy.
  - Four files are over 25 MiB: the siglip ONNX (355 MiB), dinov2 (84 MiB), `nukitsamees.mp4` and a 23 MiB gif. R2 is
    fine with them; Worker assets would not be.
  - `rahvaroivad/` (2.6 GB, licence unclear) goes there only privately.
- **Strip before anything leaves the machine:**
  - expired presigned R2 URLs carrying the account ID and an access-key ID, in 89 sound JSONs;
  - `/Users/s32863/...` paths in `energy.json`.
  - A check in the sync script refuses to upload any file containing `X-Amz-Credential` or `/Users/`.

## Hosting

- One Worker, `visualia-talks`, at `talks.visualia.space`, modelled on `visualia-probe` (assets only).
- Code is served as static assets. Media sits on the same origin: `run_worker_first` on the media prefixes, which
  reads from R2.
- Same origin means:
  - no CORS;
  - the cross-folder paths (`../films/`, `../sounds-research/`) keep working;
  - the iframes stay same-origin, which the current deck needs (`contentWindow.aiLayer` etc.).
- Caching:
  - media: immutable, long `Cache-Control`, URLs versioned through the manifest hash;
  - code: short caching;
  - no more `?v=1120` busting by hand.
- No range requests are needed: audio goes through `fetch` and `decodeAudioData`, and there is no `<video>`.
- Deploys tagged `talk-<slug>-<n>`, apart from school tags (`eka-<n>`).
- Every file is 17.5 MiB or less, so a fallback exists: ship the 497 MiB as Worker assets from a local, git-ignored
  folder. That avoids R2 but makes every deploy upload half a gigabyte. R2 is the default.

## Online mode

Set by the hostname (anything but 127.0.0.1) or `?web`. Only talk.html's own handlers change: inside the embedded
pages → already means next.

| Key | Talk (stage) | Online |
|---|---|---|
| Space, → , PageDown | next | next |
| Shift+Space, ←, PageUp | back | back |
| → / ← on the 3D steps | camera sideways | **next / back**; camera on drag and WASD only |
| → on the map | next distance band + music layer | **next**; the 14 bands become Space sub-steps (also better on stage) |
| ← / → on the credits | change song | next / back; songs play in order |
| 1 / 2 / 3, M | volume, mute | **none**; the system volume does it |
| I | index | index |

- **Sound starts on the front page's Start button.** That press is the gesture audio needs; a deck opened straight
  from a link shows the same button over its first step.
- **The smoke:** the title smoke uses the experimental canvas-draw-element flag, which viewers won't have. Online it
  needs a fallback (a still or plain CSS), or it goes.
- **Loading:**
  - about 97 MiB of splats before the first scene, about 0.5 GB for the whole talk;
  - the front page says so, and the deck loads ahead one step;
  - a loading state shows instead of blank paper (`plans/stage.md` step 0).

## Front page

`talks.visualia.space/` is a small new page, not explore.py's research index, which stays local. It has:
- the talk's title, date and place;
- a Start button;
- the key legend from the table above (online column);
- a line on size and browser: desktop Chrome or Edge, about 0.5 GB;
- credits, including Wikimedia CC BY-SA for `nature/real/*`;
- a line on what the generated people and songs are.

Text written with the `visualia-writing` skill.

## Where talks live: visualia, positron or their own repo

Asked 2026-11-20: *"i am lost where to put my talks. perhaps positron? compare."* Not decided; recommendation below.

A talk is three things, and they need not live together:
1. **Media:** pictures, splats, songs, made by models with visualia's scripts and gateway.
2. **The player:** score, transport, stage, sound, keys, index (`plans/stage.md`).
3. **The talk itself:** the score, the words, the picks, private notes.

| | visualia (`apps/talks/`) | positron | own repo (`~/personal/talks`) |
|---|---|---|---|
| The 2026-11-14 rule | fits: shows model-made media | breaks it: a model made the pixels | neither project's rule applies; the media stays made in visualia |
| three.js and Spark | fine (npm, pinned) | against `LAYOUT.md`: "three.js is still the wrong library" | fine |
| Public or private | the repo is **public** and has no LICENSE; SHARP, Kihnu/Seto and songs are open questions | public, MIT plus AGPL parts | **private by default**, published per talk |
| Talks that mix both | awkward: HARNO uses positron's Lonely Software and loopback demos | awkward: the same, the other way | natural |
| Existing machinery | the deck, the media, the scripts | slide engine, `/present/`, the transport, a hardened deploy, verify harness | none; vendors from both |
| Purpose | a platform run per school | media art R&D, "not a product" | your talks |
| Precedent | `research/arunadal-*` (public research; `research/harno/` moved to `~/personal/talks/harno/research/` 2026-11-21) | TechTrack Lab II pages (`demo/present/`); talk decks archived twice ("no need for a talk slide") | `~/personal/talks/harno/` (private notes and the HARNO research, a git repo since 2026-11-21); `~/plans/visualia-decks` (private backup) |
| Cost | one more app in a repo with school deploys | breaks two of its rules | one more repo, deploy and vendoring point |

**Recommendation: its own private repo, `~/personal/talks`, made a git repo.**
- It holds one folder per talk (score, words, picks, notes) and the player, built per `plans/stage.md`.
- The player vendors positron's `timeline/` and visualia's `packages/style` at tags ("share, don't merge").
- **Media stays made in visualia:** the scripts, the gateway and the run records (`plans/runs-to-platform.md`). It is
  published to the talk's R2 bucket through a manifest, and the talks repo holds only the manifest.
- A talk can show positron's demos too, as links or embedded live pages, without either repo owning the other.
- Online at a personal hostname, its own Worker, on the same Cloudflare account.
  - `talks.visualia.space` would suggest a school's material.
  - Which domain is the user's call.

**This changes the rest of this plan:**
- `apps/talks/` becomes the talks repo.
- The media bucket becomes `talks-media`, not `visualia-talks`.
- `visualia-research` (private, research outputs) stays in visualia, unchanged.

If the user prefers visualia after all, the table's middle column is the cost: the repo is public, and talks mixing
both projects get awkward.

## Steps

1. Answer the blockers above.
2. Move the deck code into `apps/talks/` with git history starting there. Keep out the 331 `*.before-*` backups: git
   is the backup from now on.
3. Media manifest and sync script (with the credential check); create `visualia-talks`; upload.
4. `visualia-research` bucket; rclone upload of the rest of `out/` and `research/music-drift/out` after the strip.
5. Worker `visualia-talks` (assets plus R2 on the media prefixes); deploy to a private URL behind Access first.
6. Online mode keys, picks.json, the Start button, a smoke fallback, the loading state.
7. Front page with the legend.
8. Share: private first; public only after the blockers.

Steps 2–5 can go ahead before `plans/stage.md`. Step 6 touches talk.html, which the stage work replaces. Do only the
key table there, and carry it into the stage as its key map.
