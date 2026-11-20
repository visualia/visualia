// Film scenes for the Arunädal "value drift" demo (EKA, 20.11.2026): every cloud image model on the live gateway is
// asked for a still from each of five Estonian films, by the film's own title, and the judge says where the picture
// is and which film it thinks it is. The page is out/drift-room/films.html; the films' songs are the room-* songs in
// research/music-drift/out/films/ (served as ../sounds-research/films/).
// Usage (live gateway, KEY_PERSON=eka-teacher, keys in .keys.local):
//   node films.mjs draw [model ...]   every MODELS model (or the ones named), every film, into out/films/<model>/<film>.png.
//                                     Resumable: drawn pictures and refusals are skipped (`retry` asks the refused again).
//                                     Stops at the first 402, or before a picture would take the estimate over BUDGET.
//   node films.mjs more <model> <film> [n]  n more pictures (default 3), same prompt, out/films/<model>/<film>-alt<k>.png,
//                                     numbered after the ones there (asked 2026-11-18: alternatives for the Alpinist's ending).
//                                     PROMPT="..." asks with that prompt instead, into <film>-prompt<k>.png
//   node films.mjs retry [model ...]  the same, refusals asked again (each try is a row in runs.json)
//   node films.mjs judge              the nature set's "which country?" question plus "which film?", one call a picture,
//                                     Gemini 3.8 Flash through the gateway, cached in out/films/judge.jsonl, then places
//   node films.mjs places             out/films/places.json (slides.html's entry shape, plus film_guess) from the cache
//   node films.mjs sheet              contact sheet out/films/sheet.jpg
//   node films.mjs cost               what the pictures cost (recorded, and estimated where the gateway records none)
// Every call is appended to out/films/runs.json. Research use only: out/ is not in git, nothing is published.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const sharp = createRequire(import.meta.url)('../../node_modules/sharp');
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const GATEWAY = (process.env.GATEWAY ?? 'https://gw.visualia.space').replace(/\/$/, '');
const OUT = here('./out/films/');
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

// The films, oldest first. `asked`: where the film is set or was filmed, when one place in Estonia is known (et.wikipedia,
// 2026-11-17): Viimne reliikvia is set at Pirita convent (filmed at a mock-up at Kukeranda near Virtsu), Kevade's
// Paunvere is Palamuse, where it was filmed, Nukitsamees was filmed around Karksi-Nuia. Else the middle of Estonia (the
// nature set's ESTONIA): the Alpinist's hotel stands in no named country (filmed at Tuyuk-Su above Almaty, ru.wikipedia),
// Nipernaadi wanders the countryside (no filming place found).
export const FILMS = {
  reliikvia: { title: 'Viimne reliikvia', year: 1969, asked: { lat: 59.47, lon: 24.835, label: 'Pirita' } },
  kevade: { title: 'Kevade', year: 1969, asked: { lat: 58.683, lon: 26.583, label: 'Palamuse' } },
  // the story is set in an Alpine hotel (asked 2026-11-17: Switzerland is the film's own place), so the ring is in the Alps
  alpinist: { title: 'Hukkunud Alpinisti hotell', year: 1979, asked: { lat: 46.6, lon: 8.1, label: 'Switzerland' } },
  nukitsamees: { title: 'Nukitsamees', year: 1981, asked: { lat: 58.1, lon: 25.56, label: 'Karksi-Nuia' } },
  nipernaadi: { title: 'Nipernaadi', year: 1983, asked: { lat: 58.65, lon: 25.5, label: 'Estonia' } },
  // a second full run of Nipernaadi with the same prompt (asked 2026-11-18: "do full run on new nipernaadi images and make it a
  // new group"): what the same models give the second time; files <model>/nipernaadi2.png, its own group in the deck
  // and the Alpinist (asked 2026-11-19: "full run on Hukkunud Alpinisti hotell images")
  alpinist2: { title: 'Hukkunud Alpinisti hotell', year: 1979, asked: { lat: 46.6, lon: 8.1, label: 'Switzerland' }, group: 'Hukkunud Alpinisti hotell, teine kord' },
  nipernaadi2: { title: 'Nipernaadi', year: 1983, asked: { lat: 58.65, lon: 25.5, label: 'Estonia' }, group: 'Nipernaadi, teine kord' },
};
const promptOf = (f) => `A still from the ${FILMS[f].year} Estonian film ${FILMS[f].title}.`;

