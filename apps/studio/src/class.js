// One Class per school (its name is the school id): the class's permanent chat,
// who is here now, and the wall. Messages live in the Durable Object's own SQL
// storage, so the history can grow; presence comes from the open connections.
// The Worker checks membership and passes the person in x-visualia-person.
// See plans/class-space.md and plans/board.md.
//
// The wall is a board document (packages/board): records in board_items, the
// last KEEP ops in board_ops. A socket gets a snapshot on connect (or the ops
// since ?since=<seq> on reconnect), then each op. Read-only for now: only
// workChanged (StudioAgent and the Worker, over DO RPC) writes it.

import { Agent } from 'agents';
import { createHub } from '../../../packages/board/src/sync.js';
import { placeholder } from './thumbs.js';

const PAGE = 200; // messages sent on connect, and per "older" request
const MAX_TEXT = 4000;
const KEEP = 2000; // ops kept for replay, undo and "since you were here"

export class Class extends Agent {
  onStart() {
    this.sql`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person TEXT NOT NULL,
      text TEXT NOT NULL,
      at INTEGER NOT NULL,
      project TEXT
    )`;
    this.sql`CREATE TABLE IF NOT EXISTS board_items (id TEXT PRIMARY KEY, json TEXT NOT NULL)`;
    this.sql`CREATE TABLE IF NOT EXISTS board_ops (seq INTEGER PRIMARY KEY, op_id TEXT, op TEXT NOT NULL)`;
  }

  // The board's hub, loaded from SQL once per wake. The first time ever, the
  // class's shared projects are put on it.
  board() {
    return (this._wall ??= (async () => {
      const items = Object.fromEntries(this.sql`SELECT json FROM board_items`.map((r) => { const i = JSON.parse(r.json); return [i.id, i]; }));
      const log = this.sql`SELECT op FROM board_ops ORDER BY seq`.map((r) => JSON.parse(r.op));
      this._hub = createHub({
        keep: KEEP, seq: log.at(-1)?.seq ?? 0, items, log,
        save: (op, ids) => {
          for (const id of ids) {
            const it = this._hub.doc.items[id];
            if (it) this.sql`INSERT OR REPLACE INTO board_items (id, json) VALUES (${id}, ${JSON.stringify(it)})`;
            else this.sql`DELETE FROM board_items WHERE id = ${id}`;
          }
          this.sql`INSERT INTO board_ops (seq, op_id, op) VALUES (${op.seq}, ${op.opId ?? null}, ${JSON.stringify(op)})`;
          this.sql`DELETE FROM board_ops WHERE seq <= ${op.seq - KEEP}`;
        },
      });
      if (!log.length) {
        const { results } = await this.env.DB.prepare(
          "SELECT p.id FROM projects p JOIN people o ON o.id = p.person_id WHERE o.school_id = ? AND p.visibility = 'class' AND p.versions > 0",
        ).bind(this.name).all();
        for (const p of results) await this.sync(p.id);
      }
      return this._hub;
    })().catch((err) => { this._wall = null; throw err; }));
  }

  // A project has a new version, a screenshot, a new title, or changed
  // visibility. Called by StudioAgent and the Worker over DO RPC; safe to repeat.
  async workChanged({ project, by } = {}) {
    await this.board();
    await this.sync(project, by);
  }

  // Bring one work record in line with D1 and R2: on the wall while shared with
  // the class and it has a version; off it (del) otherwise. The record id is
  // the project id. `t` moves only with a new version (the last real change).
  async sync(id, by) {
    const items = this._hub.doc.items;
    const it = items[id];
    const p = await this.env.DB.prepare(
      `SELECT p.id, p.title, p.person_id, p.versions, coalesce(p.updated_at, p.created_at) AS t FROM projects p JOIN people o ON o.id = p.person_id
       WHERE p.id = ? AND o.school_id = ? AND p.visibility = 'class' AND p.versions > 0`,
    ).bind(id, this.name).first();
    if (!p) return it && this.op({ op: 'del', id });
    const n = p.versions;
    const t = Date.parse(p.t.endsWith('Z') || p.t.includes('T') ? p.t : `${p.t.replace(' ', 'T')}Z`);
    // the picture: this version's screenshot once it exists, the last one until then
    const shot = (await this.env.PROJECTS.head(`projects/${id}/${n}.png`)) ? n : it?.shot ?? null;
    const pic = shot && shot !== it?.shot ? { shot, ph: await placeholder(this.env, id, shot).catch(() => null) } : {};
    if (!it) {
      return this.op({ op: 'put', item: { id, kind: 'work', project: id, version: n, title: p.title, by: by ?? p.person_id, owner: p.person_id, t, ...pic } });
    }
    const fields = { ...pic };
    if (n > it.version) Object.assign(fields, { version: n, by: by ?? p.person_id, t });
    if (p.title !== it.title) fields.title = p.title;
    if (Object.keys(fields).length) this.op({ op: 'set', id, fields });
  }

  op(op) {
    const { op: done } = this._hub.receive({ ...op, by: 'studio' });
    if (done) this.broadcast(JSON.stringify({ type: 'op', op: done }));
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
    // the wall: everything, or what changed since this socket's last seq
    const since = Number(new URL(ctx.request.url).searchParams.get('since') ?? -1);
    connection.send(JSON.stringify((await this.board()).hello(Number.isInteger(since) ? since : -1)));
    this.presence();
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
