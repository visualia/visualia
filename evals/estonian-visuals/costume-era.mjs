// Muhu by year: does a newer picture model know one Estonian costume better, or only look more
// "Estonian"? The round-two plain prompt ("Muhu women's folk costume", costume-round2.mjs) on each
// era model that runs in the cloud, 3 pictures each (no seed: each call draws anew). Scored as in
// round two: Muhu's and Kihnu's calibrated criteria (out/rahvaroivad/round2/criteria-v2/) in one
// list, Gemini 3.8 Flash; the parish from the closed list of 12, Gemini alone; plus era.mjs's plain
// country question. Research only; out/costume-era/ is git-ignored, nothing published.
//
//   KEY_PERSON=eka-teacher node costume-era.mjs draw     # pictures through /v1/images (resumable)
//   node costume-era.mjs judge                           # criteria, parish, country (resumable)
//   node costume-era.mjs report                          # scores.json, sheet.jpg, a table on stdout
//   node costume-era.mjs all
//
// Env: GATEWAY, KEY_PERSON (a key in .keys.local), BUDGET (dollars, default 1.50, own count in
// out/costume-era/spend.jsonl), MODELS (comma list of ids below). A 402 from the gateway stops the run.
// Local-only era models (DALL·E mini, SD 1.4, ChilloutMix) need the M1: listed in scores.json as not run.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const OUT = here('./out/costume-era/');
const R2 = here('./out/rahvaroivad/round2/');
const GATEWAY = (process.env.GATEWAY ?? 'https://gw.visualia.space').replace(/\/$/, '');
const GEMINI = 'google/gemini-3.8-flash';
const PROMPT = "Muhu women's folk costume";
const N = 3;
const BUDGET = Number(process.env.BUDGET ?? 1.5);

// Year: when the model came out (as era.mjs). est: dollars a picture where the gateway records none.
const MODELS = [
  { id: 'sdxl', year: 2023, label: 'SDXL 1.0', est: 0 },
  { id: 'flux-1-schnell', year: 2024, label: 'FLUX.1 schnell', est: 0.001 },
  { id: 'flux-2-dev', year: 2025, label: 'FLUX.2 dev', est: 0.033 },
  { id: 'flux-2-klein-4b', year: 2025, label: 'FLUX.2 klein 4B', est: 0.002 },
  { id: 'flux-3-image-klein', year: 2026, label: 'FLUX.3 klein', est: 0.009 },
  { id: 'nano-banana-2-lite', year: 2026, label: 'Nano Banana 2 lite', est: 0.039 },
  { id: 'gpt-image-2', year: 2026, label: 'GPT Image 2', est: 0.07 },
  { id: 'nano-banana-pro', year: 2026, label: 'Nano Banana Pro', est: 0.134 },
];
const NOT_RUN = [
  { id: 'dalle-mini', year: 2022, label: 'DALL·E mini', why: 'local only (Chrome tab with WebGPU on the M1), not run' },
  { id: 'sd-1.4', year: 2022, label: 'Stable Diffusion 1.4', why: 'local only (sd.cpp on the M1), not run' },
  { id: 'chilloutmix', year: 2023, label: 'ChilloutMix', why: 'local only (sd.cpp on the M1), not run' },
];
const only = process.env.MODELS?.split(',');
const RUN = MODELS.filter((m) => !only || only.includes(m.id));
mkdirSync(OUT, { recursive: true });

