// One Board per board (its name is the board id): a surface with things on
// it, live for everyone in the class who has it open. The Worker checks that
// the person is in the board's school and passes them in x-visualia-person.
// See plans/boards.md.
//
// A thing is a record { id, type, x, y, ...its type's fields, by, t }, kept
// in this object's SQL storage. The only type so far is text: { text }.
// x and y are where its top left corner sits on the surface, in surface
// pixels. Anyone in the class may add, move, edit or remove anything; the last
// write to a field wins. `by` and `t` are who changed it last and when.
//
// Protocol (JSON text frames):
//   server -> page  { type: 'hello', me, things: [...] }
//   page -> server  { type: 'put', thing: { id, type, x, y, ...fields } }   add
//                   { type: 'set', id, fields: { x?, y?, ...fields } }      change
//                   { type: 'del', id }                                     remove
//   server -> pages the same, with `by` and `t` added, to everyone (the sender too)

import { Agent } from 'agents';

const MAX_THINGS = 2000;
const MAX = 1e6; // surface pixels from the origin, either way
// Per type: the fields a page may set, and how each is checked.
const TYPES = {
  text: { text: (v) => (typeof v === 'string' && v.length <= 5000 ? v : undefined) },
};
const coord = (v) => (Number.isFinite(v) && Math.abs(v) <= MAX ? Math.round(v) : undefined);

export class Board extends Agent {
  onStart() {
    this.sql`CREATE TABLE IF NOT EXISTS things (id TEXT PRIMARY KEY, json TEXT NOT NULL)`;
  }

  things() {
    return this.sql`SELECT json FROM things`.map((r) => JSON.parse(r.json));
  }

  async onConnect(connection, ctx) {
    const person = ctx.request.headers.get('x-visualia-person');
    if (!person) return connection.close(4001, 'no person');
    connection.setState({ person });
    connection.send(JSON.stringify({ type: 'hello', me: person, things: this.things() }));
  }

  async onMessage(connection, raw) {
    const by = connection.state?.person;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!by || !m || typeof m !== 'object') return;
    const t = Date.now();

    if (m.type === 'put') {
      const p = m.thing ?? {};
      const fields = TYPES[p.type];
      const x = coord(p.x), y = coord(p.y);
      if (!fields || typeof p.id !== 'string' || !/^[\w-]{1,40}$/.test(p.id) || x === undefined || y === undefined) return;
      if (this.get(p.id) || this.sql`SELECT count(*) AS n FROM things`[0].n >= MAX_THINGS) return;
      const thing = { id: p.id, type: p.type, x, y, by, t };
      for (const [k, check] of Object.entries(fields)) {
        const v = check(p[k]);
        if (v === undefined) return;
        thing[k] = v;
      }
      this.save(thing);
      return this.send({ type: 'put', thing });
    }

    if (m.type === 'set' && typeof m.id === 'string' && m.fields && typeof m.fields === 'object') {
      const thing = this.get(m.id);
      if (!thing) return;
      const changed = {};
      for (const [k, v] of Object.entries(m.fields)) {
        const ok = k === 'x' || k === 'y' ? coord(v) : TYPES[thing.type][k]?.(v);
        if (ok === undefined) return; // one bad field: the whole change is refused
        changed[k] = ok;
      }
      Object.assign(thing, changed, { by, t });
      this.save(thing);
      return this.send({ type: 'set', id: m.id, fields: changed, by, t });
    }

    if (m.type === 'del' && typeof m.id === 'string' && this.get(m.id)) {
      this.sql`DELETE FROM things WHERE id = ${m.id}`;
      this.touched();
      return this.send({ type: 'del', id: m.id, by, t });
    }
  }

  get(id) {
    const [r] = this.sql`SELECT json FROM things WHERE id = ${id}`;
    return r ? JSON.parse(r.json) : null;
  }

  save(thing) {
    this.sql`INSERT OR REPLACE INTO things (id, json) VALUES (${thing.id}, ${JSON.stringify(thing)})`;
    this.touched();
  }

  // The board list shows the latest change first; at most once a minute.
  touched() {
    if (Date.now() - (this._touched ?? 0) < 60_000) return;
    this._touched = Date.now();
    this.ctx.waitUntil(this.env.DB.prepare('UPDATE boards SET updated_at = ? WHERE id = ?').bind(new Date().toISOString(), this.name).run());
  }

  send(msg) { this.broadcast(JSON.stringify(msg)); }
}
