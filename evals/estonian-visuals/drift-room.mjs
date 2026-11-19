// Drift room, step 1: pictures that share one camera standpoint, so they can blend
// (plans/drift-room.md, "One standpoint, so pictures blend"). One template picture,
// every other picture an edit of it through the gateway's `references`.
// Usage (live gateway, KEY_PERSON=eka-teacher):
//   node drift-room.mjs template                 out/drift-room/land/template.png
//   node drift-room.mjs land <model> [id ...]    edits of the template into land/<model>/<id>.png
//   node drift-room.mjs figure-template          figure/template.png
//   node drift-room.mjs figure <model> [id ...]  costume edits into figure/<model>/<id>.png
//   node drift-room.mjs bg <model> [id ...]      more backgrounds into land/<model>/<id>.png: edits of the template from
//                                                models that take references, free pictures (a camera sentence) from the rest
//   node drift-room.mjs film [id ...]            Estonian film scenes as edits of the template, film/<id>.png (nano-banana-2-lite)
//   node drift-room.mjs measure                  horizon rows, figure boxes, sheets, GIFs into measure.json
//   node drift-room.mjs depth                    depth maps (Depth Anything V2 small, q8) next to every land and film picture
//   node drift-room.mjs scenes                   the other generated pictures as room scenes: 256 px colour + depth in
//                                                scenes/, and scenes.json (every scene the room can show, aligned or not)
// Every call is appended to out/drift-room/runs.json (prompt, model, references, seconds, usage).

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const sharp = createRequire(import.meta.url)('../../node_modules/sharp');
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const GATEWAY = (process.env.GATEWAY ?? 'https://gw.visualia.space').replace(/\/$/, '');
const OUT = here('./out/drift-room/');
const RUNS = `${OUT}runs.json`;

function key() {
  const keys = Object.fromEntries(readFileSync(here('../../.keys.local'), 'utf8').trim().split('\n').map((l) => l.split('=')));
  const k = keys[process.env.KEY_PERSON ?? 'eka-teacher'];
  if (!k) throw new Error('no key for KEY_PERSON in .keys.local');
  return k;
}

const TEMPLATE_PROMPT = 'A photograph of a wide, flat, open Northern European landscape: an empty grassy field reaching to a straight, '
  + 'level horizon high in the frame, exactly one third of the way down from the top edge (sky the top third, ground the bottom two thirds), and a plain grey overcast sky above it. Eye-level camera at 1.6 m, '
  + '35 mm lens, looking straight ahead, centred, the horizon perfectly horizontal. Soft diffuse overcast light, no shadows. '
  + 'No people, no animals, no buildings, no trees, no roads. Neutral, calm, documentary.';

const EDIT = (what) => `Change this landscape into ${what}; keep exactly the same camera position, horizon line and composition.`;
const LANDS = {
  bog: 'an Estonian raised bog with a wooden boardwalk leading away from the camera, small bog pools, low stunted pines and moss',
  alvar: 'a Saaremaa alvar: thin grass on flat limestone, scattered dark juniper bushes, a few stones',
  birch: 'a birch forest in spring, white birch trunks with fresh light green leaves, seen from the forest floor',
  rye: 'a ripe rye field with blue cornflowers among the stalks',
  klint: 'the North Estonian coast seen along the shore: a low, flat-topped limestone cliff (klint) with forest on top, a stony beach and the sea at its foot',
  peipsi: 'the shore of Lake Peipsi with a village of long, narrow onion beds by the wooden houses and the lake beyond',
  ashhill: 'Ida-Viru county with a large grey oil-shale ash hill (a flat-topped industrial waste heap) on the horizon over flat land',
  average: 'the average Northern European landscape',
};