function key() {
  const keys = Object.fromEntries(readFileSync(here('../../.keys.local'), 'utf8').trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  const k = keys[process.env.KEY_PERSON ?? 'eka-teacher'];
  if (!k) throw new Error('no key for KEY_PERSON in .keys.local');
  return k;
}
const KEY = key();

const spent = () => (existsSync(`${OUT}spend.jsonl`) ? readFileSync(`${OUT}spend.jsonl`, 'utf8').trim().split('\n').filter(Boolean).reduce((s, l) => s + JSON.parse(l).usd, 0) : 0);
const charge = (what, usd) => appendFileSync(`${OUT}spend.jsonl`, JSON.stringify({ what, usd }) + '\n');
class Stop extends Error {}

async function post(path, body) {
  const res = await fetch(GATEWAY + path, { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 402) throw new Stop(`402 from the gateway: ${JSON.stringify(data).slice(0, 200)}`);
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data.detail ?? data.error ?? data)}`.slice(0, 300));
  return data;
}

// ---- draw ----
async function draw() {
  for (const m of RUN) for (let n = 1; n <= N; n++) {
    const file = `${OUT}${m.id}/${n}.png`;
    if (existsSync(file)) continue;
    if (spent() + m.est > BUDGET) throw new Stop(`budget of $${BUDGET} reached`);
    const t0 = Date.now();
    let data;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try { data = await post('/v1/images', { model: m.id, prompt: PROMPT, size: '768x1024' }); break; } catch (err) {
        if (err instanceof Stop) throw err;
        console.log(`${m.id} ${n} attempt ${attempt}: ${err.message}`);
        if (attempt === 3) data = null; else await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
    if (!data) continue;
    mkdirSync(`${OUT}${m.id}`, { recursive: true });
    await sharp(Buffer.from(data.data[0].b64_json, 'base64')).png().toFile(file);
    const usd = data.usage?.cost_usd ?? m.est;
    charge(`${m.id} picture`, usd);
    writeFileSync(`${OUT}${m.id}/${n}.json`, JSON.stringify({ model: m.id, prompt: PROMPT, size: data.size, usage: data.usage, usd, seconds: (Date.now() - t0) / 1000 }, null, 1));
    console.log(`${m.id.padEnd(20)} ${n} ${((Date.now() - t0) / 1000).toFixed(1)} s $${usd}`);
  }
}

// ---- judge ----
const criteriaOf = (slug) => JSON.parse(readFileSync(`${R2}criteria-v2/${slug}.json`, 'utf8')).criteria.filter((c) => c.status !== 'dropped');
const PRICE = [0.75, 3.75]; // Gemini 3.8 Flash, dollars per million tokens in and out (as costume-round2.mjs)

async function chat(content, max_tokens = 3000) {
  for (let i = 1; ; i++) {
    let res, data;
    try {
      res = await fetch(`${GATEWAY}/v1/chat/completions`, {
        method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: GEMINI, max_tokens, reasoning_effort: 'low', messages: [{ role: 'user', content }] }),
      });
      data = await res.json().catch(() => ({}));
    } catch (err) { if (i >= 3) throw err; await new Promise((r) => setTimeout(r, 4000 * i)); continue; }
    if (res.status === 402) throw new Stop(`402 from the gateway: ${JSON.stringify(data).slice(0, 200)}`);
    const text = data.choices?.[0]?.message?.content;
    if (res.ok && text) {
      const u = data.usage ?? {};
      charge(GEMINI, ((u.prompt_tokens ?? 0) * PRICE[0] + ((u.completion_tokens ?? 0) + (u.completion_tokens_details?.reasoning_tokens ?? 0)) * PRICE[1]) / 1e6);
      try { return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch { if (i >= 3) throw new Error(`no JSON: ${text.slice(0, 200)}`); continue; }
    }
    if (i >= 3) throw new Error(`${res.status} ${JSON.stringify(data).slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 4000 * i));
  }
}