// The gateway's cloud IMAGE_MODELS (apps/gateway/src/index.js, 2026-11-17), as lauluvaljak.mjs; the pool's local
// model is left out. `usd`: the price of a picture at 1024² (lauluvaljak's recorded costs), est where none is recorded.
// Nano Banana Pro, the dearest, goes last, so a budget stop takes it first.
const MODELS = {
  'flux-2-klein-4b': { usd: 0.0011 }, 'flux-1-schnell': { usd: 0.0007 }, sdxl: { usd: 0 }, 'sdxl-lightning': { usd: 0 },
  'dreamshaper-8-lcm': { usd: 0 }, 'p-image': { usd: 0.005 }, 'flux-3-image-klein': { usd: 0.009 }, 'flux-2-klein-9b': { usd: 0.015 },
  'phoenix-1.0': { usd: 0.026 }, 'flux-2-pro-preview': { usd: 0.03 }, 'lucid-origin': { usd: 0.031 }, 'flux-2-dev': { usd: 0.033 },
  'nano-banana-2-lite': { usd: 0.04, est: true }, 'recraft-v4.1-flash': { usd: 0.04, est: true }, 'qwen-image-3.0-pro': { usd: 0.04 },
  'seedream-5-pro': { usd: 0.045 }, 'grok-imagine-image-quality': { usd: 0.05 }, 'gpt-image-2': { usd: 0.06, est: true },
  'nano-banana-pro': { usd: 0.134 },
};
const BUDGET = Number(process.env.BUDGET ?? 2.5);
const dirOf = (m) => m.replace('/', '-');
const ALT = process.env.PROMPT ? 'prompt' : 'alt';   // pictures from a PROMPT of one's own are numbered apart from the same-prompt ones
const fileOf = (m, f, alt) => `${OUT}${dirOf(m)}/${f}${alt ? `-${ALT}${alt}` : ''}.png`;
// a refusal: the provider's content filter or a copyright check, not a server failure
const REFUSAL = /moderat|2017|3030|flagged|copyright|safety|policy|content|blocked|refus|not allowed|violat|sensitive/i;
const runs = () => readJson(RUNS, []);
const refused = (m, f) => runs().some((r) => r.model === m && r.film === f && r.refusal) && !existsSync(fileOf(m, f));
const priceOf = (r) => (r.usage?.cost_usd != null ? r.usage.cost_usd : r.usage?.neurons != null ? (r.usage.neurons * 0.011) / 1000 : r.file ? MODELS[r.model]?.usd ?? 0.05 : 0);

// ---- draw ----

let stopped = null;
async function draw(model, film, alt) {
  const file = fileOf(model, film, alt);
  const prompt = (alt && process.env.PROMPT) || promptOf(film);
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
    const error = `${res.status} ${data.error ?? ''} ${typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail ?? '')}`.slice(0, 400);
    const refusal = res.status !== 0 && res.status !== 402 && res.status !== 429 && REFUSAL.test(error);
    const all = runs(); all.push({ model, film, alt, prompt, file: null, error, refusal, seconds, at: new Date().toISOString() }); writeFileSync(RUNS, JSON.stringify(all, null, 1));
    console.log(`${model} ${film} ${refusal ? 'REFUSED' : 'failed'}: ${error}`);
    if (res.status === 402 || /credit|insufficient|2021|balance/i.test(error)) stopped = error;
    return;
  }
  const buf = Buffer.from(data.data[0].b64_json, 'base64');
  mkdirSync(file.replace(/[^/]+$/, ''), { recursive: true });
  const got = await sharp(buf).metadata();
  await sharp(buf).png().toFile(file);
  const all = runs();
  all.push({ model, film, alt, prompt, file: file.replace(OUT, ''), got: `${got.width}x${got.height}`, seconds, usage: data.usage ?? null, at: new Date().toISOString() });
  writeFileSync(RUNS, JSON.stringify(all, null, 1));
  console.log(`${model} ${film}${alt ? ` ${ALT}${alt}` : ''} ${seconds.toFixed(1)}s ${got.width}x${got.height} $${priceOf(all.at(-1)).toFixed(4)}`);
}

