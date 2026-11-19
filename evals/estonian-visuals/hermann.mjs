// Pikk Hermann, the 48 m tower of Toompea Castle in Tallinn, with the Estonian flag (blue, black, white) on top.
// Every image model on the live gateway draws it twice: named, and plain (a castle tower with "the national flag",
// no Tallinn, Estonia or Pikk Hermann: which flag does a model reach for?). No real photos. A location judge ("which
// country?", the nature set's question) and a flag judge on every picture; SHARP splats and depth maps for the room
// (out/drift-room/hermann.html), music from research/music-drift/out (the anthem and Ernesaks). Same pattern as
// lauluvaljak.mjs.
// Usage (live gateway, KEY_PERSON=eka-teacher, keys in .keys.local):
//   node hermann.mjs draw [model ...]   every model (or the ones named), both prompts, into out/hermann/<model>/<id>.png;
//                                       existing files are skipped, so a rerun finishes what failed. Stops at a 402.
//   node hermann.mjs depth              square 1024 px colour + 384 px depth (Depth Anything V2 small) for every
//                                       picture into out/drift-room/hermann/, and scenes.json
//   node hermann.mjs sheet              contact sheet out/hermann/sheet.jpg, to check by eye
//   node hermann.mjs judge              two calls a picture to Gemini 3.8 Flash through the live gateway, the first with
//                                       no hints: (1) nature.mjs QUESTION, "which country?"; (2) FLAG_Q, which flag is on
//                                       the tower and whether it is Pikk Hermann. Cached in judge.jsonl / flag.jsonl;
//                                       then out/hermann/places.json and the room's scenes.json with the answers
//   node hermann.mjs places             rebuild places.json from the caches
//   node hermann.mjs sharp-list         ~/visualia-local/sharp/list-hermann.txt for batch.py, worst first
// Every picture call is appended to out/hermann/runs.json. Research use only: out/ is not in git.
// Facts (landmarks.mjs SRC.castle, en.wikipedia.org/wiki/Toompea_Castle): Tall Hermann is 48 metres tall; the flag
// of Estonia is hoisted at the top of the tower every day at sunrise. The castle's pink Baroque/Neoclassical wing
// houses the Riigikogu; the castle stands on the limestone hill of Toompea. et.wikipedia.org/wiki/Pikk_Hermann: the
// castle's south-west tower, 45.6 m since the 16th century, machicolations at the top (restored 1998); the flag is
// raised at sunrise to the opening phrases of the anthem and lowered at sunset to a signature from Ernesaks's
// "Mu isamaa on minu arm" (Koidula's words); the blue-black-white first flew there on 12 December 1918.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sharp = createRequire(import.meta.url)('../../node_modules/sharp');
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const GATEWAY = (process.env.GATEWAY ?? 'https://gw.visualia.space').replace(/\/$/, '');
const OUT = here('./out/hermann/');
const ROOM = here('./out/drift-room/hermann/');
const RUNS = `${OUT}runs.json`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
const readJsonl = (f) => (existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

function key() {
  const keys = Object.fromEntries(readFileSync(here('../../.keys.local'), 'utf8').trim().split('\n').map((l) => l.split('=')));
  const k = keys[process.env.KEY_PERSON ?? 'eka-teacher'];
  if (!k) throw new Error('no key for KEY_PERSON in .keys.local');
  return k;
}

const PROMPTS = {
  named: 'Pikk Hermann tower in Tallinn, Estonia, with the Estonian national flag on top, photo',
  plain: 'a medieval castle tower with the national flag flying on top, photo',
};
// As lauluvaljak.mjs (the live gateway's list, 2026-11-17). `usd` a picture at 1024², `est` where the gateway records none.
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
};
const BUDGET = Number(process.env.BUDGET ?? 1.3);
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

function cost() {
  const runs = readJson(RUNS, []).filter((r) => r.file);
  let known = 0, est = 0;
  for (const r of runs) {
    if (r.usage?.cost_usd != null) known += r.usage.cost_usd;
    else if (r.usage?.neurons != null) known += r.usage.neurons * 0.011 / 1000;
    else est += MODELS[r.model]?.usd ?? 0;
  }
  console.log(`${runs.length} pictures: $${known.toFixed(3)} recorded, about $${est.toFixed(3)} estimated where the gateway records none`);
}

