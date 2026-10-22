// Convergence fuzz: N simulated clients make random ops over a network with
// random delays, drops on disconnect and reconnects that replay since their
// last seq (or get a snapshot once the log is compacted past it). After quiet,
// every client's document must equal the server's. plans/board.md, "Proving it".
//
// The clients arrange the canvas as people do (step 4): move works, put them
// into groups between neighbours, make, rename, move and delete groups, and
// press undo. Each op must show at once and mean what it says (checked on the
// client's own canvas layout); each undo is checked against the server's full
// log by an independent replay; a person's op is never lost unless its target
// is gone at the server, and forged ops (works, deletes, titles) never land.
//
//   node --test packages/board/test/sync.test.js          (SEEDS=n to change the count)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHub, createClient, docHash } from '../src/sync.js';
import { applyOp, between, items, emptyDoc, members, move, place, unplace, newGroup, rename, removeGroup, nextTo } from '../src/doc.js';
import { canvas } from '../src/layouts.js';

const SEEDS = Number(process.env.SEEDS ?? 3000);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const stats = { ops: 0, snapshots: 0, replays: 0, acks: 0, reconnects: 0, shuffled: 0, kinds: {}, undone: 0, undoFields: 0, undoSkipped: 0, undoPartial: 0, undoNone: 0, refused: 0, forged: 0 };
const count = (k) => { stats.kinds[k] = (stats.kinds[k] ?? 0) + 1; };
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function run(seed) {
  const r = rng(seed);
  const int = (n) => Math.floor(r() * n);
  const pick = (a) => a[int(a.length)];

  // A tiny event loop in simulated milliseconds.
  let now = 0, order = 0;
  const queue = [];
  const at = (t, fn) => {
    const e = { t, o: order++, fn };
    let i = queue.length;
    while (i > 0 && (queue[i - 1].t > t || (queue[i - 1].t === t && queue[i - 1].o > e.o))) i--;
    queue.splice(i, 0, e);
  };

  const keep = 5 + int(40);
  const hub = createHub({ keep, now: () => now }); // a small log, so snapshots after compaction happen too
  const fifo = r() < 0.8;          // a WebSocket is FIFO; some seeds shuffle anyway, to test the gap buffer
  if (!fifo) stats.shuffled++;
  const sequenced = new Map();     // opId -> seq, to catch an op applied twice
  const full = [];                 // every sequenced op, never compacted: the oracle's log
  const forged = new Set();
  const N = 2 + int(5);
  const works = Array.from({ length: 4 + int(8) }, (_, i) => `w${i}`);

  // One socket per connection: FIFO both ways, everything in flight dropped when it closes.
  const peers = Array.from({ length: N }, (_, k) => {
    const peer = { k, conn: null, made: new Map(), groups: 0, undone: new Set(), jumps: [] };
    peer.client = createClient({
      by: `p${k}`, prefix: `c${k}`,
      send: (msg) => { const c = peer.conn; if (c) deliver(c, 'up', () => fromClient(peer, c, msg)); },
    });
    return peer;
  });

  function deliver(c, dir, fn) {
    c[dir] = (fifo ? Math.max(c[dir], now) : now) + 1 + int(40);
    at(c[dir], () => { if (c.open) fn(); });
  }
  const toClient = (peer, msg) => {
    const c = peer.conn;
    if (c) deliver(c, 'down', () => {
      const b = peer.client.base.seq, o = peer.client.origin;
      peer.client.receive(JSON.parse(JSON.stringify(msg)));
      if (peer.client.origin !== o) peer.jumps.push([b, peer.client.origin]); // a snapshot: base jumped from b
    });
  };
  function fromClient(peer, c, msg) {
    const op = JSON.parse(JSON.stringify(msg.op));
    const had = clone(hub.doc.items[op.id ?? op.item?.id]);
    const ing = op.fields?.in;
    const res = hub.receive(op, `p${peer.k}`);
    if (res.ack) stats.acks++;
    if (forged.has(op.opId)) assert.ok(res.refused || (res.ack && !sequenced.has(op.opId)), `seed ${seed}: a forged ${op.op} landed`);
    else if (res.refused) {
      // only when its target is gone at the server (or not there yet: shuffled
      // seeds), or it is a resend of one already sequenced, past the dedupe window
      stats.refused++;
      assert.ok(!had || (ing && !hub.doc.items[ing]) || sequenced.has(op.opId), `seed ${seed}: ${op.opId} (${op.op} ${JSON.stringify(op.fields ?? op.item)}) refused`);
    }
    const was = sequenced.get(op.opId);
    assert.ok(!res.op || was === undefined || was <= hub.doc.seq - keep - 1, `seed ${seed}: ${op.opId} applied twice`);
    if (res.op) { sequenced.set(op.opId, res.op.seq); full.push(res.op); assert.equal(res.op.by, `p${peer.k}`); }
    if (res.ack) toClient(peer, { type: 'ack', opId: res.ack });
    else for (const p of peers) toClient(p, { type: 'op', op: res.op });
  }
  function connect(peer) {
    const c = { open: true, up: now, down: now };
    peer.conn = c;
    const hello = hub.hello(peer.client.since); // the server answers at once, before any later broadcast
    if (peer.client.since >= 0) stats[hello.items ? 'snapshots' : 'replays']++;
    toClient(peer, hello);
  }
  function disconnect(peer) {
    if (!peer.conn) return;
    peer.conn.open = false;
    peer.conn = null;
    peer.client.disconnected();
  }

  // --- the undo oracle: who wrote a field last, from the full log replayed
  // since the client's last snapshot up to its base, then its pending ops.
  function writersAt(origin, upto, pend) {
    const doc = emptyDoc(), w = new Map();
    for (const o of full) {
      if (o.seq > upto) break;
      const touched = applyOp(doc, o).length;
      if (o.seq <= origin || !touched) continue;
      const id = o.item?.id ?? o.id;
      if (o.op === 'put') w.set(id, { '*': o.opId ?? null });
      else if (o.op === 'del') w.delete(id);
      else { const m = w.get(id) ?? {}; for (const f of Object.keys(o.fields)) m[f] = o.undo ? o.w?.[f] ?? null : o.opId ?? null; w.set(id, m); }
    }
    return (id, f) => {
      for (let i = pend.length - 1; i >= 0; i--) {
        const p = pend[i];
        if ((p.item?.id ?? p.id) !== id) continue;
        if (p.op !== 'set') return p.opId;
        if (f in p.fields) return p.undo ? p.w?.[f] ?? null : p.opId;
      }
      const m = w.get(id);
      return m && (f in m ? m[f] : m['*']);
    };
  }
  const stateAt = (upto) => { const doc = emptyDoc(); for (const o of full) { if (o.seq > upto) break; applyOp(doc, o); } return doc; };
  // What undoing T would write now, by the oracle: { fields, w }, or null.
  function expectUndo(peer, T, who) {
    const c = peer.client;
    const id = T.op.item?.id ?? T.op.id;
    if (peer.undone.has(T.op.opId) || !c.doc.items[id]) return null;
    if (T.op.op === 'put') return who(id, 'gone') === T.op.opId ? { fields: { gone: true }, w: { gone: null } } : null;
    const seq = sequenced.get(T.op.opId);
    // its echo reached me (no snapshot jumped over it): the values and writers
    // just before it in server order; otherwise those I saw when I made it
    const echoed = seq !== undefined && seq <= c.base.seq && !peer.jumps.some(([b, o]) => b < seq && seq <= o);
    const then = Math.max(0, ...peer.jumps.map(([, o]) => o).filter((o) => o < seq));
    const prior = echoed ? stateAt(seq - 1).items[id] : T.before;
    const priorW = echoed ? writersAt(then, seq - 1, []) : writersAt(T.origin, T.baseSeq, T.queue);
    const fields = {}, w = {};
    for (const f of Object.keys(T.op.fields)) {
      if (who(id, f) !== T.op.opId) continue;
      fields[f] = prior?.[f] ?? null;
      w[f] = priorW(id, f) ?? null;
    }
    return Object.keys(fields).length ? { fields, w } : null;
  }

  // Random edits, as people (and the studio agent) make them. Each shows at
  // once and means what it says on the client's own canvas.
  function edit(peer) {
    const c = peer.client;
    if (r() < 0.12) return undo(peer);
    const before = { origin: c.origin, baseSeq: c.base.seq, queue: c.queue };
    const made = change(peer);
    if (!made) return;
    const { o, kind, check } = made;
    count(kind);
    const id = o.id ?? o.item.id;
    peer.made.set(o.opId, { op: o, ...before, before: clone(made.prior) });
    const it = c.doc.items[id];
    for (const [k, v] of Object.entries(o.fields ?? {})) if (it) assert.deepEqual(it[k], v ?? undefined, `seed ${seed}: my ${k} didn't show at once`);
    check?.(canvas(items(c.doc)));
  }

  function change(peer) {
    const c = peer.client, d = c.doc;
    const groups = Object.values(d.items).filter((i) => i.kind === 'group');
    const ws = Object.values(d.items).filter((i) => i.kind === 'work');
    const x = r();
    const find = (L, id) => L.boxes.find((b) => b.id === id);
    if (x < 0.1 || !groups.length) {
      const id = `g-${peer.k}-${++peer.groups}`, name = `G${int(9)}`;
      return { kind: 'group', o: c.local(newGroup(id, name, { x: int(2000), y: int(2000) })), check: (L) => {
        assert.ok(L.groups.some((g) => g.id === id) && L.labels.some((l) => l.group === id && l.text === name), `seed ${seed}: new group not on the canvas`);
      } };
    }
    const g = pick(groups);
    if (x < 0.18) {
      const name = `G${int(9)}`;
      return { kind: 'rename', prior: g, o: c.local(rename(g.id, name)), check: () => assert.equal(c.doc.items[g.id].name, name, `seed ${seed}: rename didn't show`) };
    }
    if (x < 0.28) {
      if (g.gone) return { kind: 'undelete', prior: g, o: c.local({ op: 'set', id: g.id, fields: { gone: null } }) };
      return { kind: 'delete', prior: g, o: c.local(removeGroup(g.id)), check: (L) => {
        assert.ok(!L.groups.some((a) => a.id === g.id), `seed ${seed}: a deleted group still shows`);
        for (const w of members(c.doc, g.id)) assert.ok(L.unplaced.includes(w.id), `seed ${seed}: a deleted group's work isn't back in "Not placed yet"`);
      } };
    }
    if (x < 0.34) return { kind: 'move group', prior: g, o: c.local({ op: 'set', id: g.id, fields: { at: { x: int(2000), y: int(2000) } } }) };
    if (x < 0.37) { forge(peer); return null; }
    if (!ws.length) return null;
    const w = pick(ws);
    if (x < 0.6) {
      const to = { x: int(2000), y: int(2000) };
      return { kind: 'move', prior: w, o: c.local(move(w.id, to)), check: (L) => {
        const b = find(L, w.id);
        assert.ok(b && b.x === to.x && b.y === to.y, `seed ${seed}: a moved work isn't where it was dropped`);
      } };
    }
    if (x < 0.92) {
      const list = members(d, g.id, w.id);
      const j = int(list.length + 1);
      // two people inserted at once (no key fits between), or after a work an undo left without a key (those go last)
      const tie = (list[j - 1] && list[j] && list[j - 1].order === list[j].order) || (list[j - 1] && !list[j - 1].order);
      return { kind: 'order', prior: w, o: c.local(place(d, w.id, g.id, j)), check: (L) => {
        if (!tie) assert.equal(members(c.doc, g.id).findIndex((i) => i.id === w.id), j, `seed ${seed}: a placed work isn't where it was put`);
        const area = L.groups.find((a) => a.id === g.id), b = find(L, w.id);
        if (area) assert.ok(b.x >= area.x && b.x < area.x + area.w && b.y >= area.y && b.y < area.y + area.h, `seed ${seed}: a placed work isn't in its group`);
        else assert.ok(L.unplaced.includes(w.id), `seed ${seed}: a work in a deleted group isn't unplaced`);
      } };
    }
    return { kind: 'unplace', prior: w, o: c.local(unplace(w.id)), check: (L) => assert.ok(L.unplaced.includes(w.id), `seed ${seed}: unplaced work isn't in "Not placed yet"`) };
  }

  // Ctrl+Z: the oracle says which of my ops it must undo and with which fields.
  function undo(peer) {
    const c = peer.client;
    const who = writersAt(c.origin, c.base.seq, c.queue);
    let want = null;
    let skipped = 0;
    for (const T of [...peer.made.values()].reverse()) {
      want = expectUndo(peer, T, who);
      if (want) { want.T = T; break; }
      if (!peer.undone.has(T.op.opId) && c.doc.items[T.op.item?.id ?? T.op.id]) skipped++; // someone else wrote all its fields since
    }
    const u = c.undo();
    if (!want) { assert.equal(u, null, `seed ${seed}: undo did something when nothing could be undone`); stats.undoNone++; return; }
    assert.ok(u, `seed ${seed}: undo did nothing; ${want.T.op.opId} could be undone`);
    assert.equal(u.undo, want.T.op.opId, `seed ${seed}: undo took ${u.undo}, not my newest undoable op ${want.T.op.opId}`);
    assert.deepEqual(u.fields, want.fields, `seed ${seed}: undo of ${u.undo} wrote the wrong fields or values`);
    assert.deepEqual(u.w, want.w, `seed ${seed}: undo of ${u.undo} restored the wrong writers`);
    peer.undone.add(u.undo);
    stats.undone++; stats.undoFields += Object.keys(u.fields).length;
    stats.undoSkipped += skipped;
    stats.undoPartial += Object.keys(u.fields).length < Object.keys(want.T.op.fields ?? { gone: 1 }).length;
    const it = c.doc.items[u.id];
    for (const [k, v] of Object.entries(u.fields)) assert.deepEqual(it[k], v ?? undefined, `seed ${seed}: undo didn't show at once`);
    if (it.kind === 'group' && u.fields.gone === null) {
      const L = canvas(items(c.doc));
      if (it.at) for (const w of members(c.doc, it.id)) assert.ok(!L.unplaced.includes(w.id), `seed ${seed}: undoing a delete didn't bring its works back`);
    }
  }

  // Ops a person may not make: the server must refuse every one.
  function forge(peer) {
    const c = peer.client;
    const w = pick(works), g = Object.keys(c.base.items).find((i) => i[0] === 'g'); // one the server has
    const op = pick([
      { op: 'put', item: { id: w, kind: 'work', project: w, version: 99, title: 'X', by: 'p0', t: now } },
      { op: 'put', item: { id: `g-x${int(9)}`, kind: 'work', project: w, name: 'X', title: 'X', at: { x: 0, y: 0 } } },
      { op: 'del', id: w },
      { op: 'set', id: w, fields: { title: 'X' } },
      { op: 'set', id: w, fields: { at: { x: 1, y: 1 }, version: 99 } },
      { op: 'set', id: w, fields: { in: 'w0' } },
      { op: 'set', id: g ?? w, fields: { gone: 'yes' } },
      ...(g ? [{ op: 'put', item: { id: g, kind: 'group', name: 'Taken', at: { x: 0, y: 0 } } }] : []),
    ]);
    const o = { ...op, opId: `f${peer.k}.${int(1e9)}`, by: 'p0' };
    forged.add(o.opId); stats.forged++;
    const conn = peer.conn;
    if (conn) deliver(conn, 'up', () => fromClient(peer, conn, { type: 'op', op: o }));
  }

  for (const p of peers) at(int(50), () => connect(p));
  const end = 1500 + int(1500);
  for (let i = 0, n = 40 + int(160); i < n; i++) {
    at(int(end), () => {
      const x = r();
      const p = pick(peers);
      if (x < 0.07) { stats.reconnects++; disconnect(p); at(now + int(300), () => !p.conn && connect(p)); }
      else if (x < 0.14) applyServer(); // the studio agent: workChanged over DO RPC
      else edit(p);
    });
  }
  // The studio: new works and versions, a work taken off (made private) and back,
  // and remixes, which go next to their source.
  function applyServer() {
    const id = pick(works);
    const it = hub.doc.items[id];
    const x = r();
    let op;
    if (!it) {
      const src = r() < 0.5 && pick(Object.values(hub.doc.items).filter((i) => i.kind === 'work').map((i) => i.id));
      op = { op: 'put', item: { id, kind: 'work', project: id, version: 1, title: 'A', by: 'agent', t: now, ...(src ? { from: src, ...nextTo(hub.doc, src) } : {}) } };
      if (src) count('remix');
    } else if (x < 0.2) op = { op: 'del', id };
    else op = { op: 'set', id, fields: { version: it.version + 1, t: now } };
    const res = hub.receive({ ...op, by: 'agent' });
    full.push(res.op);
    if (op.item?.from && op.item.in) {
      const list = members(hub.doc, op.item.in);
      const k = list.findIndex((i) => i.id === op.item.from);
      assert.ok(list[k + 1].id === id || list[k + 1].order === list[k].order, `seed ${seed}: a remix isn't next to its source`);
    }
    for (const p of peers) toClient(p, { type: 'op', op: res.op });
  }

  // Run, then quiet: everyone back online, every message delivered.
  while (queue.length) { const e = queue.shift(); now = e.t; e.fn(); }
  for (const p of peers) if (!p.conn) connect(p);
  while (queue.length) { const e = queue.shift(); now = e.t; e.fn(); }

  const want = docHash(hub.doc);
  assert.equal(docHash(stateAt(Infinity)), want, `seed ${seed}: the server's document isn't the replay of its log`);
  for (const p of peers) {
    assert.equal(p.client.pending, 0, `seed ${seed}: client ${p.k} still has pending ops`);
    assert.equal(docHash(p.client.doc), want, `seed ${seed}: client ${p.k} shows a different document`);
    assert.equal(p.client.doc.seq, hub.doc.seq, `seed ${seed}: client ${p.k} at seq ${p.client.doc.seq}, server ${hub.doc.seq}`);
  }
  for (const id of forged) assert.ok(!sequenced.has(id), `seed ${seed}: a forged op was sequenced`);
  for (const it of Object.values(hub.doc.items)) assert.ok(it.kind === 'group' ? it.id.startsWith('g-') : it.by === 'agent', `seed ${seed}: a work not made by the studio`);
  return hub.doc.seq;
}

