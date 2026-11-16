---
status: building
---

# Prompts in the open: every word added to a model call, readable and editable

Asked 2026-11-15: *"i want all preprompts to be editaable for visibility / education"*. Decided the same day: **students
read every prompt, the teacher changes them for the school**. A change counts from the next request.

## Built (2026-11-15, tested locally, not deployed)

- **One list:** `apps/studio/src/prompts.js` holds the course default of every prompt the studio and the pool add,
  with `promptsFor(env, school)` (the school's text where its teacher changed one). Defaults needed by more than one
  app live in `packages/prompts/index.js` (the klein instruction); ChilloutMix's negative prompt stays on the model
  list (`apps/pool/src/models.js`).
- **D1 `prompts`** (`apps/gateway/migrations/0014_prompts.sql`): `(school_id, id, text, person_id, updated_at)`.
  No row means the course default. Saving the default or nothing removes the row.
- **Studio page `/prompts`** ("What the models are told", linked from the home page): all 14, with when each is sent.
  `GET /api/prompts` for everyone signed in; `POST /api/prompts/:id { text }` for `people.role = 'teacher'` only (403
  otherwise). Checks: length per prompt, the negative prompt on one line, the checker's choices keep their seven words.
- **Used where they go:**
  - Page agent (`agent.js`): the rules, the course instructions, file names, the cut-off and edit-undone messages, the
    checker's question, "what is off" and its choices. Read from D1 once per request, for the project owner's school.
  - Fix requests: the project page sends `{ type: 'fix', problems }`; the agent puts the school's fix prompt in front
    and marks the turn `fix` (the checker leaves it out; old turns still by their words).
  - Gateway: klein's upscale instruction (the person's own, else the school's, else the default); the Upscale page
    starts its box from `/api/prompts`.
  - Pool picture jobs: the gateway sends the school's negative prompt as `negative`; the pool checks it (one line, at
    most 200 characters) and passes it in the job; pool-core uses it over the list's. Apps before 0.5.0 ignore it.
- **Shown, not changed** (`fixed`): the request wrapper and the checker's view (examples made by the same functions the
  code uses, `turnContext`, `checkState`), and the pool app's JSON rule (runs on each computer, `core::json_prompt`).
- Left out: the MCP server's tool descriptions (read by a person's own AI tool) and the probe's speed-test prompt (runs
  in the browser, not through the studio or pool).

Tested: the API as teacher and student (403, the three checks, saving, resetting); the page in Chrome; one request and
one fix request through a stand-in gateway that recorded what the studio sent (the teacher's fix prompt and checker
question arrived, the fix turn stayed out of the checker's list); pool-core's tests on the M1 (9 pass). The real gateway
and pool weren't run locally (the gateway's Workers AI connection failed from here).

## To deploy

1. `wrangler d1 migrations apply visualia --remote` (from `apps/studio` or `apps/gateway`).
2. Deploy gateway, pool, studio.
3. Check it is the right person: EKA has one `teacher` in `people` (2026-11-15), and three `student`s.
4. The negative prompt reaches computers on app 0.5.0 (with ChilloutMix, `plans/worker-app.md`).

## Open

- ChilloutMix and nudity: the negative prompt steers, it doesn't stop. Nothing checks the finished picture
  (`plans/worker-app.md` "Pictures in the pool"). Asked the teacher 2026-11-15: an output check in the gateway, or hide
  it until there is one.
- History of changes: only the last change and who made it are kept. A log would let students see how the prompts moved.
