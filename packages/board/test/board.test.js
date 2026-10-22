// node --test packages/board/test/*.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, applyOp, place, move, nextTo, accept, members } from '../src/doc.js';
import { feed, people, canvas, defaultLayout, slotAt } from '../src/layouts.js';

const work = (i, extra = {}) => ({ id: `w${i}`, kind: 'work', project: `p${i}`, version: 1, title: `W${i}`, by: `p${i % 3}`, t: 1e12 + i * 1e6, ...extra });

test('ops: put, set, del; stale seq ignored; null clears a field', () => {
  const doc = emptyDoc();
  applyOp(doc, { op: 'put', item: work(1, { at: { x: 1, y: 2 } }), seq: 1 });
  applyOp(doc, { op: 'set', id: 'w1', fields: { version: 2 }, seq: 2 });
  applyOp(doc, { op: 'set', id: 'w1', fields: { version: 9 }, seq: 2 }); // replayed
  assert.equal(doc.items.w1.version, 2);
  applyOp(doc, { op: 'set', id: 'w1', fields: { at: null, kind: 'note' }, seq: 3 });
  assert.equal(doc.items.w1.at, undefined);
  assert.equal(doc.items.w1.kind, 'work');
  assert.deepEqual(applyOp(doc, { op: 'set', id: 'gone', fields: { x: 1 }, seq: 4 }), []);
  applyOp(doc, { op: 'del', id: 'w1', seq: 5 });
  assert.deepEqual(doc.items, {});
});

const overlaps = (bs) => bs.some((a, i) => bs.some((b, j) => i < j && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));

test('feed: every work once, newest first, two across on a phone, no overlaps', () => {
  const all = Array.from({ length: 30 }, (_, i) => work(i));
  const L = feed(all, { width: 375, now: 1e12 + 40e6 });
  assert.equal(L.boxes.length, 30);
  assert.equal(L.boxes[0].id, 'w29');
  assert.equal(new Set(L.boxes.map((b) => b.x)).size, 2);
  assert.ok(!overlaps(L.boxes));
  assert.ok(L.boxes.every((b) => b.x >= 0 && b.x + b.w <= 375));
});

test('people: one section per person', () => {
  const L = people(Array.from({ length: 9 }, (_, i) => work(i)), { width: 1200 });
  assert.equal(L.labels.length, 3);
  assert.ok(!overlaps(L.boxes));
});

test('canvas: placed works stay put, unplaced wait above them', () => {
  const all = [work(1, { at: { x: 0, y: 0 } }), work(2), work(3)];
  const L = canvas(all);
  const b1 = L.boxes.find((b) => b.id === 'w1');
  assert.deepEqual([b1.x, b1.y], [0, 0]);
  assert.ok(L.boxes.filter((b) => b.id !== 'w1').every((b) => b.y + b.h < 0));
  assert.ok(!overlaps(L.boxes));
});

test('default layout by width', () => {
  assert.equal(defaultLayout(390), 'feed');
  assert.equal(defaultLayout(1280), 'canvas');
});

test('groups: works fill the grid in order, a free slot follows, drops land between', () => {
  const doc = emptyDoc();
  applyOp(doc, { op: 'put', item: { id: 'g-a', kind: 'group', name: 'A', at: { x: 0, y: 0 } } });
  for (let i = 0; i < 5; i++) applyOp(doc, { op: 'put', item: work(i) });
  for (let i = 0; i < 5; i++) applyOp(doc, place(doc, `w${i}`, 'g-a'));
  assert.deepEqual(members(doc, 'g-a').map((w) => w.id), ['w0', 'w1', 'w2', 'w3', 'w4']);
  const L = canvas(Object.values(doc.items));
  const g = L.groups[0];
  assert.equal(g.n, 5);
  assert.ok(!overlaps(L.boxes));
  const b1 = L.boxes.find((b) => b.id === 'w1');
  assert.equal(slotAt(g, b1.x + 5, b1.y + 5), 1);
  assert.equal(slotAt(g, g.x + g.w - 1, g.y + g.h - 1), 5); // the free slot
  applyOp(doc, place(doc, 'w4', 'g-a', 1));
  assert.deepEqual(members(doc, 'g-a').map((w) => w.id), ['w0', 'w4', 'w1', 'w2', 'w3']);
  assert.deepEqual(Object.keys(place(doc, 'w4', 'g-a', 0).fields), ['order']); // a reorder writes only order
  applyOp(doc, move('w0', { x: 2000, y: 0 }));
  assert.equal(doc.items.w0.in, undefined);
});

test('remix: right after its source in a group, beside it when alone, unplaced otherwise', () => {
  const doc = emptyDoc();
  applyOp(doc, { op: 'put', item: { id: 'g-a', kind: 'group', name: 'A', at: { x: 0, y: 0 } } });
  for (let i = 0; i < 3; i++) { applyOp(doc, { op: 'put', item: work(i) }); applyOp(doc, place(doc, `w${i}`, 'g-a')); }
  applyOp(doc, { op: 'put', item: work(9, { from: 'w1', ...nextTo(doc, 'w1') }) });
  assert.deepEqual(members(doc, 'g-a').map((w) => w.id), ['w0', 'w1', 'w9', 'w2']);
  const L = canvas(Object.values(doc.items));
  assert.deepEqual(L.lines.map((l) => [l.from, l.to]), [['w1', 'w9']]);
  applyOp(doc, move('w2', { x: 5000, y: 0 }));
  assert.deepEqual(nextTo(doc, 'w2'), { at: { x: 5212, y: 0 } });
  applyOp(doc, { op: 'put', item: work(7) });
  assert.deepEqual(nextTo(doc, 'w7'), {});
});

test('a person may arrange, not make or change works', () => {
  const doc = emptyDoc();
  applyOp(doc, { op: 'put', item: work(1) });
  applyOp(doc, { op: 'put', item: { id: 'g-a', kind: 'group', name: 'A', at: { x: 0, y: 0 } } });
  const ok = (op) => accept(doc, { opId: 'x', ...op }, 'p1', 5);
  assert.deepEqual(ok({ op: 'put', item: { id: 'g-b', kind: 'group', name: ' B ', at: { x: 1.4, y: 2 }, by: 'p9', evil: 1 } }).item, { id: 'g-b', kind: 'group', name: 'B', at: { x: 1, y: 2 }, by: 'p1', t: 5 });
  assert.ok(ok({ op: 'set', id: 'w1', fields: { in: 'g-a', order: 'V', at: null } }));
  assert.ok(ok({ op: 'set', id: 'g-a', fields: { gone: true } }));
  assert.equal(ok({ op: 'set', id: 'g-a', fields: { name: 'C' }, undo: 'y', w: { name: 'z', other: 1 } }).w.name, 'z');
  for (const bad of [
    { op: 'put', item: work(2) }, { op: 'put', item: { id: 'g-a', kind: 'group', name: 'A', at: { x: 0, y: 0 } } },
    { op: 'del', id: 'w1' }, { op: 'set', id: 'w1', fields: { title: 'X' } }, { op: 'set', id: 'w1', fields: { in: 'w1' } },
    { op: 'set', id: 'w1', fields: { at: { x: 'a', y: 0 } } }, { op: 'set', id: 'g-a', fields: { name: ' ' } }, { op: 'set', id: 'nope', fields: { at: null } },
  ]) assert.equal(ok(bad), null, JSON.stringify(bad));
});
