// Layouts: pure functions from the same records to boxes. None of them changes
// the document; they are views. See plans/board.md ("Views of one document").
//
// Every layout returns
//   { boxes: [{ id, x, y, w, h }], labels: [{ x, y, w, text }], width, height, pans }
// `pans` = true for the canvas (pan and zoom), false for the views that scroll.

import { byTime, byOrder } from './doc.js';

export const TILE = 200;           // canvas tile width, in world units
export const ASPECT = 4 / 3;       // works are phone pages: show the top 3:4
export const CAPTION = 56;         // caption height under a tile
export const COLS = 4;             // a group's grid on the canvas
export const GAP = 12;
const PAD = 16;
const LABEL = 44;

export const tileHeight = (w) => Math.round(w * ASPECT) + CAPTION;

function columns(width) {
  if (width < 560) return 2; // phone: two across, as plans/class-space.md says
  return Math.max(2, Math.floor((width - 2 * PAD + GAP) / (TILE + GAP)));
}

// Sections of tiles, top to bottom: the shape of every flattened view.
function sections(groups, width, extra = 0) {
  const cols = columns(width);
  const w = Math.floor((width - 2 * PAD - GAP * (cols - 1)) / cols);
  const h = tileHeight(w) + extra;
  const boxes = [];
  const labels = [];
  let y = PAD;
  for (const { label, list } of groups) {
    if (!list.length) continue;
    labels.push({ x: PAD, y, w: width - 2 * PAD, text: label });
    y += LABEL;
    list.forEach((item, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      boxes.push({ id: item.id, x: PAD + c * (w + GAP), y: y + r * (h + GAP), w, h });
    });
    y += Math.ceil(list.length / cols) * (h + GAP) + GAP;
  }
  return { boxes, labels, width, height: y + PAD, pans: false };
}

function groupBy(list, key) {
  const map = new Map();
  for (const item of list) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return [...map].map(([label, list]) => ({ label, list }));
}

export function dayLabel(t, now = Date.now()) {
  const day = (ms) => Math.floor((ms - new Date(ms).getTimezoneOffset() * 60e3) / 864e5);
  const d = day(now) - day(t);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

const shown = (all) => all.filter((i) => i.kind === 'work' || i.kind === 'note').sort(byTime);

// The phone's default: newest change first, a heading per day.
// `extra`: room under each caption for a line of links ("Put with…").
export function feed(all, { width, now, extra }) {
  return sections(groupBy(shown(all), (i) => dayLabel(i.t, now)), width, extra);
}

// Clusters by person (whose project it is): whoever changed something last comes first.
export function people(all, { width, nameOf = (id) => id, extra }) {
  return sections(groupBy(shown(all), (i) => i.owner ?? i.by).map((g) => ({ ...g, label: nameOf(g.label) })), width, extra);
}

// The canvas: records sit where someone put them. A group is a named place
// with a grid: its works fill it in order, with one free slot at the end to
// drop into. Unplaced works (and those of a deleted group) wait in a row above
// everything, newest first, so a new version is never lost off-screen. A remix
// whose source is on the canvas too gets a line to it (`lines`).
export function canvas(all) {
  const boxes = [];
  const labels = [];
  const groups = [];
  const h = tileHeight(TILE);
  const step = TILE + GAP;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x, y, w, hh) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + hh); };
  const waiting = [];
  const live = new Map(all.filter((i) => i.kind === 'group' && i.at).map((g) => [g.id, []]));
  for (const item of all) {
    if (item.kind === 'group') continue;
    if (item.in) {
      if (live.has(item.in)) live.get(item.in).push(item);
      else waiting.push(item); // its group was deleted (a tombstone): back here until undo
    } else if (item.at) {
      boxes.push({ id: item.id, x: item.at.x, y: item.at.y, w: TILE, h });
      grow(item.at.x, item.at.y, TILE, h);
    } else waiting.push(item);
  }
  for (const g of all) {
    if (!live.has(g.id)) continue;
    const list = live.get(g.id).sort(byOrder);
    list.forEach((item, i) => boxes.push({ id: item.id, x: g.at.x + (i % COLS) * step, y: g.at.y + Math.floor(i / COLS) * (h + GAP), w: TILE, h }));
    const area = { id: g.id, x: g.at.x, y: g.at.y, w: COLS * step - GAP, h: Math.ceil((list.length + 1) / COLS) * (h + GAP) - GAP, n: list.length };
    groups.push(area);
    labels.push({ x: g.at.x, y: g.at.y - LABEL, w: area.w, text: g.name, group: g.id });
    grow(area.x, area.y - LABEL, area.w, area.h + LABEL);
  }
  if (minX === Infinity) { minX = 0; minY = 0; maxX = 0; maxY = 0; }
  if (waiting.length) {
    const per = 12;
    const rows = Math.ceil(waiting.length / per);
    const top = minY - LABEL * 2 - rows * (h + GAP);
    labels.push({ x: minX, y: top - LABEL, w: TILE * 3, text: 'Not placed yet' });
    waiting.sort(byTime).forEach((item, i) => {
      boxes.push({ id: item.id, x: minX + (i % per) * step, y: top + Math.floor(i / per) * (h + GAP), w: TILE, h });
    });
    minY = top - LABEL;
    maxX = Math.max(maxX, minX + Math.min(per, waiting.length) * step);
  }
  // provenance: a line between the middles of a remix and its source
  const at = new Map(boxes.map((b) => [b.id, b]));
  const lines = [];
  for (const item of all) {
    const a = item.from && at.get(item.from), b = at.get(item.id);
    if (a && b) lines.push({ from: item.from, to: item.id, x1: a.x + a.w / 2, y1: a.y + TILE * ASPECT / 2, x2: b.x + b.w / 2, y2: b.y + TILE * ASPECT / 2 });
  }
  return { boxes, labels, groups, lines, unplaced: waiting.map((i) => i.id), width: maxX - minX, height: maxY - minY, bounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }, pans: true };
}

// The slot in a group's grid nearest a point (world units), clamped to the
// group's works plus its free slot: where a dropped work goes.
export function slotAt(group, x, y) {
  const col = Math.max(0, Math.min(COLS - 1, Math.floor((x - group.x) / (TILE + GAP))));
  const row = Math.max(0, Math.floor((y - group.y) / (tileHeight(TILE) + GAP)));
  return Math.min(row * COLS + col, group.n);
}

export const layouts = { canvas, feed, people };

// Which view a width gets when nobody chose one.
export function defaultLayout(width) {
  return width < 700 ? 'feed' : 'canvas';
}
