---
name: visualia-writing
description: How to write the words people read on Visualia pages and apps (studio, board, pool join page, worker app, probe, usage page, notes for school IT), and how to check them against the code. Load before writing or changing any UI text, status line, error message, page intro, button label, or a note meant for students, teachers or IT.
---

# Writing for Visualia

Derived 2026-10-22 from positron's `positron-describe` and the plain-voice pass
in `positron-slides` (`~/personal/positron/.claude/skills/`), and from the
teacher's corrections on Visualia pages. The readers are art and design
students, a teacher, and school IT. None of them should need to know how the
platform works to read a line.

## Say what happens, to whom

- **A line names the actor, the action and the result.** *"Share this
  computer with the pool. While you are in, it does AI work for everyone in
  the pool."* Not
  *"This computer answers requests from the pool"*: who asks, and what changes
  for the reader, is missing.
- **Universal, not one school.** Pages are run per school, but the words must
  work anywhere: *everyone in the pool*, *the class* only where the page is a
  class page. Never *classmates* on the pool or the worker app (teacher,
  2026-10-22).
- **Communal.** Shared things say *everyone in the pool*, not *other
  people*: the person reading is in it too. Say it once; *you included* and
  a reason after it were cut as too much (teacher, 2026-10-22).
- **Never "the cloud".** It is vague. Leave it out, or name what actually
  happens (*rented data centres*, *a paid service*) where the page needs it.
- **Wide enough words.** Pool work is chat, decisions and JSON answers: call
  it *work* (*AI work*, *Work done*), not *questions* or *prompts* (teacher:
  "too narrow, it's more like work").
- **What it does, never the engine.** No WebLLM, Ollama, DeepSeek, Durable
  Object, gateway on a student page unless the page is about that thing (the
  worker app names Ollama because the person must install it). Model names
  appear where a person picks or pays for one.

## Every claim is a claim about code

Nobody type-checks a sentence. Before writing, find the line that backs each
claim; when it is about behaviour, run it. A claim you cannot point at does
not go on the page.

The claims that go wrong here, worth checking every time:

- **"Nothing is saved", "private", "never"**: what does D1, R2, AI Gateway
  logging or a log file actually keep? The usage page keeps model, tokens,
  time, energy and who served each job, so *"only the model, time and energy
  are recorded, never what was asked or answered"* is true and *"nothing is
  saved"* is not.
- **"Only", "connects to"**: list the addresses from the code or the page's
  Content Security Policy, not from memory.
- **"Everyone", "the class"**: who can actually see it (private projects,
  another school)?
- **"Free", "$0"**: a pool job is $0 on the bill, but it uses someone's
  computer and energy.
- **"Fast", "instant"**: measured where, warm or cold?

Shortening must not introduce a claim: when a line gets cut, keep the
condition that makes it true and drop something else.

## Plain, short, one pattern

- **Minimal.** One sentence by default, a second only for a second fact the
  reader needs. Cut by choosing, never by squeezing (no dropped articles, no
  symbols for words).
- **No repetition.** A line that repeats another on screen goes (*"Get Ollama"*
  as a link and *"Get Ollama first"* beside a disabled Join: the second goes).
  A disabled button already says "not yet".
- **No jargon on student pages.** The first probe was "way too technical".
  Web and infra words (endpoint, token, socket, instance, deploy) are for
  plans and IT notes, not for students.
- **One pattern for all rows.** A list of models, jobs or projects uses the
  same wording shape on every row (*Ready* · *Get (7.6 GB)* · *Needs 32 GB of
  memory*).
- **State is a word**, quiet or full ink, never a colour (`plans/style.md`).
- **English only** (no Estonian translation, decided 2026-10-23); plain
  words, no idioms, since many readers are not native speakers.
- No em dashes, no semicolons, no middots in UI copy (a middot only as a
  separator between links or values, as the style sheet does). No "unlock",
  "seamless", "empower", "leverage", "experience", "platform" as decoration.

## Words live in text.json

Every word a page shows sits in that app's `text.json`, by key, never in the
HTML or the code (the worker app and the pool's join page so far, 2026-10-22;
the studio next). One helper for all apps, `packages/text/text.js`, copied in
at build like `visualia.css` (the copies are gitignored):

- `data-text="key"` fills a place with plain text.
- `data-html="key"` for the few lines that need our own markup (`<b>`,
  `<code>`, a link). Never for anything a person typed.
- `t('key', { slot })` in code, with literal keys; `t(\`model-${name}\`)` when
  the key is built from data (every key with that prefix counts as used).
- Lines with numbers or names use slots (`"memory": "This computer has {gb}
  GB of memory."`), never strings glued in code.

`packages/text/check-text.mjs <dir> <files…>` runs before each build and fails
on a missing or unused key. Numbers and times go through `Intl`.

Shared code that shows words takes a `t` option from the page instead of
holding words; its default returns the key, so tests run without a text
file. `text.js` loads `text.json` from beside
itself, so pages at any path find it. The studio's words: 91 keys (2026-10-23)
(`plans/studio-core.md`, which also lists the texts still in server code).

## Pass before showing it

Do this privately, then show the result:

1. Could the sentence describe some other app unchanged? Make it specific.
2. Can the reader tell the thing, the action and the consequence?
3. What backs each claim (file and line, or a run)?
4. Would the teacher say it out loud beside the page?
5. Did shortening hide a limit, a condition or a cause? Put it back.
6. Does any line repeat another on the same screen? Cut one.

## Notes for IT and staff

Same voice, more facts: the addresses, what runs, what is stored, how to stop
it, with each claim checked. Lead with the answer, then the table. The note
for EKA IT (Claude Docs, `plans/worker-app.md` links it) is the example.

## Before / after (2026-10-22, worker app)

| before | after | why |
| --- | --- | --- |
| This computer answers classmates' requests with its own models while you are in the pool. | Share this computer with the pool. While you are in, it does AI work for everyone in the pool. | who acts and what happens; communal; *work*; nothing added after it |
| Connects out to pool.visualia.space only. Never shows or keeps what people ask. | It connects only to pool.visualia.space. Only the model, time and energy of the work are recorded, never what was asked or answered. | "never keeps" was false (usage rows); says what is recorded |
| Get Ollama · Check again … Get Ollama first | Get Ollama · Check again | the status repeated the link |