test(`convergence: ${SEEDS} seeds, every client equals the server after quiet`, () => {
  const t = Date.now();
  for (let s = 1; s <= SEEDS; s++) stats.ops += run(s);
  console.log('fuzz', JSON.stringify({ seeds: SEEDS, ms: Date.now() - t, ...stats }));
  assert.ok(stats.ops > SEEDS * 20 && stats.snapshots && stats.replays && stats.acks && stats.undone && stats.undoSkipped && stats.kinds.remix, JSON.stringify(stats));
});

test('pending override: a remote write under my pending one never shows; my echo wins', () => {
  const hub = createHub();
  const sent = [];
  const a = createClient({ by: 'a', prefix: 'a', send: (m) => sent.push(m) });
  a.receive(hub.hello(-1));
  const put = hub.receive({ op: 'put', item: { id: 'w', kind: 'work', title: 'one', t: 1 } }).op;
  a.receive({ type: 'op', op: put });
  a.local({ op: 'set', id: 'w', fields: { title: 'mine' } });
  const remote = hub.receive({ op: 'set', id: 'w', fields: { title: 'theirs', version: 2 }, opId: 'b.1' }).op;
  a.receive({ type: 'op', op: remote });
  assert.equal(a.doc.items.w.title, 'mine');   // hidden under my pending op
  assert.equal(a.doc.items.w.version, 2);      // other fields come through
  const echo = hub.receive(sent.at(-1).op).op;
  a.receive({ type: 'op', op: echo });
  assert.equal(a.doc.items.w.title, 'mine');
  assert.equal(a.pending, 0);
  assert.equal(docHash(a.doc), docHash(hub.doc));
});