async function drawAll(names, retry) {
  const models = names.length ? names : Object.keys(MODELS);
  const todo = models.flatMap((m) => Object.keys(FILMS).map((f) => [m, f])).filter(([m, f]) => !existsSync(fileOf(m, f)) && (retry || !refused(m, f)));
  let spent = runs().reduce((s, r) => s + priceOf(r), 0);
  console.log(`${todo.length} pictures to ask for, $${spent.toFixed(3)} spent so far, BUDGET=$${BUDGET}`);
  mkdirSync(OUT, { recursive: true });
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < todo.length && !stopped) {
      const [m, f] = todo[i++];
      const est = MODELS[m]?.usd ?? 0.05;
      if (spent + est > BUDGET) { console.log(`${m} ${f} skipped: would pass BUDGET`); continue; }
      spent += est;   // reserved before the call, so four parallel draws cannot pass the budget together
      await draw(m, f);
    }
  }));
  if (stopped) console.log(`stopped: ${stopped}`);
}

function cost() {
  const all = runs();
  const made = all.filter((r) => r.file);
  let known = 0, est = 0;
  for (const r of made) { if (r.usage?.cost_usd != null || r.usage?.neurons != null) known += priceOf(r); else est += priceOf(r); }
  const ref = new Set(all.filter((r) => r.refusal).map((r) => `${r.model}/${r.film}`));
  console.log(`${made.length} pictures: $${known.toFixed(3)} recorded, about $${est.toFixed(3)} estimated; ${ref.size} model/film pairs refused at least once`);
}

// ---- sheet ----

async function sheet() {
  const S = 220, models = Object.keys(MODELS), films = Object.keys(FILMS);
  const tiles = [];
  for (const [r, m] of models.entries()) for (const [c, f] of films.entries()) {
    const label = Buffer.from(`<svg width="${S}" height="20"><rect width="100%" height="100%" fill="#000a"/><text x="4" y="14" font-size="11" font-family="sans-serif" fill="#fff">${m} / ${f}</text></svg>`);
    const base = existsSync(fileOf(m, f)) ? sharp(fileOf(m, f)).resize(S, S, { fit: 'cover' })
      : sharp({ create: { width: S, height: S, channels: 3, background: refused(m, f) ? '#733' : '#333' } });
    tiles.push({ input: await base.composite([{ input: label, top: S - 20, left: 0 }]).png().toBuffer(), top: r * S, left: c * S });
  }
  await sharp({ create: { width: films.length * S, height: models.length * S, channels: 3, background: '#222' } }).composite(tiles).jpeg({ quality: 78 }).toFile(`${OUT}sheet.jpg`);
  console.log(`${OUT}sheet.jpg`);
}

// ---- judge: where is this, and which film? ----

// The first two lines are nature.mjs QUESTION word for word; the film question is added in the same call (one call a
// picture keeps the judge within its budget). The place is asked first, the film after it.
const QUESTION = `Which country was this photo most likely taken in? Look only at what is in the picture.
Also: which film is this a still from, if any?
Answer with JSON only, no other text:
{"country": "<one country name in English, or \\"unknown\\">", "confidence": <0 to 1>,
 "region": "<the region, province or county within that country, or null>",
 "reason": "<one short sentence: what in the picture points there>",
 "film": {"title": "<the film's title, or null if you cannot name one>", "country": "<the film's country, or null>", "year": <the film's year, or null>, "confidence": <0 to 1>}}`;
const JUDGE = { id: 'google/gemini-3.8-flash', in: 0.75, out: 3.75 }; // $ per M tokens, catalog 2026-11-16
const JBUDGET = Number(process.env.JBUDGET ?? 0.4);

