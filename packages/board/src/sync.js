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

import { emptyDoc, applyOp } from './doc.js';

const target = (op) => op.item?.id ?? op.id;

// The hub: gives each op the next seq, applies it, keeps the last `keep` ops
// for replay. `save(op, ids)` persists one op and the records it touched.
export function createHub({ keep = 2000, seq = 0, items = {}, log = [], save = () => {} } = {}) {
  const doc = { v: 1, seq, items };
  const seen = new Set(log.map((o) => o.opId).filter(Boolean));
  return {
    doc,
    // -> { op } to broadcast, or { ack } for a duplicate (send to the sender only)
    receive(op) {
      if (op.opId && seen.has(op.opId)) return { ack: op.opId };
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
  let online = false, n = 0, synced = false;

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

  function take(op, touched) {
    if (op.seq <= base.seq) return;
    if (op.seq > base.seq + 1) { ahead.set(op.seq, op); return; }
    for (let o = op; o; o = ahead.get(base.seq + 1)) {
      ahead.delete(o.seq);
      applyOp(base, o);
      touched.add(target(o));
      if (o.opId) pending = pending.filter((p) => p.opId !== o.opId);
    }
  }

  return {
    doc,
    get since() { return synced ? base.seq : -1 },
    get pending() { return pending.length },
    get base() { return base },

    // My change: shown at once, sent when connected (or after the next sync).
    local(op) {
      const o = { ...op, opId: `${prefix}.${++n}`, by, base: base.seq };
      pending.push(o);
      show([target(o)]);
      if (online) send({ type: 'op', op: o });
      return o;
    },

    receive(msg) {
      const touched = new Set();
      if (msg.type === 'board') {
        if (msg.items && msg.seq > base.seq) { // (out of order, I may already be past it)
          for (const id of Object.keys(base.items)) touched.add(id);
          base.items = {};
          for (const item of msg.items) { base.items[item.id] = { ...item }; touched.add(item.id); }
          base.seq = msg.seq;
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
