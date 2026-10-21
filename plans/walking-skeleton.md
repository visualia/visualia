---
status: shipped
---

# Walking skeleton

The first thing built: the thinnest path through the whole system, so every
later piece sits on a pipe that already works and measures.

## What it is

`apps/gateway`, one Worker:

1. `POST /v1/chat/completions` (OpenAI-compatible) with a course key.
2. Looks up the key in D1: who is this (school, student)?
3. Forwards the call through Cloudflare AI Gateway to one cheap model
   (Workers AI or one hosted open model), with `cf-aig-metadata` carrying the
   student.
4. Reads the provider's `usage` and writes one usage row: time (UTC), school,
   student, model, tokens by type (fresh input, cache read, cache write, output,
   reasoning), latency, cost.
5. Returns the response unchanged.

Plus `GET /usage` returning the last rows, as the first, ugly dashboard.

## Done when

- `curl` with a course key gets a model answer back.
- The usage record shows the row with real token counts, and the AI Gateway log shows
  the same call with the student in its metadata.
- A wrong key gets 401 and writes nothing.
- `wrangler` version is the pinned one; `npm run deploy` deploys it.

## Not in it

No UI, no Think, no Clef, no budgets, no streaming yet. Each comes next as its
own plan, on top of this.

## Needs

Cloudflare: one D1 database, one AI Gateway, a Workers subdomain. Which models:
see `schools/eka/docs/INFRA.md` (Models right now).

## Result (2026-10-21)

Deployed at `https://visualia-gateway.kristjan-jansen.workers.dev`, D1
database `visualia`, AI Gateway `visualia`, model `@cf/qwen/qwen3.8-27b`.

- Student key → answer in Estonian, usage row with real tokens, **neurons**
  and cost (Workers AI reports neurons; cost = neurons × $0.011/1,000, recorded
  at the paid rate). ✓
- Wrong key → 401, nothing written. Student reading `/usage` → 401. ✓
- Failed calls are recorded too (ok = 0, with the error). ✓
- AI Gateway **Logs** show the same calls with metadata `school: eka`,
  `person: eka-test-001`, identical tokens and neurons, and cost $0.00063540,
  matching our row to the cent. ✓

**Before any student uses it:** AI Gateway currently stores full prompts and
responses. The course plan says counts only by default, content only by opt-in,
so switch payload logging off for student traffic (metadata-only logs).
