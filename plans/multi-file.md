---
status: building
---

# Multi-file projects

The studio makes one HTML file per version. The teacher wants more: several
pages, images and sound, shared CSS/JS modules, later npm packages and a build
step, 3D/WebXR scenes, small backends with storage. This plan looks at
`@cloudflare/computer` 0.6.0 and `@cloudflare/think` 0.21.0 as the basis, says
what to take and what to leave, and lays out a migration that keeps everything
that works today (gateway, usage, versions, publish, error surfacing, auto-fix,
instructions).

Research was done by reading the packed packages (`dist/*.d.ts`), the
`cloudflare/computer` repo (README, `docs/`, `packages/computer/src`, CHANGELOG)
and the `cloudflare/agents` repo (`packages/think/src`, `packages/agents/src/chat`,
`docs/think`, examples `workspace-chat`, `vue-chat`, `worker-bundler-playground`,
`dynamic-workers*`, `sandbox-coding-agent`, `think-*`), plus the Cloudflare docs.

## Recommendation in one paragraph

**Take Computer's `Workspace` and its tools; don't take Think yet.** Put a
`Workspace` inside the existing `StudioAgent` (plain `agents` `Agent`), give the
model Computer's file tools through `createPiTools()` (plain JSON Schema
declarations + one `execute()` function, no AI SDK), and run our own short tool
loop through the gateway exactly as today. Serve the working files for preview
from the agent on a separate origin (`preview.visualia.space`), keep versions
as content-addressed snapshots in R2, and publish by pointing at a snapshot.
Static multi-file first; npm packages via import maps and a CDN (no build);
Dynamic Workers with `@cloudflare/worker-bundler` only when a project needs a
build or a backend. Think stays the option for later (durable long turns,
skills, sub-agents) once its client and its Workers AI path through our gateway
are proven.

## What the student gets, in steps

| Step | What a student can make | What it needs |
|---|---|---|
| 1. Multi-file static | several pages, `style.css`, `main.js`, JS modules | Workspace, file tools, preview server, snapshot versions, multi-file publish |
| 2. Assets | own images and sounds, used by the page | upload into the Workspace (binary), size caps |
| 3. Libraries | three.js, p5, tone.js, d3 as ES modules | import map + esm.sh/jsDelivr in the instructions; CORS headers on preview and publish |
| 4. 3D / WebXR | scenes with models and textures | step 2 + permissions (`xr-spatial-tracking`) on the preview iframe; test on a headset |
| 5. Build step | npm packages that need bundling, JSX, TypeScript | `@cloudflare/worker-bundler` `createApp` in a Dynamic Worker (experimental) |
| 6. Small backends | a guestbook, shared scores, a form | Dynamic Worker running the project's server code, storage via a DO facet (the VibeSDK pattern) |

Steps 1–3 cover most of what art students make. 5 and 6 are their own plans.

## 1. `@cloudflare/computer` 0.6.0

### What `Workspace` is

