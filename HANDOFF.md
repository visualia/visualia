# Handoff

Written 2026-10-21, rewritten 2026-10-23 and 2026-11-02, updated 2026-11-09
(the seventh stretch: the EKA course card; upscaling in the pool with Burn,
in the app and in tabs; the gateway's image model menu and a klein 9B
upscaler; local image generation tried with stable-diffusion.cpp; the
Estonian visuals plan). Read this, then
`plans/README.md` (the board and backlog) and `worklog/2026-11.md`.

## Right now

**2026-11-09, pushed and deployed** (gateway, pool, studio, the upscaler
weights in R2; one step left, below):

- **Upscaling** (`plans/local-images.md` "Upscaling"): Real-ESRGAN in Rust
  with Burn (`apps/pool-app/upscale`; no Python, no extra program; Metal
  natively, WebGPU in tabs). Pool app **0.4.0** (built and signed in
  `apps/pool-app/target/release/bundle`, 22.5 MB) offers `upscale-fast` and
  `upscale-quality` once their weights are downloaded from the pool (model
  list `file` + `sha256`, R2 `/app/files/`). The pool's `/upscale`, the
  gateway's `/v1/upscale` (also `@cf/black-forest-labs/flux-2-klein-9b`,
  which redraws and invents detail; output capped at 1536×1536 worth of
  pixels), the studio page `/upscale` (linked from the class page), and the
  join page's "Upscaler" box and "No chat model". Warm on the M2: fast 0.2 s,
  detailed about 4 s for 320×128 → 1280×512; a tab 1.0 s.
- **Gateway `/v1/images` takes `model`**: nine Workers AI models tested;
  four catalog models need gateway credits (unified billing). SDXL, SDXL
  Lightning and Dreamshaper leave Workers AI on 2026-11-20; run on
  2026-11-09, nothing worth keeping (`worklog/2026-11.md`).
