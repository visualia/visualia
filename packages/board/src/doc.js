// The board document: a flat set of records, changed only by ops.
// See plans/board.md ("The document and many people").
//
// A record is one thing on the wall:
//   work  { id, kind: 'work', project, version, title, by, t, from?, at? }
//         points at a studio project version; the board never copies the page.
//         `from` is the project it was remixed from (provenance).
//   note  { id, kind: 'note', text, by, t, at? }
//   group { id, kind: 'group', name, by, t, at? }   a named place on the canvas
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

export function items(doc, kind) {
  const all = Object.values(doc.items);
  return kind ? all.filter((i) => i.kind === kind) : all;
}

// Newest change first; ties by id so every client shows the same order.
export function byTime(a, b) {
  return b.t - a.t || (a.id < b.id ? -1 : 1);
}