// More backgrounds for the room ("make more bg", 2026-11-16), from a spread of models. Models that take
// references edit the template (EDIT, so they morph by index); the others draw free pictures with a camera
// sentence (they pass through the fog). `tier`: cheap, weak (old) or best; `where`: cloud or local.
const BG = {
  'mist-bog': ['raised bog in mist', 'an Estonian raised bog in morning mist: small bog pools, low stunted pines, moss and heather, mist lying low over it'],
  'juniper-alvar': ['juniper alvar, Saaremaa', 'a Saaremaa juniper alvar: thin grass on flat limestone, dark juniper bushes scattered across it, a few grey stones'],
  'klint-forest': ['klint with forest', 'the low North Estonian limestone klint seen along the shore: a low flat-topped cliff with forest on top, a stony beach and the calm sea'],
  'spring-birch': ['birch grove in spring', 'a birch grove in spring: white birch trunks, fresh light green leaves, wood anemones on the ground'],
  'rye-cornflower': ['rye with cornflowers', 'a ripe rye field with blue cornflowers among the stalks, a forest edge far off'],
  'peipsi-onion': ['Peipsi shore, onion beds', 'the shore of Lake Peipsi: long narrow onion beds by small wooden village houses, the flat lake beyond'],
  setomaa: ['Setomaa village', 'a Setomaa village in south-east Estonia: grey log farm buildings, a wooden fence, small fields and a little wooden chapel'],
  matsalu: ['Matsalu reeds', 'the Matsalu reed beds in western Estonia: wide brown and gold reeds, open shallow water, a flat coast'],
  lighthouse: ['Hiiumaa lighthouse at dusk', 'a Hiiumaa lighthouse at dusk: a tall lighthouse on a flat stony coast with junipers, the sky fading after sunset'],
  'winter-spruce': ['winter spruce forest', 'a winter spruce forest in Estonia: snow on the dark spruces and on the ground, quiet grey light'],
  'white-night': ['summer night meadow, white night', 'a summer meadow in Estonia during the white nights: tall grass and flowers, a pale glowing sky after midnight, a line of forest'],
  'average-north': ['the average Northern European landscape', 'the average Northern European landscape'],
};
const FREE = (what) => `A photograph of ${what}. Eye level, horizon in the middle, 35 mm lens, no people.`;
const BG_MODELS = {
  'flux-2-klein-4b': { tier: 'cheap', where: 'cloud' },
  'p-image': { tier: 'cheap', where: 'cloud' },
  'flux-1-schnell': { tier: 'weak', where: 'cloud' },
  'qwen-image-3.0-pro': { tier: 'best', where: 'cloud' },
  'flux-2-pro-preview': { tier: 'best', where: 'cloud', edit: true },
  'seedream-5-pro': { tier: 'best', where: 'cloud', edit: true },
  'nano-banana-pro': { tier: 'best', where: 'cloud', edit: true },
  // Priced in tokens the answer does not report: an estimate (medium, 1024², one reference).
  'gpt-image-2': { tier: 'best', where: 'cloud', edit: true, est: 0.06 },
};
// The old 2026-11-09 pictures (local, weak): their nearest is a cornflower meadow, close up.
const BG_OLD = [['dalle-mini', 'local'], ['sd-1.4', 'local'], ['sd-1.5', 'local'], ['dreamshaper-8', 'local']];
const bgFiles = () => Object.keys(BG_MODELS).flatMap((m) => Object.keys(BG).map((id) => ({ m, id, f: `${OUT}land/${m}/${id}.png` }))).filter((x) => existsSync(x.f));