- **Deployed 2026-11-09:** gateway, pool (bucket `visualia-pool-app`
  existed; weights put and checked by SHA-256 as served), studio. **Left
  to run by hand:** `cd apps/pool-app && node publish-update.mjs --notes
  "Upscaling: make pictures bigger for everyone in the pool."` (0.4.0;
  Claude Code's permission check refused it). Until then apps on 0.3.0 see
  no update (204). The tab upscaler served is the 10:56 build
  (`apps/pool/public/upscale`, the one tested in tabs); `build-web.sh` can't
  rerun here while ThreatLocker kills build scripts (below).
- **Images:** the studio stays on klein 4B (teacher's choice, 2026-11-09:
  9B is 13× the price); a failed 4B falls back to 9B. Catalog models need AI
  Gateway credits (dashboard, AI Gateway billing) before they answer.
- **Running locally from the session** (stops with it): `wrangler dev` for
  the pool (8787), gateway (8788), studio (8789) on one local D1 in the
  scratchpad, test key person `m2-test`, and `visualia-pool-cli` with
  `UPSCALE_DIR`. Local pool sign-in needs `ORIGIN=http://pool.visualia.space`
  in `apps/pool/.dev.vars` (gitignored; wrangler dev rewrites Origin).
- **Local image generation**: stable-diffusion.cpp built in
  `~/visualia-local/stable-diffusion.cpp` (Metal), models in
  `~/visualia-local/models` (14 GB: FLUX.2 klein 4B Q8 + Qwen3 4B + VAE,
  SD-Turbo). klein 4B 30 s for 512², SD-Turbo 6 s and draws Greece's flag for
  Estonia's. Not in the pool.
- **Estonian visuals** (`plans/estonian-visuals.md`, idea): the EKI
  leaderboard harnesses read and compared with our models; a playground to
  build; 31 folk-costume photos from rahvaroivad.ee in
  `evals/estonian-visuals/out/` (class only, not in git). **The teacher
  emails rahvaroivas.ee about the licence before the course.**
- **Revoke** the Hugging Face write token in the remotes of
  `~/personal/leaderboard_old/{data,ui}`.
- **The EKA course card** is a Google Doc (English only);
  `schools/eka/docs/COURSE-CARD.md` is the older draft.
**From 2026-11-02:**

- **The M1 is in the pool on 0.3.0** as `m1-1` (copied from the work Mac's
  build, started from its login item, keychain allowed on 2026-11-02).
- **The M1 is cleaned up** (2026-11-02): the three spare model builds, the
  old `~/visualia-build` and the 0.2.0 backup are gone (models 48 → 39 GB).
- **The work Mac is in the pool** as `eka-teacher` with `visualia-pool-cli`
  (qwen3.5-9b, gemma4-26b, clef-flash), started from a Claude Code session:
  it stops when that session ends. Ollama there was started the same way.
- **The update key** `~/.config/visualia/pool-updater.key` (work Mac only, no
  password, mode 600) signs every update; losing it means installed apps
  can't update again. **Back it up.**
- **The repo is public** (an anonymous request got 200 on 2026-11-02), though
  this file said private: decide which.
- **ThreatLocker blocks again** (2026-11-09): cargo's freshly built build
  scripts were killed (SIGKILL) during `build-web.sh`; wrangler and esbuild
  still run. Ask IT. Earlier (2026-11-02) it blocked nothing:
  re-signed copies, a freshly compiled binary and esbuild 0.28.2 all ran, so
  whether an approval survives an update can't be tested until it enforces
  again; ask IT what changed. The esbuild and workerd overrides stay until
  re-tested deliberately (`CLAUDE.md`). Rust (Homebrew rustup, 1.96) builds
  here now.
- **Boards are still the thread to pick up** (`plans/boards.md`): the teacher
  picks the next type or idea; build only that, and ask before designing.
  `plans/board-sight.md` (idea) is the proposal for how an AI sees a board.
- **MCP step 1 works from a real AI tool** (2026-10-23,
  `claude mcp add --transport http visualia https://mcp.visualia.space/mcp`).
- The note for EKA IT is in Claude Docs
  (https://claude.ai/artifact/54RozP72WYmyQEsSBixY8W), tab-only; not sent yet.

## What exists and is live

| Address | What | Code |
|---|---|---|
| https://studio.visualia.space (also visualia.space) | The studio. Home: the class chat (permanent, presence), Boards, "Everyone's work" as a plain live grid of shared projects (newest first / by person; the first board is cleared, `plans/board.md`), and "Your private projects". A project is a folder of files (`plans/multi-file.md`; old single-page versions become manifests on first read): describe → live preview → change → versions → publish; errors with auto-fix; "matches the request %" judged from a 375 px screenshot; pictures generated in pages; remix with credit; Share with class / Make private. `/usage` for everyone | `apps/studio` |
| https://studio.visualia.space/board/<id> | Boards: many per school, each a surface (pan, zoom), live for the class; text so far | `apps/studio` (`board.js`, `board.html`), `plans/boards.md` |
| https://projects.visualia.space/<person>/<slug>/ | Published projects, CSP sandbox; only the pictures the published version uses | `apps/studio` |
| https://gw.visualia.space | Gateway: every model call, `usage` rows in D1 (cost, energy, `served_by`, `served_kind`); `/v1/images` (FLUX.2 klein 4B); `/v1/decide` (Clef-flash: `pool/clef-flash` on a node worker, else cloud); `pool/<model>` routing with cloud fallback and mid-answer continuation | `apps/gateway` |
| https://pool.visualia.space/join | "Join the pool": a browser tab does AI work for everyone in the pool (WebLLM: Qwen2.5 1.5B, Qwen3 4B, or Qwen3.5 9B as `pool/qwen3.5-9b`, tabs only for jobs that fit 4,096 tokens); outbound only. Built, not deployed: `/app/update/…`, `/app/files/…` (R2 `visualia-pool-app`) and `/app/models` (`src/models.js`) | `apps/pool` |
| https://mcp.visualia.space/mcp | MCP server, step 1 read-only: `list_work`, `get_project`, `read_chat`, `usage_summary`; sign-in by OAuth with the course key on its own page; reads through the studio's `ForMcp` entrypoint and visibility rules | `apps/mcp`, `plans/mcp.md` |
| Visualia Pool (app) 0.3.0 | A 4.3 MB Tauri app, signed ad hoc (Rust: `pool-core`, `core` without I/O, builds to WASM too; the same code as the `visualia-pool-cli` program): checks for Ollama and links its download; the model list from the pool, checked against hard limits (8 models, 24 GB each, Ollama or hf.co tags, memory and free disk, a download stopped when bigger than listed, click only); Get with a percent, Remove (×) when out of the pool; Clef-flash made from its GGUF; machine and live lines; "Work done" table; starts with the computer and joins while a key is saved; looks for updates at start and every 6 hours, installs on a click (signed with our key; off with `defaults write space.visualia.pool Updates off`). Each new unsigned build asks for keychain access once, at the machine | `apps/pool-app`, `plans/worker-app.md` |
| https://probe.visualia.space | "What can my computer run?" + in-browser speed test | `apps/probe` |

Cloudflare (personal account, Workers Paid): D1 `visualia` (migrations 0001–0013
applied), R2 `visualia-projects` (and `visualia-pool-app`, not created yet), AI Gateway
`visualia`, Images binding, Browser Rendering, zone `visualia.space`.
`workers_dev` off everywhere.

Default page model: DeepSeek V4.1 Flash (`@cf/deepseek-ai/deepseek-v4.1-flash-1017`,
20 requests/min per account); fallback Gemma 4 26B (checked live for
multi-file: works, twice as slow, one garbled word). Instructions v0.4
(`schools/eka/instructions.md`), bundled at studio deploy.

## Machines

| | What it does | Notes |
|---|---|---|
| **M2 Pro, work Mac (32 GB)** | Ollama 0.40.8 (Homebrew), `qwen3.5:9b`, `gemma4:26b`, `clef-flash-8k`; in the pool as `eka-teacher` with `visualia-pool-cli` while a session runs it; Rust 1.96 (Homebrew rustup); the update key | ThreatLocker killed new binaries until at least 2026-10-23 (the Rust worker, the app, workerd 1.20261006+: exit 137); on 2026-11-02 it blocked nothing, and the Rust program runs here (`visualia-pool-cli`; the Node worker is retired). Homebrew Python, uv, PyTorch (MPS) and MLX run. Gemma 4 26B makes pages locally. Heats to 70–80 °C under load |
| **M1 Pro, home (16 GB)** | Ollama 0.40.5 (own LaunchAgent), Clef-flash 8k, mflux, six embedding models, Rust (1.99); the **Visualia Pool app 0.3.0** in `/Applications`, key in the keychain, its own login item (`--join`): `pool/qwen3.5-9b`, `pool/clef-flash` | SSH `mbp` on the home LAN only: from the work Mac, **turn the work VPN off** first (with it on, 192.168.1.241 times out). No inbound route. Apps are built on the work Mac and copied (`apps/m1-worker/README.md`). After a restart on 2026-11-02 the 0.2.0 app had exited at login; watch whether 0.3.0 survives the next one. Screen capture over SSH is refused |
| **Browser tabs** | WebLLM on WebGPU | Up to Qwen3.5 9B (5 GB, ~11 tok/s on the M2, usable Estonian); no tool calls yet; no Estonian on the 1.5B |

Same speed on M1 and M2: token generation is memory-bandwidth bound (both 200
GB/s); the M2's gain is memory size.

## Keys

`XXXX-XXXX`, SHA-256 hashed. Live keys in `.keys.local` (gitignored, chmod
600): `eka-teacher`, `eka-test-001`, `eka-test-002`, `m1-1` (the M1 worker). New key:
`node apps/gateway/add-key.mjs <person> [school] [role]`. People are shown by id
(teacher's choice for now). The app's update key: `~/.config/visualia/pool-updater.key`
(public half in `apps/pool-app/src-tauri/tauri.conf.json`).

## How to deploy and push

- `cd apps/<app> && npm run deploy` (studio copies `visualia.css`,
  `packages/text`, `instructions.md` first; every app
  runs the text check, which fails on a missing or unused key). Gateway: `npx wrangler deploy`.
  D1: `npx wrangler d1 migrations apply visualia --remote` from `apps/gateway`.
- The pool app: `cd apps/pool-app`, build with
  `TAURI_SIGNING_PRIVATE_KEY=~/.config/visualia/pool-updater.key TAURI_SIGNING_PRIVATE_KEY_PASSWORD= npm run build`,
  then `node publish-update.mjs --notes "…"` (after the pool is deployed).
  Models change in `apps/pool/src/models.js` (a pool deploy, plus the gateway
  for its allowlist), not in the app.
- After a studio deploy wait ~30 s before testing (Durable Objects can serve the
  old version briefly; that caused the "missing match score" scare).
- Push with the personal GitHub account: `gh auth switch -u kristjanjansen`,
  push, switch back to `Kristjan-Jansen_enefit`. Repo `visualia/visualia`
  answers anonymous requests (public; see "Right now"). No Claude attribution
  in commits.
- esbuild overridden to 0.28.1, workerd to 1.20260701.1 (newer ones are killed
  here; local dev with `--compatibility-date 2026-07-08`). Network commands
  need the sandbox disabled.

## Testing rules

- Never type course keys into a browser on the live site. Node scripts, and
  Playwright with the session cookie set from a script (scratchpad has
  `checktest`, `classtest`, `vistest`, `walllive`, `pool2-e2e`, …).
- Two-person checks with `eka-test-001` / `eka-test-002`.
- Live test leftovers: test messages in the class chat (kept on purpose), test
  projects and private remixes (no delete endpoint yet).
- Local checks: `wrangler dev` with the role (studio, projects, preview) on
  localhost, seeded D1/R2 and two local keys; scripts in the scratchpad
  (`mf2/dev.sh`, `studio.mjs`, `boards.mjs`, `boardui.mjs`, `home.mjs`).
  Playwright on localhost takes the `__Host-` cookie with `secure: true`.
- Heat on the M2: one run at a time, pause between runs, stop above 85 °C.

## Decisions the teacher made (keep them)

- AI Gateway payload logging stays on (2026-10-22).
- Words: every word people read lives in the app's `text.json` (shared
  `packages/text`); load the `visualia-writing` skill before writing any.
  Universal, communal wording ("everyone in the pool"), never "classmates" on
  the pool or app; "work", not "jobs" or "questions"; never "the cloud".
- Decide stays cloud-or-pool with models loaded on demand; nothing kept warm.
- Visualia Pool app: Rust worker, no bundled runtime; Ollama is a separate
  download from its maker (the app links it); metadata says only "an
  educational tool" (no EKA). Labs: the tab first; the app where IT deploys it.
- MCP is for everyone in the course from the start. Tentative yes, to confirm
  with the class before step 2: MCP changes count against budgets; outside
  agents may act on shared works, credited and undoable.
- UI: black sans on white, two sizes, two weights, two inks, three spaces, boxed
  fields, no bold UI text; minimal wording; phone first.
- UI in English only; no Estonian translation (2026-10-23). Models still
  take and write Estonian (briefs, page text).
- The class is peers: no teacher tools; everyone sees the same data.
- Projects start private; "Share with class"; publish is owner-only.
- Usage visible to everyone (ids, no prompt text, private titles hidden).
- Pool: outbound only, auditable, open source eventually; "Join the pool".
- `research/` holds general material (reading list, studies); course material
  stays in `schools/<slug>/docs/`.
- No timelines in plans.
- The board is a living experiment, built type by type: first with the teacher
  (types and primitives, AI sight, MCP), then with the students. Surface, not
  flow; many boards per school; text first (2026-10-23). The first board is
  cleared.
- One colour: `--select` (#0d99ff, the original Visualia board's blue) for
  what is selected or edited on a board, nothing else (`plans/style.md`).
- Every project is a folder of files; no single-file mode (2026-10-23).
- Local video dropped (Kandinsky: NVIDIA-only, 26.7 GB; `plans/local-video.md`).
- Keep Ollama for text. Lemonade and LocalAI not adopted
  (`research/local-runners.md`); pictures stay in the cloud for now.
- Visualia and positron share small pieces, never merge (2026-11-02,
  `research/positron.md`).
- `plans/backstage.md` is standing: inference about a student's process only
  on the student's request, backstage private by default (2026-11-02).
- The pool app updates only on a click, from pool.visualia.space, signed with
  our own key; IT can turn it off. No channel per school until a second school
  needs one (2026-11-02).
- One model list, sent by the pool; the app's hard limits only change with an
  app update; nothing downloads or is removed without a click (2026-11-02).
- The Node worker is retired; `visualia-pool-cli` or the app on every Mac
  (2026-11-02).
- No middots in the app: things side by side get a wide space; Remove is a ×
  without underline (2026-11-02).

## Open / next

0. **This stretch** (see "Right now"): deploy and publish 0.4.0; run the old
   image models before 2026-11-20; the Estonian visuals first version
   (`evals/estonian-visuals` harness on the 10 EKI prompts, judges, the
   playground page); unified billing; a pool `image` job (stable-diffusion.cpp
   or a Burn SD-Turbo port); Burn next for background removal or picture
   embeddings (`plans/local-images.md`, the background read in the worklog).

1. **Deploy and publish** (see "Right now"), then the first real update test
   on a live install: publish 0.3.1 and click Update on the M1.
2. **The M1:** whether the app survives a restart.
3. **Boards** (`plans/boards.md`): the teacher picks the next type or idea
   (images was the suggestion); `plans/board-sight.md` for AI sight. Not
   built: presence, undo, removing or renaming a board.
4. **Signed-in checks on the live site:** a board with two people, and an old
   single-page project (open, change, publish).
5. **Pool app, the rest** (`plans/worker-app.md` Next): signing with a Developer
   ID and CI (the update key into a GitHub secret then), Windows (NSIS target),
   the version in the pool's hello. Bundled Ollama stays off (decision).
6. **Words:** the studio's server-side error texts still to move into
   `text.json` (`plans/studio-core.md`).
7. **MCP:** step 2 (make) after the class agrees (`plans/mcp.md`).
8. **Multi-file:** tools through a pool worker, so local Gemma 4 26B can do
   page turns; asset upload; hand-editing files.
9. **Pool, next kinds of work:** embeddings (BGE-M3, `research/embeddings.md`)
   is the smallest step; pictures wait for the GeForce lab PCs; SVG through
   the page model with a render check (`research/svg-generation.md`).
10. Before real students: proper login (EKA OIDC?), budgets per student, a
    delete for projects.
11. New ideas from the chat (`plans/README.md`): `board-sight`, `taste-rules`,
    `small-data`; research in `research/canvas-agents.md`, `taste.md`,
    `small-data.md`; EKA's `RIGHTS.md` and `DRIFT.md`. Gemma 4 26B sees
    images but grouped by proximity right 1 time in 3; Clef-flash answers
    typed board questions in ~2 s warm (`worklog/2026-11.md`).
12. Speech, rate limits, positron: as before (`research/models-2026-10.md`,
    `research/positron.md`).
