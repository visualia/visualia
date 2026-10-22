---
status: idea
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
