// Where did a generated picture drift? Not by asking a judge (Gemini placed only 55 % of real
// Estonian photos in Estonia), but by its nearest neighbours among real photos of the same kind
// of place in Estonia and in the countries it could be confused with.
// Two local image encoders, to see whether they agree: DINOv2 small and SigLIP base (transformers.js,
// in Node, no Python, no model credits).
// Usage:
//   node neighbours.mjs fetch [subject ...]   reference photos from Wikimedia Commons into out/neighbours/refs/
//   node neighbours.mjs exclude <id> ...      drop reference photos checked by hand (not the subject)
//   node neighbours.mjs embed                 every reference and generated picture, both encoders, cached
//   node neighbours.mjs report                control, votes, centroids, drift arrows, PCA maps -> out/neighbours/
// transformers.js lives in ./neighbours/ (its own package, outside the root workspaces): onnxruntime-node's
// binary is refused on this machine (mmap EPERM), so it is aliased to onnxruntime-web and runs as WebAssembly.
// Research use only: out/ is not in git, nothing here is published.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const OUT = here('./out/neighbours/');
const REFS = `${OUT}refs/`;
const UA = 'visualia-research (kristjan.jansen@gmail.com)';
const THUMB = 512; // 4G: 512 px thumbnails are enough for 224 px encoders
const PER = 25; // photos per country per subject
const PER_AUTHOR = 5; // so one photographer's afternoon doesn't make a country
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (s) => createHash('sha1').update(s).digest('hex');
const [cmd, ...rest] = process.argv.slice(2);

// ---- reference photos: the same kind of place, country by country ----

// lat min, lat max, lon min, lon max. Used to drop geotagged files from the wrong place.
const BOX = {
  EE: [57.5, 59.9, 21.5, 28.3], GB: [49.8, 61, -8.7, 2], FR: [42, 51.2, -5.2, 8.3], IE: [51.3, 55.5, -10.7, -5.9],
  SE: [55, 69.1, 10.9, 24.2], FI: [59.7, 70.1, 20.5, 31.6], LV: [55.6, 58.1, 20.9, 28.3], PL: [49, 54.9, 14.1, 24.2],
  BY: [51.2, 56.2, 23.1, 32.8], RU_BALTIC: [54.2, 61.5, 19.5, 34], RU_NW: [55.5, 61.5, 27.3, 34], CZ: [48.5, 51.1, 12, 18.9],
  SK: [47.7, 49.7, 16.8, 22.6], UA: [44.3, 52.4, 22.1, 40.3], DE: [47.2, 55.1, 5.8, 15.1],
};
const COUNTRY = { EE: 'Estonia', GB: 'England', FR: 'France', IE: 'Ireland', SE: 'Sweden', FI: 'Finland', LV: 'Latvia',
  PL: 'Poland', BY: 'Belarus', RU: 'Russia', CZ: 'Czechia', SK: 'Slovakia', UA: 'Ukraine', DE: 'Germany' };

