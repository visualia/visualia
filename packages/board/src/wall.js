// The wall: one DOM renderer for every layout. See plans/board.md.
//
//   const wall = createWall(el, { imageUrl, onOp, onOpen });
//   wall.set(doc); wall.apply(op); wall.layout('auto' | 'canvas' | 'feed' | 'people');
//
// - One plane carries the camera (a single transform), items are absolutely
//   placed children. Only items near the viewport exist in the DOM (culling),
//   so hundreds of works cost what a screenful costs.
// - Images come in a few fixed widths (BUCKETS) picked from on-screen size, and
//   only ever get sharper, so zooming never flickers back to a blur.
// - On the canvas, zoom changes what an item is, not only its size:
//   far = initials, mid = the picture, near = picture and caption.
// - The renderer never edits the document. Moving an item calls onOp with an
//   op; the owner sends it to the server and applies it when it comes back.

import { applyOp, items } from './doc.js';
import { layouts, defaultLayout, TILE } from './layouts.js';

export const BUCKETS = [160, 320, 480, 640];
const MIN_Z = 0.05;
const MAX_Z = 4;
const SETTLE_MS = 150;

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' });
export function ago(t, now = Date.now()) {
  const s = Math.round((t - now) / 1000);
  for (const [unit, n] of [['day', 86400], ['hour', 3600], ['minute', 60]]) {
    if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), unit);
  }
  return 'just now';
}

const initials = (name) => name.split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase();

export function bucketFor(px) {
  return BUCKETS.find((b) => b >= px) ?? BUCKETS[BUCKETS.length - 1];
}