test('fractional keys: always between, never ending in 0', () => {
  const r = rng(1);
  const keys = [];
  for (let i = 0; i < 2000; i++) {
    const j = Math.floor(r() * (keys.length + 1));
    const k = between(keys[j - 1] ?? '', keys[j] ?? '');
    if (keys[j - 1] !== undefined) assert.ok(keys[j - 1] < k, `${keys[j - 1]} < ${k}`);
    if (keys[j] !== undefined) assert.ok(k < keys[j], `${k} < ${keys[j]}`);
    assert.ok(!k.endsWith('0'));
    keys.splice(j, 0, k);
  }
  assert.ok(Math.max(...keys.map((k) => k.length)) < 40);
});

test('group delete is a tombstone: its works wait unplaced, undo puts them back', () => {
  const doc = { seq: 0, items: {} };
  applyOp(doc, { op: 'put', item: { id: 'g', kind: 'group', name: 'G', at: { x: 0, y: 0 } } });
  applyOp(doc, { op: 'put', item: { id: 'w', kind: 'work', title: 'W', t: 1, in: 'g', at: { x: 0, y: 100 } } });
  const placed = () => canvas(items(doc)).boxes.find((b) => b.id === 'w').y;
  assert.equal(placed(), 0); // the group's first slot
  applyOp(doc, { op: 'set', id: 'g', fields: { gone: true } });
  assert.ok(placed() < 0);
  assert.equal(items(doc, 'group').length, 0);
  applyOp(doc, { op: 'set', id: 'g', fields: { gone: null } });
  assert.equal(placed(), 0);
});