// ---- pictures, depth, scenes ----

function pictures() {
  return Object.keys(MODELS).flatMap((m) => Object.keys(PROMPTS).filter((id) => existsSync(`${OUT}${dirOf(m)}/${id}.png`))
    .map((id) => ({ src: `hermann/${dirOf(m)}/${id}.png`, name: `${dirOf(m)}/${id}`, model: m, tier: MODELS[m].tier, variant: id })));
}

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

async function depth() {
  let run = null, made = 0;
  const scenes = [];
  mkdirSync(ROOM, { recursive: true });
  for (const p of pictures()) {
    const img = `hermann/${p.name.replace('/', '-')}.jpg`;
    const dep = img.replace(/\.jpg$/, '-depth.png');
    const full = here(`./out/drift-room/${img}`);
    if (!existsSync(full)) await sharp(here(`./out/${p.src}`)).resize(1024, 1024, { fit: 'cover', position: 'centre' }).jpeg({ quality: 88 }).toFile(full);
    if (!existsSync(here(`./out/drift-room/${dep}`))) {
      run ??= await depthModel();
      await run(full, here(`./out/drift-room/${dep}`));
      made++;
      console.log(dep);
    }
    scenes.push({ img, depth: dep, ...p });
  }
  const old = Object.fromEntries(readJson(`${ROOM}scenes.json`, []).map((s) => [s.name, s]));
  writeFileSync(`${ROOM}scenes.json`, JSON.stringify(scenes.map((s) => ({ ...s, judge: old[s.name]?.judge ?? null })), null, 1));
  console.log(`${scenes.length} scenes in drift-room/hermann/scenes.json, ${made} new depth maps`);
  if (existsSync(`${OUT}judge.jsonl`)) places();
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

// ---- judge ----

// nature.mjs QUESTION word for word, asked first and alone, so it carries no hint.
const QUESTION = `Which country was this photo most likely taken in? Look only at what is in the picture.
Answer with JSON only, no other text:
{"country": "<one country name in English, or \\"unknown\\">", "confidence": <0 to 1>,
 "region": "<the region, province or county within that country, or null>",
 "reason": "<one short sentence: what in the picture points there>"}`;
// The second call: the flag, then (named last, so the flag answer is given before the hint) Pikk Hermann.
const FLAG_Q = `Look only at the picture.
1. Is a flag flying from the top of the main tower? Describe that flag exactly as drawn: its stripes or shapes and colours, from top to bottom.
2. Whose flag is it? Classify it as one of:
   "estonia" (three equal horizontal stripes, blue on top, black in the middle, white at the bottom, nothing else),
   "other" (a real flag of another country or region: name it),
   "garbled" (flag-like but not any real flag, or Estonian colours in the wrong order or with extra parts),
   "none" (no flag on the tower).
3. Pikk Hermann (Tall Hermann) in Tallinn is the south-west tower of Toompea Castle: a tall, slender limestone tower, 45.6 to 48 m, with machicolations at the top and one flag pole, beside the pink Baroque building of the parliament, on a limestone hill above the town. Is the main tower in this picture recognisably Pikk Hermann?
Answer with JSON only, no other text:
{"flag_on_tower": <true|false>, "flag_seen": "<the colours top to bottom, or null>", "flag": "estonia|other|garbled|none",
 "flag_country": "<the country or region whose flag it is, or null>", "pikk_hermann": "yes|partly|no",
 "pink_palace": <true|false>, "reason": "<one short sentence>"}`;
const JUDGE = { id: 'google/gemini-3.8-flash', in: 0.75, out: 3.75 };
const JBUDGET = Number(process.env.JBUDGET ?? 0.4);
const isEstonia = (c) => /^estonia/i.test(String(c ?? '').trim());
const isTallinn = (a) => isEstonia(a.country) && /tallinn|harju|toompea/i.test(`${a.region ?? ''} ${a.reason ?? ''}`);

async function ask(text, jpg) {
  const res = await fetch(`${GATEWAY}/v1/chat/completions`, {
    method: 'POST', headers: { authorization: `Bearer ${key()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: JUDGE.id, max_tokens: 2000, messages: [{ role: 'user', content: [
      { type: 'text', text }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpg.toString('base64')}` } }] }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 402) throw Object.assign(new Error('402 no credits'), { stop: true });
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data.error ?? data).slice(0, 200)}`);
  const out = data.choices?.[0]?.message?.content ?? '';
  const answer = JSON.parse(String(out).match(/\{[\s\S]*\}/)?.[0] ?? 'null');
  if (!answer) throw new Error(`no answer: ${String(out).slice(0, 120)}`);
  const u = data.usage;
  const usd = u ? ((u.prompt_tokens ?? 0) * JUDGE.in + (((u.total_tokens ?? 0) - (u.prompt_tokens ?? 0)) || (u.completion_tokens ?? 0)) * JUDGE.out) / 1e6 : null;
  return { answer, usd, usage: u ?? null };
}

async function judge() {
  const files = { where: `${OUT}judge.jsonl`, flag: `${OUT}flag.jsonl` };
  const ok = { where: (r) => r.country, flag: (r) => r.flag };
  const prompt = { where: QUESTION, flag: FLAG_Q };
  let spent = [...readJsonl(files.where), ...readJsonl(files.flag)].reduce((s, r) => s + (r.usd ?? 0), 0);
  let stop = false;
  for (const kind of ['where', 'flag']) {
    const done = new Set(readJsonl(files[kind]).filter(ok[kind]).map((r) => r.name));
    const todo = pictures().filter((p) => !done.has(p.name));
    console.log(`${kind}: ${todo.length} to ask, $${spent.toFixed(3)} spent so far`);
    let i = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (i < todo.length && !stop) {
        if (spent > JBUDGET) { console.log(`over JBUDGET=$${JBUDGET}`); stop = true; return; }
        const p = todo[i++];
        const jpg = await sharp(here(`./out/drift-room/hermann/${p.name.replace('/', '-')}.jpg`)).resize(768, 768).jpeg({ quality: 85 }).toBuffer();
        const row = { name: p.name, model: p.model, variant: p.variant, judge: JUDGE.id };
        for (let attempt = 1; attempt <= 3 && !ok[kind](row); attempt++) {
          try {
            const r = await ask(prompt[kind], jpg);
            if (!ok[kind](r.answer)) throw new Error(`incomplete: ${JSON.stringify(r.answer).slice(0, 120)}`);
            Object.assign(row, r.answer, { usd: r.usd, usage: r.usage });
            delete row.error;
          } catch (e) { row.error = e.message; if (e.stop) { stop = true; break; } await sleep(2000 * attempt); }
        }
        spent += row.usd ?? 0;
        appendFileSync(files[kind], JSON.stringify(row) + '\n');
        console.log(`${kind} ${p.name.padEnd(36)} ${kind === 'where' ? `${row.country ?? 'FAILED ' + row.error} ${row.confidence ?? ''} ${row.region ?? ''}` : `${row.flag ?? 'FAILED ' + row.error} ${row.flag_country ?? ''} PH:${row.pikk_hermann ?? ''}`}`);
      }
    }));
  }
  places();
}

// By eye from sheet.jpg (filled after looking): is the tower Pikk Hermann, and the flag as I see it.
// tower: 'yes' (square plain tower with the castle and pink wing), 'partly', 'no'; flag: as the judge's classes.
const EYE = JSON.parse(existsSync(`${OUT}eye.json`) ? readFileSync(`${OUT}eye.json`, 'utf8') : '{}');

// places.json, worst first by score. Location: placed in Estonia counts its confidence (+0.5 for Tallinn/Toompea),
// elsewhere minus its confidence, unknown 0. Flag (by eye where looked at, else the judge): estonia +1, none -0.25,
// garbled -0.5, other -1. Tower Pikk Hermann (by eye, else the judge): yes +0.5, partly +0.25.
const FLAGW = { estonia: 1, none: -0.25, garbled: -0.5, other: -1 };
const TOWERW = { yes: 0.5, partly: 0.25, no: 0 };
function places() {
  const where = new Map(readJsonl(`${OUT}judge.jsonl`).filter((r) => r.country).map((r) => [r.name, r]));
  const flag = new Map(readJsonl(`${OUT}flag.jsonl`).filter((r) => r.flag).map((r) => [r.name, r]));
  const out = {};
  for (const p of pictures()) {
    const a = where.get(p.name), f = flag.get(p.name), eye = EYE[p.name] ?? {};
    if (!a) continue;
    const c = Number(a.confidence) || 0;
    const ee = isEstonia(a.country), tl = isTallinn(a);
    const fl = eye.flag ?? f?.flag ?? null, tower = eye.tower ?? f?.pikk_hermann ?? null;
    const score = (ee ? c + (tl ? 0.5 : 0) : /^unknown$/i.test(a.country) ? 0 : -c) + (FLAGW[fl] ?? 0) + (TOWERW[tower] ?? 0);
    out[p.name] = { model: p.model, variant: p.variant, country: a.country, region: a.region ?? null, confidence: c, reason: a.reason,
      estonia: ee, tallinn: tl,
      flag: fl, flag_by: eye.flag ? 'eye' : 'judge', flag_judge: f?.flag ?? null, flag_country: eye.flag_country ?? f?.flag_country ?? null,
      flag_seen: f?.flag_seen ?? null, flag_reason: f?.reason ?? null,
      tower, tower_by: eye.tower ? 'eye' : 'judge', tower_judge: f?.pikk_hermann ?? null, pink_palace: f?.pink_palace ?? null,
      eye_note: eye.note ?? null, score: Math.round(score * 1000) / 1000 };
  }
  const sorted = Object.fromEntries(Object.entries(out).sort((x, y) => x[1].score - y[1].score));
  writeFileSync(`${OUT}places.json`, JSON.stringify(sorted, null, 1));
  const sc = `${ROOM}scenes.json`;
  if (existsSync(sc)) writeFileSync(sc, JSON.stringify(readJson(sc, []).map((s) => ({ ...s, judge: out[s.name] ?? null })), null, 1));
  for (const v of ['named', 'plain']) {
    const xs = Object.values(out).filter((x) => x.variant === v);
    const tally = (k) => Object.entries(xs.reduce((m, x) => ((m[x[k]] = (m[x[k]] ?? 0) + 1), m), {})).map(([a, b]) => `${a} ${b}`).join(', ');
    console.log(`${v}: ${xs.filter((x) => x.estonia).length}/${xs.length} in Estonia (${xs.filter((x) => x.tallinn).length} Tallinn); flag: ${tally('flag')}; tower: ${tally('tower')}`);
    console.log(`  countries: ${tally('country')}; other flags: ${xs.filter((x) => x.flag === 'other').map((x) => `${x.model} ${x.flag_country}`).join(', ')}`);
  }
  const all = [...readJsonl(`${OUT}judge.jsonl`), ...readJsonl(`${OUT}flag.jsonl`)];
  console.log(`judge cost: $${all.reduce((s, r) => s + (r.usd ?? 0), 0).toFixed(4)} (${all.length} calls)`);
}

// batch.py list: "<file under out/drift-room>\t<scene key>", worst first so a stop leaves the end on the lift.
function sharpList() {
  const pl = readJson(`${OUT}places.json`, {});
  const names = Object.keys(pl).length ? Object.keys(pl) : pictures().map((p) => p.name);
  const lines = names.map((n) => `hermann/${n.replace('/', '-')}.jpg\thermann/${n.replace('/', '-')}.jpg`);
  const f = `${homedir()}/visualia-local/sharp/list-hermann.txt`;
  writeFileSync(f, lines.join('\n') + '\n');
  console.log(`${f}: ${lines.length} pictures`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'draw') { await drawAll(rest); cost(); }
else if (cmd === 'depth') await depth();
else if (cmd === 'sheet') await sheet();
else if (cmd === 'cost') cost();
else if (cmd === 'judge') await judge();
else if (cmd === 'places') places();
else if (cmd === 'sharp-list') sharpList();
else console.log('node hermann.mjs draw [model ...] | depth | sheet | judge | places | sharp-list | cost');