export function createWall(root, { imageUrl, onOp = () => {}, onOpen = () => {}, nameOf = (id) => id } = {}) {
  root.classList.add('wall');
  const plane = document.createElement('div');
  plane.className = 'wall-plane';
  root.append(plane);

  let doc = null;
  let chosen = 'auto';
  let current = null;       // resolved layout name
  let L = null;             // layout result
  let boxes = new Map();
  const mounted = new Map(); // id -> element
  let labelEls = [];
  const cam = { x: 0, y: 0, z: 1 };
  let settleTimer = 0;
  let frame = 0;

  const resolved = () => (chosen === 'auto' ? defaultLayout(root.clientWidth) : chosen);

  function render() {
    if (!doc) return;
    const name = resolved();
    const switched = name !== current;
    current = name;
    L = layouts[name](items(doc), { width: root.clientWidth, now: Date.now() });
    boxes = new Map(L.boxes.map((b) => [b.id, b]));
    root.classList.toggle('pans', L.pans);
    root.dataset.layout = name;
    if (L.pans) {
      plane.style.height = '';
      if (switched) fit();
    } else {
      plane.style.transform = '';
      plane.style.height = `${L.height}px`;
      plane.dataset.lod = 'near';
      if (switched) root.scrollTop = 0;
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
    // records that changed shape or left the layout: rebuild them
    for (const [id, el] of mounted) {
      if (!boxes.has(id) || el._t !== doc.items[id]?.t || el._sig !== sig(doc.items[id])) unmount(id);
    }
    sync(true);
  }

  const sig = (item) => item && `${item.version}|${item.title}|${item.text}|${item.by}|${item.from}`;

  function fit() {
    const b = L.bounds;
    const w = root.clientWidth, h = root.clientHeight;
    cam.z = clamp(Math.min(w / (b.w * 1.1 || 1), h / (b.h * 1.1 || 1)));
    cam.x = b.x + b.w / 2 - w / cam.z / 2;
    cam.y = b.y + b.h / 2 - h / cam.z / 2;
  }

  const clamp = (z) => Math.min(MAX_Z, Math.max(MIN_Z, z));

  function view() {
    const w = root.clientWidth, h = root.clientHeight;
    return L.pans
      ? { x: cam.x, y: cam.y, w: w / cam.z, h: h / cam.z, z: cam.z }
      : { x: 0, y: root.scrollTop, w, h, z: 1 };
  }

  function lodFor(px) {
    return px < 56 ? 'far' : px < 140 ? 'mid' : 'near';
  }

  // Put the items near the viewport into the DOM, take the rest out.
  // `sharpen` = also upgrade image widths (done when the camera settles).
  function sync(sharpen) {
    if (!L) return;
    const v = view();
    if (L.pans) {
      plane.style.transform = `translate(${-cam.x * cam.z}px, ${-cam.y * cam.z}px) scale(${cam.z})`;
      plane.style.setProperty('--z', cam.z);
      plane.dataset.lod = lodFor(TILE * cam.z);
    }
    const m = v.h * 0.5;
    const dpr = window.devicePixelRatio || 1;
    for (const b of L.boxes) {
      const inView = b.x < v.x + v.w + m && b.x + b.w > v.x - m && b.y < v.y + v.h + m && b.y + b.h > v.y - m;
      let el = mounted.get(b.id);
      if (!inView) { if (el && !el.classList.contains('moving')) unmount(b.id); continue; }
      if (!el) el = mount(b.id);
      if (!el.classList.contains('moving')) place(el, b);
      const img = el._img;
      if (img && plane.dataset.lod !== 'far' && (sharpen || !img.src)) {
        const want = bucketFor(b.w * v.z * dpr);
        if (want > (el._bucket ?? 0)) {
          el._bucket = want;
          img.src = imageUrl(doc.items[b.id], want);
        }
      }
    }
  }

  function place(el, b) {
    el.style.transform = `translate(${b.x}px, ${b.y}px)`;
    el.style.width = `${b.w}px`;
    el.style.height = `${b.h}px`;
  }

  function mount(id) {
    const item = doc.items[id];
    const el = document.createElement('article');
    el.className = `item ${item.kind}`;
    el.dataset.id = id;
    el._t = item.t;
    el._sig = sig(item);
    const who = nameOf(item.by);
    const ini = document.createElement('div');
    ini.className = 'initials';
    ini.textContent = initials(who);
    el.append(ini);
    if (item.kind === 'work') {
      const shot = document.createElement('div');
      shot.className = 'shot';
      const img = document.createElement('img');
      img.alt = item.title;
      img.decoding = 'async';
      img.draggable = false;
      shot.append(img);
      el._img = img;
      el.append(shot, caption(item.title, [who, `v${item.version}`, ago(item.t), item.from && `from ${item.from}`]));
    } else {
      const p = document.createElement('p');
      p.className = 'text';
      p.textContent = item.text;
      el.append(p, caption(null, [who, ago(item.t)]));
    }
    plane.append(el);
    mounted.set(id, el);
    return el;
  }

  function caption(title, bits) {
    const cap = document.createElement('div');
    cap.className = 'cap';
    if (title) {
      const b = document.createElement('b');
      b.textContent = title;
      cap.append(b);
    }
    const s = document.createElement('span');
    s.className = 'quiet';
    s.textContent = bits.filter(Boolean).join(' · ');
    cap.append(s);
    return cap;
  }

  function unmount(id) {
    mounted.get(id)?.remove();
    mounted.delete(id);
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

  // --- input: scrolling views use the browser's own scroll; the canvas pans,
  // pinches and lets you move works (which is the only edit it makes).
  root.addEventListener('scroll', schedule, { passive: true });

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
    gesture = box
      ? { type: 'move', el, box, sx: e.clientX, sy: e.clientY, moved: false }
      : { type: 'pan', x: e.clientX, y: e.clientY };
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
    schedule();
  });

  function end(e) {
    if (!pointers.delete(e.pointerId)) return;
    if (gesture?.type === 'move') {
      const { el, moved, at } = gesture;
      el.classList.remove('moving');
      if (moved && e.type === 'pointerup') onOp({ op: 'set', id: el.dataset.id, fields: { at } });
      else if (!moved && e.type === 'pointerup') onOpen(el.dataset.id);
      else place(el, gesture.box);
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
    schedule();
  }, { passive: false });

  let lastWidth = root.clientWidth;
  new ResizeObserver(() => {
    if (root.clientWidth === lastWidth) return schedule();
    lastWidth = root.clientWidth;
    render();
  }).observe(root);

  return {
    set(d) { doc = d; render(); },
    apply(op) { if (applyOp(doc, op).length) render(); },
    layout(name) { chosen = name; render(); },
    get current() { return current; },
    get mountedCount() { return mounted.size; },
  };
}