// subject -> country -> sources. cat: a Commons category (depth: how many subcategory levels);
// search: Commons full-text search. box: keep only files geotagged inside it; needCoords: drop untagged ones.
// place: a finer label (Estonian place or region) for the within-country vote.
const SOURCES = {
  klint: {
    EE: [{ cat: 'Pakri Cliff', place: 'Pakri' }, { cat: 'Pakri Peninsula', depth: 1, match: /pank|cliff|klint|rannik|coast/i, place: 'Pakri' },
      { cat: 'North Estonian Klint', depth: 1, match: /pank|klint|cliff|pankrannik|paljand|astang/i, place: 'North Estonian Klint' }],
    GB: [{ cat: 'White Cliffs of Dover', place: 'Dover' }, { cat: 'Seven Sisters, Sussex', place: 'Seven Sisters' }, { cat: 'Beachy Head', place: 'Beachy Head' }],
    FR: [{ cat: 'Cliffs of Étretat', place: 'Étretat' }],
    IE: [{ cat: 'Cliffs of Moher', place: 'Moher' }],
    SE: [{ cat: 'Rauk', depth: 2, place: 'Gotland/Öland raukar' }, { cat: 'Cliffs of Sweden', depth: 1, place: 'cliffs' },
      { cat: 'High Coast (Sweden)', depth: 1, match: /klint|cliff|stup|klipp|berget|branter|Skule/i, place: 'Höga Kusten' }],
    FI: [{ cat: 'Cliffs of Finland', depth: 1, place: 'cliffs' }, { cat: 'Coasts of Finland', depth: 1, match: /cliff|kallio|rock|shore|ranta|coast|rannikko|cape|niemi/i, place: 'coast' }],
    RU: [{ search: 'глинт', box: 'RU_NW', needCoords: true, place: 'Baltic klint' }, { search: 'Baltic Klint', box: 'RU_NW', needCoords: true, place: 'Baltic klint' },
      { search: 'Svetlogorsk cliff', box: 'RU_BALTIC', place: 'Sambia coast' }, { search: 'Светлогорск обрыв', box: 'RU_BALTIC', place: 'Sambia coast' },
      { search: 'Sambia coast cliff', box: 'RU_BALTIC', place: 'Sambia coast' }, { search: 'Sablino canyon', box: 'RU_NW', place: 'Sablino' },
      { search: 'Саблино каньон', box: 'RU_NW', place: 'Sablino' }, { search: 'Lopukhinka', box: 'RU_NW', place: 'Lopukhinka' },
      { cat: 'Cliffs of Russia', depth: 1, box: 'RU_BALTIC', needCoords: true, place: 'Baltic coast' }, { cat: 'Coasts of Russia', depth: 1, box: 'RU_BALTIC', needCoords: true, place: 'Baltic coast' }],
    LV: [{ cat: 'Jūrkalne', depth: 1, place: 'Jūrkalne' }, { search: 'stāvkrasts', box: 'LV', place: 'coast' }, { cat: 'Cliffs of Latvia', depth: 1, match: /krast|cliff|klint|iezis|atsegum|outcrop|rock/i, place: 'cliffs' }],
  },
  peipsi: {
    EE: [{ cat: 'Kolkja', place: 'Kolkja' }, { cat: 'Varnja', depth: 1, place: 'Varnja' }, { cat: 'Mustvee', depth: 1, place: 'Mustvee' },
      { cat: 'Kallaste', depth: 1, place: 'Kallaste' }, { cat: 'Piirissaar', depth: 1, place: 'Piirissaar' }],
    RU: [{ cat: 'Gdovsky District', depth: 2, place: 'Gdov' }, { cat: 'Pskovsky District', depth: 1, place: 'Pskov district' }, { cat: 'Villages in Pskov Oblast', depth: 1, place: 'Pskov villages' }],
    FI: [{ cat: 'Puumala', depth: 1, place: 'Puumala' }, { cat: 'Sulkava', depth: 2, place: 'Sulkava' }, { search: 'Saimaa village', box: 'FI', place: 'Saimaa' }],
    LV: [{ cat: 'Lake Lubāns', depth: 1, place: 'Lubāns' }, { cat: 'Latgale', depth: 1, place: 'Latgale' }],
    PL: [{ cat: 'Wooden houses in Podlaskie Voivodeship', depth: 1, place: 'Podlasie' }],
    BY: [{ cat: 'Wooden houses in Belarus', depth: 1, place: 'Belarus' }],
  },
  costume: {
    EE: [{ cat: 'Traditional clothing of Estonia', depth: 1, place: 'Commons' }],
    LV: [{ cat: 'Traditional clothing of Latvia', depth: 1 }],
    FI: [{ cat: 'Traditional clothing of Finland', depth: 1 }],
    UA: [{ cat: 'Traditional clothing of Ukraine', depth: 1 }],
    PL: [{ cat: 'Traditional clothing of Poland', depth: 1 }],
    BY: [{ cat: 'Traditional clothing of Belarus', depth: 1 }],
    RU: [{ cat: 'Traditional clothing of Russia', depth: 1 }],
  },
  alvar: {
    EE: [{ cat: 'Alvars in Estonia', place: 'alvar' }, { search: 'loopealne', box: 'EE', place: 'alvar' }, { search: 'alvar Saaremaa', box: 'EE', needCoords: true, place: 'Saaremaa' }],
    SE: [{ cat: 'Stora Alvaret', depth: 1, place: 'Öland' }, { search: 'alvar Gotland', box: 'SE', needCoords: true, place: 'Gotland' }, { search: 'alvarmark', box: 'SE', needCoords: true, place: 'alvar' }],
    IE: [{ search: 'Burren limestone', box: 'IE', place: 'Burren' }, { search: 'Burren Clare', box: 'IE', place: 'Burren' }],
  },
  bog: {
    EE: [{ cat: 'Viru bog', place: 'Viru raba' }, { cat: 'Bogs in Estonia', depth: 1, place: 'bogs' }],
    FI: [{ search: 'suo pitkospuut', box: 'FI', place: 'bog' }, { search: 'bog Finland boardwalk', box: 'FI', place: 'bog' }, { search: 'Torronsuo', box: 'FI', place: 'Torronsuo' }],
    SE: [{ cat: 'Bogs in Sweden', depth: 1, place: 'bogs' }],
    LV: [{ cat: 'Bogs in Latvia', depth: 1, place: 'bogs' }],
    RU: [{ cat: 'Bogs in Russia', depth: 1, place: 'bogs' }],
  },
  setomaa: {
    EE: [{ cat: 'Obinitsa', depth: 1, place: 'Obinitsa' }, { cat: 'Värska', depth: 1, place: 'Värska' }, { cat: 'Meremäe', depth: 1, place: 'Meremäe' },
      { cat: 'Setomaa', depth: 1, place: 'Setomaa' }, { cat: 'Saatse', depth: 1, place: 'Saatse' }],
    RU: [{ cat: 'Pechorsky District', depth: 2, place: 'Pechory' }, { cat: 'Villages in Pskov Oblast', depth: 1, place: 'Pskov villages' }],
    LV: [{ cat: 'Latgale', depth: 1, place: 'Latgale' }],
    CZ: [{ cat: 'Holašovice', depth: 1, place: 'Holašovice' }],
    SK: [{ cat: 'Vlkolínec', depth: 1, place: 'Vlkolínec' }, { cat: 'Čičmany', depth: 1, place: 'Čičmany' }],
  },
  ash_hills: {
    EE: [{ search: 'tuhamägi', box: 'EE', place: 'ash hill' }, { search: 'Kiviõli', box: 'EE', place: 'Kiviõli' }, { search: 'Kohtla-Järve ash', box: 'EE', place: 'Kohtla-Järve' }],
    UA: [{ cat: 'Spoil tips in Ukraine', depth: 2, place: 'Donbas' }, { search: 'терикон', box: 'UA', place: 'Donbas' }],
    RU: [{ search: 'терикон', box: 'RU_NW', place: 'terikon' }],
  },
};
// Generated pictures per subject (the nature set's task ids).
const SUBJECT_TASKS = { klint: 'klint', peipsi: 'peipsi', alvar: 'alvar', bog: 'bog', setomaa: 'setomaa', ash_hills: 'ash_hills' };
const NATURE_MODELS = ['flux-2-klein-4b', 'flux-3-image-klein', 'p-image', 'nano-banana-2-lite', 'flux-2-dev'];

