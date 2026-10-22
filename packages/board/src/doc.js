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
// A work in a group (`in`) sits in the group's grid in `order`; its `at` is
// then unused (a move out of the group clears `in` and `order`).
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

// Order inside a group: by key, ties (two people inserting at once) by id.
// A work without a key (left by an undo that skipped `order`) goes last.
const key = (i) => i.order ?? '\uffff';
export const byOrder = (a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// The works in group g, in order (without `except`).
export function members(doc, g, except) {
  return Object.values(doc.items).filter((i) => i.in === g && i.kind !== 'group' && i.id !== except).sort(byOrder);
}

// --- the ops people make on the canvas (plans/board.md, step 4). The canvas,
// the phone's "Put with…" and the fuzz all build their ops here.
export const move = (id, at) => ({ op: 'set', id, fields: { at, in: null, order: null } });
// Into group g at `index` (default: its next slot), between the neighbours there.
export function place(doc, id, g, index = Infinity) {
  const keys = members(doc, g, id).map((i) => i.order ?? '');
  const j = Math.max(0, Math.min(index, keys.length));
  const order = between(keys[j - 1] ?? '', keys[j] ?? '');
  const it = doc.items[id];
  return { op: 'set', id, fields: it?.in === g && !it.at ? { order } : { in: g, order, at: null } }; // a reorder writes only order
}
export const unplace = (id) => ({ op: 'set', id, fields: { at: null, in: null, order: null } });
export const newGroup = (id, name, at) => ({ op: 'put', item: { id, kind: 'group', name, at } });
export const rename = (id, name) => ({ op: 'set', id, fields: { name } });
export const removeGroup = (id) => ({ op: 'set', id, fields: { gone: true } }); // a tombstone; undo brings it back

// Where a remix goes when it reaches the wall: right after its source in the
// source's group; beside it if the source is placed alone; unplaced otherwise.
export function nextTo(doc, source, gap = 212) {
  const s = doc.items[source];
  const g = s?.in && doc.items[s.in];
  if (g && !g.gone) {
    const list = members(doc, s.in);
    return { in: s.in, order: between(s.order ?? '', list[list.findIndex((i) => i.id === s.id) + 1]?.order ?? '') };
  }
  if (s?.at && !s.in) return { at: { x: s.at.x + gap, y: s.at.y } };
  return {};
}

// What the server takes from a person's socket: groups (made, renamed, moved,
// deleted and undeleted) and where works sit. Anything else (works, versions,
// titles, deletes) comes only from the studio. Returns the op as it will be
// sequenced (by and t set here), or null to refuse it.
const MAX = 1e6;
const pos = (p) => (p && Number.isFinite(p.x) && Number.isFinite(p.y)
  ? { x: Math.round(Math.max(-MAX, Math.min(MAX, p.x))), y: Math.round(Math.max(-MAX, Math.min(MAX, p.y))) } : undefined);
const name = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : undefined);
const FIELDS = {
  group: { name, at: pos, gone: (v) => (v === true || v === null ? v : undefined) },
  work: {
    at: (v) => (v === null ? null : pos(v)),
    in: (v, doc) => (v === null || doc.items[v]?.kind === 'group' ? v : undefined),
    order: (v) => (v === null || (typeof v === 'string' && /^[0-9A-Za-z]{1,200}$/.test(v)) ? v : undefined),
  },
};
const str = (v) => (typeof v === 'string' && v.length <= 64 ? v : null);

export function accept(doc, op, by, t) {
  const meta = { opId: str(op?.opId) ?? undefined, by, base: Number.isInteger(op?.base) ? op.base : undefined };
  if (op?.op === 'put') {
    const i = op.item ?? {};
    const it = { id: i.id, kind: 'group', name: name(i.name), at: pos(i.at), by, t };
    if (i.kind !== 'group' || !/^g-[\w-]{1,40}$/.test(i.id ?? '') || doc.items[i.id] || !it.name || !it.at) return null;
    return { op: 'put', item: it, ...meta };
  }
  const allowed = op?.op === 'set' && typeof op.id === 'string' && FIELDS[doc.items[op.id]?.kind];
  if (!allowed || !op.fields || typeof op.fields !== 'object') return null;
  const fields = {};
  for (const [k, v] of Object.entries(op.fields)) {
    const ok = Object.hasOwn(allowed, k) ? allowed[k](v, doc) : undefined;
    if (ok === undefined) return null;
    fields[k] = ok;
  }
  if (!Object.keys(fields).length) return null;
  if (op.undo === undefined) return { op: 'set', id: op.id, fields, ...meta };
  // an undo carries who wrote each field before the op it undoes (sync.js)
  const w = Object.fromEntries(Object.keys(fields).map((k) => [k, str(op.w?.[k])]));
  return str(op.undo) ? { op: 'set', id: op.id, fields, undo: op.undo, w, ...meta } : null;
}
