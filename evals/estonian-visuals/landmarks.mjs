// Tallinn landmarks: a checklist written from checked facts, and a same-viewpoint comparison, for the
// pictures of Tallinn: the old town from Toompea (nature set old_town, old_town_neutral), the Town Hall
// (Estonia set raekoda, 2026-11-09) and Toompea Castle (history set restoration_1991).
// Usage:
//   node landmarks.mjs fetch                 real photos from Commons into out/landmarks/refs/ (1 request a second)
//   node landmarks.mjs sheet                 contact sheets out/landmarks/sheet-<subject>-<town>.jpg, to check by eye
//   node landmarks.mjs exclude <id> ...      drop photos that are not the subject
//   node landmarks.mjs embed                 DINOv2 small + SigLIP base, cached (transformers.js from ./neighbours/)
//   KEY_PERSON=eka-teacher node landmarks.mjs judge   checks + the skeptical question, Gemini 3.8 Flash, live gateway
//   node landmarks.mjs report                out/drift-room/landmarks.json and out/landmarks/report.md
// Research use only: out/ is not in git, nothing is published.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const EV = here('./out/');
const OUT = `${EV}landmarks/`;
const REFS = `${OUT}refs/`;
const UA = 'visualia-research (kristjan.jansen@gmail.com)';
const GATEWAY = process.env.GATEWAY ?? 'https://gw.visualia.space';
const GEMINI = 'google/gemini-3.8-flash';
const PRICE = [0.75, 3.75]; // $ per M tokens in / out (catalog 2026-11-16)
const BUDGET = Number(process.env.BUDGET ?? 1.45);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (s) => createHash('sha1').update(s).digest('hex');
const readJson = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
const readJsonl = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const strip = (html) => String(html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const [cmd, ...rest] = process.argv.slice(2);

// ---- the checklist: one yes/no each, written from a source (quoted) ----

const WP = 'https://en.wikipedia.org/wiki/';
const SRC = {
  olaf: [`${WP}St._Olaf%27s_Church,_Tallinn`, 'its spire now stands 123.8 meters tall'],
  nicholas: [`${WP}St._Nicholas_Church,_Tallinn`, 'The tower is now 105 metres high ... replaced with a Baroque spire with airy galleries'],
  hall: [`${WP}Tallinn_Town_Hall`],
  toompea: [`${WP}Toompea`, 'a limestone hill ... about 20-30 metres higher than the surrounding areas'],
  kohtuotsa: ['https://www.visittallinn.ee/eng/visitor/see-do/things-to-do/attractions-museums/177800/kohtuotsa-viewing-platform',
    'views over the red roofs and towering spires of the Old Town as well as of the gleaming highrise buildings in the new part of the city, with the Gulf of Finland, the port and the Pirita district in the background'],
  patkuli: ['https://thirdeyetraveller.com/patkuli-viewing-platform-tallinn/', 'city walls, towers with peak rooftops, a view of St Olaf\'s church, and the harbour area below'],
  walls: [`${WP}Walls_of_Tallinn`, 'The walls and the many gates are still largely extant today (Nunnatorn, Kuldjala, Saunatorn on Tornide väljak)'],
  castle: [`${WP}Toompea_Castle`],
  nevsky: [`${WP}Alexander_Nevsky_Cathedral,_Tallinn`, 'In the five onion domes, gilded iron crosses are seen'],
  pink: ['https://www.lonelyplanet.com/points-of-interest/toompea-castle/445751', 'the pretty-in-pink baroque palace that now houses Estonia\'s Riigikogu'],
};
const CHECKS = {
  skyline: {
    state: 'A photo of a town.',
    checks: [
      { id: 'olaf', q: 'Is there one church tower with a very tall, slender, pointed spire that rises clearly above every other tower in the picture?', src: SRC.olaf, fact: 'St Olaf\'s (Oleviste): 123.8 m, against St Nicholas 105 m and the Town Hall about 64 m' },
      { id: 'nicholas', q: 'Is there a church spire built in stacked stages with small open galleries (a Baroque spire), not a single smooth cone?', src: SRC.nicholas, fact: 'St Nicholas (Niguliste), Baroque spire with galleries; the Holy Spirit church has a Renaissance spire of the same kind' },
      { id: 'town_hall', q: 'Among the houses, is there a slender tower with a thin spire rising from the end of a long secular building (a town hall), not from a church?', src: [SRC.hall[0], 'A salient octahedral tower ... rises from the building\'s eastern gable'], fact: 'the Town Hall tower with Old Thomas, seen from Kohtuotsa' },
      { id: 'wall_towers', q: 'Are there round stone defensive towers with tall pointed conical roofs, standing in a row along a town wall?', src: SRC.patkuli, fact: 'Tornide väljak towers below Patkuli; also SRC walls', also: SRC.walls },
      { id: 'red_roofs', q: 'Are most of the roofs in the old town red or orange clay tiles?', src: SRC.kohtuotsa, fact: 'red roofs' },
      { id: 'sea', q: 'Is the sea or a harbour visible behind the town?', src: SRC.kohtuotsa, fact: 'the Gulf of Finland and the port in the background' },
      { id: 'from_hill', q: 'Is the photo taken from a hill or a high point, looking down over the roofs?', src: SRC.toompea, fact: 'Kohtuotsa and Patkuli are on the edge of Toompea' },
      { id: 'highrises', q: 'Are modern high-rise buildings visible beyond the old town?', src: SRC.kohtuotsa, fact: 'the highrise buildings of the city centre beyond the old town' },
    ],
  },
  raekoda: {
    state: 'A picture of a building.',
    checks: [
      { id: 'limestone', q: 'Are the walls of the building grey stone, not brick and not painted plaster?', src: [SRC.hall[0], 'The town hall is built out of grey limestone'] },
      { id: 'arcade', q: 'Is there an open arcade, a row of arches, along the ground floor of the long side of the building?', src: [SRC.hall[0], 'An open arcade ... is on the building\'s square\'s long side ... almost on the whole façade\'s ground floor'] },
      { id: 'octagonal', q: 'Does the tower have eight sides (octagonal) and rise from one end of the building, not from the middle?', src: [SRC.hall[0], 'A salient octahedral tower ... rises from the building\'s eastern gable'] },
      { id: 'spire', q: 'Does the tower end in a tall, slender spire?', src: [SRC.hall[0], 'The spire was built in 1627, but obtained its final shape in 1781'] },
      { id: 'vane', q: 'Is there a small weather-vane figure of a man (a soldier) at the very top of the spire?', src: [SRC.hall[0], 'The Old Thomas was placed on the top of the town hall in 1530'] },
      { id: 'battlements', q: 'Does the top of the main facade wall have a crenellated parapet (battlements)?', src: [SRC.hall[0], 'The main façade is decorated by a defensive parapet and dragon head-shaped gargoyles'] },
      { id: 'dragons', q: 'Are there waterspouts shaped like dragon heads sticking out from the top of the facade?', src: [SRC.hall[0], 'dragon head-shaped gargoyles'] },
      { id: 'square', q: 'Does the building stand along an open town square?', src: [SRC.hall[0], 'the south side of the medieval market square'] },
    ],
  },
  toompea: {
    state: 'A photo of a place.',
    checks: [
      { id: 'tower', q: 'Is there a tall medieval stone tower rising above a castle wall?', src: [SRC.castle[0], 'Tall Hermann is 48 metres tall and dominates the castle skyline'] },
      { id: 'flag_top', q: 'Is a flag flying from the top of that tower?', src: [SRC.castle[0], 'The flag of Estonia is hoisted at the top of the tower every day at sunrise'] },
      { id: 'flag_ee', q: 'Is the flag on the tower blue on top, black in the middle and white at the bottom?', src: [SRC.castle[0], 'The flag of Estonia is hoisted at the top of the tower'] },
      { id: 'pink_palace', q: 'Is there a pink-painted palace facade in Baroque or Neoclassical style?', src: SRC.pink, also: [SRC.castle[0], 'A new dominating wing in Baroque and Neoclassical style, designed by Johann Schultz'] },
      { id: 'on_hill', q: 'Do the castle walls stand on a steep slope or cliff, above the ground around it?', src: SRC.toompea },
      { id: 'onion_domes', q: 'Is there an Orthodox cathedral with onion domes?', src: SRC.nevsky, fact: 'Alexander Nevsky Cathedral (1894-1900) faces the castle on Toompea' },
    ],
  },
};
const SKEPTIC = `Look only at the picture.
Which real landmarks can you identify by name (building, tower, church, and the city)? Which buildings or towers look invented, or not like any real place you know?
Answer with JSON only:
{"city": "<the city, or \\"unknown\\">", "confidence": <0 to 1>, "named_landmarks": ["<name>", ...], "invented": ["<short description of a building that looks invented>", ...]}`;

// ---- real photos: the same viewpoints, and the confusers ----

const TOWNS = ['Tallinn', 'Riga', 'Gdańsk', 'Lübeck', 'Stockholm', 'Prague'];
const SOURCES = {
  skyline: {
    Tallinn: [{ cat: 'Views from Kohtuotsa viewing platform', place: 'Kohtuotsa' }, { cat: 'Patkul viewing platform', depth: 1, place: 'Patkuli' }, { cat: 'Kohtuotsa viewing platform', place: 'Kohtuotsa' }],
    Riga: [{ cat: "Views from St. Peter's Church Spire, Riga" }],
    'Gdańsk': [{ cat: 'Views from the tower of St. Mary church, Gdańsk' }],
    'Lübeck': [{ cat: 'Views from tower of St. Petri, Lübeck', depth: 1 }],
    Stockholm: [{ cat: 'Views from Monteliusvägen' }],
    Prague: [{ cat: 'Views from Prague Castle' }],
  },
  raekoda: {
    Tallinn: [{ cat: 'Tallinn Town Hall' }, { cat: 'Tower of Tallinn Town Hall' }],
    Riga: [{ cat: 'Riga Town Hall' }, { cat: 'House of Blackheads (Riga)' }],
    'Gdańsk': [{ cat: 'Gdańsk Main Town Hall' }],
    'Lübeck': [{ cat: 'Town hall of Lübeck' }],
    Stockholm: [{ cat: 'Exterior of Stockholm City Hall' }],
    Prague: [{ cat: 'Old Town Hall (Prague)' }],
  },
  toompea: { Tallinn: [{ cat: 'Toompea Castle' }] },
};
const PER = { skyline: { Tallinn: 30, other: 10 }, raekoda: { Tallinn: 30, other: 10 }, toompea: { Tallinn: 10 } };
const PER_AUTHOR = 5;
const SKIP_TITLE = /\b(map|plan|drawing|painting|engraving|lithograph|interior|inside|night|nacht|noc|öö|stamp|logo|postcard|bw|b&w|black and white|sundial|clock|detail|plaque|tafel|ceiling|hall of|saal|kitchen)\b|\.(svg|png|tif)$/i;

async function api(params) {
  await sleep(1100);
  const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (res.ok) return res.json();
    console.log(`commons ${res.status}, waiting`);
    await sleep(10000 * (i + 1));
  }
  throw new Error('commons failed');
}
const INFO = { prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime|timestamp', iiurlwidth: '768', iiextmetadatafilter: 'Artist|LicenseShortName|DateTimeOriginal' };
async function fromCategory(cat, depth = 0, seen = new Set()) {
  if (seen.has(cat)) return [];
  seen.add(cat);
  // 50 at a time: imageinfo with extmetadata comes back for at most 50 files a request.
  let files = [];
  let cont = {};
  for (let page = 0; page < 6; page++) {
    const data = await api({ action: 'query', generator: 'categorymembers', gcmtitle: `Category:${cat}`, gcmtype: 'file', gcmlimit: '50', ...INFO, ...cont });
    files = files.concat((data.query?.pages ?? []).filter((p) => p.imageinfo));
    if (!data.continue?.gcmcontinue) break;
    cont = { gcmcontinue: data.continue.gcmcontinue };
  }
  if (depth > 0) {
    const subs = await api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${cat}`, cmtype: 'subcat', cmlimit: '30' });
    for (const s of subs.query?.categorymembers ?? []) if (!/night|interior|art|black and white|historical/i.test(s.title)) files = files.concat(await fromCategory(s.title.replace(/^Category:/, ''), depth - 1, seen));
  }
  return files;
}

const meta = () => readJson(`${REFS}refs.json`, []);
async function fetchRefs() {
  mkdirSync(REFS, { recursive: true });
  const m = meta();
  const save = () => writeFileSync(`${REFS}refs.json`, JSON.stringify(m, null, 2));
  for (const [subject, towns] of Object.entries(SOURCES)) for (const [town, sources] of Object.entries(towns)) {
    const want = PER[subject][town] ?? PER[subject].other;
    const have = m.filter((x) => x.subject === subject && x.town === town && !x.excluded);
    if (have.length >= want) { console.log(`${subject} ${town}: ${have.length} already`); continue; }
    const lists = [];
    for (const s of sources) {
      const pages = await fromCategory(s.cat, s.depth ?? 0);
      const list = pages.filter((p) => {
        const ii = p.imageinfo?.[0];
        return ii && ii.mime === 'image/jpeg' && ii.width >= 800 && ii.width >= ii.height * 0.9 && !SKIP_TITLE.test(p.title) && !m.some((x) => x.title === p.title);
      }).map((p) => ({ p, s }));
      lists.push(list.sort((a, b) => hash(a.p.title).localeCompare(hash(b.p.title))));
      console.log(`${subject} ${town} cat:${s.cat}: ${list.length} candidates`);
    }
    const order = [];
    for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length && !order.some((o) => o.p.title === l[i].p.title)) order.push(l[i]);
    const authors = {};
    for (const h of have) authors[h.author] = (authors[h.author] ?? 0) + 1;
    mkdirSync(`${REFS}${subject}/${town}/`, { recursive: true });
    let got = have.length;
    for (const { p, s } of order) {
      if (got >= want) break;
      const ii = p.imageinfo[0];
      const md = ii.extmetadata ?? {};
      const author = strip(md.Artist?.value).slice(0, 120) || 'unknown';
      if ((authors[author] ?? 0) >= PER_AUTHOR) continue;
      await sleep(1100);
      const res = await fetch(ii.thumburl, { headers: { 'user-agent': UA } });
      if (!res.ok) { console.log(`  ${p.title}: ${res.status}`); if (res.status === 429) await sleep(30000); continue; }
      const id = hash(p.title).slice(0, 12);
      const file = `landmarks/refs/${subject}/${town}/${id}.jpg`;
      writeFileSync(`${EV}${file}`, Buffer.from(await res.arrayBuffer()));
      m.push({ id, subject, town, place: s.place ?? null, source: `Category:${s.cat}`, title: p.title, author, licence: md.LicenseShortName?.value ?? null,
        date: strip(md.DateTimeOriginal?.value).slice(0, 30) || null, url: ii.descriptionurl, file });
      authors[author] = (authors[author] ?? 0) + 1;
      got++;
      save();
    }
    console.log(`${subject} ${town}: ${got} photos`);
  }
  save();
}

async function sheets() {
  const sharp = createRequire(here('./neighbours/package.json'))('sharp');
  const m = meta().filter((x) => !x.excluded);
  for (const [k, xs] of Object.entries(Object.groupBy(m, (x) => `${x.subject}-${x.town}`))) {
    const W = 220, H = 165, cols = 6, rows = Math.ceil(xs.length / cols);
    const tiles = await Promise.all(xs.map(async (x, i) => {
      const img = await sharp(`${EV}${x.file}`).resize(W, H - 18, { fit: 'cover' }).toBuffer();
      const label = Buffer.from(`<svg width="${W}" height="18"><rect width="100%" height="100%" fill="#fff"/><text x="3" y="13" font-size="12" font-family="Helvetica">${x.id}</text></svg>`);
      return [{ input: img, left: (i % cols) * W, top: Math.floor(i / cols) * H }, { input: label, left: (i % cols) * W, top: Math.floor(i / cols) * H + H - 18 }];
    }));
    const file = `${OUT}sheet-${k.replace(/[^\w-]/g, '_')}.jpg`;
    await sharp({ create: { width: cols * W, height: rows * H, channels: 3, background: '#fff' } }).composite(tiles.flat()).jpeg({ quality: 80 }).toFile(file);
    console.log(file);
  }
}

function exclude(ids) {
  const m = meta();
  for (const x of m) if (ids.includes(x.id)) x.excluded = true;
  writeFileSync(`${REFS}refs.json`, JSON.stringify(m, null, 2));
  console.log(`${m.filter((x) => x.excluded).length} excluded`);
}

// ---- the pictures ----

const NATURE_MODELS = ['flux-2-klein-4b', 'flux-3-image-klein', 'p-image', 'nano-banana-2-lite', 'flux-2-dev'];
const ESTONIA_MODELS = ['chilloutmix', 'dalle-mini', 'dreamshaper-8', 'dreamshaper-8-lcm', 'flux-1-schnell', 'flux-2-dev', 'flux-2-klein-4b', 'flux-2-klein-9b',
  'lucid-origin', 'phoenix-1.0', 'sd-1.4', 'sd-1.5', 'sd-turbo', 'sdxl', 'sdxl-lightning'];
const HISTORY_MODELS = ['flux-2-pro-preview', 'flux-3-image-klein', 'nano-banana-2-lite'];

// Held out by photographer: a third of Tallinn's photos per subject (the control), the rest are references.
function split(refs) {
  const held = new Set();
  for (const rs of Object.values(Object.groupBy(refs.filter((r) => r.town === 'Tallinn'), (r) => r.subject))) {
    const authors = [...new Set(rs.map((r) => r.author))].sort((a, b) => hash(a).localeCompare(hash(b)));
    let n = 0;
    for (const a of authors) { if (n >= rs.length / 3) break; for (const r of rs.filter((r) => r.author === a)) { held.add(r.file); n++; } }
  }
  return held;
}

function pictures() {
  const list = [];
  for (const t of ['old_town', 'old_town_neutral']) for (const model of NATURE_MODELS) {
    const f = `nature/${model}/${t}.jpg`;
    if (existsSync(`${EV}${f}`)) list.push({ path: f, kind: 'gen', subject: 'skyline', model, variant: t === 'old_town' ? 'named' : 'neutral', task: t });
  }
  for (const model of ESTONIA_MODELS) if (existsSync(`${EV}${model}/raekoda.jpg`)) list.push({ path: `${model}/raekoda.jpg`, kind: 'gen', subject: 'raekoda', model, variant: 'named', task: 'raekoda' });
  for (const t of ['restoration_1991', 'restoration_1991_neutral']) for (const model of HISTORY_MODELS) {
    const f = `history/${model}/${t}.jpg`;
    if (existsSync(`${EV}${f}`)) list.push({ path: f, kind: 'gen', subject: 'toompea', model, variant: t.endsWith('neutral') ? 'neutral' : 'named', task: t });
  }
  for (const id of ['old_town-1', 'old_town-2']) list.push({ path: `nature/real/${id}.jpg`, kind: 'real', subject: 'skyline', town: 'Tallinn', model: 'real', variant: 'nature-control', held: true });
  const refs = meta().filter((x) => !x.excluded);
  const held = split(refs);
  for (const r of refs) list.push({ path: r.file, kind: 'real', subject: r.subject, town: r.town, model: 'real', variant: 'commons', held: held.has(r.file), place: r.place, title: r.title, author: r.author, licence: r.licence, url: r.url });
  return list;
}

// Which pictures the checks are asked of: every generated one; real Tallinn photos held out (all Toompea ones);
// two photos per confuser town (to see what the checks let through).
function toJudge(all) {
  const real = all.filter((p) => p.kind === 'real');
  const confusers = Object.values(Object.groupBy(real.filter((p) => p.town !== 'Tallinn'), (p) => `${p.subject}|${p.town}`))
    .flatMap((xs) => xs.sort((a, b) => hash(a.path).localeCompare(hash(b.path))).slice(0, 2));
  return [...all.filter((p) => p.kind === 'gen'), ...real.filter((p) => p.town === 'Tallinn' && (p.held || p.subject === 'toompea')).slice(0, 999), ...confusers];
}

// ---- judge ----

const keyOf = () => {
  const keys = Object.fromEntries(readFileSync(here('../../.keys.local'), 'utf8').trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  const k = keys[process.env.KEY_PERSON ?? 'eka-teacher'];
  if (!k) throw new Error('no key for KEY_PERSON in .keys.local');
  return k;
};
const spent = () => readJsonl(`${OUT}spend.jsonl`).reduce((s, r) => s + r.usd, 0);
function dataUrl(path) {
  mkdirSync(`${OUT}.jpg/`, { recursive: true });
  const tmp = `${OUT}.jpg/${path.replace(/[^a-z0-9]/gi, '_')}.jpg`;
  if (!existsSync(tmp)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${EV}${path}`, '-map_metadata', '-1', '-vf', "scale='min(768,iw)':-2", '-q:v', '3', tmp]);
  return `data:image/jpeg;base64,${readFileSync(tmp).toString('base64')}`;
}
async function chat(key, text, url) {
  for (let i = 1; ; i++) {
    const res = await fetch(`${GATEWAY}/v1/chat/completions`, {
      method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: GEMINI, max_tokens: 2000, reasoning_effort: 'low', messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url } }, { type: 'text', text }] }] }),
    });
    const data = await res.json().catch(() => ({}));
    const out = data.choices?.[0]?.message?.content;
    if (res.ok && out) {
      const u = data.usage ?? {};
      const usd = ((u.prompt_tokens ?? 0) * PRICE[0] + ((u.completion_tokens ?? 0) + (u.completion_tokens_details?.reasoning_tokens ?? 0)) * PRICE[1]) / 1e6;
      appendFileSync(`${OUT}spend.jsonl`, JSON.stringify({ usd }) + '\n');
      try { return JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)); } catch { if (i >= 3) throw new Error(`no JSON: ${out.slice(0, 160)}`); continue; }
    }
    if (i >= 3) throw new Error(`${res.status} ${JSON.stringify(data).slice(0, 200)}`);
    await sleep(3000 * i);
  }
}