// Film scenes: Estonian countryside films, each scene twice, by name and as a plain
// description, so the difference shows what the name adds. Same camera as the template.
const FILM_EDIT = (what) => `Change this landscape into ${what}; keep exactly the same camera position, horizon line and composition.`;
const FILMS = {
  'nipernaadi-road-named': 'a scene from the Estonian film Nipernaadi (1983): the wanderer Toomas Nipernaadi walking on a dusty summer country road between meadows, a farmstead in the distance',
  'nipernaadi-road': 'a dusty summer country road between flowering meadows in rural Estonia, a lone wanderer in a light jacket and hat walking away along it, an old farmstead with a thatched roof in the distance',
  'nipernaadi-lake-named': 'a scene from the Estonian film Nipernaadi (1983): haystacks on a mown meadow by a lake, a farm by the shore, summer evening',
  'nipernaadi-lake': 'a mown summer meadow with round haystacks on wooden poles, a calm lake beyond it and a log farmhouse on the shore, warm evening light, rural Estonia',
  'nukitsamees-named': 'a scene from the Estonian film Nukitsamees (1981): the edge of a dark spruce forest and a small farm in a clearing',
  'nukitsamees': 'the edge of a dark, mossy spruce forest meeting a clearing with a small old Estonian farm, a log barn and a well, fairy-tale mood',
  'paunvere-church-named': 'a scene from the Estonian film Kevade (1969), the village of Paunvere: the white village church with its tower beyond the fields, a country school nearby',
  'paunvere-church': 'an Estonian village in spring: a white stone church with a tall tower beyond the fields, a wooden parish school and a gravel road, birches coming into leaf',
  'paunvere-river-named': 'a scene from the Estonian film Suvi (1976), Paunvere: village boys by a small river in summer',
  'paunvere-river': 'a small slow river winding through summer meadows in an Estonian village, a few boys in old-fashioned clothes and caps fishing on the bank, a wooden footbridge',
  'reliikvia-ride-named': 'a scene from the Estonian film Viimne reliikvia (1969): Gabriel and Agnes riding on horseback across an open 16th-century Livonian landscape',
  'reliikvia-ride': 'two riders in 16th-century clothes, a young man and a young woman, galloping on horseback across an open Livonian landscape of meadows and low hills, late summer',
  'reliikvia-pirita-named': 'a scene from the Estonian film Viimne reliikvia (1969): the ruins of Pirita convent on the horizon',
  'reliikvia-pirita': 'the tall stone gable ruin of a medieval convent church standing on the horizon beyond open meadows by the sea, northern Estonia, 16th century',
  'reliikvia-camp-named': 'a scene from the Estonian film Viimne reliikvia (1969): a knight\'s camp by a river',
  'reliikvia-camp': 'a 16th-century knights\' camp by a slow river: canvas tents with pennants, tethered horses and a campfire on the meadow, Livonia',
};

const FIGURE_PROMPT = 'A full-body photograph of a woman standing straight, facing the camera, arms relaxed at her sides, feet together, '
  + 'neutral expression. She wears a plain light grey long-sleeved top and plain grey trousers, barefoot, hair tied back. '
  + 'Plain light grey seamless studio background, even soft light, no shadow on the wall. She is centred, the whole figure from '
  + 'head to feet fills the frame from 8% to 92% of its height. Front view, camera at chest height, 50 mm lens.';
const DRESS = (what) => `Dress this woman in ${what}. Keep exactly the same pose, body position, scale, framing, camera and plain background; change only her clothes.`;

function costume(slug) {
  const x = JSON.parse(readFileSync(here(`./out/rahvaroivad/extracted/${slug}-naine.json`), 'utf8'));
  let p = `the women's folk costume of ${x.parish}, Estonia. ${x.summary} The garments: `;
  for (const g of x.garments) { const s = `${g.type_en}: ${g.description_en} `; if ((p + s).length < 1500) p += s; }
  return p.trim();
}
const FIGURES = {
  folk: () => 'an Estonian folk costume',
  muhu: () => costume('muhu'),
  kihnu: () => costume('kihnu'),
};

