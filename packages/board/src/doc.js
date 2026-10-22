// The board document: a flat set of records, changed only by ops.
// See plans/board.md ("The document and many people").
//
// A record is one thing on the wall:
//   work  { id, kind: 'work', project, version, title, by, t, from?, at? }
//         points at a studio project version; the board never copies the page.
//         `from` is the project it was remixed from (provenance).
//   note  { id, kind: 'note', text, by, t, at? }
//   group { id, kind: 'group', name, by, t, at?, gone? }   a named place on the canvas
//
// Deleting a group is a tombstone (`gone: true`), not a `del`: its works keep
// `in` and `order`, fall back to "not placed yet", and undo (`gone: null`)
// brings the group and its works back (plans/board.md, "Decided").
// `order` inside a group is a fractional key (`between`), never an array, so
// two people inserting at once don't conflict.
//
// `at` = { x, y } is where someone put it on the canvas. Absent means "not
// placed yet": every layout still shows it, only the canvas has to choose.
// `t` is the time of the last real change (a new version, an edited note),
// not of a move, so the feed's order means "newest work", not "last touched".
//
// The server (one Durable Object per class) gives each op a sequence number and
// applies them in that order, so the last write to a field wins. No CRDT:
// records are small and nobody co-types inside one.

export function emptyDoc() {
  return { v: 1, seq: 0, items: {} };
}

// op = { op: 'put', item } | { op: 'set', id, fields } | { op: 'del', id }
// Returns the ids it touched. Unknown or stale ops are ignored, not thrown:
// a late op for a deleted record must not break everyone's board.
export function applyOp(doc, op) {
  if (typeof op.seq === 'number') {
    if (op.seq <= doc.seq) return [];
    doc.seq = op.seq;
  }
  if (op.op === 'put' && op.item?.id) {
    doc.items[op.item.id] = { ...op.item };
    return [op.item.id];
  }
  const item = doc.items[op.id];
  if (!item) return [];
  if (op.op === 'set') {
    for (const [k, v] of Object.entries(op.fields ?? {})) {
      if (k === 'id' || k === 'kind') continue;
      if (v === null) delete item[k];
      else item[k] = v;
    }
    return [op.id];
  }
  if (op.op === 'del') {
    delete doc.items[op.id];
    return [op.id];
  }
  return [];
}

// Live records: tombstoned ones stay in the document but leave every view.
export function items(doc, kind) {
  const all = Object.values(doc.items).filter((i) => !i.gone);
  return kind ? all.filter((i) => i.kind === kind) : all;
}

// Newest change first; ties by id so every client shows the same order.
export function byTime(a, b) {
  return b.t - a.t || (a.id < b.id ? -1 : 1);
}

// Fractional index keys: a string that sorts between a and b ('' = open end).
// Keys never end in '0', so there is always room between two of them.
// After David Greenspan's fractional-indexing, without the integer part.
const D = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export function between(a = '', b = '') {
  if (b) {
    let n = 0;
    while ((a[n] ?? '0') === b[n]) n++;
    if (n > 0) return b.slice(0, n) + between(a.slice(n), b.slice(n));
  }
  const da = a ? D.indexOf(a[0]) : 0;
  const db = b ? D.indexOf(b[0]) : D.length;
  if (db - da > 1) return D[Math.round((da + db) / 2)];
  if (b.length > 1) return b.slice(0, 1);
  return D[da] + between(a.slice(1), '');
}