async function judge() {
  const key = keyOf();
  const cache = `${OUT}judge.jsonl`;
  const done = new Set(readJsonl(cache).map((r) => `${r.path}|${r.q}`));
  const jobs = [];
  for (const p of toJudge(pictures())) {
    const C = CHECKS[p.subject];
    for (const c of C.checks) jobs.push({ p, q: c.id, text: `${C.state} Look only at the picture.\nQuestion: ${c.q}\nAnswer with JSON only: {"answer": "yes" or "no", "confidence": <how sure you are of that answer, 0.5 to 1>}` });
    jobs.push({ p, q: 'skeptic', text: SKEPTIC });
  }
  const todo = jobs.filter((j) => !done.has(`${j.p.path}|${j.q}`));
  console.log(`${todo.length} of ${jobs.length} to ask; spent so far $${spent().toFixed(3)}`);
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < todo.length) {
      if (spent() > BUDGET) { console.log(`budget $${BUDGET} reached`); return; }
      const j = todo[i++];
      try {
        const a = await chat(key, j.text, dataUrl(j.p.path));
        appendFileSync(cache, JSON.stringify({ path: j.p.path, q: j.q, a }) + '\n');
        if (j.q === 'skeptic') console.log(`${j.p.path}: ${a.city} ${a.confidence} | ${(a.named_landmarks ?? []).join('; ')}`);
      } catch (e) { console.log(`${j.p.path} ${j.q}: ${e.message}`); }
    }
  }));
  console.log(`spent $${spent().toFixed(3)}`);
}

