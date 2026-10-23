---
status: building
---

# MCP: your own AI tool, working with Visualia

`mcp.visualia.space` is one hosted MCP server. A student or the teacher adds
it to their own AI tool (Claude, ChatGPT, Cursor, anything that speaks MCP),
signs in once with their course key, and the tool can then work with
Visualia for them: exactly what they could do in the studio, no more.

## Decided

- **It is for everyone in the course, students and the teacher alike, from the
  start** (the teacher, 2026-10-22). So the sign-in page and every tool
  description are written for students: plain words, no jargon
  (`.claude/skills/visualia-writing/SKILL.md`).
- **Tentatively yes, to confirm with the class before step 2** (the teacher:
  "I do not know. I guess so?"):
  - Changes made through MCP count against the person's budget, the same as
    changes made on the page (once budgets exist).
  - Outside agents may act on shared works, the same as a person could:
    credited to the person and undoable on the wall. To be agreed with the
    class at the start of the course.

## Three steps

| Step | Tools | What it gives |
|---|---|---|
| 1. Read (built) | list everyone's work, read a project and its versions, read the class chat, the usage page | "Summarise what the class made this week", "show me the p5 sketch from yesterday" |
| 2. Make | change a project (the same studio pipeline as the page), make a project, post to the chat | someone works in their own tool and the result lands on the wall like any other version |
| 3. Board | place and group works, notes | an agent tidies the wall, with the board's undo |

## How it fits

- **The same rules as the pages.** Every tool reads through the studio's
  `ForMcp` entrypoint over a service binding, never the internet. It calls the
  studio's own handlers (`api()`, `usage()`, the Class Durable Object), so the
  visibility rules can't drift: a private project stays its owner's, another
  school's work doesn't exist. Step 1 is GET only.
- **Model calls go through the gateway** (step 2 on), so usage is recorded as
  now.
- **Sign-in: the course key, through OAuth.** The tool sends the person to
  `mcp.visualia.space/authorize`; they enter their key there, never in the
  tool. The page says which tool is asking, where the access goes, and what it
  can read. The token carries the person and their school. Revoking the key
  stops the tool at its next call.

## What it is for in the course

Students see AI as a tool that acts on shared things, not only a chat box,
and the platform shows the honest edge of that: whatever their own agent does
is visible, credited and undoable on the wall, like anything a person does.

## Built (step 1, 2026-10-22)

`apps/mcp`, a Worker at `mcp.visualia.space`: the stateless MCP handler from
the Agents SDK (`createMcpHandler`, `agents` 0.29.0, `@modelcontextprotocol/server`
2.3.1; `McpAgent` is deprecated for new servers) behind
`@cloudflare/workers-oauth-provider` 1.2.4 (`OAuthProvider`: one Worker is both
the authorization server and the MCP resource; dynamic client registration
and Client ID Metadata Documents both on; one scope, `read`; grants in KV
`OAUTH_KV`).

**Address to add in an AI tool:** `https://mcp.visualia.space/mcp`
(Streamable HTTP; the tool finds the sign-in by itself).

**Sign-in page** (`src/authorize.js`, words in `src/text.json`): the tool's
name (escaped: it chose it itself), whether the name is checked, where the
access goes (with a warning for an app on this computer), the course key,
Allow / Don't allow. The key is checked like the studio's sign-in (SHA-256
hash in D1, not revoked, 10 tries a minute per address) and never stored.

**Tools** (all read-only, each answers JSON as text):
- `list_work` → `{ you, shared: [{ id, title, owner, versions, updated, link, published? }], your_private_projects: [...] }`
- `get_project { id, version? }` → `{ id, title, owner, versions, kind, shared, link, published?, remixed_from?, remixes }`; with a version also `html` (a one-page project, cut at 60,000 characters) or `files: [{ path, size }]` and `preview` (a multi-file project). Someone else's private project: "Not found."
- `read_chat { limit? }` → `[{ at, person, text, project? }]`, oldest first, at most 200
- `usage_summary` → what the usage page shows (`today, week, all, people, models, recent`), never prompt or answer text

**Verified** (scratchpad `mcptest.mjs`, through the real OAuth flow: register,
the sign-in form filled by script with keys from `.keys.local`, PKCE, token,
then the MCP client SDK 2.3.1): no token → 401 pointing at the resource
metadata; a wrong key → the page says so, no code; Don't allow →
`access_denied`; the four tools listed; as eka-test-001 11 shared works and 9
private projects; eka-test-002's list has none of those 9, and `get_project`
on one answers "Not found."; the same the other way round (6 private); both
see the same shared work; a multi-file version lists its four files with a
preview link; a missing version is an error; the chat and the usage page read
(usage rows carry no prompt or content fields). A key revoked while a tool was
connected: its next call refused (401), and the key can't sign in again

**Tried from a real AI tool** (2026-10-23): added by address, signed in
in the browser with the teacher's own key, the tools answer. Step 1 done;
step 2 (make) waits for the class to agree.
(temporary person `mcp-test`, removed afterwards). The sign-in page at 375 and
1280 px: readable, no console errors.

**Not yet:** a check from a real AI tool's own connector (Claude, ChatGPT);
steps 2 and 3.
