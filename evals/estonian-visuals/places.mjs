// Where each picture "is", as weighted points on a map, for the drift room's map in the corner
// (plans/drift-room.md, "The look, and the map in the corner").
// Usage:
//   node places.mjs outline   Natural Earth (public domain) -> out/drift-room/map/outline.json and
//                             out/natural-earth/centroids.json. Downloads about 0.9 MB once (world-atlas
//                             50m countries TopoJSON, 50m lakes), cached in out/natural-earth/. Also writes
//                             out/drift-room/map/world.json (the whole world, coarse outside Europe).
//   node places.mjs outline-world   only world.json
//   node places.mjs outline-fine    out/drift-room/map/world-fine.json: as world.json from Natural Earth 1:10m, full
//                             10m detail around the Baltic (for a map zoomed onto Estonia, ai-estonia.html)
//   node places.mjs           out/drift-room/places.json (runs `outline` first if its files are missing)
//
// places.json is an object keyed by picture path (relative to out/), each entry
//   { file, kind, subject, task, variant, model, prompt, asked: { lat, lon, label },
//     points: [{ lat, lon, w, r }], source: 'judge' | 'neighbours', judge: {...}, alt? }
// plus one entry per subject (key = subject id, e.g. "bog", and "ashhill") that sums the generated
// named-prompt pictures of that subject, for the room, whose scenes are not these pictures.
//
// Method.
// - asked: where the prompt meant (Pakri for the klint, the onion villages for Peipsi, the county
//   centroid when the subject has no single place). Neutral prompts keep the same place: it is still
//   what we were testing for. A real photo's asked place is its own geotag (else its county).
// - judge (out/nature/geo-cache.jsonl), each point named (region or country, shown when off the map): the unprimed Gemini Flash answer (the primed one only when
//   there is no unprimed). One point at the region centroid when the region is in REGIONS (Estonian
//   counties, and the regions it named near the Baltic), else at the country centroid. w = confidence,
//   r = the spread in km: the region's size, or for a country sqrt(area / pi) * 0.6 (40 to 600 km).
//   "unknown" gives no points.
// - country centroid: Natural Earth 50m polygons sampled on a grid; only cells inside Europe
//   (25 W to 60 E, 34 to 72 N) count when the country has any, so Russia sits west of the Urals and
//   not in Siberia; the area (and so r) is that part's area too.
// - neighbours (out/neighbours/, when its embeddings of the reference photos exist): for each picture
//   of a subject the neighbour test covers, the k = 10 nearest reference photos of that subject, for
//   each encoder (DINOv2, SigLIP), against the same balanced set as neighbours.mjs (each country capped
//   at max(15, smallest country's count)), the picture itself excluded. Each neighbour is a point at its
//   geotag (r 25 km), else at the mean geotag of the photos of the same place (r = their spread, at
//   least 30 km), else at a known place (PLACES), else its country centroid. w = softmax of cosine
//   similarity over the k (temperature 0.05), halved per encoder, summed where both pick the same photo.
//   Where neighbours exist they are the points and the judge's go in `alt`.
// Later sets (costumes, history, film) add a block like natureSet() below.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const OUT = here('./out/');
const NE = `${OUT}natural-earth/`;
const MAP = `${OUT}drift-room/map/`;
const [cmd] = process.argv.slice(2);
const readJsonl = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const readJson = (f, d = null) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
const round = (x, n = 3) => Math.round(x * 10 ** n) / 10 ** n;

// ---- Natural Earth: outline and centroids ----

const SRC = {
  countries: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json',
  lakes: 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_50m_lakes.geojson',
  countries10: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-10m.json',
  lakes10: 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_10m_lakes.geojson',
};
const WINDOW = { lon: [-28, 58], lat: [28, 74] }; // kept in the outline: the view (12 W-42 E, 35-71 N) and the margin a wide canvas shows
const EUROPE = { lon: [-25, 60], lat: [34, 72] };
const PROJ = { lon0: 23, lat0: 58.5, k: 56 }; // heatmap.js: equirectangular (x scaled by cos 56 deg), then a radial zoom on the Baltic