async function draw(prompt, model, references, file, meta) {
  const t0 = Date.now();
  const res = await fetch(`${GATEWAY}/v1/images`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, model, size: '1024x1024', ...(references ? { references } : {}) }),
  });
  const data = await res.json().catch(() => ({}));
  const seconds = (Date.now() - t0) / 1000;
  // runs.json is read right before each write: parallel draws in one process would otherwise lose rows
  const readRuns = () => (existsSync(RUNS) ? JSON.parse(readFileSync(RUNS, 'utf8')) : []);
  if (!res.ok) {
    const runs = readRuns();
    runs.push({ ...meta, file: null, model, prompt, error: `${res.status} ${data.detail ?? data.error ?? ''}`.slice(0, 300), seconds });
    writeFileSync(RUNS, JSON.stringify(runs, null, 1));
    console.log(`${meta.id} ${model} failed: ${runs.at(-1).error}`);
    return false;
  }
  mkdirSync(file.replace(/[^/]+$/, ''), { recursive: true });
  await sharp(Buffer.from(data.data[0].b64_json, 'base64')).resize(1024, 1024, { fit: 'fill' }).png().toFile(file);
  const got = await sharp(Buffer.from(data.data[0].b64_json, 'base64')).metadata();
  const runs = readRuns();
  runs.push({ ...meta, file: file.replace(OUT, ''), model, prompt, references: references ? references.length : 0, got: `${got.width}x${got.height}`, seconds, usage: data.usage ?? null });
  writeFileSync(RUNS, JSON.stringify(runs, null, 1));
  console.log(`${meta.id} ${model} ${seconds.toFixed(1)}s ${got.width}x${got.height}`);
  return true;
}

const dataUrl = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;

// ---- measure ----

// The row where the picture changes most from above to below: the mean colour of
// the 8 rows above against the 8 below, over the middle 75% of the width, between
// 10% and 80% of the height. Rows of a 1024 picture.
async function horizon(file) {
  const W = 256, H = 1024;
  const { data } = await sharp(file).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows = [];
  for (let y = 0; y < H; y++) {
    const m = [0, 0, 0];
    for (let x = W / 8; x < W - W / 8; x++) for (let c = 0; c < 3; c++) m[c] += data[(y * W + x) * 3 + c];
    rows.push(m.map((v) => v / (W * 0.75)));
  }
  const band = (a, b) => [0, 1, 2].map((c) => rows.slice(a, b).reduce((s, r) => s + r[c], 0) / (b - a));
  let best = 0, at = 0;
  for (let y = 100; y < 820; y++) {
    const u = band(y - 8, y), d = band(y, y + 8);
    const diff = Math.hypot(u[0] - d[0], u[1] - d[1], u[2] - d[2]);
    if (diff > best) { best = diff; at = y; }
  }
  return { row: at, strength: Math.round(best) };
}

// Bounding box of what differs from the background: per row, the mean colour of
// the 12 px at the left and right edges (the template has a wall and a floor).
async function box(file) {
  const S = 512;
  const { data } = await sharp(file).resize(S, S, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y, c) => data[(y * S + x) * 3 + c];
  const edge = [...Array(12).keys()].flatMap((i) => [i, S - 1 - i]);
  const col = new Array(S).fill(0), row = new Array(S).fill(0);
  for (let y = 0; y < S - 3; y++) { // the last rows carry a border on some answers
    const bg = [0, 1, 2].map((c) => edge.reduce((s, x) => s + px(x, y, c), 0) / edge.length);
    for (let x = 0; x < S; x++) {
      if (Math.hypot(px(x, y, 0) - bg[0], px(x, y, 1) - bg[1], px(x, y, 2) - bg[2]) > 40) { col[x]++; row[y]++; }
    }
  }
  // Projections, so a single odd row (the wall meeting the floor) does not widen the box.
  const span = (a, n) => { const i = a.map((v, k) => (v > n ? k : -1)).filter((k) => k >= 0); return [i[0], i.at(-1)]; };
  const [x0, x1] = span(col, 8), [y0, y1] = span(row, 4);
  const k = 1024 / S;
  return { x0: x0 * k, y0: y0 * k, x1: x1 * k, y1: y1 * k, w: (x1 - x0) * k, h: (y1 - y0) * k, cx: ((x0 + x1) / 2) * k };
}

// Mean absolute grey difference with the template at 128 px (0 to 255): a rough
// "same layout" number; it also counts the change of content, so read it comparatively.
async function grey(file) {
  return sharp(file).resize(128, 128, { fit: 'fill' }).greyscale().blur(2).raw().toBuffer();
}