// ---- embeddings ----

const ENCODERS = { dino: 'onnx-community/dinov2-small', siglip: 'Xenova/siglip-base-patch16-224' };
async function embed() {
  const require = createRequire(here('./neighbours/package.json'));
  const T = await import(pathToFileURL(require.resolve('@huggingface/transformers')).href);
  T.env.cacheDir = `${EV}neighbours/models/`;
  T.env.useWasmCache = false;
  const ortDir = require.resolve('onnxruntime-node', { paths: [here('./neighbours/node_modules/@huggingface/transformers/')] });
  T.env.backends.onnx.wasm.wasmPaths = pathToFileURL(ortDir.replace(/dist\/.*$/, 'dist/')).href;
  T.env.backends.onnx.wasm.numThreads = 4;
  const pics = pictures().filter((p) => p.subject !== 'toompea');
  for (const [name, id] of Object.entries(ENCODERS)) {
    const file = `${OUT}emb-${name}.json`;
    const cache = readJson(file, {});
    const todo = pics.filter((p) => !cache[p.path]);
    if (!todo.length) { console.log(`${name}: all cached`); continue; }
    const proc = await T.AutoProcessor.from_pretrained(id);
    const model = name === 'siglip' ? await T.SiglipVisionModel.from_pretrained(id, { dtype: 'fp32' }) : await T.AutoModel.from_pretrained(id, { dtype: 'fp32' });
    for (const p of todo) {
      const img = await T.RawImage.read(`${EV}${p.path}`);
      const out = await model(await proc(img.rgb()));
      const v = name === 'siglip' ? out.pooler_output.data : out.last_hidden_state.data.slice(0, out.last_hidden_state.dims[2]);
      cache[p.path] = Array.from(v, (x) => Math.round(x * 1e5) / 1e5);
    }
    writeFileSync(file, JSON.stringify(cache));
    console.log(`${name}: ${todo.length} new`);
  }
}