async function cached(name, url) {
  const f = `${NE}${name}`;
  if (!existsSync(f)) {
    mkdirSync(NE, { recursive: true });
    console.log(`fetch ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    writeFileSync(f, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(readFileSync(f, 'utf8'));
}

function decodeArcs(topo) {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  return topo.arcs.map((a) => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
}

const ringOf = (arcs, idx) => idx.flatMap((i, n) => { const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse(); return n ? a.slice(1) : a; });
const polygonsOf = (arcs, g) => (g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : []).map((p) => p.map((r) => ringOf(arcs, r)));

function inPolygon(x, y, rings) {
  let inside = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Grid-sampled centroid and area (km2) of a country, its European part when it has one.
function centroid(polys) {
  const boxes = polys.map((rings) => { const xs = rings[0].map((p) => p[0]), ys = rings[0].map((p) => p[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; });
  const sample = (win, step) => {
    let sx = 0, sy = 0, sw = 0;
    polys.forEach((rings, k) => {
      const [x0, x1, y0, y1] = boxes[k];
      const ax = Math.max(x0, win.lon[0]), bx = Math.min(x1, win.lon[1]), ay = Math.max(y0, win.lat[0]), by = Math.min(y1, win.lat[1]);
      for (let y = Math.ceil(ay / step) * step + step / 2; y < by; y += step) for (let x = Math.ceil(ax / step) * step + step / 2; x < bx; x += step) {
        if (!inPolygon(x, y, rings)) continue;
        const w = Math.cos((y * Math.PI) / 180);
        sx += x * w; sy += y * w; sw += w;
      }
    });
    return sw ? { lon: sx / sw, lat: sy / sw, area: sw * step * step * 111.32 * 111.32 } : null;
  };
  let c = sample(EUROPE, 0.25) ?? sample({ lon: [-180, 180], lat: [-90, 90] }, 0.5) ?? sample({ lon: [-180, 180], lat: [-90, 90] }, 0.05);
  if (!c) { const [x0, x1, y0, y1] = boxes[0]; c = { lon: (x0 + x1) / 2, lat: (y0 + y1) / 2, area: 100 }; }
  return { lat: round(c.lat), lon: round(c.lon), r: Math.round(Math.min(600, Math.max(40, Math.sqrt(c.area / Math.PI) * 0.6))) };
}

// Douglas-Peucker in projected degrees.
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const k = Math.cos((PROJ.k * Math.PI) / 180);
  const P = pts.map(([x, y]) => [x * k, y]);
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = P[a], [bx, by] = P[b];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    let best = -1, bi = -1;
    // a closed ring starts and ends on the same point: measure from that point instead of a line
    for (let i = a + 1; i < b; i++) { const d = L > 1e-9 ? Math.abs((P[i][0] - ax) * dy - (P[i][1] - ay) * dx) / L : Math.hypot(P[i][0] - ax, P[i][1] - ay); if (d > best) { best = d; bi = i; } }
    if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const inWin = ([x, y]) => x >= WINDOW.lon[0] && x <= WINDOW.lon[1] && y >= WINDOW.lat[0] && y <= WINDOW.lat[1];
// The runs of a line inside the window, each with one point beyond either end so lines reach the edge.
function clip(pts) {
  const runs = [];
  let cur = null;
  pts.forEach((p, i) => {
    if (inWin(p)) { if (!cur) { cur = i > 0 ? [pts[i - 1]] : []; runs.push(cur); } cur.push(p); }
    else if (cur) { cur.push(p); cur = null; }
  });
  return runs;
}

async function outline() {
  const topo = await cached('countries-50m.json', SRC.countries);
  const lakes = await cached('lakes-50m.geojson', SRC.lakes);
  const arcs = decodeArcs(topo);
  const geoms = topo.objects.countries.geometries;
  // Arc use count: once = coast, twice = a land border.
  const uses = new Map();
  for (const g of geoms) {
    const seen = new Set();
    const walk = (x) => (Array.isArray(x) ? x.forEach(walk) : seen.add(x < 0 ? ~x : x));
    walk(g.arcs ?? []);
    for (const i of seen) uses.set(i, (uses.get(i) ?? 0) + 1);
  }
  const lines = [];
  const add = (kind, pts, tol) => {
    for (const run of clip(pts)) {
      const s = simplify(run, tol);
      if (s.length < 2) continue;
      lines.push([kind, ...s.flatMap(([x, y]) => [Math.round(x * 100), Math.round(y * 100)])]);
    }
  };
  // Estonia's own arcs (its coast and its borders) get their own kind, so the map can draw them a little brighter.
  const estonia = new Set();
  const mark = (x) => (Array.isArray(x) ? x.forEach(mark) : estonia.add(x < 0 ? ~x : x));
  mark(geoms.find((g) => g.properties.name === 'Estonia').arcs);
  arcs.forEach((a, i) => { if (uses.has(i)) add(estonia.has(i) ? 3 : uses.get(i) > 1 ? 1 : 0, a, 0.03); });
  for (const f of lakes.features) {
    const g = f.geometry;
    for (const poly of g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]) {
      const ring = poly[0];
      const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
      const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      if (span < 0.35 || !ring.some(inWin)) continue; // lakes too small to read at 320 px go
      add(2, ring, 0.02);
    }
  }
  mkdirSync(MAP, { recursive: true });
  const out = {
    source: 'Natural Earth 1:50m (public domain), via world-atlas 2.0.2 (countries) and natural-earth-vector 5.1.2 (lakes); clipped and simplified by evals/estonian-visuals/places.mjs',
    window: WINDOW, view: { lon: [-12, 42], lat: [35, 71] }, proj: PROJ, scale: 100,
    kinds: ['coast', 'border', 'lake', 'estonia'],
    lines,
  };
  writeFileSync(`${MAP}outline.json`, JSON.stringify(out));
  const cents = {};
  for (const g of geoms) { const polys = polygonsOf(arcs, g); if (polys.length) cents[g.properties.name] = centroid(polys); }
  writeFileSync(`${NE}centroids.json`, JSON.stringify(cents, null, 1));
  console.log(`outline.json: ${lines.length} lines, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB; ${Object.keys(cents).length} centroids`);
  await worldOutline();
}

// The whole world, for when the map flies out to Canada or New Zealand (heatmap.js, "The camera"): the same
// arcs and lakes, at 50m detail inside WINDOW (as outline.json) and coarse outside it (Douglas-Peucker at
// 0.25 deg, about 110m), small islands and lakes outside it dropped, land borders only inside it, nothing
// south of 60 S. Same format as outline.json.
async function worldOutline() {
  const topo = await cached('countries-50m.json', SRC.countries);
  const lakes = await cached('lakes-50m.geojson', SRC.lakes);
  const arcs = decodeArcs(topo);
  const geoms = topo.objects.countries.geometries;
  const uses = new Map();
  for (const g of geoms) {
    const seen = new Set();
    const walk = (x) => (Array.isArray(x) ? x.forEach(walk) : seen.add(x < 0 ? ~x : x));
    walk(g.arcs ?? []);
    for (const i of seen) uses.set(i, (uses.get(i) ?? 0) + 1);
  }
  const estonia = new Set();
  const mark = (x) => (Array.isArray(x) ? x.forEach(mark) : estonia.add(x < 0 ? ~x : x));
  mark(geoms.find((g) => g.properties.name === 'Estonia').arcs);
  const FINE = 0.03, COARSE = 0.25;
  const lines = [];
  const push = (kind, s) => { if (s.length >= 2) lines.push([kind, ...s.flatMap(([x, y]) => [Math.round(x * 100), Math.round(y * 100)])]); };
  const spanOf = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); };
  // a line split into runs inside and outside the window, each simplified at its own detail, sharing their end points
  const add = (kind, pts, fine, coarse, minSpan) => {
    pts = pts.filter((p) => p[1] > -60);
    if (pts.length < 2) return;
    const inside = pts.map(inWin);
    if (!inside.some(Boolean) && (kind === 1 || spanOf(pts) < minSpan)) return;
    let start = 0;
    for (let i = 1; i <= pts.length; i++) {
      if (i < pts.length && inside[i] === inside[start]) continue;
      const run = pts.slice(start, Math.min(pts.length, i + 1));
      if (inside[start]) push(kind, simplify(run, fine));
      else if (kind !== 1) push(kind, simplify(run, coarse));
      start = i;
    }
  };
  arcs.forEach((a, i) => { if (uses.has(i)) add(estonia.has(i) ? 3 : uses.get(i) > 1 ? 1 : 0, a, FINE, COARSE, 1.5); });
  for (const f of lakes.features) {
    const g = f.geometry;
    for (const poly of g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]) {
      const ring = poly[0], span = spanOf(ring);
      if (ring.some(inWin) ? span < 0.35 : span < 2) continue;
      add(2, ring, 0.02, 0.2, 2);
    }
  }
  const out = {
    source: 'Natural Earth 1:50m (public domain), via world-atlas 2.0.2 (countries) and natural-earth-vector 5.1.2 (lakes); 50m detail inside window, simplified to about 110m outside it, by evals/estonian-visuals/places.mjs outline',
    window: WINDOW, view: { lon: [-12, 42], lat: [35, 71] }, proj: PROJ, scale: 100,
    kinds: ['coast', 'border', 'lake', 'estonia'],
    lines,
  };
  mkdirSync(MAP, { recursive: true });
  writeFileSync(`${MAP}world.json`, JSON.stringify(out));
  console.log(`world.json: ${lines.length} lines, ${lines.reduce((a, l) => a + (l.length - 1) / 2, 0)} points, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
}

// ---- tables ----

// Judge answers and neighbour-test country codes -> Natural Earth names.
const ALIAS = { 'United States': 'United States of America', USA: 'United States of America', UK: 'United Kingdom', England: 'United Kingdom',
  'Czech Republic': 'Czechia', 'Bosnia and Herzegovina': 'Bosnia and Herz.' };
const CC = { EE: 'Estonia', GB: 'United Kingdom', FR: 'France', IE: 'Ireland', SE: 'Sweden', FI: 'Finland', LV: 'Latvia', PL: 'Poland',
  BY: 'Belarus', RU: 'Russia', CZ: 'Czechia', SK: 'Slovakia', UA: 'Ukraine', DE: 'Germany', LT: 'Lithuania', NO: 'Norway', DK: 'Denmark' };

// Region centroids (lat, lon, r km): Estonian counties, and the regions the judge named near the Baltic.
const REGIONS = {
  Estonia: { Harju: [59.33, 24.75, 40], Hiiu: [58.88, 22.6, 30], 'Ida-Viru': [59.2, 27.4, 40], Jõgeva: [58.75, 26.4, 35], Järva: [58.88, 25.55, 35],
    Lääne: [58.95, 23.75, 35], 'Lääne-Viru': [59.25, 26.35, 35], Põlva: [58.05, 27.2, 30], Pärnu: [58.4, 24.3, 45], Rapla: [58.95, 24.75, 35],
    Saare: [58.4, 22.5, 40], Tartu: [58.4, 26.8, 35], Valga: [57.9, 26.1, 30], Viljandi: [58.35, 25.6, 35], Võru: [57.75, 27.0, 30] },
  Sweden: { Gotland: [57.5, 18.55, 50], Kalmar: [57.2, 16.3, 70], Jönköping: [57.5, 14.4, 60], Västernorrland: [63.0, 17.5, 110], Stockholm: [59.4, 18.2, 60],
    Östergötland: [58.3, 15.7, 60], Dalarna: [61.0, 14.5, 110], Småland: [57.0, 15.0, 110] },
  Finland: { Lapland: [67.5, 26.0, 180] },
  Russia: { 'Republic of Karelia': [63.5, 33.0, 200], Pskov: [57.5, 29.0, 130], Tula: [54.0, 37.5, 90] },
  Lithuania: { Kaunas: [55.0, 23.9, 50], Klaipėda: [55.6, 21.4, 50] },
  Denmark: { 'North Denmark Region': [57.0, 10.0, 60] },
  Germany: { 'Lower Saxony': [52.8, 9.5, 110], Thuringia: [50.9, 11.0, 70], Bavaria: [48.9, 11.4, 130] },
  Norway: { Oslo: [59.9, 10.75, 25] },
  Ukraine: { Kyiv: [50.45, 30.5, 40], Donetsk: [48.0, 37.8, 90], Crimea: [45.3, 34.4, 90], 'Autonomous Republic of Crimea': [45.3, 34.4, 90] },
  'United Kingdom': { England: [52.5, -1.5, 180], Scotland: [56.8, -4.2, 150], Kent: [51.2, 0.7, 40], 'East Sussex': [50.9, 0.3, 30], 'County Durham': [54.7, -1.8, 30] },
  Ireland: { 'County Mayo': [53.9, -9.3, 45] },
  Slovakia: { Žilina: [49.2, 19.0, 50] },
  Czechia: { 'South Bohemian Region': [49.0, 14.4, 60], 'Liberec Region': [50.7, 15.0, 35], 'South Moravian Region': [49.0, 16.6, 55] },
  Slovenia: { Styria: [46.4, 15.5, 50] },
  Italy: { 'Friuli-Venezia Giulia': [46.1, 13.1, 50] },
  Romania: { Tulcea: [45.2, 29.0, 50] },
  France: { Finistère: [48.3, -4.1, 50], 'Auvergne-Rhône-Alpes': [45.5, 4.5, 130] },
  Spain: { Aragon: [41.5, -0.7, 120], 'Valencian Community': [39.4, -0.6, 100] },
};
const regionKey = (s) => s.replace(/\s+(County|maakond|Oblast|Region)$/i, '').replace(/maa$/, '').trim();

// Neighbour-test places with no geotagged photo of their own.
const PLACES = { Dover: [51.13, 1.34, 10], 'Seven Sisters': [50.75, 0.15, 8], 'Beachy Head': [50.74, 0.24, 6], Étretat: [49.71, 0.2, 6],
  Moher: [52.97, -9.43, 8], 'Höga Kusten': [62.9, 18.3, 30], Mustvee: [58.85, 26.94, 8], Pakri: [59.36, 24.04, 8],
  'North Estonian Klint': [59.4, 26.0, 120], Kolkja: [58.66, 27.15, 6], Varnja: [58.6, 27.25, 6], Kallaste: [58.66, 27.16, 6], Piirissaar: [58.38, 27.5, 5] };

// Where the prompt meant, by subject. Without one: the task's county.
const ASKED = {
  bog: [59.47, 25.65, 'Viru bog'], alvar: [58.4, 22.5, 'Saaremaa'], klint: [59.36, 24.04, 'Pakri'], peipsi: [58.66, 27.15, 'Peipsi'],
  ash_hills: [59.35, 26.97, 'Kiviõli'], lasnamae: [59.44, 24.85, 'Lasnamäe'], setomaa: [57.81, 27.44, 'Setomaa'], lighthouse: [58.92, 22.2, 'Kõpu, Hiiumaa'],
  matsalu: [58.77, 23.6, 'Matsalu'], old_town: [59.437, 24.745, 'Tallinn'], eyebright: [58.4, 22.5, 'Saaremaa'],
};
const ESTONIA = [58.65, 25.5, 'Estonia'];

// ---- points ----

let CENT = null;
function countryPoint(name, w) {
  const n = ALIAS[name] ?? name;
  const c = CENT[n];
  if (!c) { console.warn(`no centroid for ${name}`); return null; }
  return { lat: c.lat, lon: c.lon, w: round(w), r: c.r };
}

function judgePoints(a) {
  if (!a || !a.country || a.country === 'unknown') return [];
  const w = a.confidence ?? 0.5;
  const regs = REGIONS[a.country] ?? REGIONS[ALIAS[a.country]];
  if (a.region && regs) {
    const key = regionKey(a.region);
    const hit = regs[key] ?? regs[a.region] ?? Object.entries(regs).find(([k]) => key.startsWith(k) || k.startsWith(key))?.[1];
    if (hit) return [{ lat: hit[0], lon: hit[1], w: round(w), r: hit[2], name: a.region }];
  }
  const p = countryPoint(a.country, w);
  return p ? [{ ...p, name: a.country }] : [];
}

const norm = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const sha1 = (s) => createHash('sha1').update(s).digest('hex');

// The neighbour test's references, as neighbours.mjs builds them, with a place for each.
function neighbourRefs(natureReal) {
  const meta = readJson(`${OUT}neighbours/refs/refs.json`, []);
  const refs = meta.filter((m) => !m.excluded).map((m) => ({ subject: m.subject, cc: m.cc, place: m.place, lat: m.lat, lon: m.lon, title: m.title, path: `neighbours/${m.file}` }));
  const subjects = new Set(refs.map((r) => r.subject));
  for (const p of natureReal) if (subjects.has(p.subject) && !meta.some((m) => m.title === p.title))
    refs.push({ subject: p.subject, cc: 'EE', place: p.county, lat: p.lat, lon: p.lon, title: p.title, path: `nature/real/${p.id}.jpg` });
  // A place for refs without a geotag: the mean of its geotagged siblings, a known place, or the country.
  const groups = {};
  for (const r of refs) (groups[`${r.cc}|${r.place}`] ??= []).push(r);
  for (const rs of Object.values(groups)) {
    const tagged = rs.filter((r) => r.lat != null);
    let fallback;
    if (tagged.length) {
      const lat = tagged.reduce((s, r) => s + r.lat, 0) / tagged.length, lon = tagged.reduce((s, r) => s + r.lon, 0) / tagged.length;
      const spread = Math.sqrt(tagged.reduce((s, r) => s + ((r.lat - lat) * 111) ** 2 + ((r.lon - lon) * 111 * Math.cos((lat * Math.PI) / 180)) ** 2, 0) / tagged.length);
      fallback = { lat, lon, r: Math.max(30, Math.round(spread)) };
    } else if (PLACES[rs[0].place]) { const [lat, lon, r] = PLACES[rs[0].place]; fallback = { lat, lon, r: Math.max(r, 15) }; }
    else { const c = countryPoint(CC[rs[0].cc] ?? rs[0].cc, 1); fallback = c && { lat: c.lat, lon: c.lon, r: c.r }; }
    for (const r of rs) r.at = r.lat != null ? { lat: r.lat, lon: r.lon, r: 25 } : fallback;
  }
  return refs.filter((r) => r.at);
}

function balance(refs) {
  const by = {};
  for (const r of refs) (by[r.cc] ??= []).push(r);
  const cap = Math.max(15, Math.min(...Object.values(by).map((x) => x.length)));
  return Object.values(by).flatMap((rs) => rs.sort((a, b) => sha1(a.path).localeCompare(sha1(b.path))).slice(0, cap));
}

function makeNeighbours(natureReal) {
  const encs = ['dino', 'siglip'].map((e) => [e, readJson(`${OUT}neighbours/emb-${e}.json`)]).filter(([, m]) => m);
  if (!encs.length) return () => null;
  const refs = neighbourRefs(natureReal);
  const bySubject = {};
  for (const r of refs) (bySubject[r.subject] ??= []).push(r);
  const pools = Object.fromEntries(Object.entries(bySubject).map(([s, rs]) => [s,
    Object.fromEntries(encs.map(([e, m]) => [e, balance(rs.filter((r) => m[r.path])).map((r) => ({ ...r, v: norm(m[r.path]) }))]))]));
  return (subject, path, k = 10, tau = 0.05) => {
    const pool = pools[subject];
    if (!pool) return null;
    const acc = new Map();
    let used = 0;
    for (const [e, m] of encs) {
      const refsE = pool[e].filter((r) => r.path !== path);
      if (!m[path] || refsE.length < k) continue;
      used++;
      const v = norm(m[path]);
      const near = refsE.map((r) => ({ r, s: dot(v, r.v) })).sort((a, b) => b.s - a.s).slice(0, k);
      const ex = near.map((n) => Math.exp((n.s - near[0].s) / tau)), sum = ex.reduce((a, b) => a + b, 0);
      near.forEach((n, i) => {
        const key = n.r.path;
        const p = acc.get(key) ?? { lat: round(n.r.at.lat), lon: round(n.r.at.lon), w: 0, r: n.r.at.r, cc: n.r.cc, place: n.r.place, name: CC[n.r.cc] ?? n.r.cc };
        p.w += ex[i] / sum;
        acc.set(key, p);
      });
    }
    if (!used) return null;
    return [...acc.values()].map((p) => ({ ...p, w: round(p.w / used) })).sort((a, b) => b.w - a.w);
  };
}

// ---- sets ----

function natureSet() {
  const tasks = JSON.parse(readFileSync(here('./tasks-nature.json'), 'utf8'));
  const real = readJson(`${OUT}nature/real/photos.json`, []);
  const rows = readJsonl(`${OUT}nature/geo-cache.jsonl`);
  const answer = (model, task) => rows.findLast((r) => r.judge === 'google/gemini-3.8-flash' && r.model === model && r.task === task && r.country)
    ?? rows.findLast((r) => r.judge === 'google/gemini-3.8-flash#primed' && r.model === model && r.task === task && r.country);
  const neighbours = makeNeighbours(real);
  const askedFor = (subject, county) => {
    const [lat, lon, label] = ASKED[subject] ?? (county && REGIONS.Estonia[county] ? [...REGIONS.Estonia[county].slice(0, 2), `${county} County, Estonia`] : ESTONIA);
    return { lat, lon, label };
  };
  const entry = (base, a) => {
    const j = judgePoints(a);
    const n = neighbours(base.subject, base.file);
    const judge = a ? { country: a.country, region: a.region, confidence: a.confidence, reason: a.reason, judge: a.judge } : null;
    return n?.length ? { ...base, points: n, source: 'neighbours', judge, alt: { source: 'judge', points: j } }
      : { ...base, points: j, source: 'judge', judge };
  };
  const out = [];
  for (const p of real) {
    const file = `nature/real/${p.id}.jpg`;
    if (!existsSync(`${OUT}${file}`)) continue;
    const t = tasks.find((t) => t.subject === p.subject && t.variant === 'named');
    const asked = p.lat != null ? { lat: p.lat, lon: p.lon, label: ASKED[p.subject]?.[2] ?? p.county ?? 'Estonia' } : askedFor(p.subject, regionKey(p.county ?? '') || t?.county);
    out.push(entry({ file, kind: 'real', subject: p.subject, task: p.id, variant: 'real', model: 'real', prompt: p.title.replace(/^File:/, ''),
      credit: `${p.author}, ${p.licence}`, url: p.url, asked }, answer('real', p.id)));
  }
  for (const t of tasks) for (const model of ['flux-2-klein-4b', 'flux-3-image-klein', 'p-image', 'nano-banana-2-lite', 'flux-2-dev']) {
    const file = `nature/${model}/${t.id}.jpg`;
    if (!existsSync(`${OUT}${file}`)) continue;
    out.push(entry({ file, kind: 'generated', subject: t.subject, task: t.id, variant: t.variant, model, prompt: t.prompt, asked: askedFor(t.subject, t.county) }, answer(model, t.id)));
  }
  return out;
}

// The era ladder (era.mjs): one picture per era, the woman and the man put into the same model's village,
// the judge asked about that composite. Subject "era"; the model field reads "<year> · <model>" so they sort by year.
function eraSet() {
  const { readdirSync } = process.getBuiltinModule('node:fs');
  if (!existsSync(`${OUT}era/`)) return [];
  const out = [];
  for (const id of readdirSync(`${OUT}era/`).sort()) {
    const m = readJson(`${OUT}era/${id}/era.json`);
    if (!m || !m.main || !existsSync(`${OUT}era/${id}/pair.jpg`)) continue;
    const a = m.judge?.pair?.country ? { ...m.judge.pair } : null;
    const judge = a ? { country: a.country, region: a.region, confidence: a.confidence, reason: a.reason, judge: a.judge } : null;
    out.push({ file: `era/${id}/pair.jpg`, kind: 'generated', subject: 'era', task: id, variant: 'named', model: `${m.year} · ${m.label}`,
      prompt: 'An Estonian woman and man in national costume, in an Estonian village.', asked: { lat: ESTONIA[0], lon: ESTONIA[1], label: ESTONIA[2] },
      points: judgePoints(a), source: 'judge', judge });
  }
  return out;
}

// One field per subject: the named-prompt generated pictures summed (each picture's weights as they
// are, then the whole scaled so the strongest point is 1). For the room's scenes, keyed by subject.
function bySubject(entries) {
  const out = {};
  const groups = {};
  for (const e of entries) if (e.kind === 'generated' && e.variant === 'named') (groups[e.subject] ??= []).push(e);
  for (const [s, es] of Object.entries(groups)) {
    const acc = new Map();
    for (const e of es) for (const p of e.points) {
      const key = `${p.lat},${p.lon}`;
      const q = acc.get(key) ?? { lat: p.lat, lon: p.lon, w: 0, r: p.r };
      q.w += p.w; acc.set(key, q);
    }
    const pts = [...acc.values()];
    const max = Math.max(...pts.map((p) => p.w), 1e-9);
    out[s] = { file: null, kind: 'subject', subject: s, asked: es[0].asked, source: es[0].source, n: es.length,
      points: pts.map((p) => ({ ...p, w: round(p.w / max) })).sort((a, b) => b.w - a.w) };
  }
  if (out.ash_hills) out.ashhill = out.ash_hills;
  return out;
}

// The local judge (Gemma 4 26B through Ollama on the work Mac, local-nature.mjs): a second section of
// slides, "Judged here", one entry per picture it answered for, keyed `here:<file>`, its points from
// Gemma's answer, with the seconds and joules the answer took and Flash's answer beside it. Real photos
// all; cloud pictures where Gemma named a country. Plus a summed field under the key `here`.
function hereSet(entries) {
  const rows = readJsonl(`${OUT}nature/geo-cache.jsonl`).filter((r) => r.judge === 'ollama/gemma4:26b' && r.country);
  const out = [];
  for (const e of entries) {
    const a = rows.findLast((r) => r.model === e.model && r.task === e.task);
    if (!a || (e.kind !== 'real' && a.country === 'unknown')) continue;
    out.push({ ...e, section: 'here', points: judgePoints(a), source: 'judge', alt: undefined, flash: e.judge,
      judge: { country: a.country, region: a.region, confidence: a.confidence, reason: a.reason, judge: a.judge },
      cost: { seconds: round(a.latency / 1000, 1), energy_j: Math.round(a.energy_j), sys_energy_j: Math.round(a.sys_energy_j), where: a.where } });
  }
  return out;
}
function summed(es, key) {
  const acc = new Map();
  for (const e of es) for (const p of e.points) { const k = `${p.lat},${p.lon}`; const q = acc.get(k) ?? { lat: p.lat, lon: p.lon, w: 0, r: p.r, name: p.name }; q.w += p.w; acc.set(k, q); }
  const pts = [...acc.values()], max = Math.max(...pts.map((p) => p.w), 1e-9);
  return { file: null, kind: 'subject', subject: key, asked: ESTONIA_ASKED, source: 'judge', n: es.length, points: pts.map((p) => ({ ...p, w: round(p.w / max) })).sort((a, b) => b.w - a.w) };
}
const ESTONIA_ASKED = { lat: ESTONIA[0], lon: ESTONIA[1], label: ESTONIA[2] };

// world.json at 10m around the Baltic (asked 2026-11-20: "zooming to est is too crude vector borders"): one source,
// Natural Earth 1:10m, so the tiers meet without seams; 10m kept almost whole inside BALTIC (Douglas-Peucker at
// 0.004 deg, about 300 m), 0.03 deg in WINDOW as world.json, 0.25 deg outside; coordinates to 0.001 deg.
const BALTIC = { lon: [14, 34], lat: [52, 63] };
async function fineOutline() {
  const topo = await cached('countries-10m.json', SRC.countries10);
  const lakes = await cached('lakes-10m.geojson', SRC.lakes10);
  const arcs = decodeArcs(topo);
  const geoms = topo.objects.countries.geometries;
  const uses = new Map();
  for (const g of geoms) {
    const seen = new Set();
    const walk = (x) => (Array.isArray(x) ? x.forEach(walk) : seen.add(x < 0 ? ~x : x));
    walk(g.arcs ?? []);
    for (const i of seen) uses.set(i, (uses.get(i) ?? 0) + 1);
  }
  const estonia = new Set();
  const mark = (x) => (Array.isArray(x) ? x.forEach(mark) : estonia.add(x < 0 ? ~x : x));
  mark(geoms.find((g) => g.properties.name === 'Estonia').arcs);
  const Q = 1000, lines = [];
  const push = (kind, s) => { if (s.length >= 2) lines.push([kind, ...s.flatMap(([x, y]) => [Math.round(x * Q), Math.round(y * Q)])]); };
  const spanOf = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); };
  const inBaltic = ([x, y]) => x >= BALTIC.lon[0] && x <= BALTIC.lon[1] && y >= BALTIC.lat[0] && y <= BALTIC.lat[1];
  const tier = (p) => (inBaltic(p) ? 2 : inWin(p) ? 1 : 0);
  // a line split into runs by tier, each simplified at its own detail, sharing their end points
  const add = (kind, pts, tols, minSpan, minFine) => {
    pts = pts.filter((p) => p[1] > -60);
    if (pts.length < 2) return;
    const t = pts.map(tier), top = Math.max(...t), span = spanOf(pts);
    if (top === 0 && (kind === 1 || span < minSpan)) return;
    if (top === 1 && span < minFine) return;
    let start = 0;
    for (let i = 1; i <= pts.length; i++) {
      if (i < pts.length && t[i] === t[start]) continue;
      const run = pts.slice(start, Math.min(pts.length, i + 1));
      if (t[start] || kind !== 1) push(kind, simplify(run, tols[t[start]]));
      start = i;
    }
  };
  arcs.forEach((a, i) => { if (uses.has(i)) add(estonia.has(i) ? 3 : uses.get(i) > 1 ? 1 : 0, a, [0.25, 0.03, 0.004], 1.5, 0.15); });
  for (const f of lakes.features) {
    const g = f.geometry;
    for (const poly of g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]) {
      const ring = poly[0], span = spanOf(ring);
      if (ring.some(inBaltic) ? span < 0.08 : ring.some(inWin) ? span < 0.35 : span < 2) continue;
      add(2, ring, [0.2, 0.02, 0.003], 2, 0.35);
    }
  }
  const out = {
    source: 'Natural Earth 1:10m (public domain), via world-atlas 2.0.2 (countries) and natural-earth-vector 5.1.2 (lakes); 10m detail around the Baltic, about 50m in window, about 110m outside, by evals/estonian-visuals/places.mjs outline-fine',
    window: WINDOW, fine: BALTIC, view: { lon: [-12, 42], lat: [35, 71] }, proj: PROJ, scale: Q,
    kinds: ['coast', 'border', 'lake', 'estonia'],
    lines,
  };
  mkdirSync(MAP, { recursive: true });
  writeFileSync(`${MAP}world-fine.json`, JSON.stringify(out));
  console.log(`world-fine.json: ${lines.length} lines, ${lines.reduce((a, l) => a + (l.length - 1) / 2, 0)} points, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
}

if (cmd === 'outline') await outline();
else if (cmd === 'outline-world') await worldOutline();
else if (cmd === 'outline-fine') await fineOutline();
else {
  if (!existsSync(`${MAP}outline.json`) || !existsSync(`${NE}centroids.json`)) await outline();
  CENT = JSON.parse(readFileSync(`${NE}centroids.json`, 'utf8'));
  const entries = [...natureSet(), ...eraSet()];
  const here = hereSet(entries);
  const places = { ...Object.fromEntries(entries.map((e) => [e.file, e])), ...bySubject(entries),
    ...Object.fromEntries(here.map((e) => [`here:${e.file}`, e])), ...(here.length ? { here: summed(here, 'here') } : {}) };
  mkdirSync(`${OUT}drift-room/`, { recursive: true });
  writeFileSync(`${OUT}drift-room/places.json`, JSON.stringify(places, null, 1));
  const src = entries.reduce((o, e) => ((o[e.source] = (o[e.source] ?? 0) + 1), o), {});
  console.log(`judged here: ${here.length} pictures (${here.filter((e) => e.kind === 'real').length} real)`);
  console.log(`places.json: ${entries.length} pictures (${Object.entries(src).map(([k, n]) => `${k} ${n}`).join(', ')}), ${entries.filter((e) => !e.points.length).length} with no place (judge said unknown)`);
}