async function sheet(files, out, labels) {
  const T = 256, cols = Math.min(files.length, 5), rowsN = Math.ceil(files.length / cols);
  const tiles = await Promise.all(files.map(async (f, i) => ({
    input: await sharp(f).resize(T, T).composite([{ input: Buffer.from(`<svg width="${T}" height="20"><rect width="${T}" height="20" fill="black" opacity="0.6"/><text x="4" y="15" font-family="Helvetica" font-size="13" fill="white">${labels[i]}</text></svg>`), top: 0, left: 0 }]).png().toBuffer(),
    left: (i % cols) * T, top: Math.floor(i / cols) * T,
  })));
  await sharp({ create: { width: cols * T, height: rowsN * T, channels: 3, background: '#fff' } }).composite(tiles).png().toFile(out);
}

// A looping cross-fade, 384 px: each picture held 0.8 s, 1.2 s fades.
function gif(files, out) {
  const hold = 0.8, fade = 1.2, seg = hold + fade;
  const loop = [...files, files[0]];
  const inputs = loop.flatMap((f) => ['-loop', '1', '-t', String(seg + fade), '-i', f]);
  let chain = '', last = '[0:v]';
  loop.forEach((_, i) => { chain += `[${i}:v]scale=384:384,format=yuv420p,setsar=1[s${i}];`; });
  last = '[s0]';
  for (let i = 1; i < loop.length; i++) {
    chain += `${last}[s${i}]xfade=transition=fade:duration=${fade}:offset=${(i * seg).toFixed(2)}[x${i}];`;
    last = `[x${i}]`;
  }
  const total = (loop.length - 1) * seg;
  chain += `${last}trim=duration=${total},fps=12,split[a][b];[a]palettegen[p];[b][p]paletteuse`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', chain, out]);
}

async function measure() {
  const result = { land: {}, figure: {} };
  const tpl = `${OUT}land/template.png`;
  const tplGrey = await grey(tpl);
  const diff = (a, b) => Math.round(a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length);
  result.land.template = await horizon(tpl);
  for (const model of readdirSync(`${OUT}land`).filter((d) => !d.includes('.'))) {
    const rows = {};
    const ids = [...Object.keys(LANDS), ...Object.keys(BG)].filter((id) => existsSync(`${OUT}land/${model}/${id}.png`));
    for (const id of ids) {
      const f = `${OUT}land/${model}/${id}.png`;
      rows[id] = { ...(await horizon(f)), greyDiff: diff(await grey(f), tplGrey) };
    }
    const r = Object.values(rows).map((h) => h.row);
    result.land[model] = { rows, spread: r.length ? Math.max(...r) - Math.min(...r) : null, offTemplate: r.length ? Math.max(...r.map((v) => Math.abs(v - result.land.template.row))) : null };
    if (ids.length) {
      const files = [tpl, ...ids.map((id) => `${OUT}land/${model}/${id}.png`)];
      await sheet(files, `${OUT}land/sheet-${model}.png`, ['template', ...ids]);
      gif(files, `${OUT}land/fade-${model}.gif`);
    }
  }
  const filmIds = Object.keys(FILMS).filter((id) => existsSync(`${OUT}film/${id}.png`));
  if (filmIds.length) {
    const rows = {};
    for (const id of filmIds) { const f = `${OUT}film/${id}.png`; rows[id] = { ...(await horizon(f)), greyDiff: diff(await grey(f), tplGrey) }; }
    const r = Object.values(rows).map((h) => h.row);
    result.film = { rows, spread: Math.max(...r) - Math.min(...r), offTemplate: Math.max(...r.map((v) => Math.abs(v - result.land.template.row))) };
    await sheet([tpl, ...filmIds.map((id) => `${OUT}film/${id}.png`)], `${OUT}film/sheet.png`, ['template', ...filmIds]);
  }
  const ftpl = `${OUT}figure/template.png`;
  if (existsSync(ftpl)) {
    result.figure.template = await box(ftpl);
    for (const model of readdirSync(`${OUT}figure`).filter((d) => !d.includes('.'))) {
      const ids = Object.keys(FIGURES).filter((id) => existsSync(`${OUT}figure/${model}/${id}.png`));
      const rows = {};
      for (const id of ids) rows[id] = await box(`${OUT}figure/${model}/${id}.png`);
      result.figure[model] = rows;
      if (ids.length) {
        const files = [ftpl, ...ids.map((id) => `${OUT}figure/${model}/${id}.png`)];
        await sheet(files, `${OUT}figure/sheet-${model}.png`, ['template', ...ids]);
        gif(files, `${OUT}figure/fade-${model}.gif`);
      }
    }
  }
  writeFileSync(`${OUT}measure.json`, JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result, null, 1));
}