A filesystem inside a Durable Object, stored in the DO's own SQLite
(`new Workspace({ storage: this.ctx.storage })`). The schema
(`computer/docs/03_filesystem_schema.md`): `vfs_nodes` (inodes), `vfs_dirents`,
content-addressed chunks (`vfs_blobs` / `vfs_blob_bytes`, keyed by sha256, so
identical content is stored once), `vfs_chunks` mapping files to chunks of at
most **512 KiB**, plus `vfs_changes` for sync. Limits from the README: **~10 GB
per workspace** (shares the DO's storage); the in-container copy is held in
memory, so "agent-scale workspaces, not monorepos". Durable across DO restarts
and deploys.

File API (`dist/shared-C-sNJ-xg.d.ts`, `class WorkspaceFilesystem`), async,
absolute paths:

```ts
readFile(path): Promise<ReadableStream<Uint8Array>>
readFile(path, "utf8"): Promise<string>
readFile(path, { byteOffset?, byteLength?, encoding? })
writeFile(path, content: string | Uint8Array | ReadableStream, options?)
stat / lstat / readlink
readdir(path, { limit?, offset? }): Promise<{ name, parentPath, size, mtime, isFile, isDirectory, isSymbolicLink }[]>
find(dir, pattern?, { limit?, offset?, exclude? }): Promise<{ path, type: "file" | "dir" }[]>
grep(pattern, path, { ignoreCase?, regex?, context?, limit?, offset?, include?, exclude? })
mkdir(path, { recursive? }) / rm(path, { recursive?, force? }) / rename / chmod / symlink
```

`WorkspaceOptions` (`dist/index.d.ts`): `storage`, `backends`, `mounts`
(read-only `R2Bucket(...)` or `WorkerBundle(...)`), `git`, `defaultGitIdentity`,
`assets`, `artifacts`, `output`, `observer`.

### Reading and writing from our own code

Inside the agent: `this.workspace.fs.readFile(...)`. From the Worker (outside
the DO): mix in `withWorkspace(...)` and call `getWorkspace(stub)`, which
returns an RPC client (dispose it with `using`). For preview serving, the
simpler route is the agent's own `onRequest`, which already runs inside the DO.

### The tool set it gives a model

`computer/docs/09_tool_interface.md`, `dist/tools/*.d.ts`. Same names, schemas
and limits for three libraries: AI SDK (`createAITools`, `/tools/ai-sdk`), pi
(`createPiTools`, `/tools/pi-ai`), TanStack (`createTanStackTools`).

| Tool | Input | Notes |
|---|---|---|
| `read` | `{ path, offset?, byteOffset?, limit? }` | 2000 lines / 256 KiB per call; images and PDFs passed to vision models |
| `ls` | `{ path, limit?, offset? }` | 200 entries default |
| `find` | `{ path?, pattern, exclude?, limit?, offset? }` | globs `* ** ? {a,b}` |
| `grep` | `{ path?, query, include?, exclude?, regex?, ignoreCase?, context?, limit?, offset? }` | literal by default |
| `write` | `{ path, content }` | whole file, 2 MiB cap |
| `edit` | `{ path, edits: [{ oldText, newText }] }` | atomic batch, each `oldText` unique; fuzzy (whitespace, quotes) lookup; returns a unified diff |
| `delete` | `{ path, recursive? }` | |
| `exec` | `{ command, cwd?, env?, input?, backend? }` | only when the Workspace has a backend; `exec: {}` removes it |
| `publish` | | only when `assets` is configured (R2 presigned URL) |

Options that matter for us: `root: "/workspace"` confines every file tool to
one directory (`..` and symlinks refused); `readonly: true`; `exec: {}`.

**`createPiTools` is the piece that lets us keep our own loop.** It imports only
`zod` (checked in `dist/tools/pi-ai.js`) and returns

```ts
interface CreatePiToolsResult {
  tools: { name: string; description: string; parameters: JSONSchema /* type: "object" */ }[];
  execute: (call: { id: string; name: string; arguments?: unknown }) =>
    Promise<{ content: ({ type: "text"; text } | { type: "image"; data; mimeType })[]; isError: boolean; details?: unknown }>;
}
```

`execute` validates arguments against the schema and returns failures as
`isError: true` instead of throwing, so the model can retry and the loop never
breaks. The declarations map one-to-one onto OpenAI `tools`:

```js
const { tools, execute } = createPiTools({ workspace: this.workspace, root: '/workspace', exec: {} });
const openaiTools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
```

### Execution backends

| Backend | Status | Runs | Needs |
|---|---|---|---|
| `WorkerJavaScriptBackend` | stable | an ES module in a fresh Dynamic Worker, with Workspace-backed `node:fs/promises`, durable relative imports, host modules `ws:git`, `ws:assets`, `ws:tools`; 3 min max per run | Worker Loader binding (`worker_loaders`) |
| `WorkerShellBackend` | experimental | shell commands via just-bash in a Dynamic Worker; optional groups (curl, python, sqlite, jq…) | Worker Loader, `experimental` compat flag, `just-bash` |
| `ContainerBackend` | experimental | real Linux (npm, node) in a Container running `computerd`; files synced both ways over capnweb | Containers, `scheduling_policy: "durable_object"` |
| `LegacyContainerBackend` | deprecated | same, platform-scheduled | |

The container path syncs the DO's SQLite tree with the container's own VFS
(`push()`/`pull()`, watermarks, `docs/02_sync_protocol.md`), experimental. For
art students we need **no backend** in step 1–4: the model writes files, the
browser runs them. `exec` is a later question (a build, a script that
generates data), and then the stable JavaScript backend is the one to try.

### Git

`createGitClient()` from `@cloudflare/computer/git` (isomorphic-git on the
SQLite VFS, `pako` swapped for `node:zlib`, lazy-loaded): `init, add, commit,
log, diff, checkout, branch, reset --hard, clone, push, pull, stash, tag…`.
Gaps (`docs/13_git_interface.md`): `checkout` doesn't remove files that exist
only on the other branch; no `revert`, `cherry-pick`, `reset --soft`; no gc
([cloudflare/computer#68 Make gc() reachable so orphaned blobs and manifests are actually reclaimed](https://github.com/cloudflare/computer/issues/68)).
Good for "show me what changed"; not what versions should rest on (see data
model below).

### Without Think, in a plain `Agent`

Yes. `examples/workspace-chat/src/server.ts` in `cloudflare/agents` puts a
`Workspace` in an `AIChatAgent` (which extends `Agent`) and owns the model call
itself:

```ts
export class WorkspaceChatAgent extends AIChatAgent {
  workspace = new Workspace({ storage: this.ctx.storage, git: createGitClient(), backends: [ /* optional */ ] });
  async onChatMessage() {
    return streamText({ model, messages, tools: createAITools({ workspace: this.workspace }), stopWhen: isStepCount(10) })
      .toUIMessageStreamResponse();
  }
}
```

Our `StudioAgent` can do the same with no AI SDK at all (pi tools + our gateway
stream). Requirements already met: SQLite-backed DO, `nodejs_compat`.

### Maturity

- 14 releases since the first; 0.6.0 is a day old. The README marks
  `Workspace`, the SQLite layer, the tools, git and the JavaScript backend
  **stable**; containers, worker-shell and the sync protocol experimental.
- Breaking changes landed in minors: 0.5.0 moved `createAITools` to
  `/tools/ai-sdk`, reshaped the `exec` options, stopped installing `ws:git` by
  default, and required a default export in isolate JS; 0.6.0 made
  `getWorkspace()` lazy and removed `useThink`. Pin exactly (we do).
- Open issues that touch us:
  [cloudflare/computer#68 Make gc() reachable so orphaned blobs and manifests are actually reclaimed](https://github.com/cloudflare/computer/issues/68),
  [cloudflare/computer#67 Prune acknowledged tombstones from vfs_changes so the table stops growing without bound](https://github.com/cloudflare/computer/issues/67)
  (storage creeps up on long-lived projects; another reason not to keep history
  in the Workspace),
  [cloudflare/computer#217 Offload large files (4 MB+) to R2](https://github.com/cloudflare/computer/issues/217)
  (today all bytes live in DO SQLite),
  [cloudflare/computer#261 Export one file helper over workspace.fs](https://github.com/cloudflare/computer/issues/261).
- `docs/` is "forward-looking — read it for intent, not as a description of the
  code today"; the `.d.ts` files are the truth.

## 2. Think 0.21.0

### What it adds over a plain `Agent`

| Feature | Value for us |
|---|---|
| Agent loop: `getModel()`, `getTools()`, `maxSteps` (10), hooks `beforeTurn`, `beforeStep`, `beforeToolCall`, `afterToolCall`, `onStepFinish`, `onChunk`, `onChatResponse` | saves writing the loop (~150 lines for us) |
| Workspace built in (`this.workspace`, `createAITools` merged into every turn) | same tools we'd use anyway |
| Durable turns: recovery fibers, resumable streams, `chatRecovery`, stall watchdog | matters for minute-long turns; ours are 10–60 s |
| Sessions: tree history, compaction, FTS search, context blocks | nice later; our history is short |
| Skills (`getSkills()`, `activate_skill`, `run_skill_script`) | fits the "skills on demand" idea in HANDOFF |
| Client tools, approvals, sub-agents, messengers, scheduled tasks | not needed now |

### Hard requirements

`package.json` of 0.21.0: peers `ai@^7`, `agents >=0.28 <1`, `zod@^4`,
**`@cloudflare/computer@^0.5.1`** (which excludes 0.6.0, though Computer 0.6.0's
changelog says "Think 0.21 and later take a Workspace as it is"; npm will need
an `overrides` entry or 0.5.1). Dependencies it brings: `@ai-sdk/anthropic`,
`@ai-sdk/openai`, `@cloudflare/codemode`, `chat`, `workers-ai-provider`. React
is an optional peer. Docs still list `ai` v6 by mistake
([cloudflare/agents#2647 Think docs: the dependency table lists ai as v6, but think requires ai@^7](https://github.com/cloudflare/agents/issues/2647)).
Marked **experimental**; 0.20.0 and 0.21.0 both had breaking minors (AI SDK v7,
workspace swapped to Computer, `createWorkspaceTools` removed).

### Model through our gateway

`getModel()` may return a `LanguageModel`, so the gateway can stay in the path.
`@ai-sdk/openai-compatible@3.0.75` is built on the same `@ai-sdk/provider@4.0.31`
as `ai@7.0.148`:

```js
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

getModel() {
  const gw = createOpenAICompatible({
    name: 'visualia',
    baseURL: 'https://gateway/v1',
    includeUsage: true,
    headers: { 'x-visualia-person': this.state.personId, 'x-visualia-project': this.name },
    fetch: (url, init) => this.env.GATEWAY.fetch(url, init), // service binding, entrypoint Trusted
  });
  return gw.chatModel(this.env.PAGE_MODEL);
}
```

Every step is then one gateway call and one `usage` row, as now. **The catch:**
our gateway passes `env.AI.run` streams through untouched, and Workers AI
streams are not strict OpenAI. `agents/src/models/core/chat-completions/stream.ts`
documents it from live captures: per-delta `usage`, a `choices: []` heartbeat,
a native `{ response: "", usage }` tail, and for some models native
`{ response }` deltas or **top-level `tool_calls`**. Cloudflare's own example
for Gemma 4 reads `completion.tool_calls[0].name` and `.arguments.query` (an
object, not a JSON string), the non-OpenAI shape. Think's default path uses
`workers-ai-provider`, which normalizes this; `openai-compatible` does not. So
Think-through-gateway needs the gateway (or the fetch wrapper) to normalize to
strict OpenAI chunks, porting `stream.ts` (~250 lines). Our own loop needs the
same normalization, so this work is shared either way.

### What the browser must speak

Think and `AIChatAgent` share the `cf_agent_chat_*` protocol
(`packages/agents/src/chat/protocol.ts`, `wire-types.ts`), over the agent
WebSocket, beside the base `cf_agent_identity`, `cf_agent_state`,
`cf_agent_mcp_servers` frames.

| Direction | Type | Payload |
|---|---|---|
| client → server | `cf_agent_use_chat_request` | `{ id, init: { method: "POST", body: JSON.stringify({ messages, trigger: "submit-message", ... }) } }` |
| | `cf_agent_chat_request_cancel` | `{ id }` |
| | `cf_agent_stream_resume_request` / `_ack` | reconnect handshake |
| | `cf_agent_tool_result`, `cf_agent_tool_approval` | client tools, approvals |
| | `cf_agent_chat_clear` | |
| server → client | `cf_agent_chat_messages` | `{ messages: UIMessage[] }` (full history, on connect) |
| | `cf_agent_use_chat_response` | `{ id, body: <one UIMessageChunk as JSON>, done, error?, outcome?, seq?, replay? }` |
| | `cf_agent_stream_resuming` / `_resume_none` / `_pending` | resume state |
| | `cf_agent_message_updated`, `cf_agent_chat_recovering` | |

Tool calls stream as AI SDK `UIMessageChunk`s inside `body`: `tool-input-start
{ toolCallId, toolName }`, `tool-input-delta { inputTextDelta }`,
`tool-input-available { input }`, `tool-output-available { output }`. So file
writes are visible as they are typed, as partial JSON.

**Vanilla JS can consume it.** `examples/vue-chat` shows the framework-neutral
pair `AgentClient` (`agents/client`) + `WebSocketChatTransport`
(`agents/chat/transport`). Both load from esm.sh (checked:
`https://esm.sh/agents@0.29.0/client` and `/chat/transport` answer 200; ~125 KB
bundled client); jsDelivr's `+esm` fails on `node:async_hooks`. Without a
framework hook, use `ai`'s `readUIMessageStream` (exported, esm.sh ~370 KB) on
the stream `transport.sendMessages(...)` returns, or speak the table above
directly over a native `WebSocket` (about 100 lines; the resume handshake is the
fiddly part). Workable, but it is a second protocol and ~0.5 MB of client code
for a page that today has none.

## 3. Preview of a multi-file project

Today: the streamed HTML goes into a sandboxed `iframe srcdoc`. With several
files the iframe needs URLs for `style.css`, `main.js`, `img/stone.jpg`.

| Option | How | Security | Latency | Cost | Fit |
|---|---|---|---|---|---|
| **(a) Serve the Workspace over HTTP** | `preview.visualia.space/<project>.<sig>/<path>` → Worker → `StudioAgent.onRequest` → `workspace.fs.readFile` | separate origin + `CSP: sandbox allow-scripts` (opaque origin) + iframe `sandbox`; signed path | one DO hop per file, files in SQLite next to the code; no cache | DO requests only | **static multi-file, now** |
| (b) Dynamic Workers + worker-bundler | build with `createApp()` (esbuild-wasm in workerd), load with `env.LOADER.get(id, ...)`, serve assets with `handleAssetRequest`, rest to the isolate | isolate per app, `globalOutbound` control | first build seconds, cached by id | Workers Paid; 1,000 unique Dynamic Workers/month included, then $0.002 per worker per day, plus normal requests/CPU | **build step and backends, later** |
| (c) Bundle in the browser | esbuild-wasm or import maps in the student's tab; Service Worker or blob URLs | stays client-side; SW can't run in an opaque origin | fast after a ~10 MB wasm load | none | import maps yes; full bundling no (SW conflicts with the sandbox) |

How others do it:

- **VibeSDK** (`cloudflare/vibesdk`, `docs/architecture-diagrams.md`) moved off
  containers: Think runs the loop, a `SpaceDO` holds the workspace, Cloudflare
  Artifacts (git) holds restore points, previews are Dynamic Workers through a
  Worker Loader, and the generated app's Durable Object runs as a facet. Deploys
  go to Workers for Platforms.
- **`examples/worker-bundler-playground`** serves the built app from the agent's
  `onRequest` under `/preview/:name/`, and registers a **Service Worker** to
  rewrite absolute paths into that prefix. We can't use a SW in a sandboxed
  opaque origin, which is why we require relative paths instead (below).

Dynamic Workers: open beta since spring, Workers Paid only; a DO may have ten
Dynamic Workers in flight. `@cloudflare/worker-bundler` 0.2.6 says
"Experimental… not recommended for production" and only runs inside workerd.

**Recommendation: (a)** for steps 1–4. Details that make it work:

- **Relative paths only.** Published projects live under
  `projects.visualia.space/<person>/<slug>/`, a path prefix, so `/style.css`
  would break there anyway. Instructions say "link files with relative paths";
  the studio checks after each turn (`src="/`, `href="/"`, `from "/`) and
  reports it as a problem, which the existing auto-fix picks up.
- **CORS on every response** (`Access-Control-Allow-Origin: *`): a sandboxed
  document has an opaque origin, so `<script type="module">`, `fetch()` of JSON,
  `decodeAudioData` and three.js texture loads are cross-origin requests.
  Without the header modules and sounds fail silently. Same on published files.
- **Error reporter injected server-side** into every HTML response from the
  preview server (the same `REPORTER` script `project.html` adds today), so
  "Fix it" and auto-fix keep working across pages.
- **Signed path, not a cookie**: the preview host has no session (the studio
  cookie is `__Host-`, host-only). `/<projectId>.<hmac(projectId, SESSION_SECRET)>/`
  keeps drafts private enough; add an expiry if needed.
- **Live render while writing.** While the model streams `write` for an HTML
  file, decode the `content` string from the partial JSON arguments and put it
  in `srcdoc` as today, with `<base href="https://preview.visualia.space/<p>.<sig>/">`
  injected, so its CSS, JS and images load from the Workspace. When a CSS/JS
  file finishes, reload the iframe.
- **WebXR**: the iframe needs `allow="xr-spatial-tracking"`; test whether a
  CSP-sandboxed, opaque-origin page can start an immersive session on a Quest
  before promising it.
- A path-based origin needs no wildcard certificate (a second-level wildcard
  like `*.preview.visualia.space` isn't covered by the free certificate).

## 4. Model reliability for tool loops

All three models list function calling on their Workers AI pages, with `tools`
(1–128) and `tool_choice` (`none | auto | required`); DeepSeek also has
`parallel_tool_calls` (default true). None documents how tool calls stream.

| Model | Function calling | Context | Price in/out per M | Rate limit | Notes |
|---|---|---|---|---|---|
| DeepSeek V4.1 Flash (`@cf/deepseek-ai/deepseek-v4.1-flash-1017`) | yes; `reasoning_effort` none/low/high/max | 1M | $0.30 / $1.20 (cached $0.006) | **20 requests/min per account** (paid model; 50 with prepaid AI Gateway credits) | today's default; best pages in first-pages run 3 |
| Gemma 4 26B-A4B (`@cf/google/gemma-4-26b-a4b-it`) | yes; reasoning | 256K | $0.10 / $0.30 | 300/min | non-streamed tool calls come back in the native shape (`tool_calls[].name`, `arguments` as an object); id echoed with `-external` |
| Qwen 3.8 27B (`@cf/qwen/qwen3.8-27b`) | yes; reasoning low/medium/xhigh (default) | 262K | $0.45 / $3.20 | 300/min | slow in first-pages (41 s/page); thinks hard by default |

**The rate limit is the first problem, not quality.** A tool loop is several
model calls per turn. At 20 requests/min for the whole account, a class of 15
on DeepSeek with 3 calls per turn gets about 7 turns a minute between them. Ways
out: prepaid AI Gateway credits (50/min), Gemma 4 as the loop model, and loops
that finish in one or two calls (all files written in parallel in the first
call; end the turn after a write-only step instead of asking the model for a
closing sentence).

What to test (a new `evals/multi-file/`, modelled on `evals/first-pages/`, 2–3
runs each, through the gateway with a test key):

1. **Stream shape**: for each model, capture raw SSE with `tools` and
   `stream: true`. Do tool calls arrive as OpenAI `delta.tool_calls` with
   argument fragments, or whole at the end, or top-level? This decides whether
   live writing is possible per model.
2. **Valid calls**: share of calls whose arguments parse as JSON and pass the
   schema; large `content` strings (10–30 KB of HTML) escaped correctly.
3. **Multi-file in one step**: does the model emit 3+ `write` calls in one
   response (parallel), or one per step?
4. **Edits**: follow-up "make the title red" uses `edit` with an `oldText` that
   matches, rather than rewriting every file.
5. **Relative links**: pages link `style.css`, not `/style.css`.
6. **Stopping**: turns end on their own within the step cap; no loops of
   `ls`/`read`.
7. The existing four page checks (html, clean, visible, fits) on the served
   multi-file result, plus steps, calls, tokens, cost and time per turn.

## Capture (step 0)

Run 2026-10-22 with `evals/multi-file/capture.mjs` (raw SSE and a JSON summary
per call in `evals/multi-file/out/<model>/`, gitignored). Cloud models through
`gw.visualia.space` with eka-test-001, thinking off
(`chat_template_kwargs.enable_thinking: false`), `max_tokens` 8000 (16000 for
the big page); local `gemma4:26b` on Ollama 0.40.8 directly, thinking off, a
minute's pause between calls. Tools: `read`, `ls`, `write {path, content}`,
`edit {path, edits: [{oldText, newText}]}`, `delete` as plain OpenAI
functions. System prompt: write one call per file, all files in one reply,
`edit` for changes, relative links, no `ls`/`read` of files just written, stop
with one sentence. Each case is a loop of up to 6 calls over an in-memory file
system; 2 runs per case and model.

| Case | Brief | Options |
|---|---|---|
| auto | "A small site: index.html and about.html linking to each other, a shared style.css, and main.js showing the current time on both pages." | `tool_choice: auto`, `parallel_tool_calls: true` |
| required | same | `required` on the first call, `auto` after |
| serial | same | `auto`, `parallel_tool_calls: false` |
| edit | "Make the main heading red on both pages.", the auto case's four files given as `read` results | `auto` |
| big | one long `index.html` (40 invented artists, inline SVGs, "15–25 KB") + `style.css` | `auto`, 16000 tokens |

Gateway change for this (deployed): `parallel_tool_calls` added to `PASS`
(`tools` and `tool_choice` were already there; DeepSeek honoured `false`, so it
arrives), and the first `delta.tool_calls` (or a native top-level
`tool_calls`) now counts as the first token. The usage rows' `first_token_ms`
match the client's first tool delta (e.g. 740 ms vs 828 ms).

### 1. Stream shape

All three cloud models stream OpenAI `choices[0].delta.tool_calls[i]`, none
the native top-level shape. Every chunk carries a per-delta `usage`, and the
stream ends with the native `{ "response": "", usage }` tail before `[DONE]`.
They differ in how the arguments arrive.

| Model | Arguments | Key order | Quirks |
|---|---|---|---|
| DeepSeek V4.1 Flash | fragments (HTML ~20–30 chars each, 600–900 per 35–50 KB page); CSS/JS sometimes in one 1–1.5 KB fragment at the end of the reply | `path` first in 25/29 writes | |
| Gemma 4 26B (cloud) | with `required`: fragments (~150 per 600 B file). With `auto`: about half the calls come **whole in one delta at the end** (11 of 20 writes; a 39 KB page arrived in one piece after 194 s) | `required`: `path` first. `auto`: **keys alphabetical**, so `content` before `path` (and `edits` before `path`) | `index` is not a position: single calls come as `index: 2` or `3`; in the first attempt four calls of one reply all came as `index: 2` with different ids, and a client keyed on `index` merged them into one invalid call |
| Qwen 3.8 27B | fragments (small, ~3 chars) | `path` first, 25/25 | slow: ~45–50 tokens/s; the stream was **cut at 300 s** ("Network connection lost") on both big pages |
| gemma4:26b (Ollama) | every call whole, all in one chunk at the end | `content` first, 24/24 | `<` and `>` escaped as `<`/`>` (valid JSON) |

DeepSeek:

```
{"choices":[{"delta":{"tool_calls":[{"id":"chatcmpl-tool-a8fd…","type":"function","index":0,"function":{"name":"write"}}]}}],"usage":{"completion_tokens":12,…}}
{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"path\": \""}}]}}]}
{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"index.html"}}]}}]}
```

Gemma 4 (cloud, `auto`), the name first, then everything 4 s later:

```
{"choices":[{"delta":{"content":null,"tool_calls":[{"id":"call_d417…","index":2,"type":"function","function":{"name":"write","arguments":""}}]}}]}
{"choices":[{"delta":{"tool_calls":[{"id":null,"index":2,"type":"function","function":{"name":null,"arguments":"{\"content\": \"<!DOCTYPE html>\\n… \", \"path\": \"index.html\"}"}}]}}]}
```

Qwen 3.8: like DeepSeek, smaller pieces (`"{\"path\": \""`, `"index"`, …).
Ollama: one chunk per call with `id`, `name` and the complete `arguments`.

### 2. Several files in one reply

`write` calls per model call, for the four-file brief (runs 1 / 2).

| Model | auto (parallel true) | required (first call) | serial (parallel false) |
|---|---|---|---|
| DeepSeek | 4 / 4 | 4 / 4 | 1+1+1+1 / 1+1+1+1 |
| Gemma 4 (cloud) | 1+1+1+1 / 4 | 4 / 4 | 1+1+1+1 / 1+1+1+1 |
| Qwen 3.8 | 4 / 4 | 4 / 4 | 1+1+1+1 / 1+1+1+1 |
| gemma4:26b (Ollama) | 4 / 4 | 4 / 4 | 1+1+1+1 / 4 (ignored) |

All four write all files in one reply when asked; `parallel_tool_calls: false`
works on Workers AI for all three. Gemma on the cloud is the unreliable one
with `auto` (also 1+1+1+1 in the first test run); with `required` it was 4/4
every time (4 of 4, and 2 of 2 in the first attempt). Big page: DeepSeek wrote
`style.css` and `index.html` in one reply; Gemma one per call.

### 3. Valid calls

| Model | calls | parse as JSON | match the schema | big `write` content | failures |
|---|---|---|---|---|---|
| DeepSeek | 36 | 33 | 33 | 34, 41, 50 KB, all valid | 3 cut by `max_tokens` (16000) mid-string: the page came out at 41–67 KB, not 15–25 |
| Gemma 4 (cloud) | 30 | 30 | 30 | 39, 42 KB, valid | none |
| Qwen 3.8 | 29 | 27 | 27 | none finished | 2 cut by the 300 s stream limit (26 and 39 KB written so far) |
| gemma4:26b (Ollama) | 26 | 26 | 26 | not run to the end: GPU reached 85 °C after 217 s, stopped | |

No escaping problems: every finished call parsed, including 35 KB of HTML with
quotes, newlines and inline SVG, and a 35 KB `edit` `newText`. No double
escaping. The only invalid arguments are truncated ones. Two things for the
loop: **Workers AI rejects a request whose history holds an assistant tool call
with invalid JSON arguments** (Gemma: "Assistant tool call function.arguments
must be valid JSON"; Qwen: "Unterminated string"), so a cut call must go back as
`{}` with the error in its tool result; DeepSeek accepted it. And a model
recovers when told: DeepSeek, after two cut-off writes, wrote half the page and
appended the rest with `edit` (r1), or rewrote it shorter (r2).

### 4. Edits

All 12 edit turns used `edit` on `style.css` alone (the shared stylesheet, the
right file), `oldText` matched exactly once every time, no file was rewritten,
then one closing sentence. Correctness differs:

| Model | `oldText` matched | result |
|---|---|---|
| DeepSeek | 2/2 | the `h1` rule kept, `color` added |
| Qwen 3.8 | 2/2 | the `h1` rule changed or extended |
| Gemma 4 (cloud) | 2/2 | **wrong**: replaced an unrelated rule (`#clock {…}`, `main {…}`) with `h1 { color: red; }`, deleting those styles |
| gemma4:26b (Ollama) | 2/2 | r1 right; r2 replaced `main {…}` with `main h1 { color: red; }` |

So "matched" isn't enough to check: Gemma treats `oldText` as "a place to put
the new text". The eval needs a check that the rest of the file survived.

### 5. Relative links

Every file in every finished turn linked relatively (`style.css`, `main.js`,
`about.html`, `index.html`): 0 absolute links, 0 links to files that don't
exist, both pages linking each other, for all four models.

### 6. Stopping

Every turn ended on its own with one sentence and no tool call, right after the
last write or edit. No `ls` or `read` in any of the 39 turns, never near the cap
of 6. The closing sentence is the only extra call: ending the turn
after a write-only step (as §6's loop does) saves it.

### 7. Time, tokens and cost per turn

From the gateway's usage rows (cloud) and the client (Ollama), whole turn
including the closing sentence, runs 1 / 2.

| Model | Case | calls | seconds | tokens in (cached) | tokens out | cost |
|---|---|---|---|---|---|---|
| DeepSeek | auto | 2 / 2 | 8 / 11 | 2,960 (704) / 2,888 (1,408) | 1,349 / 1,283 | $0.0023 / $0.0020 |
| DeepSeek | serial | 5 / 5 | 16 / 14 | 8,682 (7,488) / 7,160 (6,336) | 1,671 / 1,189 | $0.0024 / $0.0017 |
| DeepSeek | edit | 2 / 2 | 2.3 / 3.2 | 4,325 / 4,202 | 175 / 173 | $0.0007 / $0.0006 |
| DeepSeek | big | 5 / 5 | 427 / 293 | 45k / 83k | 56k / 45k | $0.079 / $0.062 |
| Gemma 4 | auto | 5 / 2 | 11 / 6 | 4,976 / 1,921 | 747 / 725 | $0.0007 / $0.0004 |
| Gemma 4 | required | 2 / 2 | 12 / 16 | 1,887 / 1,887 | 710 / 720 | $0.0004 / $0.0004 |
| Gemma 4 | edit | 2 / 2 | 1.9 / 6.4 | 2,793 / 2,796 | 103 / 120 | $0.0003 / $0.0003 |
| Gemma 4 | big | 3 / 3 | 92 / 216 | 24k / 22k | 11k / 10k | $0.0058 / $0.0053 |
| Qwen 3.8 | auto | 2 / 2 | 22 / 57 | 2,714 / 3,436 | 1,010 / 1,735 | $0.0045 / $0.0071 |
| Qwen 3.8 | required | 2 / 2 | 44 / 24 | 3,355 / 2,835 | 1,647 / 1,126 | $0.0068 / $0.0049 |
| Qwen 3.8 | edit | 2 / 2 | 2.9 / 12 | 3,749 / 5,215 | 102 / 131 | $0.0020 / $0.0028 |
| gemma4:26b (Ollama) | auto | 2 / 2 | 32 / 33 | 1,996 / 2,087 | 804 / 882 | $0; 848 / 576 J net |
| gemma4:26b (Ollama) | required | 2 / 2 | 25 / 19 | 1,956 / 1,957 | 770 / 772 | $0; 529 / 351 J net |
| gemma4:26b (Ollama) | edit | 2 / 2 | 4.4 / 6.1 | 2,898 / 3,122 | 69 / 116 | $0; 82 / 97 J net |

The first token usually arrives in 0.3–0.8 s on Gemma and Qwen, 0.4–3 s on
DeepSeek, with occasional 6–22 s waits on Gemma and Qwen (queueing); Ollama
took 3–16 s (prompt processing on the Mac). DeepSeek's prompt cache
works across turns (most input cached from the second call on); Gemma and Qwen
showed almost none. Output speed on the big page: DeepSeek ~135 tokens/s,
Gemma 50–140, Qwen ~45.

**A gateway bug the big pages found:** the usage row keeps the *last* event's
`usage`. Workers AI sends a per-delta `usage` on every chunk and the totals
only in the tail, so a stream cut before the tail (Qwen at 300 s) was recorded
as `tokens_out 1`, `cost_usd $0.000003`, `ok 1`, no error, for about 12,000
tokens of real output. Fix: sum per-delta usage (or keep the largest), and mark
a stream without the tail as an error. Not changed in this step.

### The loop model

| | DeepSeek V4.1 Flash | Gemma 4 26B | Qwen 3.8 27B |
|---|---|---|---|
| all files in one reply | yes (auto) | only with `required` | yes |
| streams arguments, path first | yes | only with `required` | yes |
| edits | right | match, but delete other CSS | right |
| speed | fast, first token up to 3 s | fast | slow, 300 s cut on long files |
| cost, four-file turn | ~$0.002 | ~$0.0004 | ~$0.005 |
| rate limit | 20/min per account | 300/min | 300/min |

**DeepSeek for the loop, at two calls per turn or fewer.** It is the only
model that did everything right: all files in one reply with plain `auto`,
path-first fragments, correct edits, recovery from a cut call. A
four-file turn is one call plus the closing sentence; with the loop ending after
a write-only step it is **one call per turn**, so 20/min means 20 student turns
a minute for the account: one turn per student every 45 s in a class of 15,
or 50/min with prepaid AI Gateway credits. Keep a turn counter
in the gateway and fall back to Gemma 4 with `tool_choice: required` on the
first call when DeepSeek answers 429. Gemma is a fallback, not the default,
because of its edits (they need a guard: refuse an `edit` whose `newText`
doesn't contain most of `oldText` unless the instructions say "delete", and say
so in the tool result). Qwen: no, too slow and cut at 300 s.

Also from this: give `write` calls enough room (`max_tokens` 16000 wasn't
enough for a "15–25 KB" page; models overshoot 2–3×), tell the model to keep
each file under ~20 KB, and send cut calls back as `{}` with an error.

### Live file streaming into the preview

| Model | Live? | How |
|---|---|---|
| DeepSeek | **yes** | fragments with `path` first in 25/29 writes; for the other 4 hold the text until `path` arrives (a few hundred ms for small files). CSS/JS sometimes arrive in one piece: fine, they reload on `tool-done` anyway |
| Gemma 4 (cloud) | **with `required` only** | `required` gives path-first fragments; with `auto` half the calls arrive whole at the end and keys are alphabetical, so the path comes last. The normalizer must start a new call on a new `id` even when `index` repeats |
| Qwen 3.8 | yes, slowly | path-first small fragments at ~45 tokens/s |
| gemma4:26b (Ollama) | **no** | every call arrives whole at the end; show "writing…" and render on `tool-done` |

So the `file-delta` path in §6 holds: decode `content` from the partial JSON
once `path` is known, else buffer. Gemma's `auto` path and Ollama need the
non-streamed fallback the Risks table already names.

## 5. Decisions

1. **Our own loop in `StudioAgent`, not Think.** Keeps the gateway call, the
   native WebSocket and the vanilla client as they are; no AI SDK v7, no React
   peers, no peer-dependency override, no experimental package in the core.
   Think gets another look when we need durable long turns, skills or
   sub-agents, and after the gateway normalizes streams.
2. **Computer `Workspace` as the working copy**, `@cloudflare/computer` pinned
   to 0.6.0, `zod` added; no execution backend yet.
3. **Versions are snapshots in R2, not git.** Content-addressed:
   `blobs/<sha256>` once per distinct file, `projects/<id>/v/<n>.json` a
   manifest `{ files: { "index.html": { hash, size, type } }, model, at }`. Cheap
   (unchanged files cost nothing), simple to serve, independent of
   Workspace storage growth. Restoring a version writes its files back into the
   Workspace. Git in the Workspace can come later for diffs; Cloudflare
   Artifacts (open beta, billed since mid-October) is the option if students
   ever want real repos.
4. **Preview served from the Workspace** on `preview.visualia.space`, relative
   paths, CORS, CSP sandbox, signed path.
5. **Publish = pointer to a snapshot**, served from R2 under the same
   `projects.visualia.space/<person>/<slug>/` with the same headers plus CORS.
6. **Libraries by import map + CDN** in the instructions; a build step only
   with step 5.

## 6. Design

### Agent loop (in `agent.js`)

```js
import { Workspace } from '@cloudflare/computer';
import { createPiTools } from '@cloudflare/computer/tools/pi-ai';

export class StudioAgent extends Agent {
  workspace = new Workspace({ storage: this.ctx.storage });

  async run(text) {
    const { tools, execute } = createPiTools({ workspace: this.workspace, root: '/workspace', exec: {} });
    const messages = [{ role: 'system', content: SYSTEM }, ...context, { role: 'user', content: text }];
    let changed = false;
    for (let step = 0; step < MAX_STEPS; step++) {          // MAX_STEPS ~6
      const { content, calls, finish } = await this.callModel(messages, tools); // gateway, streamed, normalized
      messages.push({ role: 'assistant', content: content || '', tool_calls: calls.map(toOpenAI) });
      if (!calls.length) break;
      for (const call of calls) {
        const r = await execute({ id: call.id, name: call.name, arguments: call.args });
        if (['write', 'edit', 'delete'].includes(call.name) && !r.isError) changed = true;
        this.send({ type: 'tool-done', id: call.id, name: call.name, path: call.args?.path, error: r.isError });
        messages.push({ role: 'tool', tool_call_id: call.id, content: r.content.map((c) => c.text ?? '').join('\n') });
      }
      if (calls.every((c) => ['write', 'edit', 'delete'].includes(c.name)) && !anyError) break; // save a call
    }
    if (changed) await this.snapshot(); // manifest + blobs to R2, version n+1
  }
}
```

`callModel` is today's `relay()` grown up: it reads the gateway SSE, collects
`delta.content` and `delta.tool_calls[i].function.arguments` fragments (and the
native top-level `tool_calls` shape), and broadcasts progress. For a `write`,
it decodes the `content` value out of the partial JSON (scan past
`"content":"`, unescape as it goes) and sends `file-delta` frames, so the
preview fills in exactly as the single-file page does today.

### WebSocket messages (extend, don't replace)

| Message | When |
|---|---|
| `hello { turns, versions, busy, files }` | on connect (adds the file list) |
| `start`, `busy`, `error`, `done { version, model, files }` | as today |
| `tool { id, name, path }` | a tool call starts (path parsed as soon as it appears) |
| `file-delta { path, text }` | content of a file being written, throttled ~150 ms |
| `tool-done { id, name, path, error }` | the call ran |
| `delta { text }` | plain text from the model (a short note to the student) |

### Turn context

The model doesn't need every file in the prompt: the system prompt lists the
files (path, size) and includes `index.html`; the model `read`s the rest when
it needs them. Earlier requests stay as today ("Earlier requests: …").

### Assets from students

`POST /api/projects/:id/files` (multipart) → agent writes bytes to
`/workspace/assets/<name>`; caps of ~10 MB a file and ~50 MB a project; images
and sounds only. The file list in the prompt tells the model they exist.

### Publish and serving

`published(url, env)` in `index.js`: resolve person/slug → `published_version`
→ manifest → the requested path (empty → `index.html`; a directory →
`<dir>/index.html`) → `blobs/<hash>`. Headers: content type from the manifest,
`Content-Security-Policy: sandbox allow-scripts allow-popups allow-forms
allow-pointer-lock` on HTML, `Access-Control-Allow-Origin: *` on everything,
`nosniff`, `cache-control: public, max-age=60` (blobs could be immutable by
hash later). Old single-file versions keep working: a missing manifest falls
back to `projects/<id>/<n>.html`.

### What changes where

| File | Change |
|---|---|
| `apps/studio/package.json` | `@cloudflare/computer` 0.6.0, `zod` (exact) |
| `apps/studio/src/agent.js` | Workspace; tool loop; stream normalization; `tool`/`file-delta`/`tool-done` frames; `snapshot()` and `restore(n)`; `onRequest` serving `/workspace` files with CORS, CSP sandbox and the injected reporter; one-time import of the latest single-file version into `/workspace/index.html` |
| `apps/studio/src/index.js` | route `preview.visualia.space` (check signature → agent `fetch`); multi-file `published()`; asset upload; `/api/projects/:id/versions/:n` returns a manifest; publish unchanged (pointer) |
| `apps/studio/public/project.html` | file list beside the turns; preview iframe `src` on the preview origin (srcdoc with `<base>` only while an HTML file streams); reload on `tool-done` for CSS/JS; per-file progress ("writing style.css…"); relative-path problems into the existing problems list and auto-fix |
| `apps/studio/wrangler.jsonc` | route `preview.visualia.space` (custom domain) |
| `apps/gateway/src/index.js` | ~~add `parallel_tool_calls` to `PASS`; count the first tool-call delta as first token~~ (done in step 0); sum per-delta usage so a cut stream isn't recorded as 1 token; start a new tool call on a new `id`; (optional) normalize Workers AI streams to strict OpenAI there, so every client benefits |
| `schools/eka/instructions.md` | a multi-file section: relative links, one folder for assets, libraries as ES modules via import map, keep files small, write all files in one step |
| D1 | `projects.kind` (`page` / `files`) or none, if the manifest decides |

### Spike: the smallest end to end

Goal: the model writes three files via tools into a Workspace, the preview
serves them, publish copies them. Behind a per-project switch so the
single-file studio stays as is.

| Part | Effort |
|---|---|
| Raw SSE captures of the three models with tools (shape, argument streaming) | 0.5 day |
| Workspace + `createPiTools` + loop in `StudioAgent`, non-streamed tool args first | 1 day |
| Preview origin: route, signature, `onRequest` serving files with headers + reporter | 0.5 day |
| Snapshot to R2 (manifest + blobs), publish from manifest | 0.5 day |
| `project.html`: preview by URL, file list, reload on `tool-done` | 0.5 day |
| Streaming file content into the preview (`file-delta` + `<base>`) | 0.5–1 day |
| A first `evals/multi-file` run (5 briefs × 3 models) | 0.5–1 day |
| **Total** | **about 4–5 days** |

Done when: "a small site with a home page and an about page, shared style, one
script" produces `index.html`, `about.html`, `style.css`, `main.js`; both pages
render in the preview and link to each other; a follow-up edit changes only the
file it should; the version has a manifest; publish serves all four files
sandboxed with CORS; every model call is a `usage` row with person and project.

## 7. Later

- **Build step (step 5)**: `createApp()` from `@cloudflare/worker-bundler`
  over the Workspace files (`createWorkspaceStorage` in its README), loaded via
  `env.LOADER.get(<project>:<manifest hash>, ...)`, assets served by
  `handleAssetRequest`. Its own plan, after the package leaves "experimental".
- **Backends (step 6)**: the project's server code in a Dynamic Worker, its
  storage in a Durable Object facet (VibeSDK's App facet), egress closed by
  default (`globalOutbound: null`).
- **Think** when turns get long or skills arrive; first move the stream
  normalization into the gateway so `createOpenAICompatible({ fetch })` works.
- **Diffs** between versions for students ("what changed"): from manifests
  (which files) and a text diff per file; git not required.

## Risks

| Risk | Mitigation |
|---|---|
| DeepSeek's 20 req/min per account caps tool loops for a class | Gemma 4 for loops; prepaid AI Gateway credits (50/min); one-to-two-call turns; measure in the eval |
| Tool-call stream shapes differ per model and aren't documented | capture first; normalize once (port `agents/.../chat-completions/stream.ts`); fall back to non-streamed arguments if a model doesn't fragment |
| Models write `/style.css` or load modules without CORS | instructions + post-turn check + auto-fix; CORS headers on preview and publish |
| Workspace storage creeps (no gc, growing change log, [cloudflare/computer#68](https://github.com/cloudflare/computer/issues/68), [#67](https://github.com/cloudflare/computer/issues/67)) | history lives in R2; the Workspace is only the working copy; size caps |
| Computer breaks APIs in minors | pin 0.6.0; we use only `Workspace`, `fs`, `createPiTools` (all "stable") |
| Multi-step turns cost more input tokens (context resent each step) | short system prompt, file list not file contents, step cap; DeepSeek's cached input is $0.006/M |
| WebXR in a CSP-sandboxed opaque origin may not start a session | test on a headset before step 4; fallback: a non-sandboxed "open in XR" on a separate registrable domain (`visualia.page`) |
| Preview link leaks a draft | signed path with expiry; drafts are low-stakes |

## Open questions

1. One project type with a switch, or "multi-file" as a choice when creating a
   project? (Proposal: new projects are multi-file once the eval passes; old
   ones import their latest page as `index.html`.)
2. Do students edit files by hand in the studio, or only by asking? (A plain
   textarea per file is cheap and teaches a lot.)
3. Asset size caps and which file types.
4. Prepaid AI Gateway credits for the rate limit, or Gemma 4 for loops?

## Next

- Remove single-file mode once multi-file works on all page models (DeepSeek,
  Gemma 4 cloud, Gemma 4 26B local): every project becomes files; old pages
  are imported as index.html; then drop `kind` and the srcdoc-only path.
- Tools through the pool's node worker, so the M2's Gemma 4 26B can serve
  multi-file turns locally (it sends every call whole: render on `tool-done`).
- Asset upload (`POST /api/projects/:id/files`, caps, images and sounds).
- Hand-editing files in the studio (a plain textarea per file).

## Paused (2026-10-22)

The teacher paused the work mid-spike. The live site is consistent: single-file
projects work as before (checked after the deploy: a new page project, one
turn, 3.4 s, check 90%), and new projects are `page`.

**Done and deployed** (studio and gateway deployed; migration `0011_kind.sql`,
`projects.kind TEXT NOT NULL DEFAULT 'page'`, applied remote and used):
- `@cloudflare/computer` 0.6.0 and `zod` 4.6.7, exact. API checked on a
  throwaway Worker (deleted): `createPiTools({ workspace, root: '/workspace',
  exec: {} })` gives read, ls, find, grep, write, edit, delete; relative paths
  resolve under the root, `/etc/x` is refused, bad arguments come back as
  `isError`. `write` fails with "parent directory missing" until `/workspace`
  exists (the agent makes it). The tools describe paths as absolute
  `/workspace/...`; the agent rewrites `path` descriptions to relative ones.
- `apps/studio/src/files.js`: stream collector (OpenAI fragments, native
  `tool_calls`, a new id = a new call even on a repeated index), partial-JSON
  `content` decoding, the Gemma edit guard, root-relative link check, MIME,
  headers, reporter, preview signatures. Replayed against every step-0
  capture (scratchpad `mf/replay.mjs`): 457/457 calls, arguments and live
  content equal; the guard flags exactly the three wrong Gemma edits (cloud
  r1, r2; local r2) and passes all right ones.
- `agent.js`: Workspace (lazy), our loop (DeepSeek; on 429 Gemma 4 with
  `required` first; ≤ 6 steps; ends after a write-only step; cut calls sent
  back as `{}` + error; guard on Gemma edits), `tool` / `file-delta` /
  `tool-done` / `note` / `done {version, files, problems}` frames, snapshot
  to `blobs/<sha256>` + `projects/<id>/v/<n>.json`, `load`, `restore` (a new
  version), `toFiles`, files remix, screenshot of `index.html` by preview URL,
  `onRequest` serving the working copy. Gateway: a rate-limit error answers
  429 instead of 502.
- `index.js`: `preview.visualia.space/<project>[.v<n>].<sig>/<path>` (custom
  domain on the studio Worker; the signature covers the visibility),
  `POST /api/projects/:id/kind`, versions answer with a manifest, published
  multi-file versions from the manifest, plain HTTP to a project's agent
  refused on the studio origin.
- `project.html`: one page with small branches: "Make it a multi-file
  project" (owner), file list under the title, iframe by URL, srcdoc + `<base>`
  while the first HTML file streams, reload on `tool-done`, "Writing
  style.css…", problems from `done` into the list and auto-fix, "Go back to
  version n".
- `instructions.md`: "Several files" section (left out of the single-page
  prompt, which is unchanged).

**Verified live by script** (scratchpad `mf/mftest.mjs`, 47 checks, all ok,
project `ee71a0a333ca4876` "Two pages"): the brief gave index.html,
about.html, style.css, main.js in **one call, 10.3 s, $0.0025** (3,638 in,
1,192 out; first file-delta at 1.4 s, 17 deltas); both pages link each other,
use style.css and main.js; the edit "make the main heading red on both pages"
was **one `edit` of style.css, 4.1 s, $0.00023** (3,520 cached), the other
three files kept their hashes; the version has a manifest; preview and
published files all 200 with CSP sandbox, `Access-Control-Allow-Origin: *`,
nosniff; wrong signature 404, another version under a signature 404; private:
the classmate gets 404 for the project and has no link; shared: they read the
preview, and the private-time link dies; private again: their links 404, the
owner's new one works; published files stay public; restore v1 → v3 with v1's
files; the classmate's remix copied the manifest (same blobs) and its working
copy. Usage: 2 DeepSeek rows + 2 Clef check rows, all with person and project.

**Not done yet:**
- Playwright on the project page (375×812, 1280×800): the live srcdoc while
  index.html streams, the reload on `tool-done`, the file list, the status
  line, and the relative-link auto-fix in the browser. Nothing of the page UI
  has been looked at yet.
- The Gemma fallback live (only replayed); the guard live.
- The wall for a shared files project (same `wall()` call as pages, not
  checked), thumbnails of a files version.
- plans/README.md and worklog: board line and a short entry are in; the
  "Built: spike" section is this note for now.

**Uncommitted:** everything above (nothing is committed): `apps/studio/src/{agent.js,index.js,files.js}`,
`apps/studio/public/project.html`, `apps/studio/{package.json,wrangler.jsonc}`,
`package-lock.json`, `apps/gateway/src/index.js`,
`apps/gateway/migrations/0011_kind.sql`, `schools/eka/instructions.md`, this plan,
`plans/README.md`, `worklog/2026-10.md`.

**Resume with:** a Playwright script (cookie from `mf/cookies.json`, as
`walllive.mjs`) on a new project: convert, send the brief, take screenshots at
375×812 and 1280×800 during streaming and after `done`, then ask for a change
that adds `href="/"` and watch the problem list and the auto-fix; fix what the
screenshots show.


## Browser checks (2026-10-22, resumed)

Playwright on the live project page (signed in by script as eka-test-001;
375×812 and 1280×800), two new projects (`31b43e4ba5124c38`,
`7f03173da0ec4266`):
- Convert → brief: "Writing index.html…" at 2.4–3.5 s, the first HTML file
  shown through srcdoc while it streams; done in 13.2–13.6 s with four files
  (index.html, about.html, style.css, main.js); after done the iframe loads
  the signed `preview.visualia.space/<id>.v1.<sig>/index.html`, no srcdoc
  left; the file list under the title on both sizes; phone preview opens full
  screen and back closes it. No page errors.
- `href="/"` asked for on purpose: version 2 came with two problems
  ("links "/" from the site's root…"), the auto-fix sent "Fix these errors"
  by itself and made version 3; the problem box stayed hidden.
- "Make the main heading red on both pages": one `edit` of style.css, heading
  red on the preview.
- Shared with the class: on the wall at once, thumbnail of version 2 (200).
- **Found and fixed:** a brief sent while the page's socket was still
  connecting (right after "Make it a multi-file project" reloads the page)
  was dropped and the field cleared; the next request then ran on an empty
  site and answered "Nothing was changed". The page now sends only on an open
  socket and otherwise keeps the text and says "Connecting… try again in a
  moment." (`project.html`, `send()`).

**Gemma 4 live (2026-10-22 evening):** the studio deployed for a few minutes
with `PAGE_MODEL` = Gemma 4 26B (the teacher's go-ahead), the same browser
script, project `f3ae4d3d9c374b60`, then DeepSeek deployed back. This runs the
fallback path exactly (tool required on the first step, edit guard on); only
the 429 that triggers it was skipped.

| | Gemma 4 26B | DeepSeek V4.1 Flash (same script, earlier) |
|---|---|---|
| Brief: four files | one call, 20.5 s model time, 24.3 s to done, $0.00063 | one call, ~10 s, 13.2 s to done, $0.0025 |
| "Heading red on both pages" | 3 calls: an `edit` whose old text didn't match (refused by the tool), a `read`, a right `edit`; $0.0012 | one `edit`, $0.00023 |
| Check score, v1 | 79% | 81% |

- The edit guard did not fire: the wrong edit was refused by the tool itself
  and Gemma recovered by reading the file. No unrelated CSS lost this time.
- Quality slip: the home link came out as "Avale ʊpage" (for "Avaleht"), a
  garbled word like the poster in `first-pages.md` run 9. DeepSeek stays the
  default; Gemma is good enough as the 429 fallback, cheaper per brief but
  about twice as slow.
