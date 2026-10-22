# Handoff

Written 2026-10-21, rewritten 2026-10-22 (end of the third stretch: class space,
private projects, board, remix, pool, M2, multi-file step 0). Read this, then
`plans/README.md` (the board and backlog) and the bottom of `worklog/2026-10.md`.

## Right now

Updated 2026-10-22 (fourth stretch):
- **M1 is a pool worker**; tunnel, proxy and the `m1-1/` route are gone;
  `/v1/decide` goes `pool/clef-flash` → Workers AI Clef, loaded on demand (no
  warm-keeping, the teacher's call). Left: delete the `m1-1.visualia.space`
  DNS record in the dashboard.
- **Multi-file**: browser checks done (`plans/multi-file.md` "Browser
  checks"). Open: the Gemma fallback live, which needs a brief studio deploy
  with `PAGE_MODEL` = Gemma 4; ask the teacher first.
- **Worker in Rust** (`apps/worker-app`, `plans/worker-app.md`): the
  `visualia-worker` program (the M1's LaunchAgent runs it) and a 3.6 MB app;
  next signing, macmon, Ollama as a separate download. The work Mac's
  ThreatLocker kills the binary, so the M2 keeps `apps/pool/worker-node.mjs`.
- **Embeddings** measured (`research/embeddings.md`): BGE-M3; next an
  embeddings job kind in the pool.
- Rust (rustup) is on the M1 now. Six embedding models are pulled there too.

## What exists and is live

| Address | What | Code |
|---|---|---|
| https://studio.visualia.space (also visualia.space) | The studio. Home: the class chat (permanent, presence) and "Everyone's work" as the live board (canvas / newest first / by person; groups, moves, per-person undo, "Put with…" on phones), plus "Your private projects". A project: describe → live preview → change → versions → publish; errors with auto-fix; "matches the request %" judged from a 375 px screenshot; pictures generated in pages; remix with credit; Share with class / Make private. `/usage` for everyone | `apps/studio` |
| https://projects.visualia.space/<person>/<slug>/ | Published projects, CSP sandbox; only the pictures the published version uses | `apps/studio` |
| https://gw.visualia.space | Gateway: every model call, `usage` rows in D1 (cost, energy, `served_by`, `served_kind`); `/v1/images` (FLUX.2 klein 4B); `/v1/decide` (Clef-flash: `pool/clef-flash` on a node worker, else cloud); `pool/<model>` routing with cloud fallback and mid-answer continuation | `apps/gateway` |
| https://pool.visualia.space/join | "Join the pool": a browser tab serves classmates' small jobs (WebLLM Qwen2.5-1.5B or Qwen3-4B); outbound only | `apps/pool` |
| https://probe.visualia.space | "What can my computer run?" + in-browser speed test | `apps/probe` |

Cloudflare (personal account, Workers Paid): D1 `visualia` (migrations 0001–0011
applied), R2 `visualia-projects`, AI Gateway
`visualia`, Images binding, Browser Rendering, zone `visualia.space`.
`workers_dev` off everywhere.

Default page model: DeepSeek V4.1 Flash (`@cf/deepseek-ai/deepseek-v4.1-flash-1017`,
20 requests/min per account); fallback Gemma 4 26B. Instructions v0.4
(`schools/eka/instructions.md`), bundled at studio deploy.

## Machines

| | What it does | Notes |
|---|---|---|
| **M2 Pro, work Mac (32 GB)** | Ollama 0.40.8 (Homebrew; ThreatLocker allowed it), `qwen3.5:9b`, `gemma4:26b`; macmon | Gemma 4 26B makes pages locally (5/5, 29 s, 0.14 Wh) and does multi-file tool calls. Joins the pool with `VISUALIA_KEY=… node apps/pool/worker-node.mjs` (outbound, measured energy, cools down between jobs). Heats to 70–80 °C under load. ~55 GB disk free |
| **M1 Pro, home (16 GB)** | Ollama 0.40.5, Clef-flash 8k, mflux images; pool worker (LaunchAgent, person `m1-1`): `pool/qwen3.5-9b`, `pool/clef-flash` | SSH `mbp` only on the home LAN. No inbound route any more (tunnel retired 2026-10-22). Setup in `apps/m1-worker/README.md` |
| **Browser tabs** | WebLLM on WebGPU | Small jobs only; no tool calls; no Estonian on the 1.5B (`research/browser-models.md`) |

Same speed on M1 and M2: token generation is memory-bandwidth bound (both 200
GB/s); the M2's gain is memory size.

## Keys

`XXXX-XXXX`, SHA-256 hashed. Live keys in `.keys.local` (gitignored, chmod
600): `eka-teacher`, `eka-test-001`, `eka-test-002`, `m1-1` (the M1 worker). New key:
`node apps/gateway/add-key.mjs <person> [school] [role]`. People are shown by id
(teacher's choice for now).

## How to deploy and push

- `cd apps/<app> && npm run deploy` (studio copies `visualia.css`,
  `instructions.md`, `packages/board/src` first). Gateway: `npx wrangler deploy`.
  D1: `npx wrangler d1 migrations apply visualia --remote` from `apps/gateway`.
- After a studio deploy wait ~30 s before testing (Durable Objects can serve the
  old version briefly; that caused the "missing match score" scare).
- Push with the personal GitHub account: `gh auth switch -u kristjanjansen`,
  push, switch back to `Kristjan-Jansen_enefit`. Repo `visualia/visualia` is
  private. No Claude attribution in commits.
- esbuild overridden to 0.28.1. Network commands need the sandbox disabled.

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

- UI: black sans on white, two sizes, two weights, two inks, three spaces, boxed
  fields, no bold UI text; English for now; minimal wording; phone first.
- The class is peers: no teacher tools; everyone sees the same data.
- Projects start private; "Share with class"; publish is owner-only.
- Usage visible to everyone (ids, no prompt text, private titles hidden).
- Pool: outbound only, auditable, open source eventually; "Join the pool".
  Worker app: Tauri, engine = bundled Ollama (MLX on Macs), not Deno.
- `research/` holds general material (reading list, studies); course material
  stays in `schools/<slug>/docs/`.
- No timelines in plans. MCP only at the edges (later).

## Open / next

1. **Resume multi-file** from the paused note (`plans/multi-file.md`). DeepSeek
   runs the loop, Gemma 4 (tool_choice required, edit guard) on 429. Backlog:
   remove single-file mode once multi-file works on all page models.
2. Tools through the pool's node worker so the M2's Gemma 4 26B can serve
   multi-file locally.
3. Board: notes and presence (step 5), far-zoom canvas, motion previews.
4. Before real students: AI Gateway payload logging off, proper login (EKA
   OIDC?), budgets per student, a delete for projects.
5. Speech to text for briefs (Parakeet in the tab, or cloud), Estonian
   read-aloud (Piper).
6. M1: done (worker in, tunnel out). Left: delete the `m1-1.visualia.space` DNS record in the dashboard.
7. MCP server (`mcp.visualia.space`): read-only first; write it up as a plan.
8. Positron video rooms: plan and first piece in `~/personal/positron`
   (uncommitted there); a prompt for another agent was handed to the teacher.
