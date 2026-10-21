---
status: next
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
4. Reads the provider's `usage` and writes one ledger row: time (UTC), school,
   student, model, tokens by type (fresh input, cache read, cache write, output,
   reasoning), latency, cost.
5. Returns the response unchanged.

Plus `GET /ledger` returning the last rows, as the first, ugly dashboard.

## Done when

- `curl` with a course key gets a model answer back.
- The ledger shows the row with real token counts, and the AI Gateway log shows
  the same call with the student in its metadata.
- A wrong key gets 401 and writes nothing.
- `wrangler` version is the pinned one; `npm run deploy` deploys it.

## Not in it

No UI, no Think, no Clef, no budgets, no streaming yet. Each comes next as its
own plan, on top of this.

## Needs

Cloudflare: one D1 database, one AI Gateway, a Workers subdomain. Which models:
see `schools/eka/docs/INFRA.md` (Models right now).