// ---- report ----

const nrm = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const K = 10;

// Town shares of the k nearest references, both encoders averaged. Every town counts at most `cap` photos
// (the smallest town's count), Tallinn's surplus rotated over 5 draws so no single draw decides.
function neighbours(v, refs, emb) {
  const byTown = Object.groupBy(refs, (r) => r.town);
  const cap = Math.min(...Object.values(byTown).map((x) => x.length));
  const share = {};
  let near1 = null;
  const draws = 5;
  for (const enc of Object.keys(ENCODERS)) for (let d = 0; d < draws; d++) {
    const pool = Object.values(byTown).flatMap((rs) => rs.sort((a, b) => hash(a.path + d).localeCompare(hash(b.path + d))).slice(0, cap));
    const q = nrm(v[enc]);
    const near = pool.map((r) => ({ r, s: dot(q, nrm(emb[enc][r.path])) })).sort((a, b) => b.s - a.s).slice(0, K);
    for (const { r } of near) share[r.town] = (share[r.town] ?? 0) + 1 / (K * draws * 2);
    if (enc === 'siglip' && d === 0) near1 = near.slice(0, 3).map(({ r, s }) => ({ town: r.town, title: r.title, url: r.url, sim: Math.round(s * 1000) / 1000 }));
  }
  const out = Object.fromEntries(Object.entries(share).sort((a, b) => b[1] - a[1]).map(([t, s]) => [t, Math.round(s * 100) / 100]));
  return { share: out, top: Object.keys(out)[0], nearest: near1 };
}

