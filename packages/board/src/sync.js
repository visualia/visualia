// Sync for the board: the server's sequencer (the hub, run by the Class DO)
// and the client's optimistic apply. No DOM, no sockets: the browser, the DO
// and the fuzz test (test/sync.test.js) run this same code.
// See plans/board.md ("Sync and performance").
//
// Messages, server -> client:
//   { type: 'board', seq, items }       a snapshot (first connect, or the log was compacted past `since`)
//   { type: 'board', since, ops }       the ops after `since` (reconnect)
//   { type: 'op', op }                  one sequenced op, to everyone (the sender's copy is its echo)
//   { type: 'ack', opId }               an op the server already had (a resend after a lost echo)
// client -> server:
//   { type: 'op', op }                  op = { op, ..., opId, by, base }
// A person's op is checked by the hub (`accept` in doc.js); a refused one is
// answered with an ack, which drops it from the sender's pending list.
//
// Undo is per person and computed by the client from the ops it has seen in
// server order: each field of the board remembers which op wrote it last. Undo
// takes my newest op that isn't undone yet and puts back, for each field it
// set, the value from before it, unless someone else wrote that field since
// (then that field is skipped). An undo is an ordinary `set` with
// `undo: <opId>` and `w`, the writers it restores, so a second undo (mine or
// someone else's) sees the fields as they were.

import { emptyDoc, applyOp, accept } from './doc.js';

const target = (op) => op.item?.id ?? op.id;

// The hub: gives each op the next seq, applies it, keeps the last `keep` ops
// for replay. `save(op, ids)` persists one op and the records it touched.
export function createHub({ keep = 2000, seq = 0, items = {}, log = [], save = () => {}, now = Date.now } = {}) {
  const doc = { v: 1, seq, items };
  const seen = new Set(log.map((o) => o.opId).filter(Boolean));
  return {
    doc,
    // -> { op } to broadcast, or { ack } for a duplicate or a refused op (send
    // to the sender only). `by` = the person whose socket sent it: their ops
    // are checked; the studio's own (no `by`) are not.
    receive(op, by) {
      if (op.opId && seen.has(op.opId)) return { ack: op.opId };
      if (by !== undefined) {
        const ok = accept(doc, op, by, now());
        if (!ok) return { ack: op.opId, refused: true };
        op = ok;
      }
      const s = { ...op, seq: doc.seq + 1 };
      const ids = applyOp(doc, s);
      log.push(s);
      if (s.opId) seen.add(s.opId);
      while (log.length > keep) seen.delete(log.shift().opId);
      save(s, ids);
      return { op: s };
    },
    // What a client that has seen up to `since` needs (-1 = nothing yet).
    hello(since) {
      const first = log.length ? log[0].seq : doc.seq + 1;
      if (since >= first - 1 && since <= doc.seq) return { type: 'board', since, ops: log.filter((o) => o.seq > since) };
      return { type: 'board', seq: doc.seq, items: Object.values(doc.items) };
    },
  };
}

