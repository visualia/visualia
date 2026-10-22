---
status: building
---

# Local models from the browser, and a class pool

> 2026-10-22: the pool part is replaced by `pool.md` (outbound only, tab or
> signed worker app, auditable). The m1-1 tunnel below was retired on 2026-10-22, when the M1 joined
> as an ordinary worker.

Students' own computers can run small models. This plan lets the studio use
them from the browser, first for the student's own requests, then as a shared
pool the class draws on, with every call still counted in `usage`.

## Three ways a browser reaches a model

| Way | How | Install | Good for | Limits |
|---|---|---|---|---|
| **In the tab** | WebGPU libraries (WebLLM `@mlc-ai/web-llm` 0.2.x, Transformers.js 4.x) download a model into the browser and run it there | none | the probe's real speed test; small chat; decision models if a small one is ported | browser memory caps (a few GB), first download is large, small models only |
| **Local runtime** | the page calls Ollama / LM Studio on `http://localhost:11434` | Ollama, started with `OLLAMA_ORIGINS=https://visualia.space` | real local models (9B–27B, Clef-flash) at full speed | Chrome asks the student to allow local network access; Safari blocks https → localhost |
| **Pool** | a student's tab offers its local model to the class through a Durable Object | as above, opt-in | sharing a strong machine (or the school GPU box) with everyone | prompts run on someone else's computer: consent and trust matter |

## Steps

**1. Speed test in the probe (in the tab).** "Test my computer": load a tiny
model with WebGPU, generate a fixed paragraph, show tokens per second and a
plain verdict ("about 2 minutes per page here; the studio takes 10 seconds").
Turns the probe's estimate into a measurement. No install.

**2. "Use my computer" in the studio.** A switch in the project view: requests
go to the student's own Ollama instead of the cloud. The studio page streams
from `localhost` and renders the preview the same way. Usage: the page reports
counts (model, tokens, time; never text) to the gateway as a `local` row, so
local work shows on the usage page too, at $0. A "check" button tests that
Ollama is reachable and has a model, and explains the one-time setup if not.

**3. The class pool.**
- A `Pool` Durable Object holds the queue of requests and the list of
  available workers (tabs that switched "share my computer" on), with model,
  speed and who.
- A worker tab connects by WebSocket, takes a job, runs it on its local
  Ollama, streams tokens back; the Pool relays them to the requester.
- The gateway gets a `pool` route: when a suitable worker is online, use it;
  otherwise fall back to the cloud model. The student doesn't need to know.
- The usage page shows who served whom ("Mari's M3 served 14 requests today"):
  sharing is visible, as the course intends.
- The school GPU box joins as a worker (a small node script instead of a tab).

**4. Energy.** Browsers can't read power. Workers that run the node script can
attach `macmon` / `nvidia-smi` readings per job; tab workers get a range from
the device class. Feeds the footprint view.

## How it fits the studio (added 2026-10-21)

The studio's agent calls the model **from the server** (a Durable Object), and a
server can't reach a student's `localhost`. So local compute needs the call to
start in the browser. The design that covers all cases: **the agent hands out
jobs; whoever is connected does them.**

| Worker | Who runs the model | How the result returns |
|---|---|---|
| cloud (today) | the agent itself, through the gateway | in-process |
| my computer | the student's own open tab: local Ollama, or WebGPU in the tab | streamed back over the project's WebSocket |
| pool | a classmate's tab with "share my computer" on, or the school GPU box (a small node script) | through the `Pool` Durable Object to the project's agent |

- The agent keeps doing what it does now (history, instructions, versions,
  error auto-fix, publish); only "who generates the answer" changes. Deltas
  from any worker are relayed to all viewers the same way.
- Usage: local and pool jobs are reported to the gateway as rows with
  `provider = local` or `pool:<worker>`, tokens and time, cost $0 (energy later).
- Fallback: if the chosen worker disconnects mid-answer, the agent finishes the
  job in the cloud and says so.
- Multi-file projects (`plans/multi-file.md`) need tool calls in a loop, which
  small local models do badly; local and pool workers start with single-file
  pages and chat.

Order: step 2 = the "my computer" worker (own tab → own Ollama), then the pool.

## Trust and consent

- Sharing is opt-in per session and visible; a worker sees the prompts it
  runs, so the share screen says so plainly.
- Pool jobs carry no identity of the requester to the worker (only the
  prompt), and never the course key.
- A worker could return junk: the studio's checks (HTML present, page
  renders) catch the obvious cases; repeated failures drop a worker.
- Class only: workers serve their own class's queue, nothing public.

## Open

1. In-the-tab models: is there a small enough model that writes a usable page,
   or is in-tab only for chat, decisions and the speed test?
2. Chrome's local network access prompt: test how it reads to a student.
3. Safari users can't use step 2 directly; offer the node-script worker or the
   in-tab route instead.

## m1-1, the first worker (2026-10-21)

The M1 Pro laptop (16 GB, no ThreatLocker, 567 GB free) runs Ollama behind
tunnel `m1-1` and a secret-checking proxy that also meters energy with macmon
(`apps/m1-worker`). The gateway routes `m1-1/<model>` there; usage rows get
cost $0 and measured energy (`energy_j`, `energy_net_j`, `sys_energy_j`).

First call: one Estonian p5 brief on Qwen 3.5 9B: 65 s, 1,500 tokens out,
**1,354 J net chip energy (≈0.38 Wh)**, 2,581 J whole machine (≈40 W).
Problem: first visible token only after 59 s and the answer hit the token cap,
because Ollama ignores `chat_template_kwargs.enable_thinking: false`; the proxy
should map it to Ollama's own thinking switch.

The teacher's work Mac runs ThreatLocker (default-deny allowlisting), which
likely blocks Ollama there and very likely killed esbuild 0.28.2 earlier.
