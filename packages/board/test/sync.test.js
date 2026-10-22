// Convergence fuzz: N simulated clients make random ops over a network with
// random delays, drops on disconnect and reconnects that replay since their
// last seq (or get a snapshot once the log is compacted past it). After quiet,
// every client's document must equal the server's. plans/board.md, "Proving it".
//
//   node --test packages/board/test/sync.test.js          (SEEDS=n to change the count)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHub, createClient, docHash } from '../src/sync.js';
import { applyOp, between, items } from '../src/doc.js';
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

const stats = { ops: 0, snapshots: 0, replays: 0, acks: 0, reconnects: 0, shuffled: 0 };

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
  const hub = createHub({ keep }); // a small log, so snapshots after compaction happen too
  const fifo = r() < 0.8;          // a WebSocket is FIFO; some seeds shuffle anyway, to test the gap buffer
  if (!fifo) stats.shuffled++;
  const sequenced = new Map();     // opId -> seq, to catch an op applied twice
  const N = 2 + int(5);
  const ids = Array.from({ length: 6 + int(10) }, (_, i) => (i < 3 ? `g${i}` : `w${i}`));

  // One socket per connection: FIFO both ways, everything in flight dropped when it closes.
  const peers = Array.from({ length: N }, (_, k) => {
    const peer = { k, conn: null };
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
    if (c) deliver(c, 'down', () => peer.client.receive(JSON.parse(JSON.stringify(msg))));
  };
  function fromClient(peer, c, msg) {
    const res = hub.receive(JSON.parse(JSON.stringify(msg.op)));
    if (res.ack) stats.acks++;
    const was = sequenced.get(msg.op.opId);
    assert.ok(!res.op || was === undefined || was <= hub.doc.seq - keep - 1, `seed ${seed}: ${msg.op.opId} applied twice`);
    if (res.op) sequenced.set(msg.op.opId, res.op.seq);
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

  // Random edits, as people (and the studio agent) make them. Each shows at once.
  function edit(peer) {
    const o = change(peer);
    const it = peer.client.doc.items[o.id ?? o.item.id];
    if (o.op === 'del') assert.equal(it, undefined, `seed ${seed}: a delete didn't show at once`);
    for (const [k, v] of Object.entries(o.fields ?? {})) if (it) assert.deepEqual(it[k], v ?? undefined, `seed ${seed}: my ${k} didn't show at once`);
  }
  function change(peer) {
    const c = peer.client;
    const id = pick(ids);
    const it = c.doc.items[id];
    const x = r();
    if (id[0] === 'g') {
      if (!it || x < 0.15) return c.local({ op: 'put', item: { id, kind: 'group', name: `G${int(9)}`, by: `p${peer.k}`, t: now, at: { x: int(900), y: int(900) } } });
      if (x < 0.45) return c.local({ op: 'set', id, fields: { gone: it.gone ? null : true } }); // delete = tombstone, and undo
      return c.local({ op: 'set', id, fields: { name: `G${int(9)}` } });
    }
    if (!it || x < 0.1) return c.local({ op: 'put', item: { id, kind: 'work', project: id, version: 1, title: `T${int(9)}`, by: `p${peer.k}`, t: now } });
    if (x < 0.2) return c.local({ op: 'del', id });
    if (x < 0.45) return c.local({ op: 'set', id, fields: { at: x < 0.25 ? null : { x: int(900), y: int(900) } } });
    if (x < 0.75) {
      // put it into a group, between two neighbours there (fractional keys)
      const g = pick(['g0', 'g1', 'g2']);
      const keys = Object.values(c.doc.items).filter((i) => i.in === g && i.order && i.id !== id).map((i) => i.order).sort();
      const j = int(keys.length + 1);
      return c.local({ op: 'set', id, fields: { in: g, order: between(keys[j - 1] ?? '', keys[j] ?? '') } });
    }
    return c.local({ op: 'set', id, fields: { version: (it.version ?? 0) + 1, title: `T${int(9)}`, t: now } });
  }

  for (const p of peers) at(int(50), () => connect(p));
  const end = 1500 + int(1500);
  for (let i = 0, n = 40 + int(120); i < n; i++) {
    at(int(end), () => {
      const x = r();
      const p = pick(peers);
      if (x < 0.08) { stats.reconnects++; disconnect(p); at(now + int(300), () => !p.conn && connect(p)); }
      else if (x < 0.13) applyServer(); // the studio agent: workChanged over DO RPC
      else edit(p);
    });
  }
  function applyServer() {
    const id = pick(ids.filter((i) => i[0] === 'w'));
    const res = hub.receive(hub.doc.items[id]
      ? { op: 'set', id, fields: { version: hub.doc.items[id].version + 1, t: now }, by: 'agent' }
      : { op: 'put', item: { id, kind: 'work', project: id, version: 1, title: 'A', by: 'agent', t: now }, by: 'agent' });
    for (const p of peers) toClient(p, { type: 'op', op: res.op });
  }

  // Run, then quiet: everyone back online, every message delivered.
  while (queue.length) { const e = queue.shift(); now = e.t; e.fn(); }
  for (const p of peers) if (!p.conn) connect(p);
  while (queue.length) { const e = queue.shift(); now = e.t; e.fn(); }

  const want = docHash(hub.doc);
  for (const p of peers) {
    assert.equal(p.client.pending, 0, `seed ${seed}: client ${p.k} still has pending ops`);
    assert.equal(docHash(p.client.doc), want, `seed ${seed}: client ${p.k} shows a different document`);
    assert.equal(p.client.doc.seq, hub.doc.seq, `seed ${seed}: client ${p.k} at seq ${p.client.doc.seq}, server ${hub.doc.seq}`);
  }
  return hub.doc.seq;
}

test(`convergence: ${SEEDS} seeds, every client equals the server after quiet`, () => {
  for (let s = 1; s <= SEEDS; s++) stats.ops += run(s);
  console.log('fuzz', JSON.stringify({ seeds: SEEDS, ...stats }));
  assert.ok(stats.ops > SEEDS * 20 && stats.snapshots && stats.replays && stats.acks, JSON.stringify(stats));
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
  assert.equal(placed(), 100);
  applyOp(doc, { op: 'set', id: 'g', fields: { gone: true } });
  assert.ok(placed() < 0);
  assert.equal(items(doc, 'group').length, 0);
  applyOp(doc, { op: 'set', id: 'g', fields: { gone: null } });
  assert.equal(placed(), 100);
});
