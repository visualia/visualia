// The wall: one DOM renderer for every layout. See plans/board.md.
//
//   const wall = createWall(el, { imageUrl, placeholder, onOp, onOpen, nameOf, scroller });
//   wall.set(doc); wall.refresh(); wall.apply(op); wall.layout('auto' | 'canvas' | 'feed' | 'people');
//
// - One plane carries the camera (a single transform), items are absolutely
//   placed children. Only items within half a screen of the view are in the
//   DOM (culling), and their elements are recycled from a pool.
// - A tile is at most 3 elements: the box, an <img> (or a note's text) and a
//   caption; initials and the caption's second line are pseudo-elements.
// - Images come in fixed widths (BUCKETS) picked from on-screen size, capped
//   so the decoded pictures stay under a memory budget, and only ever get
//   sharper. At most 6 load at once, nearest the centre first; a tile culled
//   before its picture arrives cancels it. `placeholder(item)` (a tiny inline
//   image) paints first.
// - On the canvas, zoom changes what an item is, not only its size:
//   far = initials, mid = the picture, near = picture and caption.
// - The renderer never edits the document. Moving an item calls onOp with an
//   op; the owner sends it to the server and applies it when it comes back.
//   Without onOp the wall is read-only: a drag pans, a tap opens.
// - `scroller`: the element whose scroll the scrolling views follow (default
//   the wall itself). With another one the wall grows to its content's height.

import { applyOp, items } from './doc.js';
import { layouts, defaultLayout, TILE } from './layouts.js';

export const BUCKETS = [160, 320, 480, 640];
const MIN_Z = 0.05;
const MAX_Z = 4;
const SETTLE_MS = 150;
const LOADS = 6;     // image fetches at once
const POOL = 80;     // spare tile elements kept per kind

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' });
export function ago(t, now = Date.now()) {
  const s = Math.round((t - now) / 1000);
  for (const [unit, n] of [['day', 86400], ['hour', 3600], ['minute', 60]]) {
    if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), unit);
  }
  return 'just now';
}

const initials = (name) => String(name).split(/[\s-]+/).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase();

export function bucketFor(px) {
  return BUCKETS.find((b) => b >= px) ?? BUCKETS[BUCKETS.length - 1];
}

// The widest bucket `n` decoded pictures can have within `cap` bytes (w x 4/3 w x 4 each).
export function bucketCap(n, cap) {
  for (let i = BUCKETS.length - 1; i > 0; i--) if (n * BUCKETS[i] * BUCKETS[i] * (16 / 3) <= cap) return BUCKETS[i];
  return BUCKETS[0];
}