// The client: `base` is what the server confirmed, in seq order; `doc` is what
// is shown: base with my pending ops on top. A remote op on a field I have a
// pending op on lands in base but stays hidden under mine; my echo (a later
// seq) then wins anyway. No flicker, no rollback.
export function createClient({ by, send = () => {}, onChange = () => {}, prefix = Math.random().toString(36).slice(2, 8) } = {}) {
  const base = emptyDoc();
  const doc = emptyDoc();
  let pending = [];
  const ahead = new Map(); // seq -> op that arrived before an earlier one
  let online = false, n = 0, synced = false, origin = 0;
  const writers = new Map(); // id -> { field: opId of its last writer in base, '*': for a put }
  const mine = [];           // my ops, newest last: { op, prev, w, done }

  function show(ids) {
    for (const id of ids) {
      const scratch = { seq: 0, items: base.items[id] ? { [id]: { ...base.items[id] } } : {} };
      for (const p of pending) if (target(p) === id) applyOp(scratch, p);
      if (scratch.items[id]) doc.items[id] = scratch.items[id];
      else delete doc.items[id];
    }
    doc.seq = base.seq;
    if (ids.length) onChange(ids);
  }

  // Who last wrote a field, as base has it (unknown before my last snapshot).
  const baseWriter = (id, f) => { const w = writers.get(id); return w && (Object.hasOwn(w, f) ? w[f] : w['*']); };
  // ... and as shown: my pending ops on top.
  function writer(id, f) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i];
      if (target(p) !== id) continue;
      if (p.op !== 'set') return p.opId;
      if (Object.hasOwn(p.fields, f)) return p.undo ? p.w?.[f] ?? null : p.opId;
    }
    return baseWriter(id, f);
  }
  function track(o) {
    const id = target(o);
    if (o.op === 'put') writers.set(id, { '*': o.opId ?? null });
    else if (o.op === 'del') writers.delete(id);
    else {
      const w = writers.get(id) ?? {};
      for (const f of Object.keys(o.fields ?? {})) w[f] = o.undo ? o.w?.[f] ?? null : o.opId ?? null;
      writers.set(id, w);
    }
  }
  // What an op of mine changed from: the values and writers just before it.
  function before(m, items, who) {
    const it = items[target(m.op)];
    m.prev = {}; m.w = {};
    for (const f of Object.keys(m.op.fields ?? {})) { m.prev[f] = it?.[f] ?? null; m.w[f] = who(target(m.op), f) ?? null; }
  }

  function take(op, touched) {
    if (op.seq <= base.seq) return;
    if (op.seq > base.seq + 1) { ahead.set(op.seq, op); return; }
    for (let o = op; o; o = ahead.get(base.seq + 1)) {
      ahead.delete(o.seq);
      // my op, back in server order: what it undoes is what base had just before it
      const m = o.opId && mine.find((e) => e.op.opId === o.opId);
      if (m) before(m, base.items, baseWriter);
      if (applyOp(base, o).length) track(o);
      touched.add(target(o));
      if (o.opId) pending = pending.filter((p) => p.opId !== o.opId);
    }
  }

  // The undo Ctrl+Z would make now: my newest op not undone yet with a field
  // nobody else has written since. null = nothing to undo.
  function undoable() {
    for (let i = mine.length - 1; i >= 0; i--) {
      const m = mine[i];
      const id = target(m.op);
      if (m.done || !doc.items[id]) continue;
      const fields = {}, w = {};
      if (m.op.op === 'put') {
        if (writer(id, 'gone') === m.op.opId) { fields.gone = true; w.gone = null; }
      } else {
        for (const f of Object.keys(m.op.fields)) if (writer(id, f) === m.op.opId) { fields[f] = m.prev[f]; w[f] = m.w[f]; }
      }
      if (Object.keys(fields).length) return { m, op: { op: 'set', id, fields, undo: m.op.opId, w } };
    }
    return null;
  }

  const client = {
    doc,
    get since() { return synced ? base.seq : -1 },
    get pending() { return pending.length },
    get queue() { return [...pending] }, // (for tests)
    get base() { return base },
    get origin() { return origin }, // the seq of my last snapshot: undo reaches back to it
    get canUndo() { return !!undoable() },

    // My change: shown at once, sent when connected (or after the next sync).
    local(op) {
      const o = { ...op, opId: `${prefix}.${++n}`, by, base: base.seq };
      if (!o.undo && (o.op === 'set' || o.op === 'put')) {
        const m = { op: o };
        before(m, doc.items, writer);
        mine.push(m);
        if (mine.length > 500) mine.shift();
      }
      pending.push(o);
      show([target(o)]);
      if (online) send({ type: 'op', op: o });
      return o;
    },

    // Ctrl+Z: undo my newest op that can be. Returns the op, or null.
    undo() {
      const u = undoable();
      if (!u) return null;
      u.m.done = true;
      return client.local(u.op);
    },

    receive(msg) {
      const touched = new Set();
      if (msg.type === 'board') {
        if (msg.items && msg.seq > base.seq) { // (out of order, I may already be past it)
          for (const id of Object.keys(base.items)) touched.add(id);
          base.items = {};
          for (const item of msg.items) { base.items[item.id] = { ...item }; touched.add(item.id); }
          base.seq = origin = msg.seq;
          // who wrote what before this is unknown: those fields are skipped by undo
          // until someone writes them again (an undo can hand one back to me)
          writers.clear();
          for (const s of ahead.keys()) if (s <= msg.seq) ahead.delete(s);
          for (const p of pending) touched.add(target(p));
          const next = ahead.get(base.seq + 1);
          if (next) take(next, touched);
        } else if (msg.ops) {
          for (const op of msg.ops) take(op, touched);
        }
        synced = online = true;
        for (const p of pending) send({ type: 'op', op: p }); // the server drops ones it has (ack)
      } else if (msg.type === 'op') {
        take(msg.op, touched);
      } else if (msg.type === 'ack') {
        if (pending.some((p) => p.opId === msg.opId)) {
          touched.add(target(pending.find((p) => p.opId === msg.opId)));
          pending = pending.filter((p) => p.opId !== msg.opId);
        }
      }
      show([...touched]);
    },

    disconnected() { online = false; },
  };
  return client;
}

// A stable hash of a document's records (key order doesn't matter).
export function docHash(doc) {
  const norm = (v) => (v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm(v[k])]))
    : v);
  const s = JSON.stringify(Object.keys(doc.items).sort().map((id) => norm(doc.items[id])));
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16) + ':' + s.length;
}
