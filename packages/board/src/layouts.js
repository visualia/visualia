// Layouts: pure functions from the same records to boxes. None of them changes
// the document; they are views. See plans/board.md ("Views of one document").
//
// Every layout returns
//   { boxes: [{ id, x, y, w, h }], labels: [{ x, y, w, text }], width, height, pans }
// `pans` = true for the canvas (pan and zoom), false for the views that scroll.

import { byTime } from './doc.js';

export const TILE = 200;           // canvas tile width, in world units
export const ASPECT = 4 / 3;       // works are phone pages: show the top 3:4
export const CAPTION = 56;         // caption height under a tile
const PAD = 16;
const GAP = 12;
const LABEL = 44;

export const tileHeight = (w) => Math.round(w * ASPECT) + CAPTION;

function columns(width) {
  if (width < 560) return 2; // phone: two across, as plans/class-space.md says
  return Math.max(2, Math.floor((width - 2 * PAD + GAP) / (TILE + GAP)));
}

// Sections of tiles, top to bottom: the shape of every flattened view.
function sections(groups, width) {
  const cols = columns(width);
  const w = Math.floor((width - 2 * PAD - GAP * (cols - 1)) / cols);
  const h = tileHeight(w);
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
export function feed(all, { width, now }) {
  return sections(groupBy(shown(all), (i) => dayLabel(i.t, now)), width);
}

// Clusters by person (whose project it is): whoever changed something last comes first.
export function people(all, { width, nameOf = (id) => id }) {
  return sections(groupBy(shown(all), (i) => i.owner ?? i.by).map((g) => ({ ...g, label: nameOf(g.label) })), width);
}

// The canvas: records sit where someone put them. Unplaced ones wait in a row
// above everything, newest first, so a new version is never lost off-screen.
export function canvas(all) {
  const boxes = [];
  const labels = [];
  const h = tileHeight(TILE);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const waiting = [];
  const groups = new Set(all.filter((i) => i.kind === 'group').map((i) => i.id));
  for (const item of all) {
    if (item.kind === 'group') {
      if (item.at) labels.push({ x: item.at.x, y: item.at.y - LABEL, w: TILE * 6, text: item.name });
      continue;
    }
    // in a deleted group (tombstone): back to "not placed yet" until undo
    if (!item.at || (item.in && !groups.has(item.in))) { waiting.push(item); continue; }
    boxes.push({ id: item.id, x: item.at.x, y: item.at.y, w: TILE, h });
    minX = Math.min(minX, item.at.x); minY = Math.min(minY, item.at.y);
    maxX = Math.max(maxX, item.at.x + TILE); maxY = Math.max(maxY, item.at.y + h);
  }
  if (minX === Infinity) { minX = 0; minY = 0; maxX = 0; maxY = 0; }
  if (waiting.length) {
    const per = 12;
    const rows = Math.ceil(waiting.length / per);
    const top = minY - LABEL * 2 - rows * (h + GAP);
    labels.push({ x: minX, y: top - LABEL, w: TILE * 3, text: 'Not placed yet' });
    waiting.sort(byTime).forEach((item, i) => {
      boxes.push({ id: item.id, x: minX + (i % per) * (TILE + GAP), y: top + Math.floor(i / per) * (h + GAP), w: TILE, h });
    });
    minY = top - LABEL;
    maxX = Math.max(maxX, minX + Math.min(per, waiting.length) * (TILE + GAP));
  }
  return { boxes, labels, width: maxX - minX, height: maxY - minY, bounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }, pans: true };
}

export const layouts = { canvas, feed, people };

// Which view a width gets when nobody chose one.
export function defaultLayout(width) {
  return width < 700 ? 'feed' : 'canvas';
}