const inBox = (b, c) => c && c.lat > b[0] && c.lat < b[1] && c.lon > b[2] && c.lon < b[3];
const strip = (html) => String(html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const SKIP_TITLE = /\b(map|carte|karte|kaart|chart|logo|coat of arms|vapp|plan|diagram|scheme|stamp|postmark|signature|book|page|scan of|painting|tableau|gemälde|drawing|engraving|gravure|lithograph|waterfall|juga|joa|kosk)\b|\.(svg|png|tif)$/i;
// Photos checked by hand on contact sheets and dropped (not the subject: a map, a painting, a crowd, a
// boat, a mushroom). The same rule for every country: keep it when the kind of place or the costume worn is
// what the photo shows. Kept in refs.json with excluded: true, so a top-up never fetches them again.

async function api(params) {
  await sleep(1100); // gentle: one request at a time, more than 1 s apart
  const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (res.ok) return res.json();
    console.log(`commons ${res.status}, waiting`);
    await sleep(10000 * (i + 1));
  }
  throw new Error('commons failed');
}

const INFO = { prop: 'imageinfo|coordinates', iiprop: 'url|extmetadata|size|mime', iiurlwidth: String(THUMB), iiextmetadatafilter: 'Artist|LicenseShortName|ImageDescription' };

// Files of a category (one page of up to 100, enough for a pick of 25), plus its subcategories to `depth`.
async function fromCategory(cat, depth, seen = new Set()) {
  if (seen.has(cat)) return [];
  seen.add(cat);
  const data = await api({ action: 'query', generator: 'categorymembers', gcmtitle: `Category:${cat}`, gcmtype: 'file', gcmlimit: '100', ...INFO });
  let files = (data.query?.pages ?? []);
  if (depth > 0) {
    const subs = await api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${cat}`, cmtype: 'subcat', cmlimit: '30' });
    for (const s of subs.query?.categorymembers ?? []) files = files.concat(await fromCategory(s.title.replace(/^Category:/, ''), depth - 1, seen));
  }
  return files;
}

async function fromSearch(q) {
  const data = await api({ action: 'query', generator: 'search', gsrsearch: `${q} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '60', ...INFO });
  return data.query?.pages ?? [];
}

function refsMeta() {
  const f = `${REFS}refs.json`;
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [];
}