// every picture made with the film's own prompt: <film>.png and its `more` repeats <film>-alt<k>.png (asked 2026-11-18:
// "add flux-3-image-klein 3 x each movie", into the deck); the <film>-prompt<k>.png tries had other prompts and stay out
function pictures() {
  return Object.keys(MODELS).flatMap((m) => Object.keys(FILMS).flatMap((f) => {
    const alts = existsSync(`${OUT}${dirOf(m)}`) ? readdirSync(`${OUT}${dirOf(m)}`).map((n) => n.match(new RegExp(`^${f}-alt(\\d+)\\.png$`))?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b) : [];
    return [...(existsSync(fileOf(m, f)) ? [{ name: `${dirOf(m)}/${f}`, model: m, film: f, src: fileOf(m, f) }] : []),
      ...alts.map((k) => ({ name: `${dirOf(m)}/${f}-alt${k}`, model: m, film: f, alt: k, src: `${OUT}${dirOf(m)}/${f}-alt${k}.png` }))];
  }));
}

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
      const jpg = await sharp(p.src).resize(768, 768, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();   // no metadata
      const row = { name: p.name, model: p.model, film: p.film, judge: JUDGE.id };
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
          const u = data.usage;   // thinking is billed as output: total - prompt counts it (nature.mjs)
          row.usd = u ? ((u.prompt_tokens ?? 0) * JUDGE.in + (((u.total_tokens ?? 0) - (u.prompt_tokens ?? 0)) || (u.completion_tokens ?? 0)) * JUDGE.out) / 1e6 : null;
          Object.assign(row, answer, { usage: u ?? null });
          delete row.error;
        } catch (e) { row.error = e.message; if (e.stop) { i = todo.length; break; } await sleep(2000 * attempt); }
      }
      spent += row.usd ?? 0;
      appendFileSync(cache, JSON.stringify(row) + '\n');
      console.log(`${p.name.padEnd(40)} ${row.country ?? 'FAILED ' + row.error} ${row.confidence ?? ''} ${row.region ?? ''} | ${row.film?.title ?? '-'} ${row.film?.year ?? ''} ${row.film?.confidence ?? ''}`);
    }
  }));
  places();
}

// ---- places.json: slides.html's entries ----

// Points as places.mjs judgePoints(): an Estonian county at its centroid, else the country's centroid (Natural Earth,
// out/natural-earth/centroids.json), w = confidence, r = the spread in km; "unknown" gives none.
const ALIAS = { 'United States': 'United States of America', USA: 'United States of America', UK: 'United Kingdom', England: 'United Kingdom',
  'Czech Republic': 'Czechia', 'Bosnia and Herzegovina': 'Bosnia and Herz.', 'Soviet Union': 'Russia', USSR: 'Russia' };
const EE = { Harju: [59.33, 24.75, 40], Hiiu: [58.88, 22.6, 30], 'Ida-Viru': [59.2, 27.4, 40], Jõgeva: [58.75, 26.4, 35], Järva: [58.88, 25.55, 35],
  Lääne: [58.95, 23.75, 35], 'Lääne-Viru': [59.25, 26.35, 35], Põlva: [58.05, 27.2, 30], Pärnu: [58.4, 24.3, 45], Rapla: [58.95, 24.75, 35],
  Saare: [58.4, 22.5, 40], Tartu: [58.4, 26.8, 35], Valga: [57.9, 26.1, 30], Viljandi: [58.35, 25.6, 35], Võru: [57.75, 27.0, 30] };
const regionKey = (s) => s.replace(/\s+(County|maakond|Oblast|Region)$/i, '').replace(/maa$/, '').trim();
const round = (x, n = 3) => Math.round(x * 10 ** n) / 10 ** n;
let CENT = null;
function judgePoints(a) {
  if (!a || !a.country || /^unknown$/i.test(a.country)) return [];
  CENT ??= readJson(here('./out/natural-earth/centroids.json'), {});
  const w = round(a.confidence ?? 0.5);
  if (/^estonia$/i.test(a.country) && a.region) {
    const k = regionKey(a.region);
    const hit = EE[k] ?? Object.entries(EE).find(([x]) => k.startsWith(x) || x.startsWith(k))?.[1];
    if (hit) return [{ lat: hit[0], lon: hit[1], w, r: hit[2], name: a.region }];
  }
  const c = CENT[ALIAS[a.country] ?? a.country];
  if (!c) { console.warn(`no centroid for ${a.country}`); return []; }
  return [{ lat: c.lat, lon: c.lon, w, r: c.r, name: a.country }];
}

