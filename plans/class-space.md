---
status: building
---

# The class space: one chat, everyone's work, on the phone

8–10 meetups of two hours a semester, independent work in between. The class
is a group of peers: the teacher is one more member, sees the same things and
contributes like everyone else. No teacher tools.

## What a member sees

- **The chat**: one permanent conversation for the class, during meetups and
  between them. Projects dropped into it open inline (live preview, not a link
  to leave for).
- **The wall**: every project, live, newest change first, as thumbnails (the
  per-version screenshots). Open anyone's project: its history, its
  conversation, the page.
- **Contributing**: anyone can ask for a change on anyone's project. Each
  version records who asked for it, so shared work is visible and credited.
  Remix makes a copy that keeps a link to where it came from.
- **Usage and footprint**: the same page for everyone (exists).

## Phone first

- The chat and a project's conversation are the main screen; text is the thing
  people read most, so it gets the space.
- The preview is one tap away and full screen; back returns to the
  conversation at the same place.
- The wall is a grid of thumbnails, two across on a phone.
- Typing a brief on a phone is slow: speaking it (speech to text, Workers AI
  Whisper) belongs here.

## How it's built

- A `Class` Durable Object per class: the chat history, the members online, the
  project list, broadcast to every connected member (the same pattern as
  `StudioAgent`).
- Projects keep their own `StudioAgent`. "Who asked" goes into each turn; the
  ownership check on changes widens from "the owner" to "a member of the class".
- Publishing stays per project; the wall shows unpublished work to the class
  only.

## Open

1. Can anyone change anyone's project directly, or does a change by someone
   else land as a suggestion the owner accepts? (Start direct, with history and
   undo; see how it feels.)
2. Chat in Estonian and English mixed: the UI stays English for now.
3. Notifications between meetups (someone changed your project): email, web
   push, or nothing.
4. Publishing stays with the owner for now (the studio refuses a peer's
   publish). Should a peer be able to publish, or ask the owner to?
5. A peer's change is billed to the peer (their `usage` row), the project stays
   the owner's. Right for budgets later?

## Built (2026-10-22)

- **`Class` Durable Object** (`apps/studio/src/class.js`), one per school,
  named by `people.school_id`, at `/agents/class/<school>`; the plain `agents`
  `Agent`. Chat messages `{id, person, text, at, project}` in the DO's own SQL
  table (not state): the last 200 on connect, 200 more per "older" request.
  Presence from the open sockets; new messages and presence are broadcast. A
  message can carry a project of the same class (others are dropped); the
  chat shows its latest screenshot, title and owner, linked.
- **Peers on projects.** The Worker checks the person's school against the
  class name or the project owner's school before any socket or agent request,
  and passes the person to the agent in `x-visualia-person` (overwritten, so a
  client can't set it). Sockets only from the studio's own origin. `api()`
  lists, opens, reads versions and files for any project in the school;
  publish stays the owner's. Each user turn and version carries `person`; the
  gateway row goes to whoever asked. Automatic "Fix it" runs only for whoever
  asked last, so a peer just looking sends nothing. Published-site rules
  unchanged.
- **Migration** `0006_updated_at.sql`: `projects.updated_at`, set on each new
  version, so "Everyone's work" is latest change first.
- **Home (`/`)**: chat beside "Everyone's work" (thumbnails, title, owner,
  when; no screenshot → title only; New project). Phone ≤ 640 px: "Chat" and
  "Everyone's work" as two text links, the message field at the bottom
  (`100dvh`, `visualViewport` height for the keyboard, safe-area insets). A
  pasted project link or "Share in chat" on a project page attaches the
  project.
- **Project page on a phone**: the conversation is the page; "Preview version
  n" (or tapping a version) opens it full screen, Close or Back returns to the
  same scroll position. "by <owner>" and the asker's name on others' turns.
- **Verified** with two keys (`eka-test-001`, `eka-test-002`): chat both ways,
  presence in and out, person 2's change on person 1's project credited (turn,
  version and usage row), person 2 refused publish, another class and a
  socket without the studio origin refused; renders at 375 × 812 and
  1280 × 800 checked by eye.
- **Not yet**: remix, speech to text, live refresh of the wall (it reloads on
  focus and when a project is shared), names instead of ids, undo of a peer's
  change beyond picking an earlier version.