// ---- depth ----

// Depth Anything V2 small (Apache-2.0), the q8 ONNX export, through transformers.js in
// ./neighbours/ (onnxruntime-web as WebAssembly, see neighbours.mjs). Writes <name>-depth.png
// (grey, 384 px, near = white, the model's relative inverse depth min-max scaled) next to each picture.
async function depthModel() {
  const require = createRequire(here('./neighbours/package.json'));
  const T = await import(pathToFileURL(require.resolve('@huggingface/transformers')).href);
  T.env.cacheDir = here('./out/neighbours/models/');
  T.env.useWasmCache = false;
  const ortDir = require.resolve('onnxruntime-node', { paths: [here('./neighbours/node_modules/@huggingface/transformers/')] });
  T.env.backends.onnx.wasm.wasmPaths = pathToFileURL(ortDir.replace(/dist\/.*$/, 'dist/')).href;
  T.env.backends.onnx.wasm.numThreads = 4;
  const est = await T.pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', { dtype: 'q8' });
  // picture file -> grey depth PNG at `size` px, near = white
  return async (f, out, size = 384) => {
    const img = await T.RawImage.read(f);
    const { predicted_depth: d } = await est(img);
    const [h, w] = d.dims.slice(-2);
    const v = d.data; let lo = Infinity, hi = -Infinity;
    for (const x of v) { if (x < lo) lo = x; if (x > hi) hi = x; }
    const g = Buffer.alloc(w * h);
    for (let i = 0; i < w * h; i++) g[i] = Math.round(((v[i] - lo) / (hi - lo)) * 255);
    await sharp(g, { raw: { width: w, height: h, channels: 1 } }).resize(size, size, { fit: 'fill' }).png().toFile(out);
  };
}

