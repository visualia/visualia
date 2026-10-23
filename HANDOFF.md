# Handoff

Written 2026-10-21, rewritten 2026-10-22 evening (end of the fourth stretch:
M1 into the pool, multi-file checked, the Visualia Pool app in Rust, every
word in text.json, a stronger tab, MCP read-only). Read this, then
`plans/README.md` (the board and backlog) and the bottom of
`worklog/2026-10.md`.

## Right now

- Everything is committed and pushed; nothing local is running. The M1 runs
  the Visualia Pool app from login (in the pool as `m1-1`).
- **Waiting on the teacher's ThreatLocker request** for
  `~/Applications/Visualia Pool.app` on the work Mac (an older build: it still
  has the start checkbox). Don't replace that copy: an approval may be by file
  hash. Once approved, find out whether it was by hash, path or name; by hash
  means every build needs a new request (then a Developer ID is worth it).
- **MCP step 1 works from a real AI tool** (checked 2026-10-23:
  `claude mcp add --transport http visualia https://mcp.visualia.space/mcp`,
  then `/mcp` to sign in in the browser with one's own key).
- The note for EKA IT is in Claude Docs
  (https://claude.ai/artifact/54RozP72WYmyQEsSBixY8W), tab-only; not sent yet.

## What exists and is live

| Address | What | Code |
|---|---|---|
| https://studio.visualia.space (also visualia.space) | The studio. Home: the class chat (permanent, presence) and "Everyone's work" as the live board (canvas / newest first / by person; groups, moves, per-person undo, "Put with…" on phones), plus "Your private projects". A project: describe → live preview → change → versions → publish; errors with auto-fix; "matches the request %" judged from a 375 px screenshot; pictures generated in pages; remix with credit; Share with class / Make private. `/usage` for everyone | `apps/studio` |
| https://projects.visualia.space/<person>/<slug>/ | Published projects, CSP sandbox; only the pictures the published version uses | `apps/studio` |
| https://gw.visualia.space | Gateway: every model call, `usage` rows in D1 (cost, energy, `served_by`, `served_kind`); `/v1/images` (FLUX.2 klein 4B); `/v1/decide` (Clef-flash: `pool/clef-flash` on a node worker, else cloud); `pool/<model>` routing with cloud fallback and mid-answer continuation | `apps/gateway` |
| https://pool.visualia.space/join | "Join the pool": a browser tab does AI work for everyone in the pool (WebLLM: Qwen2.5 1.5B, Qwen3 4B, or Qwen3.5 9B as `pool/qwen3.5-9b`, tabs only for jobs that fit 4,096 tokens); outbound only | `apps/pool` |
| https://mcp.visualia.space/mcp | MCP server, step 1 read-only: `list_work`, `get_project`, `read_chat`, `usage_summary`; sign-in by OAuth with the course key on its own page; reads through the studio's `ForMcp` entrypoint and visibility rules | `apps/mcp`, `plans/mcp.md` |
| Visualia Pool (app) | The pool worker as a 3.7 MB Tauri app (Rust worker, `core` without I/O, builds to WASM too): checks for Ollama and links its download, downloads models with a percent, machine line (chip, memory, MLX enabled), live line (memory, temperature with the max, power), work in Wh, starts with the computer and joins while a key is saved. Unsigned | `apps/worker-app`, `plans/worker-app.md` |
| https://probe.visualia.space | "What can my computer run?" + in-browser speed test | `apps/probe` |

Cloudflare (personal account, Workers Paid): D1 `visualia` (migrations 0001–0012
applied), R2 `visualia-projects`, AI Gateway
`visualia`, Images binding, Browser Rendering, zone `visualia.space`.
`workers_dev` off everywhere.

Default page model: DeepSeek V4.1 Flash (`@cf/deepseek-ai/deepseek-v4.1-flash-1017`,
20 requests/min per account); fallback Gemma 4 26B (checked live for
multi-file: works, twice as slow, one garbled word). Instructions v0.4
(`schools/eka/instructions.md`), bundled at studio deploy.

## Machines

| | What it does | Notes |
|---|---|---|
| **M2 Pro, work Mac (32 GB)** | Ollama 0.40.8 (Homebrew; ThreatLocker allowed it), `qwen3.5:9b`, `gemma4:26b`; macmon | ThreatLocker kills new binaries (the Rust worker, the app: exit 137), so it joins with `VISUALIA_KEY=… node apps/pool/worker-node.mjs` (Homebrew Node is allowed). Gemma 4 26B makes pages locally. Heats to 70–80 °C under load |
| **M1 Pro, home (16 GB)** | Ollama 0.40.5 (own LaunchAgent), Clef-flash 8k, mflux, six embedding models, Rust; the **Visualia Pool app** in `/Applications`, key in the keychain, its own login item (`--join`): `pool/qwen3.5-9b`, `pool/clef-flash` | SSH `mbp` on the home LAN. No inbound route (tunnel and DNS record gone). Build there in `~/visualia-build` (rsync `apps/worker-app`, `packages/style`, `packages/text`); setup in `apps/m1-worker/README.md`. Screen capture over SSH is refused |
| **Browser tabs** | WebLLM on WebGPU | Up to Qwen3.5 9B (5 GB, ~11 tok/s on the M2, usable Estonian); no tool calls yet; no Estonian on the 1.5B |

Same speed on M1 and M2: token generation is memory-bandwidth bound (both 200
GB/s); the M2's gain is memory size.

## Keys

`XXXX-XXXX`, SHA-256 hashed. Live keys in `.keys.local` (gitignored, chmod
600): `eka-teacher`, `eka-test-001`, `eka-test-002`, `m1-1` (the M1 worker). New key:
`node apps/gateway/add-key.mjs <person> [school] [role]`. People are shown by id
(teacher's choice for now).

## How to deploy and push

- `cd apps/<app> && npm run deploy` (studio copies `visualia.css`,
  `packages/text`, `instructions.md`, `packages/board/src` first; every app
  runs the text check, which fails on a missing or unused key). Gateway: `npx wrangler deploy`.
  D1: `npx wrangler d1 migrations apply visualia --remote` from `apps/gateway`.
- After a studio deploy wait ~30 s before testing (Durable Objects can serve the
  old version briefly; that caused the "missing match score" scare).
- Push with the personal GitHub account: `gh auth switch -u kristjanjansen`,
  push, switch back to `Kristjan-Jansen_enefit`. Repo `visualia/visualia` is
  private. No Claude attribution in commits.
- esbuild overridden to 0.28.1, workerd to 1.20260701.1 (newer ones are killed
  here; local dev with `--compatibility-date 2026-07-08`). Network commands
  need the sandbox disabled.

## Testing rules

- Never type course keys into a browser on the live site. Node scripts, and
  Playwright with the session cookie set from a script (scratchpad has
  `checktest`, `classtest`, `vistest`, `walllive`, `pool2-e2e`, …).
- Two-person checks with `eka-test-001` / `eka-test-002`.
- Live test leftovers: test messages in the class chat (kept on purpose), test
  projects and private remixes (no delete endpoint yet), a board group
  "Test 08:28 b".
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

## Open / next

1. **Words:** the studio's server-side error texts still to move into
   `text.json` (`plans/studio-core.md`).
2. **MCP:** step 1 works from a real AI tool; step 2 (make) after the class
   agrees (`plans/mcp.md`).
3. **Visualia Pool app:** signing (Apple Developer ID, the teacher's
   decision), macmon bundled, Windows; the ThreatLocker answer decides how
   urgent signing is.
4. **Tabs:** multi-file work on tabs (`plans/pool.md` "Next"); test the 9B on a
   GeForce lab PC.
5. **Multi-file:** single-file mode removed and deployed (2026-10-23;
   migration 0012 dropped `projects.kind`). Published old pages checked live;
   still to check signed in: an old project opens, a change, publish
   (`plans/multi-file.md`).
6. Before real students: proper login (EKA OIDC?), budgets per student, a
   delete for projects.
7. Board: notes and presence, far-zoom canvas; group suggestions from BGE-M3
   (`research/embeddings.md`) as an embeddings job kind.
8. Speech to text for briefs, Estonian read-aloud.
9. What to take from positron (its own project now, not a Visualia item):
   `research/positron.md`.