export function createWall(root, { imageUrl, placeholder = () => null, onOp = null, onOpen = () => {}, nameOf = (id) => id, scroller = root } = {}) {
  root.classList.add('wall');
  root.classList.toggle('flows', scroller !== root);
  const plane = document.createElement('div');
  plane.className = 'wall-plane';
  root.append(plane);

  let doc = null;
  let chosen = 'auto';
  let current = null;       // resolved layout name
  let L = null;             // layout result
  let boxes = new Map();
  const mounted = new Map(); // id -> element
  const pool = { work: [], note: [] };
  let labelEls = [];
  const cam = { x: 0, y: 0, z: 1 };
  let settleTimer = 0;
  let frame = 0;
  let first = true;          // the first screen's pictures get fetchpriority high
  let panned = false;        // the canvas fits everything until someone moves it
  const loading = new Set();
  const waiting = new Set();

  const resolved = () => (chosen === 'auto' ? defaultLayout(root.clientWidth) : chosen);

  function render() {
    if (!doc) return;
    const name = resolved();
    const switched = name !== current;
    current = name;
    L = layouts[name](items(doc), { width: root.clientWidth, now: Date.now(), nameOf });
    boxes = new Map(L.boxes.map((b) => [b.id, b]));
    root.classList.toggle('pans', L.pans);
    root.dataset.layout = name;
    if (L.pans) {
      plane.style.height = '';
      root.style.height = '';
      if (switched || !panned) fit();
    } else {
      plane.style.transform = '';
      plane.style.height = `${L.height}px`;
      if (scroller !== root) root.style.height = `${L.height}px`;
      plane.dataset.lod = 'near';
      if (switched && scroller === root) root.scrollTop = 0;
    }
    for (const el of labelEls) el.remove();
    labelEls = L.labels.map((l) => {
      const el = document.createElement('h2');
      el.className = 'wall-label';
      el.textContent = l.text;
      el.style.transform = `translate(${l.x}px, ${l.y + 40}px) translateY(-100%)`; // sits on its line, grows upward
      el.style.width = `${l.w}px`;
      plane.append(el);
      return el;
    });
    // records that changed or left the layout: give their elements back
    for (const [id, el] of mounted) {
      if (!boxes.has(id) || el._t !== doc.items[id]?.t || el._sig !== sig(doc.items[id])) unmount(id);
    }
    sync(true);
  }

  const sig = (item) => item && `${item.version}|${item.title}|${item.text}|${item.by}|${item.from}|${item.shot}`;

  // Everything in view, if that still shows pictures; otherwise the picture
  // level at the top left, where the newest unplaced works wait. (Zoomed all
  // the way out, every work is a DOM tile: the far-zoom 2D canvas will fix that.)
  function fit() {
    const b = L.bounds;
    const w = root.clientWidth, h = root.clientHeight;
    cam.z = clamp(Math.min(w / (b.w * 1.1 || 1), h / (b.h * 1.1 || 1), 1));
    cam.x = b.x + b.w / 2 - w / cam.z / 2;
    cam.y = b.y + b.h / 2 - h / cam.z / 2;
    if (TILE * cam.z < 56) {
      cam.z = 100 / TILE;
      cam.x = b.x - 24 / cam.z;
      cam.y = b.y - 24 / cam.z;
    }
  }

  const clamp = (z) => Math.min(MAX_Z, Math.max(MIN_Z, z));

  function view() {
    const w = root.clientWidth, h = root.clientHeight;
    if (L.pans) return { x: cam.x, y: cam.y, w: w / cam.z, h: h / cam.z, z: cam.z };
    if (scroller === root) return { x: 0, y: root.scrollTop, w, h, z: 1 };
    const top = root.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    return { x: 0, y: -top, w, h: scroller.clientHeight, z: 1 };
  }

  const lodFor = (px) => (px < 56 ? 'far' : px < 140 ? 'mid' : 'near');
  const coarse = matchMedia('(pointer: coarse)');

  // Put the items near the view into the DOM, take the rest out, and ask for
  // pictures. `sharpen` = also upgrade widths (done when the camera settles).
  function sync(sharpen) {
    if (!L) return;
    const v = view();
    if (L.pans) {
      plane.style.transform = `translate(${-cam.x * cam.z}px, ${-cam.y * cam.z}px) scale(${cam.z})`;
      plane.style.setProperty('--z', cam.z);
      plane.dataset.lod = lodFor(TILE * cam.z);
    }
    const far = plane.dataset.lod === 'far';
    const m = v.h * 0.5;
    const dpr = window.devicePixelRatio || 1;
    const near = [];
    for (const b of L.boxes) {
      const inView = b.x < v.x + v.w + m && b.x + b.w > v.x - m && b.y < v.y + v.h + m && b.y + b.h > v.y - m;
      let el = mounted.get(b.id);
      if (!inView) { if (el && !el.classList.contains('moving')) unmount(b.id); continue; }
      if (!el) el = mount(b.id);
      if (!el.classList.contains('moving')) place(el, b);
      if (el._img) near.push([el, b]);
    }
    // decoded pictures cost w x h x 4 bytes: a phone keeps them under ~60 MB, a laptop ~150 MB
    const max = bucketCap(near.length, (coarse.matches || root.clientWidth < 700 ? 60 : 150) * 1e6);
    for (const [el, b] of near) {
      if (far) { cancel(el); continue; }
      if (!sharpen && el._bucket) continue;
      const want = Math.min(max, bucketFor(b.w * v.z * dpr));
      if (want > (el._bucket ?? 0) && want !== el._want) { el._want = want; waiting.add(el); }
    }
    pump();
  }

  // Start the waiting loads nearest the centre of the view, up to LOADS at once.
  function pump() {
    if (!waiting.size || loading.size >= LOADS) return;
    const v = view();
    const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    const d = (el) => { const b = boxes.get(el.dataset.id); return b ? Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy) : Infinity; };
    for (const el of [...waiting].sort((a, b) => d(a) - d(b))) {
      if (loading.size >= LOADS) break;
      waiting.delete(el);
      const item = doc.items[el.dataset.id];
      const url = item && imageUrl(item, el._want);
      if (!url) continue;
      const img = el._img;
      const done = (ok) => () => {
        img.onload = img.onerror = null;
        if (!ok) { img.removeAttribute('src'); el._bucket = Infinity; }
        loading.delete(el);
        pump();
      };
      img.onload = done(true);
      img.onerror = done(false);
      img.fetchPriority = first ? 'high' : 'auto';
      el._bucket = el._want;
      loading.add(el);
      img.src = url;
    }
  }

  // A tile left the view: drop its queued or running load (removing src cancels the fetch).
  function cancel(el) {
    waiting.delete(el);
    el._want = 0;
    if (loading.delete(el)) {
      el._img.onload = el._img.onerror = null;
      el._img.removeAttribute('src');
      el._bucket = 0;
    }
  }

  function place(el, b) {
    el.style.transform = `translate(${b.x}px, ${b.y}px)`;
    el.style.width = `${b.w}px`;
    el.style.height = `${b.h}px`;
  }

  // Tile elements, made once and refilled: box, picture or text, caption.
  function make(kind) {
    const el = document.createElement('article');
    el.className = 'item';
    el.dataset.kind = kind; // not a class: a page may well style .work
    if (kind === 'work') {
      el._img = document.createElement('img');
      el._img.alt = '';
      el._img.decoding = 'async';
      el._img.draggable = false;
      el.append(el._img);
    } else {
      el._text = document.createElement('p');
      el._text.className = 'text';
      el.append(el._text);
    }
    el._cap = document.createElement('p');
    el._cap.className = 'cap';
    el.append(el._cap);
    return el;
  }

  function mount(id) {
    const item = doc.items[id];
    const kind = item.kind === 'note' ? 'note' : 'work';
    const el = pool[kind].pop() ?? make(kind);
    el.dataset.id = id;
    el._t = item.t;
    el._sig = sig(item);
    el._bucket = 0;
    el._want = 0;
    const who = nameOf(item.by);
    el.dataset.initials = initials(who);
    if (kind === 'work') {
      const ph = placeholder(item);
      el._img.style.backgroundImage = ph ? `url("${ph}")` : '';
      el._cap.textContent = item.title ?? '';
      el._cap.dataset.meta = [who, item.version && `v${item.version}`, ago(item.t), item.from && `from ${item.from}`].filter(Boolean).join(' · ');
    } else {
      el._text.textContent = item.text;
      el._cap.textContent = '';
      el._cap.dataset.meta = [who, ago(item.t)].join(' · ');
    }
    plane.append(el);
    mounted.set(id, el);
    return el;
  }

  function unmount(id) {
    const el = mounted.get(id);
    if (!el) return;
    mounted.delete(id);
    el.remove();
    if (el._img) { cancel(el); el._img.removeAttribute('src'); }
    const p = pool[el._img ? 'work' : 'note'];
    if (p.length < POOL) p.push(el);
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      sync(false);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => sync(true), SETTLE_MS);
    });
  }
  const moved = () => { first = false; if (L?.pans) panned = true; schedule(); };

  // --- input: scrolling views use the browser's own scroll; the canvas pans,
  // pinches and lets you move works (which is the only edit it makes).
  scroller.addEventListener('scroll', moved, { passive: true });

  root.addEventListener('click', (e) => {
    if (L?.pans) return;
    const el = e.target.closest('.item');
    if (el) onOpen(el.dataset.id);
  });

  const pointers = new Map();
  let gesture = null;

  root.addEventListener('pointerdown', (e) => {
    if (!L?.pans) return;
    root.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      cancelMove();
      const [a, b] = [...pointers.values()];
      gesture = { type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z };
      return;
    }
    const el = e.target.closest('.item');
    const box = el && boxes.get(el.dataset.id);
    gesture = box && onOp
      ? { type: 'move', el, box, sx: e.clientX, sy: e.clientY, moved: false }
      : { type: 'pan', el, sx: e.clientX, sy: e.clientY };
  });

  root.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p || !gesture) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (gesture.type === 'pinch' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const r = root.getBoundingClientRect();
      zoomAbout((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, gesture.z * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d);
    } else if (gesture.type === 'pan') {
      cam.x -= dx / cam.z;
      cam.y -= dy / cam.z;
    } else if (gesture.type === 'move') {
      const ox = (e.clientX - gesture.sx) / cam.z, oy = (e.clientY - gesture.sy) / cam.z;
      if (!gesture.moved && Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy) > 4) {
        gesture.moved = true;
        gesture.el.classList.add('moving');
      }
      if (gesture.moved) place(gesture.el, { ...gesture.box, x: gesture.box.x + ox, y: gesture.box.y + oy });
      gesture.at = { x: Math.round(gesture.box.x + ox), y: Math.round(gesture.box.y + oy) };
    }
    moved();
  });

  function end(e) {
    if (!pointers.delete(e.pointerId)) return;
    if (gesture?.type === 'move') {
      const { el, moved, at } = gesture;
      el.classList.remove('moving');
      if (moved && e.type === 'pointerup') onOp({ op: 'set', id: el.dataset.id, fields: { at } });
      else if (!moved && e.type === 'pointerup') onOpen(el.dataset.id);
      else place(el, gesture.box);
    } else if (gesture?.type === 'pan' && gesture.el && e.type === 'pointerup' && Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy) < 5) {
      onOpen(gesture.el.dataset.id); // a tap on a read-only wall
    }
    gesture = pointers.size ? { type: 'pan' } : null;
  }
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);

  function cancelMove() {
    if (gesture?.type === 'move') {
      gesture.el.classList.remove('moving');
      place(gesture.el, gesture.box);
    }
  }

  function zoomAbout(sx, sy, z1) {
    z1 = clamp(z1);
    cam.x += sx * (1 / cam.z - 1 / z1);
    cam.y += sy * (1 / cam.z - 1 / z1);
    cam.z = z1;
  }

  // Trackpads: two fingers pan, a pinch arrives as ctrl+wheel. A mouse wheel pans too.
  root.addEventListener('wheel', (e) => {
    if (!L?.pans) return;
    e.preventDefault();
    const r = root.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAbout(e.clientX - r.left, e.clientY - r.top, cam.z * Math.exp(-e.deltaY * 0.01));
    else { cam.x += e.deltaX / cam.z; cam.y += e.deltaY / cam.z; }
    moved();
  }, { passive: false });

  let lastWidth = root.clientWidth;
  new ResizeObserver(() => {
    if (root.clientWidth === lastWidth) return schedule();
    lastWidth = root.clientWidth;
    render();
  }).observe(root);

  return {
    set(d) { doc = d; render(); },
    refresh: render,
    apply(op) { if (applyOp(doc, op).length) render(); },
    layout(name) { chosen = name; render(); },
    get current() { return current; },
    get mountedCount() { return mounted.size; },
    get loading() { return loading.size; },
  };
}