async function fetchRefs(subjects) {
  mkdirSync(REFS, { recursive: true });
  const meta = refsMeta();
  const save = () => writeFileSync(`${REFS}refs.json`, JSON.stringify(meta, null, 2));
  for (const subject of subjects) for (const [cc, sources] of Object.entries(SOURCES[subject])) {
    const have = meta.filter((m) => m.subject === subject && m.cc === cc && !m.excluded);
    if (have.length >= PER) { console.log(`${subject} ${cc}: ${have.length} already`); continue; }
    // Collect candidates from every source, then pick a spread (by hash), at most PER_AUTHOR per photographer.
    const cand = new Map();
    const lists = [];
    for (const s of sources) {
      const list = [];
      let pages;
      try { pages = s.cat ? await fromCategory(s.cat, s.depth ?? 0) : await fromSearch(s.search); } catch (e) { console.log(`${subject} ${cc} ${s.cat ?? s.search}: ${e.message}`); continue; }
      let n = 0;
      for (const p of pages) {
        const ii = p.imageinfo?.[0];
        const c = p.coordinates?.[0] ?? null;
        if (!ii || ii.mime !== 'image/jpeg' || ii.width < 640 || ii.height < 400 || SKIP_TITLE.test(p.title)) continue;
        if (s.box && c && !inBox(BOX[s.box], c)) continue;
        if (s.needCoords && !c) continue;
        if (s.match && !s.match.test(p.title)) continue;
        if (cand.has(p.title) || meta.some((m) => m.title === p.title)) continue;
        cand.set(p.title, { p, s });
        list.push({ p, s });
        n++;
      }
      lists.push(list.sort((a, b) => hash(a.p.title).localeCompare(hash(b.p.title))));
      console.log(`${subject} ${cc} ${s.cat ? `cat:${s.cat}` : `search:${s.search}`}: ${n} candidates`);
    }
    const authors = {};
    for (const h of have) authors[h.author] = (authors[h.author] ?? 0) + 1;
    // Round robin over the sources, so a big category doesn't crowd out the place the subject is named after.
    const order = [];
    for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) order.push(l[i]);
    mkdirSync(`${REFS}${subject}/${cc}/`, { recursive: true });
    let got = have.length;
    for (const { p, s } of order) {
      if (got >= PER) break;
      const ii = p.imageinfo[0];
      const m = ii.extmetadata ?? {};
      const author = strip(m.Artist?.value).slice(0, 120) || 'unknown';
      if ((authors[author] ?? 0) >= PER_AUTHOR) continue;
      await sleep(1100);
      const res = await fetch(ii.thumburl, { headers: { 'user-agent': UA } });
      if (!res.ok) { console.log(`  ${p.title}: thumbnail ${res.status}`); if (res.status === 429) await sleep(30000); continue; }
      const id = hash(p.title).slice(0, 12);
      const file = `refs/${subject}/${cc}/${id}.jpg`;
      writeFileSync(`${OUT}${file}`, Buffer.from(await res.arrayBuffer()));
      const c = p.coordinates?.[0] ?? null;
      meta.push({ id, subject, cc, country: COUNTRY[cc], place: s.place ?? null, source: s.cat ? `Category:${s.cat}` : `search:${s.search}`,
        title: p.title, author, licence: m.LicenseShortName?.value ?? null, url: ii.descriptionurl, lat: c?.lat ?? null, lon: c?.lon ?? null, file });
      authors[author] = (authors[author] ?? 0) + 1;
      got++;
      save();
    }
    console.log(`${subject} ${cc}: ${got} photos${got < PER ? ` (fewer than ${PER}: only ${cand.size} candidates)` : ''}`);
  }
  save();
}

// ---- the pictures: references (Commons, rahvaroivad.ee on disk, the nature control) and generated ----

const EV = here('./out/');
const rel = (abs) => abs.slice(EV.length);

function allPictures() {
  const list = [];
  // Commons references fetched above.
  for (const m of refsMeta().filter((m) => !m.excluded)) list.push({ kind: 'real', subject: m.subject, cc: m.cc, place: m.place, author: m.author, src: 'commons', path: `neighbours/${m.file}` });
  // The nature set's own 20 Commons photos (judged by Gemini): Estonian references for their subject.
  const natReal = `${EV}nature/real/photos.json`;
  if (existsSync(natReal)) for (const p of JSON.parse(readFileSync(natReal, 'utf8'))) {
    if (!SOURCES[p.subject] || refsMeta().some((m) => m.title === p.title)) continue;
    list.push({ kind: 'real', subject: p.subject, cc: 'EE', place: p.county, author: p.author || 'unknown', src: 'nature-control', path: `nature/real/${p.id}.jpg` });
  }
  // rahvaroivad.ee: full-figure photos of reproductions (portrait, parish and wearer tagged, not a single garment).
  const mediaFile = `${EV}rahvaroivad/media.json`;
  if (existsSync(mediaFile)) {
    const media = JSON.parse(readFileSync(mediaFile, 'utf8')).media;
    const terms = JSON.parse(readFileSync(`${EV}rahvaroivad/terms.json`, 'utf8'));
    const kh = Object.fromEntries(terms.kihelkond.map((k) => [k.id, k]));
    const on = new Set(readdirSync(`${EV}rahvaroivad/photos/`));
    for (const x of media) {
      if (!on.has(`${x.id}.jpg`) || !x.kandja?.length || x.height <= x.width || /taastatud|detail/i.test(x.title)) continue;
      const parish = (x.kihelkond ?? []).map((i) => kh[i]).find((k) => k && k.parent !== 0)?.name;
      if (!parish) continue;
      // Held out by costume set (photographer and parish), not by photographer alone: most are Sandra Urvak's.
      list.push({ kind: 'real', subject: 'costume', cc: 'EE', place: parish, author: `${x.photographer || 'unknown'} / ${parish}`, src: 'rahvaroivad', path: `rahvaroivad/photos/${x.id}.jpg` });
    }
  }
  // The 2026-11-09 costume photos from rahvaroivad.ee (three per parish).
  const old = `${EV}costumes/index.json`;
  if (existsSync(old)) for (const x of JSON.parse(readFileSync(old, 'utf8')).images)
    list.push({ kind: 'real', subject: 'costume', cc: 'EE', place: x.parish, author: `${x.photographer || 'unknown'} / ${x.parish}`, src: 'rahvaroivad', path: `costumes/${x.file}` });
  // Generated: the nature set (named and neutral prompts).
  const tasks = JSON.parse(readFileSync(here('./tasks-nature.json'), 'utf8'));
  for (const [subject, sid] of Object.entries(SUBJECT_TASKS)) for (const t of tasks.filter((t) => t.subject === sid)) for (const model of NATURE_MODELS) {
    const f = `nature/${model}/${t.id}.jpg`;
    if (existsSync(`${EV}${f}`)) list.push({ kind: 'gen', subject, model, variant: t.variant, path: f });
  }
  // Generated costumes: the pilot (Muhu and Kihnu women; plain, text, refs) and the 2026-11-09 "Muhu costume".
  const pilot = `${EV}rahvaroivad/pilot/`;
  if (existsSync(pilot)) for (const f of readdirSync(pilot).filter((f) => f.endsWith('.jpg'))) {
    const [, parish, variant, model] = f.match(/^(\w+)-(plain|text|refs)-(.+)-\d\.jpg$/) ?? [];
    if (parish) list.push({ kind: 'gen', subject: 'costume', model, variant, parish, path: `rahvaroivad/pilot/${f}` });
  }
  for (const d of readdirSync(EV)) if (existsSync(`${EV}${d}/muhu_costume.jpg`))
    list.push({ kind: 'gen', subject: 'costume', model: d, variant: '2026-11-09', parish: 'muhu', path: `${d}/muhu_costume.jpg` });
  return list;
}

