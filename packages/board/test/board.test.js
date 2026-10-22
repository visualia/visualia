// node --test packages/board/test/*.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, applyOp } from '../src/doc.js';
import { feed, people, canvas, defaultLayout } from '../src/layouts.js';

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