function report() {
  const all = pictures();
  const judged = readJsonl(`${OUT}judge.jsonl`);
  const ans = (path, q) => judged.findLast((r) => r.path === path && r.q === q)?.a;
  const emb = Object.fromEntries(Object.keys(ENCODERS).map((e) => [e, readJson(`${OUT}emb-${e}.json`, {})]));
  const geo = readJsonl(`${EV}nature/geo-cache.jsonl`).filter((r) => r.judge === GEMINI && r.country);
  const geoOf = (p) => {
    if (p.subject !== 'skyline' || p.kind !== 'gen') return null;
    const h = createHash('sha256').update(readFileSync(`${EV}${p.path}`)).digest('hex').slice(0, 16);
    const g = geo.findLast((r) => r.hash === h);
    return g ? { country: g.country, region: g.region, confidence: g.confidence } : null;
  };
  const result = {};
  const lines = [];
  for (const p of toJudge(all)) {
    const C = CHECKS[p.subject];
    const checks = C.checks.map((c) => { const a = ans(p.path, c.id); if (!a) return null; const yes = String(a.answer).toLowerCase() === 'yes'; const conf = Number(a.confidence ?? 1); return { id: c.id, q: c.q, yes, prob: Math.round((yes ? conf : 1 - conf) * 100) / 100 }; }).filter(Boolean);
    const sk = ans(p.path, 'skeptic');
    const row = { subject: p.subject, kind: p.kind, model: p.model, variant: p.variant, town: p.town ?? null,
      checks, passed: checks.filter((c) => c.yes).length, of: checks.length, score: checks.length ? Math.round((100 * checks.filter((c) => c.yes).length) / checks.length) / 100 : null,
      city: sk?.city ?? null, city_confidence: sk?.confidence ?? null, named_landmarks: sk?.named_landmarks ?? [], invented: sk?.invented ?? [] };
    const g = geoOf(p);
    if (g) row.earlier_judge = g;
    if (p.kind === 'real') Object.assign(row, { title: p.title ?? null, author: p.author ?? null, licence: p.licence ?? null, url: p.url ?? null });
    result[p.path] = row;
  }
  // Neighbours: generated pictures and held-out real photos, against the references (not held out) of the subject.
  const nb = {};
  for (const subject of ['skyline', 'raekoda']) {
    const refs = all.filter((p) => p.kind === 'real' && p.subject === subject && p.variant === 'commons' && !p.held && emb.dino[p.path] && emb.siglip[p.path]);
    const qs = all.filter((p) => p.subject === subject && (p.kind === 'gen' || p.held) && emb.dino[p.path] && emb.siglip[p.path]);
    for (const p of qs) {
      const n = neighbours({ dino: emb.dino[p.path], siglip: emb.siglip[p.path] }, refs, emb);
      nb[p.path] = { ...n, subject, kind: p.kind, town: p.town ?? null, model: p.model, variant: p.variant };
      if (result[p.path]) Object.assign(result[p.path], { neighbours: n.share, nearest: n.nearest });
    }
    const counts = Object.fromEntries(Object.entries(Object.groupBy(refs, (r) => r.town)).map(([t, xs]) => [t, xs.length]));
    lines.push(`\n## ${subject}: references ${JSON.stringify(counts)}`);
    // The other towns, leave one out (they have no held-out set): does the method pull everything into Tallinn?
    for (const town of TOWNS.filter((t) => t !== 'Tallinn')) {
      const xs = refs.filter((r) => r.town === town);
      if (!xs.length) continue;
      const tops = xs.map((r) => neighbours({ dino: emb.dino[r.path], siglip: emb.siglip[r.path] }, refs.filter((x) => x.path !== r.path), emb));
      lines.push(`- leave one out, ${town}: ${tops.filter((n) => n.top === town).length}/${xs.length} land on their own town, ${tops.filter((n) => n.top === 'Tallinn').length} on Tallinn`);
    }
    lines.push('\nControl (held-out real photos): first town by neighbours');
    for (const town of TOWNS) {
      const xs = Object.values(nb).filter((x) => x.subject === subject && x.kind === 'real' && x.town === town);
      if (xs.length) lines.push(`- ${town}: ${xs.filter((x) => x.top === town).length}/${xs.length} land on their own town; mean ${town} share ${(xs.reduce((a, x) => a + (x.share[town] ?? 0), 0) / xs.length).toFixed(2)}`);
    }
  }
  // Tables.
  for (const subject of Object.keys(CHECKS)) {
    const ids = CHECKS[subject].checks.map((c) => c.id);
    lines.push(`\n## ${subject}: checks (${ids.join(', ')})\n`);
    lines.push(`| picture | ${ids.join(' | ')} | passed | city (skeptic) | named | invented | neighbours |`, `|---|${ids.map(() => '---').join('|')}|---|---|---|---|---|`);
    for (const [path, r] of Object.entries(result).filter(([, r]) => r.subject === subject)) {
      const cells = ids.map((id) => { const c = r.checks.find((x) => x.id === id); return c ? (c.yes ? 'y' : '·') : '?'; });
      const nbs = r.neighbours ? Object.entries(r.neighbours).slice(0, 3).map(([t, s]) => `${t} ${Math.round(s * 100)}`).join(', ') : '';
      lines.push(`| ${r.kind === 'gen' ? `${r.model} ${r.variant}` : `real ${r.town} ${path.split('/').pop()}`} | ${cells.join(' | ')} | ${r.passed}/${r.of} | ${r.city ?? '?'} ${r.city_confidence ?? ''} | ${r.named_landmarks.join('; ')} | ${r.invented.join('; ').slice(0, 120)} | ${nbs} |`);
    }
    const grp = (f) => { const xs = Object.values(result).filter((r) => r.subject === subject && f(r) && r.of); return xs.length ? `${(xs.reduce((a, r) => a + r.score, 0) / xs.length * 100).toFixed(0)} % (${xs.length})` : '–'; };
    lines.push(`\nMean share of checks passed: generated named ${grp((r) => r.kind === 'gen' && r.variant === 'named')}, neutral ${grp((r) => r.kind === 'gen' && r.variant === 'neutral')}, real Tallinn ${grp((r) => r.kind === 'real' && r.town === 'Tallinn')}, real other towns ${grp((r) => r.kind === 'real' && r.town !== 'Tallinn')}`);
    lines.push(`Per check, share yes: ${ids.map((id) => {
      const f = (pred) => { const xs = Object.values(result).filter((r) => r.subject === subject && pred(r)).map((r) => r.checks.find((c) => c.id === id)).filter(Boolean); return xs.length ? Math.round(100 * xs.filter((c) => c.yes).length / xs.length) : '–'; };
      return `${id} gen ${f((r) => r.kind === 'gen')} / Tallinn ${f((r) => r.kind === 'real' && r.town === 'Tallinn')} / others ${f((r) => r.kind === 'real' && r.town !== 'Tallinn')}`;
    }).join('; ')}`);
  }
  lines.push(`\nGemini spend: $${spent().toFixed(3)}`);
  const sources = Object.fromEntries(Object.entries(CHECKS).map(([s, C]) => [s, C.checks.map((c) => ({ id: c.id, q: c.q, source: c.src[0], quote: c.src[1] ?? null, fact: c.fact ?? null, also: c.also ?? null }))]));
  const doc = { about: 'Tallinn landmarks, 2026-11-16 (evals/estonian-visuals/landmarks.mjs). Per picture (path relative to evals/estonian-visuals/out/): Gemini 3.8 Flash yes/no per landmark check, the skeptical question (named landmarks, invented ones), and the town shares of its 10 nearest real photos (DINOv2 small + SigLIP base averaged, towns balanced). score = share of checks answered yes.',
    judge: GEMINI, checks: sources, pictures: result };
  mkdirSync(`${EV}drift-room/`, { recursive: true });
  writeFileSync(`${EV}drift-room/landmarks.json`, JSON.stringify(doc, null, 2));
  writeFileSync(`${OUT}report.md`, lines.join('\n') + '\n');
  writeFileSync(`${OUT}neighbours.json`, JSON.stringify(nb, null, 2));
  console.log(lines.join('\n'));
}

if (cmd === 'fetch') await fetchRefs();
else if (cmd === 'sheet') await sheets();
else if (cmd === 'exclude') exclude(rest);
else if (cmd === 'embed') await embed();
else if (cmd === 'judge') await judge();
else if (cmd === 'report') report();
else console.log('node landmarks.mjs fetch | sheet | exclude <id> ... | embed | judge | report');