// ---- embeddings ----

const ENCODERS = {
  dino: { id: 'onnx-community/dinov2-small', note: 'DINOv2 small, CLS token' },
  siglip: { id: 'Xenova/siglip-base-patch16-224', note: 'SigLIP base 224, image tower' },
};

async function transformers() {
  const require = createRequire(here('./neighbours/package.json'));
  const T = await import(pathToFileURL(require.resolve('@huggingface/transformers')).href);
  T.env.cacheDir = `${OUT}models/`;
  T.env.useWasmCache = false;
  const ortDir = require.resolve('onnxruntime-node', { paths: [here('./neighbours/node_modules/@huggingface/transformers/')] });
  T.env.backends.onnx.wasm.wasmPaths = pathToFileURL(ortDir.replace(/dist\/.*$/, 'dist/')).href;
  T.env.backends.onnx.wasm.numThreads = 4;
  return T;
}

async function embed() {
  const T = await transformers();
  const pics = allPictures();
  console.log(`${pics.length} pictures (${pics.filter((p) => p.kind === 'gen').length} generated)`);
  for (const [name, enc] of Object.entries(ENCODERS)) {
    const file = `${OUT}emb-${name}.json`;
    const cache = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    const todo = pics.filter((p) => !cache[p.path]);
    if (!todo.length) { console.log(`${name}: all cached`); continue; }
    const proc = await T.AutoProcessor.from_pretrained(enc.id);
    const model = name === 'siglip'
      ? await T.SiglipVisionModel.from_pretrained(enc.id, { dtype: 'fp32' })
      : await T.AutoModel.from_pretrained(enc.id, { dtype: 'fp32' });
    let n = 0;
    for (const p of todo) {
      let img;
      try { img = await T.RawImage.read(`${EV}${p.path}`); } catch (e) { console.log(`${p.path}: ${e.message}`); continue; }
      const out = await model(await proc(img.rgb()));
      const v = name === 'siglip' ? out.pooler_output.data : out.last_hidden_state.data.slice(0, out.last_hidden_state.dims[2]);
      cache[p.path] = Array.from(v, (x) => Math.round(x * 1e5) / 1e5);
      if (++n % 50 === 0) { writeFileSync(file, JSON.stringify(cache)); console.log(`${name}: ${n}/${todo.length}`); }
    }
    writeFileSync(file, JSON.stringify(cache));
    console.log(`${name}: ${n} new, ${Object.keys(cache).length} cached`);
  }
}

// ---- report ----

const norm = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const mean = (vs) => { const m = new Array(vs[0].length).fill(0); for (const v of vs) for (let i = 0; i < v.length; i++) m[i] += v[i] / vs.length; return m; };
const sub = (a, b) => a.map((x, i) => x - b[i]);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '–');
if (!Object.groupBy) Object.groupBy = (xs, f) => xs.reduce((o, x) => ((o[f(x)] ??= []).push(x), o), {});
const top = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1]);

// Hold out a third of each country's photos as the control, by photographer (a held-out photo's
// author has no photo in the reference set), so a burst of near-duplicates can't carry it.
function split(refs) {
  const held = new Set();
  // Per country and source, so Commons photos of Estonian costumes are held out too, not only rahvaroivad.ee's.
  const byCc = Object.groupBy(refs, (r) => `${r.cc}|${r.src}`);
  for (const rs of Object.values(byCc)) {
    const authors = [...new Set(rs.map((r) => r.author))].sort((a, b) => hash(a).localeCompare(hash(b)));
    let n = 0;
    for (const a of authors) {
      if (n >= rs.length / 3) break;
      for (const r of rs.filter((r) => r.author === a)) { held.add(r.path); n++; }
    }
  }
  return held;
}