async function depth() {
  const run = await depthModel();
  const files = [`${OUT}land/template.png`,
    ...Object.keys(LANDS).map((id) => `${OUT}land/nano-banana-2-lite/${id}.png`),
    ...Object.keys(FILMS).map((id) => `${OUT}film/${id}.png`),
    ...bgFiles().map((x) => x.f)].filter(existsSync);
  for (const f of files) {
    const out = f.replace(/\.png$/, '-depth.png');
    if (existsSync(out)) continue;
    const t0 = Date.now();
    await run(f, out);
    console.log(`${out.replace(OUT, '')} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
}

// ---- scenes: every picture the room can show ----

// Generated pictures only. Left out on purpose: nature/real and history/real (photos), the rahvaroivad.ee
// photos, and the pilot's "refs" pictures (drawn with those photos as references; they copy them closely).
// `align` names pictures that share one camera (edits of one template): only those morph point by point.
function sceneList() {
  const V = here('./out/');
  const list = [];
  const add = (src, o) => list.push({ src, ...o });
  add('drift-room/land/template.png', { subject: 'template', model: 'nano-banana-2-lite', group: 'land', align: 'land' });
  for (const id of Object.keys(LANDS)) add(`drift-room/land/nano-banana-2-lite/${id}.png`, { subject: id === 'ashhill' ? 'ash_hills' : id, model: 'nano-banana-2-lite (edit)', group: 'land', align: 'land' });
  for (const id of Object.keys(FILMS)) add(`drift-room/film/${id}.png`, { subject: id.replace(/-named$/, '').replace(/-.*/, ''), variant: id, model: 'nano-banana-2-lite (edit)', group: 'film', align: 'land' });
  // The new backgrounds: an edit morphs by index only where its horizon stayed within 40 px of the template's
  // (measure.json), else it passes through the fog like a free picture.
  const M = existsSync(`${OUT}measure.json`) ? JSON.parse(readFileSync(`${OUT}measure.json`, 'utf8')).land : {};
  const tplRow = M.template?.row ?? 511;
  // The measure is fooled by red bog moss and a beach; these hold the horizon by eye (sheets, 2026-11-16).
  const BY_EYE = ['nano-banana-pro/mist-bog', 'nano-banana-pro/klint-forest', 'gpt-image-2/klint-forest'];
  for (const { m, id } of bgFiles()) {
    const o = BG_MODELS[m], row = M[m]?.rows?.[id]?.row;
    const held = o.edit && ((row != null && Math.abs(row - tplRow) <= 40) || BY_EYE.includes(`${m}/${id}`));
    add(`drift-room/land/${m}/${id}.png`, { subject: BG[id][0], variant: id, model: `${m}${o.edit ? ' (edit)' : ''} · ${o.where} · ${o.tier}`, group: 'bg', ...(held ? { align: 'land' } : {}) });
  }
  // Old local models, the truly bad wave (asked 2026-11-16): the 2026-11-09 cornflowers (the only landscape in that
  // set) and the nature tasks re-run on the M1 with sd.cpp (out/local-m1/<model>-local/nature-*.png).
  for (const [m] of BG_OLD) if (existsSync(`${V}${m}/cornflower.jpg`)) add(`${m}/cornflower.jpg`, { subject: 'cornflower meadow (2026-11-09)', variant: 'cornflower', model: `${m} · old · local`, group: 'bg' });
  if (existsSync(`${V}local-m1`)) for (const d of readdirSync(`${V}local-m1`).filter((d) => d.endsWith('-local')).sort()) {
    for (const f of readdirSync(`${V}local-m1/${d}`).filter((f) => /^nature-.+\.png$/.test(f)).sort()) {
      const task = f.replace(/^nature-|\.png$/g, '');
      add(`local-m1/${d}/${f}`, { subject: task.replace(/_neutral$/, '').replace(/_/g, ' '), variant: task, model: `${d.replace(/-local$/, '')} · old · local`, group: 'bg' });
    }
  }
  add('drift-room/figure/template.png', { subject: 'figure', model: 'nano-banana-2-lite', group: 'figure', align: 'figure' });
  for (const m of ['nano-banana-2-lite', 'nano-banana-pro']) for (const id of Object.keys(FIGURES)) add(`drift-room/figure/${m}/${id}.png`, { subject: id === 'folk' ? 'folk costume' : id, model: `${m} (edit)`, group: 'figure', align: 'figure' });
  for (const set of ['nature', 'history']) {
    for (const m of readdirSync(`${V}${set}`).filter((d) => d !== 'real' && !d.includes('.'))) {
      for (const f of readdirSync(`${V}${set}/${m}`).filter((f) => f.endsWith('.jpg') && !f.startsWith('.')).sort()) {
        const task = f.replace(/\.jpg$/, '');
        add(`${set}/${m}/${f}`, { subject: task.replace(/_neutral$|_english$/, ''), variant: task, model: m, group: set });
      }
    }
  }
  for (const f of readdirSync(`${V}rahvaroivad/pilot`).filter((f) => f.endsWith('.jpg') && !f.startsWith('.') && !f.includes('-refs-')).sort()) {
    const [, who, variant, m] = f.match(/^(\w+)-(\w+)-(.+)-\d+\.jpg$/);
    add(`rahvaroivad/pilot/${f}`, { subject: who, variant: `${who} ${variant}`, model: m, group: 'costume' });
  }
  return list;
}

// Colour at 256 px (JPEG) and depth at 256 px for every scene not already in the room's own folders;
// the template edits keep their 1024 px pictures and 384 px depth. Cached: existing files are skipped.
async function scenes() {
  const V = here('./out/');
  const list = sceneList();
  let run = null, made = 0;
  for (const s of list) {
    if (s.src.startsWith('drift-room/')) {
      s.img = s.src.replace(/^drift-room\//, '');
      s.depth = s.img.replace(/\.png$/, '-depth.png');
      if (!existsSync(`${OUT}${s.depth}`)) { run ??= await depthModel(); await run(`${V}${s.src}`, `${OUT}${s.depth}`); made++; }
      continue;
    }
    s.img = `scenes/${s.src.replace(/\.(jpg|png)$/, '.jpg')}`;
    s.depth = `scenes/${s.src.replace(/\.(jpg|png)$/, '-depth.png')}`;
    mkdirSync(`${OUT}${s.img}`.replace(/[^/]+$/, ''), { recursive: true });
    if (!existsSync(`${OUT}${s.img}`)) await sharp(`${V}${s.src}`).resize(256, 256, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(`${OUT}${s.img}`);
    if (!existsSync(`${OUT}${s.depth}`)) { run ??= await depthModel(); await run(`${V}${s.src}`, `${OUT}${s.depth}`, 256); made++; if (made % 20 === 0) console.log(`${made} depth maps`); }
  }
  writeFileSync(`${OUT}scenes.json`, JSON.stringify(list, null, 1));
  const by = {}; for (const s of list) by[s.group] = (by[s.group] ?? 0) + 1;
  console.log(`scenes.json: ${list.length} scenes ${JSON.stringify(by)}, ${made} new depth maps`);
}

const [cmd, model, ...ids] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
if (cmd === 'template') {
  await draw(TEMPLATE_PROMPT, model ?? 'nano-banana-2-lite', null, `${OUT}land/template.png`, { id: 'land-template' });
} else if (cmd === 'land') {
  const ref = [dataUrl(`${OUT}land/template.png`)];
  await Promise.all((ids.length ? ids : Object.keys(LANDS)).filter((id) => !existsSync(`${OUT}land/${model}/${id}.png`))
    .map((id) => draw(EDIT(LANDS[id]), model, ref, `${OUT}land/${model}/${id}.png`, { id: `land-${id}` })));
} else if (cmd === 'bg') {
  const o = BG_MODELS[model];
  if (!o) throw new Error(`bg model is one of ${Object.keys(BG_MODELS).join(', ')}`);
  const ref = o.edit ? [dataUrl(`${OUT}land/template.png`)] : null;
  await Promise.all((ids.length ? ids : Object.keys(BG)).filter((id) => !existsSync(`${OUT}land/${model}/${id}.png`))
    .map((id) => draw(o.edit ? EDIT(BG[id][1]) : FREE(BG[id][1]), model, ref, `${OUT}land/${model}/${id}.png`,
      { id: `bg-${id}`, kind: o.edit ? 'edit' : 'free', tier: o.tier, where: o.where, ...(o.est ? { est_usd: o.est } : {}) })));
} else if (cmd === 'figure-template') {
  await draw(FIGURE_PROMPT, model ?? 'nano-banana-2-lite', null, `${OUT}figure/template.png`, { id: 'figure-template' });
} else if (cmd === 'figure') {
  const ref = [dataUrl(`${OUT}figure/template.png`)];
  await Promise.all((ids.length ? ids : Object.keys(FIGURES)).filter((id) => !existsSync(`${OUT}figure/${model}/${id}.png`))
    .map((id) => draw(DRESS(FIGURES[id]()), model, ref, `${OUT}figure/${model}/${id}.png`, { id: `figure-${id}` })));
} else if (cmd === 'film') {
  const ref = [dataUrl(`${OUT}land/template.png`)];
  const want = [model, ...ids].filter(Boolean);
  await Promise.all((want.length ? want : Object.keys(FILMS)).filter((id) => !existsSync(`${OUT}film/${id}.png`))
    .map((id) => draw(FILM_EDIT(FILMS[id]), 'nano-banana-2-lite', ref, `${OUT}film/${id}.png`, { id: `film-${id}` })));
} else if (cmd === 'depth') {
  await depth();
} else if (cmd === 'scenes') {
  await scenes();
} else if (cmd === 'measure') {
  await measure();
} else {
  console.log('commands: template, land <model> [id ...], figure-template, figure <model> [id ...], measure');
}
