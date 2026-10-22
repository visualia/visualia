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
- **Private projects**: a project starts private, the owner's alone; nobody
  else sees it, the teacher included, so making something never feels watched
  over the shoulder. The owner shares it with the class (and can take it back)
  with one link on the project page. Shared projects are everything above;
  private ones are on nobody's wall, in no chat, and only "a private project"
  on the usage page.

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
- `projects.visibility`: `private` | `class`, checked by the Worker for every
  read, socket and agent request, and by the `Class` DO for chat attachments.

## Open

1. Can anyone change anyone's project directly, or does a change by someone
   else land as a suggestion the owner accepts? (Start direct, with history and
   undo; see how it feels.)
2. Chat in Estonian and English mixed: the UI stays English for now.
3. Notifications between meetups (someone changed your project): email, web
   push, or nothing.
4. ~~Should a peer be able to publish?~~ Closed: publish is owner-only, for
   private and shared projects alike.
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

## Built: private projects (2026-10-22)

- **Migration** `0007_visibility.sql`: `projects.visibility`, default
  `private`; every project made before it set to `class`, so nothing already
  shared disappeared. New projects are private.
- **Worker**: one check, `visible()` (own project, or shared with your
  school), behind `api()` (open, versions, files, publish, visibility) and
  `onBeforeConnect` / `onBeforeRequest`. Someone else's private project is a
  404, like another school's. `GET /api/projects` returns the class's shared
  projects (yours too) and, separately, your own private ones.
  `POST /api/projects/:id/visibility` is the owner's alone; making a project
  private calls the agent's `revoke(owner)` over RPC, which sends `private`
  and closes every other socket (code 4003). A closing socket can take ~10 s
  to report closed, hence the message first; an `ask` arriving on a socket
  whose person may no longer see the project is refused in the agent too.
- **Class DO**: a private project id in a message is dropped, the owner's
  included (the chat is the class's); a project made private after it was
  shared drops out of old messages for everyone.
- **Usage**: someone else's private project shows as "a private project".
- **Home**: "Everyone's work" is shared projects only; "Your private projects"
  is a plain list under it, in the same column, on a phone too (simpler than
  a third view). "New project" makes a private one.
- **Project page**: under the title, for the owner, "Share with class" or
  "Make private". "Share in chat" only when shared. A peer whose project goes
  private sees the page empty out with "The owner made this project private.";
  opening a private project that isn't yours shows "Not found".
- **Published pictures**: `projects.visualia.space/<person>/<slug>/<n>-<k>.jpg`
  serves only pictures the published version names. Not "only `<published>-k`":
  a change keeps the earlier `src="1-1.jpg"`, so v2 of a page can rightly use
  v1's picture.
- **Verified** by script with `eka-test-001` and `eka-test-002` on the live
  studio (`vistest.mjs`, 30 checks): person 2 can't list, open, read versions
  or screenshots, connect, make an agent request, change visibility or attach
  person 1's private project; shared, person 2 lists, reads, connects and
  attaches it, but can't publish or make it private; private again, person 2's
  open socket is told at once and closed, their ask does nothing, and every
  gate refuses again; the owner publishes a private project. Pictures: an
  older version's picture 404 once a version without it is published, 200
  while the version using it is published; a carried-over picture stays 200.
  Rendered at 375 × 812 and 1280 × 800 and checked by eye.
