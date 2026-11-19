// Tallinn Song Festival Grounds (Tallinna lauluväljak): the 1960 song shell by Alar Kotli, the arch, the slope full
// of people, the fire tower. Every image model on the live gateway draws it twice, named and without the place
// (the nature set's named/neutral pattern); real photos from Commons as the control; depth maps for the room
// (out/drift-room/lauluvaljak.html), music from research/music-drift/out (the anthem and Ernesaks).
// Usage (live gateway, KEY_PERSON=eka-teacher, keys in .keys.local):
//   node lauluvaljak.mjs draw [model ...]   every IMAGE_MODELS model (or the ones named), both prompts, into
//                                           out/lauluvaljak/<model>/<id>.png; existing files are skipped, so a rerun
//                                           finishes what failed. Stops at the first 402 (no credits).
//   node lauluvaljak.mjs commons            real photos from Commons into out/lauluvaljak/real/ (1 request a second)
//   node lauluvaljak.mjs exclude <id> ...   drop real photos that are not the subject
//   node lauluvaljak.mjs depth              square 1024 px colour + 384 px depth (Depth Anything V2 small, q8, WebAssembly)
//                                           for every picture into out/drift-room/lauluvaljak/, and scenes.json
//   node lauluvaljak.mjs sheet              contact sheet out/lauluvaljak/sheet.jpg, to check by eye
//   node lauluvaljak.mjs judge              "which country?" for every picture (and the real photos as a control): the
//                                           nature set's question (nature.mjs QUESTION) to Gemini 3.8 Flash through the
//                                           live gateway, cached in judge.jsonl (reruns ask only what is missing),
//                                           then out/lauluvaljak/places.json and the room's scenes.json with the answers
// Every call is appended to out/lauluvaljak/runs.json. Research use only: out/ is not in git, nothing is published.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sharp = createRequire(import.meta.url)('../../node_modules/sharp');
// SET=latvia (asked 2026-11-19: "full run on lauluväljak img but for Latvia"): Riga's song festival grounds (the
// Mežaparks Great Bandstand), the named prompt only (the place-less one is the same words as Estonia's), no Commons
// photos; out/lauluvaljak-latvia/ and out/drift-room/lauluvaljak-latvia/. The judge's fields keep their names:
// `estonia` is "placed in the set's own country", `tallinn` its capital (Riga), so the room reads both sets alike.
const LATVIA = process.env.SET === 'latvia';
const SETNAME = LATVIA ? 'lauluvaljak-latvia' : 'lauluvaljak';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const GATEWAY = (process.env.GATEWAY ?? 'https://gw.visualia.space').replace(/\/$/, '');
const OUT = here(`./out/${SETNAME}/`);
const REAL = `${OUT}real/`;
const ROOM = here(`./out/drift-room/${SETNAME}/`);
const RUNS = `${OUT}runs.json`;
const UA = 'visualia-research (kristjan.jansen@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
const hash = (s) => createHash('sha1').update(s).digest('hex');
const strip = (html) => String(html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function key() {
  const keys = Object.fromEntries(readFileSync(here('../../.keys.local'), 'utf8').trim().split('\n').map((l) => l.split('=')));
  const k = keys[process.env.KEY_PERSON ?? 'eka-teacher'];
  if (!k) throw new Error('no key for KEY_PERSON in .keys.local');
  return k;
}

// Named, and the same words without Tallinn and Estonia.
const PROMPTS = LATVIA ? { named: 'Riga Song Festival Grounds, Latvia, the song festival with the crowd, photo' } : {
  named: 'Tallinn Song Festival Grounds, Estonia, the song festival with the crowd, photo',
  neutral: 'Song festival grounds, the song festival with the crowd, photo',
};
// The gateway's IMAGE_MODELS (apps/gateway/src/index.js) and the pool's, in the order the live gateway lists them
// (2026-11-17). `tier` as in the drift room: best (2026 catalog), cheap, weak (old), local (a pool computer).
// `usd`: the gateway's price a picture at 1024², or an estimate where it records none (est).
const MODELS = {
  'flux-2-klein-4b': { tier: 'cheap', usd: 0.0011 },
  'flux-2-klein-9b': { tier: 'cheap', usd: 0.015 },
  'flux-2-dev': { tier: 'cheap', usd: 0.033 },
  'flux-1-schnell': { tier: 'weak', usd: 0.0007 },
  'phoenix-1.0': { tier: 'weak', usd: 0.026 },
  'lucid-origin': { tier: 'weak', usd: 0.031 },
  sdxl: { tier: 'weak', usd: 0 },
  'sdxl-lightning': { tier: 'weak', usd: 0 },
  'dreamshaper-8-lcm': { tier: 'weak', usd: 0 },
  'p-image': { tier: 'cheap', usd: 0.005 },
  'recraft-v4.1-flash': { tier: 'cheap', usd: 0.04, est: true },
  'flux-3-image-klein': { tier: 'cheap', usd: 0.009 },
  'nano-banana-2-lite': { tier: 'cheap', usd: 0.04, est: true },
  'flux-2-pro-preview': { tier: 'best', usd: 0.03 },
  'qwen-image-3.0-pro': { tier: 'best', usd: 0.04 },
  'seedream-5-pro': { tier: 'best', usd: 0.045 },
  'grok-imagine-image-quality': { tier: 'best', usd: 0.05 },
  'gpt-image-2': { tier: 'best', usd: 0.06, est: true },
  'nano-banana-pro': { tier: 'best', usd: 0.134 },
  'pool/chilloutmix': { tier: 'local', usd: 0 },
};
const BUDGET = Number(process.env.BUDGET ?? 3);
const dirOf = (m) => m.replace('/', '-');

// ---- draw ----

let stopped = null;
async function draw(model, id) {
  const file = `${OUT}${dirOf(model)}/${id}.png`;
  if (existsSync(file) || stopped) return;
  const prompt = PROMPTS[id];
  const t0 = Date.now();
  let res, data;
  try {
    res = await fetch(`${GATEWAY}/v1/images`, {
      method: 'POST', headers: { authorization: `Bearer ${key()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, model, size: '1024x1024' }), signal: AbortSignal.timeout(240000),
    });
    data = await res.json().catch(() => ({}));
  } catch (e) { res = { ok: false, status: 0 }; data = { error: String(e.message ?? e) }; }
  const seconds = (Date.now() - t0) / 1000;
  // runs.json is read right before each write: parallel draws would otherwise lose rows
  if (!res.ok || !data.data?.[0]?.b64_json) {
    const runs = readJson(RUNS, []);
    const error = `${res.status} ${data.error ?? ''} ${typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail ?? '')}`.slice(0, 300);
    runs.push({ model, id, prompt, file: null, error, seconds });
    writeFileSync(RUNS, JSON.stringify(runs, null, 1));
    console.log(`${model} ${id} failed: ${error}`);
    if (res.status === 402 || /credit|insufficient|2021|balance/i.test(error)) stopped = error;
    return;
  }
  const buf = Buffer.from(data.data[0].b64_json, 'base64');
  mkdirSync(file.replace(/[^/]+$/, ''), { recursive: true });
  const got = await sharp(buf).metadata();
  await sharp(buf).png().toFile(file);
  const runs = readJson(RUNS, []);
  runs.push({ model, id, prompt, file: file.replace(OUT, ''), got: `${got.width}x${got.height}`, seconds, usage: data.usage ?? null });
  writeFileSync(RUNS, JSON.stringify(runs, null, 1));
  console.log(`${model} ${id} ${seconds.toFixed(1)}s ${got.width}x${got.height} $${data.usage?.cost_usd ?? (data.usage?.neurons != null ? (data.usage.neurons * 0.011 / 1000).toFixed(4) : '?')}`);
}

async function drawAll(names) {
  const models = names.length ? names : Object.keys(MODELS);
  const todo = models.flatMap((m) => Object.keys(PROMPTS).map((id) => [m, id])).filter(([m, id]) => !existsSync(`${OUT}${dirOf(m)}/${id}.png`));
  const cost = todo.reduce((s, [m]) => s + (MODELS[m]?.usd ?? 0.05), 0);
  console.log(`${todo.length} pictures to draw, about $${cost.toFixed(2)}`);
  if (cost > BUDGET) throw new Error(`over BUDGET=$${BUDGET}`);
  mkdirSync(OUT, { recursive: true });
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (i < todo.length && !stopped) await draw(...todo[i++]); }));
  if (stopped) console.log(`stopped: ${stopped}`);
}

// ---- commons: real photos ----

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
const INFO = { prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '1280', iiextmetadatafilter: 'Artist|LicenseShortName|DateTimeOriginal' };
// Categories on Commons, the festivals with the crowd first; titles that are not the grounds seen whole are skipped.
const CATS = ['Tallinn Song Festival Grounds', 'Tallinn Song Festival stage', 'Song Celebration in Tallinn'];
// Festivals with the crowd, picked by title from the categories above (the categories alone gave the empty
// slope, snow and graffiti): taken first, before the search.
const MANUAL = ['File:Üldlaulupidu 2014 - 14.JPG', 'File:Üldlaulupidu 2014 - 26.JPG', 'File:XXV üldlaulupidu.JPG', 'File:Estonia - Flickr - Jarvis-4.jpg'];
const SEARCH = ['Tallinn Song Festival Grounds laulupidu crowd', 'Lauluväljak laulupidu', 'Song festival Tallinn laululava'];
const WANT = Number(process.env.WANT ?? 4);
const SKIP_TITLE = /\b(map|plan|drawing|interior|night|öö|stamp|logo|postcard|concert hall|sign|plaque|detail|tower top|winter|talv|snow|lumi)\b|\.(svg|png|tif)$/i;

async function commons() {
  mkdirSync(REAL, { recursive: true });
  const meta = `${REAL}photos.json`;
  const have = readJson(meta, []);
  const live = () => have.filter((p) => !p.excluded).length;
  let pages = [];
  const man = await api({ action: 'query', titles: MANUAL.join('|'), ...INFO });
  pages = pages.concat((man.query?.pages ?? []).filter((p) => p.imageinfo).sort((a, b) => MANUAL.indexOf(a.title) - MANUAL.indexOf(b.title)));
  for (const cat of CATS) {
    if (pages.length >= 60) break;
    const data = await api({ action: 'query', generator: 'categorymembers', gcmtitle: `Category:${cat}`, gcmtype: 'file', gcmlimit: '50', ...INFO });
    const got = (data.query?.pages ?? []).filter((p) => p.imageinfo);
    console.log(`Category:${cat}: ${got.length} files`);
    pages = pages.concat(got);
  }
  for (const q of SEARCH) {
    if (pages.length >= 60) break;
    const data = await api({ action: 'query', generator: 'search', gsrsearch: `${q} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '20', ...INFO });
    pages = pages.concat((data.query?.pages ?? []).filter((p) => p.imageinfo));
  }
  // Landscape, big, a JPEG, not seen; festival photos (laulupidu, song festival) first, then by a stable hash.
  const fest = (t) => (/laulupidu|song festival|lauljate|festival/i.test(t) ? 0 : 1);
  const list = pages.filter((p, i) => pages.findIndex((q) => q.title === p.title) === i).filter((p) => {
    const ii = p.imageinfo[0];
    return ii.mime === 'image/jpeg' && ii.width >= 1200 && ii.width >= ii.height && !SKIP_TITLE.test(p.title) && !have.some((h) => h.title === p.title);
  }).sort((a, b) => (MANUAL.includes(b.title) - MANUAL.includes(a.title)) || fest(a.title) - fest(b.title) || hash(a.title).localeCompare(hash(b.title)));
  console.log(`${list.length} candidates`);
  const authors = Object.fromEntries(have.map((h) => [h.author, 1]));
  for (const p of list) {
    if (live() >= WANT) break;
    const ii = p.imageinfo[0];
    const md = ii.extmetadata ?? {};
    const author = strip(md.Artist?.value).slice(0, 120) || 'unknown';
    if (authors[author]) continue; // one photo an author
    await sleep(1100);
    const res = await fetch(ii.thumburl, { headers: { 'user-agent': UA } });
    if (!res.ok) { console.log(`  ${p.title}: ${res.status}`); continue; }
    const id = `real-${hash(p.title).slice(0, 8)}`;
    writeFileSync(`${REAL}${id}.jpg`, Buffer.from(await res.arrayBuffer()));
    have.push({ id, title: p.title, author, licence: md.LicenseShortName?.value ?? null,
      date: strip(md.DateTimeOriginal?.value).slice(0, 30) || null, url: ii.descriptionurl, file: `real/${id}.jpg` });
    authors[author] = 1;
    writeFileSync(meta, JSON.stringify(have, null, 2));
    console.log(`${id} ${p.title}  ${author}  ${md.LicenseShortName?.value}`);
  }
  console.log(`${live()} real photos in ${meta}`);
}

function exclude(ids) {
  const meta = `${REAL}photos.json`;
  const have = readJson(meta, []);
  for (const h of have) if (ids.includes(h.id)) h.excluded = true;
  writeFileSync(meta, JSON.stringify(have, null, 2));
  console.log(`${have.filter((h) => !h.excluded).length} kept`);
}

// ---- pictures, depth, scenes ----

function pictures() {
  const real = readJson(`${REAL}photos.json`, []).filter((p) => !p.excluded)
    .map((p) => ({ src: `${SETNAME}/${p.file}`, name: `real/${p.id}`, model: 'real', tier: 'real', variant: 'real', title: p.title, author: p.author, licence: p.licence, url: p.url }));
  const gen = Object.keys(MODELS).flatMap((m) => Object.keys(PROMPTS).filter((id) => existsSync(`${OUT}${dirOf(m)}/${id}.png`))
    .map((id) => ({ src: `${SETNAME}/${dirOf(m)}/${id}.png`, name: `${dirOf(m)}/${id}`, model: m, tier: MODELS[m].tier, variant: id })));
  return [...real, ...gen];
}

// Depth Anything V2 small, as drift-room.mjs (transformers.js in ./neighbours/, onnxruntime-web as WebAssembly:
// onnxruntime-node's native library is blocked on this Mac).
async function depthModel() {
  const require = createRequire(here('./neighbours/package.json'));
  const T = await import(pathToFileURL(require.resolve('@huggingface/transformers')).href);
  T.env.cacheDir = here('./out/neighbours/models/');
  T.env.useWasmCache = false;
  const ortDir = require.resolve('onnxruntime-node', { paths: [here('./neighbours/node_modules/@huggingface/transformers/')] });
  T.env.backends.onnx.wasm.wasmPaths = pathToFileURL(ortDir.replace(/dist\/.*$/, 'dist/')).href;
  T.env.backends.onnx.wasm.numThreads = 4;
  const est = await T.pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', { dtype: 'q8' });
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

// The room's sheet is square: every picture is cropped to its middle square (the real photos are landscape),
// 1024 px JPEG, and the depth is taken from that crop.
async function depth() {
  let run = null, made = 0;
  const scenes = [];
  for (const p of pictures()) {
    const img = `${SETNAME}/${p.name.replace('/', '-')}.jpg`;
    const dep = img.replace(/\.jpg$/, '-depth.png');
    const full = here(`./out/drift-room/${img}`);
    mkdirSync(ROOM, { recursive: true });
    if (!existsSync(full)) await sharp(here(`./out/${p.src}`)).resize(1024, 1024, { fit: 'cover', position: 'centre' }).jpeg({ quality: 88 }).toFile(full);
    if (!existsSync(here(`./out/drift-room/${dep}`))) {
      run ??= await depthModel();
      const t0 = Date.now();
      await run(full, here(`./out/drift-room/${dep}`));
      made++;
      console.log(`${dep} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
    scenes.push({ img, depth: dep, ...p });
  }
  writeFileSync(`${ROOM}scenes.json`, JSON.stringify(scenes, null, 1));
  console.log(`${scenes.length} scenes in drift-room/${SETNAME}/scenes.json, ${made} new depth maps`);
}

async function sheet() {
  const list = pictures();
  const S = 256, cols = 8, rows = Math.ceil(list.length / cols);
  const tiles = await Promise.all(list.map(async (p, i) => {
    const label = Buffer.from(`<svg width="${S}" height="22"><rect width="100%" height="100%" fill="#000a"/><text x="4" y="15" font-size="12" font-family="sans-serif" fill="#fff">${p.name}</text></svg>`);
    const t = await sharp(here(`./out/${p.src}`)).resize(S, S, { fit: 'cover' }).composite([{ input: label, top: S - 22, left: 0 }]).toBuffer();
    return { input: t, top: Math.floor(i / cols) * S, left: (i % cols) * S };
  }));
  await sharp({ create: { width: cols * S, height: rows * S, channels: 3, background: '#222' } }).composite(tiles).jpeg({ quality: 80 }).toFile(`${OUT}sheet.jpg`);
  console.log(`${OUT}sheet.jpg: ${list.length} pictures`);
}

function cost() {
  const runs = readJson(RUNS, []).filter((r) => r.file);
  let known = 0, est = 0;
  for (const r of runs) {
    if (r.usage?.cost_usd != null) known += r.usage.cost_usd;
    else if (r.usage?.neurons != null) known += r.usage.neurons * 0.011 / 1000; // Workers AI, the paid rate
    else est += MODELS[r.model]?.usd ?? 0;
  }
  console.log(`${runs.length} pictures: $${known.toFixed(3)} recorded, about $${est.toFixed(3)} estimated where the gateway records none`);
}

// ---- judge: where is this? ----

// nature.mjs QUESTION word for word, so the answers compare with the nature set's.
const QUESTION = `Which country was this photo most likely taken in? Look only at what is in the picture.
Answer with JSON only, no other text:
{"country": "<one country name in English, or \\"unknown\\">", "confidence": <0 to 1>,
 "region": "<the region, province or county within that country, or null>",
 "reason": "<one short sentence: what in the picture points there>"}`;
const JUDGE = { id: 'google/gemini-3.8-flash', in: 0.75, out: 3.75 }; // $ per M tokens, catalog 2026-11-16
const JBUDGET = Number(process.env.JBUDGET ?? 0.3);
const readJsonl = (f) => (existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const isEstonia = (c) => (LATVIA ? /^latvia/i : /^estonia/i).test(String(c ?? '').trim());
const isTallinn = (a) => isEstonia(a.country) && (LATVIA ? /r[iī]ga|mežaparks|mezaparks/i : /tallinn|harju/i).test(`${a.region ?? ''} ${a.reason ?? ''}`);

async function judge() {
  const cache = `${OUT}judge.jsonl`;
  const done = new Set(readJsonl(cache).filter((r) => r.country).map((r) => r.name));
  const todo = pictures().filter((p) => !done.has(p.name));
  let spent = readJsonl(cache).reduce((s, r) => s + (r.usd ?? 0), 0);
  console.log(`${todo.length} to ask, $${spent.toFixed(3)} spent so far`);
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < todo.length) {
      if (spent > JBUDGET) { console.log(`over JBUDGET=$${JBUDGET}`); return; }
      const p = todo[i++];
      // the square crop the room shows, 768 px, no metadata
      const jpg = await sharp(here(`./out/drift-room/${SETNAME}/${p.name.replace('/', '-')}.jpg`)).resize(768, 768).jpeg({ quality: 85 }).toBuffer();
      const row = { name: p.name, model: p.model, variant: p.variant, judge: JUDGE.id };
      for (let attempt = 1; attempt <= 3 && !row.country; attempt++) {
        try {
          const res = await fetch(`${GATEWAY}/v1/chat/completions`, {
            method: 'POST', headers: { authorization: `Bearer ${key()}`, 'content-type': 'application/json' },
            body: JSON.stringify({ model: JUDGE.id, max_tokens: 2000, messages: [{ role: 'user', content: [
              { type: 'text', text: QUESTION }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpg.toString('base64')}` } }] }] }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.status === 402) throw Object.assign(new Error('402 no credits'), { stop: true });
          if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data.error ?? data).slice(0, 200)}`);
          const text = data.choices?.[0]?.message?.content ?? '';
          const answer = JSON.parse(String(text).match(/\{[\s\S]*\}/)?.[0] ?? 'null');
          if (!answer?.country) throw new Error(`no answer: ${String(text).slice(0, 120)}`);
          // thinking is billed as output; total - prompt counts it (nature.mjs)
          const u = data.usage;
          row.usd = u ? ((u.prompt_tokens ?? 0) * JUDGE.in + (((u.total_tokens ?? 0) - (u.prompt_tokens ?? 0)) || (u.completion_tokens ?? 0)) * JUDGE.out) / 1e6 : null;
          Object.assign(row, answer, { usage: u ?? null });
          delete row.error;
        } catch (e) { row.error = e.message; if (e.stop) { i = todo.length; break; } await sleep(2000 * attempt); }
      }
      spent += row.usd ?? 0;
      appendFileSync(cache, JSON.stringify(row) + '\n');
      console.log(`${p.name.padEnd(36)} ${row.country ?? 'FAILED ' + row.error} ${row.confidence ?? ''} ${row.region ?? ''}`);
    }
  }));
  places();
}

// places.json: per picture the judge's answer and a score, worst first. Score: placed in Estonia counts by the
// judge's confidence (Tallinn or Harju named adds 0.5), elsewhere counts as minus its confidence, "unknown" 0; the
// by-eye shell check (SHELL below) adds 0.25 for a partial shell, 0.5 for the shell, as a tie-break and nudge.
const SHELL = LATVIA ? {} : { 'nano-banana-pro/named': 0.5, 'nano-banana-pro/neutral': 0.5, 'nano-banana-2-lite/named': 0.5,
  'nano-banana-2-lite/neutral': 0.5, 'gpt-image-2/named': 0.5, 'grok-imagine-image-quality/named': 0.25, 'qwen-image-3.0-pro/named': 0.1 };
function places() {
  const rows = new Map(readJsonl(`${OUT}judge.jsonl`).filter((r) => r.country).map((r) => [r.name, r]));
  const out = {};
  for (const p of pictures()) {
    const a = rows.get(p.name);
    if (!a) continue;
    const c = Number(a.confidence) || 0;
    const ee = isEstonia(a.country), tl = isTallinn(a);
    const score = (ee ? c + (tl ? 0.5 : 0) : /^unknown$/i.test(a.country) ? 0 : -c) + (SHELL[p.name] ?? 0);
    out[p.name] = { model: p.model, variant: p.variant, country: a.country, region: a.region ?? null, confidence: c, reason: a.reason,
      estonia: ee, tallinn: tl, shell: SHELL[p.name] ?? 0, score: Math.round(score * 1000) / 1000 };
  }
  writeFileSync(`${OUT}places.json`, JSON.stringify(out, null, 1));
  // the room's scenes carry the answer
  const sc = `${ROOM}scenes.json`;
  if (existsSync(sc)) writeFileSync(sc, JSON.stringify(readJson(sc, []).map((s) => ({ ...s, judge: out[s.name] ?? null })), null, 1));
  const gen = Object.entries(out).filter(([, v]) => v.model !== 'real');
  const count = (xs) => `${xs.filter(([, v]) => v.estonia).length}/${xs.length} in Estonia (${xs.filter(([, v]) => v.tallinn).length} Tallinn)`;
  const elsewhere = {};
  for (const [, v] of gen) if (!v.estonia) elsewhere[v.country] = (elsewhere[v.country] ?? 0) + 1;
  console.log(`real: ${count(Object.entries(out).filter(([, v]) => v.model === 'real'))}`);
  console.log(`named: ${count(gen.filter(([, v]) => v.variant === 'named'))}; neutral: ${count(gen.filter(([, v]) => v.variant === 'neutral'))}`);
  console.log(`elsewhere: ${JSON.stringify(elsewhere)}`);
  console.log(`judge cost: $${readJsonl(`${OUT}judge.jsonl`).reduce((s, r) => s + (r.usd ?? 0), 0).toFixed(4)}`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'draw') { await drawAll(rest); cost(); }
else if (cmd === 'commons') await commons();
else if (cmd === 'exclude') exclude(rest);
else if (cmd === 'depth') await depth();
else if (cmd === 'sheet') await sheet();
else if (cmd === 'cost') cost();
else if (cmd === 'judge') await judge();
else if (cmd === 'places') places();
else console.log('node lauluvaljak.mjs draw [model ...] | commons | exclude <id> ... | depth | sheet | judge | places | cost');