// The picture as round two sent it: a JPEG, 768 px on the longest side.
async function dataUrl(file) {
  const jpg = await sharp(file).resize(768, 768, { fit: 'inside' }).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${jpg.toString('base64')}`;
}

// Same wording as costume-round2.mjs (JUDGE, ASK) and era.mjs (QUESTION).
const JUDGE = `A photograph of a person in clothing (if there are several people, look only at the adult woman). Answer each question by looking only at the picture:
"yes" if it is visibly so, "no" if that part is visible and is different, "hidden" if that part cannot be seen (covered, out of frame, or turned away).`;
const PARISH_LIST = ['Emmaste', 'Halliste', 'Kadrina', 'Kihelkonna', 'Kihnu', 'Muhu', 'Noarootsi', 'Räpina', 'Setomaa', 'Tarvastu', 'Tõstamaa', 'Vormsi'];
const ASK = `Which Estonian folk costume is this? Look only at the clothing (if there are several people, the adult woman).
(a) Region, one of: Põhja (North Estonia), Lääne (West Estonia), Lõuna (South Estonia), Saared (the islands), Setomaa.
(b) Parish (kihelkond), one of: ${PARISH_LIST.join(', ')}; or "other" if it is none of these.
JSON: {"region": "...", "parish": "...", "confidence": 0.0-1.0, "details": "the visible details you based it on, short"}`;
const QUESTION = `Which country was this photo most likely taken in? Look only at what is in the picture.
Answer with JSON only, no other text:
{"country": "<one country name in English, or \\"unknown\\">", "confidence": <0 to 1>,
 "region": "<the region, province or county within that country, or null>",
 "reason": "<one short sentence: what in the picture points there>"}`;

const readRows = () => (existsSync(`${OUT}judge.jsonl`) ? readFileSync(`${OUT}judge.jsonl`, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

async function judge() {
  const done = new Set(readRows().map((r) => `${r.model}|${r.n}|${r.ask}`));
  const qs = ['muhu', 'kihnu'].flatMap((slug) => criteriaOf(slug).map((c) => ({ slug, q: c.question })));
  const criteriaText = `${JUDGE}\n${qs.map((x, i) => `${i + 1}. ${x.q}`).join('\n')}\n\nJSON: {"answers": [{"n": 1, "a": "yes"|"no"|"hidden"}]}`;
  for (const m of RUN) for (let n = 1; n <= N; n++) {
    const file = `${OUT}${m.id}/${n}.png`;
    if (!existsSync(file)) continue;
    const img = { type: 'image_url', image_url: { url: await dataUrl(file) } };
    for (const ask of ['criteria', 'parish', 'country']) {
      if (done.has(`${m.id}|${n}|${ask}`)) continue;
      if (spent() > BUDGET) throw new Stop(`budget of $${BUDGET} reached`);
      const text = ask === 'criteria' ? criteriaText : ask === 'parish' ? ASK : QUESTION;
      let a;
      try { a = await chat([img, { type: 'text', text }]); } catch (err) { if (err instanceof Stop) throw err; console.log(`${m.id} ${n} ${ask}: ${err.message}`); continue; }
      const row = { model: m.id, n, ask, judge: GEMINI };
      if (ask === 'criteria') {
        const by = Object.fromEntries((a.answers ?? []).map((x) => [x.n, String(x.a).toLowerCase()]));
        row.answers = Object.fromEntries(['muhu', 'kihnu'].map((slug) => [slug, qs.map((x, i) => ({ ...x, a: by[i + 1] ?? 'hidden' })).filter((x) => x.slug === slug).map((x) => x.a)]));
      } else row.answer = a;
      appendFileSync(`${OUT}judge.jsonl`, JSON.stringify(row) + '\n');
      console.log(`${m.id.padEnd(20)} ${n} ${ask.padEnd(8)} ${ask === 'criteria' ? row.answers.muhu.join(' ') : ask === 'parish' ? `${a.region} / ${a.parish}` : `${a.country} / ${a.region}`}`);
    }
  }
}

// ---- report ----
// Share of criteria answered yes among those the judge could see (yes or no), per picture.
const share = (answers) => { const v = answers.filter((a) => a !== 'hidden'); return v.length ? (100 * v.filter((a) => a === 'yes').length) / v.length : null; };
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const r0 = (x) => (x == null ? null : Math.round(x));

async function report() {
  const rows = readRows();
  const get = (m, n, ask) => rows.filter((r) => r.model === m && r.n === n && r.ask === ask).at(-1);
  const table = [];
  for (const m of MODELS) {
    const pics = [];
    for (let n = 1; n <= N; n++) {
      if (!existsSync(`${OUT}${m.id}/${n}.png`)) continue;
      const c = get(m.id, n, 'criteria'), p = get(m.id, n, 'parish'), k = get(m.id, n, 'country');
      pics.push({ n, file: `${m.id}/${n}.png`, muhu: r0(c && share(c.answers.muhu)), kihnu: r0(c && share(c.answers.kihnu)), muhu_answers: c?.answers.muhu,
        parish: p?.answer.parish ?? null, region: p?.answer.region ?? null, country: k?.answer.country ?? null, country_region: k?.answer.region ?? null, reason: k?.answer.reason ?? null });
    }
    const ms = pics.map((p) => p.muhu).filter((x) => x != null);
    const ks = pics.map((p) => p.kihnu).filter((x) => x != null);
    const placed = pics.filter((p) => p.country);
    const named = pics.filter((p) => p.parish);
    table.push({
      model: m.id, label: m.label, year: m.year, pictures: pics.length,
      criteria_pct: r0(mean(ms)), criteria_min: ms.length ? Math.min(...ms) : null, criteria_max: ms.length ? Math.max(...ms) : null,
      kihnu_criteria_pct: r0(mean(ks)),
      estonia: `${placed.filter((p) => /estonia/i.test(p.country)).length}/${placed.length}`,
      estonia_share: placed.length ? placed.filter((p) => /estonia/i.test(p.country)).length / placed.length : null,
      muhu_named: `${named.filter((p) => /^muhu$/i.test(p.parish.trim())).length}/${named.length}`,
      parish_named: named.map((p) => p.parish), countries: placed.map((p) => p.country), items: pics,
    });
  }
  const usd = spent();
  writeFileSync(`${OUT}scores.json`, JSON.stringify({
    question: 'Does a newer picture model know the Muhu costume better, or only look more Estonian?',
    prompt: PROMPT, pictures_per_model: N, judge: GEMINI,
    criteria: 'Muhu calibrated criteria (round two, v2, 6 questions): share answered yes among those visible, per picture; mean and range per model. kihnu_criteria_pct: the same pictures on Kihnu\'s criteria (the confusable partner).',
    estonia: 'the plain country question (era.mjs): pictures placed in Estonia / judged',
    parish: 'Gemini alone, closed list of 12 parishes or "other" (round two)',
    caution: 'Judge is Gemini (Google): it judges Google\'s own Nano Banana pictures. 3 pictures a model.',
    spent_usd: +usd.toFixed(3), models: table, not_run: NOT_RUN,
  }, null, 1));

  console.log('| year | model | criteria % (range) | Kihnu criteria % | placed in Estonia | parish named |');
  console.log('|---|---|---|---|---|---|');
  for (const t of NOT_RUN) console.log(`| ${t.year} | ${t.label} | not run (M1) | | | |`);
  for (const t of table) console.log(`| ${t.year} | ${t.label} | ${t.criteria_pct ?? '–'} (${t.criteria_min}–${t.criteria_max}) | ${t.kihnu_criteria_pct ?? '–'} | ${t.estonia} | ${t.parish_named.join(', ')} |`);
  console.log(`spent (own count): $${usd.toFixed(3)}`);
  await sheet(table);
}

// Contact sheet: one row per model, by year; 3 pictures each; a label column.
async function sheet(table) {
  const W = 240, H = 320, L = 260, G = 8;
  const rows = table.filter((t) => t.pictures);
  const width = L + N * (W + G) + G, height = rows.length * (H + G) + G + 50;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const parts = [];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><style>text{font-family:Helvetica,Arial,sans-serif;fill:#111}</style>`;
  svg += `<text x="${G}" y="32" font-size="22">"${esc(PROMPT)}" by year · judge Gemini 3.8 Flash</text>`;
  rows.forEach((t, i) => {
    const y = 50 + G + i * (H + G);
    svg += `<text x="${G}" y="${y + 34}" font-size="30">${t.year}</text>`;
    svg += `<text x="${G}" y="${y + 66}" font-size="20">${esc(t.label)}</text>`;
    svg += `<text x="${G}" y="${y + 110}" font-size="22">criteria ${t.criteria_pct ?? '–'} %</text>`;
    svg += `<text x="${G}" y="${y + 136}" font-size="16">range ${t.criteria_min}–${t.criteria_max}</text>`;
    svg += `<text x="${G}" y="${y + 170}" font-size="18">Estonia ${t.estonia}</text>`;
    svg += `<text x="${G}" y="${y + 196}" font-size="18">Muhu named ${t.muhu_named}</text>`;
    t.items.forEach((p, j) => {
      const x = L + G + j * (W + G);
      parts.push({ file: `${OUT}${p.file}`, left: x, top: y });
      svg += `<rect x="${x}" y="${y + H - 26}" width="${W}" height="26" fill="#fff" fill-opacity="0.85"/>`;
      svg += `<text x="${x + 6}" y="${y + H - 8}" font-size="15">${p.muhu ?? '–'} % · ${esc(p.parish ?? '?')} · ${esc(p.country ?? '?')}</text>`;
    });
  });
  svg += '</svg>';
  const tiles = await Promise.all(parts.map(async (p) => ({ input: await sharp(p.file).resize(W, H, { fit: 'cover', position: 'top' }).toBuffer(), left: p.left, top: p.top })));
  await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
    .composite([...tiles, { input: Buffer.from(svg), left: 0, top: 0 }]).jpeg({ quality: 85 }).toFile(`${OUT}sheet.jpg`);
  console.log(`wrote ${OUT}sheet.jpg`);
}

const cmd = process.argv[2];
try {
  if (cmd === 'draw') await draw();
  else if (cmd === 'judge') await judge();
  else if (cmd === 'report') await report();
  else if (cmd === 'all') { await draw(); await judge(); await report(); }
  else console.log('usage: node costume-era.mjs draw | judge | report | all');
} catch (err) {
  if (err instanceof Stop) { console.log(`stopped: ${err.message}`); process.exitCode = 2; } else throw err;
}