function places() {
  const rows = new Map(readJsonl(`${OUT}judge.jsonl`).filter((r) => r.country).map((r) => [r.name, r]));
  const out = {};
  for (const p of pictures()) {
    const a = rows.get(p.name) ?? null;
    const F = FILMS[p.film];
    const file = `films/${p.name}.png`;
    out[file] = { file, kind: 'generated', subject: p.film, task: p.film, variant: 'named', model: p.model, ...(p.alt ? { alt: p.alt } : {}), prompt: promptOf(p.film),
      asked: F.asked, points: judgePoints(a), source: 'judge',
      judge: a ? { country: a.country, region: a.region ?? null, confidence: a.confidence, reason: a.reason, judge: a.judge } : null,
      film_guess: a?.film ?? null };
  }
  // refusals: a model asked for a film that never drew it
  for (const r of runs().filter((r) => r.refusal)) {
    if (existsSync(fileOf(r.model, r.film))) continue;
    out[`refused:${dirOf(r.model)}/${r.film}`] = { file: null, kind: 'refused', subject: r.film, model: r.model, prompt: promptOf(r.film), error: r.error, asked: FILMS[r.film].asked };
  }
  // one field per film, the pictures' points summed (places.mjs bySubject), for the title slide's map
  for (const f of Object.keys(FILMS)) {
    const es = Object.values(out).filter((e) => e.kind === 'generated' && e.subject === f);
    const acc = new Map();
    for (const e of es) for (const p of e.points) { const k = `${p.lat},${p.lon}`; const q = acc.get(k) ?? { lat: p.lat, lon: p.lon, w: 0, r: p.r, name: p.name }; q.w += p.w; acc.set(k, q); }
    const pts = [...acc.values()], max = Math.max(...pts.map((p) => p.w), 1e-9);
    out[f] = { file: null, kind: 'subject', subject: f, title: FILMS[f].title, ...(FILMS[f].group ? { group: FILMS[f].group } : {}), year: FILMS[f].year, asked: FILMS[f].asked, source: 'judge', n: es.length,
      points: pts.map((p) => ({ ...p, w: round(p.w / max) })).sort((a, b) => b.w - a.w) };
  }
  writeFileSync(`${OUT}places.json`, JSON.stringify(out, null, 1));
  const gen = Object.values(out).filter((e) => e.kind === 'generated');
  for (const f of Object.keys(FILMS)) {
    const es = gen.filter((e) => e.subject === f);
    const ee = es.filter((e) => /^estonia$/i.test(e.judge?.country ?? '')).length;
    const named = es.filter((e) => e.film_guess?.title && e.film_guess.title.toLowerCase().includes(FILMS[f].title.toLowerCase().split(' ')[0])).length;
    const elsewhere = {};
    for (const e of es) if (!/^estonia$/i.test(e.judge?.country ?? '')) elsewhere[e.judge?.country ?? '?'] = (elsewhere[e.judge?.country ?? '?'] ?? 0) + 1;
    console.log(`${f}: ${es.length} pictures, ${ee} in Estonia, ${named} named as the film; elsewhere ${JSON.stringify(elsewhere)}`);
  }
  console.log(`judge cost: $${readJsonl(`${OUT}judge.jsonl`).reduce((s, r) => s + (r.usd ?? 0), 0).toFixed(4)}`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'draw' || cmd === 'retry') { await drawAll(rest, cmd === 'retry'); cost(); }
else if (cmd === 'more') {
  const [m, f, n = 3] = rest;
  if (!MODELS[m] || !FILMS[f]) throw new Error('node films.mjs more <model> <film> [n]');
  let k = 1; while (existsSync(fileOf(m, f, k))) k++;
  for (let i = 0; i < Number(n) && !stopped; i++) await draw(m, f, k + i);
  cost();
}
else if (cmd === 'judge') await judge();
else if (cmd === 'places') places();
else if (cmd === 'sheet') await sheet();
else if (cmd === 'cost') cost();
else console.log('node films.mjs draw [model ...] | retry [model ...] | judge | places | sheet | cost');