// k nearest references: country vote, and the place vote among the Estonian ones in the k.
function knn(v, refs, k = 10) {
  const near = refs.map((r) => ({ r, s: dot(v, r.v) })).sort((a, b) => b.s - a.s).slice(0, k);
  const votes = {};
  for (const { r } of near) votes[r.cc] = (votes[r.cc] ?? 0) + 1;
  const places = {};
  for (const { r } of near.filter((x) => x.r.cc === 'EE')) places[r.place] = (places[r.place] ?? 0) + 1;
  return { votes, top: top(votes)[0][0], places, near };
}

// Balance the vote: a country with more photos would win ties by sheer number, so every country
// counts at most as many photos as the smallest reference set (cap at least 15).
function balance(refs) {
  const byCc = Object.groupBy(refs, (r) => r.cc);
  const cap = Math.max(15, Math.min(...Object.values(byCc).map((x) => x.length)));
  return Object.values(byCc).flatMap((rs) => rs.sort((a, b) => hash(a.path).localeCompare(hash(b.path))).slice(0, cap));
}

// PCA to 2D by power iteration on the centred data.
function pca2(vs) {
  const m = mean(vs);
  const X = vs.map((v) => sub(v, m));
  const comps = [];
  for (let c = 0; c < 2; c++) {
    let w = norm(X[0].map((_, i) => Math.sin(i * 7.3 + c)));
    for (let it = 0; it < 100; it++) {
      const next = new Array(w.length).fill(0);
      for (const x of X) { const p = dot(x, w); for (let i = 0; i < x.length; i++) next[i] += p * x[i]; }
      for (const prev of comps) { const p = dot(next, prev); for (let i = 0; i < next.length; i++) next[i] -= p * prev[i]; }
      w = norm(next);
    }
    comps.push(w);
  }
  return X.map((x) => comps.map((w) => dot(x, w)));
}

const PALETTE = ['#2a6fdb', '#e0533d', '#2fa36b', '#a35ad8', '#e09a1f', '#1fb3c4', '#c2477f', '#7a8a2e', '#8a6a4f'];
const MARK = { named: '★', neutral: '◆', plain: '●', text: '▲', refs: '■', '2026-11-09': '✚' };

