// One Class per school (its name is the school id): the class's permanent chat
// and who is here now. Messages live in the Durable Object's own SQL storage,
// so the history can grow; presence comes from the open connections. The
// Worker checks membership and passes the person in x-visualia-person.
// See plans/class-space.md.

import { Agent } from 'agents';

const PAGE = 200; // messages sent on connect, and per "older" request
const MAX_TEXT = 4000;

export class Class extends Agent {
  onStart() {
    this.sql`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person TEXT NOT NULL,
      text TEXT NOT NULL,
      at INTEGER NOT NULL,
      project TEXT
    )`;
    // The first board's records, gone with it (plans/board.md).
    this.sql`DROP TABLE IF EXISTS board_items`;
    this.sql`DROP TABLE IF EXISTS board_ops`;
  }

  // A shared project changed: a new version or screenshot, a new title, or
  // its visibility. Called by StudioAgent and the Worker over DO RPC. The home
  // pages reload everyone's work.
  workChanged({ project } = {}) {
    this.broadcast(JSON.stringify({ type: 'work', project: project ?? null }));
  }

  async onConnect(connection, ctx) {
    const person = ctx.request.headers.get('x-visualia-person');
    if (!person) return connection.close(4001, 'no person');
    connection.setState({ person });
    const messages = this.sql`SELECT * FROM messages ORDER BY id DESC LIMIT ${PAGE}`.reverse();
    connection.send(JSON.stringify({
      type: 'hello', me: person, online: this.online(), more: messages.length === PAGE,
      messages: await this.withProjects(messages),
    }));
    this.presence();
  }

  // The latest messages, for a reader outside the page (the MCP server,
  // read-only): the same rows and project links the chat shows.
  async recent(limit = 50) {
    const n = Math.min(Math.max(Number(limit) || 50, 1), PAGE);
    return this.withProjects(this.sql`SELECT * FROM messages ORDER BY id DESC LIMIT ${n}`.reverse());
  }

  onClose(connection) { this.presence(connection.id); }
  onError(connection) { this.presence(connection.id); }

  async onMessage(connection, raw) {
    const person = connection.state?.person;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!person || !msg) return;

    if (msg.type === 'older' && Number.isInteger(msg.before)) {
      const messages = this.sql`SELECT * FROM messages WHERE id < ${msg.before} ORDER BY id DESC LIMIT ${PAGE}`.reverse();
      return connection.send(JSON.stringify({ type: 'older', more: messages.length === PAGE, messages: await this.withProjects(messages) }));
    }

    if (msg.type === 'say') {
      const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, MAX_TEXT) : '';
      // A project must be shared with this class; a private or foreign one is dropped, not stored.
      const project = typeof msg.project === 'string' && /^\w{1,32}$/.test(msg.project) && (await this.project(msg.project)) ? msg.project : null;
      if (!text && !project) return;
      const at = Date.now();
      const [row] = this.sql`INSERT INTO messages (person, text, at, project) VALUES (${person}, ${text}, ${at}, ${project}) RETURNING id`;
      const [m] = await this.withProjects([{ id: row.id, person, text, at, project }]);
      this.broadcast(JSON.stringify({ type: 'message', message: m }));
    }
  }

  // Who has the class open now, once each.
  online(leaving) {
    const people = new Set();
    for (const c of this.getConnections()) if (c.id !== leaving && c.state?.person) people.add(c.state.person);
    return [...people].sort();
  }

  presence(leaving) { this.broadcast(JSON.stringify({ type: 'presence', online: this.online(leaving) })); }

  async project(id) {
    return await this.env.DB.prepare(
      "SELECT p.id, p.title, p.person_id, p.versions FROM projects p JOIN people o ON o.id = p.person_id WHERE p.id = ? AND o.school_id = ? AND p.visibility = 'class'",
    ).bind(id, this.name).first();
  }

  // Attach each referenced project's current title, owner and latest version,
  // so the chat can show its latest screenshot. A project made private since
  // it was shared drops out (null), for everyone.
  async withProjects(messages) {
    const ids = [...new Set(messages.map((m) => m.project).filter(Boolean))];
    if (!ids.length) return messages;
    const { results } = await this.env.DB.prepare(
      `SELECT p.id, p.title, p.person_id AS owner, p.versions FROM projects p JOIN people o ON o.id = p.person_id
       WHERE o.school_id = ? AND p.visibility = 'class' AND p.id IN (${ids.map(() => '?').join(',')})`,
    ).bind(this.name, ...ids).all();
    const byId = Object.fromEntries(results.map((p) => [p.id, p]));
    return messages.map((m) => (m.project ? { ...m, project: byId[m.project] ?? null } : m));
  }
}