async function mapPng(subject, encName, refs, gens, file) {
  const require = createRequire(here('./neighbours/package.json'));
  const sharp = require('sharp');
  const pts = pca2([...refs, ...gens].map((x) => x.v));
  const W = 900, H = 700, pad = 50;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const X = (x) => pad + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * pad - 160);
  const Y = (y) => pad + ((y - y0) / (y1 - y0 || 1)) * (H - 2 * pad);
  const ccs = [...new Set(refs.map((r) => r.cc))].sort((a, b) => (a === 'EE' ? -1 : b === 'EE' ? 1 : a.localeCompare(b)));
  const col = Object.fromEntries(ccs.map((c, i) => [c, PALETTE[i % PALETTE.length]]));
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/>`;
  svg += `<text x="${pad}" y="28" font-family="Helvetica" font-size="18">${subject}: real photos by country, generated marked (${ENCODERS[encName].note}, PCA)</text>`;
  refs.forEach((r, i) => { svg += `<circle cx="${X(pts[i][0]).toFixed(1)}" cy="${Y(pts[i][1]).toFixed(1)}" r="5" fill="${col[r.cc]}" fill-opacity="0.55"/>`; });
  gens.forEach((g, j) => {
    const [x, y] = pts[refs.length + j];
    svg += `<text x="${X(x).toFixed(1)}" y="${(Y(y) + 6).toFixed(1)}" font-size="17" text-anchor="middle" fill="#111" font-family="Helvetica">${MARK[g.variant] ?? '×'}</text>`;
  });
  let ly = pad;
  for (const c of ccs) { svg += `<circle cx="${W - 150}" cy="${ly}" r="6" fill="${col[c]}"/><text x="${W - 138}" y="${ly + 5}" font-family="Helvetica" font-size="14">${COUNTRY[c]} (${refs.filter((r) => r.cc === c).length})</text>`; ly += 22; }
  ly += 10;
  for (const v of [...new Set(gens.map((g) => g.variant))]) { svg += `<text x="${W - 150}" y="${ly + 5}" font-size="15" text-anchor="middle" font-family="Helvetica">${MARK[v] ?? '×'}</text><text x="${W - 138}" y="${ly + 5}" font-family="Helvetica" font-size="14">generated, ${v}</text>`; ly += 22; }
  svg += '</svg>';
  await sharp(Buffer.from(svg)).png().toFile(file);
}

async function report() {
  const pics = allPictures();
  const emb = Object.fromEntries(Object.keys(ENCODERS).map((e) => [e, JSON.parse(readFileSync(`${OUT}emb-${e}.json`, 'utf8'))]));
  const lines = [];
  const log = (s = '') => { lines.push(s); console.log(s); };
  const summary = {};
  // Costumes twice: with the rahvaroivad.ee studio photos as Estonia's references, and with Commons photos
  // only, the same kind of photo (festivals, museums) as every other country's.
  const VIEWS = [...Object.keys(SOURCES).map((s) => [s, s, () => true]), ['costume', 'costume, Commons only', (p) => p.src !== 'rahvaroivad']];
  const done = new Set(Object.keys(emb.dino));
  for (const [subject, label, keep] of VIEWS) {
    // A country with fewer than 8 usable photos is left out of the vote (named in the report).
    const realAny = pics.filter((p) => p.kind === 'real' && p.subject === subject && keep(p) && done.has(p.path) && emb.siglip[p.path]);
    if (pics.some((p) => p.subject === subject && p.kind === 'real' && keep(p) && !done.has(p.path))) { log(`\n## ${label}: not embedded yet, skipped`); continue; }
    const nCc = Object.groupBy(realAny, (r) => r.cc);
    const thin = Object.keys(nCc).filter((c) => nCc[c].length < 8);
    const realAll = realAny.filter((r) => !thin.includes(r.cc));
    if (new Set(realAll.map((r) => r.cc)).size < 2) continue;
    log(`\n## ${label}`);
    const counts = Object.entries(Object.groupBy(realAll, (r) => r.cc)).map(([c, rs]) => `${COUNTRY[c]} ${rs.length}`).join(', ');
    log(`references: ${counts}${thin.length ? `; left out (fewer than 8): ${thin.map((c) => `${COUNTRY[c]} ${nCc[c].length}`).join(', ')}` : ''}`);
    summary[label] = { counts: Object.fromEntries(Object.entries(Object.groupBy(realAll, (r) => r.cc)).map(([c, rs]) => [c, rs.length])) };
    const held = split(realAll);
    const perEnc = {};
    for (const enc of Object.keys(ENCODERS)) {
      const withV = (xs) => xs.filter((x) => emb[enc][x.path]).map((x) => ({ ...x, v: norm(emb[enc][x.path]) }));
      const real = withV(realAll);
      const gens = withV(pics.filter((p) => p.kind === 'gen' && p.subject === subject));
      // Control: held-out photos against the rest (balanced).
      const train = balance(real.filter((r) => !held.has(r.path)));
      const test = real.filter((r) => held.has(r.path));
      const conf = {};
      const bySrc = {};
      for (const t of test) {
        const k = knn(t.v, train);
        conf[t.cc] ??= {}; conf[t.cc][k.top] = (conf[t.cc][k.top] ?? 0) + 1;
        if (t.cc === 'EE') { bySrc[t.src] ??= [0, 0]; bySrc[t.src][1]++; if (k.top === 'EE') bySrc[t.src][0]++; }
      }
      const acc = (cc) => { const row = conf[cc] ?? {}; const n = Object.values(row).reduce((a, b) => a + b, 0); return [row[cc] ?? 0, n]; };
      const [eeOk, eeN] = acc('EE');
      const allOk = Object.keys(conf).reduce((s, c) => s + acc(c)[0], 0), allN = test.length;
      log(`\n### ${enc}: control (held out by photographer, k=10, balanced)`);
      log(`Estonia ${eeOk}/${eeN} = ${pct(eeOk, eeN)} (chance about ${pct(1, Object.keys(conf).length)}); all countries ${allOk}/${allN} = ${pct(allOk, allN)}`);
      const predEE = Object.values(conf).reduce((s, row) => s + (row.EE ?? 0), 0);
      log(`held-out photos voted Estonia: ${predEE}, of them really Estonian ${eeOk} (${pct(eeOk, predEE)})`);
      log(`Estonian held-out photos by source: ${Object.entries(bySrc).map(([s, [a, n]]) => `${s} ${a}/${n}`).join(', ')}`);
      log(`| held out from | ${Object.keys(conf).map((c) => COUNTRY[c]).join(' | ')} |`);
      for (const [cc, row] of Object.entries(conf)) log(`| ${COUNTRY[cc]} → | ${Object.keys(conf).map((c) => row[c] ?? 0).join(' | ')} |`);
      // Every real photo of Estonian origin from the nature control (judged by Gemini): where does it land?
      const refsFull = balance(real);
      const centroids = Object.fromEntries(Object.entries(Object.groupBy(real, (r) => r.cc)).map(([c, rs]) => [c, norm(mean(rs.map((r) => r.v)))]));
      const eeMean = mean(real.filter((r) => r.cc === 'EE').map((r) => r.v));
      const ccMeans = Object.fromEntries(Object.entries(Object.groupBy(real, (r) => r.cc)).map(([c, rs]) => [c, mean(rs.map((r) => r.v))]));
      // Generated: k=10 vote against all references (balanced), nearest centroid, drift arrow.
      const rows = [];
      for (const g of gens) {
        const k = knn(g.v, refsFull.filter((r) => r.path !== g.path));
        // Where in Estonia: the place (parish, village, cliff) of the 10 nearest Estonian photos, all of them, unbalanced.
        k.places = knn(g.v, real.filter((r) => r.cc === 'EE')).places;
        const cent = top(Object.fromEntries(Object.entries(centroids).map(([c, m]) => [c, dot(g.v, m)])))[0][0];
        rows.push({ ...g, vote: k.top, votes: k.votes, places: k.places, cent });
      }
      const groups = Object.groupBy(rows, (r) => `${r.variant}|${r.model}|${r.parish ?? ''}`);
      log(`\n### ${enc}: generated, k=10 vote (country: neighbours of 10), nearest centroid`);
      log('| prompt | model | n | kNN top (votes) | nearest centroid | places of the 10 nearest Estonian photos |');
      log('|---|---|---:|---|---|---|');
      for (const [key, rs] of Object.entries(groups).sort()) {
        const [variant, model] = key.split('|');
        const v = {}; for (const r of rs) for (const [c, n] of Object.entries(r.votes)) v[c] = (v[c] ?? 0) + n;
        const cent = {}; for (const r of rs) cent[r.cent] = (cent[r.cent] ?? 0) + 1;
        const pl = {}; for (const r of rs) for (const [c, n] of Object.entries(r.places)) pl[c] = (pl[c] ?? 0) + n;
        log(`| ${variant}${rs[0].parish ? ` (${rs[0].parish})` : ''} | ${model} | ${rs.length} | ${top(v).map(([c, n]) => `${COUNTRY[c]} ${n}`).join(', ')} | ${top(cent).map(([c, n]) => `${COUNTRY[c]}${rs.length > 1 ? ` ${n}` : ''}`).join(', ')} | ${top(pl).slice(0, 3).map(([c, n]) => `${c} ${n}`).join(', ') || '–'} |`);
      }
      // Per prompt variant: share of neighbour votes by country, and the drift arrow.
      log(`\n### ${enc}: by prompt variant: neighbour share, and the drift arrow`);
      log('Drift arrow: mean generated minus mean real Estonia, projected on the direction from Estonia to each country (0 = at Estonia\'s mean, 1 = as far as that country\'s mean).');
      const others = Object.keys(ccMeans).filter((c) => c !== 'EE');
      log(`| variant | n | neighbours: ${Object.keys(ccMeans).map((c) => COUNTRY[c]).join(' / ')} | arrow toward: ${others.map((c) => COUNTRY[c]).join(' / ')} | top-1 Estonia |`);
      log('|---|---:|---|---|---:|');
      const byVar = Object.groupBy(rows, (r) => r.variant);
      perEnc[enc] = { control: { ee: [eeOk, eeN], all: [allOk, allN], bySrc }, variants: {} };
      for (const [variant, rs] of Object.entries(byVar)) {
        const v = {}; for (const r of rs) for (const [c, n] of Object.entries(r.votes)) v[c] = (v[c] ?? 0) + n;
        const tot = rs.length * 10;
        const d = sub(mean(rs.map((r) => r.v)), eeMean);
        const arrow = Object.fromEntries(others.map((c) => { const dir = sub(ccMeans[c], eeMean); const L = Math.hypot(...dir); return [c, dot(d, dir) / (L * L)]; }));
        const eeTop = rs.filter((r) => r.vote === 'EE').length;
        log(`| ${variant} | ${rs.length} | ${Object.keys(ccMeans).map((c) => pct(v[c] ?? 0, tot)).join(' / ')} | ${others.map((c) => arrow[c].toFixed(2)).join(' / ')} | ${eeTop}/${rs.length} |`);
        perEnc[enc].variants[variant] = { n: rs.length, share: Object.fromEntries(Object.keys(ccMeans).map((c) => [c, (v[c] ?? 0) / tot])), arrow, eeTop, top: rows.filter((r) => r.variant === variant).map((r) => [r.path, r.vote]) };
      }
      perEnc[enc].rows = rows.map((r) => ({ path: r.path, model: r.model, variant: r.variant, vote: r.vote, cent: r.cent, votes: r.votes, places: r.places }));
      await mapPng(label, enc, real, gens, `${OUT}map-${label.replace(/\W+/g, '-')}-${enc}.png`);
    }
    // Agreement between the encoders on each generated picture's top country.
    const a = perEnc.dino.rows, b = Object.fromEntries(perEnc.siglip.rows.map((r) => [r.path, r.vote]));
    const same = a.filter((r) => b[r.path] === r.vote).length;
    log(`\nencoders agree on the top country for ${same}/${a.length} generated pictures (${pct(same, a.length)})`);
    summary[label] = { ...summary[label], ...perEnc, agree: [same, a.length] };
  }
  writeFileSync(`${OUT}report.md`, lines.join('\n') + '\n');
  writeFileSync(`${OUT}summary.json`, JSON.stringify(summary, null, 1));
}

if (cmd === 'fetch') await fetchRefs(rest.length ? rest : Object.keys(SOURCES));
else if (cmd === 'exclude') { // node neighbours.mjs exclude <id> ...: drop photos checked by hand
  const meta = refsMeta();
  for (const m of meta) if (rest.includes(m.id)) m.excluded = true;
  writeFileSync(`${REFS}refs.json`, JSON.stringify(meta, null, 2));
  console.log(`${meta.filter((m) => m.excluded).length} excluded in all`);
} else if (cmd === 'embed') await embed();
else if (cmd === 'report') await report();
else console.log('node neighbours.mjs fetch [subject ...] | embed | report');
